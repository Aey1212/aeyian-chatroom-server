// SPDX-License-Identifier: AGPL-3.0-or-later

import {ConfirmModal} from '@app/features/app/components/dialogs/ConfirmModal';
import {openFilePicker} from '@app/features/messaging/utils/FilePickerUtils';
import {formatFileSize} from '@app/features/messaging/utils/FileUtils';
import {
	ENTRANCE_SOUND_FILE_PICKER_ACCEPT,
	isValidEntranceSoundFile,
} from '@app/features/notification/utils/EntranceSoundClientValidators';
import Permission from '@app/features/permissions/state/Permission';
import {Logger} from '@app/features/platform/utils/AppLogger';
import styles from '@app/features/soundboard/components/SoundboardSettings.module.css';
import {SoundboardSoundEmoji} from '@app/features/soundboard/components/SoundboardSoundEmoji';
import {openSoundboardSoundModal} from '@app/features/soundboard/components/SoundboardSoundModal';
import SoundboardPlaybackEngine from '@app/features/soundboard/engine/SoundboardPlaybackEngine';
import GuildSoundboardSounds, {type SoundboardSound} from '@app/features/soundboard/state/GuildSoundboardSounds';
import {Button} from '@app/features/ui/button/Button';
import * as ModalCommands from '@app/features/ui/commands/ModalCommands';
import {Input} from '@app/features/ui/components/form/FormInput';
import {Spinner} from '@app/features/ui/components/Spinner';
import {Tooltip} from '@app/features/ui/tooltip/Tooltip';
import {openEntranceSoundTrimmerModal} from '@app/features/voice/components/EntranceSoundTrimmerModal';
import {Permissions} from '@fluxer/constants/src/ChannelConstants';
import {SOUNDBOARD_SOUND_MAX_BYTES, SOUNDBOARD_SOUND_MAX_DURATION_MS} from '@fluxer/constants/src/SoundboardConstants';
import {msg} from '@lingui/core/macro';
import {Trans, useLingui} from '@lingui/react/macro';
import {MagnifyingGlassIcon, PencilSimpleIcon, PlayIcon, StopIcon, TrashIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {matchSorter} from 'match-sorter';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useEffect, useMemo, useState} from 'react';

const logger = new Logger('GuildSoundboardTab');

const SOUNDBOARD_HINT_DESCRIPTOR = msg({
	message:
		'Members in a voice channel can play these sounds for everyone there. Each sound can be up to {seconds} seconds and {size}.',
	comment: 'Intro text of the community soundboard settings. {seconds} is the maximum length, {size} a file size.',
});
const SEARCH_SOUNDS_DESCRIPTOR = msg({
	message: 'Search sounds',
	comment: 'Placeholder of the search box in the community soundboard settings.',
});
const TRIM_SOUND_DESCRIPTOR = msg({
	message: 'Trim sound',
	comment: 'Title of the audio trimmer when uploading a soundboard sound.',
});
const INVALID_SOUND_FILE_DESCRIPTOR = msg({
	message: 'Unsupported sound file',
	comment: 'Title of the error shown when the picked soundboard file is too large or not audio.',
});
const INVALID_SOUND_FILE_BODY_DESCRIPTOR = msg({
	message: 'Pick an MP3, OGG, M4A or WAV file of up to {limit}.',
	comment: 'Body of the error shown when the picked soundboard file is too large or not audio. {limit} is a file size.',
});
const DELETE_SOUND_TITLE_DESCRIPTOR = msg({
	message: 'Delete sound',
	comment: 'Title of the confirmation dialog for deleting a soundboard sound.',
});
const DELETE_SOUND_BODY_DESCRIPTOR = msg({
	message: 'Delete {name}? Nobody will be able to play it any more.',
	comment: 'Body of the confirmation dialog for deleting a soundboard sound. {name} is the sound name.',
});
const DELETE_DESCRIPTOR = msg({
	message: 'Delete',
	comment: 'Confirm button that deletes a soundboard sound.',
});
const OKAY_DESCRIPTOR = msg({
	message: 'Okay',
	comment: 'Button that closes an error dialog in the community soundboard settings.',
});
const PREVIEW_DESCRIPTOR = msg({
	message: 'Preview',
	comment: 'Tooltip of the button that plays a soundboard sound only for yourself.',
});
const EDIT_DESCRIPTOR = msg({
	message: 'Edit',
	comment: 'Tooltip of the button that edits a soundboard sound.',
});
const DELETE_TOOLTIP_DESCRIPTOR = msg({
	message: 'Delete',
	comment: 'Tooltip of the button that deletes a soundboard sound.',
});

