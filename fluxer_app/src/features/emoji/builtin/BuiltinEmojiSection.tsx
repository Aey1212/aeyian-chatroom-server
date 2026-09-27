// SPDX-License-Identifier: AGPL-3.0-or-later

import {getBuiltinEmojiUrl} from '@app/features/emoji/builtin/BuiltinEmojiAssets';
import {GuildIcon} from '@app/features/guild/components/popouts/GuildIcon';
import Guilds from '@app/features/guild/state/Guilds';
import {BUILTIN_EMOJI_SECTION_ID, BUILTIN_EMOJIS} from '@fluxer/constants/src/BuiltinEmojiConstants';
import type {I18n} from '@lingui/core';
import {msg} from '@lingui/core/macro';
import {observer} from 'mobx-react-lite';

const BUILTIN_SECTION_NAME_DESCRIPTOR = msg({
	message: 'Aeyian',
	comment: 'Name of the emoji section with the emojis that come with the app. A proper name; keep it as is.',
});

export function isBuiltinEmojiSection(guildId: string | null | undefined): boolean {
	return guildId === BUILTIN_EMOJI_SECTION_ID;
}

// The name shown for an emoji section: the server's name, or the built-in section's own name.
export function getEmojiSectionName(i18n: I18n, guildId: string): string {
	if (isBuiltinEmojiSection(guildId)) return i18n._(BUILTIN_SECTION_NAME_DESCRIPTOR);
	return Guilds.getGuild(guildId)?.name ?? '';
}

interface EmojiSectionIconProps {
	guildId: string;
	className?: string;
	sizePx: number;
}

// The icon of an emoji section: the server icon, or the first built-in emoji for the built-in section.
export const EmojiSectionIcon = observer(({guildId, className, sizePx}: EmojiSectionIconProps) => {
	if (isBuiltinEmojiSection(guildId)) {
		const first = BUILTIN_EMOJIS[0];
		return (
			<img
				src={first ? getBuiltinEmojiUrl(first.id) : undefined}
				alt=""
				width={sizePx}
				height={sizePx}
				className={className}
				draggable={false}
				data-flx="emoji.builtin.emoji-section-icon"
			/>
		);
	}
	const guild = Guilds.getGuild(guildId);
	if (!guild) return null;
	return (
		<GuildIcon
			id={guild.id}
			name={guild.name}
			icon={guild.icon}
			className={className}
			sizePx={sizePx}
			data-flx="emoji.builtin.emoji-section-guild-icon"
		/>
	);
});
