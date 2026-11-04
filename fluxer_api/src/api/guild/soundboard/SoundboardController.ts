// SPDX-License-Identifier: AGPL-3.0-or-later

import {createChannelID, createGuildID, createSoundboardSoundID} from '@app/api/BrandedTypes';
import type {SoundboardPlayService} from '@app/api/guild/soundboard/SoundboardPlayService';
import {type SoundboardService, serializeSoundboardSound} from '@app/api/guild/soundboard/SoundboardService';
import {DefaultUserOnly, LoginRequired} from '@app/api/middleware/AuthMiddleware';
import {RateLimitMiddleware} from '@app/api/middleware/RateLimitMiddleware';
import {OpenAPI} from '@app/api/middleware/ResponseTypeMiddleware';
import {RateLimitConfigs} from '@app/api/RateLimitConfig';
import type {HonoApp} from '@app/api/types/HonoEnv';
import {Validator} from '@app/api/Validator';
import {ChannelIdParam, GuildIdParam} from '@fluxer/schema/src/domains/common/CommonParamSchemas';
import {
	GuildIdSoundIdParam,
	SoundboardPlayRequest,
	SoundboardPlayResponse,
	SoundboardSoundCreateRequest,
	SoundboardSoundListResponse,
	SoundboardSoundResponse,
	SoundboardSoundUpdateRequest,
	SoundboardStopRequest,
} from '@fluxer/schema/src/domains/guild/SoundboardSchemas';

