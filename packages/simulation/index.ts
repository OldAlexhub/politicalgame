import type {
  Actor,
  Cohort,
  Command,
  CommandId,
  Commitment,
  ContentPack,
  DecisionDefinition,
  DecisionPreview,
  Faction,
  Group,
  Need,
  News,
  NumericalPolicy,
  ProjectKind,
  Receipt,
  Situation,
  WorldConfig,
  WorldState,
} from './types.ts';
export type * from './types.ts';

export const ENGINE_VERSION = '2.0.0';
export const CONTENT_VERSION = '2.0.0';
export const POLICY_VERSION = 'utility-2.0.0';
export const DAY_MS = 4000;
export const BASE_POLICY: NumericalPolicy = {
  schemaVersion: 3,
  engineVersion: ENGINE_VERSION,
  version: POLICY_VERSION,
  weights: {
    organize: 1,
    investigate: 1,
    challenge: 1,
    obstruct: 1,
    negotiate: 1,
    support: 1,
  },
};
export const PROJECTS: Record<
  ProjectKind,
  {
    label: string;
    cost: number;
    duration: number;
    maintenance: number;
    need: Need;
  }
> = {
  clinic: {
    label: 'Provincial clinic',
    cost: 1200,
    duration: 60,
    maintenance: 35,
    need: 'health',
  },
  housing: {
    label: 'Public housing program',
    cost: 1600,
    duration: 90,
    maintenance: 25,
    need: 'housing',
  },
  power: {
    label: 'Regional power station',
    cost: 2200,
    duration: 120,
    maintenance: 55,
    need: 'energy',
  },
  school: {
    label: 'Education and training',
    cost: 1000,
    duration: 75,
    maintenance: 30,
    need: 'freedom',
  },
  industry: {
    label: 'Industrial partnership',
    cost: 1800,
    duration: 90,
    maintenance: 20,
    need: 'food',
  },
  transport: {
    label: 'Public transport program',
    cost: 1400,
    duration: 75,
    maintenance: 40,
    need: 'energy',
  },
};
export const BASE_CONTENT: ContentPack = {
  schemaVersion: 3,
  engineVersion: ENGINE_VERSION,
  version: CONTENT_VERSION,
  dialogue: {
    negotiate: [
      'My members need a commitment they can measure.',
      'Give us a delivery date, and I can take this to my colleagues.',
    ],
    organize: [
      'People here have waited long enough.',
      'An announcement will not pay the bills.',
    ],
    obstruct: [
      'Our support was never a blank cheque.',
      'You need our votes. We need something to show for them.',
    ],
    investigate: [
      'The procurement records do not match the promises.',
      'An independent inquiry would tell us who benefited.',
    ],
    challenge: [
      'The country deserves a different direction.',
      'Your coalition is less united than you think.',
    ],
    support: [
      'Deliver this, and we will stand with you.',
      'We can defend results. Promises are harder.',
    ],
  },
  projectDuration: Object.fromEntries(
    Object.entries(PROJECTS).map(([key, value]) => [key, value.duration]),
  ) as Record<ProjectKind, number>,
};

export const DECISIONS: DecisionDefinition[] = [
  {
    id: 'restructure',
    label: 'Negotiate debt restructuring',
    category: 'economy',
    description:
      'Seek a creditor standstill and principal reduction. Credit access, institutional confidence and imported goods bear the consequences.',
    target: 'none',
    cost: 0,
    influence: 18,
    cooldown: 360,
    government: true,
  },
  {
    id: 'campaign',
    label: 'Visit and listen',
    category: 'movement',
    description:
      'Hear local concerns and rebuild your movement through a regional visit.',
    target: 'region',
    cost: 80,
    influence: 0,
    cooldown: 7,
  },
  {
    id: 'organize',
    label: 'Organize your movement',
    category: 'movement',
    description:
      'Recruit local organizers. Organized supporters influence elections and public demands.',
    target: 'region',
    cost: 0,
    influence: 0,
    cooldown: 7,
  },
  {
    id: 'promise',
    label: 'Make a public commitment',
    category: 'movement',
    description:
      'Promise a regional service within 180 days. Broken promises are remembered.',
    target: 'region',
    cost: 0,
    influence: 8,
    cooldown: 14,
  },
  {
    id: 'project',
    label: 'Commission a regional project',
    category: 'government',
    description:
      'Fund delivery through the regional administration. Capacity and corruption affect completion.',
    target: 'region',
    cost: 1200,
    influence: 12,
    cooldown: 3,
    government: true,
  },
  {
    id: 'tax',
    label: 'Change the tax settlement',
    category: 'economy',
    description:
      'Balance public revenue, investment, household costs and the interests of your coalition.',
    target: 'none',
    cost: 0,
    influence: 12,
    cooldown: 30,
    government: true,
  },
  {
    id: 'subsidy',
    label: 'Set household fuel support',
    category: 'economy',
    description:
      'Shield households from energy costs, with a recurring bill to the treasury.',
    target: 'none',
    cost: 0,
    influence: 10,
    cooldown: 30,
    government: true,
  },
  {
    id: 'borrow',
    label: 'Issue public bonds',
    category: 'economy',
    description:
      'Raise 2,000 now. Debt service continues every month until the principal is repaid.',
    target: 'none',
    cost: 0,
    influence: 8,
    cooldown: 90,
    government: true,
  },
  {
    id: 'negotiate',
    label: 'Negotiate political support',
    category: 'movement',
    description:
      'Offer a policy commitment, portfolio or regional funding in exchange for support.',
    target: 'actor',
    cost: 0,
    influence: 12,
    cooldown: 7,
  },
  {
    id: 'appoint',
    label: 'Appoint a minister',
    category: 'government',
    description:
      'Trade competence against political loyalty when choosing your cabinet.',
    target: 'actor',
    cost: 0,
    influence: 15,
    cooldown: 14,
    government: true,
  },
  {
    id: 'patronage',
    label: 'Offer patronage',
    category: 'power',
    description:
      'Reward an ally with public resources. Their loyalty rises; corruption creates evidence.',
    target: 'actor',
    cost: 400,
    influence: 5,
    cooldown: 14,
    government: true,
  },
  {
    id: 'investigate',
    label: 'Demand an independent inquiry',
    category: 'movement',
    description:
      'Give investigators evidence and political cover. Connected allies may turn against you.',
    target: 'institution',
    cost: 0,
    influence: 10,
    cooldown: 30,
  },
  {
    id: 'censor',
    label: 'Change press restrictions',
    category: 'power',
    description:
      'Control coverage at the cost of liberty and institutional trust, or restore a free press.',
    target: 'none',
    cost: 0,
    influence: 20,
    cooldown: 45,
    government: true,
  },
  {
    id: 'emergency',
    label: 'Invoke emergency powers',
    category: 'power',
    description:
      'Temporarily bypass ordinary votes. Fear and reduced freedom outlast the emergency.',
    target: 'none',
    cost: 150,
    influence: 30,
    cooldown: 180,
    government: true,
  },
  {
    id: 'reform',
    label: 'Negotiate a constitution',
    category: 'power',
    description:
      'Transform the regime through an institutional settlement supported by a broad coalition.',
    target: 'institution',
    cost: 600,
    influence: 35,
    cooldown: 180,
    government: true,
  },
  {
    id: 'succession',
    label: 'Prepare a successor',
    category: 'power',
    description:
      'Build continuity around a new leader. Your movement inherits its promises and reputation.',
    target: 'actor',
    cost: 150,
    influence: 25,
    cooldown: 365,
  },
  {
    id: 'coup',
    label: 'Challenge control of the state',
    category: 'power',
    description:
      'An abstract contest for authority. Institutional alignment and organized support decide the outcome.',
    target: 'none',
    cost: 0,
    influence: 45,
    cooldown: 365,
  },
  {
    id: 'settle',
    label: 'Negotiate a settlement',
    category: 'government',
    description:
      'Fund immediate relief and a service commitment in response to the actual local grievance.',
    target: 'situation',
    cost: 350,
    influence: 12,
    cooldown: 7,
    government: true,
  },
  {
    id: 'arbitrate',
    label: 'Impose emergency arbitration',
    category: 'power',
    description:
      'Break a strike temporarily. The underlying grievances and loss of trust remain.',
    target: 'situation',
    cost: 80,
    influence: 20,
    cooldown: 14,
    government: true,
  },
  {
    id: 'trade',
    label: 'Negotiate a trade agreement',
    category: 'diplomacy',
    description:
      'Secure import access and recurring commerce. Conflict can interrupt the agreement.',
    target: 'nation',
    cost: 150,
    influence: 10,
    cooldown: 30,
    government: true,
  },
  {
    id: 'aid',
    label: 'Offer development aid',
    category: 'diplomacy',
    description:
      'Trade public resources for diplomatic trust and a stronger relationship.',
    target: 'nation',
    cost: 300,
    influence: 5,
    cooldown: 30,
    government: true,
  },
  {
    id: 'alliance',
    label: 'Propose an alliance',
    category: 'diplomacy',
    description: 'Commit to cooperation with a friendly government.',
    target: 'nation',
    cost: 100,
    influence: 20,
    cooldown: 60,
    government: true,
  },
  {
    id: 'sanction',
    label: 'Apply economic sanctions',
    category: 'diplomacy',
    description:
      'Restrict commerce and apply diplomatic pressure, at a cost to domestic importers.',
    target: 'nation',
    cost: 100,
    influence: 15,
    cooldown: 60,
    government: true,
  },
  {
    id: 'border-conflict',
    label: 'Authorize a border confrontation',
    category: 'diplomacy',
    description:
      'Escalate an abstract border dispute. Military commitments drain public funds and confidence.',
    target: 'nation',
    cost: 600,
    influence: 30,
    cooldown: 180,
    government: true,
  },
  {
    id: 'peace',
    label: 'Negotiate a ceasefire',
    category: 'diplomacy',
    description:
      'End active fighting, relieve the budget and begin rebuilding trust.',
    target: 'nation',
    cost: 200,
    influence: 20,
    cooldown: 30,
    government: true,
  },
  {
    id: 'retire',
    label: 'Retire and record your legacy',
    category: 'movement',
    description:
      'Close this career with a history of the country and your movement.',
    target: 'none',
    cost: 0,
    influence: 0,
    cooldown: 0,
  },
];
const groups: Group[] = [
  'workers',
  'farmers',
  'professionals',
  'owners',
  'pensioners',
];
const needs: Need[] = [
  'food',
  'energy',
  'housing',
  'health',
  'security',
  'freedom',
];
const clamp = (n: number, min = 0, max = 10000) =>
  Math.max(min, Math.min(max, Math.round(n)));