function formatDuration(durationMs: number): string {
	const totalSeconds = Math.max(1, Math.round(durationMs / 1000));
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function nameFromFile(file: File): string {
	const dot = file.name.lastIndexOf('.');
	return (dot > 0 ? file.name.slice(0, dot) : file.name).trim();
}

const SoundRow = observer(function SoundRow({
	sound,
	canManage,
	onDelete,
}: {
	sound: SoundboardSound;
	canManage: boolean;
	onDelete: (sound: SoundboardSound) => void;
}) {
	const {i18n} = useLingui();
	const previewing = SoundboardPlaybackEngine.previewSoundId === sound.id;
	const togglePreview = useCallback(() => {
		if (previewing) {
			SoundboardPlaybackEngine.stopPreview();
			return;
		}
		void SoundboardPlaybackEngine.preview(sound);
	}, [previewing, sound]);
	return (
		<div className={styles.row} data-flx="guild.guild-tabs.soundboard-tab.row">
			<SoundboardSoundEmoji emojiId={sound.emojiId} emojiName={sound.emojiName} />
			<span className={styles.rowName} data-flx="guild.guild-tabs.soundboard-tab.row-name">
				{sound.name}
			</span>
			<span className={styles.rowMeta} data-flx="guild.guild-tabs.soundboard-tab.row-meta">
				{formatDuration(sound.durationMs)} · {sound.volume}%
			</span>
			<div className={styles.rowActions} data-flx="guild.guild-tabs.soundboard-tab.row-actions">
				<Tooltip text={i18n._(PREVIEW_DESCRIPTOR)} data-flx="guild.guild-tabs.soundboard-tab.preview-tooltip">
					<button
						type="button"
						className={styles.iconButton}
						onClick={togglePreview}
						aria-label={i18n._(PREVIEW_DESCRIPTOR)}
						data-flx="guild.guild-tabs.soundboard-tab.preview"
					>
						{previewing ? (
							<StopIcon size={16} weight="fill" data-flx="guild.guild-tabs.soundboard-tab.preview-stop" />
						) : (
							<PlayIcon size={16} weight="fill" data-flx="guild.guild-tabs.soundboard-tab.preview-play" />
						)}
					</button>
				</Tooltip>
				{canManage && (
					<>
						<Tooltip text={i18n._(EDIT_DESCRIPTOR)} data-flx="guild.guild-tabs.soundboard-tab.edit-tooltip">
							<button
								type="button"
								className={styles.iconButton}
								onClick={() => openSoundboardSoundModal({mode: 'edit', guildId: sound.guildId, sound})}
								aria-label={i18n._(EDIT_DESCRIPTOR)}
								data-flx="guild.guild-tabs.soundboard-tab.edit"
							>
								<PencilSimpleIcon size={16} weight="bold" data-flx="guild.guild-tabs.soundboard-tab.edit-icon" />
							</button>
						</Tooltip>
						<Tooltip text={i18n._(DELETE_TOOLTIP_DESCRIPTOR)} data-flx="guild.guild-tabs.soundboard-tab.delete-tooltip">
							<button
								type="button"
								className={clsx(styles.iconButton, styles.iconButtonDanger)}
								onClick={() => onDelete(sound)}
								aria-label={i18n._(DELETE_TOOLTIP_DESCRIPTOR)}
								data-flx="guild.guild-tabs.soundboard-tab.delete"
							>
								<TrashIcon size={16} weight="bold" data-flx="guild.guild-tabs.soundboard-tab.delete-icon" />
							</button>
						</Tooltip>
					</>
				)}
			</div>
		</div>
	);
});

const GuildSoundboardTab: React.FC<{guildId: string}> = observer(function GuildSoundboardTab({guildId}) {
	const {i18n} = useLingui();
	const [query, setQuery] = useState('');
	const canManage = Permission.can(Permissions.MANAGE_SOUNDS, {guildId});
	const sounds = GuildSoundboardSounds.getSounds(guildId);
	const loaded = GuildSoundboardSounds.hasLoaded(guildId);
	const failed = GuildSoundboardSounds.failed[guildId] === true;

	useEffect(() => {
		void GuildSoundboardSounds.load(guildId, true);
		return () => SoundboardPlaybackEngine.stopPreview();
	}, [guildId]);

	const visible = useMemo(
		() => (query.trim() ? matchSorter([...sounds], query.trim(), {keys: ['name', 'emojiName']}) : sounds),
		[query, sounds],
	);

	const showInvalidFile = useCallback(() => {
		ModalCommands.push(
			ModalCommands.modal(() => (
				<ConfirmModal
					title={i18n._(INVALID_SOUND_FILE_DESCRIPTOR)}
					description={i18n._(INVALID_SOUND_FILE_BODY_DESCRIPTOR, {
						limit: formatFileSize(i18n.locale, SOUNDBOARD_SOUND_MAX_BYTES),
					})}
					primaryText={i18n._(OKAY_DESCRIPTOR)}
					primaryVariant="primary"
					onPrimary={() => {}}
					data-flx="guild.guild-tabs.soundboard-tab.invalid-file"
				/>
			)),
		);
	}, [i18n]);

	const upload = useCallback(async () => {
		const [file] = await openFilePicker({accept: ENTRANCE_SOUND_FILE_PICKER_ACCEPT});
		if (!file) return;
		if (!isValidEntranceSoundFile(file).valid) {
			showInvalidFile();
			return;
		}
		openEntranceSoundTrimmerModal({
			sourceFile: file,
			title: TRIM_SOUND_DESCRIPTOR,
			onConfirm: (trimmed) => {
				openSoundboardSoundModal({mode: 'create', guildId, audio: trimmed.blob, defaultName: nameFromFile(file)});
			},
		});
	}, [guildId, showInvalidFile]);

	const confirmDelete = useCallback(
		(sound: SoundboardSound) => {
			ModalCommands.push(
				ModalCommands.modal(() => (
					<ConfirmModal
						title={i18n._(DELETE_SOUND_TITLE_DESCRIPTOR)}
						description={i18n._(DELETE_SOUND_BODY_DESCRIPTOR, {name: sound.name})}
						primaryText={i18n._(DELETE_DESCRIPTOR)}
						primaryVariant="danger"
						onPrimary={async () => {
							try {
								await GuildSoundboardSounds.remove(guildId, sound.id);
							} catch (error) {
								logger.warn('Failed to delete soundboard sound', {error});
							}
						}}
						data-flx="guild.guild-tabs.soundboard-tab.delete-confirm"
					/>
				)),
			);
		},
		[guildId, i18n],
	);

	return (
		<div className={styles.tab} data-flx="guild.guild-tabs.soundboard-tab">
			<p className={styles.hint} data-flx="guild.guild-tabs.soundboard-tab.hint">
				{i18n._(SOUNDBOARD_HINT_DESCRIPTOR, {
					seconds: Math.round(SOUNDBOARD_SOUND_MAX_DURATION_MS / 1000),
					size: formatFileSize(i18n.locale, SOUNDBOARD_SOUND_MAX_BYTES),
				})}
			</p>
			<div className={styles.toolbar} data-flx="guild.guild-tabs.soundboard-tab.toolbar">
				<div className={styles.toolbarSearch} data-flx="guild.guild-tabs.soundboard-tab.search-wrap">
					<Input
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder={i18n._(SEARCH_SOUNDS_DESCRIPTOR)}
						aria-label={i18n._(SEARCH_SOUNDS_DESCRIPTOR)}
						leftIcon={
							<MagnifyingGlassIcon size={16} weight="bold" data-flx="guild.guild-tabs.soundboard-tab.search-icon" />
						}
						data-flx="guild.guild-tabs.soundboard-tab.search"
					/>
				</div>
				{canManage && (
					<Button variant="primary" onClick={() => void upload()} data-flx="guild.guild-tabs.soundboard-tab.upload">
						<Trans>Upload sound</Trans>
					</Button>
				)}
			</div>
			{!loaded && !failed ? (
				<div className={styles.centered} data-flx="guild.guild-tabs.soundboard-tab.loading">
					<Spinner data-flx="guild.guild-tabs.soundboard-tab.spinner" />
				</div>
			) : failed && !loaded ? (
				<p className={styles.hint} data-flx="guild.guild-tabs.soundboard-tab.failed">
					<Trans>Could not load this community's sounds.</Trans>
				</p>
			) : sounds.length === 0 ? (
				<p className={styles.hint} data-flx="guild.guild-tabs.soundboard-tab.empty">
					<Trans>No sounds yet.</Trans>
				</p>
			) : visible.length === 0 ? (
				<p className={styles.hint} data-flx="guild.guild-tabs.soundboard-tab.no-results">
					<Trans>No sounds match your search.</Trans>
				</p>
			) : (
				<div className={styles.list} data-flx="guild.guild-tabs.soundboard-tab.list">
					{visible.map((sound) => (
						<SoundRow
							key={sound.id}
							sound={sound}
							canManage={canManage}
							onDelete={confirmDelete}
							data-flx="guild.guild-tabs.soundboard-tab.sound-row"
						/>
					))}
				</div>
			)}
		</div>
	);
});

export default GuildSoundboardTab;
