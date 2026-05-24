import type { Track } from '@domain/entities/track';
import type { Lyrics } from '../../../core/interfaces/metadata-provider';
import type { LyricsProvider, LyricsSearchParams } from '../../domain/lyrics-provider';
import type { AsyncResult } from '@shared/types/result';
import { ok, err } from '@shared/types/result';
import { getPluginRegistry } from '@plugins/core/registry/plugin-registry';
import { useSettingsStore } from '@application/state/settings-store';
import { createJioSaavnClient, JioSaavnClient } from '../../../metadata/jiosaavn/client';
import type { JioSaavnProvider } from '../../../metadata/jiosaavn/jiosaavn-provider';

export class JioSaavnLyricsProvider implements LyricsProvider {
	readonly id = 'jiosaavn';
	readonly name = 'JioSaavn Lyrics';
	readonly priority: number;

	private _defaultClient: JioSaavnClient | null = null;

	constructor(options: { priority?: number } = {}) {
		this.priority = options.priority ?? 5;
	}

	get enabled(): boolean {
		return useSettingsStore.getState().experimentalJioSaavnLyrics;
	}

	private _getClient(): JioSaavnClient {
		// Attempt to get client from the registered JioSaavn plugin to reuse configuration and cache
		try {
			const plugin = getPluginRegistry().getPlugin('jiosaavn') as JioSaavnProvider | undefined;
			if (plugin) {
				const config = (plugin as any).config;
				const baseUrl = config?.baseUrl ?? 'https://www.jiosaavn.com';
				return createJioSaavnClient({ baseUrl });
			}
		} catch {
			// Fallback
		}

		if (!this._defaultClient) {
			this._defaultClient = createJioSaavnClient({ baseUrl: 'https://www.jiosaavn.com' });
		}
		return this._defaultClient;
	}

	async searchLyrics(params: LyricsSearchParams): AsyncResult<Lyrics | null, Error> {
		const { track } = params;

		try {
			const client = this._getClient();
			let lyricsId = track.metadata?.lyricsId;
			let hasLyrics = track.metadata?.hasLyrics;

			// If we don't have the lyrics metadata cached in the Track, fetch full details from JioSaavn
			if (lyricsId === undefined || hasLyrics === undefined) {
				const songId = track.id.sourceId;
				const song = await client.getSong(songId);
				lyricsId = song.lyricsId;
				hasLyrics = song.hasLyrics;
			}

			if (!hasLyrics || !lyricsId) {
				return ok(null);
			}

			const result = await client.getLyrics(lyricsId);
			if (!result?.lyrics) {
				return ok(null);
			}

			const lyrics: Lyrics = {
				trackId: track.id,
				plainLyrics: result.lyrics,
				source: 'jiosaavn',
				attribution: 'Official lyrics provided by JioSaavn',
			};

			return ok(lyrics);
		} catch (error) {
			return err(error instanceof Error ? error : new Error(String(error)));
		}
	}

	canHandleTrack(track: Track): boolean {
		return track.id.sourceType === 'jiosaavn';
	}

	async isAvailable(): Promise<boolean> {
		try {
			const response = await fetch('https://www.jiosaavn.com/api.php?__call=lyrics.getLyrics', {
				method: 'HEAD',
			});
			return response.status !== 503;
		} catch {
			return false;
		}
	}
}

export function createJioSaavnProvider(options?: { priority?: number }): JioSaavnLyricsProvider {
	return new JioSaavnLyricsProvider(options);
}
