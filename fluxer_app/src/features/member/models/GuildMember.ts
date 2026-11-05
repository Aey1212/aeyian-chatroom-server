// SPDX-License-Identifier: AGPL-3.0-or-later

import RuntimeConfig from '@app/features/app/state/RuntimeConfig';
import Authentication from '@app/features/auth/state/Authentication';
import type {GuildRole} from '@app/features/guild/models/GuildRole';
import Guilds from '@app/features/guild/state/Guilds';
import * as ColorUtils from '@app/features/theme/utils/ColorUtils';
import {User} from '@app/features/user/models/User';
import Users from '@app/features/user/state/Users';
import {GuildMemberProfileFlags} from '@fluxer/constants/src/GuildConstants';
import type {ProfileFrameId} from '@fluxer/constants/src/ProfileCustomizationConstants';
import type {MentionReplyPreference} from '@fluxer/constants/src/UserConstants';
import type {GuildMemberData} from '@fluxer/schema/src/domains/guild/GuildMemberSchemas';
import type {NameStyle} from '@fluxer/schema/src/domains/user/NameStyleSchemas';
import {
	type ProfileThemeColors,
	readProfileFrame,
	readProfileThemeColors,
} from '@fluxer/schema/src/domains/user/ProfileStyleSchemas';

interface GuildMemberRecordOptions {
	instanceId?: string;
	cacheUser?: boolean;
}

export class GuildMember {
	readonly instanceId: string;
	readonly guildId: string;
	readonly user: User;
	private readonly cacheUser: boolean;
	readonly nick: string | null;
	readonly avatar: string | null;
	readonly banner: string | null;
	readonly accentColor: number | null;
	readonly roles: ReadonlySet<string>;
	readonly joinedAt: Date;
	readonly mute: boolean;
	readonly deaf: boolean;
	readonly communicationDisabledUntil: Date | null;
	readonly profileFlags: number;
	readonly mentionFlags: MentionReplyPreference;
	// Community versions of the profile cosmetics. Null means the account-level one shows,
	// unless the matching *_UNSET profile flag says none in this community.
	readonly nameStyle: NameStyle | null;
	readonly avatarFrame: string | null;
	readonly nameplate: string | null;
	readonly themeColors: ProfileThemeColors | null;
	readonly profileFrame: ProfileFrameId | null;

	constructor(guildId: string, guildMember: GuildMemberData, options?: GuildMemberRecordOptions) {
		this.instanceId = options?.instanceId ?? RuntimeConfig.localInstanceDomain;
		this.guildId = guildId;
		this.cacheUser = options?.cacheUser !== false;
		const cachedUser = Users.getUser(guildMember.user.id);
		if (cachedUser) {
			this.user = cachedUser;
		} else {
			this.user = new User(guildMember.user, {instanceId: this.instanceId});
			if (this.cacheUser) {
				Users.cacheUsers([this.user.toJSON()]);
			}
		}
		this.nick = guildMember.nick ?? null;
		this.avatar = guildMember.avatar ?? null;
		this.banner = guildMember.banner ?? null;
		this.accentColor = guildMember.accent_color ?? null;
		this.roles = new Set(guildMember.roles);
		this.joinedAt = new Date(guildMember.joined_at);
		this.mute = guildMember.mute ?? false;
		this.deaf = guildMember.deaf ?? false;
		this.communicationDisabledUntil = guildMember.communication_disabled_until
			? new Date(guildMember.communication_disabled_until)
			: null;
		this.profileFlags = guildMember.profile_flags ?? 0;
		this.mentionFlags = (guildMember.mention_flags ?? 0) as MentionReplyPreference;
		this.nameStyle = guildMember.name_style ?? null;
		this.avatarFrame = guildMember.avatar_frame ?? null;
		this.nameplate = guildMember.nameplate ?? null;
		this.themeColors = readProfileThemeColors(guildMember.theme_colors);
		this.profileFrame = readProfileFrame(guildMember.profile_frame);
	}

