// Persistence layer using AsyncStorage

import AsyncStorage from '@react-native-async-storage/async-storage';
import { SnapshotState } from '../types';
import { emptySnapshotState } from '../domain/domainValidation';
import { loadSnapshotState as loadSnapshotStateRaw, saveSnapshotState as saveSnapshotStateRaw } from './persistenceModel';

const STORAGE_KEY = '@snapshot_state';

// Distinguish "no saved snapshot exists" (fresh install) vs "saved snapshot exists but is invalid".
// - Returns null only when the key is missing.
// - Returns a valid SnapshotState otherwise (invalid/corrupt falls back to emptySnapshotState()).
export const loadSnapshotStateIfPresent = async (): Promise<SnapshotState | null> => {
  try {
    const jsonValue = await AsyncStorage.getItem(STORAGE_KEY);
    if (jsonValue == null) return null;

    try {
      const parsed: unknown = JSON.parse(jsonValue);
      return loadSnapshotStateRaw(parsed);
    } catch {
      return emptySnapshotState();
    }
  } catch (e) {
    console.error('Error loading snapshot state:', e);
    // Best-effort: if storage fails, don't overwrite the seeded initial state.
    return null;
  }
};

export const loadSnapshotState = async (): Promise<SnapshotState> => {
  try {
    const jsonValue = await AsyncStorage.getItem(STORAGE_KEY);
    if (jsonValue == null) return emptySnapshotState();

    try {
      const parsed: unknown = JSON.parse(jsonValue);
      return loadSnapshotStateRaw(parsed);
    } catch {
      return emptySnapshotState();
    }
  } catch (e) {
    console.error('Error loading snapshot state:', e);
    return emptySnapshotState();
  }
};

export const saveSnapshotState = async (state: SnapshotState): Promise<void> => {
  try {
    const payload = saveSnapshotStateRaw(state);
    const jsonValue = JSON.stringify(payload);
    await AsyncStorage.setItem(STORAGE_KEY, jsonValue);
  } catch (e) {
    console.error('Error saving snapshot state:', e);
  }
};

export const getDefaultSnapshotState = (): SnapshotState => ({
  ...emptySnapshotState(),
});

