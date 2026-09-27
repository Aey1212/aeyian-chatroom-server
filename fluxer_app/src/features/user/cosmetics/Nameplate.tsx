// SPDX-License-Identifier: AGPL-3.0-or-later

import CosmeticCatalog, {cosmeticImageUrl} from '@app/features/user/cosmetics/CosmeticCatalog';
import styles from '@app/features/user/cosmetics/Nameplates.module.css';
import NameStylePrefs from '@app/features/user/name_style/NameStylePrefs';
import {type BuiltinNameplateId, CosmeticKinds, isBuiltinCosmeticId} from '@fluxer/constants/src/CosmeticConstants';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';

const BUILTIN_NAMEPLATE_CLASSES: Record<BuiltinNameplateId, string> = {
	aurora: styles.aurora,
	sunset: styles.sunset,
	ocean: styles.ocean,
	galaxy: styles.galaxy,
	sakura: styles.sakura,
	circuit: styles.circuit,
	ember: styles.ember,
	mint: styles.mint,
};

// Uploaded nameplates are fetched at this width, enough for a sidebar row on a dense screen.
const NAMEPLATE_IMAGE_WIDTH = 480;

interface NameplateProps {
	nameplateId: string | null | undefined;
	animate?: boolean;
}

export const Nameplate = observer(({nameplateId, animate = false}: NameplateProps) => {
	if (!nameplateId) return null;
	if (isBuiltinCosmeticId(CosmeticKinds.NAMEPLATE, nameplateId)) {
		return (
			<span
				className={clsx(
					styles.plate,
					BUILTIN_NAMEPLATE_CLASSES[nameplateId as BuiltinNameplateId],
					animate && styles.animated,
				)}
				aria-hidden
				data-flx="user.cosmetics.nameplate"
			/>
		);
	}
	const cosmetic = CosmeticCatalog.get(nameplateId);
	if (!cosmetic || cosmetic.kind !== CosmeticKinds.NAMEPLATE) return null;
	return (
		<img
			src={cosmeticImageUrl(cosmetic.id, {
				animated: cosmetic.animated && (animate || NameStylePrefs.alwaysAnimate),
				size: NAMEPLATE_IMAGE_WIDTH,
			})}
			alt=""
			aria-hidden
			draggable={false}
			className={styles.image}
			data-flx="user.cosmetics.nameplate-image"
		/>
	);
});
