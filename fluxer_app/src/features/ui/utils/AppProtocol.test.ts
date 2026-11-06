// SPDX-License-Identifier: AGPL-3.0-or-later

import {startsWithUrl} from '@app/features/messaging/utils/markdown/parser/StringUtils';
import {convertToAsciiUrl, isValidUrl} from '@app/features/messaging/utils/markdown/parser/UrlUtils';
import {isUrlStart} from '@app/features/messaging/utils/markdown/UrlSpanUtils';
import {
	APP_PROTOCOL_PREFIX,
	appProtocolSchemeLengthAt,
	isAppProtocolScheme,
	isAppProtocolUrl,
} from '@app/features/ui/utils/AppProtocol';
import {describe, expect, test} from 'vitest';

describe('app link scheme', () => {
	test('new links use chatline://', () => {
		expect(APP_PROTOCOL_PREFIX).toBe('chatline://');
	});

	test('recognises chatline:// and the old fluxer:// links', () => {
		expect(isAppProtocolUrl('chatline://settings/user?tab=appearance')).toBe(true);
		expect(isAppProtocolUrl('CHATLINE://invite/abc')).toBe(true);
		expect(isAppProtocolUrl('fluxer://invite/abc')).toBe(true);
		expect(isAppProtocolScheme('chatline:')).toBe(true);
		expect(isAppProtocolScheme('fluxer:')).toBe(true);
	});

	test('rejects other schemes and bare scheme names', () => {
		expect(isAppProtocolUrl('https://chat.aeyempire.com')).toBe(false);
		expect(isAppProtocolUrl('chatline:')).toBe(false);
		expect(isAppProtocolUrl('chatlinex://invite/abc')).toBe(false);
		expect(isAppProtocolScheme('https:')).toBe(false);
	});

	test('measures the scheme at a position', () => {
		expect(appProtocolSchemeLengthAt('see chatline://dev', 4)).toBe('chatline:'.length);
		expect(appProtocolSchemeLengthAt('see fluxer://dev', 4)).toBe('fluxer:'.length);
		expect(appProtocolSchemeLengthAt('see https://dev', 4)).toBe(0);
	});
});

describe('app links inside messages', () => {
	test('autolink spans start at both schemes', () => {
		expect(isUrlStart('open chatline://settings/user?tab=appearance', 5)).toBe(true);
		expect(isUrlStart('open fluxer://settings/user?tab=appearance', 5)).toBe(true);
		expect(isUrlStart('open chatline: later', 5)).toBe(false);
	});

	test('the markdown parser sees both as links', () => {
		expect(startsWithUrl('chatline://invite/abc')).toBe(true);
		expect(startsWithUrl('fluxer://invite/abc')).toBe(true);
		expect(startsWithUrl('chatline:dev')).toBe(true);
		expect(startsWithUrl('chatline: hello')).toBe(false);
	});

	test('both are valid link targets and are left as they are', () => {
		expect(isValidUrl('chatline://invite/abc')).toBe(true);
		expect(isValidUrl('fluxer://invite/abc')).toBe(true);
		expect(convertToAsciiUrl('chatline://settings/user?tab=appearance')).toBe(
			'chatline://settings/user?tab=appearance',
		);
	});
});
