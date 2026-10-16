import {createCampaign, extractFeatures, forecastAction, getLegalActions, processTurn, SimulationError} from '../src/game/engine';
import {getCampaignClock} from '../src/game/campaignClock';
import {TOTAL_ELECTORAL_VOTES} from '../src/game/data/usStates';
import {ActionInput, GameMode, GameState} from '../src/game/types';

const golden = require('../../shared/golden-initial-states-v1.json') as {cases: Record<GameMode, number[]>};

function firstInput(state: GameState): ActionInput {
  const action = getLegalActions(state)[0];
  if (!action) throw new Error('No legal action');
  const targets = action.target === 'region' ? state.regions : action.target === 'faction' ? state.factions : action.target === 'actor' ? state.actors : action.target === 'institution' ? state.institutions : [];
  return {id: action.id, targetId: action.target === 'none' ? undefined : targets[0].id};
}

function complete(state: GameState) {
  let next = state;
  let guard = 0;
  while (next.status === 'active' && guard < 100) {
    next = processTurn(next, firstInput(next)).state;
    guard += 1;
  }
  return next;
}

describe('deterministic simulation engine', () => {
  it('uses the documented 538-vote Electoral College', () => expect(TOTAL_ELECTORAL_VOTES).toBe(538));

  it.each<GameMode>(['presidential', 'dictatorship', 'monarchy', 'coup'])('matches the shared Python golden observation for %s', mode => {
    expect(extractFeatures(createCampaign({mode, seed: 12345}))).toEqual(golden.cases[mode]);
  });

  it('produces identical states and experiences for the same seed and actions', () => {
    const options = {mode: 'presidential' as const, seed: 918273, createdAt: '2026-01-01T00:00:00.000Z'};
    const first = processTurn(createCampaign(options), {id: 'advertise', targetId: 'pa'});
    const second = processTurn(createCampaign(options), {id: 'advertise', targetId: 'pa'});
    expect(first.state).toEqual(second.state);
    expect(first.experience).toEqual(second.experience);
    expect(first.report).toEqual(second.report);
  });

  it.each([
    ['presidential', 1, 14, 'Week 1', '14 weeks remain'],
    ['dictatorship', 18, 18, 'Month 18', '1 month remains'],
    ['monarchy', 5, 18, 'Spring, Year 2', '14 seasons remain'],
    ['coup', 12, 12, 'Days 34–36', '3 days remain'],
  ] as const)('formats the %s campaign clock', (mode, turn, maxTurns, period, remaining) => {
    const clock = getCampaignClock(mode, turn, maxTurns);
    expect(clock.periodLabel).toBe(period);
    expect(clock.remainingLabel).toBe(remaining);
  });

  it('creates a causal report with costs, reactions, dynamics, and exact momentum attribution', () => {
    const state = createCampaign({mode: 'presidential', seed: 22, createdAt: '2026-01-01T00:00:00.000Z'});
    const result = processTurn(state, {id: 'rally', targetId: 'pa'});
    expect(result.report.timeLabel).toBe('Week 1');
    expect(result.report.actionLabel).toBe('Organize rally');
    expect(result.report.targetName).toBe('Pennsylvania');
    expect(result.report.sections.map(section => section.timing)).toEqual(expect.arrayContaining(['immediate', 'opponent', 'systemic']));
    expect(result.report.sections.flatMap(section => section.impacts)).toEqual(expect.arrayContaining([
      expect.objectContaining({path: 'treasury', amount: -450}),
      expect.objectContaining({path: 'region.support', targetId: 'pa'}),
    ]));
    expect(result.report.momentum.delta).toBe(result.state.momentum - state.momentum);
    expect(result.state.history.filter(record => record.resolutionId === result.report.id).length).toBe(result.report.sections.length);
  });

  it('forecasts ranges and due dates without mutating state or consuming randomness', () => {
    const state = createCampaign({mode: 'dictatorship', seed: 23, createdAt: '2026-01-01T00:00:00.000Z'});
    const snapshot = JSON.stringify(state);
    const action = getLegalActions(state).find(item => item.id === 'economic-reform')!;
    const forecast = forecastAction(state, action);
    expect(forecast.delayed?.dueLabel).toBe('Month 4');
    expect(forecast.immediate[0].minimum).toBeLessThanOrEqual(action.effects[0].amount);
    expect(forecast.immediate[0].maximum).toBeGreaterThanOrEqual(action.effects[0].amount);
    expect(JSON.stringify(state)).toBe(snapshot);
    expect(state.randomState).toBe(23);
  });

  it('rejects unknown actions and invalid targets', () => {
    const state = createCampaign({mode: 'presidential', seed: 1});
    expect(() => processTurn(state, {id: 'invent-action'})).toThrow(SimulationError);
    expect(() => processTurn(state, {id: 'rally', targetId: 'not-a-state'})).toThrow('Choose a valid region');
  });

  it('applies costs, actor memories, AI response, and bounded metrics', () => {
    const state = createCampaign({mode: 'dictatorship', seed: 2});
    const next = processTurn(state, {id: 'broker-coalition', targetId: 'technocrats'}).state;
    expect(next.influence).toBeLessThan(state.influence);
    expect(next.actors.every(actor => actor.memory.length === 1)).toBe(true);
    expect(next.history.some(record => record.kind === 'opponent')).toBe(true);
    for (const value of extractFeatures(next)) expect(value).toBeGreaterThanOrEqual(0);
    for (const value of extractFeatures(next)) expect(value).toBeLessThanOrEqual(1.8);
  });

  it('schedules and later resolves delayed economic consequences', () => {
    let state = createCampaign({mode: 'dictatorship', seed: 3});
    const reform = processTurn(state, {id: 'economic-reform'});
    state = reform.state;
    expect(state.scheduledEffects).toHaveLength(1);
    expect(state.scheduledEffects[0]).toEqual(expect.objectContaining({createdTurn: 1, dueTurn: 4, sourceActionId: 'economic-reform', sourceResolutionId: reform.report.id}));
    let finalReport = reform.report;
    while (state.status === 'active' && state.turn < 4) {
      const turn = processTurn(state, firstInput(state));
      state = turn.state;
      finalReport = turn.report;
    }
    expect(state.history.some(record => record.title === 'Economic reform')).toBe(true);
    expect(finalReport.sections.some(section => section.timing === 'delayed' && section.title === 'Economic reform')).toBe(true);
    expect(state.scheduledEffects).toHaveLength(0);
  });

  it.each<GameMode>(['presidential', 'dictatorship', 'monarchy', 'coup'])('can complete a %s campaign end-to-end', mode => {
    const result = complete(createCampaign({mode, seed: 8400, createdAt: '2026-01-01T00:00:00.000Z'}));
    expect(result.status).not.toBe('active');
    expect(result.result?.summary.length).toBeGreaterThan(20);
    expect(result.actionHistory.length).toBeGreaterThan(2);
  });

  it('resolves every electoral vote to one candidate on election night', () => {
    const result = complete(createCampaign({mode: 'presidential', seed: 2048, createdAt: '2026-01-01T00:00:00.000Z'}));
    expect((result.result?.playerElectoralVotes ?? 0) + (result.result?.opponentElectoralVotes ?? 0)).toBe(538);
    expect(Object.keys(result.result?.regionalResults ?? {})).toHaveLength(51);
  });

  it('handles extreme political conditions as a coherent defeat', () => {
    const state = createCampaign({mode: 'coup', seed: 77});
    state.legitimacy = 1;
    const result = processTurn(state, firstInput(state)).state;
    expect(result.status).toBe('defeat');
    expect(result.result?.ending).toBe('Political collapse');
  });
});
