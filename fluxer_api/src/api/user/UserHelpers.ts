// SPDX-License-Identifier: AGPL-3.0-or-later

import {Config} from '@app/api/Config';
import type {UserRow} from '@app/api/database/types/UserTypes';
import {getCachedInstancePremiumMode} from '@app/api/limits/InstancePremiumModeCache';
import type {User} from '@app/api/models/User';
import {accountPolicyContactHasCapability} from '@app/api/risk/AccountPolicyService';
import {getCachedDeferredPhoneGateEnabled} from '@app/api/risk/DeferredPhoneGateCache';
import {
	DEFERRABLE_PHONE_FLAGS,
	DEFERRED_PHONE_ON_COMMUNITY_JOIN,
	DELETED_USER_GLOBAL_NAME,
	DELETED_USER_USERNAME,
	PremiumFlags,
	ProfileFieldPrivacyFlags,
	SuspiciousActivityFlags,
	UserFlags,
} from '@fluxer/constants/src/UserConstants';
import type {RequiredAction} from '@fluxer/schema/src/domains/user/UserResponseSchemas';
import {ms} from 'itty-time';

export function isDeletionComplete(user: Pick<User, 'flags' | 'pendingDeletionAt'>): boolean {
	return (user.flags & UserFlags.DELETED) !== 0n && user.pendingDeletionAt === null;
}

// Everything personal a user row can hold, cleared when a deletion completes. From upstream
// Fluxer (b01ce726c); the last five are this fork's own profile fields.
const FIELDS_CLEARED_ON_DELETION = [
	'email',
	'email_bounced',
	'password_hash',
	'password_last_changed_at',
	'totp_secret',
	'authenticator_types',
	'avatar_hash',
	'avatar_color',
	'banner_hash',
	'banner_color',
	'bio',
	'pronouns',
	'accent_color',
	'timezone',
	'date_of_birth',
	'locale',
	'premium_flags',
	'premium_type',
	'premium_since',
	'premium_until',
	'premium_gift_extension_ends_at',
	'premium_will_cancel',
	'premium_billing_cycle',
	'premium_lifetime_sequence',
	'premium_grace_ends_at',
	'stripe_subscription_id',
	'stripe_customer_id',
	'has_ever_purchased',
	'terms_agreed_at',
	'privacy_agreed_at',
	'last_active_at',
	'last_active_ip',
	'acls',
	'traits',
	'first_refund_at',
	'gift_inventory_server_seq',
	'gift_inventory_client_seq',
	'premium_onboarding_dismissed_at',
	'mention_flags',
	'last_voice_activity_sharing_change_at',
	'name_style',
	'theme_colors',
	'profile_frame',
	'avatar_frame',
	'nameplate',
] as const satisfies ReadonlyArray<keyof UserRow>;

/** The name and flags a user row takes once its deletion completes. */
export function deletedUserIdentity() {
	return {
		username: DELETED_USER_USERNAME,
		global_name: DELETED_USER_GLOBAL_NAME,
		email_verified: false,
		timezone_privacy_flags: ProfileFieldPrivacyFlags.EVERYONE,
		flags: UserFlags.DELETED,
	} satisfies Partial<UserRow>;
}

/** A patch setting every personal field this row still holds to null. */
export function personalFieldsToClear(row: UserRow): Partial<UserRow> {
	const patch: Partial<UserRow> = {};
	for (const field of FIELDS_CLEARED_ON_DELETION) {
		const value = row[field];
		if (!value || (value instanceof Set && value.size === 0) || (Array.isArray(value) && value.length === 0)) continue;
		patch[field] = null;
	}
	return patch;
}

type ClauseAction = Exclude<RequiredAction, 'REQUIRE_INBOUND_PHONE_VERIFICATION'>;
type VerificationChannel = 'email' | 'phone';

interface VerificationOption {
	readonly channel: VerificationChannel;
	readonly reverify: boolean;
}

interface RequiredActionClauseDefinition {
	readonly action: ClauseAction;
	readonly flag: number;
	readonly options: ReadonlyArray<VerificationOption>;
}

