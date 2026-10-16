import {CANDIDATES, createScenario, getActions} from './scenarios';
import {formatCampaignMoment} from './campaignClock';
import {nextRandom, randomBetween, stableId} from './rng';
import {
  ActionDefinition, ActionForecast, ActionInput, CampaignResult, Difficulty, EventChoice, GameMode,
  GameState, GameplayExperience, HistoricalRecord, ImpactTiming, MetricChange, MetricImpact,
  PoliticalEvent, TurnReport, TurnResult,
} from './types';

export const ENGINE_VERSION = '1.0.0';
export const BASELINE_POLICY_VERSION = 'rules-1.0.0';

export class SimulationError extends Error {
  constructor(public code: 'CAMPAIGN_ENDED' | 'UNKNOWN_ACTION' | 'ILLEGAL_ACTION' | 'INVALID_TARGET' | 'INSUFFICIENT_RESOURCE', message: string) {
    super(message);
    this.name = 'SimulationError';
  }
}

export interface CreateCampaignOptions {
  mode: GameMode;
  difficulty?: Difficulty;
  candidateId?: string;
  seed?: number;
  createdAt?: string;
}

export function createCampaign(options: CreateCampaignOptions): GameState {
  const seed = Math.abs(Math.trunc(options.seed ?? Date.now())) % 4294967296;
  const difficulty = options.difficulty ?? 'standard';
  const scenario = createScenario(options.mode);
  const difficultyDelta = difficulty === 'veteran' ? -300 : difficulty === 'strategist' ? -600 : 0;
  const createdAt = options.createdAt ?? new Date().toISOString();
  return {
    schemaVersion: 2,
    engineVersion: ENGINE_VERSION,
    id: stableId(options.mode, seed, 0),
    mode: options.mode,
    difficulty,
    candidate: CANDIDATES.find(candidate => candidate.id === options.candidateId) ?? CANDIDATES[0],
    seed,
    randomState: seed,
    turn: 1,
    status: 'active',
    phase: phaseFor(options.mode, 1, scenario.maxTurns),
    ...scenario,
    treasury: Math.max(1000, scenario.treasury + difficultyDelta),
    momentum: clamp(scenario.momentum + difficultyDelta),
    scheduledEffects: [],
    pendingEvent: null,
    seenEvents: [],
    history: [{id: stableId('history', seed, 0), turn: 0, kind: 'system', timing: 'systemic', title: scenario.scenarioName, detail: 'The campaign begins. Every decision will shape this political system.'}],
    actionHistory: [],
    policyVersion: BASELINE_POLICY_VERSION,
    createdAt,
    updatedAt: createdAt,
  };
}

export function getLegalActions(state: GameState): ActionDefinition[] {
  if (state.status !== 'active') return [];
  if (state.pendingEvent) {
    return state.pendingEvent.choices.map(eventChoice => ({
      id: `event:${eventChoice.id}`,
      label: eventChoice.label,
      description: eventChoice.description,
      category: 'policy',
      cost: {},
      target: 'none',
      effects: eventChoice.effects,
      delayedEffects: eventChoice.delayedEffects,
    }));
  }
  return getActions(state.mode).filter(action => {
    if ((action.minimumTurn ?? 0) > state.turn) return false;
    if (action.once && state.actionHistory.some(previous => previous.id === action.id)) return false;
    return Object.entries(action.cost).every(([key, amount]) => state[key as 'treasury' | 'influence' | 'legitimacy'] >= (amount ?? 0));
  });
}

export function validateAction(state: GameState, input: ActionInput): ActionDefinition {
  if (state.status !== 'active') throw new SimulationError('CAMPAIGN_ENDED', 'This campaign has already ended.');
  const action = getLegalActions(state).find(item => item.id === input.id);
  if (!action) {
    const exists = state.pendingEvent ? input.id.startsWith('event:') : getActions(state.mode).some(item => item.id === input.id);
    throw new SimulationError(exists ? 'ILLEGAL_ACTION' : 'UNKNOWN_ACTION', exists ? 'That action is not currently available.' : 'Unknown action.');
  }
  const targets = action.target === 'region' ? state.regions : action.target === 'faction' ? state.factions : action.target === 'actor' ? state.actors : action.target === 'institution' ? state.institutions : [];
  if (action.target !== 'none' && !targets.some(target => target.id === input.targetId)) {
    throw new SimulationError('INVALID_TARGET', `Choose a valid ${action.target}.`);
  }
  for (const [key, amount] of Object.entries(action.cost)) {
    if (state[key as 'treasury' | 'influence' | 'legitimacy'] < (amount ?? 0)) {
      throw new SimulationError('INSUFFICIENT_RESOURCE', `Not enough ${key}.`);
    }
  }
  return action;
}

