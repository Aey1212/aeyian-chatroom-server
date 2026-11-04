// SPDX-License-Identifier: AGPL-3.0-or-later

import {createTestAccount, type TestAccount} from '@app/api/auth/tests/AuthTestUtils';
import {createChannelID, createGuildID} from '@app/api/BrandedTypes';
import {
	acceptInvite,
	addMemberRole,
	createChannel,
	createChannelInvite,
	createGuild,
	createRole,
	getRoles,
	updateRole,
} from '@app/api/guild/tests/GuildTestUtils';
import {getGatewayService, getMediaService} from '@app/api/middleware/ServiceRegistry';
import {type ApiTestHarness, createApiTestHarness} from '@app/api/test/ApiTestHarness';
import type {NoopGatewayService} from '@app/api/test/NoopGatewayService';
import {HTTP_STATUS} from '@app/api/test/TestConstants';
import {createBuilder} from '@app/api/test/TestRequestBuilder';
import {APIErrorCodes} from '@fluxer/constants/src/ApiErrorCodes';
import {DEFAULT_PERMISSIONS, Permissions} from '@fluxer/constants/src/ChannelConstants';
import {SOUNDBOARD_SOUND_MAX_BYTES} from '@fluxer/constants/src/SoundboardConstants';
import {ValidationErrorCodes} from '@fluxer/constants/src/ValidationErrorCodes';
import type {GuildResponse} from '@fluxer/schema/src/domains/guild/GuildResponseSchemas';
import type {SoundboardPlayResponse, SoundboardSoundResponse} from '@fluxer/schema/src/domains/guild/SoundboardSchemas';
import {afterAll, afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

const SAMPLE_RATE = 8000;

function wavBase64(seconds: number): string {
	const sampleCount = Math.round(seconds * SAMPLE_RATE);
	const dataLength = sampleCount * 2;
	const buffer = Buffer.alloc(44 + dataLength);
	buffer.write('RIFF', 0, 'ascii');
	buffer.writeUInt32LE(36 + dataLength, 4);
	buffer.write('WAVE', 8, 'ascii');
	buffer.write('fmt ', 12, 'ascii');
	buffer.writeUInt32LE(16, 16);
	buffer.writeUInt16LE(1, 20);
	buffer.writeUInt16LE(1, 22);
	buffer.writeUInt32LE(SAMPLE_RATE, 24);
	buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
	buffer.writeUInt16LE(2, 32);
	buffer.writeUInt16LE(16, 34);
	buffer.write('data', 36, 'ascii');
	buffer.writeUInt32LE(dataLength, 40);
	for (let index = 0; index < sampleCount; index += 1) {
		buffer.writeInt16LE(Math.round(6000 * Math.sin(index / 6)), 44 + index * 2);
	}
	return buffer.toString('base64');
}

function stubAudioMetadata(): void {
	vi.spyOn(getMediaService(), 'getMetadata').mockImplementation(async (request) => {
		const base64 = request.type === 'base64' ? request.base64 : '';
		const bytes = Buffer.from(base64, 'base64');
		return {
			format: 'wav',
			content_type: 'audio/wav',
			content_hash: 'test',
			size: bytes.length,
			duration: Math.max(0, bytes.length - 44) / (SAMPLE_RATE * 2),
			nsfw: false,
		} as Awaited<ReturnType<ReturnType<typeof getMediaService>['getMetadata']>>;
	});
}

interface Room {
	owner: TestAccount;
	member: TestAccount;
	guild: GuildResponse;
	voiceChannelId: string;
}

async function createRoom(harness: ApiTestHarness): Promise<Room> {
	const owner = await createTestAccount(harness);
	const member = await createTestAccount(harness);
	const guild = await createGuild(harness, owner.token, 'Soundboard Guild');
	const invite = await createChannelInvite(harness, owner.token, guild.system_channel_id!);
	await acceptInvite(harness, member.token, invite.code);
	const voice = await createChannel(harness, owner.token, guild.id, 'Voice', 2);
	return {owner, member, guild, voiceChannelId: voice.id};
}

function joinVoice(room: Room, accounts: Array<TestAccount>): void {
	(getGatewayService() as unknown as NoopGatewayService).setVoiceStatesForChannel({
		guildId: createGuildID(BigInt(room.guild.id)),
		channelId: createChannelID(BigInt(room.voiceChannelId)),
		voiceStates: accounts.map((account, index) => ({
			connectionId: `conn-${index}`,
			userId: account.userId,
			channelId: room.voiceChannelId,
		})),
	});
}

async function upload(
	harness: ApiTestHarness,
	token: string,
	guildId: string,
	body: Record<string, unknown>,
): Promise<SoundboardSoundResponse> {
	return createBuilder<SoundboardSoundResponse>(harness, token)
		.post(`/guilds/${guildId}/soundboard-sounds`)
		.body(body)
		.expect(HTTP_STATUS.CREATED)
		.execute();
}

async function expectFieldError(
	harness: ApiTestHarness,
	token: string,
	path: string,
	body: Record<string, unknown>,
	code: string,
): Promise<void> {
	const {response, text} = await createBuilder(harness, token).post(path).body(body).executeRaw();
	expect(response.status).toBe(HTTP_STATUS.BAD_REQUEST);
	expect(JSON.parse(text).code).toBe(APIErrorCodes.INVALID_FORM_BODY);
	expect(text).toContain(code);
}

describe('Guild soundboard', () => {
	let harness: ApiTestHarness;
	beforeEach(async () => {
		harness = await createApiTestHarness();
		stubAudioMetadata();
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});
	afterAll(async () => {
		await harness?.shutdown();
	});

	it('gives @everyone USE_SOUNDBOARD and not MANAGE_SOUNDS by default', () => {
		expect(DEFAULT_PERMISSIONS & Permissions.USE_SOUNDBOARD).toBe(Permissions.USE_SOUNDBOARD);
		expect(DEFAULT_PERMISSIONS & Permissions.MANAGE_SOUNDS).toBe(0n);
	});

	it('lets a sound manager upload, edit and delete sounds, and any member list them', async () => {
		const room = await createRoom(harness);
		const created = await upload(harness, room.owner.token, room.guild.id, {
			name: 'Airhorn',
			audio: wavBase64(1),
			emoji_name: '📯',
		});
		expect(created.name).toBe('Airhorn');
		expect(created.volume).toBe(100);
		expect(created.emoji_name).toBe('📯');
		expect(created.duration_ms).toBe(1000);
		expect(created.url).toContain(`/soundboard-sounds/${room.guild.id}/${created.hash}.wav`);

		const listed = await createBuilder<Array<SoundboardSoundResponse>>(harness, room.member.token)
			.get(`/guilds/${room.guild.id}/soundboard-sounds`)
			.expect(HTTP_STATUS.OK)
			.execute();
		expect(listed.map((sound) => sound.id)).toEqual([created.id]);

		const edited = await createBuilder<SoundboardSoundResponse>(harness, room.owner.token)
			.patch(`/guilds/${room.guild.id}/soundboard-sounds/${created.id}`)
			.body({name: 'Horn', volume: 40, emoji_id: '1234567890123456789'})
			.expect(HTTP_STATUS.OK)
			.execute();
		expect(edited).toMatchObject({name: 'Horn', volume: 40, emoji_id: '1234567890123456789', emoji_name: null});

		await createBuilder(harness, room.owner.token)
			.delete(`/guilds/${room.guild.id}/soundboard-sounds/${created.id}`)
			.expect(HTTP_STATUS.NO_CONTENT)
			.execute();
		const afterDelete = await createBuilder<Array<SoundboardSoundResponse>>(harness, room.member.token)
			.get(`/guilds/${room.guild.id}/soundboard-sounds`)
			.expect(HTTP_STATUS.OK)
			.execute();
		expect(afterDelete).toEqual([]);
	});

	it('requires MANAGE_SOUNDS to upload', async () => {
		const room = await createRoom(harness);
		await createBuilder(harness, room.member.token)
			.post(`/guilds/${room.guild.id}/soundboard-sounds`)
			.body({name: 'Nope', audio: wavBase64(1)})
			.expect(HTTP_STATUS.FORBIDDEN, APIErrorCodes.MISSING_PERMISSIONS)
			.execute();

		const role = await createRole(harness, room.owner.token, room.guild.id, {
			name: 'Sound managers',
			permissions: Permissions.MANAGE_SOUNDS.toString(),
		});
		await addMemberRole(harness, room.owner.token, room.guild.id, room.member.userId, role.id);
		await upload(harness, room.member.token, room.guild.id, {name: 'Allowed', audio: wavBase64(1)});
	});

	it('accepts sounds up to 120 seconds and rejects longer or larger ones', async () => {
		const room = await createRoom(harness);
		const long = await upload(harness, room.owner.token, room.guild.id, {name: 'Long', audio: wavBase64(110)});
		expect(long.duration_ms).toBe(110_000);

		await expectFieldError(
			harness,
			room.owner.token,
			`/guilds/${room.guild.id}/soundboard-sounds`,
			{name: 'Too long', audio: wavBase64(125)},
			ValidationErrorCodes.SOUNDBOARD_SOUND_DURATION_INVALID,
		);

		const tooLargeSeconds = Math.ceil(SOUNDBOARD_SOUND_MAX_BYTES / (SAMPLE_RATE * 2)) + 1;
		await createBuilder(harness, room.owner.token)
			.post(`/guilds/${room.guild.id}/soundboard-sounds`)
			.body({name: 'Too big', audio: wavBase64(tooLargeSeconds)})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	it('plays a sound to everyone in the voice channel, the sender included', async () => {
		const room = await createRoom(harness);
		const sound = await upload(harness, room.owner.token, room.guild.id, {name: 'Ding', audio: wavBase64(1)});
		const dispatch = vi.spyOn(getGatewayService(), 'dispatchPresence');

		await expectFieldError(
			harness,
			room.member.token,
			`/voice/channels/${room.voiceChannelId}/soundboard/play`,
			{guild_id: room.guild.id, sound_id: sound.id},
			ValidationErrorCodes.SOUNDBOARD_NOT_IN_VOICE_CHANNEL,
		);
		expect(dispatch).not.toHaveBeenCalled();

		joinVoice(room, [room.owner, room.member]);
		const {play_id} = await createBuilder<SoundboardPlayResponse>(harness, room.member.token)
			.post(`/voice/channels/${room.voiceChannelId}/soundboard/play`)
			.body({guild_id: room.guild.id, sound_id: sound.id})
			.expect(HTTP_STATUS.OK)
			.execute();
		expect(play_id).toMatch(/^\d+$/);

		const plays = dispatch.mock.calls.map(([params]) => params).filter((p) => p.event === 'SOUNDBOARD_SOUND_PLAY');
		expect(plays.map((p) => p.userId.toString()).sort()).toEqual([room.owner.userId, room.member.userId].sort());
		expect(plays[0]?.data).toMatchObject({
			play_id,
			user_id: room.member.userId,
			sound_id: sound.id,
			url: sound.url,
			volume: 100,
			duration_ms: 1000,
		});

		await createBuilder(harness, room.member.token)
			.post(`/voice/channels/${room.voiceChannelId}/soundboard/stop`)
			.body({play_id})
			.expect(HTTP_STATUS.NO_CONTENT)
			.execute();
		const stops = dispatch.mock.calls.map(([params]) => params).filter((p) => p.event === 'SOUNDBOARD_SOUND_STOP');
		expect(stops).toHaveLength(2);
		expect(stops[0]?.data).toMatchObject({play_id, user_id: room.member.userId});
	});

	it('refuses to play when USE_SOUNDBOARD is taken away from @everyone', async () => {
		const room = await createRoom(harness);
		const sound = await upload(harness, room.owner.token, room.guild.id, {name: 'Ding', audio: wavBase64(1)});
		joinVoice(room, [room.owner, room.member]);
		const everyone = (await getRoles(harness, room.owner.token, room.guild.id)).find(
			(role) => role.id === room.guild.id,
		);
		expect(everyone).toBeDefined();
		const without = BigInt(everyone!.permissions) & ~Permissions.USE_SOUNDBOARD;
		await updateRole(harness, room.owner.token, room.guild.id, everyone!.id, {permissions: without.toString()});

		await createBuilder(harness, room.member.token)
			.post(`/voice/channels/${room.voiceChannelId}/soundboard/play`)
			.body({guild_id: room.guild.id, sound_id: sound.id})
			.expect(HTTP_STATUS.FORBIDDEN, APIErrorCodes.MISSING_PERMISSIONS)
			.execute();
	});
});
