import AsyncStorage from '@react-native-async-storage/async-storage';
import type { KpiId } from './kpiDefinitions';
import { ALL_KPI_DEFINITIONS, DEFAULT_KPI_IDS } from './kpiDefinitions';

const STORAGE_KEY = 'kpi_selection_v1';

const VALID_IDS = new Set(ALL_KPI_DEFINITIONS.map(d => d.id));

export async function loadSelectedKpiIds(): Promise<KpiId[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw == null) return [...DEFAULT_KPI_IDS];
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const valid = (parsed as string[]).filter(id => VALID_IDS.has(id as KpiId)) as KpiId[];
      if (valid.length === 3) return valid;
    }
    return [...DEFAULT_KPI_IDS];
  } catch {
    return [...DEFAULT_KPI_IDS];
  }
}

export async function saveSelectedKpiIds(ids: KpiId[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch (e) {
    console.error('Error saving KPI selection:', e);
  }
}
