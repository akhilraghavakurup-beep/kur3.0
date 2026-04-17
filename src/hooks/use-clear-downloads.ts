import { useCallback } from 'react';
import { useDownloadStore } from '@/src/application/state/download-store';
import { downloadService } from '@/src/application/services/download-service';
import { useToast } from '@/src/hooks/use-toast';

export function useClearDownloads() {
	const downloadedTracks = useDownloadStore((state) => state.getAllDownloadedTracks());
	const { success, error } = useToast();

	const clearDownloads = useCallback(async () => {
		for (const track of downloadedTracks) {
			const result = await downloadService.removeDownload(track.trackId);
			if (!result.success) {
				error('Failed to clear downloads', result.error.message);
				return false;
			}
		}

		success('Downloads cleared', 'All downloaded files have been removed');
		return true;
	}, [downloadedTracks, success, error]);

	return { clearDownloads };
}