const REQUIRED_ACTION_CLAUSE_DEFINITIONS: ReadonlyArray<RequiredActionClauseDefinition> = [
	{
		action: 'REQUIRE_VERIFIED_EMAIL',
		flag: SuspiciousActivityFlags.REQUIRE_VERIFIED_EMAIL,
		options: [{channel: 'email', reverify: false}],
	},
	{
		action: 'REQUIRE_REVERIFIED_EMAIL',
		flag: SuspiciousActivityFlags.REQUIRE_REVERIFIED_EMAIL,
		options: [{channel: 'email', reverify: true}],
	},
	{
		action: 'REQUIRE_VERIFIED_PHONE',
		flag: SuspiciousActivityFlags.REQUIRE_VERIFIED_PHONE,
		options: [{channel: 'phone', reverify: false}],
	},
	{
		action: 'REQUIRE_REVERIFIED_PHONE',
		flag: SuspiciousActivityFlags.REQUIRE_REVERIFIED_PHONE,
		options: [{channel: 'phone', reverify: true}],
	},
	{
		action: 'REQUIRE_VERIFIED_EMAIL_OR_VERIFIED_PHONE',
		flag: SuspiciousActivityFlags.REQUIRE_VERIFIED_EMAIL_OR_VERIFIED_PHONE,
		options: [
			{channel: 'email', reverify: false},
			{channel: 'phone', reverify: false},
		],
	},
	{
		action: 'REQUIRE_REVERIFIED_EMAIL_OR_VERIFIED_PHONE',
		flag: SuspiciousActivityFlags.REQUIRE_REVERIFIED_EMAIL_OR_VERIFIED_PHONE,
		options: [
			{channel: 'email', reverify: true},
			{channel: 'phone', reverify: false},
		],
	},
	{
		action: 'REQUIRE_VERIFIED_EMAIL_OR_REVERIFIED_PHONE',
		flag: SuspiciousActivityFlags.REQUIRE_VERIFIED_EMAIL_OR_REVERIFIED_PHONE,
		options: [
			{channel: 'email', reverify: false},
			{channel: 'phone', reverify: true},
		],
	},
	{
		action: 'REQUIRE_REVERIFIED_EMAIL_OR_REVERIFIED_PHONE',
		flag: SuspiciousActivityFlags.REQUIRE_REVERIFIED_EMAIL_OR_REVERIFIED_PHONE,
		options: [
			{channel: 'email', reverify: true},
			{channel: 'phone', reverify: true},
		],
	},
];
const REQUIRED_ACTION_ORDER: ReadonlyArray<RequiredAction> = [
	...REQUIRED_ACTION_CLAUSE_DEFINITIONS.map((definition) => definition.action),
	'REQUIRE_INBOUND_PHONE_VERIFICATION',
];
const INBOUND_PHONE_VERIFICATION_FLAG = SuspiciousActivityFlags.REQUIRE_INBOUND_PHONE_VERIFICATION;

function optionImplies(option: VerificationOption, other: VerificationOption): boolean {
	if (option.channel !== other.channel) {
		return false;
	}
	return option.reverify === other.reverify || (option.reverify && !other.reverify);
}

function clauseImplies(clause: RequiredActionClauseDefinition, other: RequiredActionClauseDefinition): boolean {
	return clause.options.every((option) => other.options.some((candidate) => optionImplies(option, candidate)));
}

function isOptionSatisfiedAtRuntime(user: User, option: VerificationOption): boolean {
	if (option.reverify) {
		return false;
	}
	if (option.channel === 'email') {
		return !!user.email && !!user.emailVerified;
	}
	if (option.channel === 'phone') {
		return !!user.hasVerifiedPhone;
	}
	return false;
}

function buildRequiredActionClauses(flags: number): Array<RequiredActionClauseDefinition> {
	const clauses = REQUIRED_ACTION_CLAUSE_DEFINITIONS.filter((definition) => (flags & definition.flag) !== 0);
	if (
		(flags & INBOUND_PHONE_VERIFICATION_FLAG) !== 0 &&
		!clauses.some((clause) => clause.options.some((option) => option.channel === 'phone'))
	) {
		clauses.push(REQUIRED_ACTION_CLAUSE_DEFINITIONS[2]);
	}
	return clauses;
}

function getRequiredActionSortIndex(action: RequiredAction): number {
	const index = REQUIRED_ACTION_ORDER.indexOf(action);
	return index === -1 ? REQUIRED_ACTION_ORDER.length : index;
}

function suppressDeferredPhoneFlags(rawFlags: number): number {
	if ((rawFlags & DEFERRED_PHONE_ON_COMMUNITY_JOIN) === 0) {
		return rawFlags;
	}
	if (getCachedDeferredPhoneGateEnabled() === false) {
		return rawFlags & ~DEFERRED_PHONE_ON_COMMUNITY_JOIN;
	}
	return rawFlags & ~DEFERRABLE_PHONE_FLAGS;
}

export function getRequiredActions(user: User): ReadonlyArray<RequiredAction> {
	const flags = suppressDeferredPhoneFlags(user.suspiciousActivityFlags ?? 0);
	if (flags === 0) {
		return [];
	}
	if (!user.email) {
		return [];
	}
	if (accountPolicyContactHasCapability(user.email, 'required_actions_exempt')) {
		return [];
	}
	const activeClauses = buildRequiredActionClauses(flags).filter(
		(clause) => !clause.options.some((option) => isOptionSatisfiedAtRuntime(user, option)),
	);
	const simplifiedClauses = activeClauses.filter(
		(clause, clauseIndex, clauses) =>
			!clauses.some(
				(otherClause, otherClauseIndex) => otherClauseIndex !== clauseIndex && clauseImplies(otherClause, clause),
			),
	);
	const requiredActions: Array<RequiredAction> = simplifiedClauses.map((clause) => clause.action);
	const hasRemainingPhoneRequirement = simplifiedClauses.some((clause) =>
		clause.options.some((option) => option.channel === 'phone'),
	);
	if ((flags & INBOUND_PHONE_VERIFICATION_FLAG) !== 0 && hasRemainingPhoneRequirement) {
		requiredActions.push('REQUIRE_INBOUND_PHONE_VERIFICATION');
	}
	requiredActions.sort((left, right) => getRequiredActionSortIndex(left) - getRequiredActionSortIndex(right));
	return requiredActions;
}