export function SoundboardController(app: HonoApp) {
	app.get(
		'/guilds/:guild_id/soundboard-sounds',
		RateLimitMiddleware(RateLimitConfigs.GUILD_SOUNDBOARD_SOUNDS_LIST),
		LoginRequired,
		DefaultUserOnly,
		Validator('param', GuildIdParam),
		OpenAPI({
			operationId: 'list_guild_soundboard_sounds',
			summary: 'List guild soundboard sounds',
			description: 'Returns every soundboard sound the guild owns. Any member can list them.',
			responseSchema: SoundboardSoundListResponse,
			statusCode: 200,
			security: ['bearerToken', 'sessionToken'],
			tags: ['Guilds'],
		}),
		async (ctx) => {
			const service: SoundboardService = ctx.get('soundboardService');
			const guildId = createGuildID(ctx.req.valid('param').guild_id);
			const sounds = await service.list(ctx.get('user').id, guildId);
			return ctx.json(sounds.map(serializeSoundboardSound), 200);
		},
	);
	app.post(
		'/guilds/:guild_id/soundboard-sounds',
		RateLimitMiddleware(RateLimitConfigs.GUILD_SOUNDBOARD_SOUND_CREATE),
		LoginRequired,
		DefaultUserOnly,
		Validator('param', GuildIdParam),
		Validator('json', SoundboardSoundCreateRequest),
		OpenAPI({
			operationId: 'create_guild_soundboard_sound',
			summary: 'Upload a guild soundboard sound',
			description:
				'Uploads an audio clip (MP3, OGG, M4A or WAV, up to 120 seconds and 3 MB) to the guild soundboard. Requires MANAGE_SOUNDS.',
			requestSchema: SoundboardSoundCreateRequest,
			responseSchema: SoundboardSoundResponse,
			statusCode: 201,
			security: ['bearerToken', 'sessionToken'],
			tags: ['Guilds'],
		}),
		async (ctx) => {
			const service: SoundboardService = ctx.get('soundboardService');
			const guildId = createGuildID(ctx.req.valid('param').guild_id);
			const {name, audio, volume, emoji_id, emoji_name} = ctx.req.valid('json');
			const created = await service.create({
				userId: ctx.get('user').id,
				guildId,
				name,
				base64Audio: audio,
				volume,
				emojiId: emoji_id ?? null,
				emojiName: emoji_name ?? null,
			});
			return ctx.json(serializeSoundboardSound(created), 201);
		},
	);
	app.patch(
		'/guilds/:guild_id/soundboard-sounds/:sound_id',
		RateLimitMiddleware(RateLimitConfigs.GUILD_SOUNDBOARD_SOUND_UPDATE),
		LoginRequired,
		DefaultUserOnly,
		Validator('param', GuildIdSoundIdParam),
		Validator('json', SoundboardSoundUpdateRequest),
		OpenAPI({
			operationId: 'update_guild_soundboard_sound',
			summary: 'Edit a guild soundboard sound',
			description: 'Changes the name, emoji or volume of a soundboard sound. Requires MANAGE_SOUNDS.',
			requestSchema: SoundboardSoundUpdateRequest,
			responseSchema: SoundboardSoundResponse,
			statusCode: 200,
			security: ['bearerToken', 'sessionToken'],
			tags: ['Guilds'],
		}),
		async (ctx) => {
			const service: SoundboardService = ctx.get('soundboardService');
			const param = ctx.req.valid('param');
			const {name, volume, emoji_id, emoji_name} = ctx.req.valid('json');
			const updated = await service.update({
				userId: ctx.get('user').id,
				guildId: createGuildID(param.guild_id),
				soundId: createSoundboardSoundID(param.sound_id),
				name,
				volume,
				emojiId: emoji_id,
				emojiName: emoji_name,
			});
			return ctx.json(serializeSoundboardSound(updated), 200);
		},
	);
	app.delete(
		'/guilds/:guild_id/soundboard-sounds/:sound_id',
		RateLimitMiddleware(RateLimitConfigs.GUILD_SOUNDBOARD_SOUND_UPDATE),
		LoginRequired,
		DefaultUserOnly,
		Validator('param', GuildIdSoundIdParam),
		OpenAPI({
			operationId: 'delete_guild_soundboard_sound',
			summary: 'Delete a guild soundboard sound',
			description: 'Removes the sound from the guild soundboard. Requires MANAGE_SOUNDS.',
			responseSchema: null,
			statusCode: 204,
			security: ['bearerToken', 'sessionToken'],
			tags: ['Guilds'],
		}),
		async (ctx) => {
			const service: SoundboardService = ctx.get('soundboardService');
			const param = ctx.req.valid('param');
			await service.delete(ctx.get('user').id, createGuildID(param.guild_id), createSoundboardSoundID(param.sound_id));
			return ctx.body(null, 204);
		},
	);
	app.post(
		'/voice/channels/:channel_id/soundboard/play',
		RateLimitMiddleware(RateLimitConfigs.VOICE_SOUNDBOARD_PLAY),
		LoginRequired,
		DefaultUserOnly,
		Validator('param', ChannelIdParam),
		Validator('json', SoundboardPlayRequest),
		OpenAPI({
			operationId: 'play_soundboard_sound',
			summary: 'Play a soundboard sound in a voice channel',
			description:
				'Sends a SOUNDBOARD_SOUND_PLAY gateway event to everyone in the voice channel, the sender included. Each client fetches the audio and plays it locally. Requires USE_SOUNDBOARD and being in the channel. One play per second per user.',
			requestSchema: SoundboardPlayRequest,
			responseSchema: SoundboardPlayResponse,
			statusCode: 200,
			security: ['bearerToken', 'sessionToken'],
			tags: ['Voice'],
		}),
		async (ctx) => {
			const service: SoundboardPlayService = ctx.get('soundboardPlayService');
			const {guild_id, sound_id} = ctx.req.valid('json');
			const {playId} = await service.play({
				userId: ctx.get('user').id,
				channelId: createChannelID(ctx.req.valid('param').channel_id),
				guildId: createGuildID(guild_id),
				soundId: createSoundboardSoundID(sound_id),
			});
			return ctx.json({play_id: playId}, 200);
		},
	);
	app.post(
		'/voice/channels/:channel_id/soundboard/stop',
		RateLimitMiddleware(RateLimitConfigs.VOICE_SOUNDBOARD_STOP),
		LoginRequired,
		DefaultUserOnly,
		Validator('param', ChannelIdParam),
		Validator('json', SoundboardStopRequest),
		OpenAPI({
			operationId: 'stop_soundboard_sound',
			summary: 'Stop a soundboard sound you played',
			description:
				'Sends a SOUNDBOARD_SOUND_STOP gateway event to everyone in the voice channel. Clients stop the play only if it was started by the same user.',
			requestSchema: SoundboardStopRequest,
			responseSchema: null,
			statusCode: 204,
			security: ['bearerToken', 'sessionToken'],
			tags: ['Voice'],
		}),
		async (ctx) => {
			const service: SoundboardPlayService = ctx.get('soundboardPlayService');
			await service.stop({
				userId: ctx.get('user').id,
				channelId: createChannelID(ctx.req.valid('param').channel_id),
				playId: ctx.req.valid('json').play_id,
			});
			return ctx.body(null, 204);
		},
	);
}
