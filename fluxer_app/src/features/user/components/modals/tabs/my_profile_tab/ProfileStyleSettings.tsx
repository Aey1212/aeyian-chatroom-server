// SPDX-License-Identifier: AGPL-3.0-or-later

import {ColorPickerField} from '@app/features/ui/components/form/ColorPickerField';
import styles from '@app/features/user/components/modals/tabs/my_profile_tab/ProfileStyleSettings.module.css';
import {profileFrameClassName} from '@app/features/user/profile_style/ProfileDecoration';
import {PROFILE_FRAME_IDS, type ProfileFrameId} from '@fluxer/constants/src/ProfileCustomizationConstants';
import type {MessageDescriptor} from '@lingui/core';
import {msg} from '@lingui/core/macro';
import {useLingui} from '@lingui/react/macro';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';

const PROFILE_THEME_DESCRIPTOR = msg({
	message: 'Profile theme',
	comment: 'Profile settings section title for the two colours of the profile card.',
});
const PROFILE_THEME_DESCRIPTION_DESCRIPTOR = msg({
	message: 'Two colors for your profile card, from top to bottom.',
	comment: 'Profile settings section description for the profile theme colours.',
});
const TOP_COLOR_DESCRIPTOR = msg({
	message: 'Top color',
	comment: 'Label for the colour at the top of the profile card.',
});
const BOTTOM_COLOR_DESCRIPTOR = msg({
	message: 'Bottom color',
	comment: 'Label for the colour at the bottom of the profile card.',
});
const REMOVE_THEME_DESCRIPTOR = msg({
	message: 'Remove profile theme',
	comment: 'Button that removes the two-colour theme from the profile card.',
});
const PROFILE_FRAME_DESCRIPTOR = msg({
	message: 'Profile frame',
	comment: 'Profile settings section title for the decorative frame around the profile card.',
});
const PROFILE_FRAME_DESCRIPTION_DESCRIPTOR = msg({
	message: 'A frame around your profile card. It replaces the accent color border.',
	comment: 'Profile settings section description for the profile frame.',
});
const NO_FRAME_DESCRIPTOR = msg({message: 'None', comment: 'Profile frame choice that shows no frame.'});
const FRAMES_DESCRIPTOR = msg({message: 'Profile frames', comment: 'Accessible label for the list of profile frames.'});

const FRAME_LABELS: Record<ProfileFrameId, MessageDescriptor> = {
	aurora: msg({message: 'Aurora', comment: 'Profile frame name: shifting northern-lights colours.'}),
	gold: msg({message: 'Gold', comment: 'Profile frame name: shiny gold.'}),
	neon: msg({message: 'Neon', comment: 'Profile frame name: glowing neon tube.'}),
	holographic: msg({message: 'Holographic', comment: 'Profile frame name: a rotating pastel rainbow.'}),
	ember: msg({message: 'Ember', comment: 'Profile frame name: glowing fire colours.'}),
	frost: msg({message: 'Frost', comment: 'Profile frame name: icy blue and white.'}),
	sakura: msg({message: 'Sakura', comment: 'Profile frame name: cherry-blossom pink.'}),
	midnight: msg({message: 'Midnight', comment: 'Profile frame name: deep night blue and violet.'}),
	circuit: msg({message: 'Circuit', comment: 'Profile frame name: green circuit-board lines.'}),
	pixel: msg({message: 'Pixel', comment: 'Profile frame name: a chunky retro pixel outline.'}),
};

const DEFAULT_THEME: readonly [number, number] = [0x4641d9, 0xeb459e];

interface ProfileStyleSettingsProps {
	themeColors: ReadonlyArray<number> | null;
	frame: string | null;
	onThemeColorsChange: (value: ReadonlyArray<number> | null) => void;
	onFrameChange: (value: ProfileFrameId | null) => void;
	disabled?: boolean;
}