export function forecastAction(state: GameState, action: ActionDefinition, targetId?: string): ActionForecast {
  const band = (change: MetricChange) => {
    const target = targetForPath(change.path, change.targetId, targetId);
    const lower = Math.round(change.amount * 0.85);
    const upper = Math.round(change.amount * 1.15);
    return {
      path: change.path,
      targetId: target,
      minimum: Math.min(lower, upper),
      maximum: Math.max(lower, upper),
    };
  };
  return {
    costs: Object.entries(action.cost)
      .filter((entry): entry is ['treasury' | 'influence' | 'legitimacy', number] => Boolean(entry[1]))
      .map(([resource, amount]) => ({resource, amount})),
    immediate: action.effects.map(band),
    delayed: action.delayedEffects ? {
      dueTurn: state.turn + action.delayedEffects.delay,
      dueLabel: formatCampaignMoment(state.mode, state.turn + action.delayedEffects.delay),
      impacts: action.delayedEffects.changes.map(band),
    } : undefined,
  };
}

export function processTurn(current: GameState, input: ActionInput, aiDirective?: number): TurnResult {
  const action = validateAction(current, input);
  const state: GameState = JSON.parse(JSON.stringify(current));
  const before = extractFeatures(state);
  const legalActions = getLegalActions(current).map(item => item.id);
  const records: HistoricalRecord[] = [];
  const previousTurn = state.turn;
  const phaseBefore = state.phase;
  const resolutionId = stableId('resolution', state.seed, previousTurn);
  const momentumBefore = state.momentum;
  const targetName = findTargetName(state, input.targetId);
  const decisionBefore = captureMetrics(state);

  for (const [key, amount] of Object.entries(action.cost)) {
    const resource = key as 'treasury' | 'influence' | 'legitimacy';
    const beforeCost = state[resource];
    state[resource] = Math.max(0, beforeCost - (amount ?? 0));
  }
  applyChanges(state, action.effects, input.targetId);
  if (input.id === 'advertise' || input.id === 'rally' || input.id === 'invest-region') {
    const region = state.regions.find(item => item.id === input.targetId);
    if (region) region.investment += input.id === 'advertise' ? 700 : input.id === 'rally' ? 450 : 750;
  }
  updateActorMemory(state, input, changesToDeltas(action.effects, input.targetId));
  const decisionImpacts = diffMetrics(decisionBefore, state);
  const detail = state.pendingEvent ? `Response chosen: ${action.label}.` : describeAction(state, action, input.targetId);
  const decisionRecord = record(state, 'decision', action.label, detail, {
    resolutionId, timing: 'immediate', sourceActionId: input.id, targetId: input.targetId,
    impacts: decisionImpacts,
  });
  records.push(decisionRecord);
  const newlyScheduled = [] as GameState['scheduledEffects'];
  if (action.delayedEffects) {
    const scheduled = {
      id: stableId('effect', state.seed, state.actionHistory.length + state.scheduledEffects.length + 1),
      dueTurn: state.turn + action.delayedEffects.delay,
      source: action.delayedEffects.source,
      changes: action.delayedEffects.changes,
      narrative: action.delayedEffects.narrative,
      createdTurn: state.turn,
      sourceActionId: input.id,
      sourceRecordId: decisionRecord.id,
      sourceResolutionId: resolutionId,
      targetId: input.targetId,
    };
    state.scheduledEffects.push(scheduled);
    newlyScheduled.push(scheduled);
  }
  if (state.pendingEvent) state.pendingEvent = null;
  state.actionHistory.push(input);

  const opponentBefore = captureMetrics(state);
  const aiActions = [resolveOpponent(state, records, aiDirective)];
  enrichLatestRecord(records, 'opponent', resolutionId, 'opponent', diffMetrics(opponentBefore, state));
  const dynamicsBefore = captureMetrics(state);
  applyPoliticalDynamics(state);
  const dynamicsImpacts = diffMetrics(dynamicsBefore, state);
  if (dynamicsImpacts.length) {
    records.push(record(state, 'system', 'Underlying political dynamics', describeDynamics(dynamicsImpacts), {
      resolutionId, timing: 'systemic', impacts: dynamicsImpacts,
    }));
  }
  state.turn += 1;
  resolveScheduledEffects(state, records, resolutionId);
  ageCharactersIfNeeded(state);
  maybeCreateEvent(state, records, resolutionId);
  evaluateCampaign(state, records, resolutionId);
  state.phase = phaseFor(state.mode, state.turn, state.maxTurns);
  state.updatedAt = deterministicTimestamp(state.createdAt, state.turn);
  state.history.push(...records);

  const sections = records.map(item => ({
    id: item.id,
    timing: item.timing ?? timingForKind(item.kind),
    title: item.title,
    detail: item.detail,
    impacts: item.impacts ?? [],
    sourceRecordId: item.sourceRecordId,
  }));
  const createdEvent = (state as GameState).pendingEvent;
  const report: TurnReport = {
    id: resolutionId,
    turn: previousTurn,
    timeLabel: formatCampaignMoment(state.mode, previousTurn),
    nextTimeLabel: state.status === 'active' ? formatCampaignMoment(state.mode, state.turn) : 'Campaign complete',
    actionId: input.id,
    actionLabel: action.label,
    targetId: input.targetId,
    targetName,
    phaseBefore,
    phaseAfter: state.phase,
    phaseChanged: phaseBefore !== state.phase,
    sections,
    scheduled: newlyScheduled.map(effect => ({
      id: effect.id,
      source: effect.source,
      dueTurn: effect.dueTurn,
      dueLabel: formatCampaignMoment(state.mode, effect.dueTurn),
      changes: effect.changes,
      targetId: effect.targetId,
    })),
    momentum: {
      before: momentumBefore,
      after: state.momentum,
      delta: state.momentum - momentumBefore,
      contributors: sections.flatMap(section => section.impacts
        .filter(impact => impact.path === 'momentum' && impact.amount !== 0)
        .map(impact => ({label: section.title, amount: impact.amount}))),
    },
    event: createdEvent ? {
      id: createdEvent.id,
      title: createdEvent.title,
      narrative: createdEvent.narrative,
      severity: createdEvent.severity,
    } : undefined,
    result: state.result,
  };
  state.lastTurnReport = report;

  const rewardSignals = calculateReward(current, state);
  const experience: GameplayExperience = {
    schemaVersion: 1,
    gameMode: state.mode,
    engineVersion: state.engineVersion,
    policyVersion: state.policyVersion,
    gameId: state.id,
    turnNumber: previousTurn,
    stateFeatures: before,
    legalActions,
    playerAction: input,
    aiActions,
    nextStateFeatures: extractFeatures(state),
    rewardSignals,
    terminal: state.status !== 'active',
    outcome: state.status === 'active' ? null : state.status,
  };
  return {state, records, experience, report};
}

