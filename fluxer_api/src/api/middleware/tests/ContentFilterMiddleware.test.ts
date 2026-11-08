// SPDX-License-Identifier: AGPL-3.0-or-later

import ContentFilterMiddleware, {
	extractStringValues,
	shouldSkipContentFilterPath,
} from '@app/api/middleware/ContentFilterMiddleware';
import {phraseBlocklistCache} from '@app/api/middleware/PhraseBlocklistCache';
import {MultipartUploadRoute} from '@app/api/middleware/RequestBodyLimitMiddleware';
import type {HonoEnv} from '@app/api/types/HonoEnv';
import {requireRequestJsonBody} from '@app/api/utils/RequestJsonBody';
import {AppErrorHandler} from '@fluxer/errors/src/domains/core/ErrorHandlers';
import {Hono} from 'hono';
import {afterEach, beforeEach, describe, expect, test} from 'vitest';

const BANNED = 'zebracrossingbanned';

function buildApp() {
	const app = new Hono<HonoEnv>({strict: true});
	app.use(ContentFilterMiddleware);
	app.patch('/profile', async (ctx) => ctx.json(await requireRequestJsonBody(ctx.req)));
	app.post('/upload', MultipartUploadRoute(), async (ctx) => ctx.json({ok: true}));
	app.post('/form', async (ctx) => ctx.json(Object.fromEntries(await ctx.req.formData())));
	app.onError(AppErrorHandler);
	return app;
}

// Ported from upstream Fluxer (9dc6dfb52): a content type that only mentions multipart/form-data or
// x-www-form-urlencoded used to skip the filter for any JSON body.
describe('content filter content type handling', () => {
	beforeEach(() => phraseBlocklistCache.add(BANNED));
	afterEach(() => phraseBlocklistCache.remove(BANNED));

	test.each([
		'application/json',
		'application/json; x=multipart/form-data',
		'application/json; x=application/x-www-form-urlencoded',
		'multipart/form-data; boundary=x',
		'application/x-www-form-urlencoded',
	])('blocks a banned phrase in a JSON body sent as %s', async (contentType) => {
		const response = await buildApp().request('/profile', {
			method: 'PATCH',
			headers: {'Content-Type': contentType},
			body: JSON.stringify({bio: `hello ${BANNED}`}),
		});
		expect(response.status).toBe(403);
	});

	test('leaves multipart bodies on upload routes unread', async () => {
		const form = new FormData();
		form.set('payload_json', JSON.stringify({content: `hello ${BANNED}`}));
		form.set('files[0]', new File([new Uint8Array([1, 2, 3])], 'a.bin'));
		const response = await buildApp().request('/upload', {method: 'POST', body: form});
		expect(response.status).toBe(200);
	});

	test('keeps form bodies readable on form routes', async () => {
		const response = await buildApp().request('/form', {
			method: 'POST',
			headers: {'Content-Type': 'application/x-www-form-urlencoded'},
			body: 'grant_type=client_credentials&scope=bot',
		});
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({grant_type: 'client_credentials', scope: 'bot'});
	});
});

describe('extractStringValues', () => {
	test('returns text from user-generated content fields', () => {
		const body = {
			content: 'visible message content',
			code: 'public-vanity-code',
			embeds: [{title: 'embed title', description: 'embed description'}],
			attachments: [{filename: 'visible-filename.png', title: 'attachment title'}],
		};
		const result = extractStringValues(body);
		expect(result).toEqual([
			'visible message content',
			'public-vanity-code',
			'embed title',
			'embed description',
			'visible-filename.png',
			'attachment title',
		]);
	});
	test('omits machine metadata fields from nested payloads', () => {
		const body = {
			content: 'visible message content',
			attachments: [
				{
					id: '1',
					upload_filename: '2f31b930-d1ea-453f-aa6a-4f7ddc7d04d5',
					content_type: 'image/png',
					waveform: 'AA==',
					title: 'visible attachment title',
				},
			],
			allowed_mentions: {
				users: ['111111111111111111'],
				roles: ['222222222222222222'],
			},
			message_reference: {
				channel_id: '333333333333333333',
				message_id: '444444444444444444',
			},
			response: {
				clientDataJSON: 'eyJjaGFsbGVuZ2UiOiJub25jZSJ9',
			},
			synced_preferences: 'CgIIAQ==',
			thumbnail: 'data:image/png;base64,AAAA',
		};
		const result = extractStringValues(body);
		expect(result).toEqual(['visible message content', 'visible attachment title']);
	});
	test('omits fields with identifier and secret suffixes', () => {
		const body = {
			label: 'visible label',
			actor_user_id: '111111111111111111',
			channel_ids: ['222222222222222222'],
			content_hash: 'f'.repeat(64),
			encryption_key: 'p256dh-value',
			original_proof: 'email-proof-token',
			state_token: 'state-token',
		};
		const result = extractStringValues(body);
		expect(result).toEqual(['visible label']);
	});
});

describe('shouldSkipContentFilterPath', () => {
	test('skips credential-only request bodies', () => {
		const paths = [
			'/users/@me/email-change/verify-original',
			'/users/@me/mfa/totp/enable',
			'/users/@me/password-change/complete',
			'/users/@me/phone/verify',
			'/reports/dsa/email/verify',
		];
		const result = paths.map((path) => shouldSkipContentFilterPath(path));
		expect(result).toEqual([true, true, true, true, true]);
	});
	test('does not skip public content update request bodies', () => {
		const paths = ['/guilds/123/vanity-url', '/channels/123/messages', '/users/@me'];
		const result = paths.map((path) => shouldSkipContentFilterPath(path));
		expect(result).toEqual([false, false, false]);
	});
});
