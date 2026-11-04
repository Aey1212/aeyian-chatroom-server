// SPDX-License-Identifier: AGPL-3.0-or-later

import crypto from 'node:crypto';
import {createSoundboardSoundID, type GuildID, type SoundboardSoundID, type UserID} from '@app/api/BrandedTypes';
import {Config} from '@app/api/Config';
import type {SoundboardRepository} from '@app/api/guild/soundboard/SoundboardRepository';
import type {IGatewayService} from '@app/api/infrastructure/IGatewayService';
import type {IMediaService} from '@app/api/infrastructure/IMediaService';
import type {IStorageService} from '@app/api/infrastructure/IStorageService';
import {Logger} from '@app/api/Logger';
import {GuildSoundboardSound} from '@app/api/models/GuildSoundboardSound';
import {resolveEntranceSoundDurationMs} from '@app/api/user/entrance_sound/EntranceSoundDurationProbe';
import {requirePermission} from '@app/api/utils/PermissionUtils';
import {Permissions} from '@fluxer/constants/src/ChannelConstants';
import {
	ENTRANCE_SOUND_EXT_TO_MIME,
	type EntranceSoundExtension,
	entranceSoundExtensionFromFormat,
	entranceSoundExtensionFromMime,
} from '@fluxer/constants/src/EntranceSoundConstants';
import {
	SOUNDBOARD_SOUND_MAX_BYTES,
	SOUNDBOARD_SOUND_MAX_DURATION_MS,
	SOUNDBOARD_SOUND_MIN_DURATION_MS,
	SOUNDBOARD_SOUND_NAME_MAX_LENGTH,
	SOUNDBOARD_SOUND_PATH_PREFIX,
	SOUNDBOARD_SOUND_VOLUME_DEFAULT,
	SOUNDBOARD_SOUND_VOLUME_MAX,
} from '@fluxer/constants/src/SoundboardConstants';
import {ValidationErrorCodes} from '@fluxer/constants/src/ValidationErrorCodes';
import {InputValidationError} from '@fluxer/errors/src/domains/core/InputValidationError';
import {UnknownGuildError} from '@fluxer/errors/src/domains/guild/UnknownGuildError';
import {generateSnowflake} from '@fluxer/snowflake/src/Snowflake';

interface CreateSoundParams {
	userId: UserID;
	guildId: GuildID;
	name: string;
	base64Audio: string;
	volume?: number;
	emojiId?: bigint | null;
	emojiName?: string | null;
}

interface UpdateSoundParams {
	userId: UserID;
	guildId: GuildID;
	soundId: SoundboardSoundID;
	name?: string;
	volume?: number;
	emojiId?: bigint | null;
	emojiName?: string | null;
}

export interface SoundboardSoundEntry {
	sound: GuildSoundboardSound;
	url: string;
}

export function serializeSoundboardSound(entry: SoundboardSoundEntry) {
	const {sound, url} = entry;
	return {
		id: sound.soundId.toString(),
		guild_id: sound.guildId.toString(),
		name: sound.name,
		emoji_id: sound.emojiId != null ? sound.emojiId.toString() : null,
		emoji_name: sound.emojiName,
		volume: sound.volume,
		creator_id: sound.creatorId.toString(),
		hash: sound.hash,
		extension: sound.extension,
		content_type: sound.contentType,
		duration_ms: sound.durationMs,
		size_bytes: sound.sizeBytes,
		url,
		created_at: sound.createdAt.toISOString(),
	};
}

export class SoundboardService {
	constructor(
		private readonly repository: SoundboardRepository,
		private readonly storageService: IStorageService,
		private readonly mediaService: IMediaService,
		private readonly gatewayService: IGatewayService,
	) {}

	cdnUrlFor(sound: GuildSoundboardSound): string {
		return `${Config.endpoints.media}/${SOUNDBOARD_SOUND_PATH_PREFIX}/${sound.guildId}/${sound.hash}.${sound.extension}`;
	}

	private s3KeyFor(guildId: GuildID, hash: string, extension: string): string {
		return `${SOUNDBOARD_SOUND_PATH_PREFIX}/${guildId}/${hash}.${extension}`;
	}

	private entry(sound: GuildSoundboardSound): SoundboardSoundEntry {
		return {sound, url: this.cdnUrlFor(sound)};
	}

	private async requireMember(userId: UserID, guildId: GuildID): Promise<void> {
		if (!(await this.gatewayService.hasGuildMember({guildId, userId}))) {
			throw new UnknownGuildError();
		}
	}

