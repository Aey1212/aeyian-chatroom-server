// SPDX-License-Identifier: AGPL-3.0-or-later

import * as ColorUtils from '@app/features/theme/utils/ColorUtils';
import styles from '@app/features/user/profile_style/ProfileDecoration.module.css';
import {isProfileFrameId, type ProfileFrameId} from '@fluxer/constants/src/ProfileCustomizationConstants';
import {clsx} from 'clsx';
import type React from 'react';

export interface ProfileDecorationInput {
	themeColors?: ReadonlyArray<number> | null;
	frame?: string | null;
	// The accent colour used for the border when there is no theme and no frame.
	accentColor: string;
}

export interface ProfileDecoration {
	className?: string;
	style: React.CSSProperties;
	// The colour behind the banner when the profile has no banner image.
	bannerColor: string;
}

type CssVars = React.CSSProperties & Record<`--${string}`, string>;

const FRAME_CLASSES: Record<ProfileFrameId, string> = {
	aurora: styles.aurora,
	gold: styles.gold,
	neon: styles.neon,
	holographic: styles.holographic,
	ember: styles.ember,
	frost: styles.frost,
	sakura: styles.sakura,
	midnight: styles.midnight,
	circuit: styles.circuit,
	pixel: styles.pixel,
};

export function profileFrameClassName(frame: ProfileFrameId): string {
	return clsx(styles.decorated, styles.framed, FRAME_CLASSES[frame]);
}

// Without a theme or a frame the card keeps its plain accent border and adds nothing.
export function resolveProfileDecoration({themeColors, frame, accentColor}: ProfileDecorationInput): ProfileDecoration {
	const theme = themeColors && themeColors.length === 2 ? themeColors : null;
	const frameId = isProfileFrameId(frame) ? frame : null;
	if (!theme && !frameId) {
		return {style: {borderColor: accentColor}, bannerColor: accentColor};
	}
	const style: CssVars = {'--pc-accent': accentColor};
	let bannerColor = accentColor;
	if (theme) {
		const top = ColorUtils.int2hex(theme[0]);
		style['--profile-theme-top'] = top;
		style['--profile-theme-bottom'] = ColorUtils.int2hex(theme[1]);
		bannerColor = top;
	}
	return {
		className: clsx(
			styles.decorated,
			theme && styles.themed,
			frameId && styles.framed,
			frameId && FRAME_CLASSES[frameId],
		),
		style,
		bannerColor,
	};
}
