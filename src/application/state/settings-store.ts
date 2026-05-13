import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StreamQuality } from '@/src/domain/value-objects/audio-source';

export type ThemePreference = 'system' | 'light' | 'dark';
export type TabId = 'feed' | 'library' | 'downloads' | 'search';
export type DefaultTab = TabId;
export type LibraryTabId = 'songs' | 'playlists' | 'artists' | 'albums';
export type ProgressBarStyle =
	| 'expressive'
	| 'expressive-variant'
	| 'basic'
	| 'waveform'
	| 'beats'
	| 'glow-line'
	| 'pulse-dots';
export type PlayerBackground = 'artwork-blur' | 'artwork-solid' | 'theme-color';
export type DownloadLocationMode = 'music' | 'custom';
export type UIStyle = 'clean' | 'glow-flow' | 'glass' | 'bold' | 'neo';
export type HomeContentPreference =
	| 'Malayalam'
	| 'Tamil'
	| 'Telugu'
	| 'English'
	| 'Kannada'
	| 'Punjabi'
	| 'Marathi'
	| 'Bengali'
	| 'Gujarati';
export type HomeFeedPrioritySection =
	| 'trending-now'
	| 'top-charts'
	| 'new-releases'
	| 'hot-in-thiruvananthapuram'
	| 'editorial-picks'
	| 'radio-stations'
	| 'recommended-artist-stations'
	| 'fresh-hits';

export const DEFAULT_HOME_CONTENT_PREFERENCES: HomeContentPreference[] = [
	'Malayalam',
	'Tamil',
];
export const DEFAULT_HOME_FEED_PRIORITY: HomeFeedPrioritySection[] = [
	'trending-now',
	'top-charts',
	'new-releases',
	'hot-in-thiruvananthapuram',
	'editorial-picks',
	'radio-stations',
	'recommended-artist-stations',
	'fresh-hits',
];

export const DEFAULT_TAB_ORDER: TabId[] = ['feed', 'library', 'search', 'downloads'];
export const DEFAULT_ENABLED_TABS: TabId[] = ['feed', 'library', 'search', 'downloads'];
export const REQUIRED_TABS: TabId[] = [];

interface SettingsState {
	themePreference: ThemePreference;
	defaultTab: DefaultTab;
	homeContentPreferences: HomeContentPreference[];
	homeFeedPriority: HomeFeedPrioritySection[];
	defaultLibraryTab: LibraryTabId;
	accentColor: string | null;
	tabOrder: TabId[];
	enabledTabs: TabId[];
	openPlayerOnTrackClick: boolean;
	showProviderLabel: boolean;
	progressBarStyle: ProgressBarStyle;
	playerBackground: PlayerBackground;
	uiStyle: UIStyle;
	preferredStreamQuality: StreamQuality;
	autoplaySimilarOnQueueEnd: boolean;
	downloadLocationMode: DownloadLocationMode;
	musicDownloadDirectoryUri: string | null;
	musicDownloadDirectoryName: string | null;
	customDownloadDirectoryUri: string | null;
	customDownloadDirectoryName: string | null;

	setThemePreference: (preference: ThemePreference) => void;
	setDefaultTab: (tab: DefaultTab) => void;
	setHomeContentPreferences: (preferences: HomeContentPreference[]) => void;
	toggleHomeContentPreference: (preference: HomeContentPreference) => void;
	resetHomeContentPreferences: () => void;
	setHomeFeedPriority: (priority: HomeFeedPrioritySection[]) => void;
	moveHomeFeedPriorityUp: (section: HomeFeedPrioritySection) => void;
	moveHomeFeedPriorityDown: (section: HomeFeedPrioritySection) => void;
	resetHomeFeedPriority: () => void;
	setDefaultLibraryTab: (tab: LibraryTabId) => void;
	setAccentColor: (color: string | null) => void;
	setTabOrder: (order: TabId[]) => void;
	resetTabOrder: () => void;
	setEnabledTabs: (tabs: TabId[]) => void;
	toggleTab: (tabId: TabId) => void;
	resetEnabledTabs: () => void;
	setOpenPlayerOnTrackClick: (enabled: boolean) => void;
	setShowProviderLabel: (enabled: boolean) => void;
	setProgressBarStyle: (style: ProgressBarStyle) => void;
	setPlayerBackground: (background: PlayerBackground) => void;
	setUIStyle: (style: UIStyle) => void;
	setPreferredStreamQuality: (quality: StreamQuality) => void;
	setAutoplaySimilarOnQueueEnd: (enabled: boolean) => void;
	setDownloadLocationMode: (mode: DownloadLocationMode) => void;
	setMusicDownloadDirectory: (uri: string, name: string) => void;
	setCustomDownloadDirectory: (uri: string, name: string) => void;
	resetDownloadLocation: () => void;
	resetAllSettings: () => void;
}