	private async requireManageSounds(userId: UserID, guildId: GuildID): Promise<void> {
		await this.requireMember(userId, guildId);
		await requirePermission(this.gatewayService, {guildId, userId, permission: Permissions.MANAGE_SOUNDS});
	}

	async list(userId: UserID, guildId: GuildID): Promise<Array<SoundboardSoundEntry>> {
		await this.requireMember(userId, guildId);
		const sounds = await this.repository.listSounds(guildId);
		return sounds.map((sound) => this.entry(sound));
	}

	async getSoundEntry(guildId: GuildID, soundId: SoundboardSoundID): Promise<SoundboardSoundEntry | null> {
		const sound = await this.repository.getSound(guildId, soundId);
		return sound ? this.entry(sound) : null;
	}

	async create(params: CreateSoundParams): Promise<SoundboardSoundEntry> {
		const {userId, guildId, base64Audio} = params;
		const name = this.normalizeName(params.name);
		await this.requireManageSounds(userId, guildId);
		const trimmed = base64Audio.includes(',') ? (base64Audio.split(',')[1] ?? '') : base64Audio;
		let bytes: Buffer;
		try {
			bytes = Buffer.from(trimmed, 'base64');
		} catch {
			throw InputValidationError.fromCode('audio', ValidationErrorCodes.INVALID_BASE64_FORMAT);
		}
		if (bytes.length === 0) {
			throw InputValidationError.fromCode('audio', ValidationErrorCodes.INVALID_BASE64_FORMAT);
		}
		if (bytes.length > SOUNDBOARD_SOUND_MAX_BYTES) {
			throw InputValidationError.fromCode('audio', ValidationErrorCodes.SOUNDBOARD_SOUND_SIZE_EXCEEDS_LIMIT, {
				max_bytes: SOUNDBOARD_SOUND_MAX_BYTES,
			});
		}
		const metadata = await this.mediaService.getMetadata({
			type: 'base64',
			base64: trimmed,
			version: 2,
			nsfw: 'allow',
		});
		if (!metadata) {
			throw InputValidationError.fromCode('audio', ValidationErrorCodes.SOUNDBOARD_SOUND_INVALID_FORMAT);
		}
		const extension: EntranceSoundExtension | null =
			entranceSoundExtensionFromFormat(metadata.format) ?? entranceSoundExtensionFromMime(metadata.content_type);
		if (!extension) {
			throw InputValidationError.fromCode('audio', ValidationErrorCodes.SOUNDBOARD_SOUND_INVALID_FORMAT);
		}
		const durationMs = await resolveEntranceSoundDurationMs({
			bytes,
			extension,
			metadataDurationSeconds: typeof metadata.duration === 'number' ? metadata.duration : null,
		});
		if (
			durationMs == null ||
			durationMs > SOUNDBOARD_SOUND_MAX_DURATION_MS ||
			durationMs < SOUNDBOARD_SOUND_MIN_DURATION_MS
		) {
			throw InputValidationError.fromCode('audio', ValidationErrorCodes.SOUNDBOARD_SOUND_DURATION_INVALID, {
				min_ms: SOUNDBOARD_SOUND_MIN_DURATION_MS,
				max_ms: SOUNDBOARD_SOUND_MAX_DURATION_MS,
			});
		}
		const hash = crypto.createHash('md5').update(bytes).digest('hex').slice(0, 16);
		const contentType = ENTRANCE_SOUND_EXT_TO_MIME[extension];
		const s3Key = this.s3KeyFor(guildId, hash, extension);
		try {
			await this.storageService.uploadObject({
				bucket: Config.s3.buckets.cdn,
				key: s3Key,
				body: new Uint8Array(bytes),
				contentType,
			});
		} catch (error) {
			Logger.error({error, guildId: guildId.toString(), s3Key}, 'Failed to upload soundboard sound to S3');
			throw InputValidationError.fromCode('audio', ValidationErrorCodes.FAILED_TO_UPLOAD_IMAGE);
		}
		const sound = new GuildSoundboardSound({
			guild_id: guildId,
			sound_id: createSoundboardSoundID(generateSnowflake()),
			name,
			emoji_id: params.emojiId ?? null,
			emoji_name: params.emojiId != null ? null : (params.emojiName ?? null),
			volume: this.normalizeVolume(params.volume),
			creator_id: userId,
			hash,
			extension,
			content_type: contentType,
			duration_ms: durationMs,
			size_bytes: bytes.length,
			created_at: new Date(),
			version: 1,
		});
		try {
			await this.repository.upsertSound(sound);
		} catch (error) {
			Logger.error({error, guildId: guildId.toString(), s3Key}, 'Failed to persist soundboard sound; rolling back S3');
			if (!(await this.objectIsReferenced(guildId, hash, extension).catch(() => true))) {
				await this.storageService.deleteObject(Config.s3.buckets.cdn, s3Key).catch(() => {});
			}
			throw error;
		}
		await this.dispatchSoundsUpdate(guildId);
		return this.entry(sound);
	}

