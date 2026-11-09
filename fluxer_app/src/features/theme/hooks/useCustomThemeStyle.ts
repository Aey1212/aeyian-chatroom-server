// SPDX-License-Identifier: AGPL-3.0-or-later

import {Logger} from '@app/features/platform/utils/AppLogger';
import {clearRemScaleCache} from '@app/features/theme/layout/RemFromPx';
import type {ThemeLibraryAsset, ThemeLibraryLocalFileReference} from '@app/features/theme/state/ThemeLibrary';
import {gateThemeCss} from '@app/features/theme/utils/ThemeCssUrlGate';
import {resolveThemeCssReferences} from '@app/features/theme/utils/ThemeCssUtils';
import {useEffect} from 'react';

const STYLE_ELEMENT_ID = 'fluxer-custom-theme-style';
const logger = new Logger('useCustomThemeStyle');

interface CustomThemeStyleOptions {
	enabledThemeCss: string | null | undefined;
	customThemeCss: string | null | undefined;
	themeLibraryAssets: ReadonlyArray<ThemeLibraryAsset>;
	themeLibraryLocalFiles: ReadonlyArray<ThemeLibraryLocalFileReference>;
	themeLibraryRevision: number;
	mediaEndpoint: string;
}

export function useCustomThemeStyle({
	enabledThemeCss,
	customThemeCss,
	themeLibraryAssets,
	themeLibraryLocalFiles,
	themeLibraryRevision,
	mediaEndpoint,
}: CustomThemeStyleOptions): void {
	useEffect(() => {
		const existing = document.getElementById(STYLE_ELEMENT_ID) as HTMLStyleElement | null;
		const css = [enabledThemeCss, customThemeCss]
			.map((value) => value?.trim() ?? '')
			.filter(Boolean)
			.join('\n\n');
		if (!css) {
			if (existing?.parentNode) {
				existing.parentNode.removeChild(existing);
				clearRemScaleCache();
			}
			return;
		}
		const styleElement = existing ?? document.createElement('style');
		const applyThemeCss = (value: string): void => {
			styleElement.textContent = value;
			clearRemScaleCache();
		};
		styleElement.id = STYLE_ELEMENT_ID;
		let disposed = false;
		let objectUrls: Array<string> = [];
		void resolveThemeCssReferences(css, themeLibraryAssets, themeLibraryLocalFiles)
			.then((resolved) => {
				if (disposed) {
					for (const objectUrl of resolved.objectUrls) {
						URL.revokeObjectURL(objectUrl);
					}
					return;
				}
				objectUrls = resolved.objectUrls;
				// Upstream Fluxer e58e75067 (#3761): only CSS that passed the URL gate reaches the page.
				const gated = gateThemeCss(resolved.css, {mediaEndpoint, objectUrls: new Set(resolved.objectUrls)});
				if (gated.blocked.length > 0) {
					logger.warn('Custom theme CSS links to files the app does not load', {blocked: gated.blocked});
				}
				if (gated.rejected) {
					logger.error('Custom theme CSS did not settle after filtering and was not applied');
				}
				applyThemeCss(gated.css);
				if (resolved.missingAssetReferences.length > 0 || resolved.missingLocalFileReferences.length > 0) {
					logger.warn('Custom theme CSS has unresolved file references', {
						assets: resolved.missingAssetReferences,
						localFiles: resolved.missingLocalFileReferences,
					});
				}
			})
			.catch((error) => {
				// Never fall back to the unfiltered CSS.
				logger.error('Failed to prepare custom theme CSS; none of it was applied', error);
				if (!disposed) applyThemeCss('');
			});
		if (!existing) {
			document.head.appendChild(styleElement);
		}
		return () => {
			disposed = true;
			for (const objectUrl of objectUrls) {
				URL.revokeObjectURL(objectUrl);
			}
		};
	}, [
		customThemeCss,
		enabledThemeCss,
		themeLibraryAssets,
		themeLibraryLocalFiles,
		themeLibraryRevision,
		mediaEndpoint,
	]);
}
