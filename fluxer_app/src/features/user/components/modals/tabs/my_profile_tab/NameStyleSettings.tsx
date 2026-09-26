// SPDX-License-Identifier: AGPL-3.0-or-later

import {ColorPickerField} from '@app/features/ui/components/form/ColorPickerField';
import {Slider} from '@app/features/ui/components/Slider';
import {SegmentedTabs} from '@app/features/ui/segmented_tabs/SegmentedTabs';
import styles from '@app/features/user/components/modals/tabs/my_profile_tab/NameStyleSettings.module.css';
import {
	ensureNameFontFaces,
	NAME_FONTS,
	type NameFont,
	type NameFontCategory,
	type NameFontScript,
	nameFontFamily,
} from '@app/features/user/name_style/NameFonts';
import {nameLanguage, resolveNamePaint} from '@app/features/user/name_style/NamePaint';
import {
	DEFAULT_NAME_EFFECT_INTENSITY,
	type NameFontId,
	type NameGradientDirection,
	NameGradientDirections,
	type NameStyleEffect,
	NameStyleEffects,
} from '@fluxer/constants/src/NameStyleConstants';
import {type NameStyle, normalizeNameStyle} from '@fluxer/schema/src/domains/user/NameStyleSchemas';
import type {MessageDescriptor} from '@lingui/core';
import {msg} from '@lingui/core/macro';
import {useLingui} from '@lingui/react/macro';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import {useEffect, useMemo, useState} from 'react';

const NAME_STYLE_DESCRIPTOR = msg({
	message: 'Name style',
	comment: 'Profile settings section title for the display name font, colors and effect.',
});
const NAME_STYLE_DESCRIPTION_DESCRIPTOR = msg({
	message:
		'Pick a font, colors and an effect for your display name. Everyone sees it. In a server, a colored role replaces your colors.',
	comment: 'Profile settings section description for the display name style.',
});
const FONT_DESCRIPTOR = msg({message: 'Font', comment: 'Label above the display name font picker.'});
const DEFAULT_FONT_DESCRIPTOR = msg({
	message: 'Default',
	comment: 'Font tile that keeps the app font for the display name.',
});
const ALL_FONTS_DESCRIPTOR = msg({message: 'All', comment: 'Font picker filter that shows every font.'});
const EFFECT_DESCRIPTOR = msg({message: 'Effect', comment: 'Label above the display name effect choice.'});
const MAIN_COLOR_DESCRIPTOR = msg({message: 'Main color', comment: 'Label for the first display name color.'});
const SECOND_COLOR_DESCRIPTOR = msg({
	message: 'Second color',
	comment: 'Label for the second display name color, used by gradient, glow and shimmer.',
});
const GLOW_COLOR_DESCRIPTOR = msg({message: 'Glow color', comment: 'Label for the glow color of a display name.'});
const SHINE_COLOR_DESCRIPTOR = msg({
	message: 'Shine color',
	comment: 'Label for the color of the light that sweeps across a shimmering display name.',
});
const DIRECTION_DESCRIPTOR = msg({
	message: 'Direction',
	comment: 'Label above the horizontal or vertical choice for a gradient display name.',
});
const HORIZONTAL_DESCRIPTOR = msg({
	message: 'Horizontal',
	comment: 'Gradient direction: the color changes from the start of the name to its end.',
});
const VERTICAL_DESCRIPTOR = msg({
	message: 'Vertical',
	comment: 'Gradient direction: the color changes from the top of the letters to their bottom.',
});
const INTENSITY_DESCRIPTOR = msg({
	message: 'Intensity',
	comment: 'Label of the slider that sets how strong the glow or shimmer of a display name is.',
});
const RESET_NAME_STYLE_DESCRIPTOR = msg({
	message: 'Reset name style',
	comment: 'Button that returns the display name to the default font, colors and effect.',
});
const ANIMATES_ON_HOVER_DESCRIPTOR = msg({
	message: 'Hover the preview to see the effect move.',
	comment: 'Hint under the display name preview for animated effects.',
});
const FONTS_DESCRIPTOR = msg({message: 'Fonts', comment: 'Accessible label for the list of display name fonts.'});
const EFFECTS_DESCRIPTOR = msg({
	message: 'Name effects',
	comment: 'Accessible label for the display name effect tabs.',
});

const EFFECT_LABELS: Record<NameStyleEffect, MessageDescriptor> = {
	solid: msg({message: 'Solid', comment: 'Display name effect: one color.'}),
	gradient: msg({message: 'Gradient', comment: 'Display name effect: a gradient between two colors.'}),
	glow: msg({message: 'Glow', comment: 'Display name effect: a soft glow around the name.'}),
	shimmer: msg({message: 'Shimmer', comment: 'Display name effect: a light that sweeps across the name.'}),
};

