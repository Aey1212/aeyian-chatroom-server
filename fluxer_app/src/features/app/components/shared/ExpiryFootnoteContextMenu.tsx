// SPDX-License-Identifier: AGPL-3.0-or-later

import * as AccessibilityCommands from '@app/features/accessibility/commands/AccessibilityCommands';
import {MenuGroup} from '@app/features/ui/action_menu/MenuGroup';
import {MenuItem} from '@app/features/ui/action_menu/MenuItem';
import {msg} from '@lingui/core/macro';
import {useLingui} from '@lingui/react/macro';
import {type FC, useCallback} from 'react';

const HIDE_EXPIRY_FOOTNOTES_DESCRIPTOR = msg({
	message: 'Hide expiration footnotes',
	comment: 'Short label in the shared app expiry footnote context menu.',
});
export const ExpiryFootnoteContextMenu: FC = () => {
	const {i18n} = useLingui();
	const handleHideFootnotes = useCallback(() => {
		AccessibilityCommands.update({showAttachmentExpiryIndicator: false});
	}, []);
	return (
		<MenuGroup data-flx="app.expiry-footnote-context-menu.menu-group">
			<MenuItem onClick={handleHideFootnotes} data-flx="app.expiry-footnote-context-menu.menu-item.hide-footnotes">
				{i18n._(HIDE_EXPIRY_FOOTNOTES_DESCRIPTOR)}
			</MenuItem>
		</MenuGroup>
	);
};