function applyChanges(state: GameState, changes: MetricChange[], suppliedTarget?: string): MetricImpact[] {
  const impacts: MetricImpact[] = [];
  for (const change of changes) {
    const targetId = targetForPath(change.path, change.targetId, suppliedTarget);
    const before = readMetric(state, change.path, targetId);
    if (before === undefined) continue;
    if (change.path.startsWith('economy.')) {
      const key = change.path.split('.')[1] as keyof GameState['economy'];
      state.economy[key] = clamp(state.economy[key] + change.amount);
    } else if (change.path.startsWith('faction.')) {
      const faction = state.factions.find(item => item.id === targetId);
      if (faction) {
        const key = change.path.split('.')[1] as 'support' | 'cohesion' | 'influence';
        faction[key] = clamp(faction[key] + change.amount);
      }
    } else if (change.path === 'institution.confidence') {
      const institution = state.institutions.find(item => item.id === targetId);
      if (institution) institution.confidence = clamp(institution.confidence + change.amount);
    } else if (change.path.startsWith('region.')) {
      const region = state.regions.find(item => item.id === targetId);
      if (region) {
        const key = change.path.split('.')[1] as 'support' | 'opponentSupport' | 'undecided' | 'investment';
        region[key] = key === 'investment' ? Math.max(0, region[key] + change.amount) : clamp(region[key] + change.amount);
        if (key === 'support') {
          region.undecided = Math.max(100, region.undecided - Math.max(0, change.amount / 3));
          region.opponentSupport = clamp(10000 - region.support - region.undecided);
        }
      }
    } else if (change.path.startsWith('actor.')) {
      const actor = state.actors.find(item => item.id === targetId);
      if (actor) {
        const key = change.path.split('.')[1] as 'trust' | 'loyalty';
        actor[key] = clamp(actor[key] + change.amount);
      }
    } else {
      const key = change.path as 'publicSentiment' | 'legitimacy' | 'momentum' | 'treasury' | 'influence';
      state[key] = key === 'treasury' || key === 'influence' ? Math.max(0, state[key] + change.amount) : clamp(state[key] + change.amount);
    }
    const after = readMetric(state, change.path, targetId);
    if (after !== undefined) impacts.push({path: change.path, targetId, before, after, amount: after - before});
  }
  return impacts;
}

function resolveOpponent(state: GameState, records: HistoricalRecord[], directive?: number): ActionInput {
  const difficultyBoost = state.difficulty === 'standard' ? 0 : state.difficulty === 'veteran' ? 90 : 170;
  if (directive !== undefined && directive >= 0 && directive <= 7) return resolvePolicyDirective(state, records, directive, difficultyBoost);
  if (state.mode === 'presidential') {
    const target = [...state.regions].sort((a, b) => Math.abs(a.support - 5000) - Math.abs(b.support - 5000) || b.electoralVotes! - a.electoralVotes!)[0];
    const sample = randomBetween(state.randomState, 180, 320 + difficultyBoost);
    state.randomState = sample.state;
    target.support = clamp(target.support - sample.value);
    target.opponentSupport = clamp(10000 - target.support - target.undecided);
    records.push(record(state, 'opponent', 'Rook contests a battleground', `The rival campaign concentrates on ${target.name}, shifting the race by ${(sample.value / 100).toFixed(1)} points.`));
    return {id: 'ai-target-state', targetId: target.id};
  }
  const hostile = [...state.factions].sort((a, b) => a.support - b.support || b.influence - a.influence)[0];
  const sample = randomBetween(state.randomState, 100, 230 + difficultyBoost);
  state.randomState = sample.state;
  hostile.support = clamp(hostile.support - sample.value);
  hostile.cohesion = clamp(hostile.cohesion + Math.round(sample.value / 3));
  state.influence = Math.max(0, state.influence - Math.round(sample.value / 4));
  records.push(record(state, 'opponent', `${hostile.name} applies pressure`, `A rival bloc exploits unresolved tensions. Its support falls while internal discipline hardens.`));
  return {id: 'ai-pressure-faction', targetId: hostile.id};
}

