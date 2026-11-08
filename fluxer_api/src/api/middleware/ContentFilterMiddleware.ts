// SPDX-License-Identifier: AGPL-3.0-or-later

import {Logger} from '@app/api/Logger';
import {phraseBlocklistCache} from '@app/api/middleware/PhraseBlocklistCache';
import {binaryRequestBodyPaths} from '@app/api/middleware/RequestBodyBinaryFields';
import {isMultipartUploadRequest} from '@app/api/middleware/RequestBodyLimitMiddleware';
import {urlBlocklistCache} from '@app/api/middleware/UrlBlocklistCache';
import {readRequestJsonBody} from '@app/api/utils/RequestJsonBody';
import {extractUrlCandidates} from '@app/api/utils/UrlNormalizer';
import {ContentBlockedError} from '@fluxer/errors/src/domains/content/ContentBlockedError';
import {arrayItemBodyFieldPath, childBodyFieldPath} from '@fluxer/schema/src/primitives/Base64BinaryFields';
import {createMiddleware} from 'hono/factory';

const SKIP_FIELDS = new Set([
	'acls',
	'allow',
	'challenge',
	'channels',
	'content_type',
	'date_of_birth',
	'deny',
	'email_token',
	'encryption_key',
	'endpoint',
	'flags',
	'hashes',
	'id',
	'ids',
	'keys',
	'locale',
	'mfa_code',
	'new_password',
	'nonce',
	'old_endpoint',
	'original_proof',
	'password',
	'permission_overwrites',
	'permissions',
	'recipients',
	'response',
	'roles',
	'secret',
	'state',
	'ticket',
	'token',
	'traits',
	'upload_filename',
	'upload_id',
	'users',
	'verification_proof',
	'webauthn_challenge',
	'webauthn_response',
]);
const SKIP_FIELD_SUFFIXES = [
	'_challenge',
	'_flags',
	'_hash',
	'_hashes',
	'_id',
	'_ids',
	'_key',
	'_keys',
	'_proof',
	'_secret',
	'_token',
	'_tokens',
] as const;
const SKIP_CONTENT_FILTER_PATH_PARTS = [
	'/admin/blocklists/phrase/',
	'/auth/',
	'/oauth2/',
	'/reports/dsa/email/',
	'/users/@me/authorized-ips',
	'/users/@me/email-change/',
	'/users/@me/mfa/',
	'/users/@me/password-change/',
	'/users/@me/phone/',
	'/users/@me/sudo/',
	'/webhooks/',
] as const;

export function shouldSkipContentFilterPath(path: string): boolean {
	return SKIP_CONTENT_FILTER_PATH_PARTS.some((part) => path.includes(part));
}

// Upstream Fluxer c77978327 (#3863): base64 file fields are skipped by their exact body path, taken
// from the request schemas (withBase64Binary), instead of by name. Skipping by name missed base64
// fields with other names (entrance sound and soundboard audio) and exempted text fields that
// happened to share a name (embed image and thumbnail URLs).
function shouldSkipField(key: string, path: string): boolean {
	if (binaryRequestBodyPaths.has(path) || SKIP_FIELDS.has(key)) {
		return true;
	}
	return SKIP_FIELD_SUFFIXES.some((suffix) => key.endsWith(suffix));
}

export function extractStringValues(body: unknown, path = '', depth = 0): Array<string> {
	if (depth > 10) return [];
	const strings: Array<string> = [];
	if (typeof body === 'string') {
		strings.push(body);
	} else if (Array.isArray(body)) {
		const itemPath = arrayItemBodyFieldPath(path);
		for (const item of body) {
			strings.push(...extractStringValues(item, itemPath, depth + 1));
		}
	} else if (body && typeof body === 'object') {
		for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
			const fieldPath = childBodyFieldPath(path, key);
			if (shouldSkipField(key, fieldPath)) continue;
			if (typeof value === 'string' && value.length > 0) {
				strings.push(value);
			} else if (typeof value === 'object' && value !== null) {
				strings.push(...extractStringValues(value, fieldPath, depth + 1));
			}
		}
	}
	return strings;
}

const ContentFilterMiddleware = createMiddleware(async (ctx, next) => {
	const method = ctx.req.method;
	if (method !== 'POST' && method !== 'PUT' && method !== 'PATCH') {
		return next();
	}
	const path = ctx.req.path;
	if (shouldSkipContentFilterPath(path)) {
		return next();
	}
	// Only real file uploads on upload routes skip the JSON filter. A loose substring check let
	// `application/json; x=multipart/form-data` bodies through unfiltered (upstream 9dc6dfb52).
	if (isMultipartUploadRequest(ctx)) {
		return next();
	}
	const body = await readRequestJsonBody(ctx.req);
	if (!body.parsed) {
		return next();
	}
	const strings = extractStringValues(body.value);
	if (strings.length === 0) {
		return next();
	}
	const userId = ctx.get('user')?.id ?? null;
	for (const text of strings) {
		if (text.length < 3) continue;
		if (phraseBlocklistCache.containsBannedPhrase(text)) {
			Logger.warn(
				{surface: 'global_filter', userId: userId?.toString(), path},
				'content_moderation.block phrase match in request body',
			);
			throw new ContentBlockedError();
		}
		const urls = extractUrlCandidates(text);
		for (const url of urls) {
			if (urlBlocklistCache.isUrlOrDomainBanned(url)) {
				Logger.warn(
					{surface: 'global_filter', userId: userId?.toString(), path},
					'content_moderation.block url match in request body',
				);
				throw new ContentBlockedError();
			}
		}
	}
	return next();
});

export default ContentFilterMiddleware;
