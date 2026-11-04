// SPDX-License-Identifier: AGPL-3.0-or-later

import {type ChannelID, createUserID, type GuildID, type SoundboardSoundID, type UserID} from '@app/api/BrandedTypes';
import type {IChannelRepository} from '@app/api/channel/IChannelRepository';
import type {GatewayDispatchEvent} from '@app/api/constants/Gateway';
import type {SoundboardService} from '@app/api/guild/soundboard/SoundboardService';
import type {IGatewayService} from '@app/api/infrastructure/IGatewayService';
import {Logger} from '@app/api/Logger';
import {requirePermission} from '@app/api/utils/PermissionUtils';
import {Permissions} from '@fluxer/constants/src/ChannelConstants';
import {ValidationErrorCodes} from '@fluxer/constants/src/ValidationErrorCodes';
import {InputValidationError} from '@fluxer/errors/src/domains/core/InputValidationError';
import {generateSnowflake} from '@fluxer/snowflake/src/Snowflake';

interface PlaySoundParams {
	userId: UserID;
	channelId: ChannelID;
	guildId: GuildID;
	soundId: SoundboardSoundID;
}

interface StopSoundParams {
	userId: UserID;
	channelId: ChannelID;
	playId: string;
}

export class SoundboardPlayService {
	constructor(
		private readonly soundboardService: SoundboardService,
		private readonly gatewayService: IGatewayService,
		private readonly channelRepository: IChannelRepository,
	) {}

	private async voiceRecipients(channelId: ChannelID): Promise<{guildId: GuildID; recipients: Array<string>} | null> {
		const channel = await this.channelRepository.findUnique(channelId);
		if (!channel?.guildId) return null;
		const {voiceStates} = await this.gatewayService.getVoiceStatesForChannel({guildId: channel.guildId, channelId});
		return {guildId: channel.guildId, recipients: [...new Set(voiceStates.map((state) => state.userId))]};
	}

	async play(params: PlaySoundParams): Promise<{playId: string}> {
		const {userId, channelId, guildId, soundId} = params;
		const room = await this.voiceRecipients(channelId);
		if (!room || room.guildId !== guildId || !room.recipients.includes(userId.toString())) {
			throw InputValidationError.fromCode('channel_id', ValidationErrorCodes.SOUNDBOARD_NOT_IN_VOICE_CHANNEL);
		}
		await requirePermission(this.gatewayService, {
			guildId,
			userId,
			channelId,
			permission: Permissions.USE_SOUNDBOARD,
		});
		const entry = await this.soundboardService.getSoundEntry(guildId, soundId);
		if (!entry) {
			throw InputValidationError.fromCode('sound_id', ValidationErrorCodes.SOUNDBOARD_SOUND_NOT_FOUND);
		}
		const playId = generateSnowflake().toString();
		const {sound, url} = entry;
		await this.fanOut(room.recipients, 'SOUNDBOARD_SOUND_PLAY', {
			play_id: playId,
			user_id: userId.toString(),
			channel_id: channelId.toString(),
			guild_id: guildId.toString(),
			sound_id: sound.soundId.toString(),
			name: sound.name,
			emoji_id: sound.emojiId != null ? sound.emojiId.toString() : null,
			emoji_name: sound.emojiName,
			volume: sound.volume,
			hash: sound.hash,
			url,
			duration_ms: sound.durationMs,
			content_type: sound.contentType,
		});
		return {playId};
	}

	async stop(params: StopSoundParams): Promise<void> {
		const {userId, channelId, playId} = params;
		const room = await this.voiceRecipients(channelId);
		if (!room) {
			throw InputValidationError.fromCode('channel_id', ValidationErrorCodes.SOUNDBOARD_NOT_IN_VOICE_CHANNEL);
		}
		await this.fanOut(room.recipients, 'SOUNDBOARD_SOUND_STOP', {
			play_id: playId,
			user_id: userId.toString(),
			channel_id: channelId.toString(),
		});
	}

	private async fanOut(recipients: Array<string>, event: GatewayDispatchEvent, data: unknown): Promise<void> {
		await Promise.all(
			recipients.map(async (recipient) => {
				try {
					await this.gatewayService.dispatchPresence({userId: createUserID(BigInt(recipient)), event, data});
				} catch (error) {
					Logger.warn({error, recipient, event}, 'Failed to dispatch soundboard event');
				}
			}),
		);
	}
}