function resolvePolicyDirective(state: GameState, records: HistoricalRecord[], directive: number, difficultyBoost: number): ActionInput {
  const rivalFaction = state.factions.find(faction => ['opposition', 'old-guard', 'nobles', 'security'].includes(faction.id)) ?? state.factions[state.factions.length - 1];
  if (directive === 5 || rivalFaction.influence < 250) {
    rivalFaction.influence = clamp(rivalFaction.influence + 520);
    records.push(record(state, 'opponent', `${rivalFaction.name} rebuilds resources`, 'The rival coalition pauses its pressure campaign to rebuild organizational capacity.'));
    return {id: 'rl:resources', targetId: rivalFaction.id};
  }
  rivalFaction.influence = clamp(rivalFaction.influence - 250);
  const strength = 150 + difficultyBoost;
  const families = ['public', 'coalition', 'regional', 'economy', 'institution', 'resources', 'reform', 'transition'];
  if (directive === 0) state.publicSentiment = clamp(state.publicSentiment - strength);
  else if (directive === 1) {
    const target = [...state.factions].filter(item => item.id !== rivalFaction.id).sort((a, b) => a.support - b.support)[0];
    target.support = clamp(target.support - strength);
  } else if (directive === 2) {
    const target = [...state.regions].sort((a, b) => Math.abs(a.support - 5000) - Math.abs(b.support - 5000))[0];
    target.support = clamp(target.support - strength); target.opponentSupport = clamp(10000 - target.support - target.undecided);
  } else if (directive === 3) state.economy.growth = clamp(state.economy.growth - strength);
  else if (directive === 4) {
    const target = [...state.institutions].sort((a, b) => a.confidence - b.confidence)[0];
    target.confidence = clamp(target.confidence - strength);
  } else if (directive === 6) state.legitimacy = clamp(state.legitimacy - strength);
  else {
    rivalFaction.cohesion = clamp(rivalFaction.cohesion + strength);
    state.legitimacy = clamp(state.legitimacy - Math.round(strength * 0.7));
  }
  records.push(record(state, 'opponent', `${rivalFaction.name} executes a ${families[directive]} strategy`, 'The approved local policy selects a legal, resource-limited counter-strategy from the current political state.'));
  return {id: `rl:${families[directive]}`, targetId: rivalFaction.id};
}

function applyPoliticalDynamics(state: GameState) {
  const economySignal = Math.round((state.economy.growth + state.economy.employment + state.economy.resilience - state.economy.inflation - state.economy.inequality) / 60);
  state.publicSentiment = clamp(state.publicSentiment + economySignal);
  const factionAverage = average(state.factions.map(faction => faction.support));
  const institutionAverage = average(state.institutions.map(institution => institution.confidence));
  state.legitimacy = clamp(state.legitimacy + Math.round((factionAverage + institutionAverage - 10000) / 40) - Math.round(state.corruption / 100));
  state.momentum = clamp(state.momentum + Math.round((state.publicSentiment - 5000) / 40));
  state.economy.growth = clamp(state.economy.growth + Math.round((state.economy.resilience - state.economy.inflation) / 70));
  state.economy.inflation = clamp(state.economy.inflation + (state.treasury < 700 ? 100 : -25));
  state.treasury = Math.max(0, state.treasury + Math.round((state.economy.growth - 4000) / 7));
}

function resolveScheduledEffects(state: GameState, records: HistoricalRecord[], resolutionId: string) {
  const due = state.scheduledEffects.filter(effect => effect.dueTurn <= state.turn);
  state.scheduledEffects = state.scheduledEffects.filter(effect => effect.dueTurn > state.turn);
  for (const effect of due) {
    const impacts = applyChanges(state, effect.changes, effect.targetId);
    records.push(record(state, 'system', effect.source, effect.narrative, {
      resolutionId,
      timing: 'delayed',
      sourceActionId: effect.sourceActionId,
      sourceRecordId: effect.sourceRecordId,
      targetId: effect.targetId,
      impacts,
    }));
  }
}

