// SPDX-License-Identifier: AGPL-3.0-or-later

import type {ApiContext} from '@app/api/ApiContext';
import {mapUserToAdminResponse} from '@app/api/admin/models/UserTypes';
import type {AdminAuditService} from '@app/api/admin/services/AdminAuditService';
import type {AdminUserUpdatePropagator} from '@app/api/admin/services/AdminUserUpdatePropagator';
import {EMAIL_CLEARABLE_SUSPICIOUS_ACTIVITY_FLAGS} from '@app/api/auth/AuthEmail';
import {createUserID, type UserID} from '@app/api/BrandedTypes';
import type {IGuildRepositoryAggregate} from '@app/api/guild/repositories/IGuildRepositoryAggregate';
import {GuildMemberSearchIndexService} from '@app/api/guild/services/member/GuildMemberSearchIndexService';
import type {EntityAssetService, PreparedAssetUpload} from '@app/api/infrastructure/EntityAssetService';
import {Logger} from '@app/api/Logger';
import type {User} from '@app/api/models/User';
import {applyUsernameChange} from '@app/api/user/UsernameChange';
import {UsernameChangeRequestRepository} from '@app/api/user/UsernameChangeRequestRepository';
import {type IUsernameRegistry, normalizeUsername} from '@app/api/user/UsernameRegistry';
import {
	BOT_USERNAME_BASE_MAX_LENGTH,
	BOT_USERNAME_SUFFIX,
	PASSWORD_RESET_OPEN_TRAIT,
} from '@fluxer/constants/src/UserConstants';
import {ValidationErrorCodes} from '@fluxer/constants/src/ValidationErrorCodes';
import {AccessDeniedError} from '@fluxer/errors/src/domains/core/AccessDeniedError';
import {InputValidationError} from '@fluxer/errors/src/domains/core/InputValidationError';
import {UnknownUserError} from '@fluxer/errors/src/domains/user/UnknownUserError';
import type {
	AdminPasswordResetModeResponse,
	AdminUsernameChangeDecisionResponse,
	AdminUsernameChangeRequestsResponse,
	ChangeDobRequest,
	ChangeEmailRequest,
	ChangeUsernameRequest,
	ClearUserFieldsRequest,
	SetUserBotStatusRequest,
	SetUserSystemStatusRequest,
	VerifyUserEmailRequest,
} from '@fluxer/schema/src/domains/admin/AdminUserSchemas';
import {types} from 'cassandra-driver';

interface AdminUserProfileServiceDeps {
	apiContext: ApiContext;
	usernameRegistry: IUsernameRegistry;
	entityAssetService: EntityAssetService;
	auditService: AdminAuditService;
	updatePropagator: AdminUserUpdatePropagator;
	guildRepository: IGuildRepositoryAggregate;
}

export class AdminUserProfileService {
	private readonly searchIndexService: GuildMemberSearchIndexService;
	private readonly usernameChangeRequests = new UsernameChangeRequestRepository();

	constructor(private readonly deps: AdminUserProfileServiceDeps) {
		this.searchIndexService = new GuildMemberSearchIndexService();
	}

	async clearUserFields(
		data: ClearUserFieldsRequest,
		adminUserId: UserID,
		auditLogReason: string | null,
		acls: ReadonlySet<string>,
	) {
		const {users: userRepository, cache: cacheService} = this.deps.apiContext.services;
		const {entityAssetService, auditService, updatePropagator} = this.deps;
		const userId = createUserID(data.user_id);
		const user = await userRepository.findUnique(userId);
		if (!user) {
			throw new UnknownUserError();
		}
		const updates: Record<string, null | string> = {};
		const preparedAssets: Array<PreparedAssetUpload> = [];
		for (const field of data.fields) {
			if (field === 'avatar') {
				const prepared = await entityAssetService.prepareAssetUpload({
					assetType: 'avatar',
					entityType: 'user',
					entityId: userId,
					previousHash: user.avatarHash,
					base64Image: null,
					errorPath: 'avatar',
				});
				preparedAssets.push(prepared);
				updates['avatar_hash'] = prepared.newHash;
			} else if (field === 'banner') {
				const prepared = await entityAssetService.prepareAssetUpload({
					assetType: 'banner',
					entityType: 'user',
					entityId: userId,
					previousHash: user.bannerHash,
					base64Image: null,
					errorPath: 'banner',
				});
				preparedAssets.push(prepared);
				updates['banner_hash'] = prepared.newHash;
			} else if (field === 'bio') {
				updates['bio'] = null;
			} else if (field === 'pronouns') {
				updates['pronouns'] = null;
			} else if (field === 'global_name') {
				updates['global_name'] = null;
			}
		}
		const updatedUser = await userRepository.patchUpsert(userId, updates, user.toRow());
		await entityAssetService.commitAssetChanges(preparedAssets);
		await updatePropagator.propagateUserUpdate({userId, oldUser: user, updatedUser: updatedUser});
		await auditService.createAuditLog({
			adminUserId,
			targetType: 'user',
			targetId: BigInt(userId),
			action: 'clear_fields',
			auditLogReason,
			metadata: new Map([['fields', data.fields.join(',')]]),
		});
		return {
			user: await mapUserToAdminResponse(updatedUser, cacheService, acls),
		};
	}

