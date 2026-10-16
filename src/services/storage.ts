/* eslint-disable no-bitwise */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {AppSettings, GameState, HistoricalRecord, SaveSlot} from '../game/types';

const SAVE_INDEX_KEY = '@pss/save-index-v1';
const SETTINGS_KEY = '@pss/settings-v1';
const ACHIEVEMENTS_KEY = '@pss/achievements-v1';

export const DEFAULT_SETTINGS: AppSettings = {
  reduceMotion: false,
  sound: true,
  haptics: true,
  consent: {analytics: false, collectiveLearning: false},
};

function checksum(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function slotKey(slotId: string) { return `@pss/save-v1/${slotId}`; }
function temporarySlotKey(slotId: string) { return `@pss/save-v1/${slotId}.pending`; }

export async function saveCampaign(state: GameState, name?: string): Promise<SaveSlot> {
  const slotId = state.id;
  const savedAt = new Date().toISOString();
  const rawState = JSON.stringify(state);
  const slot: SaveSlot = {schemaVersion: 2, slotId, name: name ?? `${state.scenarioName} · Turn ${state.turn}`, state, checksum: checksum(rawState), savedAt};
  const payload = JSON.stringify(slot);
  const pending = temporarySlotKey(slotId);
  await AsyncStorage.setItem(pending, payload);
  const verified = await AsyncStorage.getItem(pending);
  if (verified !== payload) throw new Error('Save verification failed before commit.');
  await AsyncStorage.setItem(slotKey(slotId), payload);
  const index = await listSaveIds();
  await AsyncStorage.setItem(SAVE_INDEX_KEY, JSON.stringify([slotId, ...index.filter(id => id !== slotId)]));
  await AsyncStorage.removeItem(pending);
  return slot;
}

export async function loadCampaign(slotId: string): Promise<GameState> {
  const committed = await AsyncStorage.getItem(slotKey(slotId));
  const pending = await AsyncStorage.getItem(temporarySlotKey(slotId));
  const raw = committed ?? pending;
  if (!raw) throw new Error('Save slot was not found.');
  const slot = JSON.parse(raw) as SaveSlot | LegacySaveSlot;
  if (checksum(JSON.stringify(slot.state)) !== slot.checksum) throw new Error('Save integrity check failed.');
  if (slot.schemaVersion === 2 && slot.state.schemaVersion === 2) return slot.state;
  if (slot.schemaVersion === 1 && slot.state.schemaVersion === 1) {
    const migrated = migrateState(slot.state);
    await saveCampaign(migrated, slot.name);
    return migrated;
  }
  throw new Error('This save uses an unsupported schema version.');
}

export async function listSaves(): Promise<SaveSlot[]> {
  const ids = await listSaveIds();
  const slots = await Promise.all(ids.map(async id => {
    try {
      const state = await loadCampaign(id);
      const raw = await AsyncStorage.getItem(slotKey(id));
      const parsed = raw ? JSON.parse(raw) as SaveSlot : null;
      return parsed ? {...parsed, state} : null;
    } catch {
      return null;
    }
  }));
  return slots.filter((slot): slot is SaveSlot => Boolean(slot));
}

async function listSaveIds(): Promise<string[]> {
  try { return JSON.parse(await AsyncStorage.getItem(SAVE_INDEX_KEY) ?? '[]'); } catch { return []; }
}

export async function deleteSave(slotId: string) {
  const ids = await listSaveIds();
  await Promise.all([slotKey(slotId), temporarySlotKey(slotId)].map(key => AsyncStorage.removeItem(key)));
  await AsyncStorage.setItem(SAVE_INDEX_KEY, JSON.stringify(ids.filter(id => id !== slotId)));
}

export async function loadSettings(): Promise<AppSettings> {
  try {
    const stored = JSON.parse(await AsyncStorage.getItem(SETTINGS_KEY) ?? '{}');
    return {...DEFAULT_SETTINGS, ...stored, consent: {...DEFAULT_SETTINGS.consent, ...stored.consent}};
  } catch { return DEFAULT_SETTINGS; }
}

export async function saveSettings(settings: AppSettings) {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export async function loadAchievements(): Promise<string[]> {
  try { return JSON.parse(await AsyncStorage.getItem(ACHIEVEMENTS_KEY) ?? '[]'); } catch { return []; }
}

export async function unlockAchievements(state: GameState): Promise<string[]> {
  const previous = await loadAchievements();
  const unlocked = new Set(previous);
  if (state.turn >= 5) unlocked.add('strategic-horizon');
  if (state.treasury >= 8000) unlocked.add('full-treasury');
  if (state.factions.every(faction => faction.support >= 5000)) unlocked.add('broad-coalition');
  if (state.status === 'victory') unlocked.add(`${state.mode}-victory`);
  if (state.status === 'transitioned') unlocked.add('peaceful-transition');
  const result = [...unlocked];
  await AsyncStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(result));
  return result;
}

export async function clearLocalData() {
  const ids = await listSaveIds();
  const owned = (await AsyncStorage.getAllKeys()).filter(key => key.startsWith('@pss/'));
  await Promise.all([...new Set([
    SAVE_INDEX_KEY, SETTINGS_KEY, ACHIEVEMENTS_KEY,
    ...ids.flatMap(id => [slotKey(id), temporarySlotKey(id)]),
    ...owned,
  ])].map(key => AsyncStorage.removeItem(key)));
}

interface LegacySaveSlot {
  schemaVersion: 1;
  slotId: string;
  name: string;
  state: Omit<GameState, 'schemaVersion' | 'history'> & {
    schemaVersion: 1;
    history: Array<Omit<HistoricalRecord, 'timing' | 'legacy'>>;
  };
  checksum: string;
  savedAt: string;
}

function migrateState(legacy: LegacySaveSlot['state']): GameState {
  const state = JSON.parse(JSON.stringify(legacy)) as Omit<GameState, 'schemaVersion'> & {schemaVersion: number};
  state.schemaVersion = 2;
  state.history = legacy.history.map(item => ({
    ...item,
    timing: item.kind === 'decision' ? 'immediate' : item.kind === 'opponent' ? 'opponent' : item.kind === 'event' ? 'event' : item.kind === 'result' ? 'result' : 'systemic',
    legacy: true,
  }));
  state.scheduledEffects = legacy.scheduledEffects.map(effect => ({...effect}));
  delete state.lastTurnReport;
  delete state.lastAcknowledgedReportId;
  return state as GameState;
}
