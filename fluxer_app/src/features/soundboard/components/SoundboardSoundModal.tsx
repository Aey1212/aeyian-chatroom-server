// SPDX-License-Identifier: AGPL-3.0-or-later

import * as Modal from '@app/features/app/components/dialogs/Modal';
import {EmojiPickerPopout} from '@app/features/emoji/components/popouts/EmojiPickerPopout';
import type {FlatEmoji} from '@app/features/emoji/types/EmojiTypes';
import {HttpError} from '@app/features/platform/types/EndpointError';
import {Logger} from '@app/features/platform/utils/AppLogger';
import styles from '@app/features/soundboard/components/SoundboardSettings.module.css';
import {SoundboardSoundEmoji} from '@app/features/soundboard/components/SoundboardSoundEmoji';
import SoundboardPlaybackEngine from '@app/features/soundboard/engine/SoundboardPlaybackEngine';
import GuildSoundboardSounds, {type SoundboardSound} from '@app/features/soundboard/state/GuildSoundboardSounds';
import {Button} from '@app/features/ui/button/Button';
import * as ModalCommands from '@app/features/ui/commands/ModalCommands';
import {Input} from '@app/features/ui/components/form/FormInput';
import {Slider} from '@app/features/ui/components/Slider';
import {Popout} from '@app/features/ui/popover/PopoverPopout';
import {SOUNDBOARD_SOUND_NAME_MAX_LENGTH} from '@fluxer/constants/src/SoundboardConstants';
import {msg} from '@lingui/core/macro';
import {Trans, useLingui} from '@lingui/react/macro';
import {PlayIcon, StopIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import {useCallback, useEffect, useMemo, useState} from 'react';

const logger = new Logger('SoundboardSoundModal');

const ADD_SOUND_DESCRIPTOR = msg({
	message: 'Add sound',
	comment: 'Title of the dialog that uploads a new soundboard sound.',
});
const EDIT_SOUND_DESCRIPTOR = msg({
	message: 'Edit sound',
	comment: 'Title of the dialog that edits a soundboard sound.',
});
const SOUND_NAME_DESCRIPTOR = msg({
	message: 'Sound name',
	comment: 'Label of the name field in the soundboard sound dialog.',
});
const SAVE_DESCRIPTOR = msg({
	message: 'Save',
	comment: 'Primary button of the soundboard sound dialog.',
});
const CANCEL_DESCRIPTOR = msg({
	message: 'Cancel',
	comment: 'Cancel button of the soundboard sound dialog.',
});
const SAVE_FAILED_DESCRIPTOR = msg({
	message: 'Could not save the sound.',
	comment: 'Error shown in the soundboard sound dialog when saving fails for an unknown reason.',
});
const NAME_REQUIRED_DESCRIPTOR = msg({
	message: 'Give the sound a name.',
	comment: 'Error shown in the soundboard sound dialog when the name is empty.',
});

async function blobToDataUrl(blob: Blob): Promise<string> {
	return await new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result));
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(blob);
	});
}

function errorMessage(error: unknown): string | null {
	if (!(error instanceof HttpError)) return null;
	const body = error.body as {message?: unknown; errors?: unknown} | undefined;
	const detail = JSON.stringify(body?.errors ?? '');
	const match = /"message":"([^"]+)"/.exec(detail);
	if (match?.[1]) return match[1];
	return typeof body?.message === 'string' ? body.message : null;
}

type SoundboardSoundModalProps =
	| {mode: 'create'; guildId: string; audio: Blob; defaultName: string}
	| {mode: 'edit'; guildId: string; sound: SoundboardSound};

