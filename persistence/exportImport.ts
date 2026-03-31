import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { validateProfilesState } from './profileStorage';
import type { ProfilesState } from '../types';

const EXPORT_FILENAME = 'pf-snapshot-backup.json';

/**
 * Exports the full ProfilesState to a JSON file and opens the native share sheet.
 * Throws on failure so the caller can show an appropriate error.
 */
export async function exportData(state: ProfilesState): Promise<void> {
  const json = JSON.stringify(state);
  const uri = (FileSystem.cacheDirectory ?? '') + EXPORT_FILENAME;
  await FileSystem.writeAsStringAsync(uri, json, { encoding: FileSystem.EncodingType.UTF8 });
  await Sharing.shareAsync(uri, {
    mimeType: 'application/json',
    dialogTitle: 'Export Profile Data',
    UTI: 'public.json',
  });
}

/**
 * Opens a document picker, reads the selected JSON file, and validates it as ProfilesState.
 * Returns the validated ProfilesState on success.
 * Returns null if the user cancels or the file is invalid.
 * Throws with a descriptive message on read/parse failure so the caller can show an error.
 */
export async function importData(): Promise<ProfilesState | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
  });

  if (result.canceled) {
    return null;
  }

  const asset = result.assets?.[0];
  if (!asset?.uri) {
    return null;
  }

  const json = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('The selected file is not valid JSON.');
  }

  const validated = validateProfilesState(parsed);
  return validated;
}
