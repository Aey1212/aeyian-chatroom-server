// SPDX-License-Identifier: AGPL-3.0-or-later

import type {GuildRole} from '@app/features/guild/models/GuildRole';

export const ROLE_DND_TYPE = 'guild-role';
export const GUILD_ROLES_TAB_ID = 'roles';

export interface RoleDragItem {
	type: typeof ROLE_DND_TYPE;
	id: string;
	isEveryone: boolean;
	isLocked: boolean;
}

export interface RoleUpdate {
	id: string;
	name?: string;
	color?: number;
	secondaryColor?: number | null;
	tertiaryColor?: number | null;
	hoist?: boolean;
	mentionable?: boolean;
	permissions?: bigint;
}

export function applyRoleUpdate(role: GuildRole, updates: RoleUpdate | undefined): GuildRole {
	if (!updates) return role;
	const color = updates.color ?? role.color;
	const secondaryColor = updates.secondaryColor !== undefined ? updates.secondaryColor : role.secondaryColor;
	const tertiaryColor = updates.tertiaryColor !== undefined ? updates.tertiaryColor : role.tertiaryColor;
	return role.withUpdates({
		name: updates.name ?? role.name,
		color,
		colors: {primary_color: color, secondary_color: secondaryColor, tertiary_color: tertiaryColor},
		hoist: updates.hoist ?? role.hoist,
		mentionable: updates.mentionable ?? role.mentionable,
		permissions: updates.permissions?.toString() ?? role.permissions.toString(),
		position: role.position,
	});
}