const CATEGORY_LABELS: Record<NameFontCategory, MessageDescriptor> = {
	sans: msg({message: 'Sans', comment: 'Font picker filter: sans-serif fonts.'}),
	serif: msg({message: 'Serif', comment: 'Font picker filter: serif fonts.'}),
	display: msg({message: 'Display', comment: 'Font picker filter: decorative display fonts.'}),
	handwriting: msg({message: 'Handwriting', comment: 'Font picker filter: handwriting and script fonts.'}),
	pixel: msg({message: 'Pixel', comment: 'Font picker filter: pixel and retro fonts.'}),
	mono: msg({message: 'Mono', comment: 'Font picker filter: monospaced fonts.'}),
};

// Each chip shows a few letters of the writing system; the full name is its tooltip.
const SCRIPT_CHIPS: Record<NameFontScript, {sample: string; label: MessageDescriptor}> = {
	latin: {sample: 'Aa', label: msg({message: 'Latin', comment: 'Writing system covered by a font.'})},
	latin_ext: {
		sample: 'Ğş',
		label: msg({message: 'Latin Extended', comment: 'Writing system covered by a font: accented Latin letters.'}),
	},
	cyrillic: {sample: 'Жж', label: msg({message: 'Cyrillic', comment: 'Writing system covered by a font.'})},
	greek: {sample: 'Ωω', label: msg({message: 'Greek', comment: 'Writing system covered by a font.'})},
	vietnamese: {sample: 'Ẩẩ', label: msg({message: 'Vietnamese', comment: 'Writing system covered by a font.'})},
	arabic: {sample: 'عر', label: msg({message: 'Arabic', comment: 'Writing system covered by a font.'})},
	hebrew: {sample: 'אב', label: msg({message: 'Hebrew', comment: 'Writing system covered by a font.'})},
	thai: {sample: 'ไท', label: msg({message: 'Thai', comment: 'Writing system covered by a font.'})},
	devanagari: {sample: 'हि', label: msg({message: 'Devanagari', comment: 'Writing system covered by a font.'})},
	japanese: {sample: 'あ字', label: msg({message: 'Japanese', comment: 'Writing system covered by a font.'})},
	korean: {sample: '한', label: msg({message: 'Korean', comment: 'Writing system covered by a font.'})},
	chinese_simplified: {
		sample: '简',
		label: msg({message: 'Chinese (Simplified)', comment: 'Writing system covered by a font.'}),
	},
	chinese_traditional: {
		sample: '繁',
		label: msg({message: 'Chinese (Traditional)', comment: 'Writing system covered by a font.'}),
	},
};

const DEFAULT_PRIMARY = 0xffffff;
const DEFAULT_SECONDARY = 0x8b5cf6;
const CATEGORY_ORDER: ReadonlyArray<NameFontCategory> = ['sans', 'serif', 'display', 'handwriting', 'pixel', 'mono'];

type CategoryFilter = NameFontCategory | 'all';

interface NameStyleSettingsProps {
	value: NameStyle | null;
	onChange: (value: NameStyle | null) => void;
	displayName: string;
	disabled?: boolean;
}

function withChanges(value: NameStyle | null, changes: Partial<NameStyle>): NameStyle | null {
	return normalizeNameStyle({
		font: value?.font ?? null,
		effect: value?.effect ?? NameStyleEffects.SOLID,
		primary_color: value?.primary_color ?? null,
		secondary_color: value?.secondary_color ?? null,
		gradient_direction: value?.gradient_direction ?? NameGradientDirections.HORIZONTAL,
		intensity: value?.intensity ?? DEFAULT_NAME_EFFECT_INTENSITY,
		...changes,
	});
}

function formatPercent(value: number): string {
	return `${Math.round(value)}%`;
}