export function getEffectiveSuspiciousFlags(user: User): number {
	let flags = 0;
	for (const action of getRequiredActions(user)) {
		flags |= SuspiciousActivityFlags[action];
	}
	return flags;
}

interface PremiumCheckable {
	isBot: boolean;
	premiumType: number | null;
	premiumUntil: Date | null;
	premiumGiftExtensionEndsAt: Date | null;
	premiumWillCancel: boolean;
	premiumGraceEndsAt: Date | null;
	flags: bigint;
	premiumFlags: number;
}

export const PREMIUM_GRACE_PERIOD_MS = ms('3 days');

export function getEffectivePremiumUntil(
	user: Pick<PremiumCheckable, 'premiumUntil' | 'premiumGiftExtensionEndsAt'>,
): Date | null {
	const subUntil = user.premiumUntil?.getTime() ?? null;
	const giftUntil = user.premiumGiftExtensionEndsAt?.getTime() ?? null;
	if (subUntil == null && giftUntil == null) {
		return null;
	}
	const effectiveMs = Math.max(subUntil ?? 0, giftUntil ?? 0);
	return new Date(effectiveMs);
}

export function checkHasActivePaidPremium(
	user: Pick<PremiumCheckable, 'premiumType' | 'premiumUntil' | 'premiumGiftExtensionEndsAt' | 'premiumGraceEndsAt'>,
): boolean {
	if (user.premiumType == null || user.premiumType <= 0) {
		return false;
	}
	const effective = getEffectivePremiumUntil(user);
	if (effective == null) {
		return true;
	}
	const nowMs = Date.now();
	const untilMs = effective.getTime();
	if (nowMs <= untilMs) {
		return true;
	}
	if (user.premiumGraceEndsAt != null) {
		return nowMs <= user.premiumGraceEndsAt.getTime();
	}
	return nowMs <= untilMs + PREMIUM_GRACE_PERIOD_MS;
}

export function checkIsPremium(user: PremiumCheckable): boolean {
	if (Config.instance.selfHosted && getCachedInstancePremiumMode() === 'everyone') {
		return true;
	}
	if (user.isBot) {
		return true;
	}
	if ((user.premiumFlags & PremiumFlags.PERKS_DISABLED) !== 0) {
		return false;
	}
	if ((user.premiumFlags & PremiumFlags.ENABLED_OVERRIDE) !== 0) {
		return true;
	}
	if (checkHasActivePaidPremium(user)) {
		return true;
	}
	return false;
}

const PREMIUM_CLEAR_FIELDS = [
	'premium_type',
	'premium_since',
	'premium_until',
	'premium_gift_extension_ends_at',
	'premium_will_cancel',
	'premium_billing_cycle',
	'premium_grace_ends_at',
] as const;

type PremiumClearField = (typeof PREMIUM_CLEAR_FIELDS)[number];

export function shouldStripExpiredPremium(user: PremiumCheckable): boolean {
	if ((user.premiumType ?? 0) <= 0) {
		return false;
	}
	return !checkHasActivePaidPremium(user);
}

function mapExpiredPremiumFields<T>(mapper: (field: PremiumClearField) => T): Record<PremiumClearField, T> {
	const result = {} as Record<PremiumClearField, T>;
	for (const field of PREMIUM_CLEAR_FIELDS) {
		result[field] = mapper(field);
	}
	return result;
}

export function createPremiumClearPatch(): Partial<UserRow> {
	return mapExpiredPremiumFields(() => null) as Partial<UserRow>;
}

const PROFILE_SUBSTRING_EXEMPT_FLAGS = UserFlags.STAFF;

export function isProfileSubstringExempt(user: Pick<PremiumCheckable, 'flags'>): boolean {
	return (user.flags & PROFILE_SUBSTRING_EXEMPT_FLAGS) !== 0n;
}

export function isBugHunterBotUser(user: Pick<User, 'flags' | 'isBot'>): boolean {
	return user.isBot && (user.flags & UserFlags.BUG_HUNTER) !== 0n;
}

export function canUseProfileTimezone(user: Pick<PremiumCheckable, 'flags'>): boolean {
	return (user.flags & UserFlags.STAFF) !== 0n;
}
