// SPDX-License-Identifier: AGPL-3.0-or-later

import {Avatar} from '@app/features/ui/components/Avatar';
import styles from '@app/features/user/components/modals/tabs/my_profile_tab/CosmeticSettings.module.css';
import {AvatarFrame} from '@app/features/user/cosmetics/AvatarFrame';
import CosmeticCatalog from '@app/features/user/cosmetics/CosmeticCatalog';
import {Nameplate} from '@app/features/user/cosmetics/Nameplate';
import type {User} from '@app/features/user/models/User';
import {
	BUILTIN_AVATAR_FRAME_IDS,
	BUILTIN_NAMEPLATE_IDS,
	type BuiltinAvatarFrameId,
	type BuiltinNameplateId,
	CosmeticKinds,
} from '@fluxer/constants/src/CosmeticConstants';
import type {MessageDescriptor} from '@lingui/core';
import {msg} from '@lingui/core/macro';
import {useLingui} from '@lingui/react/macro';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import {useEffect} from 'react';

const AVATAR_FRAME_DESCRIPTOR = msg({
	message: 'Avatar frame',
	comment: 'Profile settings section title for the decoration drawn around the round avatar.',
});
const AVATAR_FRAME_DESCRIPTION_DESCRIPTOR = msg({
	message: 'A decoration around your avatar, shown wherever your avatar appears.',
	comment: 'Profile settings section description for the avatar frame.',
});
const AVATAR_FRAMES_DESCRIPTOR = msg({
	message: 'Avatar frames',
	comment: 'Accessible label for the list of avatar frames.',
});
const NAMEPLATE_DESCRIPTOR = msg({
	message: 'Nameplate',
	comment: 'Profile settings section title for the background drawn behind your name in lists.',
});
const NAMEPLATE_DESCRIPTION_DESCRIPTOR = msg({
	message: 'A background behind your name in the member list and in direct messages.',
	comment: 'Profile settings section description for the nameplate.',
});
const NAMEPLATES_DESCRIPTOR = msg({message: 'Nameplates', comment: 'Accessible label for the list of nameplates.'});
const NONE_DESCRIPTOR = msg({message: 'None', comment: 'Cosmetic choice that shows nothing.'});

const AVATAR_FRAME_LABELS: Record<BuiltinAvatarFrameId, MessageDescriptor> = {
	halo: msg({message: 'Halo', comment: 'Avatar frame name: a glowing golden ring.'}),
	neon: msg({message: 'Neon', comment: 'Avatar frame name: a glowing neon tube.'}),
	rainbow: msg({message: 'Rainbow', comment: 'Avatar frame name: a ring in every colour of the rainbow.'}),
	flames: msg({message: 'Flames', comment: 'Avatar frame name: a flickering ring of fire.'}),
	frost: msg({message: 'Frost', comment: 'Avatar frame name: icy blue and white.'}),
	sakura: msg({message: 'Sakura', comment: 'Avatar frame name: cherry-blossom pink.'}),
	orbit: msg({message: 'Orbit', comment: 'Avatar frame name: a thin dotted ring that circles the avatar.'}),
	galaxy: msg({message: 'Galaxy', comment: 'Avatar frame name: deep space colours with stars.'}),
};

const NAMEPLATE_LABELS: Record<BuiltinNameplateId, MessageDescriptor> = {
	aurora: msg({message: 'Aurora', comment: 'Nameplate name: shifting northern-lights colours.'}),
	sunset: msg({message: 'Sunset', comment: 'Nameplate name: orange, pink and violet evening sky.'}),
	ocean: msg({message: 'Ocean', comment: 'Nameplate name: deep blue water with ripples.'}),
	galaxy: msg({message: 'Galaxy', comment: 'Nameplate name: deep space colours with stars.'}),
	sakura: msg({message: 'Sakura', comment: 'Nameplate name: cherry-blossom pink with petals.'}),
	circuit: msg({message: 'Circuit', comment: 'Nameplate name: teal circuit-board lines.'}),
	ember: msg({message: 'Ember', comment: 'Nameplate name: glowing fire colours with sparks.'}),
	mint: msg({message: 'Mint', comment: 'Nameplate name: fresh mint green.'}),
};

const SAMPLE_AVATAR_SIZE = 48;

interface CosmeticChoice {
	id: string | null;
	label: string;
}

interface CosmeticSettingsProps {
	user: User;
	avatarFrame: string | null;
	nameplate: string | null;
	displayName: string;
	onAvatarFrameChange: (value: string | null) => void;
	onNameplateChange: (value: string | null) => void;
	disabled?: boolean;
}