function maybeCreateEvent(state: GameState, records: HistoricalRecord[], resolutionId: string) {
  if (state.pendingEvent || state.status !== 'active' || state.turn % 3 !== 0) return;
  const templates = eventTemplates(state.mode).filter(event => !state.seenEvents.includes(event.templateId));
  if (!templates.length) return;
  const draw = nextRandom(state.randomState);
  state.randomState = draw.state;
  if (draw.value > 0.78) return;
  const chosen = templates[Math.floor(draw.value * templates.length) % templates.length];
  state.pendingEvent = {...chosen, id: stableId('event', state.seed, state.turn)};
  state.seenEvents.push(chosen.templateId);
  records.push(record(state, 'event', chosen.title, chosen.narrative, {resolutionId, timing: 'event'}));
}

function eventTemplates(mode: GameMode): Array<Omit<PoliticalEvent, 'id'>> {
  const shared: Array<Omit<PoliticalEvent, 'id'>> = [{
    templateId: 'fiscal-warning', title: 'Fiscal warning', severity: 'pressure',
    narrative: 'Independent analysts warn that short-term commitments are crowding out resilience.',
    choices: [
      choice('trim', 'Trim commitments', 'Protect the treasury but disappoint a coalition.', [{path: 'treasury', amount: 550}, {path: 'publicSentiment', amount: -230}]),
      choice('invest', 'Invest through it', 'Use reserves to preserve momentum.', [{path: 'treasury', amount: -500}, {path: 'economy.resilience', amount: 360}, {path: 'publicSentiment', amount: 180}]),
    ],
  }];
  if (mode === 'presidential') return [...shared, {
    templateId: 'national-debate', title: 'The national debate', severity: 'opportunity',
    narrative: 'A tightly watched fictional debate offers a chance to define the race.',
    choices: [
      choice('contrast', 'Draw a sharp contrast', 'High upside, but it may deepen polarization.', [{path: 'momentum', amount: 420}, {path: 'legitimacy', amount: -130}]),
      choice('coalition', 'Offer a unifying case', 'Build broad trust at a slower pace.', [{path: 'publicSentiment', amount: 330}, {path: 'legitimacy', amount: 250}]),
    ],
  }, {
    templateId: 'endorsement', title: 'Unexpected endorsement', severity: 'opportunity',
    narrative: 'A respected fictional civic leader offers public support, but asks for a policy commitment.',
    choices: [
      choice('accept', 'Accept with conditions', 'Gain momentum while retaining policy independence.', [{path: 'momentum', amount: 360}, {path: 'influence', amount: -220}]),
      choice('decline', 'Decline gracefully', 'Preserve independence and campaign resources.', [{path: 'legitimacy', amount: 180}, {path: 'influence', amount: 180}]),
    ],
  }];
  if (mode === 'dictatorship') return [...shared, {
    templateId: 'cabinet-resignation', title: 'Cabinet resignation', severity: 'crisis',
    narrative: 'A senior minister resigns after an internal policy dispute, exposing coalition strain.',
    choices: [
      choice('transparent-review', 'Order a transparent review', 'Strengthen institutions while accepting short-term embarrassment.', [{path: 'legitimacy', amount: 380}, {path: 'momentum', amount: -200}, {path: 'institution.confidence', targetId: 'cabinet', amount: 450}]),
      choice('coalition-meeting', 'Convene coalition leaders', 'Spend influence to contain the fracture.', [{path: 'influence', amount: -500}, {path: 'faction.cohesion', targetId: 'technocrats', amount: 480}]),
    ],
  }];
  if (mode === 'monarchy') return [...shared, {
    templateId: 'succession-whisper', title: 'Succession dispute', severity: 'crisis',
    narrative: 'A great house questions the succession convention, unsettling the royal council.',
    choices: [
      choice('council-hearing', 'Hold a council hearing', 'Let institutions settle the question in public.', [{path: 'institution.confidence', targetId: 'council', amount: 520}, {path: 'legitimacy', amount: 260}]),
      choice('private-accord', 'Negotiate a private accord', 'Buy time, while empowering the great houses.', [{path: 'influence', amount: -400}, {path: 'faction.support', targetId: 'nobles', amount: 420}, {path: 'legitimacy', amount: -140}]),
    ],
  }];
  return [...shared, {
    templateId: 'recognition', title: 'Recognition question', severity: 'pressure',
    narrative: 'Neighboring governments ask for a credible timeline and institutional guarantees.',
    choices: [
      choice('publish-timeline', 'Publish a transition timeline', 'Trade flexibility for recognition and confidence.', [{path: 'legitimacy', amount: 450}, {path: 'influence', amount: -250}]),
      choice('seek-consensus', 'Seek domestic consensus first', 'Build coalition ownership at the cost of delay.', [{path: 'faction.cohesion', targetId: 'legalists', amount: 380}, {path: 'momentum', amount: -160}]),
    ],
  }];
}

function choice(id: string, label: string, description: string, effects: MetricChange[]): EventChoice {
  return {id, label, description, effects};
}

