// SPDX-License-Identifier: AGPL-3.0-or-later

import {PRODUCT_NAME} from '@app/features/app/config/I18nDisplayConstants';
import type {ExpressionKind} from '@app/features/expressions/commands/ExpressionMetadataCommands';
import styles from '@app/features/expressions/components/ExpressionInfoCard.module.css';
import ExpressionSource from '@app/features/expressions/state/ExpressionSource';
import {hasGlobalExpressionsEnabled} from '@app/features/expressions/utils/ExpressionPermissionUtils';
import {GuildBadge} from '@app/features/guild/components/GuildBadge';
import {GuildIcon} from '@app/features/guild/components/popouts/GuildIcon';
import type {Guild} from '@app/features/guild/models/Guild';
import GuildList from '@app/features/guild/state/GuildList';
import Guilds from '@app/features/guild/state/Guilds';
import * as NavigationCommands from '@app/features/navigation/commands/NavigationCommands';
import FocusRing from '@app/features/ui/focus_ring/FocusRing';
import type {MessageDescriptor} from '@lingui/core';
import {msg} from '@lingui/core/macro';
import {useLingui} from '@lingui/react/macro';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import {useCallback, useEffect} from 'react';

const DEFAULT_EMOJI_DESCRIPTION_DESCRIPTOR = msg({
	message: 'A default emoji. You can use it anywhere on {productName}.',
	comment: 'Description of a built-in unicode emoji in the emoji info card. productName is the Fluxer product name.',
});
const GUILD_EXPRESSION_ANYWHERE_DESCRIPTORS: Record<ExpressionKind, MessageDescriptor> = {
	emoji: msg({
		message: 'A custom emoji from this community. You can use it anywhere on {productName}.',
		comment:
			'Description of a custom emoji in the emoji info card when the viewer can use it outside the community. productName is the Fluxer product name.',
	}),
	sticker: msg({
		message: 'A custom sticker from this community. You can use it anywhere on {productName}.',
		comment:
			'Description of a custom sticker in the sticker info card when the viewer can use it outside the community. productName is the Fluxer product name.',
	}),
};
const GUILD_EXPRESSION_HERE_DESCRIPTORS: Record<ExpressionKind, MessageDescriptor> = {
	emoji: msg({
		message: 'A custom emoji from this community. You can use it in this community.',
		comment:
			'Description of a custom emoji in the emoji info card when the viewer can only use it inside the community.',
	}),
	sticker: msg({
		message: 'A custom sticker from this community. You can use it in this community.',
		comment:
			'Description of a custom sticker in the sticker info card when the viewer can only use it inside the community.',
	}),
};
const FOREIGN_EXPRESSION_DESCRIPTORS: Record<ExpressionKind, MessageDescriptor> = {
	emoji: msg({
		message: 'This is a custom emoji from a community.',
		comment: 'Description of a custom emoji from a community the viewer is not a member of.',
	}),
	sticker: msg({
		message: 'This is a custom sticker from a community.',
		comment: 'Description of a custom sticker from a community the viewer is not a member of.',
	}),
};
const SOURCE_COMMUNITY_LABEL_DESCRIPTORS: Record<ExpressionKind, MessageDescriptor> = {
	emoji: msg({
		message: 'This emoji is from',
		comment: 'Label above the community an emoji comes from in the emoji info card.',
	}),
	sticker: msg({
		message: 'This sticker is from',
		comment: 'Label above the community a sticker comes from in the sticker info card.',
	}),
};
const INVITE_ONLY_COMMUNITY_DESCRIPTOR = msg({
	message: 'Invite-only community',
	comment: 'Subtitle for a community that can only be joined with an invite.',
});
const UNAVAILABLE_SOURCE_COMMUNITY_DESCRIPTOR = msg({
	message: 'A community that is either invite-only or unavailable.',
	comment:
		'Shown under the "This emoji is from" or "This sticker is from" label in the expression info card when the source community is private to the viewer or cannot be reached.',
});
const GO_TO_NAMED_COMMUNITY_DESCRIPTOR = msg({
	message: 'Go to {communityName}',
	comment:
		'Accessible label for the community row of an expression info card, which opens a community the viewer is already a member of. {communityName} is the community name.',
});
const GUILD_ICON_SIZE_PX = 40;

interface ExpressionSourceGuild {
	id: string;
	name: string;
	icon: string | null;
	features: ReadonlyArray<string>;
}

interface ExpressionInfoCardCommonProps {
	displayName: string;
	previewUrl: string | null;
	className?: string;
	onClose?: () => void;
}

