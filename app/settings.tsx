import { Platform, StyleSheet } from 'react-native';
import { useCallback, useState } from 'react';
import { router } from 'expo-router';
import { useShallow } from 'zustand/react/shallow';
import { ConfirmationDialog } from '@/src/components/ui/confirmation-dialog';
import { VersionDialog } from '@/src/components/ui/version-dialog';
import { PlayerAwareScrollView } from '@/src/components/ui/player-aware-scroll-view';
import { PageLayout } from '@/src/components/ui/page-layout';
import { SettingsItem } from '@/src/components/settings/settings-item';
import { SettingsSection } from '@/src/components/settings/settings-section';
import { SettingsSelect } from '@/src/components/settings/settings-select';
import { AccentColorPicker } from '@/src/components/settings/accent-color-picker';
import { ProgressStylePicker } from '@/src/components/settings/progress-style-picker';
import { TabOrderSetting } from '@/src/components/settings/tab-order-setting';
import { EqualizerSheet } from '@/src/components/settings/equalizer-sheet';
import { Switch } from 'react-native-paper';
import {
	TrashIcon,
	InfoIcon,
	PlugIcon,
	HardDriveIcon,
	FolderOpenIcon,
	SunMoonIcon,
	LayoutGridIcon,
	SlidersHorizontalIcon,
	MusicIcon,
	WifiOffIcon,
	RotateCcwIcon,
	MonitorPlayIcon,
	PaintbrushIcon,
	TagIcon,
} from 'lucide-react-native';
import {
	THEME_OPTIONS,
	DEFAULT_TAB_OPTIONS,
	PLAYER_BACKGROUND_OPTIONS,
	STREAM_QUALITY_OPTIONS,
} from '@/lib/settings-config';
import { useLibraryStore } from '@application/state/library-store';
import { useLibraryFilterStore } from '@application/state/library-filter-store';
import { useEqualizerStore } from '@application/state/equalizer-store';
import { useSettingsStore } from '@application/state/settings-store';
import { useDownloadQueue, formatFileSize } from '@/src/hooks/use-download-queue';
import { useEqualizer } from '@/src/hooks/use-equalizer';
import { useClearDownloads } from '@/src/hooks/use-clear-downloads';
import { useFactoryReset } from '@/src/hooks/use-factory-reset';
import { useToast } from '@/src/hooks/use-toast';
import { permissionService } from '@/src/application/services/permission-service';

