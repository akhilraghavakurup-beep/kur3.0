import * as FileSystem from 'expo-file-system/legacy';
import { installApk } from 'apk-installer';
import { getLogger } from '@/src/shared/services/logger';

const logger = getLogger('UpdateService');

// The raw package.json URL on your GitHub repository (CDN cached, no rate limits)
const REMOTE_PACKAGE_JSON_URL =
	'https://raw.githubusercontent.com/akhilraghavakurup-beep/kur3.0/main/package.json';

// Local version of the app from package.json
const LOCAL_VERSION = require('../../../package.json').version;

export interface UpdateInfo {
	readonly hasUpdate: boolean;
	readonly latestVersion: string;
	readonly downloadUrl: string;
}

/**
 * Checks if a newer version is available in the GitHub repository.
 */
export async function checkForUpdates(): Promise<UpdateInfo> {
	try {
		logger.debug(`Checking for updates... Local: ${LOCAL_VERSION}`);
		const response = await fetch(REMOTE_PACKAGE_JSON_URL, {
			headers: { 'Cache-Control': 'no-cache' },
		});
		if (!response.ok) {
			throw new Error(`Failed to fetch update metadata: ${response.status}`);
		}

		const data = (await response.json()) as { version: string };
		const latestVersion = data.version;
		logger.debug(`Remote version: ${latestVersion}`);

		const hasUpdate = isNewerVersion(latestVersion, LOCAL_VERSION);
		const downloadUrl = `https://github.com/akhilraghavakurup-beep/kur3.0/releases/download/v${latestVersion}/aria-${latestVersion}-release.apk`;

		return {
			hasUpdate,
			latestVersion,
			downloadUrl,
		};
	} catch (error) {
		logger.warn('Failed to check for app updates', error instanceof Error ? error : undefined);
		return {
			hasUpdate: false,
			latestVersion: LOCAL_VERSION,
			downloadUrl: '',
		};
	}
}

/**
 * Helper to download the update APK with progress tracking.
 */
export async function downloadUpdateApk(
	downloadUrl: string,
	onProgress: (progress: number) => void
): Promise<string> {
	try {
		const targetPath = `${FileSystem.cacheDirectory}aria-update.apk`;
		logger.debug(`Downloading update from: ${downloadUrl} to ${targetPath}`);

		const downloadResumable = FileSystem.createDownloadResumable(
			downloadUrl,
			targetPath,
			{},
			(progressData) => {
				const progress =
					progressData.totalBytesWritten / progressData.totalBytesExpectedToWrite;
				onProgress(isNaN(progress) ? 0 : progress);
			}
		);

		const result = await downloadResumable.downloadAsync();
		if (!result || !result.uri) {
			throw new Error('Download completed but URI is missing');
		}

		logger.debug(`Download complete: ${result.uri}`);
		return result.uri;
	} catch (error) {
		logger.error('Failed to download update APK', error instanceof Error ? error : undefined);
		throw error;
	}
}

/**
 * Triggers Android's package installer to install the downloaded APK.
 */
export async function triggerUpdateInstall(localFileUri: string): Promise<boolean> {
	try {
		logger.debug(`Triggering install for: ${localFileUri}`);
		return await installApk(localFileUri);
	} catch (error) {
		logger.error('Failed to launch APK installation', error instanceof Error ? error : undefined);
		throw error;
	}
}

/**
 * Returns true if remote version string is higher than local version string.
 */
function isNewerVersion(remote: string, local: string): boolean {
	const rParts = remote.split('.').map((p) => parseInt(p, 10) || 0);
	const lParts = local.split('.').map((p) => parseInt(p, 10) || 0);

	const maxLen = Math.max(rParts.length, lParts.length);
	for (let i = 0; i < maxLen; i++) {
		const r = rParts[i] ?? 0;
		const l = lParts[i] ?? 0;
		if (r > l) return true;
		if (r < l) return false;
	}

	return false;
}
