// SPDX-License-Identifier: AGPL-3.0-or-later

import styles from '@app/features/user/components/profile/profile_card/ProfileCardLayout.module.css';
import type {ProfileDecoration} from '@app/features/user/profile_style/ProfileDecoration';
import {Trans} from '@lingui/react/macro';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useMemo} from 'react';

interface ProfileCardLayoutProps {
	borderColor: string;
	// Theme and frame; when given, it replaces the plain accent border.
	decoration?: ProfileDecoration;
	showPreviewLabel?: boolean;
	hoverRef?: (instance: HTMLDivElement | null) => void;
	className?: string;
	style?: React.CSSProperties;
	children: React.ReactNode;
}

export const ProfileCardLayout: React.FC<ProfileCardLayoutProps> = observer(
	({borderColor, decoration, showPreviewLabel = false, hoverRef, className, style, children}) => {
		const cardStyle = useMemo<React.CSSProperties>(
			() => ({...style, ...(decoration ? decoration.style : {borderColor})}),
			[borderColor, decoration, style],
		);
		return (
			<div data-flx="user.profile.profile-card.profile-card-layout.div">
				{showPreviewLabel && (
					<div className={styles.previewLabel} data-flx="user.profile.profile-card.profile-card-layout.preview-label">
						<Trans>Profile preview</Trans>
					</div>
				)}
				<div
					ref={hoverRef}
					className={clsx(styles.profileCard, decoration?.className, className)}
					style={cardStyle}
					data-flx="user.profile.profile-card.profile-card-layout.profile-card"
				>
					{children}
				</div>
			</div>
		);
	},
);
