// SPDX-License-Identifier: AGPL-3.0-or-later

import styles from '@app/features/guild/components/modals/guild_tabs/guild_roles_tab/RoleColorStyle.module.css';
import type {RoleUpdate} from '@app/features/guild/components/modals/guild_tabs/guild_roles_tab/shared';
import type {GuildRole} from '@app/features/guild/models/GuildRole';
import {ColorPickerField} from '@app/features/ui/components/form/ColorPickerField';
import {SegmentedTabs} from '@app/features/ui/segmented_tabs/SegmentedTabs';
import {resolveNamePaint} from '@app/features/user/name_style/NamePaint';
import {msg} from '@lingui/core/macro';
import {useLingui} from '@lingui/react/macro';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import {useMemo} from 'react';

type RoleColorMode = 'solid' | 'gradient' | 'holographic';

// The same values as Discord's holographic role style.
const HOLOGRAPHIC_PRESET = {primary: 0xa9c9ff, secondary: 0xffbbec, tertiary: 0xffc3a0};
const DEFAULT_GRADIENT_SECONDARY = 0xffffff;

const COLOR_STYLE_DESCRIPTOR = msg({
	message: 'Color style',
	comment: 'Label above the solid, gradient and holographic choice in the role editor.',
});
const SOLID_DESCRIPTOR = msg({message: 'Solid', comment: 'Role color style: one color.'});
const GRADIENT_DESCRIPTOR = msg({message: 'Gradient', comment: 'Role color style: a gradient between two colors.'});
const HOLOGRAPHIC_DESCRIPTOR = msg({
	message: 'Holographic',
	comment: 'Role color style: a shiny three-color gradient that moves on hover.',
});
const SECOND_COLOR_DESCRIPTOR = msg({message: 'Second color', comment: 'Second color of a gradient role.'});
const THIRD_COLOR_DESCRIPTOR = msg({message: 'Third color', comment: 'Third color of a holographic role.'});
const PREVIEW_DESCRIPTOR = msg({
	message: 'Members with this role look like this. Hover to see a holographic role move.',
	comment: 'Hint next to the role name preview in the role editor.',
});

interface RoleColorStyleProps {
	role: GuildRole;
	disabled: boolean;
	onUpdate: (updates: Partial<RoleUpdate>) => void;
}

export const RoleColorStyle = observer(({role, disabled, onUpdate}: RoleColorStyleProps) => {
	const {i18n} = useLingui();
	const mode: RoleColorMode =
		role.secondaryColor === null ? 'solid' : role.tertiaryColor === null ? 'gradient' : 'holographic';
	const tabs = useMemo(
		() => [
			{id: 'solid' as const, label: i18n._(SOLID_DESCRIPTOR)},
			{id: 'gradient' as const, label: i18n._(GRADIENT_DESCRIPTOR)},
			{id: 'holographic' as const, label: i18n._(HOLOGRAPHIC_DESCRIPTOR)},
		],
		[i18n.locale],
	);
	const selectMode = (next: RoleColorMode) => {
		if (disabled || next === mode) return;
		if (next === 'solid') {
			onUpdate({secondaryColor: null, tertiaryColor: null});
		} else if (next === 'gradient') {
			onUpdate({secondaryColor: role.secondaryColor ?? DEFAULT_GRADIENT_SECONDARY, tertiaryColor: null});
		} else {
			onUpdate({
				color: HOLOGRAPHIC_PRESET.primary,
				secondaryColor: HOLOGRAPHIC_PRESET.secondary,
				tertiaryColor: HOLOGRAPHIC_PRESET.tertiary,
			});
		}
	};
	const paint = resolveNamePaint({role, text: role.name});
	return (
		<div className={styles.container} data-flx="guild.guild-tabs.guild-roles-tab.role-color-style">
			<div className={styles.label} data-flx="guild.guild-tabs.guild-roles-tab.role-color-style.label">
				{i18n._(COLOR_STYLE_DESCRIPTOR)}
			</div>
			<SegmentedTabs
				tabs={tabs}
				selectedTab={mode}
				onTabChange={selectMode}
				ariaLabel={i18n._(COLOR_STYLE_DESCRIPTOR)}
			/>
			{mode !== 'solid' && (
				<div className={styles.pickers} data-flx="guild.guild-tabs.guild-roles-tab.role-color-style.pickers">
					<ColorPickerField
						label={i18n._(SECOND_COLOR_DESCRIPTOR)}
						value={role.secondaryColor ?? DEFAULT_GRADIENT_SECONDARY}
						onChange={(color) => onUpdate({secondaryColor: color >>> 0})}
						disabled={disabled}
						hideHelperText={true}
						data-flx="guild.guild-tabs.guild-roles-tab.role-color-style.secondary"
					/>
					{mode === 'holographic' && (
						<ColorPickerField
							label={i18n._(THIRD_COLOR_DESCRIPTOR)}
							value={role.tertiaryColor ?? HOLOGRAPHIC_PRESET.tertiary}
							onChange={(color) => onUpdate({tertiaryColor: color >>> 0})}
							disabled={disabled}
							hideHelperText={true}
							data-flx="guild.guild-tabs.guild-roles-tab.role-color-style.tertiary"
						/>
					)}
				</div>
			)}
			<div
				className={styles.preview}
				data-name-animate-scope=""
				data-flx="guild.guild-tabs.guild-roles-tab.role-color-style.preview"
			>
				<span
					className={clsx(styles.previewName, paint.className)}
					style={paint.style}
					data-flx="guild.guild-tabs.guild-roles-tab.role-color-style.preview-name"
				>
					{role.name}
				</span>
				<span className={styles.previewHint} data-flx="guild.guild-tabs.guild-roles-tab.role-color-style.preview-hint">
					{i18n._(PREVIEW_DESCRIPTOR)}
				</span>
			</div>
		</div>
	);
});
