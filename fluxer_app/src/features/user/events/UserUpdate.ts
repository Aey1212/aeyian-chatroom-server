// SPDX-License-Identifier: AGPL-3.0-or-later

import type {GatewayHandlerContext} from '@app/features/gateway/events/EventRouter';
import GuildVerification from '@app/features/guild/state/GuildVerification';
import Messages from '@app/features/messaging/state/MessagingMessages';
import Permission from '@app/features/permissions/state/Permission';
import QuickSwitcher from '@app/features/search/state/QuickSwitcher';
import Users from '@app/features/user/state/Users';
import type {User} from '@fluxer/schema/src/domains/user/UserResponseSchemas';

export function handleUserUpdate(data: User, _context: GatewayHandlerContext): void {
	Users.handleUserUpdate(data);
	Messages.handleUserUpdate({user: {id: data.id}});
	Permission.handleUserUpdate(data.id);
	QuickSwitcher.recomputeIfOpen();
	GuildVerification.handleUserUpdate();
}
