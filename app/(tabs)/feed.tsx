import { useCallback, useMemo, useRef } from 'react';
import {
	RefreshControl,
	StyleSheet,
	View,
	type LayoutChangeEvent,
	type NativeSyntheticEvent,
	type NativeScrollEvent,
} from 'react-native';
import { AlertCircleIcon, MusicIcon } from 'lucide-react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from 'react-native-paper';
import { PageLayout } from '@/src/components/ui/page-layout';
import { PlayerAwareScrollView } from '@/src/components/ui/player-aware-scroll-view';
import { EmptyState } from '@/src/components/ui/empty-state';
import {
	FeedCarousel,
	FeedSectionSkeleton,
	HomeFeedSkeleton,
} from '@/src/components/home';
import { useHomeFeed } from '@/src/hooks/use-home-feed';
import { useHomeFeedStore } from '@/src/application/state/home-feed-store';
import { useAppTheme } from '@/lib/theme';

const useHasCompletedInitialLoad = () => useHomeFeedStore((state) => state.lastFetchedAt !== null);

const PREFETCH_VIEWPORTS = 3;
const MIN_VISIBLE_SECTIONS = 4;

export default function HomeScreen() {
	const { colors } = useAppTheme();
	const hasCompletedInitialLoad = useHasCompletedInitialLoad();
	const {
		localSections,
		remoteSections,
		isLoading,
		isRefreshing,
		error,
		handleRefresh,
		handleLoadMore,
	} = useHomeFeed();

	const viewportHeight = useRef(0);
	const scrollOffset = useRef(0);

	const checkPrefetch = useCallback(
		(contentHeight: number) => {
			if (viewportHeight.current <= 0) return;
			const distanceFromEnd = contentHeight - viewportHeight.current - scrollOffset.current;
			if (distanceFromEnd < viewportHeight.current * PREFETCH_VIEWPORTS) {
				handleLoadMore();
			}
		},
		[handleLoadMore]
	);

	const visibleLocalSections = useMemo(
		() => localSections.filter((s) => s.items.length > 0),
		[localSections]
	);
	const visibleRemoteSections = useMemo(
		() => remoteSections.filter((s) => s.items.length > 0),
		[remoteSections]
	);

	const { skeletonCount, hasData, showSkeleton, showError, showEmpty } = useMemo(() => {
		const totalVisible =
			localSections.filter((s) => s.items.length > 0).length +
			remoteSections.filter((s) => s.items.length > 0).length;
		const _skeletonCount =
			!hasCompletedInitialLoad && isLoading
				? Math.max(0, MIN_VISIBLE_SECTIONS - totalVisible)
				: 0;
		const _hasData = localSections.length > 0 || remoteSections.length > 0;
		return {
			skeletonCount: _skeletonCount,
			hasData: _hasData,
			showSkeleton: isLoading && !_hasData,
			showError: !isLoading && !_hasData && error !== null,
			showEmpty: !isLoading && !_hasData && error === null,
		};
	}, [hasCompletedInitialLoad, isLoading, localSections, remoteSections, error]);

	const handleLayout = useCallback((e: LayoutChangeEvent) => {
		viewportHeight.current = e.nativeEvent.layout.height;
	}, []);

	const handleScroll = useCallback(
		({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
			scrollOffset.current = nativeEvent.contentOffset.y;
			checkPrefetch(nativeEvent.contentSize.height);
		},
		[checkPrefetch]
	);

	const handleContentSizeChange = useCallback(
		(_w: number, h: number) => {
			checkPrefetch(h);
		},
		[checkPrefetch]
	);

	return (
		<PageLayout edges={[]}>
			<PlayerAwareScrollView
				refreshControl={
					<RefreshControl
						refreshing={isRefreshing}
						onRefresh={handleRefresh}
						tintColor={colors.primary}
						colors={[colors.primary]}
					/>
				}
				showsVerticalScrollIndicator={false}
				onLayout={handleLayout}
				onScroll={handleScroll}
				onContentSizeChange={handleContentSizeChange}
				scrollEventThrottle={200}
			>
				{showSkeleton && <HomeFeedSkeleton />}

				{showError && (
					<EmptyState
						icon={AlertCircleIcon}
						title={'Something went wrong'}
						description={error ?? 'Failed to load home feed'}
					/>
				)}

				{showEmpty && (
					<EmptyState
						icon={MusicIcon}
						title={'Pick your languages'}
						description={'Select one or more languages in Settings to unlock curated JioSaavn shelves.'}
					/>
				)}

				{hasData && (
					<View style={styles.content}>
						<View style={[styles.heroCard, { borderColor: colors.outlineVariant }]}>
							<LinearGradient
								colors={[
									'rgba(105, 74, 255, 0.28)',
									'rgba(18, 22, 48, 0.92)',
								]}
								start={{ x: 0, y: 0 }}
								end={{ x: 1, y: 1 }}
								style={StyleSheet.absoluteFill}
							/>
							<View style={styles.heroInner}>
								<View style={styles.heroLogoWrap}>
									<Image
										source={require('../../assets/images/icon.png')}
										style={styles.heroLogo}
										contentFit={'contain'}
									/>
								</View>
								<View style={styles.heroCopy}>
									<Text variant={'headlineSmall'} style={[styles.heroTitle, { color: colors.onSurface }]}>
										Kur Music
									</Text>
									<Text variant={'bodyMedium'} style={[styles.heroSubtitle, { color: colors.onSurfaceVariant }]}>
										BlackHole-style shelves from JioSaavn, driven by your saved language cookies.
									</Text>
								</View>
							</View>
							<View style={styles.heroBadges}>
								{['Direct API', 'No search', 'Language aware'].map((badge) => (
									<View
										key={badge}
										style={[styles.heroBadge, { backgroundColor: colors.surfaceContainerHigh }]}
									>
										<Text variant={'labelSmall'} style={{ color: colors.onSurfaceVariant }}>
											{badge}
										</Text>
									</View>
								))}
							</View>
						</View>

						{visibleLocalSections.map((section) => (
							<FeedCarousel key={section.id} section={section} />
						))}
						{isLoading
							? Array.from({ length: MIN_VISIBLE_SECTIONS }, (_, i) => (
									<FeedSectionSkeleton key={`filter-skeleton-${i}`} />
								))
							: visibleRemoteSections.map((section) => (
									<FeedCarousel key={section.id} section={section} />
								))}
						{skeletonCount > 0 &&
							Array.from({ length: skeletonCount }, (_, i) => (
								<FeedSectionSkeleton key={`skeleton-${i}`} />
							))}
					</View>
				)}
			</PlayerAwareScrollView>
		</PageLayout>
	);
}

const styles = StyleSheet.create({
	content: {
		gap: 18,
		paddingTop: 10,
		paddingBottom: 20,
	},
	heroCard: {
		marginHorizontal: 12,
		padding: 16,
		borderRadius: 28,
		overflow: 'hidden',
		borderWidth: StyleSheet.hairlineWidth,
	},
	heroInner: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 16,
	},
	heroLogoWrap: {
		width: 74,
		height: 74,
		borderRadius: 22,
		backgroundColor: 'rgba(255,255,255,0.08)',
		alignItems: 'center',
		justifyContent: 'center',
	},
	heroLogo: {
		width: 54,
		height: 54,
	},
	heroCopy: {
		flex: 1,
		gap: 6,
	},
	heroTitle: {
		fontWeight: '700',
	},
	heroSubtitle: {
		lineHeight: 20,
	},
	heroBadges: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 8,
		marginTop: 14,
	},
	heroBadge: {
		paddingHorizontal: 12,
		paddingVertical: 7,
		borderRadius: 999,
	},
});
