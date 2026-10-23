import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  assertWorld,
  stateChecksum,
  WorldState,
} from '../../packages/simulation';

const PREFIX = '@pss/career-v3/';
export interface CareerSave {
  schemaVersion: 3;
  state: WorldState;
  checksum: string;
  savedAt: string;
}
export interface LegacyArchive {
  id: string;
  name: string;
  mode: string;
  turn: number;
  status: string;
  history: Array<{ title: string; detail: string }>;
  result?: { summary: string };
}
let writes: Promise<unknown> = Promise.resolve();
export function saveCareer(state: WorldState): Promise<void> {
  const snapshot = JSON.parse(JSON.stringify(state)) as WorldState;
  const write = async () => {
    assertWorld(snapshot);
    const slot: CareerSave = {
      schemaVersion: 3,
      state: snapshot,
      checksum: stateChecksum(snapshot),
      savedAt: new Date().toISOString(),
    };
    const raw = JSON.stringify(slot);
    const key = PREFIX + snapshot.id;
    await AsyncStorage.setItem(key + '.pending', raw);
    if ((await AsyncStorage.getItem(key + '.pending')) !== raw)
      throw new Error('The career could not be verified before saving.');
    await AsyncStorage.setItem(key, raw);
    await AsyncStorage.removeItem(key + '.pending');
  };
  const result = writes.catch(() => undefined).then(write);
  writes = result;
  return result;
}
export async function loadCareer(id: string): Promise<WorldState> {
  const key = PREFIX + id;
  const candidates = await Promise.all([
    AsyncStorage.getItem(key),
    AsyncStorage.getItem(key + '.pending'),
  ]);
  const valid: CareerSave[] = [];
  for (const raw of candidates) {
    if (!raw) continue;
    try {
      const slot = JSON.parse(raw) as CareerSave;
      if (
        slot.schemaVersion !== 3 ||
        slot.checksum !== stateChecksum(slot.state)
      )
        continue;
      assertWorld(slot.state);
      valid.push(slot);
    } catch {
      /* Try the other phase without overwriting either. */
    }
  }
  if (!valid.length) throw new Error('No intact compatible save was found.');
  valid.sort((a, b) => b.state.revision - a.state.revision);
  return valid[0].state;
}
export async function listCareers(): Promise<WorldState[]> {
  const keys = await AsyncStorage.getAllKeys();
  const ids = [
    ...new Set(
      keys
        .filter(k => k.startsWith(PREFIX))
        .map(k => k.slice(PREFIX.length).replace(/\.pending$/, '')),
    ),
  ];
  const results = await Promise.all(
    ids.map(id => loadCareer(id).catch(() => null)),
  );
  return results
    .filter((s): s is WorldState => s !== null)
    .sort((a, b) => b.day - a.day);
}
export async function listLegacyArchives(): Promise<LegacyArchive[]> {
  const keys = (await AsyncStorage.getAllKeys()).filter(
    k => k.startsWith('@pss/save-v1/') && !k.endsWith('.pending'),
  );
  const result = await Promise.all(
    keys.map(async key => {
      try {
        const slot = JSON.parse((await AsyncStorage.getItem(key)) ?? 'null');
        const s = slot?.state;
        if (!s || ![1, 2].includes(s.schemaVersion)) return null;
        return {
          id: s.id,
          name: s.scenarioName,
          mode: s.mode,
          turn: s.turn,
          status: s.status,
          history: s.history ?? [],
          result: s.result,
        } as LegacyArchive;
      } catch {
        return null;
      }
    }),
  );
  return result.filter((x): x is LegacyArchive => x !== null);
}