function evaluateCampaign(state: GameState, records: HistoricalRecord[], resolutionId: string) {
  const avgFaction = average(state.factions.map(item => item.support));
  const avgInstitution = average(state.institutions.map(item => item.confidence));
  if (state.legitimacy < 900 || state.publicSentiment < 900 || avgFaction < 800) {
    finish(state, 'defeat', 'Political collapse', 'The governing coalition no longer commands enough legitimacy or organized support to continue.', records, resolutionId);
    return;
  }
  if (state.turn <= state.maxTurns) return;
  if (state.mode === 'presidential') {
    runElection(state, records, resolutionId);
    return;
  }
  if (state.mode === 'dictatorship') {
    const transitioned = state.actionHistory.some(action => action.id === 'managed-transition') && state.legitimacy >= 5400 && avgInstitution >= 5000;
    if (transitioned) finish(state, 'transitioned', 'Negotiated transition', 'You leave office through a durable constitutional settlement.', records, resolutionId);
    else if (state.legitimacy >= 4800 && avgFaction >= 4000 && state.economy.growth >= 4000) finish(state, 'victory', 'Durable governing coalition', 'You retain power with a functioning economy and a coalition strong enough to govern.', records, resolutionId);
    else finish(state, 'defeat', 'Regime fracture', 'Economic and coalition pressures overwhelm the government.', records, resolutionId);
  } else if (state.mode === 'monarchy') {
    const charter = state.actionHistory.some(action => action.id === 'charter-reform');
    const heirReady = state.actionHistory.filter(action => action.id === 'prepare-heir').length >= 2;
    if (charter && state.legitimacy >= 5600) finish(state, 'transitioned', 'Constitutional crown', 'A negotiated charter carries the realm into a stable constitutional era.', records, resolutionId);
    else if (heirReady && state.legitimacy >= 5200 && avgFaction >= 4200) finish(state, 'victory', 'A stable dynasty', 'The succession is accepted and the realm enters the next reign in order.', records, resolutionId);
    else finish(state, 'defeat', 'Succession fracture', 'The dynasty reaches the succession without enough confidence or coalition support.', records, resolutionId);
  } else {
    const charter = state.actionHistory.some(action => action.id === 'interim-charter');
    if (charter && state.legitimacy >= 5600 && avgInstitution >= 5400 && avgFaction >= 4000) finish(state, 'transitioned', 'Legitimate transition', 'The interim coalition transfers authority into credible institutions.', records, resolutionId);
    else finish(state, 'defeat', 'Coalition fragmentation', 'The challenge gains momentum but cannot convert it into legitimate, durable government.', records, resolutionId);
  }
}

function runElection(state: GameState, records: HistoricalRecord[], resolutionId: string) {
  let player = 0;
  const regionalResults: Record<string, 'player' | 'opponent'> = {};
  for (const region of state.regions) {
    const sample = randomBetween(state.randomState, -region.volatility, region.volatility);
    state.randomState = sample.state;
    const campaignEffect = Math.min(450, Math.round(region.investment / 8));
    const nationalEffect = Math.round((state.momentum + state.publicSentiment - 10000) / 12);
    const score = region.support + campaignEffect + nationalEffect + sample.value;
    const won = score >= 5000;
    regionalResults[region.id] = won ? 'player' : 'opponent';
    if (won) player += region.electoralVotes ?? 0;
  }
  const opponent = 538 - player;
  const won = player >= 270;
  finish(state, won ? 'victory' : 'defeat', won ? 'Presidential victory' : 'Election defeat', won ? `Your coalition wins ${player} electoral votes and a mandate to govern.` : `The rival coalition wins ${opponent} electoral votes. Your campaign concedes the fictional election.`, records, resolutionId, {playerElectoralVotes: player, opponentElectoralVotes: opponent, regionalResults});
}

function finish(state: GameState, status: 'victory' | 'defeat' | 'transitioned', ending: string, summary: string, records: HistoricalRecord[], resolutionId: string, extra: Partial<CampaignResult> = {}) {
  state.status = status;
  const score = Math.round((state.legitimacy + state.publicSentiment + state.momentum + average(state.factions.map(item => item.support)) + average(state.institutions.map(item => item.confidence))) / 5);
  state.result = {ending, summary, score, ...extra};
  state.pendingEvent = null;
  records.push(record(state, 'result', ending, summary, {resolutionId, timing: 'result'}));
}

export function concedeCampaign(current: GameState): GameState {
  if (current.status !== 'active') return current;
  const state: GameState = JSON.parse(JSON.stringify(current));
  state.status = 'conceded';
  state.result = {ending: 'Campaign conceded', summary: 'You chose to conclude this campaign and preserve its history.', score: 0};
  state.pendingEvent = null;
  state.updatedAt = deterministicTimestamp(state.createdAt, state.turn);
  state.history.push(record(state, 'result', 'Campaign conceded', state.result.summary, {
    resolutionId: stableId('resolution', state.seed, state.turn),
    timing: 'result',
  }));
  return state;
}

