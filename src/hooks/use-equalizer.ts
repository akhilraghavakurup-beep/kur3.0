import { useCallback, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
	useEqualizerStore,
	DEFAULT_PRESETS,
	EQUALIZER_BANDS,
	type EqualizerPreset,
} from '@/src/application/state/equalizer-store';

export function useEqualizer() {
	const {
		isEnabled,
		selectedPresetId,
		customGains,
		isNativeAvailable,
		selectPreset: selectPresetAction,
		setCustomGain: setCustomGainAction,
		toggleEnabled: toggleEnabledAction,
		resetToFlat: resetToFlatAction,
		initializeNative,
	} = useEqualizerStore(
		useShallow((state) => ({
			isEnabled: state.isEnabled,
			selectedPresetId: state.selectedPresetId,
			customGains: state.customGains,
			isNativeAvailable: state.isNativeAvailable,
			selectPreset: state.selectPreset,
			setCustomGain: state.setCustomGain,
			toggleEnabled: state.toggleEnabled,
			resetToFlat: state.resetToFlat,
			initializeNative: state.initializeNative,
		}))
	);

	const selectPreset = useCallback(
		(presetId: string) => {
			selectPresetAction(presetId);
		},
		[selectPresetAction]
	);

	const setGain = useCallback(
		(bandIndex: number, gain: number) => {
			setCustomGainAction(bandIndex, gain);
		},
		[setCustomGainAction]
	);

	const toggleEnabled = useCallback(() => {
		toggleEnabledAction();
	}, [toggleEnabledAction]);

	const resetToFlat = useCallback(() => {
		resetToFlatAction();
	}, [resetToFlatAction]);

	const currentPreset =
		DEFAULT_PRESETS.find((p) => p.id === selectedPresetId) ?? DEFAULT_PRESETS[0];

	return {
		isEnabled,
		selectedPresetId,
		currentPreset,
		currentGains: customGains,
		presets: DEFAULT_PRESETS,
		bands: EQUALIZER_BANDS,
		isNativeAvailable,

		selectPreset,
		setGain,
		toggleEnabled,
		resetToFlat,
		initializeNative,
	};
}

export function useEqualizerInit() {
	const initializeNative = useEqualizerStore((state) => state.initializeNative);

	useEffect(() => {
		initializeNative();
	}, [initializeNative]);
}

export { DEFAULT_PRESETS, EQUALIZER_BANDS, type EqualizerPreset };