const mean = (values: number[]) =>
  values.length
    ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
    : 0;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
function random(s: { randomState: number }) {
  s.randomState = (s.randomState + 0x6d2b79f5) >>> 0;
  let t = Math.imul(s.randomState ^ (s.randomState >>> 15), 1 | s.randomState);
  t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function between(s: { randomState: number }, lo: number, hi: number) {
  return lo + Math.floor(random(s) * (hi - lo + 1));
}
function pick<T>(s: { randomState: number }, items: T[]): T {
  return items[Math.floor(random(s) * items.length)];
}
export function formatDate(day: number) {
  return `Day ${(day % 30) + 1} · ${
    [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ][Math.floor(day / 30) % 12]
  } · Year ${Math.floor(day / 360) + 1}`;
}
export function approval(s: WorldState) {
  const c = s.regions.flatMap(r => r.cohorts);
  const total = c.reduce((n, p) => n + p.size, 0);
  return Math.round(
    c.reduce((n, p) => n + p.support * p.size, 0) / Math.max(1, total),
  );
}
export function coalitionSeats(s: WorldState) {
  return s.factions.filter(f => f.coalition).reduce((n, f) => n + f.seats, 0);
}
export function regionHappiness(s: WorldState, regionId: string) {
  const r = s.regions.find(p => p.id === regionId);
  return r ? mean(r.cohorts.map(c => mean(Object.values(c.needs)))) : 0;
}
export function activeSituations(s: WorldState) {
  return s.situations.filter(i => i.stage !== 'resolved');
}
function news(
  s: WorldState,
  title: string,
  detail: string,
  severity: News['severity'] = 'brief',
  extra: Partial<News> = {},
) {
  const item: News = {
    id: `n-${s.sequence++}`,
    day: s.day,
    title,
    detail,
    severity,
    impacts: [],
    ...extra,
  };
  s.news.unshift(item);
  if (severity === 'crisis') s.lastCriticalId = item.id;
  return item.id;
}
function remember(
  s: WorldState,
  actor: Actor,
  sourceId: string,
  subject: string,
  effect: number,
) {
  actor.trust = clamp(actor.trust + effect);
  actor.loyalty = clamp(actor.loyalty + effect / 2);
  actor.memories.push({ day: s.day, sourceId, subject, effect });
  if (actor.memories.length > 24) actor.memories.shift();
}
export function createWorld(
  config: WorldConfig,
  content: ContentPack = BASE_CONTENT,
  policy: NumericalPolicy = BASE_POLICY,
): WorldState {
  validateArtifacts(content, policy);
  if (
    (config.contentVersion && config.contentVersion !== content.version) ||
    (config.policyVersion && config.policyVersion !== policy.version)
  )
    throw new Error('The pinned content or policy is unavailable.');
  if (
    !Number.isSafeInteger(config.seed) ||
    config.seed < 0 ||
    config.seed > 4294967295
  )
    throw new Error('Seed must be an unsigned 32-bit integer.');
  const rng = { randomState: config.seed };
  const start = config.start ?? 'government';
  const country =
    pick(rng, [
      'Avel',
      'Merid',
      'Vesper',
      'Caldr',
      'Ors',
      'Sel',
      'Ner',
      'Val',
    ]) + pick(rng, ['ora', 'ia', 'enne', 'ovia', 'ara', 'est']);
  const names = [
    'Northmere',
    'Bellhaven',
    'West Vale',
    'Redwater',
    'Linden Coast',
    'Ashford',
    'Green March',
    'Stonebridge',
  ];
  const factionNames = [
    'Labor Congress',
    'Rural Compact',
    'Civic Union',
    'Enterprise League',
    'Social Accord',
    'Security Council',
  ];
  const regions = names.map((name, index) => ({
    id: `r${index}`,
    name: pick(rng, ['Upper ', 'Lower ', 'Old ', 'New ', '']) + name,
    x: 1 + (index % 4) * 2 + between(rng, -40, 40) / 100,
    y: 1 + Math.floor(index / 4) * 3 + between(rng, -60, 60) / 100,
    terrain: (index % 4 === 3
      ? 'coast'
      : index % 3 === 0
      ? 'hills'
      : 'plain') as 'coast' | 'hills' | 'plain',
    identity: pick(rng, [
      'Industrial heartland',
      'Farming communities',
      'Trading towns',
      'Historic provincial identity',
      'University communities',
    ]),
    wealth: between(rng, 3500, 7500),
    production: between(rng, 3500, 7000),
    pollution: between(rng, 800, 3500),
    corruption: between(rng, 1500, 4800),
    capacity: between(rng, 3500, 7600),
    staffing: between(rng, 4000, 8000),
    services: between(rng, 3000, 6700),
    cohorts: groups.map(
      group =>
        ({
          id: `r${index}-${group}`,
          group,
          size: between(rng, 18000, 130000),
          income:
            group === 'owners'
              ? between(rng, 7000, 9000)
              : between(rng, 4000, 6500),
          employment: group === 'pensioners' ? 10000 : between(rng, 6500, 8900),
          costOfLiving: between(rng, 4000, 6000),
          needs: Object.fromEntries(
            needs.map(need => [need, between(rng, 4000, 7800)]),
          ) as Record<Need, number>,
          support: between(rng, 3900, 6500),
          grievance: between(rng, 1200, 4200),
          organization: between(rng, 1800, 5000),
        } as Cohort),
    ),
  }));
  const factions: Faction[] = factionNames.map((name, i) => ({
    id: `f${i}`,
    name,
    group: i === 5 ? 'security' : groups[i],
    seats: [25, 20, 20, 20, 15, 0][i],
    support: between(rng, 4000, 6800),
    cohesion: between(rng, 4000, 8000),
    coalition: i < 3,
    priorities:
      i === 5
        ? ['security']
        : i === 3
        ? ['energy', 'security']
        : i === 2
        ? ['freedom', 'health']
        : ['food', 'health'],
  }));
  const seatShift = between(rng, -5, 5);
  factions[0].seats += seatShift;
  factions[3].seats -= seatShift;
  const coalitionShift = between(rng, 0, 9);
  factions[2].seats -= coalitionShift;
  factions[4].seats += coalitionShift;
  const first = [
    'Mara',
    'Ilan',
    'Sera',
    'Anton',
    'Nadia',
    'Tomas',
    'Leila',
    'Emil',
    'Amara',
    'Nikol',
    'Ravi',
    'Elena',
  ];
  const last = [
    'Voss',
    'Dalen',
    'Sorin',
    'Vey',
    'Marek',
    'Kest',
    'Arden',
    'Sol',
    'Navar',
    'Quill',
    'Senn',
    'Valen',
  ];
  const actors: Actor[] = Array.from({ length: 24 }, (_, i) => ({
    id: `a${i}`,
    name: `${first[i % first.length]} ${pick(rng, last)}`,
    role: [
      'Party chair',
      'Provincial governor',
      'Union organizer',
      'Minister',
      'Business representative',
      'General',
    ][i % 6],
    factionId: `f${i % 6}`,
    regionId: `r${i % 8}`,
    portrait: i % 16,
    age: between(rng, 30, 67),
    ambition: between(rng, 2000, 9000),
    competence: between(rng, 3000, 9000),
    influence: between(rng, 2000, 8000),
    trust: between(rng, 3500, 7500),
    loyalty: between(rng, 3000, 7500),
    resources: between(rng, 3000, 8000),
    plan: 'support',
    nextPlanDay: between(rng, 14, 65),
    memories: [],
    ...(i === 3 ? { office: 'Prime minister' } : {}),
  }));
  const s: WorldState = {
    schemaVersion: 3,
    engineVersion: ENGINE_VERSION,
    contentVersion: CONTENT_VERSION,
    policyVersion: POLICY_VERSION,
    id: config.id ?? `world-${config.seed}-${start}`,
    config: { ...config, start },
    seed: config.seed,
    randomState: rng.randomState,
    day: 0,
    revision: 0,
    sequence: 0,
    name: country,
    motto: pick(rng, [
      'A country divided. A future unwritten.',
      'The people remember. Power changes hands.',
      'Every promise has a constituency.',
    ]),
    regime: start === 'successor' ? 'monarchy' : 'republic',
    role: start,
    status: 'active',
    leader: {
      name: `${pick(rng, first)} ${pick(rng, last)}`,
      age: 38,
      portrait: between(rng, 0, 15),
      generation: 1,
    },
    movement: {
      funds: 600,
      name: pick(rng, [
        'Forward Alliance',
        'Common Ground',
        'Reform Coalition',
        'National Renewal',
      ]),
      organization: 4200,
      reputation: 5200,
      influence: 70,
    },
    treasury:
      config.difficulty === 'strategist'
        ? 4200
        : config.difficulty === 'veteran'
        ? 5400
        : 6800,
    debt: between(rng, 2500, 5500),
    legitimacy: 5600,
    corruption: 3000,
    taxRate: 24,
    fuelSubsidy: 35,
    censorship: false,
    emergencyUntil: 0,
    electionDay: start === 'successor' ? 540 : 180,
    lastElectionShare: 5200,
    electionCount: 0,
    budget: {
      revenue: 0,
      expenses: 0,
      debtService: 0,
      projectMaintenance: 0,
      imports: 0,
      net: 0,
    },
    economy: {
      employment: 0,
      inflation: 0,
      production: 0,
      purchasingPower: 0,
      growth: 0,
    },
    regions,
    factions,
    actors,
    institutions: [
      {
        id: 'assembly',
        name: 'National Assembly',
        independence: 6500,
        capacity: 6500,
        confidence: 6000,
      },
      {
        id: 'courts',
        name: 'High Court',
        independence: 7200,
        capacity: 5700,
        confidence: 6100,
      },
      {
        id: 'administration',
        name: 'Civil Service',
        independence: 6000,
        capacity: 5600,
        confidence: 5800,
      },
      {
        id: 'military',
        name: 'General Staff',
        independence: 4800,
        capacity: 6400,
        confidence: 5800,
      },
      {
        id: 'press',
        name: 'Independent Press',
        independence: 7500,
        capacity: 6500,
        confidence: 5700,
      },
    ],
    projects: [],
    commitments: [],
    negotiations: [],
    situations: [],
    neighbors: Array.from({ length: 4 }, (_, i) => ({
      id: `foreign-${i}`,
      name:
        pick(rng, [
          'Estara',
          'Dorven',
          'Lys',
          'Ostmark',
          'Verona',
          'Talar',
          'Belen',
        ]) + ` ${['Union', 'Republic', 'Kingdom', 'Federation'][i]}`,
      relation: between(rng, -30, 50),
      aggression: between(rng, 2000, 7500),
      trade: i === 0,
      allied: false,
      war: false,
      power: between(rng, 3500, 8000),
      grievances: 0,
    })),
    news: [],
    journal: [],
    appliedReceipts: [],
    cooldowns: {},
  };
  s.randomState = rng.randomState;
  s.content = clone(content);
  s.policy = clone(policy);
  s.contentVersion = content.version;
  s.policyVersion = policy.version;
  s.config.contentVersion = content.version;
  s.config.policyVersion = policy.version;
  // A seeded inherited weakness gives each opening an actual political problem.
  const weak = s.regions[config.seed % s.regions.length];
  weak.services = 2500;
  weak.cohorts.forEach(c => {
    c.needs.health = 2800;
    c.grievance = 4500;
    c.organization = 4600;
  });
  news(
    s,
    `${country}: a new chapter`,
    `${s.leader.name} enters ${
      start === 'government'
        ? 'a fragile government'
        : start === 'opposition'
        ? 'opposition politics'
        : 'the succession contest'
    }. ${weak.name} is demanding better public services.`,
    'pressure',
    { regionId: weak.id },
  );
  recompute(s);
  return s;
}

export function getTargets(
  s: WorldState,
  id: CommandId,
): Array<{ id: string; name: string }> {
  const d = DECISIONS.find(a => a.id === id);
  if (!d) return [];
  if (d.target === 'region') return s.regions;
  if (d.target === 'actor') return s.actors;
  if (d.target === 'institution')
    return s.institutions.filter(i =>
      id === 'reform' ? i.id === 'assembly' : i.id !== 'military',
    );
  if (d.target === 'nation') return s.neighbors;
  if (d.target === 'situation')
    return activeSituations(s).map(i => ({
      id: i.id,
      name: `${s.regions.find(r => r.id === i.regionId)?.name}: ${i.demand}`,
    }));
  return [];
}
export function getDecisionPreview(s: WorldState, c: Command): DecisionPreview {
  const d = DECISIONS.find(a => a.id === c.id);
  if (!d)
    return {
      allowed: false,
      reason: 'Unknown political action.',
      cost: 0,
      influence: 0,
      consequences: [],
    };
  const kind = (c.option ?? 'clinic') as ProjectKind;
  const p = PROJECTS[kind];
  const counter = s.negotiations.find(
    n =>
      n.actorId === c.targetId &&
      n.status === 'counteroffer' &&
      n.expiresDay > s.day,
  );
  const negotiatedOffer =
    c.option === 'counteroffer' ? counter?.requested : c.option;
  const cost =
    c.id === 'project' && p
      ? p.cost
      : c.id === 'negotiate' && negotiatedOffer === 'funding'
      ? 300
      : d.cost;
  const consequences = [d.description];
  const account = !d.government ? 'movement' : 'treasury';
  let reason: string | undefined;
  if (s.status !== 'active') reason = 'This career is archived.';
  else if (d.government && s.role !== 'government')
    reason = 'Your movement must hold executive office.';
  else if ((s.cooldowns[c.id] ?? 0) > s.day)
    reason = `Available in ${s.cooldowns[c.id]! - s.day} days.`;
  else if (
    d.target !== 'none' &&
    !getTargets(s, c.id).some(t => t.id === c.targetId)
  )
    reason = `Select a ${d.target}.`;
  else if ((account === 'movement' ? s.movement.funds : s.treasury) < cost)
    reason = `Requires ${cost} ${account} credits.`;
  else if (s.movement.influence < d.influence)
    reason = `Requires ${d.influence} political capital.`;
  else if ((c.id === 'project' || c.id === 'promise') && !p)
    reason = 'Select a valid public project.';
  else if (
    c.id === 'project' &&
    s.projects.some(x => x.regionId === c.targetId && x.kind === kind)
  )
    reason =
      'This regional program already exists. Suspended services resume when public reserves recover above 500 credits.';
  else if (
    c.id === 'promise' &&
    s.commitments.some(
      x => x.regionId === c.targetId && x.kind === kind && x.status === 'open',
    )
  )
    reason = 'You have already made this commitment.';
  else if (
    c.id === 'promise' &&
    s.projects.some(
      x =>
        x.regionId === c.targetId &&
        x.kind === kind &&
        x.status === 'operating',
    )
  )
    reason =
      'This service is already operating. Choose an unmet need for your public commitment.';
  else if (
    (c.id === 'tax' || c.id === 'subsidy') &&
    (!Number.isInteger(c.value) ||
      c.value! < 0 ||
      c.value! > (c.id === 'tax' ? 50 : 100))
  )
    reason = 'Choose a value in the allowed range.';
  else if (
    (c.id === 'tax' && c.value === s.taxRate) ||
    (c.id === 'subsidy' && c.value === s.fuelSubsidy)
  )
    reason = 'This is already the current policy level.';
  else if (c.id === 'reform' && c.option === s.regime)
    reason = 'This constitutional form is already in force.';
  else if (
    c.id === 'succession' &&
    s.actors.some(a => a.id === c.targetId && a.name === s.leader.name)
  )
    reason = 'This person already leads your movement.';
  else if (
    ['tax', 'reform'].includes(c.id) &&
    coalitionSeats(s) < 51 &&
    s.emergencyUntil <= s.day
  )
    reason = 'Secure a parliamentary majority or lawful emergency authority.';
  else if (
    c.id === 'reform' &&
    (!['republic', 'monarchy', 'autocracy'].includes(c.option ?? '') ||
      s.legitimacy < 4500)
  )
    reason =
      'A constitutional settlement needs legitimacy of at least 45% and a specified regime.';
  else if (c.id === 'borrow' && s.debt > 18000)
    reason = 'Creditors require debt below 18,000 before lending again.';
  else if (c.id === 'restructure' && s.debt < 8000)
    reason =
      'A formal restructuring requires at least 8,000 credits of public debt.';
  else if (c.id === 'emergency' && s.legitimacy < 3500)
    reason =
      'The institutions will not recognize emergency authority below 35% legitimacy.';
  else if (
    c.id === 'succession' &&
    s.role === 'successor' &&
    (s.day < 90 || s.legitimacy < 4000 || coalitionSeats(s) < 51)
  )
    reason =
      'The succession council convenes after 90 days and requires 40% legitimacy and a majority of institutional allies.';
  else if (
    c.id === 'settle' &&
    s.situations.some(
      i =>
        i.id === c.targetId && !['services', 'cost-of-living'].includes(i.kind),
    )
  )
    reason =
      'Address this cause through an inquiry, constitutional negotiation, succession, or peace talks.';
  else if (
    c.id === 'arbitrate' &&
    s.situations.some(
      i => i.id === c.targetId && !['protest', 'strike'].includes(i.stage),
    )
  )
    reason = 'Emergency dispersal requires an actual demonstration or strike.';
  else if (c.id === 'coup' && s.role === 'government')
    reason = 'You already hold executive authority.';
  else if (
    c.id === 'coup' &&
    (s.movement.organization < 5500 || s.factions[5].support < 5000)
  )
    reason =
      'Requires movement organization of 55% and security support of 50%.';
  else if (
    c.id === 'negotiate' &&
    !['policy', 'portfolio', 'funding', 'endorsement', 'counteroffer'].includes(
      c.option ?? 'policy',
    )
  )
    reason = 'Select a valid negotiation offer.';
  else if (c.id === 'negotiate' && c.option === 'counteroffer' && !counter)
    reason = 'There is no unexpired counteroffer from this actor.';
  else if (
    c.id === 'negotiate' &&
    negotiatedOffer === 'portfolio' &&
    s.role !== 'government'
  )
    reason = 'Only a governing leader can offer a cabinet portfolio.';
  const n = s.neighbors.find(x => x.id === c.targetId);
  if (!reason && n) {
    if (c.id === 'peace' && !n.war)
      reason = 'There is no active conflict with this country.';
    if (c.id === 'alliance' && (n.relation < 20 || n.war))
      reason = 'Requires peaceful relations of at least +20.';
    if (c.id === 'alliance' && n.allied)
      reason = 'An alliance is already in force.';
    if (c.id === 'trade' && (n.war || n.trade))
      reason = n.war
        ? 'Trade cannot start during a war.'
        : 'A trade agreement is already active.';
    if (c.id === 'border-conflict' && (n.war || n.allied))
      reason = 'The country is already at war or protected by your alliance.';
  }
  if (c.id === 'project' && p)
    consequences.push(
      `${
        s.content?.projectDuration[kind] ?? p.duration
      } days before capacity and corruption adjustments; ${
        p.maintenance
      } monthly maintenance.`,
      'A completed building still requires staff and a funded operating budget.',
    );
  if (c.id === 'tax')
    consequences.push(
      'Higher taxes improve receipts but reduce owner confidence and investment.',
    );
  if (c.id === 'tax' && Number.isFinite(c.value))
    consequences.push(
      `At current output, monthly revenue changes by approximately ${Math.round(
        s.economy.production * ((c.value! - s.taxRate) / 100) * 0.75,
      )} credits. Owners bear the largest immediate tax reaction.`,
    );
  if (c.id === 'subsidy')
    consequences.push(
      'Cuts raise household energy costs first; fiscal savings arrive at the monthly settlement.',
    );
  if (c.id === 'subsidy' && Number.isFinite(c.value))
    consequences.push(
      `Monthly spending changes by ${
        (c.value! - s.fuelSubsidy) * 4
      } credits. Household energy provision tends toward ${
        (c.value! - s.fuelSubsidy) / 4
      } percentage points above its present policy baseline.`,
    );
  if (c.id === 'promise')
    consequences.push(
      'The movement is judged on delivery within 180 days, including after losing office.',
    );
  if (c.id === 'negotiate') {
    const a = s.actors.find(x => x.id === c.targetId);
    if (a)
      consequences.push(
        `${a.name} weighs the offer against trust, ambition and constituency needs; agreement is not guaranteed.`,
      );
    if (a)
      consequences.push(
        `Trust ${Math.round(a.trust / 100)}%; ${
          s.factions.find(f => f.id === a.factionId)!.name
        } holds ${s.factions.find(f => f.id === a.factionId)!.seats} seats.`,
      );
    if (counter)
      consequences.push(
        `Outstanding counteroffer: ${counter.requested}, expires in ${
          counter.expiresDay - s.day
        } days.`,
      );
  }
  return {
    allowed: !reason,
    reason,
    cost,
    account,
    influence: d.influence,
    consequences,
    dueDay:
      c.id === 'project' && p
        ? s.day + (s.content?.projectDuration[kind] ?? p.duration)
        : c.id === 'promise'
        ? s.day + 180
        : undefined,
  };
}

export function dispatchCommand(current: WorldState, c: Command): WorldState {
  const existing = c.clientId
    ? current.journal.find(e => e.command.clientId === c.clientId)
    : undefined;
  if (existing) {
    if (canonicalJson(existing.command) !== canonicalJson(c))
      throw new Error('Command identifier was reused with different terms.');
    return current;
  }
  const preview = getDecisionPreview(current, c);
  if (!preview.allowed) throw new Error(preview.reason);
  const s = clone(current);
  const d = DECISIONS.find(x => x.id === c.id)!;
  const region = s.regions.find(r => r.id === c.targetId);
  const actor = s.actors.find(a => a.id === c.targetId);
  const institution = s.institutions.find(i => i.id === c.targetId);
  const situation = s.situations.find(i => i.id === c.targetId);
  const nation = s.neighbors.find(n => n.id === c.targetId);
  const kind = (c.option ?? 'clinic') as ProjectKind;
  if (preview.account === 'movement') s.movement.funds -= preview.cost;
  else s.treasury -= preview.cost;
  s.movement.influence -= preview.influence;
  s.cooldowns[c.id] = s.day + d.cooldown;
  const source = news(
    s,
    d.label,
    `${s.leader.name}: ${d.description}`,
    'brief',
    {
      regionId: region?.id,
      actorId: actor?.id,
      impacts: [
        ...(preview.cost
          ? [
              `${
                preview.account === 'movement' ? 'Movement funds' : 'Treasury'
              } −${preview.cost}`,
            ]
          : []),
        ...(preview.influence
          ? [`Political capital −${preview.influence}`]
          : []),
      ],
    },
  );
  if (c.id === 'campaign' && region) {
    region.cohorts.forEach(p => (p.support = clamp(p.support + 180)));
    s.movement.reputation = clamp(s.movement.reputation + 40);
  }
  if (c.id === 'organize' && region) {
    s.movement.organization = clamp(s.movement.organization + 130);
    s.movement.influence = clamp(s.movement.influence + 4, 0, 100);
    region.cohorts.forEach(p => (p.organization = clamp(p.organization + 130)));
  }
  if (c.id === 'promise' && region) {
    s.commitments.push({
      id: `promise-${s.sequence++}`,
      regionId: region.id,
      kind,
      dueDay: s.day + 180,
      status: 'open',
      sourceId: source,
    });
    region.cohorts.forEach(p => (p.support = clamp(p.support + 180)));
  }
  if (c.id === 'project' && region) {
    const p = PROJECTS[kind];
    s.projects.push({
      id: `project-${s.sequence++}`,
      regionId: region.id,
      kind,
      startedDay: s.day,
      dueDay: s.day + (s.content?.projectDuration[kind] ?? p.duration),
      progress: 0,
      cost: p.cost,
      maintenance: p.maintenance,
      status: 'building',
      sourceId: source,
    });
  }
  if (c.id === 'tax') {
    const change = c.value! - s.taxRate;
    s.taxRate = c.value!;
    s.factions.forEach(
      f =>
        (f.support = clamp(
          f.support + (f.group === 'owners' ? -change * 55 : change * 8),
        )),
    );
    s.actors
      .filter(a => a.factionId === 'f3')
      .forEach(a => remember(s, a, source, 'Tax settlement', -change * 35));
  }
  if (c.id === 'subsidy') {
    const change = c.value! - s.fuelSubsidy;
    s.fuelSubsidy = c.value!;
    s.regions.forEach(r =>
      r.cohorts.forEach(p => {
        p.needs.energy = clamp(
          p.needs.energy + change * (p.group === 'owners' ? 10 : 35),
        );
        p.costOfLiving = clamp(p.costOfLiving - change * 18);
      }),
    );
    s.factions[0].support = clamp(s.factions[0].support + change * 25);
  }
  if (c.id === 'borrow') {
    s.treasury += 2000;
    s.debt += 2000;
  }
  if (c.id === 'restructure') {
    const before = s.debt;
    s.debt = Math.round(s.debt * 0.55);
    s.legitimacy = clamp(s.legitimacy - 350);
    s.foreignPressureUntil = Math.max(s.foreignPressureUntil ?? 0, s.day + 180);
    s.neighbors.forEach(n => (n.relation = clamp(n.relation - 8, -100, 100)));
    news(
      s,
      'Creditors accept a restructuring',
      `${
        before - s.debt
      } credits of principal are written off. Import financing tightens for six months and foreign relations deteriorate.`,
      'pressure',
      { sourceId: source },
    );
  }
  if (c.id === 'negotiate' && actor) {
    const f = s.factions.find(x => x.id === actor.factionId)!;
    const prior = s.negotiations.find(
      n =>
        n.actorId === actor.id &&
        n.status === 'counteroffer' &&
        n.expiresDay > s.day,
    );
    const offer =
      c.option === 'counteroffer' ? prior!.requested : c.option ?? 'policy';
    const score =
      actor.trust +
      (offer === 'portfolio'
        ? actor.ambition / 2
        : offer === 'funding'
        ? 2600
        : 1800) -
      actor.ambition / 5;
    if (score >= 4800 || c.option === 'counteroffer') {
      if (prior) prior.status = 'agreed';
      else
        s.negotiations.push({
          id: `negotiation-${s.sequence++}`,
          actorId: actor.id,
          offered: offer,
          requested: offer as
            | 'policy'
            | 'portfolio'
            | 'funding'
            | 'endorsement',
          expiresDay: s.day + 30,
          status: 'agreed',
          sourceId: source,
        });
      f.coalition = true;
      f.support = clamp(f.support + 450);
      remember(s, actor, source, `${offer} agreement`, 500);
      if (offer === 'portfolio') actor.office = 'Coalition minister';
      if (offer === 'endorsement')
        s.regions
          .find(r => r.id === actor.regionId)!
          .cohorts.forEach(p => (p.support = clamp(p.support + 180)));
      if (
        offer === 'policy' &&
        !s.commitments.some(
          p =>
            p.regionId === actor.regionId &&
            p.kind === 'clinic' &&
            p.status === 'open',
        )
      ) {
        s.commitments.push({
          id: `promise-${s.sequence++}`,
          regionId: actor.regionId,
          kind: 'clinic',
          dueDay: s.day + 180,
          status: 'open',
          sourceId: source,
        });
      }
      if (offer === 'funding')
        s.regions.find(r => r.id === actor.regionId)!.services = clamp(
          s.regions.find(r => r.id === actor.regionId)!.services + 450,
        );
      news(
        s,
        `${actor.name} accepts the agreement`,
        `${f.name} backs your coalition. ${
          offer === 'policy'
            ? 'A clinic commitment is now on the public record.'
            : offer === 'portfolio'
            ? 'The portfolio changes who controls implementation.'
            : offer === 'endorsement'
            ? 'Mutual endorsement improves regional campaign support.'
            : 'Regional funding must translate into lasting services.'
        }`,
        'brief',
        { sourceId: source, actorId: actor.id },
      );
    } else {
      if (prior) prior.status = 'expired';
      const requested =
        s.role === 'government' && actor.ambition > 6500
          ? 'portfolio'
          : 'funding';
      s.negotiations.push({
        id: `negotiation-${s.sequence++}`,
        actorId: actor.id,
        offered: offer,
        requested,
        expiresDay: s.day + 30,
        status: 'counteroffer',
        sourceId: source,
      });
      remember(s, actor, source, 'Rejected negotiation', -100);
      news(
        s,
        `${actor.name} makes a counteroffer`,
        `${actor.name} requests ${
          requested === 'portfolio'
            ? 'a cabinet portfolio'
            : '300 movement credits for regional relief'
        } in return for coalition support. This counteroffer expires in 30 days.`,
        'pressure',
        { sourceId: source, actorId: actor.id },
      );
    }
  }
  if (c.id === 'appoint' && actor) {
    s.actors.forEach(a => {
      if (a.office === 'Prime minister') {
        delete a.office;
        remember(s, a, source, 'Lost ministerial office', -700);
      }
    });
    actor.office = 'Prime minister';
    remember(s, actor, source, 'Ministerial appointment', 650);
    s.institutions.find(i => i.id === 'administration')!.capacity = clamp(
      4000 + actor.competence / 3,
    );
  }
  if (c.id === 'patronage' && actor) {
    remember(s, actor, source, 'Patronage', 900);
    s.corruption = clamp(s.corruption + 500);
    s.regions.find(r => r.id === actor.regionId)!.corruption = clamp(
      s.regions.find(r => r.id === actor.regionId)!.corruption + 650,
    );
    s.legitimacy = clamp(s.legitimacy - 160);
  }
  if (c.id === 'investigate' && institution) {
    institution.independence = clamp(institution.independence + 250);
    s.corruption = clamp(s.corruption - 500);
    s.regions.forEach(r => (r.corruption = clamp(r.corruption - 350)));
    s.legitimacy = clamp(s.legitimacy + 200);
    s.actors
      .filter(a => a.memories.some(m => m.subject === 'Patronage'))
      .forEach(a => remember(s, a, source, 'Independent inquiry', -700));
  }
  if (c.id === 'censor') {
    s.censorship = !s.censorship;
    s.institutions.find(i => i.id === 'press')!.independence = s.censorship
      ? 2200
      : 7500;
    s.legitimacy = clamp(s.legitimacy + (s.censorship ? -350 : 200));
  }
  if (c.id === 'emergency') {
    s.emergencyUntil = s.day + 90;
    s.legitimacy = clamp(s.legitimacy - 450);
    s.factions[5].support = clamp(s.factions[5].support + 250);
  }
  if (c.id === 'reform' && institution) {
    const previous = s.regime;
    s.regime = c.option as WorldState['regime'];
    s.legitimacy = clamp(
      s.legitimacy + (s.regime === 'autocracy' ? -900 : 350),
    );
    institution.confidence = clamp(institution.confidence + 250);
    s.electionDay = s.day + (s.regime === 'republic' ? 360 : 720);
    news(
      s,
      'A constitutional settlement',
      `${previous} gives way to ${s.regime}. Existing debts, promises and political relationships survive the transition.`,
      'crisis',
      { sourceId: source },
    );
  }
  if (c.id === 'succession' && actor) {
    s.leader = {
      name: actor.name,
      age: actor.age,
      portrait: actor.portrait,
      generation: s.leader.generation + 1,
    };
    if (s.role === 'successor') s.role = 'government';
    s.situations
      .filter(i => i.kind === 'succession')
      .forEach(i => {
        i.stage = 'resolved';
        i.resolvedDay = s.day;
      });
    s.actors
      .filter(a => a.id !== actor.id && a.ambition > 7000)
      .forEach(a => remember(s, a, source, 'Passed over in succession', -700));
    s.movement.reputation = clamp(
      s.movement.reputation + (actor.competence - 5000) / 5,
    );
    news(
      s,
      'A new leader inherits the movement',
      `${actor.name} succeeds to the leadership. Unfulfilled commitments remain binding.`,
      'crisis',
      { sourceId: source, actorId: actor.id },
    );
  }
  if (c.id === 'coup') {
    const score =
      (s.factions[5].support +
        s.movement.organization +
        mean(s.actors.filter(a => a.factionId === 'f5').map(a => a.loyalty))) /
      3;
    const success = score > 5200 + between(s, 0, 1500);
    s.legitimacy = clamp(s.legitimacy - (success ? 1500 : 900));
    s.movement.organization = clamp(s.movement.organization - 800);
    if (success) {
      s.role = 'government';
      s.regime = 'autocracy';
      s.electionDay = s.day + 720;
    } else {
      s.movement.reputation = clamp(s.movement.reputation - 600);
    }
    news(
      s,
      success ? 'Authority changes hands' : 'The challenge fails',
      success
        ? 'Institutional allies transfer executive authority to your movement. Public legitimacy must now be rebuilt.'
        : 'Your movement survives in opposition, weakened and divided.',
      'crisis',
      { sourceId: source },
    );
  }
  if ((c.id === 'settle' || c.id === 'arbitrate') && situation) {
    situation.stage = 'resolved';
    situation.resolvedDay = s.day;
    const r = s.regions.find(x => x.id === situation.regionId)!;
    r.cohorts.forEach(p => {
      p.grievance = clamp(p.grievance - (c.id === 'settle' ? 1800 : 600));
      if (c.id === 'settle') {
        p.needs.health = clamp(p.needs.health + 600);
        p.needs.food = clamp(p.needs.food + 500);
      } else {
        p.needs.freedom = clamp(p.needs.freedom - 900);
        p.support = clamp(p.support - 400);
      }
    });
    if (c.id === 'settle')
      s.commitments.push({
        id: `promise-${s.sequence++}`,
        regionId: r.id,
        kind: 'clinic',
        dueDay: s.day + 180,
        status: 'open',
        sourceId: source,
      });
    else s.legitimacy = clamp(s.legitimacy - 350);
    news(
      s,
      c.id === 'settle'
        ? 'A settlement, with obligations'
        : 'The gathering disperses',
      c.id === 'settle'
        ? `${r.name} receives relief and a clinic promise. Delivery will decide whether the settlement lasts.`
        : 'The grievance remains. Organizers will remember the loss of political freedom.',
      'brief',
      { sourceId: source, regionId: r.id },
    );
  }
  if (nation) {
    if (c.id === 'trade') {
      nation.trade = true;
      nation.relation = clamp(nation.relation + 12, -100, 100);
    }
    if (c.id === 'aid')
      nation.relation = clamp(nation.relation + 18, -100, 100);
    if (c.id === 'alliance') nation.allied = true;
    if (c.id === 'sanction') {
      nation.trade = false;
      nation.relation = clamp(nation.relation - 25, -100, 100);
      nation.grievances += 500;
    }
    if (c.id === 'border-conflict') {
      nation.war = true;
      nation.trade = false;
      nation.allied = false;
      s.legitimacy = clamp(s.legitimacy - 500);
      news(
        s,
        `Border conflict with ${nation.name}`,
        'An actual military commitment now draws resources away from domestic services.',
        'crisis',
        { sourceId: source },
      );
    }
    if (c.id === 'peace') {
      nation.war = false;
      nation.relation = clamp(nation.relation + 20, -100, 100);
      s.situations
        .filter(i => i.kind === 'war' && !s.neighbors.some(n => n.war))
        .forEach(i => {
          i.stage = 'resolved';
          i.resolvedDay = s.day;
        });
    }
  }
  if (c.id === 'retire') {
    s.status = 'retired';
    s.legacy = `${s.leader.name} led ${s.movement.name} through ${
      s.electionCount
    } elections over ${Math.floor(s.day / 360)} years. ${
      s.commitments.filter(p => p.status === 'fulfilled').length
    } promises delivered; ${
      s.commitments.filter(p => p.status === 'broken').length
    } broken. Final public support: ${Math.round(approval(s) / 100)}%.`;
  }
  s.journal.push({ day: s.day, sequence: s.revision, command: clone(c) });
  s.revision++;
  recompute(s);
  return s;
}

function recompute(s: WorldState) {
  const people = s.regions.flatMap(r => r.cohorts);
  const production = mean(s.regions.map(r => r.production));
  const employment = mean(people.map(c => c.employment));
  const purchasingPower = mean(
    people.map(c => clamp(5000 + c.income - c.costOfLiving)),
  );
  const imports = s.neighbors.filter(n => n.trade && !n.war).length * 45;
  const revenue =
    Math.round(((production * s.taxRate) / 100) * 0.75) + imports * 2;
  const projectMaintenance = s.projects
    .filter(p => p.status === 'operating')
    .reduce((n, p) => n + p.maintenance, 0);
  const debtService = Math.round(s.debt * 0.012);
  const expenses =
    Math.round(480 + mean(s.regions.map(r => r.services)) / 15) +
    s.fuelSubsidy * 4 +
    projectMaintenance +
    debtService +
    s.neighbors.filter(n => n.war).length * 220;
  s.budget = {
    revenue,
    expenses,
    debtService,
    projectMaintenance,
    imports,
    net: revenue - expenses,
  };
  s.economy = {
    employment,
    inflation: clamp(mean(people.map(c => c.costOfLiving)) - 3500),
    production,
    purchasingPower,
    growth: clamp(5000 + (production - 5000) / 2 - (s.taxRate - 24) * 30),
  };
}
function newSituation(
  s: WorldState,
  kind: Situation['kind'],
  regionId: string,
  pressure: number,
  demand: string,
  causes: string[],
) {
  const recent = s.situations.some(
    i =>
      i.kind === kind &&
      i.regionId === regionId &&
      (i.stage !== 'resolved' || s.day - (i.resolvedDay ?? 0) < 90),
  );
  if (recent) return;
  const actor =
    s.actors.find(a => a.regionId === regionId && a.plan === 'organize') ??
    s.actors.find(a => a.regionId === regionId)!;
  const id = `issue-${s.sequence++}`;
  const sourceId = news(
    s,
    `${s.regions.find(r => r.id === regionId)!.name}: ${demand}`,
    causes.join(' '),
    'pressure',
    { regionId, actorId: actor.id },
  );
  s.situations.push({
    id,
    kind,
    regionId,
    actorId: actor.id,
    stage: 'grievance',
    pressure,
    startedDay: s.day,
    nextDay: s.day + 14,
    demand,
    causes,
    sourceId,
  });
}
function advancePeople(s: WorldState) {
  const trade =
    s.neighbors.filter(n => n.trade && !n.war).length +
    ((s.foreignTradeUntil ?? 0) > s.day ? 1 : 0);
  const war = s.neighbors.filter(n => n.war).length;
  for (const r of s.regions) {
    const operational = s.projects.filter(
      p => p.regionId === r.id && p.status === 'operating',
    );
    const strikes = s.situations.filter(
      i => i.regionId === r.id && i.stage === 'strike',
    ).length;
    const productive = operational.filter(
      p => p.kind === 'industry' || p.kind === 'transport',
    ).length;
    const productionTarget = clamp(
      r.wealth +
        productive * 900 +
        trade * 180 -
        r.pollution / 5 -
        strikes * 1000 -
        (s.taxRate - 24) * 35 -
        war * 400,
    );
    r.production = clamp(r.production + (productionTarget - r.production) / 60);
    r.pollution = clamp(r.pollution + (productive * 15 - r.pollution / 200));
    for (const p of r.cohorts) {
      const ownership = p.group === 'owners';
      const jobTarget = clamp(
        5800 + r.production / 3 - strikes * 850 + (ownership ? 700 : 0),
      );
      p.employment = clamp(p.employment + (jobTarget - p.employment) / 60);
      const incomeTarget = clamp(
        (ownership ? 6500 : 3000) +
          p.employment / 4 +
          r.production / (ownership ? 3 : 8) -
          (ownership ? s.taxRate * 35 : s.taxRate * 10),
      );
      p.income = clamp(p.income + (incomeTarget - p.income) / 75);
      const costTarget = clamp(
        5000 -
          s.fuelSubsidy * 12 +
          war * 350 -
          trade * 120 +
          (s.treasury < 250 ? 700 : 0) +
          ((s.foreignPressureUntil ?? 0) > s.day ? 200 : 0),
      );
      p.costOfLiving = clamp(
        p.costOfLiving + (costTarget - p.costOfLiving) / 30,
      );
      const purchasing = clamp(5000 + p.income - p.costOfLiving);
      for (const need of needs) {
        const provision = operational.filter(
          b => PROJECTS[b.kind].need === need,
        ).length;
        const target =
          need === 'freedom'
            ? (s.censorship ? 2300 : 7200) -
              (s.emergencyUntil > s.day ? 1500 : 0)
            : need === 'security'
            ? 7000 - war * 1600 - strikes * 900
            : need === 'health'
            ? r.services + provision * 2200 - r.pollution / 4
            : need === 'housing'
            ? 4500 + provision * 1800 + (p.income - 4500) / 2
            : need === 'energy'
            ? 4000 +
              s.fuelSubsidy * 25 +
              provision * 2000 +
              trade * 120 -
              war * 350
            : purchasing + provision * 700;
        p.needs[need] = clamp(
          p.needs[need] + (clamp(target) - p.needs[need]) / 30,
        );
      }
      const satisfaction = mean(Object.values(p.needs));
      const grievanceTarget = clamp(
        8500 - satisfaction + (10000 - p.employment) / 5,
      );
      p.grievance = clamp(p.grievance + (grievanceTarget - p.grievance) / 40);
      if (s.day % 7 === 0) {
        const performance = clamp(
          satisfaction -
            600 -
            (s.config.difficulty === 'strategist'
              ? 400
              : s.config.difficulty === 'veteran'
              ? 200
              : 0) +
            (s.legitimacy - 5000) / 4 +
            (s.movement.reputation - 5000) / 3,
        );
        const target =
          s.role === 'government'
            ? performance
            : clamp(
                10000 -
                  performance +
                  (s.movement.organization - 5000) / 3 +
                  (s.movement.reputation - 5000) / 3,
              );
        p.support = clamp(p.support + (target - p.support) / 12);
      }
    }
    if (s.day % 14 === 0) {
      const grievance = mean(r.cohorts.map(p => p.grievance));
      const health = mean(r.cohorts.map(p => p.needs.health));
      if (health < 4000)
        newSituation(
          s,
          'services',
          r.id,
          grievance,
          'Reliable public services',
          [
            `Health access is ${Math.round(health / 100)}%.`,
            `${r.name}'s administration has not met local needs.`,
          ],
        );
      else if (grievance > 4700)
        newSituation(
          s,
          'cost-of-living',
          r.id,
          grievance,
          'Wages that cover household costs',
          [`Living costs outpace satisfaction in ${r.name}.`],
        );
      if (r.corruption > 5000)
        newSituation(
          s,
          'corruption',
          r.id,
          r.corruption,
          'An independent procurement inquiry',
          [`Procurement integrity is falling in ${r.name}.`],
        );
    }
  }
}
function advanceProjects(s: WorldState) {
  for (const p of s.projects) {
    const r = s.regions.find(x => x.id === p.regionId)!;
    if (p.status === 'building' || p.status === 'delayed') {
      const efficiency = clamp(
        (r.capacity +
          r.staffing +
          s.institutions.find(i => i.id === 'administration')!.capacity) /
          3 -
          r.corruption / 3 -
          Math.max(
            0,
            s.projects.filter(
              pr => pr.status === 'building' || pr.status === 'delayed',
            ).length - 3,
          ) *
            250,
        1500,
        10000,
      );
      p.progress = clamp(
        p.progress +
          Math.max(
            1,
            Math.round(
              ((10000 /
                (s.content?.projectDuration[p.kind] ??
                  PROJECTS[p.kind].duration)) *
                efficiency) /
                6500,
            ),
          ),
      );
      if (s.treasury < 50) {
        p.progress = clamp(p.progress - 40);
        p.status = 'delayed';
      }
      if (p.progress >= 10000) {
        p.status = 'operating';
        news(
          s,
          `${PROJECTS[p.kind].label} opens`,
          `${r.name} gains new service capacity. Staffing and recurring funding determine its actual reach.`,
          'brief',
          { sourceId: p.sourceId, regionId: r.id },
        );
        s.commitments
          .filter(
            c =>
              c.status === 'open' && c.regionId === r.id && c.kind === p.kind,
          )
          .forEach(c => fulfil(s, c, p.sourceId));
      } else if (s.day > p.dueDay && p.status !== 'delayed') {
        p.status = 'delayed';
        news(
          s,
          'A delivery deadline slips',
          `${PROJECTS[p.kind].label} in ${
            r.name
          } is delayed by capacity and procurement problems.`,
          'pressure',
          { sourceId: p.sourceId, regionId: r.id },
        );
      }
    } else if (s.day % 30 === 0) {
      if (s.treasury < 100 && p.status === 'operating') {
        p.status = 'suspended';
        news(
          s,
          'A public service loses operating funds',
          `${PROJECTS[p.kind].label} in ${
            r.name
          } is suspended until reserves recover.`,
          'pressure',
          { sourceId: p.sourceId, regionId: r.id },
        );
      } else if (s.treasury > 500 && p.status === 'suspended') {
        p.status = 'operating';
      }
    }
  }
  for (const c of s.commitments)
    if (c.status === 'open' && s.day >= c.dueDay) {
      if (
        s.projects.some(
          p =>
            p.regionId === c.regionId &&
            p.kind === c.kind &&
            p.status === 'operating',
        )
      )
        fulfil(s, c, c.sourceId);
      else {
        c.status = 'broken';
        s.movement.reputation = clamp(s.movement.reputation - 180);
        s.regions
          .find(r => r.id === c.regionId)!
          .cohorts.forEach(p => {
            p.support = clamp(p.support - 450);
            p.grievance = clamp(p.grievance + 400);
          });
        s.actors
          .filter(a => a.regionId === c.regionId)
          .forEach(a =>
            remember(s, a, c.sourceId, 'Broken public commitment', -450),
          );
        news(
          s,
          'A promise becomes a liability',
          `${
            s.regions.find(r => r.id === c.regionId)!.name
          } did not receive the promised ${PROJECTS[
            c.kind
          ].label.toLowerCase()}. Organizers are using your commitment against you.`,
          'pressure',
          { sourceId: c.sourceId, regionId: c.regionId },
        );
      }
    }
}
function fulfil(s: WorldState, c: Commitment, sourceId: string) {
  c.status = 'fulfilled';
  s.movement.reputation = clamp(s.movement.reputation + 180);
  s.regions
    .find(r => r.id === c.regionId)!
    .cohorts.forEach(p => (p.support = clamp(p.support + 350)));
  news(
    s,
    'A public promise delivered',
    `${PROJECTS[c.kind].label} is operating in ${
      s.regions.find(r => r.id === c.regionId)!.name
    }.`,
    'brief',
    { sourceId, regionId: c.regionId },
  );
}
function advanceSituations(s: WorldState) {
  for (const i of activeSituations(s)) {
    const r = s.regions.find(x => x.id === i.regionId)!;
    if (i.kind === 'war' && !s.neighbors.some(n => n.war)) {
      i.stage = 'resolved';
      i.resolvedDay = s.day;
      continue;
    }
    const target =
      i.kind === 'corruption'
        ? r.corruption
        : i.kind === 'succession'
        ? 10000 - s.legitimacy
        : i.kind === 'constitutional'
        ? 10000 - s.legitimacy + (s.censorship ? 800 : 0)
        : i.kind === 'war'
        ? 6000
        : mean(r.cohorts.map(p => p.grievance));
    i.pressure = clamp(i.pressure + (target - i.pressure) / 14);
    if (i.pressure < 2800) {
      i.stage = 'resolved';
      i.resolvedDay = s.day;
      news(
        s,
        'Pressure recedes',
        `${r.name}'s conditions have improved enough for organizers to stand down.`,
        'brief',
        { sourceId: i.sourceId, regionId: r.id },
      );
      continue;
    }
    if (s.day >= i.nextDay) {
      i.nextDay = s.day + 21;
      const stages: Situation['stage'][] = [
        'grievance',
        'organized',
        'demands',
        'protest',
        'strike',
      ];
      const index = stages.indexOf(i.stage);
      if (i.pressure > 3500 && index < 4) {
        i.stage = stages[index + 1];
        news(
          s,
          `${r.name}: ${
            i.stage === 'organized'
              ? 'organizers mobilize'
              : i.stage === 'demands'
              ? 'formal demands'
              : i.stage === 'protest'
              ? 'crowds gather'
              : 'work stops'
          }`,
          `${
            s.actors.find(a => a.id === i.actorId)?.name
          } demands ${i.demand.toLowerCase()}. ${i.causes.join(' ')}`,
          i.stage === 'strike' ? 'crisis' : 'pressure',
          { sourceId: i.sourceId, regionId: r.id, actorId: i.actorId },
        );
      }
    }
  }
  s.situations = s.situations.filter(
    i => i.stage !== 'resolved' || s.day - (i.resolvedDay ?? s.day) < 360,
  );
}
export function actorDialogue(
  s: WorldState,
  a: Actor,
  content: ContentPack = s.content ?? BASE_CONTENT,
) {
  const lines = content.dialogue[a.plan] ?? BASE_CONTENT.dialogue[a.plan];
  const memory = a.memories.at(-1);
  const region = s.regions.find(r => r.id === a.regionId)!;
  return `${lines[(s.seed + a.portrait) % lines.length]} ${
    memory
      ? `I remember ${memory.subject.toLowerCase()}.`
      : `${region.name} is watching.`
  }`;
}
function advanceActors(s: WorldState) {
  for (const a of s.actors) {
    if (s.day < a.nextPlanDay) continue;
    a.nextPlanDay = s.day + between(s, 30, 75);
    const f = s.factions.find(x => x.id === a.factionId)!;
    const r = s.regions.find(x => x.id === a.regionId)!;
    const scores = {
      organize: mean(r.cohorts.map(p => p.grievance)) + a.influence / 5,
      investigate: r.corruption + a.competence / 5,
      challenge: a.ambition + (5000 - a.loyalty) / 2,
      obstruct: 10000 - f.support,
      negotiate: 7000 - a.trust / 2,
      support: a.loyalty + f.support / 3,
    };
    for (const plan of Object.keys(scores) as Actor['plan'][])
      scores[plan] = Math.round(scores[plan] * (s.policy?.weights[plan] ?? 1));
    a.plan = (Object.keys(scores) as Actor['plan'][]).reduce(
      (best, key) => (scores[key] > scores[best] ? key : best),
      'support',
    );
    if (a.resources < 1000) {
      a.plan = 'negotiate';
      a.resources = clamp(a.resources + 800);
      continue;
    }
    a.resources -= 200;
    if (a.plan === 'organize')
      r.cohorts.forEach(p => (p.organization = clamp(p.organization + 100)));
    if (a.plan === 'investigate' && r.corruption > 4500) {
      r.corruption = clamp(r.corruption - 300);
      s.legitimacy = clamp(s.legitimacy + (s.role === 'government' ? -80 : 30));
    }
    if (a.plan === 'obstruct') {
      f.cohesion = clamp(f.cohesion - 120);
      if (f.support < 3000 && f.coalition) {
        f.coalition = false;
        news(
          s,
          `${f.name} leaves the coalition`,
          `${a.name} withdraws support after sustained disagreement. Parliamentary votes must be renegotiated.`,
          'crisis',
          { actorId: a.id },
        );
      }
    }
    if (a.plan === 'support') f.support = clamp(f.support + 35);
    if (a.plan === 'challenge' && a.ambition > 8000 && a.loyalty < 3500) {
      s.movement.reputation = clamp(s.movement.reputation - 90);
      news(
        s,
        `${a.name} challenges the leadership`,
        actorDialogue(s, a),
        'pressure',
        { actorId: a.id, regionId: a.regionId },
      );
    }
    if (
      s.day % 3 === 0 &&
      s.news.slice(0, 2).filter(n => n.day === s.day).length < 2
    )
      news(s, `${a.name}: ${a.plan}`, actorDialogue(s, a), 'brief', {
        actorId: a.id,
        regionId: a.regionId,
      });
  }
}
function election(s: WorldState) {
  const share = clamp(
    approval(s) + (s.movement.organization - 5000) / 5 + between(s, -180, 180),
  );
  s.lastElectionShare = share;
  s.electionCount++;
  const previous = s.role;
  if (s.regime === 'republic') {
    s.role = share >= 5000 ? 'government' : 'opposition';
    s.factions.forEach((f, i) => {
      if (i < 5) f.coalition = share >= 5000 ? i < 3 : i === 3 || i === 4;
    });
    news(
      s,
      share >= 5000
        ? 'Your movement wins a mandate'
        : 'Your movement enters opposition',
      `${Math.round(share / 100)}% voted for ${s.movement.name}. ${
        share >= 5000
          ? 'The government must deliver its promises.'
          : 'Your organizers, relationships and promises remain. Build a coalition for a comeback.'
      }`,
      'crisis',
    );
  } else if (s.regime === 'monarchy') {
    const a = [...s.actors].sort(
      (x, y) => y.loyalty + y.competence - (x.loyalty + x.competence),
    )[0];
    if (s.role === 'successor' && s.legitimacy >= 4000) s.role = 'government';
    news(
      s,
      'The succession council meets',
      `${a.name} emerges as an influential guarantor. The movement's legitimacy and relationships shape continuity.`,
      'pressure',
      { actorId: a.id },
    );
  } else if (s.legitimacy < 3000 && s.factions[5].support < 4000) {
    s.role = 'opposition';
    s.regime = 'republic';
    news(
      s,
      'A negotiated transfer of authority',
      'The government loses institutional backing. Your movement survives and can contest the next election.',
      'crisis',
    );
  } else
    news(
      s,
      'The national political settlement',
      'The regime survives its institutional review. The public and the coalition continue to judge delivery.',
      'pressure',
    );
  if (previous !== s.role)
    s.movement.influence = Math.max(s.movement.influence, 30);
  s.electionDay = s.day + 1440;
}
export function stepSimulation(current: WorldState, days = 1): WorldState {
  if (!Number.isInteger(days) || days < 0 || days > 36000)
    throw new Error('Advance between 0 and 36,000 days.');
  if (current.status !== 'active' || days === 0) return current;
  const s = clone(current);
  for (let k = 0; k < days; k++) {
    s.day++;
    s.negotiations
      .filter(n => n.status === 'counteroffer' && n.expiresDay <= s.day)
      .forEach(n => {
        n.status = 'expired';
        const a = s.actors.find(x => x.id === n.actorId)!;
        remember(s, a, n.sourceId, 'An unanswered counteroffer', -120);
        news(
          s,
          `${a.name} withdraws the offer`,
          'The negotiation deadline passed. A new agreement must be opened.',
          'brief',
          { sourceId: n.sourceId, actorId: a.id },
        );
      });
    advancePeople(s);
    advanceProjects(s);
    advanceSituations(s);
    advanceActors(s);
    if (s.day % 7 === 0) {
      s.movement.influence = clamp(s.movement.influence + 3, 0, 100);
      s.factions.forEach(f => {
        const satisfaction =
          f.group === 'security'
            ? s.institutions.find(i => i.id === 'military')!.confidence
            : mean(
                s.regions.flatMap(r =>
                  r.cohorts
                    .filter(c => c.group === f.group)
                    .map(c => mean(Object.values(c.needs))),
                ),
              );
        f.support = clamp(f.support + (satisfaction - f.support) / 20);
      });
      s.legitimacy = clamp(
        s.legitimacy +
          (mean(s.institutions.map(i => i.confidence)) - s.legitimacy) / 70 -
          s.corruption / 1500,
      );
    }
    if (s.day % 30 === 0) {
      s.movement.funds = clamp(
        s.movement.funds +
          Math.round(70 + s.movement.organization / 100 + approval(s) / 100),
        0,
        50000,
      );
      recompute(s);
      const total = s.treasury + s.budget.net;
      if (total < 0) {
        s.debt += -total;
        s.treasury = 0;
        s.legitimacy = clamp(s.legitimacy - 80);
      } else {
        s.treasury = clamp(total, 0, 1000000);
        if (s.budget.net > 100 && s.debt > 0) {
          const pay = Math.min(s.debt, Math.round(s.budget.net / 4));
          s.treasury -= pay;
          s.debt -= pay;
        }
      }
      s.debt = clamp(s.debt, 0, 1000000);
      if (s.debt > 30000 && s.treasury < 250) {
        const arrears = s.debt;
        s.debt = 16000;
        s.legitimacy = clamp(s.legitimacy - 700);
        s.foreignPressureUntil = Math.max(
          s.foreignPressureUntil ?? 0,
          s.day + 360,
        );
        s.institutions.forEach(i => (i.confidence = clamp(i.confidence - 400)));
        news(
          s,
          'The sovereign misses its obligations',
          `Unfunded obligations reached ${arrears} credits. Creditors impose a standstill and write debt down to 16,000. Import finance tightens for a year; institutional confidence falls.`,
          'crisis',
        );
      }
      if (s.regime === 'monarchy' && s.role === 'successor')
        newSituation(
          s,
          'succession',
          s.regions[0].id,
          10000 - s.legitimacy,
          'A recognized succession settlement',
          [
            'Rival claimants are seeking institutional backing before the succession council.',
          ],
        );
      if (s.regime === 'autocracy' && s.legitimacy < 4000)
        newSituation(
          s,
          'constitutional',
          s.regions[0].id,
          10000 - s.legitimacy,
          'A constitutional settlement',
          ['Low legitimacy is eroding acceptance of executive rule.'],
        );
      if (s.treasury < 200 && s.news[0]?.title !== 'Treasury under pressure')
        news(
          s,
          'Treasury under pressure',
          'Current commitments exceed public revenue. Rebalance spending, negotiate taxes, or borrow within the debt limit.',
          'pressure',
        );
      if (s.role !== 'government') {
        const weakest = [...s.regions].sort(
          (a, b) => a.services - b.services,
        )[0];
        if (s.treasury > 600) {
          s.treasury -= 120;
          weakest.services = clamp(weakest.services + 80);
        }
        s.taxRate = s.treasury < 1000 ? Math.min(35, s.taxRate + 1) : s.taxRate;
        if (s.treasury < 500) s.fuelSubsidy = Math.max(10, s.fuelSubsidy - 2);
      }
      s.neighbors.forEach(n => {
        if (n.war) {
          n.grievances = clamp(n.grievances + 180);
          newSituation(s, 'war', s.regions[0].id, 6000, 'An end to the war', [
            `The active conflict with ${n.name} costs 220 treasury credits each month.`,
          ]);
        } else if (!n.allied) {
          n.relation = clamp(n.relation + between(s, -3, 3), -100, 100);
          if (n.relation < -60 && n.aggression > 6800 && !n.trade) {
            n.war = true;
            news(
              s,
              `${n.name} escalates a border dispute`,
              'The neighboring government commits to an abstract border confrontation. Domestic costs and public opposition now begin.',
              'crisis',
            );
          }
        }
      });
    }
    if (s.day >= s.electionDay) election(s);
    if (s.day % 360 === 0) {
      s.leader.age++;
      s.actors.forEach(a => {
        a.age++;
        a.resources = clamp(a.resources + 1000);
      });
      if (s.leader.age >= 78) {
        const a =
          [...s.actors]
            .filter(x => x.age < 76)
            .sort((x, y) => y.loyalty - x.loyalty)[0] ?? s.actors[0];
        if (a.age >= 76) a.age = 38;
        s.leader = {
          name: a.name,
          age: a.age,
          portrait: a.portrait,
          generation: s.leader.generation + 1,
        };
        news(
          s,
          'A generation passes the torch',
          `${a.name} inherits ${s.movement.name}, its relationships and unfinished commitments.`,
          'crisis',
        );
      }
    }
  }
  s.revision += days;
  recompute(s);
  return s;
}
export function applyReceipt(current: WorldState, r: Receipt): WorldState {
  if (current.appliedReceipts.includes(r.id)) return current;
  if (!Number.isSafeInteger(r.amount) || Math.abs(r.amount) > 5000)
    throw new Error('Invalid settlement amount.');
  const s = clone(current);
  if (s.treasury + r.amount < 0)
    throw new Error('Insufficient funds for this reservation.');
  s.treasury += r.amount;
  if (!r.id.endsWith('-reservation') && !r.id.endsWith('-refund')) {
    if (r.kind === 'trade')
      s.foreignTradeUntil = Math.max(s.foreignTradeUntil ?? 0, s.day + 180);
    if (r.kind === 'sanction')
      s.foreignPressureUntil = Math.max(
        s.foreignPressureUntil ?? 0,
        s.day + 90,
      );
    if (r.kind === 'alliance') s.legitimacy = clamp(s.legitimacy + 100);
    if (r.kind === 'vote')
      s.movement.reputation = clamp(s.movement.reputation + 80);
    if (r.kind === 'aid' && r.id.endsWith('-outcome'))
      s.legitimacy = clamp(s.legitimacy + 70);
    if (r.kind === 'dispute') {
      s.foreignPressureUntil = Math.max(
        s.foreignPressureUntil ?? 0,
        s.day + 90,
      );
      s.legitimacy = clamp(s.legitimacy - 80);
    }
  }
  s.appliedReceipts.push(r.id);
  s.revision++;
  news(
    s,
    'International settlement',
    r.detail,
    r.kind === 'dispute' ? 'pressure' : 'brief',
    {
      sourceId: r.id,
      impacts: r.amount
        ? [`Treasury ${r.amount >= 0 ? '+' : ''}${r.amount}`]
        : [],
    },
  );
  return s;
}
export function validateArtifacts(
  content: ContentPack,
  policy: NumericalPolicy,
) {
  if (
    content.schemaVersion !== 3 ||
    policy.schemaVersion !== 3 ||
    content.engineVersion !== ENGINE_VERSION ||
    policy.engineVersion !== ENGINE_VERSION
  )
    throw new Error('Incompatible simulation artifacts.');
  if (
    !/^\d+\.\d+\.\d+$/.test(content.version) ||
    !/^([a-z]+-)?\d+\.\d+\.\d+$/.test(policy.version)
  )
    throw new Error('Invalid artifact version.');
  for (const kind of Object.keys(PROJECTS) as ProjectKind[]) {
    const d = content.projectDuration[kind];
    if (!Number.isInteger(d) || d < 30 || d > 365)
      throw new Error('Invalid project duration.');
  }
  for (const plan of Object.keys(BASE_POLICY.weights) as Actor['plan'][]) {
    const w = policy.weights[plan],
      lines = content.dialogue[plan];
    if (
      !Number.isFinite(w) ||
      w < 0.25 ||
      w > 4 ||
      !Array.isArray(lines) ||
      !lines.length ||
      lines.some(l => typeof l !== 'string' || l.length > 200)
    )
      throw new Error('Invalid political policy or dialogue.');
  }
}
export function adoptArtifacts(
  current: WorldState,
  content: ContentPack,
  policy: NumericalPolicy,
): WorldState {
  validateArtifacts(content, policy);
  const s = clone(current);
  s.content = clone(content);
  s.policy = clone(policy);
  s.contentVersion = content.version;
  s.policyVersion = policy.version;
  s.revision++;
  news(
    s,
    'Political simulation update adopted',
    'A compatible content and policy update was adopted at a paused checkpoint. Existing obligations remain unchanged.',
  );
  return s;
}
export function replayCommands(
  base: WorldState,
  entries: Array<{ day: number; command: Command }>,
  targetDay: number,
): WorldState {
  let s = base;
  for (const e of entries) {
    if (!Number.isSafeInteger(e.day) || e.day < s.day || e.day > targetDay)
      throw new Error('Command history is out of order.');
    s = stepSimulation(s, e.day - s.day);
    s = dispatchCommand(s, e.command);
  }
  return stepSimulation(s, targetDay - s.day);
}
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.keys(value)
    .filter(k => (value as Record<string, unknown>)[k] !== undefined)
    .sort()
    .map(
      k =>
        `${JSON.stringify(k)}:${canonicalJson(
          (value as Record<string, unknown>)[k],
        )}`,
    )
    .join(',')}}`;
}
export function stateChecksum(s: WorldState): string {
  const raw = canonicalJson(s);
  let h = 2166136261;
  for (let i = 0; i < raw.length; i++)
    h = Math.imul(h ^ raw.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16).padStart(8, '0');
}
export function assertWorld(s: WorldState): void {
  if (
    s.schemaVersion !== 3 ||
    s.engineVersion !== ENGINE_VERSION ||
    s.regions.length !== 8 ||
    !Array.isArray(s.negotiations)
  )
    throw new Error('Incompatible country state.');
  for (const n of [
    s.treasury,
    s.debt,
    s.legitimacy,
    s.corruption,
    s.movement.influence,
    s.movement.funds,
    ...s.regions.flatMap(r =>
      r.cohorts.flatMap(c => [
        c.support,
        c.grievance,
        c.size,
        ...Object.values(c.needs),
      ]),
    ),
  ])
    if (!Number.isFinite(n) || n < 0)
      throw new Error('Invalid simulation value.');
  const finite = (value: unknown): void => {
    if (typeof value === 'number' && !Number.isFinite(value))
      throw new Error('Non-finite simulation value.');
    if (value && typeof value === 'object')
      Object.values(value).forEach(finite);
  };
  finite(s);
  if (s.factions.reduce((n, f) => n + f.seats, 0) !== 100)
    throw new Error('Parliamentary seats must total 100.');
  if (
    s.regions.some(r =>
      r.cohorts.some(
        c =>
          c.size <= 0 ||
          c.employment > 10000 ||
          c.support > 10000 ||
          Object.values(c.needs).some(v => v > 10000),
      ),
    )
  )
    throw new Error('Population measure is outside its valid range.');
  validateArtifacts(s.content ?? BASE_CONTENT, s.policy ?? BASE_POLICY);
  if (
    s.situations.some(i => i.kind === 'war' && i.stage !== 'resolved') &&
    !s.neighbors.some(n => n.war)
  )
    throw new Error('War situation without a war.');
}
export function observation(s: WorldState): number[] {
  return [
    s.treasury / 20000,
    s.debt / 20000,
    s.legitimacy / 10000,
    approval(s) / 10000,
    s.corruption / 10000,
    s.movement.influence / 100,
    s.movement.organization / 10000,
    s.movement.reputation / 10000,
    s.taxRate / 50,
    s.fuelSubsidy / 100,
    s.economy.employment / 10000,
    s.economy.inflation / 10000,
    s.economy.production / 10000,
    s.economy.purchasingPower / 10000,
    coalitionSeats(s) / 100,
    activeSituations(s).length / 24,
    s.projects.filter(p => p.status === 'operating').length / 48,
    s.commitments.filter(p => p.status === 'open').length / 24,
    s.neighbors.filter(n => n.war).length / 4,
    s.role === 'government' ? 1 : 0,
    s.regime === 'republic' ? 1 : 0,
    s.regime === 'monarchy' ? 1 : 0,
    s.censorship ? 1 : 0,
    s.emergencyUntil > s.day ? 1 : 0,
  ].map(n => Math.max(-2, Math.min(2, n)));
}
