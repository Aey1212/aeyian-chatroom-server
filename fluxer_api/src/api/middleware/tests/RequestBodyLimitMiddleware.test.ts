// SPDX-License-Identifier: AGPL-3.0-or-later

// Ported from upstream Fluxer (9c3fb9acb, 9dc6dfb52), without the thread routes we don't have, plus
// the routes only this fork has (branding assets, sounds, cosmetics).

import {createTestAccount, type TestAccount} from '@app/api/auth/tests/AuthTestUtils';
import {createMultipartFormData, sendMessageWithAttachments} from '@app/api/channel/tests/AttachmentTestUtils';
import {VALID_PNG_BASE64} from '@app/api/emoji/tests/EmojiTestUtils';
import {createGuild} from '@app/api/guild/tests/GuildTestUtils';
import {ensureSessionStarted} from '@app/api/message/tests/MessageTestUtils';
import {
	DEFAULT_REQUEST_BODY_LIMIT,
	isMultipartFormData,
	jsonAssetBodyLimit,
} from '@app/api/middleware/RequestBodyLimitMiddleware';
import {type ApiTestHarness, createApiTestHarness} from '@app/api/test/ApiTestHarness';
import {ASSET_FORMAT_POLICY} from '@fluxer/constants/src/AssetFormatPolicy';
import {ENTRANCE_SOUND_MAX_BYTES} from '@fluxer/constants/src/EntranceSoundConstants';
import {AVATAR_MAX_SIZE} from '@fluxer/constants/src/LimitConstants';
import {SOUNDBOARD_SOUND_MAX_BYTES} from '@fluxer/constants/src/SoundboardConstants';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

function maxSizeAvatarDataUrl(): string {
	const image = Buffer.from(VALID_PNG_BASE64, 'base64');
	return `data:image/png;base64,${Buffer.concat([image, Buffer.alloc(AVATAR_MAX_SIZE - image.length)]).toString('base64')}`;
}

function jsonBodyOfLength(length: number): string {
	const prefix = '{"name":"Sized","pad":"';
	const suffix = '"}';
	return `${prefix}${'a'.repeat(length - prefix.length - suffix.length)}${suffix}`;
}

function base64Length(bytes: number): number {
	return 4 * Math.ceil(bytes / 3);
}

const MIB = 1024 * 1024;

describe('isMultipartFormData', () => {
	it('matches only the multipart/form-data media type', () => {
		expect(isMultipartFormData('multipart/form-data; boundary=x')).toBe(true);
		expect(isMultipartFormData(' Multipart/Form-Data ;boundary=x')).toBe(true);
		expect(isMultipartFormData('application/json; x=multipart/form-data')).toBe(false);
		expect(isMultipartFormData('multipart/form-data-ish')).toBe(false);
		expect(isMultipartFormData('multipart/mixed')).toBe(false);
		expect(isMultipartFormData(undefined)).toBe(false);
	});
});

describe('default request body limit', () => {
	it('fits the single-file JSON uploads only this fork has', () => {
		const envelope = 64 * 1024;
		expect(base64Length(SOUNDBOARD_SOUND_MAX_BYTES) + envelope).toBeLessThanOrEqual(DEFAULT_REQUEST_BODY_LIMIT);
		expect(base64Length(ENTRANCE_SOUND_MAX_BYTES) + envelope).toBeLessThanOrEqual(DEFAULT_REQUEST_BODY_LIMIT);
		expect(base64Length(ASSET_FORMAT_POLICY.cosmetic.maxBytes) + envelope).toBeLessThanOrEqual(
			DEFAULT_REQUEST_BODY_LIMIT,
		);
	});
});