const customStorage = {
	getItem: async (name: string): Promise<string | null> => {
		return AsyncStorage.getItem(name);
	},
	setItem: async (name: string, value: string): Promise<void> => {
		await AsyncStorage.setItem(name, value);
	},
	removeItem: async (name: string): Promise<void> => {
		await AsyncStorage.removeItem(name);
	},
};

let resolveHydration: (() => void) | null = null;
const hydrationPromise = new Promise<void>((resolve) => {
	resolveHydration = resolve;
});

export const useSettingsStore = create<SettingsState>()(
	persist(
		(set, get) => ({
			themePreference: 'system',
			defaultTab: 'feed',
			homeContentPreferences: DEFAULT_HOME_CONTENT_PREFERENCES,
			homeFeedPriority: DEFAULT_HOME_FEED_PRIORITY,
			defaultLibraryTab: 'songs',
			accentColor: '#7C3AED',
			tabOrder: DEFAULT_TAB_ORDER,
			enabledTabs: DEFAULT_ENABLED_TABS,
			openPlayerOnTrackClick: false,
			showProviderLabel: true,
			progressBarStyle: 'expressive',
			playerBackground: 'artwork-blur',
			uiStyle: 'neo',
			preferredStreamQuality: 'high',
			autoplaySimilarOnQueueEnd: true,
			downloadLocationMode: 'music',
			musicDownloadDirectoryUri: null,
			musicDownloadDirectoryName: null,
			customDownloadDirectoryUri: null,
			customDownloadDirectoryName: null,

			setThemePreference: (preference: ThemePreference) => {
				set({ themePreference: preference });
			},
			setDefaultTab: (tab: DefaultTab) => {
				set({ defaultTab: tab });
			},
			setHomeContentPreferences: (preferences: HomeContentPreference[]) => {
				const normalized = Array.from(new Set(preferences));
				set({
					homeContentPreferences:
						normalized.length > 0 ? normalized : DEFAULT_HOME_CONTENT_PREFERENCES,
				});
			},
			toggleHomeContentPreference: (preference: HomeContentPreference) => {
				const { homeContentPreferences } = get();
				const nextPreferences = homeContentPreferences.includes(preference)
					? homeContentPreferences.filter((item) => item !== preference)
					: [...homeContentPreferences, preference];

				set({
					homeContentPreferences:
						nextPreferences.length > 0 ? nextPreferences : DEFAULT_HOME_CONTENT_PREFERENCES,
				});
			},
			resetHomeContentPreferences: () => {
				set({ homeContentPreferences: DEFAULT_HOME_CONTENT_PREFERENCES });
			},
			setHomeFeedPriority: (priority: HomeFeedPrioritySection[]) => {
				const next = priority.filter(
					(section, index, array) => array.indexOf(section) === index
				);
				set({
					homeFeedPriority:
						next.length === DEFAULT_HOME_FEED_PRIORITY.length
							? next
							: DEFAULT_HOME_FEED_PRIORITY,
				});
			},
			moveHomeFeedPriorityUp: (section: HomeFeedPrioritySection) => {
				const current = [...get().homeFeedPriority];
				const index = current.indexOf(section);
				if (index <= 0) {
					return;
				}
				[current[index - 1], current[index]] = [current[index], current[index - 1]];
				set({ homeFeedPriority: current });
			},
			moveHomeFeedPriorityDown: (section: HomeFeedPrioritySection) => {
				const current = [...get().homeFeedPriority];
				const index = current.indexOf(section);
				if (index === -1 || index >= current.length - 1) {
					return;
				}
				[current[index], current[index + 1]] = [current[index + 1], current[index]];
				set({ homeFeedPriority: current });
			},
			resetHomeFeedPriority: () => {
				set({ homeFeedPriority: DEFAULT_HOME_FEED_PRIORITY });
			},
			setDefaultLibraryTab: (tab: LibraryTabId) => {
				set({ defaultLibraryTab: tab });
			},
			setAccentColor: (color: string | null) => {
				set({ accentColor: color });
			},
			setTabOrder: (order: TabId[]) => {
				set({ tabOrder: order });
			},
			resetTabOrder: () => {
				set({ tabOrder: DEFAULT_TAB_ORDER });
			},
			setEnabledTabs: (tabs: TabId[]) => {
				const withRequired = Array.from(new Set([...tabs, ...REQUIRED_TABS]));
				set({ enabledTabs: withRequired });
			},
			toggleTab: (tabId: TabId) => {
				if (REQUIRED_TABS.includes(tabId)) return;
				const { enabledTabs, defaultTab } = get();
				const isEnabled = enabledTabs.includes(tabId);
				if (isEnabled) {
					const newEnabledTabs = enabledTabs.filter((id) => id !== tabId);
					const updates: Partial<SettingsState> = { enabledTabs: newEnabledTabs };
					if (defaultTab === tabId) {
						updates.defaultTab = newEnabledTabs[0];
					}
					set(updates);
				} else {
					set({ enabledTabs: [...enabledTabs, tabId] });
				}
			},
			resetEnabledTabs: () => {
				set({ enabledTabs: DEFAULT_ENABLED_TABS });
			},
			setOpenPlayerOnTrackClick: (enabled: boolean) => {
				set({ openPlayerOnTrackClick: enabled });
			},
			setShowProviderLabel: (enabled: boolean) => {
				set({ showProviderLabel: enabled });
			},
			setProgressBarStyle: (style: ProgressBarStyle) => {
				set({ progressBarStyle: style });
			},
			setPlayerBackground: (background: PlayerBackground) => {
				set({ playerBackground: background });
			},
			setUIStyle: (style: UIStyle) => {
				set({ uiStyle: style });
			},
			setPreferredStreamQuality: (quality: StreamQuality) => {
				set({ preferredStreamQuality: quality });
			},
			setAutoplaySimilarOnQueueEnd: (enabled: boolean) => {
				set({ autoplaySimilarOnQueueEnd: enabled });
			},
			setDownloadLocationMode: (mode: DownloadLocationMode) => {
				set({ downloadLocationMode: mode });
			},
			setMusicDownloadDirectory: (uri: string, name: string) => {
				set({
					downloadLocationMode: 'music',
					musicDownloadDirectoryUri: uri,
					musicDownloadDirectoryName: name,
				});
			},
			setCustomDownloadDirectory: (uri: string, name: string) => {
				set({
					downloadLocationMode: 'custom',
					customDownloadDirectoryUri: uri,
					customDownloadDirectoryName: name,
				});
			},
			resetDownloadLocation: () => {
				set({
					downloadLocationMode: 'music',
					customDownloadDirectoryUri: null,
					customDownloadDirectoryName: null,
				});
			},
			resetAllSettings: () => {
				set({
					themePreference: 'system',
					defaultTab: 'feed',
					homeContentPreferences: DEFAULT_HOME_CONTENT_PREFERENCES,
					homeFeedPriority: DEFAULT_HOME_FEED_PRIORITY,
					defaultLibraryTab: 'songs',
					accentColor: '#7C3AED',
					tabOrder: DEFAULT_TAB_ORDER,
					enabledTabs: DEFAULT_ENABLED_TABS,
					openPlayerOnTrackClick: false,
					showProviderLabel: true,
					progressBarStyle: 'expressive',
					playerBackground: 'artwork-blur',
					uiStyle: 'neo',
					preferredStreamQuality: 'high',
					autoplaySimilarOnQueueEnd: true,
					downloadLocationMode: 'music',
					musicDownloadDirectoryUri: null,
					musicDownloadDirectoryName: null,
					customDownloadDirectoryUri: null,
					customDownloadDirectoryName: null,
				});
			},
		}),
		{
			name: 'aria-settings-storage',
			version: 4,
			storage: createJSONStorage(() => customStorage),
			onRehydrateStorage: () => {
				return () => {
					resolveHydration?.();
				};
			},
			migrate: (persistedState) => {
				const state = persistedState as Partial<SettingsState> | undefined;
				const nextHomeContentPreferences = state?.homeContentPreferences?.filter(
					(preference) =>
						preference !== 'Hindi' &&
						preference !== 'Bollywood' &&
						preference !== 'All languages'
				);
				return {
					...state,
					accentColor: state?.accentColor ?? '#7C3AED',
					uiStyle: state?.uiStyle ?? 'neo',
					homeContentPreferences:
						nextHomeContentPreferences && nextHomeContentPreferences.length > 0
							? nextHomeContentPreferences
							: DEFAULT_HOME_CONTENT_PREFERENCES,
				};
			},
		}
	)
);

