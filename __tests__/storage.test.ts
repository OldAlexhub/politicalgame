/* eslint-disable no-bitwise */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {createCampaign, processTurn} from '../src/game/engine';
import {
  ACHIEVEMENTS, clearSavedCampaigns, deleteSave, listSaves, loadAchievements, loadCampaign,
  loadSettings, saveCampaign, saveSettings, unlockAchievements,
} from '../src/services/storage';

beforeEach(() => AsyncStorage.clear());

test('save, restore, list, and delete preserve the committed campaign', async () => {
  const state = createCampaign({mode: 'monarchy', seed: 42, createdAt: '2026-01-01T00:00:00.000Z'});
  await saveCampaign(state, 'Test crown');
  expect(await loadCampaign(state.id)).toEqual(state);
  expect((await listSaves())[0].name).toBe('Test crown');
  await deleteSave(state.id);
  expect(await listSaves()).toEqual([]);
});

test('migrates a version 1 save atomically and preserves pending consequences', async () => {
  const original = processTurn(createCampaign({mode: 'dictatorship', seed: 99, createdAt: '2026-01-01T00:00:00.000Z'}), {id: 'economic-reform'}).state;
  const legacy: any = JSON.parse(JSON.stringify(original));
  legacy.schemaVersion = 1;
  delete legacy.lastTurnReport;
  delete legacy.lastAcknowledgedReportId;
  legacy.history.forEach((record: any) => {
    delete record.resolutionId;
    delete record.timing;
    delete record.sourceActionId;
    delete record.sourceRecordId;
    delete record.targetId;
    delete record.impacts;
  });
  legacy.scheduledEffects.forEach((effect: any) => {
    delete effect.createdTurn;
    delete effect.sourceActionId;
    delete effect.sourceRecordId;
    delete effect.sourceResolutionId;
    delete effect.targetId;
  });
  const rawState = JSON.stringify(legacy);
  const slot = {schemaVersion: 1, slotId: legacy.id, name: 'Legacy republic', state: legacy, checksum: testChecksum(rawState), savedAt: '2026-01-01T00:00:00.000Z'};
  await AsyncStorage.setItem(`@pss/save-v1/${legacy.id}`, JSON.stringify(slot));
  await AsyncStorage.setItem('@pss/save-index-v1', JSON.stringify([legacy.id]));

  const migrated = await loadCampaign(legacy.id);
  expect(migrated.schemaVersion).toBe(2);
  expect(migrated.scheduledEffects).toHaveLength(1);
  expect(migrated.scheduledEffects[0].dueTurn).toBe(original.scheduledEffects[0].dueTurn);
  expect(migrated.history.every(record => record.legacy)).toBe(true);
  const committed = JSON.parse((await AsyncStorage.getItem(`@pss/save-v1/${legacy.id}`))!);
  expect(committed.schemaVersion).toBe(2);
  expect(committed.state.schemaVersion).toBe(2);
  expect(committed.checksum).toBe(testChecksum(JSON.stringify(committed.state)));
});

test('clears every saved game while preserving settings and achievements', async () => {
  const first = createCampaign({mode: 'presidential', seed: 12});
  const second = createCampaign({mode: 'monarchy', seed: 13});
  await saveCampaign(first);
  await saveCampaign(second);
  await AsyncStorage.setItem('@pss/save-v1/orphan.pending', 'orphan');
  await saveSettings({...await loadSettings(), reduceMotion: true});
  await unlockAchievements(processTurn(first, {id: 'fundraise'}).state);

  await clearSavedCampaigns();

  expect(await listSaves()).toEqual([]);
  expect(await loadSettings()).toMatchObject({reduceMotion: true});
  expect(await loadAchievements()).toContain('first-decision');
  expect((await AsyncStorage.getAllKeys()).some(key => key.startsWith('@pss/save-v1/'))).toBe(false);
});

test('unlocks expanded campaign milestones', async () => {
  const state = processTurn(createCampaign({mode: 'presidential', difficulty: 'strategist', seed: 14}), {id: 'fundraise'}).state;
  state.turn = 10;
  state.treasury = 9000;
  state.publicSentiment = 7100;
  state.legitimacy = 7200;
  state.momentum = 7300;
  state.factions.forEach(faction => { faction.support = 6600; });
  state.institutions.forEach(institution => { institution.confidence = 6700; });
  state.economy = {...state.economy, growth: 6100, employment: 6200, resilience: 6300};
  state.status = 'victory';

  const unlocked = await unlockAchievements(state);

  expect(ACHIEVEMENTS).toHaveLength(16);
  expect(unlocked).toEqual(expect.arrayContaining([
    'first-decision', 'strategic-horizon', 'campaign-veteran', 'full-treasury',
    'popular-mandate', 'legitimate-authority', 'momentum-surge', 'broad-coalition',
    'united-front', 'institution-builder', 'resilient-economy', 'presidential-victory',
    'master-strategist',
  ]));
});

function testChecksum(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