	isAvatarUnset(): boolean {
		return (this.profileFlags & GuildMemberProfileFlags.AVATAR_UNSET) !== 0;
	}

	isBannerUnset(): boolean {
		return (this.profileFlags & GuildMemberProfileFlags.BANNER_UNSET) !== 0;
	}

	withUpdates(updates: Partial<GuildMemberData>): GuildMember {
		return new GuildMember(
			this.guildId,
			{
				user: updates.user ?? this.user.toJSON(),
				nick: updates.nick ?? this.nick,
				avatar: updates.avatar ?? this.avatar,
				banner: updates.banner ?? this.banner,
				accent_color: updates.accent_color ?? this.accentColor,
				roles: updates.roles ?? Array.from(this.roles),
				joined_at: updates.joined_at ?? this.joinedAt.toISOString(),
				mute: updates.mute ?? this.mute,
				deaf: updates.deaf ?? this.deaf,
				communication_disabled_until:
					updates.communication_disabled_until ?? this.communicationDisabledUntil?.toISOString() ?? null,
				profile_flags: updates.profile_flags ?? this.profileFlags,
				mention_flags: updates.mention_flags ?? this.mentionFlags,
				name_style: 'name_style' in updates ? updates.name_style : this.nameStyle,
				avatar_frame: 'avatar_frame' in updates ? updates.avatar_frame : this.avatarFrame,
				nameplate: 'nameplate' in updates ? updates.nameplate : this.nameplate,
				theme_colors: 'theme_colors' in updates ? updates.theme_colors : this.themeColors,
				profile_frame: 'profile_frame' in updates ? updates.profile_frame : this.profileFrame,
			},
			{instanceId: this.instanceId, cacheUser: this.cacheUser},
		);
	}

	withRoles(roles: Iterable<string>): GuildMember {
		return new GuildMember(
			this.guildId,
			{
				...this.toJSON(),
				roles: Array.from(roles),
			},
			{instanceId: this.instanceId, cacheUser: this.cacheUser},
		);
	}

	getSortedRoles(): ReadonlyArray<GuildRole> {
		const guild = Guilds.getGuild(this.guildId);
		if (!guild) {
			return [];
		}
		return Array.from(this.roles)
			.map((roleId) => guild.roles[roleId])
			.filter((role): role is GuildRole => role !== undefined)
			.sort((a, b) => {
				if (b.position !== a.position) {
					return b.position - a.position;
				}
				return BigInt(a.id) < BigInt(b.id) ? -1 : 1;
			});
	}

	getColorRole(): GuildRole | undefined {
		for (const role of this.getSortedRoles()) {
			if (role.color) {
				return role;
			}
		}
		const everyoneRole = Guilds.getGuild(this.guildId)?.roles[this.guildId];
		return everyoneRole?.color ? everyoneRole : undefined;
	}

	getColorString(): string | undefined {
		const role = this.getColorRole();
		return role ? ColorUtils.int2rgb(role.color) : undefined;
	}

	isCurrentUser(): boolean {
		return this.user.id === Authentication.currentUserId;
	}

	isTimedOut(): boolean {
		if (!this.communicationDisabledUntil) {
			return false;
		}
		return this.communicationDisabledUntil.getTime() > Date.now();
	}

	toJSON(): GuildMemberData {
		return {
			user: this.user.toJSON(),
			nick: this.nick,
			avatar: this.avatar,
			banner: this.banner,
			accent_color: this.accentColor,
			roles: Array.from(this.roles),
			joined_at: this.joinedAt.toISOString(),
			mute: this.mute,
			deaf: this.deaf,
			communication_disabled_until: this.communicationDisabledUntil?.toISOString() ?? null,
			profile_flags: this.profileFlags,
			mention_flags: this.mentionFlags,
			name_style: this.nameStyle,
			avatar_frame: this.avatarFrame,
			nameplate: this.nameplate,
			theme_colors: this.themeColors,
			profile_frame: this.profileFrame,
		};
	}
}