export const useThemePreference = () => useSettingsStore((state) => state.themePreference);

export const useSetThemePreference = () => useSettingsStore((state) => state.setThemePreference);

export const useDefaultTab = () => useSettingsStore((state) => state.defaultTab);

export const useSetDefaultTab = () => useSettingsStore((state) => state.setDefaultTab);

export const useHomeContentPreferences = () =>
	useSettingsStore((state) => state.homeContentPreferences);

export const useHomeFeedPriority = () => useSettingsStore((state) => state.homeFeedPriority);

export const useSetHomeContentPreferences = () =>
	useSettingsStore((state) => state.setHomeContentPreferences);

export const useToggleHomeContentPreference = () =>
	useSettingsStore((state) => state.toggleHomeContentPreference);

export const useResetHomeContentPreferences = () =>
	useSettingsStore((state) => state.resetHomeContentPreferences);

export const useMoveHomeFeedPriorityUp = () =>
	useSettingsStore((state) => state.moveHomeFeedPriorityUp);

export const useMoveHomeFeedPriorityDown = () =>
	useSettingsStore((state) => state.moveHomeFeedPriorityDown);

export const useResetHomeFeedPriority = () =>
	useSettingsStore((state) => state.resetHomeFeedPriority);

export const useAccentColor = () => useSettingsStore((state) => state.accentColor);

