export type StartingPosition = 'government' | 'opposition' | 'successor';
export type Regime = 'republic' | 'monarchy' | 'autocracy';
export type Role = 'government' | 'opposition' | 'successor';
export type Need =
  | 'food'
  | 'energy'
  | 'housing'
  | 'health'
  | 'security'
  | 'freedom';
export type Group =
  | 'workers'
  | 'farmers'
  | 'professionals'
  | 'owners'
  | 'pensioners';
export type ProjectKind =
  | 'clinic'
  | 'housing'
  | 'power'
  | 'school'
  | 'industry'
  | 'transport';
export type IssueKind =
  | 'cost-of-living'
  | 'services'
  | 'corruption'
  | 'succession'
  | 'war'
  | 'constitutional';
export type CommandId =
  | 'campaign'
  | 'organize'
  | 'promise'
  | 'project'
  | 'tax'
  | 'subsidy'
  | 'borrow'
  | 'restructure'
  | 'negotiate'
  | 'appoint'
  | 'patronage'
  | 'investigate'
  | 'censor'
  | 'emergency'
  | 'reform'
  | 'succession'
  | 'coup'
  | 'settle'
  | 'arbitrate'
  | 'trade'
  | 'aid'
  | 'alliance'
  | 'sanction'
  | 'border-conflict'
  | 'peace'
  | 'retire';
export interface Command {
  id: CommandId;
  targetId?: string;
  option?: string;
  value?: number;
  clientId?: string;
}
export interface WorldConfig {
  seed: number;
  start?: StartingPosition;
  difficulty?: 'standard' | 'veteran' | 'strategist';
  id?: string;
  contentVersion?: string;
  policyVersion?: string;
}
export interface NumericalPolicy {
  schemaVersion: 3;
  engineVersion: string;
  version: string;
  weights: Record<Actor['plan'], number>;
}
export interface Cohort {
  id: string;
  group: Group;
  size: number;
  income: number;
  employment: number;
  costOfLiving: number;
  needs: Record<Need, number>;
  support: number;
  grievance: number;
  organization: number;
}
export interface Province {
  id: string;
  name: string;
  x: number;
  y: number;
  terrain: 'coast' | 'hills' | 'plain';
  identity: string;
  wealth: number;
  production: number;
  pollution: number;
  corruption: number;
  capacity: number;
  staffing: number;
  services: number;
  cohorts: Cohort[];
}
export interface Faction {
  id: string;
  name: string;
  group: Group | 'security';
  seats: number;
  support: number;
  cohesion: number;
  coalition: boolean;
  priorities: Need[];
}
export interface Memory {
  day: number;
  sourceId: string;
  subject: string;
  effect: number;
}
export interface Actor {
  id: string;
  name: string;
  role: string;
  factionId: string;
  regionId: string;
  portrait: number;
  age: number;
  ambition: number;
  competence: number;
  influence: number;
  trust: number;
  loyalty: number;
  resources: number;
  plan:
    | 'negotiate'
    | 'organize'
    | 'obstruct'
    | 'investigate'
    | 'challenge'
    | 'support';
  nextPlanDay: number;
  memories: Memory[];
  office?: string;
}
export interface Institution {
  id: string;
  name: string;
  independence: number;
  capacity: number;
  confidence: number;
}
export interface Project {
  id: string;
  kind: ProjectKind;
  regionId: string;
  startedDay: number;
  dueDay: number;
  progress: number;
  cost: number;
  maintenance: number;
  status: 'building' | 'delayed' | 'operating' | 'suspended';
  sourceId: string;
}
export interface Commitment {
  id: string;
  regionId: string;
  kind: ProjectKind;
  dueDay: number;
  status: 'open' | 'fulfilled' | 'broken';
  sourceId: string;
}
export interface Situation {
  id: string;
  kind: IssueKind;
  regionId: string;
  actorId: string;
  stage:
    | 'grievance'
    | 'organized'
    | 'demands'
    | 'protest'
    | 'strike'
    | 'resolved';
  pressure: number;
  startedDay: number;
  nextDay: number;
  demand: string;
  causes: string[];
  sourceId: string;
  resolvedDay?: number;
}
export interface News {
  id: string;
  day: number;
  title: string;
  detail: string;
  severity: 'brief' | 'pressure' | 'crisis';
  sourceId?: string;
  regionId?: string;
  actorId?: string;
  impacts: string[];
}
export interface Neighbor {
  id: string;
  name: string;
  relation: number;
  aggression: number;
  trade: boolean;
  allied: boolean;
  war: boolean;
  power: number;
  grievances: number;
}
export interface Receipt {
  id: string;
  kind: 'trade' | 'aid' | 'alliance' | 'sanction' | 'vote' | 'dispute';
  amount: number;
  detail: string;
  issuer: string;
}
export interface JournalEntry {
  day: number;
  sequence: number;
  command: Command;
}
export interface WorldState {
  localBranchOf?: string;
  schemaVersion: 3;
  engineVersion: string;
  contentVersion: string;
  policyVersion: string;
  id: string;
  config: WorldConfig;
  seed: number;
  randomState: number;
  day: number;
  revision: number;
  sequence: number;
  name: string;
  motto: string;
  regime: Regime;
  role: Role;
  status: 'active' | 'retired';
  content?: ContentPack;
  policy?: NumericalPolicy;
  foreignTradeUntil?: number;
  foreignPressureUntil?: number;
  leader: { name: string; age: number; portrait: number; generation: number };
  movement: {
    funds: number;
    name: string;
    organization: number;
    reputation: number;
    influence: number;
  };
  treasury: number;
  debt: number;
  legitimacy: number;
  corruption: number;
  taxRate: number;
  fuelSubsidy: number;
  censorship: boolean;
  emergencyUntil: number;
  electionDay: number;
  lastElectionShare: number;
  electionCount: number;
  budget: {
    revenue: number;
    expenses: number;
    debtService: number;
    projectMaintenance: number;
    imports: number;
    net: number;
  };
  economy: {
    employment: number;
    inflation: number;
    production: number;
    purchasingPower: number;
    growth: number;
  };
  regions: Province[];
  factions: Faction[];
  actors: Actor[];
  institutions: Institution[];
  projects: Project[];
  commitments: Commitment[];
  negotiations: Array<{
    id: string;
    actorId: string;
    offered: string;
    requested: 'policy' | 'portfolio' | 'funding' | 'endorsement';
    expiresDay: number;
    status: 'counteroffer' | 'agreed' | 'expired';
    sourceId: string;
  }>;
  situations: Situation[];
  neighbors: Neighbor[];
  news: News[];
  journal: JournalEntry[];
  appliedReceipts: string[];
  cooldowns: Partial<Record<CommandId, number>>;
  lastCriticalId?: string;
  legacy?: string;
}
export interface DecisionDefinition {
  id: CommandId;
  label: string;
  category: 'movement' | 'government' | 'economy' | 'power' | 'diplomacy';
  description: string;
  target: 'none' | 'region' | 'actor' | 'institution' | 'situation' | 'nation';
  cost: number;
  influence: number;
  cooldown: number;
  government?: boolean;
}
export interface DecisionPreview {
  allowed: boolean;
  reason?: string;
  cost: number;
  account?: 'treasury' | 'movement';
  influence: number;
  consequences: string[];
  dueDay?: number;
}
export interface ContentPack {
  schemaVersion: 3;
  engineVersion: string;
  version: string;
  dialogue: Record<string, string[]>;
  projectDuration: Record<ProjectKind, number>;
}