export const CosmeticSettings = observer(
	({
		user,
		avatarFrame,
		nameplate,
		displayName,
		onAvatarFrameChange,
		onNameplateChange,
		disabled,
	}: CosmeticSettingsProps) => {
		const {i18n} = useLingui();
		useEffect(() => {
			void CosmeticCatalog.ensureLoaded(true);
		}, []);
		const frameChoices: Array<CosmeticChoice> = [
			{id: null, label: i18n._(NONE_DESCRIPTOR)},
			...BUILTIN_AVATAR_FRAME_IDS.map((id) => ({id, label: i18n._(AVATAR_FRAME_LABELS[id])})),
			...CosmeticCatalog.list(CosmeticKinds.AVATAR_FRAME).map((cosmetic) => ({id: cosmetic.id, label: cosmetic.name})),
		];
		const plateChoices: Array<CosmeticChoice> = [
			{id: null, label: i18n._(NONE_DESCRIPTOR)},
			...BUILTIN_NAMEPLATE_IDS.map((id) => ({id, label: i18n._(NAMEPLATE_LABELS[id])})),
			...CosmeticCatalog.list(CosmeticKinds.NAMEPLATE).map((cosmetic) => ({id: cosmetic.id, label: cosmetic.name})),
		];
		return (
			<div className={styles.container} data-flx="user.my-profile-tab.cosmetic-settings.container">
				<div className={styles.header} data-flx="user.my-profile-tab.cosmetic-settings.frame-header">
					<h2 className={styles.title} data-flx="user.my-profile-tab.cosmetic-settings.frame-title">
						{i18n._(AVATAR_FRAME_DESCRIPTOR)}
					</h2>
					<p className={styles.description} data-flx="user.my-profile-tab.cosmetic-settings.frame-description">
						{i18n._(AVATAR_FRAME_DESCRIPTION_DESCRIPTOR)}
					</p>
				</div>
				<div
					className={styles.grid}
					role="radiogroup"
					aria-label={i18n._(AVATAR_FRAMES_DESCRIPTOR)}
					data-flx="user.my-profile-tab.cosmetic-settings.frame-grid"
				>
					{frameChoices.map(({id, label}) => {
						const selected = (avatarFrame ?? null) === id;
						return (
							<button
								key={id ?? 'none'}
								type="button"
								role="radio"
								aria-checked={selected}
								disabled={disabled}
								className={clsx(styles.tile, selected && styles.tileSelected)}
								onClick={() => onAvatarFrameChange(id)}
								data-name-animate-scope=""
								data-flx="user.my-profile-tab.cosmetic-settings.frame-tile"
							>
								<span className={styles.avatarSample} data-flx="user.my-profile-tab.cosmetic-settings.frame-sample">
									<span
										className={styles.avatarWithFrame}
										data-flx="user.my-profile-tab.cosmetic-settings.frame-sample-avatar"
									>
										<Avatar
											user={user}
											size={SAMPLE_AVATAR_SIZE}
											hideFrame
											data-flx="user.my-profile-tab.cosmetic-settings.avatar"
										/>
										<AvatarFrame frameId={id} size={SAMPLE_AVATAR_SIZE} animate={selected} />
									</span>
								</span>
								<span className={styles.label} data-flx="user.my-profile-tab.cosmetic-settings.frame-label">
									{label}
								</span>
							</button>
						);
					})}
				</div>
				<div className={styles.header} data-flx="user.my-profile-tab.cosmetic-settings.nameplate-header">
					<h2 className={styles.title} data-flx="user.my-profile-tab.cosmetic-settings.nameplate-title">
						{i18n._(NAMEPLATE_DESCRIPTOR)}
					</h2>
					<p className={styles.description} data-flx="user.my-profile-tab.cosmetic-settings.nameplate-description">
						{i18n._(NAMEPLATE_DESCRIPTION_DESCRIPTOR)}
					</p>
				</div>
				<div
					className={styles.plateGrid}
					role="radiogroup"
					aria-label={i18n._(NAMEPLATES_DESCRIPTOR)}
					data-flx="user.my-profile-tab.cosmetic-settings.nameplate-grid"
				>
					{plateChoices.map(({id, label}) => {
						const selected = (nameplate ?? null) === id;
						return (
							<button
								key={id ?? 'none'}
								type="button"
								role="radio"
								aria-checked={selected}
								disabled={disabled}
								className={clsx(styles.tile, selected && styles.tileSelected)}
								onClick={() => onNameplateChange(id)}
								data-name-animate-scope=""
								data-flx="user.my-profile-tab.cosmetic-settings.nameplate-tile"
							>
								<span className={styles.plateSample} data-flx="user.my-profile-tab.cosmetic-settings.nameplate-sample">
									<Nameplate nameplateId={id} animate={selected} />
									<Avatar
										user={user}
										size={24}
										hideFrame
										data-flx="user.my-profile-tab.cosmetic-settings.nameplate-avatar"
									/>
									<span
										className={styles.plateName}
										data-flx="user.my-profile-tab.cosmetic-settings.nameplate-display-name"
									>
										{displayName}
									</span>
								</span>
								<span className={styles.label} data-flx="user.my-profile-tab.cosmetic-settings.nameplate-label">
									{label}
								</span>
							</button>
						);
					})}
				</div>
			</div>
		);
	},
);