function updateActorMemory(state: GameState, input: ActionInput, deltas: Record<string, number>) {
  const effectTotal = Object.values(deltas).reduce((sum, value) => sum + value, 0);
  for (const actor of state.actors) {
    const targeted = input.targetId === actor.id || input.targetId === actor.factionId;
    const sentiment = clampSigned(Math.round(effectTotal / 4) + (targeted ? 250 : 0));
    actor.trust = clamp(actor.trust + Math.round(sentiment / 5));
    actor.loyalty = clamp(actor.loyalty + Math.round(sentiment / 8));
    actor.memory.push({turn: state.turn, actionId: input.id, sentiment});
    if (actor.memory.length > 12) actor.memory.shift();
  }
}

function ageCharactersIfNeeded(state: GameState) {
  if (state.mode !== 'monarchy' || state.turn % 4 !== 0) return;
  state.actors.forEach(actor => { if (actor.age) actor.age += 1; });
}

function describeAction(state: GameState, action: ActionDefinition, targetId?: string) {
  const target = [...state.regions, ...state.factions, ...state.actors, ...state.institutions].find(item => item.id === targetId);
  return `${action.description}${target ? ` Target: ${target.name}.` : ''}`;
}

function record(
  state: GameState,
  kind: HistoricalRecord['kind'],
  title: string,
  detail: string,
  metadata: Pick<HistoricalRecord, 'resolutionId' | 'timing' | 'sourceActionId' | 'sourceRecordId' | 'targetId' | 'impacts'> = {},
): HistoricalRecord {
  const impacts = metadata.impacts?.filter(impact => impact.amount !== 0) ?? [];
  return {
    id: stableId(`history-${kind}-${title}-${metadata.sourceRecordId ?? metadata.sourceActionId ?? metadata.timing ?? ''}`, state.seed, state.turn + state.history.length + state.actionHistory.length),
    turn: state.turn,
    kind,
    title,
    detail,
    ...metadata,
    impacts,
    deltas: impacts.length ? impactsToDeltas(impacts) : undefined,
  };
}

function targetForPath(path: MetricChange['path'], explicitTarget?: string, suppliedTarget?: string) {
  return path.startsWith('faction.') || path === 'institution.confidence' || path.startsWith('region.') || path.startsWith('actor.')
    ? explicitTarget ?? suppliedTarget
    : undefined;
}

function readMetric(state: GameState, path: MetricChange['path'], targetId?: string): number | undefined {
  if (path.startsWith('economy.')) return state.economy[path.split('.')[1] as keyof GameState['economy']];
  if (path.startsWith('faction.')) {
    const faction = state.factions.find(item => item.id === targetId);
    return faction?.[path.split('.')[1] as 'support' | 'cohesion' | 'influence'];
  }
  if (path === 'institution.confidence') return state.institutions.find(item => item.id === targetId)?.confidence;
  if (path.startsWith('region.')) {
    const region = state.regions.find(item => item.id === targetId);
    return region?.[path.split('.')[1] as 'support' | 'opponentSupport' | 'undecided' | 'investment'];
  }
  if (path.startsWith('actor.')) {
    const actor = state.actors.find(item => item.id === targetId);
    return actor?.[path.split('.')[1] as 'trust' | 'loyalty'];
  }
  return state[path as 'publicSentiment' | 'legitimacy' | 'momentum' | 'treasury' | 'influence'];
}

type MetricSnapshot = Record<string, {path: MetricChange['path']; targetId?: string; value: number}>;

function captureMetrics(state: GameState): MetricSnapshot {
  const snapshot: MetricSnapshot = {};
  const add = (path: MetricChange['path'], value: number, targetId?: string) => {
    snapshot[`${path}:${targetId ?? ''}`] = {path, targetId, value};
  };
  add('publicSentiment', state.publicSentiment);
  add('legitimacy', state.legitimacy);
  add('momentum', state.momentum);
  add('treasury', state.treasury);
  add('influence', state.influence);
  (['growth', 'employment', 'inflation', 'inequality', 'resilience'] as const).forEach(key => add(`economy.${key}`, state.economy[key]));
  state.factions.forEach(faction => {
    add('faction.support', faction.support, faction.id);
    add('faction.cohesion', faction.cohesion, faction.id);
    add('faction.influence', faction.influence, faction.id);
  });
  state.institutions.forEach(institution => add('institution.confidence', institution.confidence, institution.id));
  state.regions.forEach(region => {
    add('region.support', region.support, region.id);
    add('region.opponentSupport', region.opponentSupport, region.id);
    add('region.undecided', region.undecided, region.id);
    add('region.investment', region.investment, region.id);
  });
  state.actors.forEach(actor => {
    add('actor.trust', actor.trust, actor.id);
    add('actor.loyalty', actor.loyalty, actor.id);
  });
  return snapshot;
}

function diffMetrics(before: MetricSnapshot, state: GameState): MetricImpact[] {
  return Object.values(before).flatMap(metric => {
    const after = readMetric(state, metric.path, metric.targetId);
    return after === undefined || after === metric.value ? [] : [{
      path: metric.path,
      targetId: metric.targetId,
      before: metric.value,
      after,
      amount: after - metric.value,
    }];
  });
}