export const SoundboardSoundModal = observer((props: SoundboardSoundModalProps) => {
	const {i18n} = useLingui();
	const existing = props.mode === 'edit' ? props.sound : null;
	const [name, setName] = useState(
		existing?.name ?? (props.mode === 'create' ? props.defaultName.slice(0, SOUNDBOARD_SOUND_NAME_MAX_LENGTH) : ''),
	);
	const [volume, setVolume] = useState(existing?.volume ?? 100);
	const [emojiId, setEmojiId] = useState<string | null>(existing?.emojiId ?? null);
	const [emojiName, setEmojiName] = useState<string | null>(existing?.emojiName ?? null);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const audioBlob = props.mode === 'create' ? props.audio : null;
	const localUrl = useMemo(() => (audioBlob ? URL.createObjectURL(audioBlob) : null), [audioBlob]);
	const previewKey = existing ? existing.id : 'new-sound';
	const previewing = SoundboardPlaybackEngine.previewSoundId === previewKey;

	useEffect(
		() => () => {
			SoundboardPlaybackEngine.stopPreview();
			if (localUrl) URL.revokeObjectURL(localUrl);
		},
		[localUrl],
	);

	const close = useCallback(() => {
		SoundboardPlaybackEngine.stopPreview();
		ModalCommands.popByType(SoundboardSoundModal);
	}, []);

	const togglePreview = useCallback(() => {
		if (previewing) {
			SoundboardPlaybackEngine.stopPreview();
			return;
		}
		const url = existing?.url ?? localUrl;
		if (!url) return;
		void SoundboardPlaybackEngine.preview({
			id: previewKey,
			hash: existing?.hash ?? `local:${url}`,
			url,
			volume,
		});
	}, [existing, localUrl, previewKey, previewing, volume]);

	const selectEmoji = useCallback((emoji: FlatEmoji) => {
		if (emoji.guildId || (emoji.id && !emoji.surrogates)) {
			setEmojiId(emoji.id ?? null);
			setEmojiName(null);
			return;
		}
		setEmojiId(null);
		setEmojiName(emoji.surrogates ?? null);
	}, []);

	const save = useCallback(async () => {
		const trimmed = name.trim();
		if (!trimmed) {
			setError(i18n._(NAME_REQUIRED_DESCRIPTOR));
			return;
		}
		setError(null);
		setSubmitting(true);
		try {
			if (props.mode === 'create') {
				await GuildSoundboardSounds.create(props.guildId, {
					name: trimmed,
					base64Audio: await blobToDataUrl(props.audio),
					volume,
					emojiId,
					emojiName,
				});
			} else {
				await GuildSoundboardSounds.update(props.guildId, props.sound.id, {name: trimmed, volume, emojiId, emojiName});
			}
			close();
		} catch (saveError) {
			logger.warn('Failed to save soundboard sound', {error: saveError});
			setError(errorMessage(saveError) ?? i18n._(SAVE_FAILED_DESCRIPTOR));
			setSubmitting(false);
		}
	}, [close, emojiId, emojiName, i18n, name, props, volume]);

	return (
		<Modal.Root size="small" centered data-flx="soundboard.sound-modal.root">
			<Modal.Header
				title={i18n._(props.mode === 'create' ? ADD_SOUND_DESCRIPTOR : EDIT_SOUND_DESCRIPTOR)}
				onClose={close}
				data-flx="soundboard.sound-modal.header"
			/>
			<Modal.Content padding="default" data-flx="soundboard.sound-modal.content">
				<div className={styles.form} data-flx="soundboard.sound-modal.form">
					<Input
						label={i18n._(SOUND_NAME_DESCRIPTOR)}
						value={name}
						maxLength={SOUNDBOARD_SOUND_NAME_MAX_LENGTH}
						onChange={(event) => setName(event.target.value)}
						data-flx="soundboard.sound-modal.name"
					/>
					<div className={styles.field} data-flx="soundboard.sound-modal.emoji-field">
						<span className={styles.fieldLabel} data-flx="soundboard.sound-modal.emoji-label">
							<Trans>Emoji</Trans>
						</span>
						<div className={styles.emojiRow} data-flx="soundboard.sound-modal.emoji-row">
							<Popout
								render={({onClose}) => (
									<EmojiPickerPopout
										channelId={null}
										handleSelect={selectEmoji}
										onClose={onClose}
										data-flx="soundboard.sound-modal.emoji-picker"
									/>
								)}
								position="bottom-start"
								data-flx="soundboard.sound-modal.emoji-popout"
							>
								<button type="button" className={styles.emojiButton} data-flx="soundboard.sound-modal.emoji-button">
									<SoundboardSoundEmoji emojiId={emojiId} emojiName={emojiName} />
									<span data-flx="soundboard.sound-modal.emoji-button-label">
										<Trans>Choose emoji</Trans>
									</span>
								</button>
							</Popout>
							{(emojiId || emojiName) && (
								<Button
									variant="secondary"
									small
									onClick={() => {
										setEmojiId(null);
										setEmojiName(null);
									}}
									data-flx="soundboard.sound-modal.emoji-clear"
								>
									<Trans>Remove</Trans>
								</Button>
							)}
						</div>
					</div>
					<div className={styles.field} data-flx="soundboard.sound-modal.volume-field">
						<span className={styles.fieldLabel} data-flx="soundboard.sound-modal.volume-label">
							<Trans>Volume</Trans>
						</span>
						<Slider
							value={volume}
							defaultValue={volume}
							factoryDefaultValue={100}
							minValue={0}
							maxValue={100}
							step={1}
							onValueRender={(value) => `${Math.round(value)}%`}
							asValueChanges={(value) => setVolume(Math.round(value))}
							onValueChange={(value) => setVolume(Math.round(value))}
							data-flx="soundboard.sound-modal.volume-slider"
						/>
					</div>
					<div data-flx="soundboard.sound-modal.preview-row">
						<Button variant="secondary" small onClick={togglePreview} data-flx="soundboard.sound-modal.preview-button">
							<span className={styles.buttonContent} data-flx="soundboard.sound-modal.preview-content">
								{previewing ? (
									<StopIcon size={14} weight="fill" data-flx="soundboard.sound-modal.preview-stop-icon" />
								) : (
									<PlayIcon size={14} weight="fill" data-flx="soundboard.sound-modal.preview-play-icon" />
								)}
								{previewing ? <Trans>Stop</Trans> : <Trans>Preview</Trans>}
							</span>
						</Button>
					</div>
					{error && (
						<p className={styles.errorText} data-flx="soundboard.sound-modal.error">
							{error}
						</p>
					)}
				</div>
			</Modal.Content>
			<Modal.Footer data-flx="soundboard.sound-modal.footer">
				<Button variant="secondary" onClick={close} data-flx="soundboard.sound-modal.cancel">
					{i18n._(CANCEL_DESCRIPTOR)}
				</Button>
				<Button
					variant="primary"
					onClick={() => void save()}
					submitting={submitting}
					disabled={submitting}
					data-flx="soundboard.sound-modal.save"
				>
					{i18n._(SAVE_DESCRIPTOR)}
				</Button>
			</Modal.Footer>
		</Modal.Root>
	);
});

SoundboardSoundModal.displayName = 'SoundboardSoundModal';

export function openSoundboardSoundModal(props: SoundboardSoundModalProps): void {
	ModalCommands.push(
		ModalCommands.modal(() => <SoundboardSoundModal {...props} data-flx="soundboard.sound-modal.open" />),
	);
}
