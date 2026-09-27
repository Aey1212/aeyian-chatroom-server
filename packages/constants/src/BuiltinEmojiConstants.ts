// SPDX-License-Identifier: AGPL-3.0-or-later

// Emojis shipped with the app and usable by everyone, in any server and in DMs. They use custom-emoji
// markup (<:name:id>) with small reserved ids that no generated snowflake can reach. The images live
// in fluxer_app/src/features/emoji/builtin/.
export const BUILTIN_EMOJI_SECTION_ID = 'builtin';

export interface BuiltinEmojiDefinition {
	readonly id: string;
	readonly name: string;
}

export const BUILTIN_EMOJIS: ReadonlyArray<BuiltinEmojiDefinition> = [{id: '1', name: 'aeyian_flag'}];

const BUILTIN_EMOJIS_BY_ID = new Map<string, BuiltinEmojiDefinition>(BUILTIN_EMOJIS.map((emoji) => [emoji.id, emoji]));

export function getBuiltinEmoji(id: string | bigint | null | undefined): BuiltinEmojiDefinition | undefined {
	return id == null ? undefined : BUILTIN_EMOJIS_BY_ID.get(id.toString());
}

export function isBuiltinEmojiId(id: string | bigint | null | undefined): boolean {
	return getBuiltinEmoji(id) !== undefined;
}
