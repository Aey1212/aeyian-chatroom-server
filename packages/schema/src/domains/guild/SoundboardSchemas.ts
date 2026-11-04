// SPDX-License-Identifier: AGPL-3.0-or-later

import {ENTRANCE_SOUND_EXTENSIONS} from '@fluxer/constants/src/EntranceSoundConstants';
import {
	SOUNDBOARD_SOUND_MAX_BYTES,
	SOUNDBOARD_SOUND_MAX_DURATION_MS,
	SOUNDBOARD_SOUND_NAME_MAX_LENGTH,
	SOUNDBOARD_SOUND_VOLUME_MAX,
} from '@fluxer/constants/src/SoundboardConstants';
import {createBase64StringType} from '@fluxer/schema/src/primitives/FileValidators';
import {createStringType, SnowflakeStringType, SnowflakeType} from '@fluxer/schema/src/primitives/SchemaPrimitives';
import {z} from 'zod';

const SOUNDBOARD_SOUND_BASE64_MAX_CHARS = Math.ceil((SOUNDBOARD_SOUND_MAX_BYTES * 4) / 3) + 32;

const SoundboardVolume = z.number().int().min(0).max(SOUNDBOARD_SOUND_VOLUME_MAX);
const SoundboardEmojiName = z.string().min(1).max(64);

export const SoundboardSoundCreateRequest = z.object({
	name: createStringType(1, SOUNDBOARD_SOUND_NAME_MAX_LENGTH).describe('Display name of the sound'),
	audio: createBase64StringType(1, SOUNDBOARD_SOUND_BASE64_MAX_CHARS).describe('Base64-encoded audio bytes'),
	volume: SoundboardVolume.optional().describe('Playback volume in percent, 0-100 (default 100)'),
	emoji_id: SnowflakeType.nullish().describe('Custom emoji shown with the sound'),
	emoji_name: SoundboardEmojiName.nullish().describe('Unicode emoji shown with the sound'),
});

export type SoundboardSoundCreateRequest = z.infer<typeof SoundboardSoundCreateRequest>;

export const SoundboardSoundUpdateRequest = z.object({
	name: createStringType(1, SOUNDBOARD_SOUND_NAME_MAX_LENGTH).optional(),
	volume: SoundboardVolume.optional(),
	emoji_id: SnowflakeType.nullish(),
	emoji_name: SoundboardEmojiName.nullish(),
});

export type SoundboardSoundUpdateRequest = z.infer<typeof SoundboardSoundUpdateRequest>;

export const SoundboardSoundResponse = z.object({
	id: SnowflakeStringType,
	guild_id: SnowflakeStringType,
	name: z.string(),
	emoji_id: SnowflakeStringType.nullable(),
	emoji_name: z.string().nullable(),
	volume: SoundboardVolume,
	creator_id: SnowflakeStringType,
	hash: z.string(),
	extension: z.enum(ENTRANCE_SOUND_EXTENSIONS),
	content_type: z.string(),
	duration_ms: z.number().int().min(0).max(SOUNDBOARD_SOUND_MAX_DURATION_MS),
	size_bytes: z.number().int().min(0).max(SOUNDBOARD_SOUND_MAX_BYTES),
	url: z.url(),
	created_at: z.iso.datetime(),
});

export type SoundboardSoundResponse = z.infer<typeof SoundboardSoundResponse>;

export const SoundboardSoundListResponse = z.array(SoundboardSoundResponse);

export type SoundboardSoundListResponse = z.infer<typeof SoundboardSoundListResponse>;

export const SoundboardPlayRequest = z.object({
	guild_id: SnowflakeType.describe('Guild that owns the sound'),
	sound_id: SnowflakeType,
});

export type SoundboardPlayRequest = z.infer<typeof SoundboardPlayRequest>;

export const SoundboardPlayResponse = z.object({
	play_id: z.string(),
});

export type SoundboardPlayResponse = z.infer<typeof SoundboardPlayResponse>;

export const SoundboardStopRequest = z.object({
	play_id: z.string().min(1).max(64),
});

export type SoundboardStopRequest = z.infer<typeof SoundboardStopRequest>;

export const GuildIdSoundIdParam = z.object({
	guild_id: SnowflakeType,
	sound_id: SnowflakeType,
});

export type GuildIdSoundIdParam = z.infer<typeof GuildIdSoundIdParam>;
