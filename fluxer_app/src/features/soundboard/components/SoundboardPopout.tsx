// SPDX-License-Identifier: AGPL-3.0-or-later

import Permission from '@app/features/permissions/state/Permission';
import {HttpError} from '@app/features/platform/types/EndpointError';
import {Logger} from '@app/features/platform/utils/AppLogger';
import styles from '@app/features/soundboard/components/Soundboard.module.css';
import {SoundboardSoundEmoji} from '@app/features/soundboard/components/SoundboardSoundEmoji';
import SoundboardPlaybackEngine, {type SoundboardPlay} from '@app/features/soundboard/engine/SoundboardPlaybackEngine';
import GuildSoundboardSounds, {type SoundboardSound} from '@app/features/soundboard/state/GuildSoundboardSounds';
import * as ToastCommands from '@app/features/ui/commands/ToastCommands';
import {Input} from '@app/features/ui/components/form/FormInput';
import {Spinner} from '@app/features/ui/components/Spinner';
import Users from '@app/features/user/state/Users';
import {Permissions} from '@fluxer/constants/src/ChannelConstants';
import {msg} from '@lingui/core/macro';
import {Trans, useLingui} from '@lingui/react/macro';
import {MagnifyingGlassIcon, StopIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {matchSorter} from 'match-sorter';
import {observer} from 'mobx-react-lite';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

const logger = new Logger('SoundboardPopout');

const PREVIEW_HOVER_DELAY_MS = 350;

const SEARCH_SOUNDS_DESCRIPTOR = msg({
	message: 'Search sounds',
	comment: 'Placeholder of the search box in the voice channel soundboard.',
});
const SOUNDBOARD_COOLDOWN_DESCRIPTOR = msg({
	message: 'You can play one sound per second.',
	comment: 'Toast shown when the user plays soundboard sounds faster than the cooldown allows.',
});
const SOUNDBOARD_PLAY_FAILED_DESCRIPTOR = msg({
	message: 'Could not play that sound.',
	comment: 'Toast shown when playing a soundboard sound fails.',
});
const STOP_FOR_EVERYONE_DESCRIPTOR = msg({
	message: 'Stop for everyone',
	comment: 'Button on a soundboard sound the current user is playing. Stops it for everyone in the voice channel.',
});
const STOP_FOR_ME_DESCRIPTOR = msg({
	message: 'Stop for me',
	comment: 'Button on a soundboard sound someone else is playing. Stops it only for the current user.',
});

function formatDuration(durationMs: number): string {
	const totalSeconds = Math.max(1, Math.round(durationMs / 1000));
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return minutes > 0 ? `${minutes}:${seconds.toString().padStart(2, '0')}` : `${seconds}s`;
}

const NowPlayingRow = observer(function NowPlayingRow({play}: {play: SoundboardPlay}) {
	const {i18n} = useLingui();
	const isMine = play.userId === Users.currentUserId;
	const player = Users.getUser(play.userId);
	const stop = useCallback(() => {
		SoundboardPlaybackEngine.stopLocal(play.playId);
		if (!isMine) return;
		void GuildSoundboardSounds.stop(play.channelId, play.playId).catch((error) => {
			logger.warn('Failed to stop soundboard sound for everyone', {error});
		});
	}, [isMine, play.channelId, play.playId]);
	return (
		<div className={styles.nowPlayingRow} data-flx="soundboard.popout.now-playing-row">
			<SoundboardSoundEmoji emojiId={play.emojiId} emojiName={play.emojiName} />
			<div className={styles.nowPlayingText} data-flx="soundboard.popout.now-playing-text">
				<span className={styles.nowPlayingName} data-flx="soundboard.popout.now-playing-name">
					{play.name}
				</span>
				<span className={styles.nowPlayingBy} data-flx="soundboard.popout.now-playing-by">
					{player?.displayName ?? ''}
				</span>
			</div>
			<button type="button" className={styles.stopButton} onClick={stop} data-flx="soundboard.popout.stop-button">
				<StopIcon weight="fill" className={styles.stopIcon} data-flx="soundboard.popout.stop-icon" />
				<span data-flx="soundboard.popout.stop-label">
					{isMine ? i18n._(STOP_FOR_EVERYONE_DESCRIPTOR) : i18n._(STOP_FOR_ME_DESCRIPTOR)}
				</span>
			</button>
		</div>
	);
});

export const SoundboardPopout = observer(function SoundboardPopout({
	guildId,
	channelId,
}: {
	guildId: string;
	channelId: string;
	onClose?: () => void;
}) {
	const {i18n} = useLingui();
	const [query, setQuery] = useState('');
	const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const canUse = Permission.can(Permissions.USE_SOUNDBOARD, {guildId, channelId});
	const sounds = GuildSoundboardSounds.getSounds(guildId);
	const loaded = GuildSoundboardSounds.hasLoaded(guildId);
	const failed = GuildSoundboardSounds.failed[guildId] === true;
	const plays = SoundboardPlaybackEngine.plays.filter((play) => play.channelId === channelId);

	useEffect(() => {
		void GuildSoundboardSounds.load(guildId);
	}, [guildId]);

	const cancelPreview = useCallback(() => {
		if (previewTimer.current) clearTimeout(previewTimer.current);
		previewTimer.current = null;
		SoundboardPlaybackEngine.stopPreview();
	}, []);

	useEffect(() => cancelPreview, [cancelPreview]);

	const schedulePreview = useCallback(
		(sound: SoundboardSound) => {
			cancelPreview();
			previewTimer.current = setTimeout(() => {
				previewTimer.current = null;
				void SoundboardPlaybackEngine.preview(sound);
			}, PREVIEW_HOVER_DELAY_MS);
		},
		[cancelPreview],
	);

	const play = useCallback(
		async (sound: SoundboardSound) => {
			cancelPreview();
			try {
				await GuildSoundboardSounds.play(channelId, guildId, sound.id);
			} catch (error) {
				if (error instanceof HttpError && error.status === 429) {
					ToastCommands.error(i18n._(SOUNDBOARD_COOLDOWN_DESCRIPTOR));
					return;
				}
				logger.warn('Failed to play soundboard sound', {error});
				ToastCommands.error(i18n._(SOUNDBOARD_PLAY_FAILED_DESCRIPTOR));
			}
		},
		[cancelPreview, channelId, guildId, i18n],
	);

	const visible = useMemo(
		() => (query.trim() ? matchSorter([...sounds], query.trim(), {keys: ['name', 'emojiName']}) : sounds),
		[query, sounds],
	);

	return (
		<div className={styles.popout} data-flx="soundboard.popout">
			<div className={styles.popoutHeader} data-flx="soundboard.popout.header">
				<span className={styles.popoutTitle} data-flx="soundboard.popout.title">
					<Trans>Soundboard</Trans>
				</span>
				<Input
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					placeholder={i18n._(SEARCH_SOUNDS_DESCRIPTOR)}
					aria-label={i18n._(SEARCH_SOUNDS_DESCRIPTOR)}
					leftIcon={<MagnifyingGlassIcon size={16} weight="bold" data-flx="soundboard.popout.search-icon" />}
					data-flx="soundboard.popout.search"
				/>
			</div>
			{plays.length > 0 && (
				<div className={styles.nowPlaying} data-flx="soundboard.popout.now-playing">
					{plays.map((entry) => (
						<NowPlayingRow key={entry.playId} play={entry} data-flx="soundboard.popout.now-playing-entry" />
					))}
				</div>
			)}
			{!canUse && (
				<p className={styles.notice} data-flx="soundboard.popout.no-permission">
					<Trans>You don't have permission to use the soundboard in this channel.</Trans>
				</p>
			)}
			<div className={styles.gridScroller} data-flx="soundboard.popout.scroller">
				{!loaded && !failed ? (
					<div className={styles.centered} data-flx="soundboard.popout.loading">
						<Spinner data-flx="soundboard.popout.spinner" />
					</div>
				) : failed && !loaded ? (
					<p className={styles.notice} data-flx="soundboard.popout.failed">
						<Trans>Could not load this community's sounds.</Trans>
					</p>
				) : sounds.length === 0 ? (
					<p className={styles.notice} data-flx="soundboard.popout.empty">
						<Trans>This community has no sounds yet. Add some in Community Settings under Soundboard.</Trans>
					</p>
				) : visible.length === 0 ? (
					<p className={styles.notice} data-flx="soundboard.popout.no-results">
						<Trans>No sounds match your search.</Trans>
					</p>
				) : (
					<div className={styles.grid} data-flx="soundboard.popout.grid">
						{visible.map((sound) => (
							<button
								key={sound.id}
								type="button"
								className={clsx(
									styles.tile,
									SoundboardPlaybackEngine.isSoundPlaying(sound.id) && styles.tilePlaying,
									SoundboardPlaybackEngine.previewSoundId === sound.id && styles.tilePreviewing,
								)}
								disabled={!canUse}
								onClick={() => void play(sound)}
								onMouseEnter={() => schedulePreview(sound)}
								onMouseLeave={cancelPreview}
								title={`${sound.name} (${formatDuration(sound.durationMs)})`}
								data-flx="soundboard.popout.tile"
							>
								<SoundboardSoundEmoji emojiId={sound.emojiId} emojiName={sound.emojiName} />
								<span className={styles.tileName} data-flx="soundboard.popout.tile-name">
									{sound.name}
								</span>
								<span className={styles.tileDuration} data-flx="soundboard.popout.tile-duration">
									{formatDuration(sound.durationMs)}
								</span>
							</button>
						))}
					</div>
				)}
			</div>
		</div>
	);
});