export default function SettingsScreen() {
	const { tracks, playlists, favorites } = useLibraryStore(
		useShallow((state) => ({
			tracks: state.tracks,
			playlists: state.playlists,
			favorites: state.favorites,
		}))
	);

	const {
		themePreference,
		setThemePreference,
		defaultTab,
		setDefaultTab,
		accentColor,
		setAccentColor,
		openPlayerOnTrackClick,
		setOpenPlayerOnTrackClick,
		showProviderLabel,
		setShowProviderLabel,
		progressBarStyle,
		setProgressBarStyle,
		playerBackground,
		setPlayerBackground,
		preferredStreamQuality,
		setPreferredStreamQuality,
		autoplaySimilarOnQueueEnd,
		setAutoplaySimilarOnQueueEnd,
		downloadLocationMode,
		customDownloadDirectoryName,
		setCustomDownloadDirectory,
		resetDownloadLocation,
	} = useSettingsStore(
		useShallow((state) => ({
			themePreference: state.themePreference,
			setThemePreference: state.setThemePreference,
			defaultTab: state.defaultTab,
			setDefaultTab: state.setDefaultTab,
			accentColor: state.accentColor,
			setAccentColor: state.setAccentColor,
			openPlayerOnTrackClick: state.openPlayerOnTrackClick,
			setOpenPlayerOnTrackClick: state.setOpenPlayerOnTrackClick,
			showProviderLabel: state.showProviderLabel,
			setShowProviderLabel: state.setShowProviderLabel,
			progressBarStyle: state.progressBarStyle,
			setProgressBarStyle: state.setProgressBarStyle,
			playerBackground: state.playerBackground,
			setPlayerBackground: state.setPlayerBackground,
			preferredStreamQuality: state.preferredStreamQuality,
			setPreferredStreamQuality: state.setPreferredStreamQuality,
			autoplaySimilarOnQueueEnd: state.autoplaySimilarOnQueueEnd,
			setAutoplaySimilarOnQueueEnd: state.setAutoplaySimilarOnQueueEnd,
			downloadLocationMode: state.downloadLocationMode,
			customDownloadDirectoryName: state.customDownloadDirectoryName,
			setCustomDownloadDirectory: state.setCustomDownloadDirectory,
			resetDownloadLocation: state.resetDownloadLocation,
		}))
	);

	const { stats } = useDownloadQueue();
	const { isEnabled: eqEnabled, currentPreset } = useEqualizer();
	const { clearDownloads } = useClearDownloads();
	const { factoryReset } = useFactoryReset();

	const offlineMode = useLibraryFilterStore((s) => s.activeFilters.downloadedOnly);
	const toggleOfflineMode = useLibraryFilterStore((s) => s.toggleDownloadedOnly);

	const { success } = useToast();

	const [equalizerSheetOpen, setEqualizerSheetOpen] = useState(false);
	const [clearLibraryDialogVisible, setClearLibraryDialogVisible] = useState(false);
	const [clearDownloadsDialogVisible, setClearDownloadsDialogVisible] = useState(false);
	const [versionDialogVisible, setVersionDialogVisible] = useState(false);
	const [resetSettingsDialogVisible, setResetSettingsDialogVisible] = useState(false);
	const [resetEqualizerDialogVisible, setResetEqualizerDialogVisible] = useState(false);
	const [factoryResetDialogVisible, setFactoryResetDialogVisible] = useState(false);

	const openEqualizerSheet = useCallback(() => setEqualizerSheetOpen(true), []);
	const closeEqualizerSheet = useCallback(() => setEqualizerSheetOpen(false), []);

	const handleChangeDownloadLocation = useCallback(async () => {
		if (Platform.OS !== 'android') {
			success('Using app storage', 'Custom download folders are currently supported on Android only');
			return;
		}

		const result = await permissionService.requestDirectoryPermission();
		if (!result.success) return;

		setCustomDownloadDirectory(result.data.uri, result.data.name);
		success('Download folder updated', `New downloads will also be copied to ${result.data.name}`);
	}, [setCustomDownloadDirectory, success]);

	const handleUseMusicFolder = useCallback(() => {
		resetDownloadLocation();
		success('Download folder reset', 'New downloads will use the Music folder by default');
	}, [resetDownloadLocation, success]);

	const downloadLocationSubtitle =
		downloadLocationMode === 'custom' && customDownloadDirectoryName
			? `Custom folder: ${customDownloadDirectoryName}`
			: 'Default: Music folder';

	const appVersion = '3.0';

	return (
		<PageLayout header={{ title: 'Settings', showBack: true }}>
			<PlayerAwareScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>

				<SettingsSection title={'Appearance'}>
					<SettingsItem
						icon={TagIcon}
						title={'Show provider label'}
						subtitle={'Display the source plugin on tracks'}
						rightElement={
							<Switch value={showProviderLabel} onValueChange={setShowProviderLabel} />
						}
					/>
				</SettingsSection>

				<SettingsSection title={'Player'}>
					<SettingsItem
						icon={MonitorPlayIcon}
						title={'Open player on tap'}
						subtitle={'Automatically open the player when a track is tapped'}
						rightElement={
							<Switch value={openPlayerOnTrackClick} onValueChange={setOpenPlayerOnTrackClick} />
						}
					/>
				</SettingsSection>

				<SettingsSection title={'Playback'}>
					<SettingsItem
						icon={WifiOffIcon}
						title={'Offline mode'}
						subtitle={'Show only downloaded songs'}
						rightElement={
							<Switch value={offlineMode} onValueChange={toggleOfflineMode} />
						}
					/>
					<SettingsItem
						icon={MusicIcon}
						title={'Autoplay similar songs'}
						subtitle={'When queue ends, continue with recommended tracks'}
						rightElement={
							<Switch value={autoplaySimilarOnQueueEnd} onValueChange={setAutoplaySimilarOnQueueEnd} />
						}
					/>
				</SettingsSection>

			</PlayerAwareScrollView>

			<EqualizerSheet isOpen={equalizerSheetOpen} onClose={closeEqualizerSheet} />
		</PageLayout>
	);
}

const styles = StyleSheet.create({
	scrollView: {
		flex: 1,
		paddingHorizontal: 8,
	},
	scrollContent: {
		paddingBottom: 32,
	},
});