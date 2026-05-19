/**
 * React Native Track Player Playback Service
 *
 * This service handles remote control events (lock screen, notification, headphone buttons).
 * Must be registered after the app component with TrackPlayer.registerPlaybackService().
 */

import TrackPlayer, { Event } from 'react-native-track-player';
import { getLogger } from '@shared/services/logger';
import { useHomeFeedStore } from '@/src/application/state/home-feed-store';
import { getArtistNames } from '@/src/domain/entities/track';

const logger = getLogger('RNTPPlaybackService');
const MIN_SEEK_POSITION = 0;
const ANDROID_AUTO_TRACK_ID_PREFIX = 'android_auto_track:';

interface AndroidAutoBrowseItem {
	readonly id: string;
	readonly title: string;
	readonly subtitle: string;
	readonly playable: boolean;
	readonly browsable: boolean;
}

export async function PlaybackService(): Promise<void> {
	logger.debug('PlaybackService initializing - registering remote control handlers');

	TrackPlayer.addEventListener(Event.RemotePlay, () => {
		logger.debug('RemotePlay received (service)');
		TrackPlayer.play();
	});

	TrackPlayer.addEventListener(Event.RemotePause, () => {
		logger.debug('RemotePause received (service)');
		TrackPlayer.pause();
	});

	TrackPlayer.addEventListener(Event.RemoteStop, () => {
		logger.debug('RemoteStop received (service)');
		TrackPlayer.stop();
	});

	TrackPlayer.addEventListener(Event.RemoteNext, () => {
		logger.debug('RemoteNext received (service)');
		// Skip handled by main app event handler - uses app queue instead of native queue
	});

	TrackPlayer.addEventListener(Event.RemotePrevious, () => {
		logger.debug('RemotePrevious received (service)');
		// Skip handled by main app event handler - uses app queue instead of native queue
	});

	TrackPlayer.addEventListener(Event.RemoteSeek, (event) => {
		logger.debug(`RemoteSeek received (service): position=${event.position}`);
		TrackPlayer.seekTo(event.position);
	});

	TrackPlayer.addEventListener(Event.RemoteJumpForward, async (event) => {
		logger.debug(`RemoteJumpForward received (service): interval=${event.interval}`);
		const position = await TrackPlayer.getPosition();
		await TrackPlayer.seekTo(position + event.interval);
	});

	TrackPlayer.addEventListener(Event.RemoteJumpBackward, async (event) => {
		logger.debug(`RemoteJumpBackward received (service): interval=${event.interval}`);
		const position = await TrackPlayer.getPosition();
		await TrackPlayer.seekTo(Math.max(MIN_SEEK_POSITION, position - event.interval));
	});

	// @ts-ignore - Custom event for Android Auto browsing
	TrackPlayer.addEventListener('remote-browse', async (event: { parentId: string }) => {
		logger.debug(`RemoteBrowse received: parentId=${event.parentId}`);

		try {
			let items: AndroidAutoBrowseItem[] = [];
			if (event.parentId === 'root') {
				items = [
					{
						id: 'feed',
						title: 'Home Suggestions',
						subtitle: 'Personalized for you',
						playable: false,
						browsable: true,
					},
					{
						id: 'library',
						title: 'Library',
						subtitle: 'Playlists and Favorites',
						playable: false,
						browsable: true,
					},
					{
						id: 'queue',
						title: 'Playing Next',
						subtitle: 'View current queue',
						playable: false,
						browsable: true,
					},
				];
			} else if (event.parentId === 'feed') {
				const { sections } = useHomeFeedStore.getState();
				items = sections
					.flatMap((section) =>
						section.items.flatMap((item): AndroidAutoBrowseItem[] => {
							if (item.type === 'track') {
								return [
									{
										id: item.data.id.value,
										title: item.data.title,
										subtitle: getArtistNames(item.data),
										playable: true,
										browsable: false,
									},
								];
							}
							if (item.type === 'album') {
								return [
									{
										id: item.data.id.value,
										title: item.data.name,
										subtitle:
											item.data.artists
												.map((artist) => artist.name)
												.join(', ') || 'Album',
										playable: true,
										browsable: false,
									},
								];
							}
							return [];
						})
					)
					.slice(0, 30);

				if (items.length === 0) {
					items.push({
						id: 'empty_feed',
						title: 'No suggestions found',
						subtitle: 'Open app to refresh',
						playable: false,
						browsable: false,
					});
				}
			} else if (event.parentId === 'library') {
				items = [
					{
						id: 'library_tracks',
						title: 'Favorite Songs',
						subtitle: 'Your liked music',
						playable: true,
						browsable: false,
					},
				];
			}

			// Send results back to native side
			const { NativeModules } = require('react-native');
			if (
				NativeModules.TrackPlayerModule &&
				NativeModules.TrackPlayerModule.setBrowseResults
			) {
				NativeModules.TrackPlayerModule.setBrowseResults(event.parentId, items);
			}
		} catch (error) {
			logger.error('RemoteBrowse error', error instanceof Error ? error : undefined);
			const { NativeModules } = require('react-native');
			if (
				NativeModules.TrackPlayerModule &&
				NativeModules.TrackPlayerModule.setBrowseResults
			) {
				NativeModules.TrackPlayerModule.setBrowseResults(event.parentId, []);
			}
		}
	});

	// @ts-ignore - Custom event for Android Auto playback
	TrackPlayer.addEventListener('remote-play-id', async (event: { mediaId: string }) => {
		logger.debug(`RemotePlayId received: mediaId=${event.mediaId}`);
		const queue = await TrackPlayer.getQueue();
		const androidAutoIndex = event.mediaId.startsWith(ANDROID_AUTO_TRACK_ID_PREFIX)
			? Number.parseInt(event.mediaId.slice(ANDROID_AUTO_TRACK_ID_PREFIX.length), 10)
			: Number.NaN;
		const index = Number.isInteger(androidAutoIndex)
			? androidAutoIndex
			: queue.findIndex((t) => t.id === event.mediaId);
		if (index >= 0 && index < queue.length) {
			await TrackPlayer.skip(index);
			await TrackPlayer.play();
		}
	});

	// @ts-ignore - Custom event for Bluetooth/Headset connection
	TrackPlayer.addEventListener('remote-active', async (event: { device: string }) => {
		logger.debug(`RemoteActive received: device=${event.device}`);
	});

	logger.debug('PlaybackService initialized - all remote control handlers registered');
}