export const ProfileStyleSettings = observer(
	({themeColors, frame, onThemeColorsChange, onFrameChange, disabled}: ProfileStyleSettingsProps) => {
		const {i18n} = useLingui();
		const top = themeColors?.[0] ?? DEFAULT_THEME[0];
		const bottom = themeColors?.[1] ?? DEFAULT_THEME[1];
		const renderFrameTile = (id: ProfileFrameId | null) => {
			const selected = (frame ?? null) === id;
			return (
				<button
					key={id ?? 'none'}
					type="button"
					role="radio"
					aria-checked={selected}
					disabled={disabled}
					className={clsx(styles.frameTile, selected && styles.frameTileSelected)}
					onClick={() => onFrameChange(id)}
					data-flx="user.my-profile-tab.profile-style-settings.frame-tile"
				>
					<span
						className={clsx(styles.frameSample, id ? profileFrameClassName(id) : styles.frameSamplePlain)}
						data-flx="user.my-profile-tab.profile-style-settings.frame-sample"
					/>
					<span className={styles.frameLabel} data-flx="user.my-profile-tab.profile-style-settings.frame-label">
						{id ? i18n._(FRAME_LABELS[id]) : i18n._(NO_FRAME_DESCRIPTOR)}
					</span>
				</button>
			);
		};
		return (
			<div className={styles.container} data-flx="user.my-profile-tab.profile-style-settings.container">
				<div className={styles.header} data-flx="user.my-profile-tab.profile-style-settings.theme-header">
					<h2 className={styles.title} data-flx="user.my-profile-tab.profile-style-settings.theme-title">
						{i18n._(PROFILE_THEME_DESCRIPTOR)}
					</h2>
					<p className={styles.description} data-flx="user.my-profile-tab.profile-style-settings.theme-description">
						{i18n._(PROFILE_THEME_DESCRIPTION_DESCRIPTOR)}
					</p>
				</div>
				<div className={styles.colors} data-flx="user.my-profile-tab.profile-style-settings.colors">
					<ColorPickerField
						label={i18n._(TOP_COLOR_DESCRIPTOR)}
						value={top}
						onChange={(color) => onThemeColorsChange([color, bottom])}
						defaultValue={DEFAULT_THEME[0]}
						isDefaultValue={themeColors == null}
						disabled={disabled}
						hideHelperText={true}
						data-flx="user.my-profile-tab.profile-style-settings.top-color"
					/>
					<ColorPickerField
						label={i18n._(BOTTOM_COLOR_DESCRIPTOR)}
						value={bottom}
						onChange={(color) => onThemeColorsChange([top, color])}
						defaultValue={DEFAULT_THEME[1]}
						isDefaultValue={themeColors == null}
						disabled={disabled}
						hideHelperText={true}
						data-flx="user.my-profile-tab.profile-style-settings.bottom-color"
					/>
				</div>
				{themeColors && (
					<button
						type="button"
						className={styles.linkButton}
						disabled={disabled}
						onClick={() => onThemeColorsChange(null)}
						data-flx="user.my-profile-tab.profile-style-settings.remove-theme"
					>
						{i18n._(REMOVE_THEME_DESCRIPTOR)}
					</button>
				)}
				<div className={styles.header} data-flx="user.my-profile-tab.profile-style-settings.frame-header">
					<h2 className={styles.title} data-flx="user.my-profile-tab.profile-style-settings.frame-title">
						{i18n._(PROFILE_FRAME_DESCRIPTOR)}
					</h2>
					<p className={styles.description} data-flx="user.my-profile-tab.profile-style-settings.frame-description">
						{i18n._(PROFILE_FRAME_DESCRIPTION_DESCRIPTOR)}
					</p>
				</div>
				<div
					className={styles.frameGrid}
					role="radiogroup"
					aria-label={i18n._(FRAMES_DESCRIPTOR)}
					data-flx="user.my-profile-tab.profile-style-settings.frame-grid"
				>
					{renderFrameTile(null)}
					{PROFILE_FRAME_IDS.map((id) => renderFrameTile(id))}
				</div>
			</div>
		);
	},
);
