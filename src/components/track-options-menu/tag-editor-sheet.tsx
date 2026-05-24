/**
 * TagEditorSheet
 *
 * Premium bottom sheet for editing metadata of downloaded tracks.
 * Features:
 *  - Editable fields: Title, Artist, Album
 *  - "Search JioSaavn" button to auto-fill from live API results
 *  - Saves changes to disk (metadata.json) + updates Zustand store
 *  - Haptic feedback, M3 theming, smooth animations
 */

import React, {
	useCallback,
	useEffect,
	useRef,
	useState,
} from 'react';
import {
	View,
	StyleSheet,
	ScrollView,
	TouchableOpacity,
	ActivityIndicator,
	TextInput,
	Platform,
} from 'react-native';
import { Text, Divider } from 'react-native-paper';
import BottomSheet, {
	BottomSheetView,
	BottomSheetBackdrop,
	type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { Image } from 'expo-image';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import {
	PenLine,
	Search,
	CheckCircle2,
	X,
	Music2,
	UserRound,
	Disc3,
	Save,
	RefreshCw,
} from 'lucide-react-native';
import Animated, {
	FadeIn,
	FadeOut,
	SlideInDown,
} from 'react-native-reanimated';
import { useTagEditorStore, useIsTagEditorOpen, useTagEditorTrack } from '@/src/application/state/tag-editor-store';
import { useDownloadStore } from '@/src/application/state/download-store';
import { searchService } from '@/src/application/services/search-service';
import { getArtistNames } from '@/src/domain/entities/track';
import { getBestArtwork } from '@/src/domain/value-objects/artwork';
import { useAppTheme, resolveDisplayFont } from '@/lib/theme';
import { useToast } from '@/src/hooks/use-toast';
import type { Track } from '@/src/domain/entities/track';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getParentDirectory(filePath: string): string {
	const normalized = filePath.replace(/\\/g, '/');
	const idx = normalized.lastIndexOf('/');
	return idx === -1 ? normalized : normalized.slice(0, idx + 1);
}

async function patchMetadataJson(
	filePath: string,
	updates: { title: string; artist: string; album: string; artworkUrl?: string }
): Promise<string | null> {
	try {
		const directory = getParentDirectory(filePath);
		const metadataPath = `${directory}metadata.json`;

		let existing: Record<string, unknown> = {};
		try {
			const raw = await FileSystem.readAsStringAsync(metadataPath);
			existing = JSON.parse(raw) as Record<string, unknown>;
		} catch {
			// metadata.json might not exist — that's okay, we'll create it
		}

		let newArtworkPath: string | undefined;
		if (updates.artworkUrl) {
			const ext = updates.artworkUrl.toLowerCase().includes('.png')
				? 'png'
				: updates.artworkUrl.toLowerCase().includes('.webp')
					? 'webp'
					: 'jpg';
			const targetPath = `${directory}cover.${ext}`;
			const dl = await FileSystem.downloadAsync(updates.artworkUrl, targetPath, {
				headers: { Accept: 'image/*', 'User-Agent': 'Kur Music/0.0.1' },
			}).catch(() => null);
			if (dl?.status === 200) newArtworkPath = targetPath;
		}

		const patched = {
			...existing,
			title: updates.title,
			artist: updates.artist,
			album: updates.album,
			...(updates.artworkUrl && { artworkUrl: updates.artworkUrl }),
			...(newArtworkPath && { artworkFilePath: newArtworkPath }),
			patchedAt: Date.now(),
		};

		await FileSystem.writeAsStringAsync(metadataPath, JSON.stringify(patched, null, 2));
		return newArtworkPath ?? null;
	} catch {
		return null;
	}
}

// ─── Sub-components ────────────────────────────────────────────────────────────

interface FieldInputProps {
	icon: React.ReactNode;
	label: string;
	value: string;
	onChangeText: (t: string) => void;
	placeholder: string;
	colors: ReturnType<typeof useAppTheme>['colors'];
}

function FieldInput({ icon, label, value, onChangeText, placeholder, colors }: FieldInputProps) {
	return (
		<View style={[inputStyles.wrapper, { borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLow }]}>
			<View style={inputStyles.iconContainer}>{icon}</View>
			<View style={inputStyles.textColumn}>
				<Text variant={'labelSmall'} style={{ color: colors.primary, marginBottom: 2 }}>
					{label}
				</Text>
				<TextInput
					value={value}
					onChangeText={onChangeText}
					placeholder={placeholder}
					placeholderTextColor={colors.onSurfaceVariant}
					style={[
						inputStyles.input,
						{
							color: colors.onSurface,
							fontFamily: resolveDisplayFont('500'),
						},
					]}
					selectionColor={colors.primary}
					returnKeyType={'done'}
				/>
			</View>
		</View>
	);
}

const inputStyles = StyleSheet.create({
	wrapper: {
		flexDirection: 'row',
		alignItems: 'center',
		borderWidth: 1,
		borderRadius: 14,
		paddingHorizontal: 14,
		paddingVertical: 12,
		gap: 12,
		marginBottom: 10,
	},
	iconContainer: {
		width: 24,
		alignItems: 'center',
	},
	textColumn: {
		flex: 1,
	},
	input: {
		fontSize: 15,
		padding: 0,
		margin: 0,
		includeFontPadding: false,
	},
});

interface SearchResultCardProps {
	track: Track;
	onSelect: (track: Track) => void;
	colors: ReturnType<typeof useAppTheme>['colors'];
}

function SearchResultCard({ track, onSelect, colors }: SearchResultCardProps) {
	const artwork = getBestArtwork(track.artwork, 48);
	const artist = getArtistNames(track);

	return (
		<TouchableOpacity
			onPress={() => onSelect(track)}
			style={[resultCardStyles.card, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }]}
			activeOpacity={0.75}
		>
			{artwork?.url ? (
				<Image source={{ uri: artwork.url }} style={resultCardStyles.artwork} contentFit={'cover'} />
			) : (
				<View style={[resultCardStyles.artwork, { backgroundColor: colors.surfaceContainerHighest }]} />
			)}
			<View style={resultCardStyles.info}>
				<Text variant={'bodyMedium'} numberOfLines={1} style={{ color: colors.onSurface, fontWeight: '600' }}>
					{track.title}
				</Text>
				<Text variant={'bodySmall'} numberOfLines={1} style={{ color: colors.onSurfaceVariant }}>
					{artist}
					{track.album ? ` • ${track.album.name}` : ''}
				</Text>
			</View>
			<CheckCircle2 size={20} color={colors.primary} />
		</TouchableOpacity>
	);
}

