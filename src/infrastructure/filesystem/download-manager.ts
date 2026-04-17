import * as FileSystem from 'expo-file-system/legacy';
import { StorageAccessFramework } from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import type { Result } from '../../shared/types/result';
import { ok, err } from '../../shared/types/result';
import { getLogger } from '../../shared/services/logger';
import { permissionService } from '../../application/services/permission-service';
import type { DownloadLocationMode } from '../../application/state/settings-store';

const logger = getLogger('DownloadManager');

const DOWNLOADS_DIR = 'downloads/audio/';
const MIME_TYPES: Record<string, string> = {
	mp3: 'audio/mpeg',
	m4a: 'audio/mp4',
	aac: 'audio/aac',
	flac: 'audio/flac',
	wav: 'audio/wav',
	ogg: 'audio/ogg',
	opus: 'audio/ogg',
	m3u8: 'application/vnd.apple.mpegurl',
};

function getSafeTrackId(trackId: string): string {
	return trackId.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function getSafeFileName(name: string): string {
	const trimmed = name.trim();
	const sanitized = trimmed
		.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '')
		.replace(/\s+/g, ' ')
		.replace(/\.+$/g, '');

	return sanitized || 'Audio';
}

export async function getDownloadsDirectory(): Promise<string> {
	const dir = FileSystem.documentDirectory + DOWNLOADS_DIR;
	await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
	return dir;
}

export function getDownloadFilePath(trackId: string, format: string = 'm4a'): string {
	const safeTrackId = getSafeTrackId(trackId);
	return FileSystem.documentDirectory + DOWNLOADS_DIR + `${safeTrackId}.${format}`;
}

export type DownloadProgressCallback = (progress: number) => void;

export interface DownloadResult {
	filePath: string;
	fileSize: number;
}

export interface ExternalDownloadConfig {
	readonly mode: DownloadLocationMode;
	readonly customDirectoryUri?: string | null;
	readonly customDirectoryName?: string | null;
}

export interface ExternalDownloadResult {
	readonly filePath: string;
	readonly directoryName: string;
}

async function resolveExternalDirectory(
	config: ExternalDownloadConfig
): Promise<Result<{ uri: string; name: string }, Error>> {
	if (Platform.OS !== 'android') {
		return err(new Error('External download location is only supported on Android'));
	}

	if (config.mode === 'custom') {
		if (!config.customDirectoryUri) {
			return err(new Error('No custom download folder selected'));
		}

		return ok({
			uri: config.customDirectoryUri,
			name: config.customDirectoryName ?? 'Selected folder',
		});
	}

	return permissionService.requestMusicDirectoryPermission();
}

async function deleteExistingExternalFile(directoryUri: string, fileName: string): Promise<void> {
	const entries = await StorageAccessFramework.readDirectoryAsync(directoryUri);

	for (const entryUri of entries) {
		const decoded = decodeURIComponent(entryUri);
		if (decoded.endsWith(`/${fileName}`)) {
			await FileSystem.deleteAsync(entryUri, { idempotent: true }).catch(() => {});
		}
	}
}