	async setUserBotStatus(
		data: SetUserBotStatusRequest,
		adminUserId: UserID,
		auditLogReason: string | null,
		acls: ReadonlySet<string>,
	) {
		const {users: userRepository, cache: cacheService} = this.deps.apiContext.services;
		const {auditService, updatePropagator} = this.deps;
		const userId = createUserID(data.user_id);
		const user = await userRepository.findUnique(userId);
		if (!user) {
			throw new UnknownUserError();
		}
		if (data.bot && user.acls.size > 0) {
			throw new AccessDeniedError();
		}
		const updates: Record<string, boolean> = {bot: data.bot};
		if (!data.bot) {
			updates['system'] = false;
		}
		const updatedUser = await userRepository.patchUpsert(userId, updates, user.toRow());
		await updatePropagator.propagateUserUpdate({userId, oldUser: user, updatedUser: updatedUser});
		await auditService.createAuditLog({
			adminUserId,
			targetType: 'user',
			targetId: BigInt(userId),
			action: 'set_bot_status',
			auditLogReason,
			metadata: new Map([['bot', data.bot.toString()]]),
		});
		return {
			user: await mapUserToAdminResponse(updatedUser, cacheService, acls),
		};
	}

	async setUserSystemStatus(
		data: SetUserSystemStatusRequest,
		adminUserId: UserID,
		auditLogReason: string | null,
		acls: ReadonlySet<string>,
	) {
		const {users: userRepository, cache: cacheService} = this.deps.apiContext.services;
		const {auditService, updatePropagator} = this.deps;
		const userId = createUserID(data.user_id);
		const user = await userRepository.findUnique(userId);
		if (!user) {
			throw new UnknownUserError();
		}
		if (data.system && !user.isBot) {
			throw InputValidationError.fromCode(
				'system',
				ValidationErrorCodes.USER_MUST_BE_A_BOT_TO_BE_MARKED_AS_A_SYSTEM_USER,
			);
		}
		const updatedUser = await userRepository.patchUpsert(userId, {system: data.system}, user.toRow());
		await updatePropagator.propagateUserUpdate({userId, oldUser: user, updatedUser: updatedUser});
		await auditService.createAuditLog({
			adminUserId,
			targetType: 'user',
			targetId: BigInt(userId),
			action: 'set_system_status',
			auditLogReason,
			metadata: new Map([['system', data.system.toString()]]),
		});
		return {
			user: await mapUserToAdminResponse(updatedUser, cacheService, acls),
		};
	}

	async verifyUserEmail(
		data: VerifyUserEmailRequest,
		adminUserId: UserID,
		auditLogReason: string | null,
		acls: ReadonlySet<string>,
	) {
		const {users: userRepository, cache: cacheService} = this.deps.apiContext.services;
		const {auditService, updatePropagator} = this.deps;
		const userId = createUserID(data.user_id);
		const user = await userRepository.findUnique(userId);
		if (!user) {
			throw new UnknownUserError();
		}
		const updates: {
			email_verified: boolean;
			email_bounced: boolean;
			suspicious_activity_flags?: number;
		} = {
			email_verified: true,
			email_bounced: false,
		};
		if (user.suspiciousActivityFlags !== null && user.suspiciousActivityFlags !== 0) {
			const newFlags = user.suspiciousActivityFlags & ~EMAIL_CLEARABLE_SUSPICIOUS_ACTIVITY_FLAGS;
			if (newFlags !== user.suspiciousActivityFlags) {
				updates.suspicious_activity_flags = newFlags;
			}
		}
		const updatedUser = await userRepository.patchUpsert(userId, updates, user.toRow());
		await updatePropagator.propagateUserUpdate({userId, oldUser: user, updatedUser: updatedUser});
		await auditService.createAuditLog({
			adminUserId,
			targetType: 'user',
			targetId: BigInt(userId),
			action: 'verify_email',
			auditLogReason,
			metadata: new Map([['email', user.email ?? 'null']]),
		});
		return {
			user: await mapUserToAdminResponse(updatedUser, cacheService, acls),
		};
	}