const resultCardStyles = StyleSheet.create({
	card: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		padding: 12,
		borderRadius: 12,
		borderWidth: 1,
		marginBottom: 8,
	},
	artwork: {
		width: 48,
		height: 48,
		borderRadius: 8,
	},
	info: {
		flex: 1,
		gap: 2,
	},
});

// ─── Main Sheet ────────────────────────────────────────────────────────────────

export function TagEditorSheet() {
	const { colors } = useAppTheme();
	const isOpen = useIsTagEditorOpen();
	const track = useTagEditorTrack();
	const closeTagEditor = useTagEditorStore((s) => s.closeTagEditor);
	const updateMeta = useDownloadStore((s) => s.updateDownloadedTrackMetadata);
	const downloadedMeta = useDownloadStore((s) => track ? s.downloadedTracks.get(track.id.value) : undefined);
	const { success, error: toastError } = useToast();

	const sheetRef = useRef<BottomSheet>(null);

	// ── Form state ────────────────────────────────────────────────────────────
	const [title, setTitle] = useState('');
	const [artist, setArtist] = useState('');
	const [album, setAlbum] = useState('');
	const [newArtworkUrl, setNewArtworkUrl] = useState<string | undefined>(undefined);

	// ── Search state ──────────────────────────────────────────────────────────
	const [searchResults, setSearchResults] = useState<Track[]>([]);
	const [isSearching, setIsSearching] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [searchVisible, setSearchVisible] = useState(false);

	// ── Populate form when track changes ──────────────────────────────────────
	useEffect(() => {
		if (track) {
			setTitle(downloadedMeta?.title ?? track.title);
			setArtist(downloadedMeta?.artistName ?? getArtistNames(track));
			setAlbum(downloadedMeta?.albumName ?? track.album?.name ?? '');
			setNewArtworkUrl(undefined);
			setSearchResults([]);
			setSearchVisible(false);
		}
	}, [track, downloadedMeta]);

	// ── Sheet open/close ──────────────────────────────────────────────────────
	useEffect(() => {
		if (isOpen && track) {
			sheetRef.current?.snapToIndex(0);
		} else {
			sheetRef.current?.close();
		}
	}, [isOpen, track]);

	const handleSheetChange = useCallback((index: number) => {
		if (index === -1) closeTagEditor();
	}, [closeTagEditor]);

	const renderBackdrop = useCallback(
		(props: BottomSheetBackdropProps) => (
			<BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} pressBehavior={'close'} />
		),
		[]
	);

	// ── JioSaavn search ───────────────────────────────────────────────────────
	const handleSearch = useCallback(async () => {
		const query = `${title} ${artist}`.trim();
		if (!query) return;

		if (Platform.OS !== 'web') {
			void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
		}

		setIsSearching(true);
		setSearchVisible(true);
		try {
			const result = await searchService.search(query, { limit: 8 });
			if (result.success) {
				setSearchResults(result.data.tracks.slice(0, 8));
			} else {
				setSearchResults([]);
			}
		} catch {
			setSearchResults([]);
		} finally {
			setIsSearching(false);
		}
	}, [title, artist]);

	// ── Select search result ──────────────────────────────────────────────────
	const handleSelectResult = useCallback((selected: Track) => {
		if (Platform.OS !== 'web') {
			void Haptics.selectionAsync();
		}
		setTitle(selected.title);
		setArtist(getArtistNames(selected));
		setAlbum(selected.album?.name ?? '');
		const artUrl = getBestArtwork(selected.artwork, 500)?.url;
		if (artUrl) setNewArtworkUrl(artUrl);
		setSearchVisible(false);
		setSearchResults([]);
	}, []);

	// ── Save ──────────────────────────────────────────────────────────────────
	const handleSave = useCallback(async () => {
		if (!track || !downloadedMeta) return;

		if (Platform.OS !== 'web') {
			void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
		}

		setIsSaving(true);
		try {
			await patchMetadataJson(downloadedMeta.filePath, {
				title: title.trim() || track.title,
				artist: artist.trim() || getArtistNames(track),
				album: album.trim(),
				artworkUrl: newArtworkUrl,
			});

			// Update Zustand in-memory state immediately
			updateMeta(track.id.value, {
				title: title.trim() || track.title,
				artistName: artist.trim() || getArtistNames(track),
				albumName: album.trim() || undefined,
				artworkUrl: newArtworkUrl ?? downloadedMeta.artworkUrl,
			});

			success('Tags saved', `${title.trim() || track.title} updated`);
			closeTagEditor();
		} catch {
			toastError('Save failed', 'Could not write metadata to disk');
		} finally {
			setIsSaving(false);
		}
	}, [track, downloadedMeta, title, artist, album, newArtworkUrl, updateMeta, success, toastError, closeTagEditor]);

	if (!track) return null;

	const artworkUrl = newArtworkUrl ?? downloadedMeta?.artworkUrl ?? getBestArtwork(track.artwork, 200)?.url;

	return (
		<BottomSheet
			ref={sheetRef}
			index={-1}
			enablePanDownToClose
			snapPoints={['75%', '92%']}
			backdropComponent={renderBackdrop}
			onChange={handleSheetChange}
			backgroundStyle={[styles.sheetBackground, { backgroundColor: colors.surfaceContainerHigh }]}
			handleIndicatorStyle={{ backgroundColor: colors.outlineVariant }}
		>
			<BottomSheetView style={styles.container}>
				{/* ── Header ─────────────────────────────────────────────── */}
				<View style={styles.header}>
					<View style={[styles.headerIcon, { backgroundColor: `${colors.primary}18` }]}>
						<PenLine size={20} color={colors.primary} />
					</View>
					<View style={{ flex: 1 }}>
						<Text variant={'titleMedium'} style={{ color: colors.onSurface, fontFamily: resolveDisplayFont('700') }}>
							Edit Tags
						</Text>
						<Text variant={'bodySmall'} style={{ color: colors.onSurfaceVariant }}>
							Edit metadata for this downloaded track
						</Text>
					</View>
					<TouchableOpacity onPress={closeTagEditor} style={styles.closeButton}>
						<X size={20} color={colors.onSurfaceVariant} />
					</TouchableOpacity>
				</View>

				<Divider style={{ backgroundColor: colors.outlineVariant, marginHorizontal: 16, marginBottom: 16 }} />

				<ScrollView
					style={{ flex: 1 }}
					contentContainerStyle={styles.scrollContent}
					showsVerticalScrollIndicator={false}
					keyboardShouldPersistTaps={'handled'}
				>
					{/* ── Artwork preview ─────────────────────────────────── */}
					<View style={styles.artworkRow}>
						{artworkUrl ? (
							<Image
								source={{ uri: artworkUrl }}
								style={[styles.artworkPreview, { borderColor: colors.outlineVariant }]}
								contentFit={'cover'}
								transition={300}
							/>
						) : (
							<View style={[styles.artworkPreview, styles.artworkPlaceholder, { backgroundColor: colors.surfaceContainerHighest, borderColor: colors.outlineVariant }]}>
								<Music2 size={32} color={colors.onSurfaceVariant} />
							</View>
						)}
						<View style={{ flex: 1, gap: 4 }}>
							<Text variant={'labelMedium'} style={{ color: colors.onSurface, fontFamily: resolveDisplayFont('600') }}>
								{title || track.title}
							</Text>
							<Text variant={'labelSmall'} style={{ color: colors.onSurfaceVariant }}>
								{artist || getArtistNames(track)}
							</Text>
							{newArtworkUrl && (
								<Animated.View entering={FadeIn.duration(200)} style={[styles.artworkBadge, { backgroundColor: `${colors.primary}20` }]}>
									<Text variant={'labelSmall'} style={{ color: colors.primary }}>
										New artwork selected ✓
									</Text>
								</Animated.View>
							)}
						</View>
					</View>

					{/* ── Form fields ─────────────────────────────────────── */}
					<FieldInput
						icon={<Music2 size={18} color={colors.primary} />}
						label={'Title'}
						value={title}
						onChangeText={setTitle}
						placeholder={'Track title'}
						colors={colors}
					/>
					<FieldInput
						icon={<UserRound size={18} color={colors.primary} />}
						label={'Artist'}
						value={artist}
						onChangeText={setArtist}
						placeholder={'Artist name'}
						colors={colors}
					/>
					<FieldInput
						icon={<Disc3 size={18} color={colors.primary} />}
						label={'Album'}
						value={album}
						onChangeText={setAlbum}
						placeholder={'Album name (optional)'}
						colors={colors}
					/>

					{/* ── JioSaavn Fetch button ────────────────────────────── */}
					<TouchableOpacity
						onPress={handleSearch}
						disabled={isSearching}
						style={[
							styles.searchButton,
							{
								backgroundColor: `${colors.secondary}18`,
								borderColor: `${colors.secondary}40`,
							},
						]}
						activeOpacity={0.75}
					>
						{isSearching ? (
							<ActivityIndicator size={'small'} color={colors.secondary} />
						) : (
							<Search size={18} color={colors.secondary} />
						)}
						<Text variant={'labelLarge'} style={{ color: colors.secondary, fontFamily: resolveDisplayFont('600') }}>
							{isSearching ? 'Searching JioSaavn…' : 'Fetch from JioSaavn'}
						</Text>
					</TouchableOpacity>

					{/* ── Search results ───────────────────────────────────── */}
					{searchVisible && (
						<Animated.View entering={SlideInDown.duration(280)} exiting={FadeOut.duration(150)}>
							<View style={styles.resultsHeader}>
								<Text variant={'labelMedium'} style={{ color: colors.onSurfaceVariant }}>
									{searchResults.length > 0 ? `${searchResults.length} results — tap to auto-fill` : 'No results found'}
								</Text>
								<TouchableOpacity onPress={() => setSearchVisible(false)}>
									<RefreshCw size={14} color={colors.onSurfaceVariant} />
								</TouchableOpacity>
							</View>
							{searchResults.map((item) => (
								<SearchResultCard key={item.id.value} track={item} onSelect={handleSelectResult} colors={colors} />
							))}
						</Animated.View>
					)}

					{/* ── Save button ──────────────────────────────────────── */}
					<TouchableOpacity
						onPress={handleSave}
						disabled={isSaving}
						style={[
							styles.saveButton,
							{
								backgroundColor: colors.primary,
								opacity: isSaving ? 0.6 : 1,
							},
						]}
						activeOpacity={0.8}
					>
						{isSaving ? (
							<ActivityIndicator size={'small'} color={colors.onPrimary} />
						) : (
							<Save size={18} color={colors.onPrimary} />
						)}
						<Text variant={'labelLarge'} style={{ color: colors.onPrimary, fontFamily: resolveDisplayFont('700') }}>
							{isSaving ? 'Saving…' : 'Save Metadata'}
						</Text>
					</TouchableOpacity>

					<View style={{ height: 24 }} />
				</ScrollView>
			</BottomSheetView>
		</BottomSheet>
	);
}

