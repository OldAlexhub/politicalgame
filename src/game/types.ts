export type GameMode = 'presidential' | 'dictatorship' | 'monarchy' | 'coup' | 'grand_campaign';
export type Difficulty = 'standard' | 'veteran' | 'strategist';
export type CampaignStatus = 'active' | 'victory' | 'defeat' | 'transitioned' | 'conceded';
export type ImpactTiming = 'cost' | 'immediate' | 'opponent' | 'systemic' | 'delayed' | 'event' | 'result';

export interface CandidateProfile {
  id: string;
  name: string;
  title: string;
  archetype: 'coalition-builder' | 'reformer' | 'operator';
  position: 'Civic Alliance' | 'Forward Coalition' | 'Independent';
}

export interface PoliticalActor {
  id: string;
  name: string;
  role: string;
  factionId: string;
  loyalty: number;
  trust: number;
  ambition: number;
  riskTolerance: number;
  age?: number;
  memory: ActorMemory[];
}

export interface ActorMemory {
  turn: number;
  actionId: string;
  sentiment: number;
}

export interface PoliticalFaction {
  id: string;
  name: string;
  influence: number;
  support: number;
  cohesion: number;
  priorities: string[];
}

export interface PoliticalInstitution {
  id: string;
  name: string;
  authority: number;
  confidence: number;
  alignment: number;
}

export interface Region {
  id: string;
  name: string;
  abbreviation: string;
  electoralVotes?: number;
  support: number;
  opponentSupport: number;
  undecided: number;
  investment: number;
  turnout: number;
  volatility: number;
  issue: string;
}

export interface EconomicState {
  growth: number;
  employment: number;
  inflation: number;
  inequality: number;
  resilience: number;
}

export type WorldActionEffect = 'trade' | 'business' | 'alliance' | 'declare-war' | 'peace' | 'mobilize' | 'invade' | 'resistance' | 'rebuild';
export interface WorldNation {
  id: string;
  name: string;
  player: boolean;
  relation: number;
  power: number;
  aggression: number;
  allied: boolean;
  atWar: boolean;
  pactIds: string[];
}
export interface WorldTerritory {
  id: string;
  name: string;
  ownerId: string;
  neighbors: string[];
  resource: string;
  wealth: number;
  unrest: number;
  resistance: number;
  formerPlayerLand: boolean;
}
export interface WorldDeal {
  id: string;
  nationId: string;
  kind: 'trade' | 'business';
  annualIncome: number;
  yearsRemaining: number;
  breachRisk: number;
}
export interface WorldWar {
  id: string;
  nationId: string;
  targetNationId?: string;
  yearsActive: number;
  casualties: number;
}
export interface WorldNews {
  id: string;
  year: number;
  headline: string;
  detail: string;
  severity: 'brief' | 'pressure' | 'crisis';
}
export interface StrategicResource {
  id: string;
  name: string;
  category: 'energy' | 'industry' | 'agriculture' | 'minerals' | 'trade' | 'technology' | 'services';
  capacity: number;
}
export interface WorldState {
  year: number;
  playerNationId: string;
  playerCountryId?: string;
  army: number;
  resources?: StrategicResource[];
  nations: WorldNation[];
  territories: WorldTerritory[];
  deals: WorldDeal[];
  wars: WorldWar[];
  news: WorldNews[];
}

export interface ScheduledEffect {
  id: string;
  dueTurn: number;
  source: string;
  changes: MetricChange[];
  narrative: string;
  createdTurn?: number;
  sourceActionId?: string;
  sourceRecordId?: string;
  sourceResolutionId?: string;
  targetId?: string;
}

export interface MetricChange {
  path: 'publicSentiment' | 'legitimacy' | 'momentum' | 'treasury' | 'influence' |
    'economy.growth' | 'economy.employment' | 'economy.inflation' | 'economy.inequality' | 'economy.resilience' |
    'faction.support' | 'faction.cohesion' | 'faction.influence' | 'institution.confidence' |
    'region.support' | 'region.opponentSupport' | 'region.undecided' | 'region.investment' |
    'actor.trust' | 'actor.loyalty';
  amount: number;
  targetId?: string;
}

export interface EventChoice {
  id: string;
  label: string;
  description: string;
  effects: MetricChange[];
  delayedEffects?: Omit<ScheduledEffect, 'id' | 'dueTurn'> & {delay: number};
  worldEffect?: WorldActionEffect;
  target?: 'none' | 'nation' | 'territory';
}

export interface PoliticalEvent {
  id: string;
  templateId: string;
  title: string;
  narrative: string;
  severity: 'opportunity' | 'pressure' | 'crisis';
  choices: EventChoice[];
}

