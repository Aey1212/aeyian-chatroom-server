// SPDX-License-Identifier: AGPL-3.0-or-later

import {resolveProfileDecoration} from '@app/features/user/profile_style/ProfileDecoration';
import {describe, expect, it} from 'vitest';

type Vars = Record<string, string | undefined>;

describe('resolveProfileDecoration', () => {
	it('keeps the plain accent border when there is no theme and no frame', () => {
		const decoration = resolveProfileDecoration({accentColor: '#4641d9'});
		expect(decoration.className).toBeUndefined();
		expect(decoration.style).toEqual({borderColor: '#4641d9'});
		expect(decoration.bannerColor).toBe('#4641d9');
	});

	it('paints a theme from the two colours and uses the top one behind the banner', () => {
		const decoration = resolveProfileDecoration({themeColors: [0x5865f2, 0xeb459e], accentColor: '#4641d9'});
		const vars = decoration.style as Vars;
		expect(vars['--profile-theme-top']).toBe('#5865f2');
		expect(vars['--profile-theme-bottom']).toBe('#eb459e');
		expect(decoration.bannerColor).toBe('#5865f2');
		expect(decoration.className).toBeTruthy();
	});

	it('ignores an unknown frame and a malformed theme', () => {
		const decoration = resolveProfileDecoration({
			themeColors: [0x123456],
			frame: 'lava-lamp',
			accentColor: '#4641d9',
		});
		expect(decoration.className).toBeUndefined();
	});

	it('decorates a frame without a theme and keeps the accent for the banner', () => {
		const decoration = resolveProfileDecoration({frame: 'gold', accentColor: '#4641d9'});
		expect(decoration.className).toBeTruthy();
		expect((decoration.style as Vars)['--pc-accent']).toBe('#4641d9');
		expect(decoration.bannerColor).toBe('#4641d9');
	});
});