const styles = StyleSheet.create({
	sheetBackground: {
		borderTopLeftRadius: 24,
		borderTopRightRadius: 24,
	},
	container: {
		flex: 1,
	},
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		paddingHorizontal: 20,
		paddingTop: 20,
		paddingBottom: 14,
	},
	headerIcon: {
		width: 42,
		height: 42,
		borderRadius: 12,
		alignItems: 'center',
		justifyContent: 'center',
	},
	closeButton: {
		padding: 8,
	},
	scrollContent: {
		paddingHorizontal: 16,
	},
	artworkRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 14,
		marginBottom: 20,
	},
	artworkPreview: {
		width: 72,
		height: 72,
		borderRadius: 12,
		borderWidth: 1,
	},
	artworkPlaceholder: {
		alignItems: 'center',
		justifyContent: 'center',
	},
	artworkBadge: {
		paddingHorizontal: 8,
		paddingVertical: 3,
		borderRadius: 8,
		alignSelf: 'flex-start',
		marginTop: 2,
	},
	searchButton: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 8,
		borderRadius: 14,
		borderWidth: 1,
		paddingVertical: 13,
		marginBottom: 12,
	},
	resultsHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 10,
	},
	saveButton: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 8,
		borderRadius: 16,
		paddingVertical: 15,
		marginTop: 8,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.15,
		shadowRadius: 8,
		elevation: 6,
	},
});
