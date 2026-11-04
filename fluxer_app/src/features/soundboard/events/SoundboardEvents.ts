// SPDX-License-Identifier: AGPL-3.0-or-later

import type {GatewayHandlerContext} from '@app/features/gateway/events/EventRouter';
import SoundboardPlaybackEngine from '@app/features/soundboard/engine/SoundboardPlaybackEngine';
import GuildSoundboardSounds, {type ApiSoundboardSound} from '@app/features/soundboard/state/GuildSoundboardSounds';
import MediaEngine from '@app/features/voice/engine/MediaEngineFacade';
import {reaction} from 'mobx';

interface GuildSoundboardSoundsUpdatePayload {
	guild_id: string;
	sounds: Array<ApiSoundboardSound>;
}

interface SoundboardSoundPlayPayload {
	play_id: string;
	user_id: string;
	channel_id: string;
	guild_id: string;
	sound_id: string;
	name: string;
	emoji_id: string | null;
	emoji_name: string | null;
	volume: number;
	hash: string;
	url: string;
	duration_ms: number;
}

interface SoundboardSoundStopPayload {
	play_id: string;
	user_id: string;
	channel_id: string;
}

let stopOnLeaveInstalled = false;

function installStopOnLeave(): void {
	if (stopOnLeaveInstalled) return;
	stopOnLeaveInstalled = true;
	reaction(
		() => (MediaEngine.connected ? MediaEngine.channelId : null),
		() => SoundboardPlaybackEngine.stopAll(),
	);
}

export function handleGuildSoundboardSoundsUpdate(
	data: GuildSoundboardSoundsUpdatePayload,
	_context: GatewayHandlerContext,
): void {
	GuildSoundboardSounds.setSounds(data.guild_id, data.sounds);
}

export function handleSoundboardSoundPlay(data: SoundboardSoundPlayPayload, _context: GatewayHandlerContext): void {
	installStopOnLeave();
	if (!MediaEngine.connected || MediaEngine.channelId !== data.channel_id) return;
	void SoundboardPlaybackEngine.play({
		playId: data.play_id,
		userId: data.user_id,
		channelId: data.channel_id,
		guildId: data.guild_id,
		soundId: data.sound_id,
		name: data.name,
		emojiId: data.emoji_id,
		emojiName: data.emoji_name,
		durationMs: data.duration_ms,
		hash: data.hash,
		url: data.url,
		volume: data.volume,
	});
}

export function handleSoundboardSoundStop(data: SoundboardSoundStopPayload, _context: GatewayHandlerContext): void {
	SoundboardPlaybackEngine.stopFromUser(data.play_id, data.user_id);
}