	async update(params: UpdateSoundParams): Promise<SoundboardSoundEntry> {
		const {userId, guildId, soundId} = params;
		await this.requireManageSounds(userId, guildId);
		const existing = await this.repository.getSound(guildId, soundId);
		if (!existing) {
			throw InputValidationError.fromCode('sound_id', ValidationErrorCodes.SOUNDBOARD_SOUND_NOT_FOUND);
		}
		const emojiChanged = params.emojiId !== undefined || params.emojiName !== undefined;
		const emojiId = emojiChanged ? (params.emojiId ?? null) : existing.emojiId;
		const emojiName = emojiChanged ? (emojiId != null ? null : (params.emojiName ?? null)) : existing.emojiName;
		const next = new GuildSoundboardSound({
			...existing.toRow(),
			name: params.name !== undefined ? this.normalizeName(params.name) : existing.name,
			volume: params.volume !== undefined ? this.normalizeVolume(params.volume) : existing.volume,
			emoji_id: emojiId,
			emoji_name: emojiName,
			version: existing.version + 1,
		});
		await this.repository.upsertSound(next);
		await this.dispatchSoundsUpdate(guildId);
		return this.entry(next);
	}

	async delete(userId: UserID, guildId: GuildID, soundId: SoundboardSoundID): Promise<void> {
		await this.requireManageSounds(userId, guildId);
		const existing = await this.repository.getSound(guildId, soundId);
		if (!existing) {
			throw InputValidationError.fromCode('sound_id', ValidationErrorCodes.SOUNDBOARD_SOUND_NOT_FOUND);
		}
		await this.repository.deleteSound(guildId, soundId);
		await this.dispatchSoundsUpdate(guildId);
		if (await this.objectIsReferenced(guildId, existing.hash, existing.extension).catch(() => true)) {
			return;
		}
		const s3Key = this.s3KeyFor(guildId, existing.hash, existing.extension);
		await this.storageService.deleteObject(Config.s3.buckets.cdn, s3Key).catch((error) => {
			Logger.error({error, guildId: guildId.toString(), s3Key}, 'Failed to delete soundboard sound from S3');
		});
	}

	private async objectIsReferenced(guildId: GuildID, hash: string, extension: string): Promise<boolean> {
		const sounds = await this.repository.listSounds(guildId);
		return sounds.some((sound) => sound.hash === hash && sound.extension === extension);
	}

	private async dispatchSoundsUpdate(guildId: GuildID): Promise<void> {
		const sounds = await this.repository.listSounds(guildId);
		await this.gatewayService
			.dispatchGuild({
				guildId,
				event: 'GUILD_SOUNDBOARD_SOUNDS_UPDATE',
				data: {
					guild_id: guildId.toString(),
					sounds: sounds.map((sound) => serializeSoundboardSound(this.entry(sound))),
				},
			})
			.catch((error) => {
				Logger.warn({error, guildId: guildId.toString()}, 'Failed to dispatch GUILD_SOUNDBOARD_SOUNDS_UPDATE');
			});
	}

	private normalizeName(rawName: string): string {
		const trimmed = rawName.trim();
		if (trimmed.length === 0 || trimmed.length > SOUNDBOARD_SOUND_NAME_MAX_LENGTH) {
			throw InputValidationError.fromCode('name', ValidationErrorCodes.SOUNDBOARD_SOUND_NAME_LENGTH_INVALID, {
				max: SOUNDBOARD_SOUND_NAME_MAX_LENGTH,
			});
		}
		return trimmed;
	}

	private normalizeVolume(volume: number | undefined): number {
		if (volume === undefined || !Number.isFinite(volume)) return SOUNDBOARD_SOUND_VOLUME_DEFAULT;
		return Math.max(0, Math.min(SOUNDBOARD_SOUND_VOLUME_MAX, Math.round(volume)));
	}
}
