// SPDX-License-Identifier: AGPL-3.0-or-later

import aeyianFlagUrl from '@app/features/emoji/builtin/aeyian-flag.svg';

// Image for each built-in emoji id in @fluxer/constants/src/BuiltinEmojiConstants.
const BUILTIN_EMOJI_URLS: Readonly<Record<string, string>> = {
	'1': aeyianFlagUrl,
};

export function getBuiltinEmojiUrl(id: string): string | undefined {
	return BUILTIN_EMOJI_URLS[id];
}