export type ExpressionInfoCardProps = ExpressionInfoCardCommonProps &
	({kind: 'default_emoji'} | {kind: ExpressionKind; expressionId: string; guildId: string | null});

function toSourceGuild(guild: Guild): ExpressionSourceGuild {
	return {id: guild.id, name: guild.name, icon: guild.icon, features: [...guild.features]};
}

interface ExpressionSourceGuildState {
	guild: ExpressionSourceGuild | null;
	isRemoteSource: boolean;
	isUnavailable: boolean;
}

function useExpressionSourceGuild(
	kind: ExpressionKind | null,
	expressionId: string | null,
	guildId: string | null,
): ExpressionSourceGuildState {
	const localGuild = guildId != null ? Guilds.getGuild(guildId) : null;
	const sourceState =
		localGuild == null && kind != null && expressionId != null ? ExpressionSource.getSource(kind, expressionId) : null;
	const shouldFetch = sourceState?.status === 'idle';
	useEffect(() => {
		if (!shouldFetch || kind == null || expressionId == null) {
			return;
		}
		void ExpressionSource.fetchSource(kind, expressionId);
	}, [shouldFetch, kind, expressionId]);
	if (localGuild != null) {
		return {guild: toSourceGuild(localGuild), isRemoteSource: false, isUnavailable: false};
	}
	if (sourceState?.status === 'available') {
		return {guild: sourceState.guild, isRemoteSource: true, isUnavailable: false};
	}
	return {guild: null, isRemoteSource: sourceState != null, isUnavailable: sourceState?.status === 'unavailable'};
}

interface ExpressionSourceGuildRowProps {
	kind: ExpressionKind;
	guild: ExpressionSourceGuild;
	isMember: boolean;
	onClose?: () => void;
}

const ExpressionSourceGuildRow = observer(function ExpressionSourceGuildRow({
	kind,
	guild,
	isMember,
	onClose,
}: ExpressionSourceGuildRowProps) {
	const {i18n} = useLingui();
	const handleJump = useCallback(() => {
		NavigationCommands.selectGuild(guild.id);
		onClose?.();
	}, [guild.id, onClose]);
	const activate = isMember ? handleJump : null;
	const accessibleName = i18n._(GO_TO_NAMED_COMMUNITY_DESCRIPTOR, {communityName: guild.name});
	const rowBody = (
		<>
			<GuildIcon
				id={guild.id}
				name={guild.name}
				icon={guild.icon}
				sizePx={GUILD_ICON_SIZE_PX}
				data-flx="expressions.expression-info-card.source-guild-row.guild-icon"
			/>
			<span className={styles.guildInfo} data-flx="expressions.expression-info-card.source-guild-row.guild-info">
				<span
					className={styles.guildNameRow}
					data-flx="expressions.expression-info-card.source-guild-row.guild-name-row"
				>
					<span className={styles.guildName} data-flx="expressions.expression-info-card.source-guild-row.guild-name">
						{guild.name}
					</span>
					<GuildBadge
						features={guild.features}
						onLightSurface
						data-flx="expressions.expression-info-card.source-guild-row.guild-badge"
					/>
				</span>
				<span
					className={styles.guildSubtitle}
					data-flx="expressions.expression-info-card.source-guild-row.guild-subtitle"
				>
					{i18n._(INVITE_ONLY_COMMUNITY_DESCRIPTOR)}
				</span>
			</span>
		</>
	);
	return (
		<div className={styles.guildSection} data-flx="expressions.expression-info-card.source-guild-row.guild-section">
			<span className={styles.guildLabel} data-flx="expressions.expression-info-card.source-guild-row.guild-label">
				{i18n._(SOURCE_COMMUNITY_LABEL_DESCRIPTORS[kind])}
			</span>
			{activate == null ? (
				<div className={styles.guildRow} data-flx="expressions.expression-info-card.source-guild-row.guild-row">
					{rowBody}
				</div>
			) : (
				<FocusRing offset={-2} data-flx="expressions.expression-info-card.source-guild-row.focus-ring">
					<button
						type="button"
						className={clsx(styles.guildRow, styles.guildRowButton)}
						aria-label={accessibleName}
						onClick={activate}
						data-flx="expressions.expression-info-card.source-guild-row.guild-row.activate"
					>
						{rowBody}
					</button>
				</FocusRing>
			)}
		</div>
	);
});