	async changeUsername(
		data: ChangeUsernameRequest,
		adminUserId: UserID,
		auditLogReason: string | null,
		acls: ReadonlySet<string>,
	) {
		const {users: userRepository, cache: cacheService} = this.deps.apiContext.services;
		const {usernameRegistry} = this.deps;
		const userId = createUserID(data.user_id);
		const user = await userRepository.findUnique(userId);
		if (!user) {
			throw new UnknownUserError();
		}
		// A bot keeps its -BOT suffix; the admin names the part before it.
		if (user.isBot && data.username.length > BOT_USERNAME_BASE_MAX_LENGTH) {
			throw InputValidationError.fromCode('username', ValidationErrorCodes.USERNAME_LENGTH_INVALID);
		}
		const newUsername = user.isBot ? `${data.username}${BOT_USERNAME_SUFFIX}` : data.username;
		const updatedUser = await applyUsernameChange({usernameRegistry, userRepository}, user, newUsername);
		await this.afterUsernameChange(user, updatedUser, adminUserId, auditLogReason, 'change_username');
		return {
			user: await mapUserToAdminResponse(updatedUser, cacheService, acls),
		};
	}

	async listUsernameChangeRequests(): Promise<AdminUsernameChangeRequestsResponse> {
		const {users: userRepository} = this.deps.apiContext.services;
		const pending = await this.usernameChangeRequests.listPending();
		const requests = await Promise.all(
			pending.map(async (entry) => {
				const [request, user] = await Promise.all([
					this.usernameChangeRequests.get(entry.user_id),
					userRepository.findUnique(entry.user_id),
				]);
				return request?.status === 'pending'
					? {
							user_id: entry.user_id.toString(),
							current_username: user?.username ?? null,
							requested_username: request.requested_username,
							created_at: request.created_at.toISOString(),
						}
					: null;
			}),
		);
		return {requests: requests.filter((request) => request !== null)};
	}

	async approveUsernameChangeRequest(
		userId: UserID,
		adminUserId: UserID,
		auditLogReason: string | null,
	): Promise<AdminUsernameChangeDecisionResponse> {
		const {users: userRepository} = this.deps.apiContext.services;
		const request = await this.usernameChangeRequests.get(userId);
		if (request?.status !== 'pending') {
			return {applied: false};
		}
		const user = await userRepository.findUnique(userId);
		if (!user) {
			await this.deps.usernameRegistry.releaseHold(request.requested_username, userId);
			await this.usernameChangeRequests.close(request, 'rejected', adminUserId);
			return {applied: false};
		}
		const caseOnly = normalizeUsername(user.username) === normalizeUsername(request.requested_username);
		const updatedUser = await applyUsernameChange(
			{usernameRegistry: this.deps.usernameRegistry, userRepository},
			user,
			request.requested_username,
			{viaHold: !caseOnly},
		);
		await this.usernameChangeRequests.close(request, 'approved', adminUserId);
		await this.afterUsernameChange(user, updatedUser, adminUserId, auditLogReason, 'approve_username_change_request');
		return {applied: true};
	}

	async rejectUsernameChangeRequest(
		userId: UserID,
		adminUserId: UserID,
		auditLogReason: string | null,
	): Promise<AdminUsernameChangeDecisionResponse> {
		const {users: userRepository} = this.deps.apiContext.services;
		const request = await this.usernameChangeRequests.get(userId);
		if (request?.status !== 'pending') {
			return {applied: false};
		}
		const user = await userRepository.findUnique(userId);
		const caseOnly =
			user !== null && normalizeUsername(user.username) === normalizeUsername(request.requested_username);
		if (!caseOnly) {
			await this.deps.usernameRegistry.releaseHold(request.requested_username, userId);
		}
		await this.usernameChangeRequests.close(request, 'rejected', adminUserId);
		await this.deps.auditService.createAuditLog({
			adminUserId,
			targetType: 'user',
			targetId: BigInt(userId),
			action: 'reject_username_change_request',
			auditLogReason,
			metadata: new Map([['requested_username', request.requested_username]]),
		});
		return {applied: true};
	}