export async function downloadAudioFile(
	url: string,
	trackId: string,
	onProgress?: DownloadProgressCallback,
	headers?: Record<string, string>,
	format: string = 'm4a'
): Promise<Result<DownloadResult, Error>> {
	try {
		await getDownloadsDirectory();

		const filePath = getDownloadFilePath(trackId, format);
		logger.debug(`Downloading to: ${filePath}`);
		logger.debug(`Using headers:`, JSON.stringify(headers ?? 'none'));

		const defaultHeaders: Record<string, string> = {
			Accept: '*/*',
			'User-Agent': 'Kur Music/0.0.1',
		};

		const finalHeaders = { ...defaultHeaders, ...headers };
		logger.debug('Final headers:', Object.keys(finalHeaders).join(', '));

		// First try with progress tracking using createDownloadResumable
		const downloadResumable = FileSystem.createDownloadResumable(
			url,
			filePath,
			{ headers: finalHeaders },
			(downloadProgress) => {
				const progress =
					downloadProgress.totalBytesExpectedToWrite > 0
						? Math.round(
								(downloadProgress.totalBytesWritten /
									downloadProgress.totalBytesExpectedToWrite) *
									100
							)
						: 0;
				onProgress?.(progress);
			}
		);

		let result = await downloadResumable.downloadAsync();

		// If resumable download fails, try simple downloadAsync as fallback
		if (!result || (result.status !== 200 && result.status !== 206)) {
			logger.debug('Resumable download failed, trying simple download...');
			await deleteAudioFile(filePath).catch(() => {});
			result = await FileSystem.downloadAsync(url, filePath, {
				headers: finalHeaders,
			});
		}

		if (!result) {
			return err(new Error('Download failed: no result returned'));
		}

		// Accept 200 (OK) and 206 (Partial Content for Range requests)
		if (result.status !== 200 && result.status !== 206) {
			logger.debug(`Download failed with HTTP status: ${result.status}`);
			await deleteAudioFile(filePath);
			return err(new Error(`Download failed with status: ${result.status}`));
		}

		const fileInfo = await FileSystem.getInfoAsync(filePath);
		if (!fileInfo.exists) {
			return err(new Error('Download failed: file not found after download'));
		}

		const fileSize = 'size' in fileInfo ? (fileInfo.size as number) : 0;

		if (fileSize < 10000) {
			await deleteAudioFile(filePath);
			return err(new Error('Download failed: file too small, likely corrupted'));
		}

		logger.debug(`Download complete: ${filePath} (${fileSize} bytes)`);

		return ok({
			filePath,
			fileSize,
		});
	} catch (error) {
		logger.error('Download error', error instanceof Error ? error : undefined);
		return err(error instanceof Error ? error : new Error(`Download failed: ${String(error)}`));
	}
}

export async function copyToDownloads(
	sourcePath: string,
	trackId: string,
	format: string = 'm4a'
): Promise<Result<DownloadResult, Error>> {
	try {
		await getDownloadsDirectory();
		const destPath = getDownloadFilePath(trackId, format);

		const normalizedSource = sourcePath.startsWith('file://')
			? sourcePath
			: `file://${sourcePath}`;

		const sourceInfo = await FileSystem.getInfoAsync(normalizedSource);
		if (!sourceInfo.exists) {
			return err(new Error('Source file not found'));
		}

		await FileSystem.copyAsync({ from: normalizedSource, to: destPath });

		const destInfo = await FileSystem.getInfoAsync(destPath);
		if (!destInfo.exists || !('size' in destInfo)) {
			return err(new Error('Failed to copy file to downloads'));
		}

		const fileSize = destInfo.size as number;
		logger.debug(`Copied to downloads: ${destPath} (${fileSize} bytes)`);

		return ok({ filePath: destPath, fileSize });
	} catch (error) {
		logger.error('Copy to downloads error', error instanceof Error ? error : undefined);
		return err(error instanceof Error ? error : new Error(`Copy failed: ${String(error)}`));
	}
}

export async function copyDirectoryToDownloads(
	sourceDir: string,
	trackId: string
): Promise<Result<DownloadResult, Error>> {
	try {
		await getDownloadsDirectory();
		const safeTrackId = getSafeTrackId(trackId);
		const destDir = FileSystem.documentDirectory + DOWNLOADS_DIR + `${safeTrackId}_hls/`;

		await FileSystem.makeDirectoryAsync(destDir, { intermediates: true }).catch(() => {});
		await FileSystem.copyAsync({ from: sourceDir, to: destDir });

		const manifestPath = destDir + 'playlist.m3u8';
		const manifestInfo = await FileSystem.getInfoAsync(manifestPath);
		if (!manifestInfo.exists) {
			return err(new Error('Failed to copy HLS directory: manifest not found'));
		}

		const files = await FileSystem.readDirectoryAsync(destDir);
		let totalSize = 0;
		for (const file of files) {
			const info = await FileSystem.getInfoAsync(destDir + file);
			if (info.exists && 'size' in info) {
				totalSize += info.size as number;
			}
		}

		logger.debug(`Copied HLS directory to downloads: ${destDir} (${totalSize} bytes)`);
		return ok({ filePath: manifestPath, fileSize: totalSize });
	} catch (error) {
		logger.error(
			'Copy directory to downloads error',
			error instanceof Error ? error : undefined
		);
		return err(
			error instanceof Error ? error : new Error(`Directory copy failed: ${String(error)}`)
		);
	}
}