const ExpressionSourceGuildUnavailable = observer(function ExpressionSourceGuildUnavailable({
	kind,
}: {
	kind: ExpressionKind;
}) {
	const {i18n} = useLingui();
	return (
		<div
			className={styles.guildSection}
			data-flx="expressions.expression-info-card.source-guild-unavailable.guild-section"
		>
			<span
				className={styles.guildLabel}
				data-flx="expressions.expression-info-card.source-guild-unavailable.guild-label"
			>
				{i18n._(SOURCE_COMMUNITY_LABEL_DESCRIPTORS[kind])}
			</span>
			<span
				className={clsx(styles.guildRow, styles.guildRowUnavailable)}
				data-flx="expressions.expression-info-card.source-guild-unavailable.guild-row"
			>
				<span
					className={styles.guildUnavailableText}
					data-flx="expressions.expression-info-card.source-guild-unavailable.guild-unavailable-text"
				>
					{i18n._(UNAVAILABLE_SOURCE_COMMUNITY_DESCRIPTOR)}
				</span>
			</span>
		</div>
	);
});

const ExpressionSourceGuildPlaceholder = () => (
	<div
		className={clsx(styles.guildSection, styles.guildSectionPlaceholder)}
		aria-hidden
		data-flx="expressions.expression-info-card.source-guild-placeholder.guild-section"
	>
		<span
			className={styles.guildLabel}
			data-flx="expressions.expression-info-card.source-guild-placeholder.guild-label"
		>
			{'\u00a0'}
		</span>
		<span className={styles.guildRow} data-flx="expressions.expression-info-card.source-guild-placeholder.guild-row">
			<span
				className={styles.guildIconPlaceholder}
				data-flx="expressions.expression-info-card.source-guild-placeholder.guild-icon-placeholder"
			/>
		</span>
	</div>
);

export const ExpressionInfoCard = observer(function ExpressionInfoCard(props: ExpressionInfoCardProps) {
	const {displayName, previewUrl, className, onClose} = props;
	const {i18n} = useLingui();
	const kind: ExpressionKind | null = props.kind === 'default_emoji' ? null : props.kind;
	const expressionId = props.kind === 'default_emoji' ? null : props.expressionId;
	const guildId = props.kind === 'default_emoji' ? null : props.guildId;
	const {guild: sourceGuild, isRemoteSource, isUnavailable} = useExpressionSourceGuild(kind, expressionId, guildId);
	const isMember = sourceGuild != null && GuildList.guilds.some((candidate) => candidate.id === sourceGuild.id);
	const resolveDescription = (): string => {
		if (kind == null) {
			return i18n._(DEFAULT_EMOJI_DESCRIPTION_DESCRIPTOR, {productName: PRODUCT_NAME});
		}
		if (sourceGuild != null && isMember) {
			return hasGlobalExpressionsEnabled()
				? i18n._(GUILD_EXPRESSION_ANYWHERE_DESCRIPTORS[kind], {productName: PRODUCT_NAME})
				: i18n._(GUILD_EXPRESSION_HERE_DESCRIPTORS[kind]);
		}
		return i18n._(FOREIGN_EXPRESSION_DESCRIPTORS[kind]);
	};
	return (
		<div className={clsx(styles.card, className)} data-flx="expressions.expression-info-card.card">
			<div className={styles.summarySection} data-flx="expressions.expression-info-card.summary-section">
				{previewUrl && (
					<img
						src={previewUrl}
						alt=""
						draggable={false}
						className={styles.preview}
						data-flx="expressions.expression-info-card.preview"
					/>
				)}
				<div className={styles.summaryText} data-flx="expressions.expression-info-card.summary-text">
					<span className={styles.name} data-flx="expressions.expression-info-card.name">
						{displayName}
					</span>
					<span className={styles.description} data-flx="expressions.expression-info-card.description">
						{resolveDescription()}
					</span>
				</div>
			</div>
			{kind != null && sourceGuild != null && (
				<ExpressionSourceGuildRow
					kind={kind}
					guild={sourceGuild}
					isMember={isMember}
					onClose={onClose}
					data-flx="expressions.expression-info-card.expression-source-guild-row"
				/>
			)}
			{kind != null && isUnavailable && (
				<ExpressionSourceGuildUnavailable
					kind={kind}
					data-flx="expressions.expression-info-card.expression-source-guild-unavailable"
				/>
			)}
			{isRemoteSource && sourceGuild == null && !isUnavailable && (
				<ExpressionSourceGuildPlaceholder data-flx="expressions.expression-info-card.expression-source-guild-placeholder" />
			)}
		</div>
	);
});

ExpressionInfoCard.displayName = 'ExpressionInfoCard';
