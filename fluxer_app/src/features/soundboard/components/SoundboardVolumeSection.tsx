// SPDX-License-Identifier: AGPL-3.0-or-later

import styles from '@app/features/soundboard/components/Soundboard.module.css';
import SoundboardSettings from '@app/features/soundboard/state/SoundboardSettings';
import {Slider} from '@app/features/ui/components/Slider';
import {canResetSliderValue, SliderResetIconButton} from '@app/features/ui/components/slider/SliderResetIconButton';
import {msg} from '@lingui/core/macro';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';

const RESET_SOUNDBOARD_VOLUME_DESCRIPTOR = msg({
	message: 'Reset soundboard volume',
	comment: 'Accessible label of the button that resets the soundboard volume slider to 100%.',
});

export const SoundboardVolumeSection = observer(function SoundboardVolumeSection() {
	const {i18n} = useLingui();
	const volume = SoundboardSettings.volume;
	return (
		<div className={styles.volumeSection} data-flx="soundboard.volume-section">
			<div className={styles.volumeLabelRow} data-flx="soundboard.volume-section.label-row">
				<span className={styles.volumeLabel} data-flx="soundboard.volume-section.label">
					<Trans>Soundboard volume</Trans>
				</span>
				<SliderResetIconButton
					canReset={canResetSliderValue(volume, 100)}
					onReset={() => SoundboardSettings.setVolume(100)}
					ariaLabel={i18n._(RESET_SOUNDBOARD_VOLUME_DESCRIPTOR)}
					dataFlx="soundboard.volume-section.reset"
					data-flx="soundboard.volume-section.reset-button"
				/>
			</div>
			<Slider
				value={volume}
				defaultValue={volume}
				factoryDefaultValue={100}
				minValue={0}
				maxValue={100}
				step={1}
				onValueRender={(value) => `${Math.round(value)}%`}
				asValueChanges={(value) => SoundboardSettings.setVolume(value)}
				onValueChange={(value) => SoundboardSettings.setVolume(value)}
				data-flx="soundboard.volume-section.slider"
			/>
			<p className={styles.volumeHint} data-flx="soundboard.volume-section.hint">
				<Trans>How loud soundboard sounds played in your voice channel are. At 0% you don't hear them at all.</Trans>
			</p>
		</div>
	);
});
