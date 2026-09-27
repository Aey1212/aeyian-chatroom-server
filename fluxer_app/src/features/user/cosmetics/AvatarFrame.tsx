// SPDX-License-Identifier: AGPL-3.0-or-later

import styles from '@app/features/user/cosmetics/AvatarFrames.module.css';
import CosmeticCatalog, {cosmeticImageUrl} from '@app/features/user/cosmetics/CosmeticCatalog';
import NameStylePrefs from '@app/features/user/name_style/NameStylePrefs';
import {type BuiltinAvatarFrameId, CosmeticKinds, isBuiltinCosmeticId} from '@fluxer/constants/src/CosmeticConstants';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';

// Frames on very small avatars are noise.
export const MIN_AVATAR_FRAME_SIZE = 24;

const BUILTIN_FRAME_CLASSES: Record<BuiltinAvatarFrameId, string> = {
	halo: styles.halo,
	neon: styles.neon,
	rainbow: styles.rainbow,
	flames: styles.flames,
	frost: styles.frost,
	sakura: styles.sakura,
	orbit: styles.orbit,
	galaxy: styles.galaxy,
};

interface AvatarFrameProps {
	frameId: string | null | undefined;
	// The avatar's size in pixels; the frame is drawn 1.2 times larger around it.
	size: number;
	animate?: boolean;
}

export const AvatarFrame = observer(({frameId, size, animate = false}: AvatarFrameProps) => {
	if (!frameId || size < MIN_AVATAR_FRAME_SIZE) return null;
	const boxStyle = {'--frame-box': `${size * 1.2}px`} as React.CSSProperties;
	if (isBuiltinCosmeticId(CosmeticKinds.AVATAR_FRAME, frameId)) {
		return (
			<span
				className={clsx(
					styles.frame,
					BUILTIN_FRAME_CLASSES[frameId as BuiltinAvatarFrameId],
					animate && styles.animated,
				)}
				style={boxStyle}
				aria-hidden
				data-flx="user.cosmetics.avatar-frame"
			>
				<span className={styles.ring} data-flx="user.cosmetics.avatar-frame-ring" />
			</span>
		);
	}
	const cosmetic = CosmeticCatalog.get(frameId);
	if (!cosmetic || cosmetic.kind !== CosmeticKinds.AVATAR_FRAME) return null;
	const playAnimated = cosmetic.animated && (animate || NameStylePrefs.alwaysAnimate);
	return (
		<img
			src={cosmeticImageUrl(cosmetic.id, {animated: playAnimated, size: Math.min(512, Math.ceil(size * 1.2 * 2))})}
			alt=""
			aria-hidden
			draggable={false}
			className={styles.image}
			data-flx="user.cosmetics.avatar-frame-image"
		/>
	);
});
