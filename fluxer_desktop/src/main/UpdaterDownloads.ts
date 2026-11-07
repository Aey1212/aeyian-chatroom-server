// SPDX-License-Identifier: AGPL-3.0-or-later

import {BUILD_CHANNEL} from '@electron/common/BuildChannel';

export type UpdaterDownloadOption = {
	format: ManualDesktopFormat;
	label: string;
	url: string;
	suggestedName?: string;
	sha256?: string | null;
};

type DesktopDownloadArch = 'x64' | 'arm64';

function getDesktopDownloadArch(arch: NodeJS.Architecture): DesktopDownloadArch {
	return arch === 'arm64' ? 'arm64' : 'x64';
}

const DESKTOP_DOWNLOAD_ARCH = getDesktopDownloadArch(process.arch);
const UPDATE_API_ENDPOINT = BUILD_CHANNEL === 'canary' ? 'https://api.canary.fluxer.app' : 'https://api.fluxer.app';
// Upstream's manual-download API (macOS, portable and unmanaged Linux builds). Aeyian Chatline ships none of those:
// Windows updates through Velopack (VELOPACK_FEED_URL below) and Linux through its package.
export const UPDATE_BASE_URL = `${UPDATE_API_ENDPOINT}/dl/desktop/${BUILD_CHANNEL}/${process.platform}/${DESKTOP_DOWNLOAD_ARCH}`;
// Aeyian Chatline's Windows updates come from the fork's GitHub Releases: Velopack reads releases.win.json and the
// .nupkg next to it, and GitHub's /releases/latest/download/<file> serves them from the newest release.
const CHATLINE_RELEASES_URL = 'https://github.com/Aey1212/aeyian-chatroom-server/releases';
// Only for testing an update against a local feed, e.g. CHATLINE_UPDATE_URL=http://10.0.2.2:8000
const UPDATE_URL_OVERRIDE = process.env.CHATLINE_UPDATE_URL?.trim().replace(/\/+$/, '') || null;
export const VELOPACK_FEED_URL =
	UPDATE_URL_OVERRIDE ?? (BUILD_CHANNEL === 'canary' ? UPDATE_BASE_URL : `${CHATLINE_RELEASES_URL}/latest/download`);
// Aeyian Chatline's download page (roadmap A5).
export const DOWNLOAD_PAGE_URL =
	BUILD_CHANNEL === 'canary' ? 'https://canary.fluxer.app/download' : 'https://chat.aeyempire.com/launcher/';

export const MANUAL_DESKTOP_FORMATS = ['setup', 'dmg', 'zip', 'appimage', 'deb', 'rpm', 'tar_gz'] as const;

export type ManualDesktopFormat = (typeof MANUAL_DESKTOP_FORMATS)[number];
export type ManualLatestFile = {url: string; sha256: string | null};
type LinuxManualDesktopFormat = Extract<ManualDesktopFormat, 'appimage' | 'deb' | 'rpm' | 'tar_gz'>;

export type ManualLatestInfo = {
	version: string;
	pubDate: string | null;
	files: Partial<Record<ManualDesktopFormat, ManualLatestFile>>;
};

function getManualDownloadFormatPreference(): Array<ManualDesktopFormat> {
	if (process.platform === 'linux') {
		return ['appimage', 'deb', 'rpm', 'tar_gz'];
	}
	if (process.platform === 'darwin') {
		return ['dmg', 'zip'];
	}
	if (process.platform === 'win32') {
		return ['setup'];
	}
	return [];
}

const LINUX_MANUAL_FORMAT_LABELS: Record<LinuxManualDesktopFormat, string> = {
	appimage: 'AppImage',
	deb: 'DEB package',
	rpm: 'RPM package',
	tar_gz: 'tar.gz archive',
};

const LINUX_MANUAL_FORMAT_EXTENSIONS: Record<LinuxManualDesktopFormat, string> = {
	appimage: '.AppImage',
	deb: '.deb',
	rpm: '.rpm',
	tar_gz: '.tar.gz',
};

const LINUX_MANUAL_ARCH_TOKENS: Record<LinuxManualDesktopFormat, Record<DesktopDownloadArch, string>> = {
	appimage: {x64: 'x86_64', arm64: 'arm64'},
	deb: {x64: 'amd64', arm64: 'arm64'},
	rpm: {x64: 'x86_64', arm64: 'aarch64'},
	tar_gz: {x64: 'x64', arm64: 'arm64'},
};

function isLinuxManualDesktopFormat(format: ManualDesktopFormat): format is LinuxManualDesktopFormat {
	return format === 'appimage' || format === 'deb' || format === 'rpm' || format === 'tar_gz';
}

function buildManualVersionDownloadUrl(version: string, format: ManualDesktopFormat): string {
	return `${UPDATE_BASE_URL}/${version}/${format}`;
}

function getArtifactProductName(): string {
	return BUILD_CHANNEL === 'canary' ? 'Fluxer-Canary' : 'Fluxer';
}

function getManualUpdateSuggestedName(format: LinuxManualDesktopFormat, version: string): string {
	const archToken = LINUX_MANUAL_ARCH_TOKENS[format][DESKTOP_DOWNLOAD_ARCH];
	const extension = LINUX_MANUAL_FORMAT_EXTENSIONS[format];
	return `${getArtifactProductName()}-${version}-linux-${archToken}${extension}`;
}

export function getManualDownloadOptions(info: ManualLatestInfo): Array<UpdaterDownloadOption> {
	if (process.platform !== 'linux') {
		return [];
	}
	return getManualDownloadFormatPreference()
		.filter(isLinuxManualDesktopFormat)
		.map((format) => {
			const file = info.files[format];
			return {
				format,
				label: LINUX_MANUAL_FORMAT_LABELS[format],
				url: buildManualVersionDownloadUrl(info.version, format),
				suggestedName: getManualUpdateSuggestedName(format, info.version),
				sha256: file?.sha256 ?? null,
			};
		});
}

export function getManualDownloadUrl(info: ManualLatestInfo): string {
	const [preferredOption] = getManualDownloadOptions(info);
	if (preferredOption) {
		return preferredOption.url;
	}
	for (const format of getManualDownloadFormatPreference()) {
		const url = info.files[format]?.url;
		if (url) {
			return url;
		}
	}
	return DOWNLOAD_PAGE_URL;
}
