/* eslint-disable no-bitwise */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {AppSettings, GameState, HistoricalRecord, SaveSlot} from '../game/types';

const SAVE_INDEX_KEY = '@pss/save-index-v1';
const SETTINGS_KEY = '@pss/settings-v1';
const ACHIEVEMENTS_KEY = '@pss/achievements-v1';

export const ACHIEVEMENTS = [
  ['first-decision', 'First Move', 'Commit your first strategic decision.'],
  ['strategic-horizon', 'Strategic Horizon', 'Reach turn five in any campaign.'],
  ['campaign-veteran', 'The Long Game', 'Reach turn ten in a campaign.'],
  ['full-treasury', 'Deep Reserves', 'Build a treasury of 8,000.'],
  ['popular-mandate', 'Popular Mandate', 'Raise public sentiment to 70%.'],
  ['legitimate-authority', 'Legitimate Authority', 'Raise legitimacy to 70%.'],
  ['momentum-surge', 'Momentum Surge', 'Build campaign momentum to 70%.'],
  ['broad-coalition', 'Broad Coalition', 'Win majority support from every faction.'],
  ['united-front', 'United Front', 'Raise every faction to at least 65% support.'],
  ['institution-builder', 'Institution Builder', 'Raise every institution to at least 65% confidence.'],
  ['resilient-economy', 'Resilient Economy', 'Reach 60% growth, employment, and resilience.'],
  ['presidential-victory', 'The 270 Path', 'Win a presidential campaign.'],
  ['dictatorship-victory', 'Durable Coalition', 'Survive the Republic campaign.'],
  ['monarchy-victory', 'The Next Reign', 'Secure a stable dynasty.'],
  ['peaceful-transition', 'Power Transformed', 'Complete a legitimate political transition.'],
  ['master-strategist', 'Master Strategist', 'Win or transition on Strategist difficulty.'],
] as const;

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

export async function clearSavedCampaigns() {
  const saveKeys = (await AsyncStorage.getAllKeys()).filter(key => key === SAVE_INDEX_KEY || key.startsWith('@pss/save-v1/'));
  await Promise.all(saveKeys.map(key => AsyncStorage.removeItem(key)));
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
  if (state.actionHistory.length >= 1) unlocked.add('first-decision');
  if (state.turn >= 5) unlocked.add('strategic-horizon');
  if (state.turn >= 10) unlocked.add('campaign-veteran');
  if (state.treasury >= 8000) unlocked.add('full-treasury');
  if (state.publicSentiment >= 7000) unlocked.add('popular-mandate');
  if (state.legitimacy >= 7000) unlocked.add('legitimate-authority');
  if (state.momentum >= 7000) unlocked.add('momentum-surge');
  if (state.factions.every(faction => faction.support >= 5000)) unlocked.add('broad-coalition');
  if (state.factions.every(faction => faction.support >= 6500)) unlocked.add('united-front');
  if (state.institutions.every(institution => institution.confidence >= 6500)) unlocked.add('institution-builder');
  if (state.economy.growth >= 6000 && state.economy.employment >= 6000 && state.economy.resilience >= 6000) unlocked.add('resilient-economy');
  if (state.status === 'victory' && state.mode !== 'coup') unlocked.add(`${state.mode}-victory`);
  if (state.status === 'transitioned') unlocked.add('peaceful-transition');
  if ((state.status === 'victory' || state.status === 'transitioned') && state.difficulty === 'strategist') unlocked.add('master-strategist');
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