function impactsToDeltas(impacts: MetricImpact[]): Record<string, number> {
  return impacts.reduce<Record<string, number>>((deltas, impact) => {
    const key = `${impact.path}${impact.targetId ? `:${impact.targetId}` : ''}`;
    deltas[key] = (deltas[key] ?? 0) + impact.amount;
    return deltas;
  }, {});
}

function changesToDeltas(changes: MetricChange[], suppliedTarget?: string): Record<string, number> {
  return changes.reduce<Record<string, number>>((deltas, change) => {
    const targetId = targetForPath(change.path, change.targetId, suppliedTarget);
    const key = `${change.path}${targetId ? `:${targetId}` : ''}`;
    deltas[key] = (deltas[key] ?? 0) + change.amount;
    return deltas;
  }, {});
}

function enrichLatestRecord(records: HistoricalRecord[], kind: HistoricalRecord['kind'], resolutionId: string, timing: ImpactTiming, impacts: MetricImpact[]) {
  const latest = [...records].reverse().find(item => item.kind === kind);
  if (!latest) return;
  latest.resolutionId = resolutionId;
  latest.timing = timing;
  latest.impacts = impacts;
  latest.deltas = impacts.length ? impactsToDeltas(impacts) : undefined;
}

function describeDynamics(impacts: MetricImpact[]) {
  const momentum = impacts.find(impact => impact.path === 'momentum');
  const sentiment = impacts.find(impact => impact.path === 'publicSentiment');
  if (momentum && sentiment) return 'Economic conditions and coalition confidence moved public sentiment, which then carried into campaign momentum.';
  if (momentum) return 'The wider political climate translated into a measurable momentum change.';
  return 'Economic conditions, coalition strength, and institutional confidence continued to evolve.';
}

function timingForKind(kind: HistoricalRecord['kind']): ImpactTiming {
  if (kind === 'decision') return 'immediate';
  if (kind === 'opponent') return 'opponent';
  if (kind === 'event') return 'event';
  if (kind === 'result') return 'result';
  return 'systemic';
}

function findTargetName(state: GameState, targetId?: string) {
  if (!targetId) return undefined;
  return [...state.regions, ...state.factions, ...state.actors, ...state.institutions].find(item => item.id === targetId)?.name;
}

function phaseFor(mode: GameMode, turn: number, maxTurns: number) {
  const ratio = turn / maxTurns;
  if (mode === 'presidential') return ratio < 0.35 ? 'Building the map' : ratio < 0.7 ? 'National campaign' : 'Final sprint';
  if (mode === 'dictatorship') return ratio < 0.35 ? 'Consolidation' : ratio < 0.7 ? 'Pressure and reform' : 'Political settlement';
  if (mode === 'monarchy') return ratio < 0.35 ? 'Stewardship' : ratio < 0.7 ? 'Court realignment' : 'Succession season';
  return ratio < 0.35 ? 'Coalition building' : ratio < 0.7 ? 'Authority contest' : 'Interim government';
}

export function extractFeatures(state: GameState): number[] {
  return [
    state.turn / state.maxTurns, state.treasury / 10000, state.influence / 10000,
    state.legitimacy / 10000, state.publicSentiment / 10000, state.momentum / 10000,
    state.corruption / 10000, state.economy.growth / 10000, state.economy.employment / 10000,
    state.economy.inflation / 10000, state.economy.inequality / 10000, state.economy.resilience / 10000,
    average(state.factions.map(item => item.support)) / 10000,
    average(state.factions.map(item => item.cohesion)) / 10000,
    average(state.institutions.map(item => item.confidence)) / 10000,
    average(state.regions.map(item => item.support)) / 10000,
  ].map(value => Number(value.toFixed(6)));
}

function calculateReward(before: GameState, after: GameState) {
  const political = (after.legitimacy - before.legitimacy + after.publicSentiment - before.publicSentiment + after.momentum - before.momentum) / 3000;
  const economic = (after.economy.growth - before.economy.growth + after.economy.employment - before.economy.employment - (after.economy.inflation - before.economy.inflation)) / 3000;
  const terminal = after.status === 'victory' || after.status === 'transitioned' ? 1 : after.status === 'defeat' ? -1 : 0;
  return {political: roundReward(political), economic: roundReward(economic), terminal, total: roundReward(political * 0.65 + economic * 0.35 + terminal)};
}

function deterministicTimestamp(createdAt: string, turn: number) {
  return new Date(new Date(createdAt).getTime() + turn * 60000).toISOString();
}

const average = (values: number[]) => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
const clamp = (value: number) => Math.max(0, Math.min(10000, Math.round(value)));
const clampSigned = (value: number) => Math.max(-10000, Math.min(10000, Math.round(value)));
const roundReward = (value: number) => Number(Math.max(-2, Math.min(2, value)).toFixed(4));