export async function exportAudioToExternalDirectory(
	sourcePath: string,
	trackId: string,
	displayName: string,
	format: string,
	config: ExternalDownloadConfig
): Promise<Result<ExternalDownloadResult, Error>> {
	try {
		const resolvedDirectory = await resolveExternalDirectory(config);
		if (!resolvedDirectory.success) {
			return resolvedDirectory;
		}

		const baseFileName = getSafeFileName(displayName || getSafeTrackId(trackId));
		const fileName = `${baseFileName}.${format}`;
		await deleteExistingExternalFile(resolvedDirectory.data.uri, fileName);

		const sourceUri = sourcePath.startsWith('file://') ? sourcePath : `file://${sourcePath}`;
		const targetUri = await StorageAccessFramework.createFileAsync(
			resolvedDirectory.data.uri,
			baseFileName,
			MIME_TYPES[format] ?? 'audio/*'
		);
		const base64 = await FileSystem.readAsStringAsync(sourceUri, {
			encoding: FileSystem.EncodingType.Base64,
		});

		await FileSystem.writeAsStringAsync(targetUri, base64, {
			encoding: FileSystem.EncodingType.Base64,
		});

		logger.debug(`Exported download to external storage: ${targetUri}`);
		return ok({
			filePath: targetUri,
			directoryName: resolvedDirectory.data.name,
		});
	} catch (error) {
		logger.error(
			'Export to external directory error',
			error instanceof Error ? error : undefined
		);
		return err(
			error instanceof Error
				? error
				: new Error(`Failed to export download: ${String(error)}`)
		);
	}
}

export async function deleteDownloadDirectory(manifestPath: string): Promise<Result<void, Error>> {
	try {
		const dir = manifestPath.substring(0, manifestPath.lastIndexOf('/') + 1);
		await FileSystem.deleteAsync(dir, { idempotent: true });
		logger.debug(`Deleted download directory: ${dir}`);
		return ok(undefined);
	} catch (error) {
		logger.error('Delete directory error', error instanceof Error ? error : undefined);
		return err(
			error instanceof Error ? error : new Error(`Delete directory failed: ${String(error)}`)
		);
	}
}

export async function deleteAudioFile(filePath: string): Promise<Result<void, Error>> {
	try {
		await FileSystem.deleteAsync(filePath, { idempotent: true });
		logger.debug(`Deleted file: ${filePath}`);
		return ok(undefined);
	} catch (error) {
		logger.error('Delete error', error instanceof Error ? error : undefined);
		return err(error instanceof Error ? error : new Error(`Delete failed: ${String(error)}`));
	}
}

export async function getFileInfo(filePath: string): Promise<{ exists: boolean; size?: number }> {
	try {
		const info = await FileSystem.getInfoAsync(filePath);
		return {
			exists: info.exists,
			size: info.exists && 'size' in info ? (info.size as number) : undefined,
		};
	} catch {
		return { exists: false };
	}
}

async function getDirectorySize(dirPath: string): Promise<number> {
	const entries = await FileSystem.readDirectoryAsync(dirPath);
	let totalSize = 0;

	for (const entry of entries) {
		const entryPath = dirPath + entry;
		const info = await FileSystem.getInfoAsync(entryPath);
		if (!info.exists) continue;

		if (info.isDirectory) {
			totalSize += await getDirectorySize(entryPath + '/');
		} else if ('size' in info) {
			totalSize += info.size as number;
		}
	}

	return totalSize;
}

export async function getDownloadedFilesSize(): Promise<number> {
	try {
		const dir = await getDownloadsDirectory();
		return await getDirectorySize(dir);
	} catch {
		return 0;
	}
}

export async function clearAllDownloads(): Promise<Result<void, Error>> {
	try {
		const dir = FileSystem.documentDirectory + DOWNLOADS_DIR;
		await FileSystem.deleteAsync(dir, { idempotent: true });
		await getDownloadsDirectory();
		logger.debug('Cleared all downloads');
		return ok(undefined);
	} catch (error) {
		logger.error('Clear downloads error', error instanceof Error ? error : undefined);
		return err(
			error instanceof Error ? error : new Error(`Clear downloads failed: ${String(error)}`)
		);
	}
}