export const NameStyleSettings = observer(({value, onChange, displayName, disabled}: NameStyleSettingsProps) => {
	const {i18n} = useLingui();
	const [category, setCategory] = useState<CategoryFilter>('all');
	useEffect(() => ensureNameFontFaces(), []);
	const effect = value?.effect ?? NameStyleEffects.SOLID;
	const previewPaint = resolveNamePaint({nameStyle: value, text: displayName});
	const visibleFonts = useMemo(
		() => (category === 'all' ? NAME_FONTS : NAME_FONTS.filter((font) => font.category === category)),
		[category],
	);
	const directionTabs = useMemo(
		() => [
			{id: NameGradientDirections.HORIZONTAL, label: i18n._(HORIZONTAL_DESCRIPTOR)},
			{id: NameGradientDirections.VERTICAL, label: i18n._(VERTICAL_DESCRIPTOR)},
		],
		[i18n.locale],
	);
	const intensity = value?.intensity ?? DEFAULT_NAME_EFFECT_INTENSITY;
	const setIntensity = (next: number) => {
		if (!disabled) onChange(withChanges(value, {intensity: Math.round(next)}));
	};
	const effectTabs = useMemo(
		() => (Object.keys(EFFECT_LABELS) as Array<NameStyleEffect>).map((id) => ({id, label: i18n._(EFFECT_LABELS[id])})),
		[i18n.locale],
	);
	const selectFont = (font: NameFontId | null) => {
		if (!disabled) onChange(withChanges(value, {font}));
	};
	const selectEffect = (next: NameStyleEffect) => {
		const changes: Partial<NameStyle> = {effect: next};
		if (next !== NameStyleEffects.SOLID && value?.secondary_color == null) {
			changes.secondary_color = DEFAULT_SECONDARY;
			if (value?.primary_color == null) changes.primary_color = DEFAULT_PRIMARY;
		}
		onChange(withChanges(value, changes));
	};
	const secondLabel =
		effect === NameStyleEffects.GLOW
			? GLOW_COLOR_DESCRIPTOR
			: effect === NameStyleEffects.SHIMMER
				? SHINE_COLOR_DESCRIPTOR
				: SECOND_COLOR_DESCRIPTOR;

	const renderTile = (font: NameFont | null) => {
		const selected = (value?.font ?? null) === (font?.id ?? null);
		return (
			<button
				key={font?.id ?? 'default'}
				type="button"
				role="radio"
				aria-checked={selected}
				disabled={disabled}
				className={clsx(styles.fontTile, selected && styles.fontTileSelected)}
				onClick={() => selectFont(font?.id ?? null)}
				data-flx="user.my-profile-tab.name-style-settings.font-tile"
			>
				<span
					className={styles.fontSample}
					style={font ? {fontFamily: nameFontFamily(font)} : undefined}
					lang={font ? nameLanguage(displayName) : undefined}
					data-flx="user.my-profile-tab.name-style-settings.font-sample"
				>
					{displayName}
				</span>
				<span className={styles.fontLabel} data-flx="user.my-profile-tab.name-style-settings.font-label">
					{font ? font.label : i18n._(DEFAULT_FONT_DESCRIPTOR)}
				</span>
				{font && (
					<span className={styles.scriptChips} data-flx="user.my-profile-tab.name-style-settings.script-chips">
						{font.scripts.map((script) => (
							<span
								key={script}
								className={styles.scriptChip}
								role="img"
								title={i18n._(SCRIPT_CHIPS[script].label)}
								aria-label={i18n._(SCRIPT_CHIPS[script].label)}
								data-flx="user.my-profile-tab.name-style-settings.script-chip"
							>
								{SCRIPT_CHIPS[script].sample}
							</span>
						))}
					</span>
				)}
			</button>
		);
	};

	return (
		<div className={styles.container} data-flx="user.my-profile-tab.name-style-settings.container">
			<div className={styles.header} data-flx="user.my-profile-tab.name-style-settings.header">
				<h2 className={styles.title} data-flx="user.my-profile-tab.name-style-settings.title">
					{i18n._(NAME_STYLE_DESCRIPTOR)}
				</h2>
				<p className={styles.description} data-flx="user.my-profile-tab.name-style-settings.description">
					{i18n._(NAME_STYLE_DESCRIPTION_DESCRIPTOR)}
				</p>
			</div>
			<div
				className={styles.preview}
				data-name-animate-scope=""
				data-flx="user.my-profile-tab.name-style-settings.preview"
			>
				<span
					className={clsx(styles.previewName, previewPaint.className)}
					style={previewPaint.style}
					lang={previewPaint.lang}
					data-flx="user.my-profile-tab.name-style-settings.preview-name"
				>
					{displayName}
				</span>
				{effect !== NameStyleEffects.SOLID && effect !== NameStyleEffects.GRADIENT && (
					<span className={styles.previewHint} data-flx="user.my-profile-tab.name-style-settings.preview-hint">
						{i18n._(ANIMATES_ON_HOVER_DESCRIPTOR)}
					</span>
				)}
			</div>
			<div className={styles.fieldLabel} data-flx="user.my-profile-tab.name-style-settings.font-field-label">
				{i18n._(FONT_DESCRIPTOR)}
			</div>
			<div className={styles.categoryRow} data-flx="user.my-profile-tab.name-style-settings.category-row">
				{(['all', ...CATEGORY_ORDER] as Array<CategoryFilter>).map((id) => (
					<button
						key={id}
						type="button"
						aria-pressed={category === id}
						className={clsx(styles.categoryButton, category === id && styles.categoryButtonSelected)}
						onClick={() => setCategory(id)}
						data-flx="user.my-profile-tab.name-style-settings.category-button"
					>
						{id === 'all' ? i18n._(ALL_FONTS_DESCRIPTOR) : i18n._(CATEGORY_LABELS[id])}
					</button>
				))}
			</div>
			<div
				className={styles.fontGrid}
				role="radiogroup"
				aria-label={i18n._(FONTS_DESCRIPTOR)}
				data-flx="user.my-profile-tab.name-style-settings.font-grid"
			>
				{category === 'all' && renderTile(null)}
				{visibleFonts.map((font) => renderTile(font))}
			</div>
			<div className={styles.fieldLabel} data-flx="user.my-profile-tab.name-style-settings.effect-field-label">
				{i18n._(EFFECT_DESCRIPTOR)}
			</div>
			<SegmentedTabs
				tabs={effectTabs}
				selectedTab={effect}
				onTabChange={(next) => !disabled && selectEffect(next)}
				ariaLabel={i18n._(EFFECTS_DESCRIPTOR)}
			/>
			{effect === NameStyleEffects.GRADIENT && (
				<>
					<div className={styles.fieldLabel} data-flx="user.my-profile-tab.name-style-settings.direction-field-label">
						{i18n._(DIRECTION_DESCRIPTOR)}
					</div>
					<SegmentedTabs<NameGradientDirection>
						tabs={directionTabs}
						selectedTab={value?.gradient_direction ?? NameGradientDirections.HORIZONTAL}
						onTabChange={(next) => !disabled && onChange(withChanges(value, {gradient_direction: next}))}
						ariaLabel={i18n._(DIRECTION_DESCRIPTOR)}
					/>
				</>
			)}
			{(effect === NameStyleEffects.GLOW || effect === NameStyleEffects.SHIMMER) && (
				<>
					<div className={styles.fieldLabel} data-flx="user.my-profile-tab.name-style-settings.intensity-field-label">
						{i18n._(INTENSITY_DESCRIPTOR)}
					</div>
					<Slider
						value={intensity}
						defaultValue={intensity}
						factoryDefaultValue={DEFAULT_NAME_EFFECT_INTENSITY}
						minValue={0}
						maxValue={100}
						step={1}
						disabled={disabled}
						ariaLabel={i18n._(INTENSITY_DESCRIPTOR)}
						onValueRender={formatPercent}
						asValueChanges={setIntensity}
						onValueChange={setIntensity}
						data-flx="user.my-profile-tab.name-style-settings.intensity-slider"
					/>
				</>
			)}
			<div className={styles.colors} data-flx="user.my-profile-tab.name-style-settings.colors">
				<ColorPickerField
					label={i18n._(MAIN_COLOR_DESCRIPTOR)}
					value={value?.primary_color ?? DEFAULT_PRIMARY}
					onChange={(color) => onChange(withChanges(value, {primary_color: color}))}
					defaultValue={DEFAULT_PRIMARY}
					isDefaultValue={value?.primary_color == null}
					onReset={() => onChange(withChanges(value, {primary_color: null}))}
					disabled={disabled}
					hideHelperText={true}
					data-flx="user.my-profile-tab.name-style-settings.primary-color"
				/>
				{effect !== NameStyleEffects.SOLID && (
					<ColorPickerField
						label={i18n._(secondLabel)}
						value={value?.secondary_color ?? DEFAULT_SECONDARY}
						onChange={(color) => onChange(withChanges(value, {secondary_color: color}))}
						defaultValue={DEFAULT_SECONDARY}
						isDefaultValue={value?.secondary_color == null}
						onReset={() => onChange(withChanges(value, {secondary_color: null}))}
						disabled={disabled}
						hideHelperText={true}
						data-flx="user.my-profile-tab.name-style-settings.secondary-color"
					/>
				)}
			</div>
			{value && (
				<button
					type="button"
					className={styles.resetButton}
					disabled={disabled}
					onClick={() => onChange(null)}
					data-flx="user.my-profile-tab.name-style-settings.reset-button"
				>
					{i18n._(RESET_NAME_STYLE_DESCRIPTOR)}
				</button>
			)}
		</div>
	);
});
