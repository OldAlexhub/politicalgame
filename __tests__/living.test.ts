import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  activeSituations,
  assertWorld,
  createWorld,
  dispatchCommand,
  getDecisionPreview,
  replayCommands,
  stateChecksum,
  stepSimulation,
} from '../packages/simulation';
import { SimulationClock } from '../src/living/clock';
import {
  listLegacyArchives,
  loadCareer,
  saveCareer,
} from '../src/living/storage';

describe('the living political simulation', () => {
  test('replays commands identically and does not mutate input', () => {
    const initial = createWorld({ seed: 219 });
    const before = JSON.stringify(initial);
    let s = dispatchCommand(initial, {
      id: 'promise',
      targetId: 'r0',
      option: 'clinic',
    });
    s = stepSimulation(s, 10);
    s = dispatchCommand(s, { id: 'project', targetId: 'r0', option: 'clinic' });
    s = stepSimulation(s, 160);
    const replay = replayCommands(initial, s.journal, s.day);
    expect(stateChecksum(replay)).toBe(stateChecksum(s));
    expect(JSON.stringify(initial)).toBe(before);
  });
  test('different seeds generate different countries, actors and grievances', () => {
    const a = createWorld({ seed: 11 }),
      b = createWorld({ seed: 12 });
    expect(a.name).not.toBe(b.name);
    expect(a.actors).not.toEqual(b.actors);
    expect(a.regions.map(r => r.services)).not.toEqual(
      b.regions.map(r => r.services),
    );
  });
  test('fuel support affects real households and the recurring budget', () => {
    const base = createWorld({ seed: 21 });
    const cut = dispatchCommand(base, { id: 'subsidy', value: 0 });
    expect(cut.regions[0].cohorts[0].needs.energy).toBeLessThan(
      base.regions[0].cohorts[0].needs.energy,
    );
    expect(cut.budget.expenses).toBeLessThan(base.budget.expenses);
    expect(cut.factions[0].support).toBeLessThan(base.factions[0].support);
    expect(cut.actors[0].trust).toEqual(base.actors[0].trust);
  });
  test('tax changes produce different reactions from workers and owners', () => {
    const s = createWorld({ seed: 22 });
    const n = dispatchCommand(s, { id: 'tax', value: 34 });
    expect(n.factions[3].support).toBeLessThan(s.factions[3].support);
    expect(n.factions[0].support).toBeGreaterThan(s.factions[0].support);
    expect(n.actors[3].memories.at(-1)?.subject).toBe('Tax settlement');
  });
  test('promised clinics are delivered through projects and staff, not instant approval boosts', () => {
    let s = createWorld({ seed: 2 });
    s.regions[0].capacity = 9000;
    s.regions[0].staffing = 9000;
    s.regions[0].corruption = 0;
    const withoutProject = stepSimulation(s, 100);
    s = dispatchCommand(s, { id: 'promise', targetId: 'r0', option: 'clinic' });
    s = dispatchCommand(s, { id: 'project', targetId: 'r0', option: 'clinic' });
    const health = withoutProject.regions[0].cohorts[0].needs.health;
    s = stepSimulation(s, 100);
    expect(s.projects[0].status).toBe('operating');
    expect(s.commitments[0].status).toBe('fulfilled');
    expect(s.regions[0].cohorts[0].needs.health).toBeGreaterThan(health);
  });
  test('broken promises stay in history and actor memory', () => {
    let s = dispatchCommand(createWorld({ seed: 9 }), {
      id: 'promise',
      targetId: 'r0',
      option: 'power',
    });
    s = stepSimulation(s, 181);
    expect(s.commitments[0].status).toBe('broken');
    expect(
      s.actors[0].memories.some(m => m.subject === 'Broken public commitment'),
    ).toBe(true);
    expect(s.news.some(n => n.title === 'A promise becomes a liability')).toBe(
      true,
    );
  });
  test('unaddressed service failures develop into organized action', () => {
    let s = createWorld({ seed: 8 });
    s.regions[0].services = 1000;
    s = stepSimulation(s, 100);
    expect(
      activeSituations(s).some(
        i => i.regionId === 'r0' && ['protest', 'strike'].includes(i.stage),
      ),
    ).toBe(true);
  });
  test('war weariness requires a real war and resolves after peace', () => {
    let s = createWorld({ seed: 5 });
    s.neighbors.forEach(n => {
      n.aggression = 0;
      n.relation = 50;
    });
    s = stepSimulation(s, 300);
    expect(activeSituations(s).filter(i => i.kind === 'war')).toHaveLength(0);
    s.movement.influence = 100;
    s.role = 'government';
    s = dispatchCommand(s, {
      id: 'border-conflict',
      targetId: s.neighbors[0].id,
    });
    s = stepSimulation(s, 30);
    expect(activeSituations(s).some(i => i.kind === 'war')).toBe(true);
    s = dispatchCommand(s, { id: 'peace', targetId: s.neighbors[0].id });
    expect(activeSituations(s).some(i => i.kind === 'war')).toBe(false);
  });
  test('an election defeat leads to playable opposition', () => {
    let s = createWorld({ seed: 7 });
    s.electionDay = 1;
    s.regions.forEach(r =>
      r.cohorts.forEach(c => {
        c.support = 500;
      }),
    );
    s = stepSimulation(s, 1);
    expect(s.role).toBe('opposition');
    expect(s.status).toBe('active');
    expect(
      getDecisionPreview(s, { id: 'project', targetId: 'r0', option: 'clinic' })
        .allowed,
    ).toBe(false);
    expect(
      getDecisionPreview(s, { id: 'organize', targetId: 'r0' }).allowed,
    ).toBe(true);
    s = dispatchCommand(s, { id: 'organize', targetId: 'r0' });
    expect(s.journal.at(-1)?.command.id).toBe('organize');
  });
  test('constitutional reform and a successor retain obligations', () => {
    let s = dispatchCommand(createWorld({ seed: 42 }), {
      id: 'promise',
      targetId: 'r0',
      option: 'clinic',
    });
    s = dispatchCommand(s, {
      id: 'reform',
      targetId: 'assembly',
      option: 'monarchy',
    });
    s.movement.influence = 100;
    s = dispatchCommand(s, { id: 'succession', targetId: 'a1' });
    expect(s.regime).toBe('monarchy');
    expect(s.leader.generation).toBe(2);
    expect(s.commitments[0].status).toBe('open');
  });
  test('repeated command identifiers are idempotent and conflicting reuse is rejected', () => {
    const cmd = { id: 'organize' as const, targetId: 'r0', clientId: 'unique' };
    const s = dispatchCommand(createWorld({ seed: 8 }), cmd);
    expect(dispatchCommand(s, cmd)).toBe(s);
    expect(() => dispatchCommand(s, { ...cmd, targetId: 'r1' })).toThrow(
      'reused',
    );
  });
  test('long-running countries retain finite, legal states', () => {
    for (let seed = 0; seed < 5; seed++) {
      const s = stepSimulation(createWorld({ seed }), 3600);
      assertWorld(s);
      expect(
        getDecisionPreview(s, { id: 'organize', targetId: 'r0' }).allowed,
      ).toBe(true);
    }
  }, 30000);
});
describe('clock and durable careers', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });
  test('pausing or background stalls cannot accrue catch-up days', () => {
    const clock = new SimulationClock();
    clock.reset(1000);
    expect(clock.sample(1250, 4)).toBe(0);
    expect(clock.sample(1500, 0)).toBe(0);
    expect(clock.sample(600000, 4)).toBe(0);
    expect(clock.sample(600250, 4)).toBe(0);
  });
  test('a save reloads exactly and recovers a valid pending phase', async () => {
    const s = stepSimulation(createWorld({ seed: 91 }), 44);
    await saveCareer(s);
    expect(await loadCareer(s.id)).toEqual(s);
    const key = `@pss/career-v3/${s.id}`;
    const valid = await AsyncStorage.getItem(key);
    await AsyncStorage.setItem(key + '.pending', valid!);
    await AsyncStorage.setItem(key, 'invalid');
    expect(await loadCareer(s.id)).toEqual(s);
  });
  test('legacy archives are read without rewriting old saves', async () => {
    const raw = JSON.stringify({
      state: {
        schemaVersion: 2,
        id: 'old',
        scenarioName: 'Old Republic',
        mode: 'dictatorship',
        turn: 10,
        status: 'active',
        history: [{ title: 'Promise', detail: 'Preserved' }],
      },
    });
    await AsyncStorage.setItem('@pss/save-v1/old', raw);
    expect((await listLegacyArchives())[0].history[0].detail).toBe('Preserved');
    expect(await AsyncStorage.getItem('@pss/save-v1/old')).toBe(raw);
  });
});
test('opposition campaigning spends movement funds and cannot spend public money',()=>{
  const s=createWorld({seed:31,start:'opposition'});const next=dispatchCommand(s,{id:'campaign',targetId:'r0'});
  expect(next.treasury).toBe(s.treasury);expect(next.movement.funds).toBe(s.movement.funds-80);
  expect(getDecisionPreview(s,{id:'subsidy',value:60}).allowed).toBe(false);
});
test('counteroffers can be accepted before their deadlines and expire with a remembered consequence',()=>{
  const initial=createWorld({seed:41,start:'opposition'});initial.actors[0].trust=0;initial.actors[0].ambition=9000;
  const opened=dispatchCommand(initial,{id:'negotiate',targetId:'a0',option:'policy'});
  expect(opened.negotiations[0].status).toBe('counteroffer');expect(opened.negotiations[0].requested).toBe('funding');
  const ready=stepSimulation(opened,14);const accepted=dispatchCommand(ready,{id:'negotiate',targetId:'a0',option:'counteroffer'});
  expect(accepted.negotiations[0].status).toBe('agreed');expect(accepted.movement.funds).toBe(ready.movement.funds-300);
  const expired=stepSimulation(opened,31);expect(expired.negotiations[0].status).toBe('expired');expect(expired.actors[0].memories.some(m=>m.subject==='An unanswered counteroffer')).toBe(true);
});
test('a coup changes authority without deleting the movement or its promises',()=>{
  let s=dispatchCommand(createWorld({seed:18,start:'opposition'}),{id:'promise',targetId:'r0',option:'housing'});
  s.movement.organization=10000;s.movement.influence=100;s.factions[5].support=10000;s.actors.filter(a=>a.factionId==='f5').forEach(a=>a.loyalty=10000);
  const next=dispatchCommand(s,{id:'coup'});expect(next.role).toBe('government');expect(next.regime).toBe('autocracy');expect(next.commitments).toEqual(s.commitments);expect(next.legitimacy).toBeLessThan(s.legitimacy);expect(next.journal).toHaveLength(2);
});
test('insolvency has persistent domestic consequences and a playable recovery',()=>{
  const s=createWorld({seed:17});s.debt=30500;s.treasury=0;s.taxRate=0;
  const next=stepSimulation(s,30);expect(next.debt).toBe(16000);expect(next.news.some(n=>n.title==='The sovereign misses its obligations')).toBe(true);expect(next.foreignPressureUntil).toBeGreaterThan(next.day);expect(getDecisionPreview(next,{id:'restructure'}).allowed).toBe(true);
  const settlement=dispatchCommand(next,{id:'restructure'});expect(settlement.debt).toBeLessThan(next.debt);expect(settlement.legitimacy).toBeLessThan(next.legitimacy);
});
test('the full causal record survives multi-year play',()=>{
  const initial=createWorld({seed:21});const first=initial.news[0];const state=stepSimulation(initial,3600);
  expect(state.news.length).toBeGreaterThan(240);expect(state.news.find(n=>n.id===first.id)).toEqual(first);
});
