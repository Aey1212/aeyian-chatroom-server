// SPDX-License-Identifier: AGPL-3.0-or-later

import {SoundboardPopout} from '@app/features/soundboard/components/SoundboardPopout';
import SoundboardPlaybackEngine from '@app/features/soundboard/engine/SoundboardPlaybackEngine';
import FocusRing from '@app/features/ui/focus_ring/FocusRing';
import {Popout} from '@app/features/ui/popover/PopoverPopout';
import styles from '@app/features/voice/components/VoiceConnectionStatus.module.css';
import {msg} from '@lingui/core/macro';
import {useLingui} from '@lingui/react/macro';
import {MusicNotesIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';

const OPEN_SOUNDBOARD_DESCRIPTOR = msg({
	message: 'Open soundboard',
	comment: 'Tooltip and accessible label of the soundboard button in the voice connection panel.',
});

export const SoundboardButton = observer(function SoundboardButton({
	guildId,
	channelId,
}: {
	guildId: string;
	channelId: string;
}) {
	const {i18n} = useLingui();
	const playing = SoundboardPlaybackEngine.plays.some((play) => play.channelId === channelId);
	return (
		<Popout
			render={({onClose}) => (
				<SoundboardPopout
					guildId={guildId}
					channelId={channelId}
					onClose={onClose}
					data-flx="soundboard.button.popout"
				/>
			)}
			position="top"
			offsetMainAxis={8}
			uniqueId={`soundboard-${channelId}`}
			subscribeTo="SOUNDBOARD_TOGGLE"
			tooltip={i18n._(OPEN_SOUNDBOARD_DESCRIPTOR)}
			data-flx="soundboard.button.popout-root"
		>
			<FocusRing offset={-2} data-flx="soundboard.button.focus-ring">
				<button
					type="button"
					className={clsx(styles.mediaButton, playing && styles.screenShareActive)}
					aria-label={i18n._(OPEN_SOUNDBOARD_DESCRIPTOR)}
					data-flx="soundboard.button.media-button"
				>
					<MusicNotesIcon weight="fill" className={styles.mediaIcon} data-flx="soundboard.button.icon" />
				</button>
			</FocusRing>
		</Popout>
	);
});