export const useSetAccentColor = () => useSettingsStore((state) => state.setAccentColor);

export const useTabOrder = () => useSettingsStore((state) => state.tabOrder);

export const useSetTabOrder = () => useSettingsStore((state) => state.setTabOrder);

export const useResetTabOrder = () => useSettingsStore((state) => state.resetTabOrder);

export const useEnabledTabs = () => useSettingsStore((state) => state.enabledTabs);

export const useSetEnabledTabs = () => useSettingsStore((state) => state.setEnabledTabs);

export const useToggleTab = () => useSettingsStore((state) => state.toggleTab);

export const useResetEnabledTabs = () => useSettingsStore((state) => state.resetEnabledTabs);

export const useResetAllSettings = () => useSettingsStore((state) => state.resetAllSettings);

export const useDefaultLibraryTab = () => useSettingsStore((state) => state.defaultLibraryTab);

export const useSetDefaultLibraryTab = () =>
	useSettingsStore((state) => state.setDefaultLibraryTab);

export const useOpenPlayerOnTrackClick = () =>
	useSettingsStore((state) => state.openPlayerOnTrackClick);

export const useSetOpenPlayerOnTrackClick = () =>
	useSettingsStore((state) => state.setOpenPlayerOnTrackClick);

export const useShowProviderLabel = () => useSettingsStore((state) => state.showProviderLabel);

export const useSetShowProviderLabel = () =>
	useSettingsStore((state) => state.setShowProviderLabel);

export const useProgressBarStyle = () => useSettingsStore((state) => state.progressBarStyle);

export const useSetProgressBarStyle = () => useSettingsStore((state) => state.setProgressBarStyle);

export const usePlayerBackground = () => useSettingsStore((state) => state.playerBackground);

export const useSetPlayerBackground = () => useSettingsStore((state) => state.setPlayerBackground);

export const useUIStyle = () => useSettingsStore((state) => state.uiStyle);

export const useSetUIStyle = () => useSettingsStore((state) => state.setUIStyle);

export const usePreferredStreamQuality = () =>
	useSettingsStore((state) => state.preferredStreamQuality);

export const useSetPreferredStreamQuality = () =>
	useSettingsStore((state) => state.setPreferredStreamQuality);

export const useAutoplaySimilarOnQueueEnd = () =>
	useSettingsStore((state) => state.autoplaySimilarOnQueueEnd);

export const useSetAutoplaySimilarOnQueueEnd = () =>
	useSettingsStore((state) => state.setAutoplaySimilarOnQueueEnd);

export const useDownloadLocationMode = () =>
	useSettingsStore((state) => state.downloadLocationMode);

export const useMusicDownloadDirectoryUri = () =>
	useSettingsStore((state) => state.musicDownloadDirectoryUri);

export const useMusicDownloadDirectoryName = () =>
	useSettingsStore((state) => state.musicDownloadDirectoryName);

export const useCustomDownloadDirectoryUri = () =>
	useSettingsStore((state) => state.customDownloadDirectoryUri);

export const useCustomDownloadDirectoryName = () =>
	useSettingsStore((state) => state.customDownloadDirectoryName);

export function waitForSettingsHydration(): Promise<void> {
	return hydrationPromise;
}