	async setPasswordResetOpen(
		userId: UserID,
		open: boolean,
		adminUserId: UserID,
		auditLogReason: string | null,
	): Promise<AdminPasswordResetModeResponse> {
		const {users: userRepository} = this.deps.apiContext.services;
		const user = await userRepository.findUnique(userId);
		if (!user) {
			throw new UnknownUserError();
		}
		const traits = user.traits;
		if (open) {
			traits.add(PASSWORD_RESET_OPEN_TRAIT);
		} else {
			traits.delete(PASSWORD_RESET_OPEN_TRAIT);
		}
		await userRepository.patchUpsert(userId, {traits: traits.size > 0 ? traits : null}, user.toRow());
		await this.deps.auditService.createAuditLog({
			adminUserId,
			targetType: 'user',
			targetId: BigInt(userId),
			action: open ? 'open_password_reset' : 'close_password_reset',
			auditLogReason,
			metadata: new Map(),
		});
		return {open};
	}

	private async afterUsernameChange(
		user: User,
		updatedUser: User,
		adminUserId: UserID,
		auditLogReason: string | null,
		action: string,
	): Promise<void> {
		const {contactChangeLog: contactChangeLogService} = this.deps.apiContext.services;
		await this.deps.updatePropagator.propagateUserUpdate({userId: user.id, oldUser: user, updatedUser});
		await contactChangeLogService.recordDiff({
			oldUser: user,
			newUser: updatedUser,
			reason: 'admin_action',
			actorUserId: adminUserId,
		});
		await this.deps.auditService.createAuditLog({
			adminUserId,
			targetType: 'user',
			targetId: BigInt(user.id),
			action,
			auditLogReason,
			metadata: new Map([
				['old_username', user.username],
				['new_username', updatedUser.username],
			]),
		});
		void this.reindexGuildMembersForUser(updatedUser);
	}

	async changeEmail(
		data: ChangeEmailRequest,
		adminUserId: UserID,
		auditLogReason: string | null,
		acls: ReadonlySet<string>,
	) {
		const {
			users: userRepository,
			cache: cacheService,
			contactChangeLog: contactChangeLogService,
		} = this.deps.apiContext.services;
		const {auditService, updatePropagator} = this.deps;
		const userId = createUserID(data.user_id);
		const user = await userRepository.findUnique(userId);
		if (!user) {
			throw new UnknownUserError();
		}
		const updatedUser = await userRepository.patchUpsert(
			userId,
			{
				email: data.email,
				email_verified: false,
			},
			user.toRow(),
		);
		await updatePropagator.propagateUserUpdate({userId, oldUser: user, updatedUser: updatedUser});
		await contactChangeLogService.recordDiff({
			oldUser: user,
			newUser: updatedUser,
			reason: 'admin_action',
			actorUserId: adminUserId,
		});
		await auditService.createAuditLog({
			adminUserId,
			targetType: 'user',
			targetId: BigInt(userId),
			action: 'change_email',
			auditLogReason,
			metadata: new Map([
				['old_email', user.email ?? 'null'],
				['new_email', data.email],
			]),
		});
		return {
			user: await mapUserToAdminResponse(updatedUser, cacheService, acls),
		};
	}

	private async reindexGuildMembersForUser(updatedUser: User): Promise<void> {
		try {
			const {users: userRepository} = this.deps.apiContext.services;
			const {guildRepository} = this.deps;
			const guildIds = await userRepository.getUserGuildIds(updatedUser.id);
			await this.searchIndexService.updateUserMembers(updatedUser, guildIds, guildRepository);
		} catch (error) {
			Logger.error(
				{userId: updatedUser.id.toString(), error},
				'Failed to reindex guild members after admin user update',
			);
		}
	}

	async changeDob(
		data: ChangeDobRequest,
		adminUserId: UserID,
		auditLogReason: string | null,
		acls: ReadonlySet<string>,
	) {
		const {users: userRepository, cache: cacheService} = this.deps.apiContext.services;
		const {auditService, updatePropagator} = this.deps;
		const userId = createUserID(data.user_id);
		const user = await userRepository.findUnique(userId);
		if (!user) {
			throw new UnknownUserError();
		}
		const updatedUser = await userRepository.patchUpsert(
			userId,
			{
				date_of_birth: types.LocalDate.fromString(data.date_of_birth),
			},
			user.toRow(),
		);
		await updatePropagator.propagateUserUpdate({userId, oldUser: user, updatedUser: updatedUser});
		await auditService.createAuditLog({
			adminUserId,
			targetType: 'user',
			targetId: BigInt(userId),
			action: 'change_dob',
			auditLogReason,
			metadata: new Map([
				['old_dob', user.dateOfBirth ?? 'null'],
				['new_dob', data.date_of_birth],
			]),
		});
		return {
			user: await mapUserToAdminResponse(updatedUser, cacheService, acls),
		};
	}
}
