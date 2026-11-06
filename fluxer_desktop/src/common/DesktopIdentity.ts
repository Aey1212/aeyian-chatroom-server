// SPDX-License-Identifier: AGPL-3.0-or-later

import {BUILD_CHANNEL} from '@electron/common/BuildChannel';

export const DESKTOP_APP_NAME = BUILD_CHANNEL === 'canary' ? 'Fluxer Canary' : 'Aeyian Chatline';
export const MACOS_BUNDLE_ID = BUILD_CHANNEL === 'canary' ? 'app.fluxer.canary' : 'com.aeyempire.chatline';
export const LINUX_DESKTOP_ENTRY_ID = BUILD_CHANNEL === 'canary' ? 'fluxer-canary' : 'aeyian-chatline';
// Windows ids are our own so the app can sit next to an official Fluxer install without sharing its
// shortcuts, notification identity or install folder. WINDOWS_VELOPACK_ID must match the installer's --packId.
export const WINDOWS_SHORTCUT_AUTHOR = BUILD_CHANNEL === 'canary' ? 'Fluxer Platform AB' : 'AEY Empire';
const WINDOWS_VELOPACK_ID = BUILD_CHANNEL === 'canary' ? 'fluxer_desktop_canary' : 'aeyian_chatline';
export const WINDOWS_APP_USER_MODEL_ID =
	BUILD_CHANNEL === 'canary' ? 'Fluxer.Fluxer.Canary' : 'AeyEmpire.AeyianChatline';
export const WINDOWS_LEGACY_APP_USER_MODEL_IDS = [`velopack.${WINDOWS_VELOPACK_ID}`];
export const WINDOWS_TOAST_ACTIVATOR_CLSID =
	BUILD_CHANNEL === 'canary' ? '{9CEDB5C0-3552-43B0-A279-2232E0CDF74C}' : '{E7008653-0D20-408A-9F5B-7D71CC352502}';