describe('request body size limit', () => {
	let harness: ApiTestHarness;
	let owner: TestAccount;
	let guildId: string;
	let channelId: string;

	beforeAll(async () => {
		harness = await createApiTestHarness();
	});

	beforeEach(async () => {
		await harness.reset();
		owner = await createTestAccount(harness);
		await ensureSessionStarted(harness, owner.token);
		const guild = await createGuild(harness, owner.token, 'Body Limit Guild');
		guildId = guild.id;
		channelId = guild.system_channel_id!;
	});

	afterAll(async () => {
		await harness?.shutdown();
	});

	function send(path: string, method: string, body: string, headers: Record<string, string> = {}) {
		return harness.requestJson({path, method, body, headers: {Authorization: owner.token, ...headers}});
	}

	async function expectRouteLimit(path: string, method: string, routeLimit: number) {
		if (routeLimit > DEFAULT_REQUEST_BODY_LIMIT) {
			expect((await send(path, method, jsonBodyOfLength(DEFAULT_REQUEST_BODY_LIMIT + 1))).status).not.toBe(413);
		}
		expect((await send(path, method, jsonBodyOfLength(routeLimit + 1))).status).toBe(413);
	}

	it('answers an unknown route with a JSON body with 404', async () => {
		const response = await send('/v1/this-route-does-not-exist', 'POST', JSON.stringify({hello: 'world'}), {
			'Content-Type': 'application/json',
		});

		expect(response.status).toBe(404);
	});

	it('accepts a maximum-size avatar under the default limit', async () => {
		const body = JSON.stringify({name: 'Avatar Hook', avatar: maxSizeAvatarDataUrl()});
		expect(body.length).toBeLessThanOrEqual(DEFAULT_REQUEST_BODY_LIMIT);

		const response = await send(`/channels/${channelId}/webhooks`, 'POST', body);

		expect(response.status).toBe(200);
		expect(((await response.json()) as {avatar: string | null}).avatar).toBeTruthy();
	});

	it('rejects a streamed body one byte over the default limit', async () => {
		const response = await send(
			`/channels/${channelId}/webhooks`,
			'POST',
			jsonBodyOfLength(DEFAULT_REQUEST_BODY_LIMIT + 1),
		);

		expect(response.status).toBe(413);
		expect(await response.json()).toMatchObject({code: 'FILE_SIZE_TOO_LARGE'});
	});

	it('rejects a declared length one byte over the default limit', async () => {
		const body = jsonBodyOfLength(DEFAULT_REQUEST_BODY_LIMIT + 1);

		const response = await send(`/channels/${channelId}/webhooks`, 'POST', body, {
			'content-length': String(body.length),
		});

		expect(response.status).toBe(413);
	});

	it('gives the guild update route room for every guild image at once', async () => {
		await expectRouteLimit(
			`/guilds/${guildId}`,
			'PATCH',
			jsonAssetBodyLimit({guild_icon: 1, banner: 1, splash: 1, embed_splash: 1}),
		);
	});

	it('gives profile routes room for an avatar and a banner', async () => {
		const limit = jsonAssetBodyLimit({avatar: 1, banner: 1});
		await expectRouteLimit('/users/@me', 'PATCH', limit);
		await expectRouteLimit(`/guilds/${guildId}/members/@me`, 'PATCH', limit);
	});

	it('gives bulk emoji and sticker uploads room for 50 images', async () => {
		await expectRouteLimit(`/guilds/${guildId}/emojis/bulk`, 'POST', jsonAssetBodyLimit({emoji: 50}));
		await expectRouteLimit(`/guilds/${guildId}/stickers/bulk`, 'POST', jsonAssetBodyLimit({sticker: 50}));
	});

	it('caps guild settings at 4 MiB', async () => {
		await expectRouteLimit('/users/@me/guilds/@me/settings', 'PATCH', 4 * MIB);
	});

	it('gives the branding asset upload room for its 16,000,000-character image', async () => {
		await expectRouteLimit('/admin/instance/config/branding-assets', 'POST', 16_000_000 + MIB);
	});

	it('gives the GitHub webhook route a 25 MiB limit', async () => {
		await expectRouteLimit('/webhooks/1/token/github', 'POST', 25 * MIB);
	});

	it('applies the default limit to multipart bodies on routes that do not take uploads', async () => {
		const {body, contentType} = createMultipartFormData({}, [], {
			includePayloadJson: false,
			fields: {grant_type: 'authorization_code', code: 'a'.repeat(DEFAULT_REQUEST_BODY_LIMIT)},
		});
		expect(body.length).toBeGreaterThan(DEFAULT_REQUEST_BODY_LIMIT);

		const response = await harness.app.request('/oauth2/token', {
			method: 'POST',
			headers: {'Content-Type': contentType, 'x-forwarded-for': '127.0.0.1'},
			body,
		});

		expect(response.status).toBe(413);
		expect(await response.json()).toMatchObject({code: 'FILE_SIZE_TOO_LARGE'});
	});

	it('does not treat a content type that only mentions multipart/form-data as multipart', async () => {
		const response = await harness.app.request('/webhooks/livekit', {
			method: 'POST',
			headers: {'Content-Type': 'application/json; x=multipart/form-data', 'x-forwarded-for': '127.0.0.1'},
			body: Buffer.alloc(20 * MIB),
		});

		expect(response.status).toBe(413);
	});

	it('keeps the default limit for JSON bodies on upload routes', async () => {
		const response = await send(
			`/channels/${channelId}/messages`,
			'POST',
			jsonBodyOfLength(DEFAULT_REQUEST_BODY_LIMIT + 1),
		);

		expect(response.status).toBe(413);
	});

	it('lets multipart uploads above the default limit through on upload routes', async () => {
		const {response} = await sendMessageWithAttachments(
			harness,
			owner.token,
			channelId,
			{content: 'upload', attachments: [{id: 0, filename: 'big.bin'}]},
			[{index: 0, filename: 'big.bin', data: Buffer.alloc(DEFAULT_REQUEST_BODY_LIMIT + MIB)}],
		);

		expect(response.status).toBe(200);
	});
});