export interface HistoricalRecord {
  id: string;
  turn: number;
  kind: 'decision' | 'opponent' | 'event' | 'system' | 'result';
  title: string;
  detail: string;
  deltas?: Record<string, number>;
  resolutionId?: string;
  timing?: ImpactTiming;
  sourceActionId?: string;
  sourceRecordId?: string;
  targetId?: string;
  impacts?: MetricImpact[];
  legacy?: boolean;
}

export interface MetricImpact {
  path: MetricChange['path'];
  targetId?: string;
  before: number;
  after: number;
  amount: number;
}

export interface TurnReportSection {
  id: string;
  timing: ImpactTiming;
  title: string;
  detail: string;
  impacts: MetricImpact[];
  sourceRecordId?: string;
}

export interface TurnReportScheduledEffect {
  id: string;
  source: string;
  dueTurn: number;
  dueLabel: string;
  changes: MetricChange[];
  targetId?: string;
}

export interface TurnReport {
  id: string;
  turn: number;
  timeLabel: string;
  nextTimeLabel: string;
  actionId: string;
  actionLabel: string;
  targetId?: string;
  targetName?: string;
  phaseBefore: string;
  phaseAfter: string;
  phaseChanged: boolean;
  sections: TurnReportSection[];
  scheduled: TurnReportScheduledEffect[];
  momentum: {
    before: number;
    after: number;
    delta: number;
    contributors: Array<{label: string; amount: number}>;
  };
  event?: Pick<PoliticalEvent, 'id' | 'title' | 'narrative' | 'severity'>;
  result?: CampaignResult;
}

export interface ForecastImpact {
  path: MetricChange['path'];
  targetId?: string;
  minimum: number;
  maximum: number;
}

export interface ActionForecast {
  costs: Array<{resource: 'treasury' | 'influence' | 'legitimacy'; amount: number}>;
  immediate: ForecastImpact[];
  delayed?: {
    dueTurn: number;
    dueLabel: string;
    impacts: ForecastImpact[];
  };
}

export interface CampaignResult {
  ending: string;
  summary: string;
  score: number;
  playerElectoralVotes?: number;
  opponentElectoralVotes?: number;
  regionalResults?: Record<string, 'player' | 'opponent'>;
}

export interface GameState {
  schemaVersion: 2;
  engineVersion: string;
  id: string;
  mode: GameMode;
  difficulty: Difficulty;
  candidate: CandidateProfile;
  scenarioName: string;
  seed: number;
  randomState: number;
  turn: number;
  maxTurns: number;
  status: CampaignStatus;
  phase: string;
  treasury: number;
  influence: number;
  legitimacy: number;
  publicSentiment: number;
  momentum: number;
  corruption: number;
  economy: EconomicState;
  world?: WorldState;
  regions: Region[];
  actors: PoliticalActor[];
  factions: PoliticalFaction[];
  institutions: PoliticalInstitution[];
  scheduledEffects: ScheduledEffect[];
  pendingEvent: PoliticalEvent | null;
  seenEvents: string[];
  history: HistoricalRecord[];
  actionHistory: ActionInput[];
  policyVersion: string;
  result?: CampaignResult;
  lastTurnReport?: TurnReport;
  lastAcknowledgedReportId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActionInput {
  id: string;
  targetId?: string;
  choiceId?: string;
}

export interface ActionDefinition {
  id: string;
  label: string;
  description: string;
  category: 'campaign' | 'policy' | 'coalition' | 'economy' | 'institution' | 'succession' | 'transition' | 'diplomacy' | 'commerce' | 'military';
  cost: Partial<Pick<GameState, 'treasury' | 'influence' | 'legitimacy'>>;
  target: 'none' | 'region' | 'faction' | 'actor' | 'institution' | 'nation' | 'territory';
  effects: MetricChange[];
  delayedEffects?: Omit<ScheduledEffect, 'id' | 'dueTurn'> & {delay: number};
  minimumTurn?: number;
  maximumTreasury?: number;
  once?: boolean;
  worldEffect?: WorldActionEffect;
}

export interface TurnResult {
  state: GameState;
  records: HistoricalRecord[];
  experience: GameplayExperience;
  report: TurnReport;
}

export interface GameplayExperience {
  schemaVersion: 2;
  gameMode: GameMode;
  engineVersion: string;
  policyVersion: string;
  gameId: string;
  turnNumber: number;
  stateFeatures: number[];
  legalActions: string[];
  playerAction: ActionInput;
  aiActions: ActionInput[];
  nextStateFeatures: number[];
  rewardSignals: Record<string, number>;
  terminal: boolean;
  outcome: CampaignStatus | null;
}

export interface SaveSlot {
  schemaVersion: 2;
  slotId: string;
  name: string;
  state: GameState;
  checksum: string;
  savedAt: string;
}

export interface ConsentPreference {
  analytics: boolean;
  collectiveLearning: boolean;
  decidedAt?: string;
}

export interface AppSettings {
  reduceMotion: boolean;
  sound: boolean;
  haptics: boolean;
  consent: ConsentPreference;
}
