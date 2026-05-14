/**
 * React Native Track Player Playback Service
 *
 * This service handles remote control events (lock screen, notification, headphone buttons).
 * Must be registered after the app component with TrackPlayer.registerPlaybackService().
 */

import TrackPlayer, { Event, State } from 'react-native-track-player';
import { getLogger } from '@shared/services/logger';
import { useSettingsStore } from '@/src/application/state/settings-store';
import { useHomeFeedStore } from '@/src/application/state/home-feed-store';

const logger = getLogger('RNTPPlaybackService');
const MIN_SEEK_POSITION = 0;

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
			let items: any[] = [];
			if (event.parentId === 'root') {
				items = [
					{ id: 'feed', title: 'Home Suggestions', subtitle: 'Personalized for you', playable: false, browsable: true },
					{ id: 'library', title: 'Library', subtitle: 'Playlists and Favorites', playable: false, browsable: true },
					{ id: 'queue', title: 'Playing Next', subtitle: 'View current queue', playable: false, browsable: true },
				];
			} else if (event.parentId === 'feed') {
				const { sections } = useHomeFeedStore.getState();
				items = sections.flatMap(s => 
					s.items.filter(item => item.type === 'track' || item.type === 'album').map(item => ({
						id: item.type === 'track' ? item.data.id.value : item.data.id.value,
						title: item.data.title,
						subtitle: item.type === 'track' ? item.data.artist : 'Album',
						playable: true,
						browsable: false,
					}))
				).slice(0, 30);
				
				if (items.length === 0) {
					items.push({ id: 'empty_feed', title: 'No suggestions found', subtitle: 'Open app to refresh', playable: false, browsable: false });
				}
			} else if (event.parentId === 'library') {
				items = [
					{ id: 'library_tracks', title: 'Favorite Songs', subtitle: 'Your liked music', playable: true, browsable: false },
				];
			}

			// Send results back to native side
			const { NativeModules } = require('react-native');
			if (NativeModules.TrackPlayerModule && NativeModules.TrackPlayerModule.setBrowseResults) {
				NativeModules.TrackPlayerModule.setBrowseResults(event.parentId, items);
			}
		} catch (error) {
			logger.error('RemoteBrowse error', error instanceof Error ? error : undefined);
			const { NativeModules } = require('react-native');
			if (NativeModules.TrackPlayerModule && NativeModules.TrackPlayerModule.setBrowseResults) {
				NativeModules.TrackPlayerModule.setBrowseResults(event.parentId, []);
			}
		}
	});

	// @ts-ignore - Custom event for Android Auto playback
	TrackPlayer.addEventListener('remote-play-id', async (event: { mediaId: string }) => {
		logger.debug(`RemotePlayId received: mediaId=${event.mediaId}`);
		// In a real app, we'd lookup this ID and play it.
		// For now, if it's already in the queue, we skip to it.
		const queue = await TrackPlayer.getQueue();
		const index = queue.findIndex(t => t.id === event.mediaId);
		if (index !== -1) {
			await TrackPlayer.skip(index);
			await TrackPlayer.play();
		}
	});

	// @ts-ignore - Custom event for Bluetooth/Headset connection
	TrackPlayer.addEventListener('remote-active', async (event: { device: string }) => {
		logger.debug(`RemoteActive received: device=${event.device}`);
		const { autoResumeOnBluetooth } = useSettingsStore.getState();
		if (autoResumeOnBluetooth) {
			const status = await TrackPlayer.getPlaybackState();
			// @ts-ignore - state might be in status or status.state depending on version
			const currentState = status.state || status;
			if (currentState === State.Paused || currentState === State.Ready) {
				logger.info(`Auto-resuming playback on ${event.device} connection`);
				await TrackPlayer.play();
			}
		}
	});

	logger.debug('PlaybackService initialized - all remote control handlers registered');
}
