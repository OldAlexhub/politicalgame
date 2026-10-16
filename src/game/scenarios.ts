import {ActionDefinition, CandidateProfile, GameMode, GameState, Region} from './types';
import {createUSRegions} from './data/usStates';

export const CANDIDATES: CandidateProfile[] = [
  {id: 'mara-vale', name: 'Mara Vale', title: 'Coalition Mayor', archetype: 'coalition-builder', position: 'Civic Alliance'},
  {id: 'jon-bellis', name: 'Jon Bellis', title: 'Policy Reformer', archetype: 'reformer', position: 'Forward Coalition'},
  {id: 'imani-cross', name: 'Imani Cross', title: 'Independent Governor', archetype: 'operator', position: 'Independent'},
];

type ScenarioSeed = Pick<GameState, 'scenarioName' | 'maxTurns' | 'treasury' | 'influence' | 'legitimacy' |
  'publicSentiment' | 'momentum' | 'corruption' | 'economy' | 'regions' | 'actors' | 'factions' | 'institutions'>;

const fictionalRegions = (names: Array<[string, string]>): Region[] => names.map(([name, issue], index) => ({
  id: name.toLowerCase().replace(/\s/g, '-'), name, abbreviation: name.slice(0, 2).toUpperCase(),
  support: 4400 + index * 190, opponentSupport: 4800 - index * 90, undecided: 800 - index * 100,
  investment: 0, turnout: 6200 + index * 170, volatility: 500 + index * 45, issue,
}));

export function createScenario(mode: GameMode): ScenarioSeed {
  if (mode === 'presidential') {
    return {
      scenarioName: 'The Open 2028 Election', maxTurns: 14, treasury: 6800, influence: 3200,
      legitimacy: 5600, publicSentiment: 5050, momentum: 5000, corruption: 600,
      economy: {growth: 5100, employment: 5200, inflation: 4400, inequality: 5700, resilience: 5200},
      regions: createUSRegions(),
      actors: [
        {id: 'rival', name: 'Senator Adrian Rook', role: 'Rival candidate', factionId: 'opposition', loyalty: 500, trust: 1000, ambition: 9300, riskTolerance: 6500, memory: []},
        {id: 'manager', name: 'Lena Ortiz', role: 'Campaign manager', factionId: 'campaign', loyalty: 8200, trust: 7600, ambition: 4400, riskTolerance: 5300, memory: []},
        {id: 'pollster', name: 'Dr. Ellis Ward', role: 'Research director', factionId: 'campaign', loyalty: 7400, trust: 7100, ambition: 3200, riskTolerance: 2900, memory: []},
      ],
      factions: [
        {id: 'campaign', name: 'Campaign organization', influence: 5700, support: 6900, cohesion: 7200, priorities: ['victory', 'message discipline']},
        {id: 'labor', name: 'Workers Coalition', influence: 6200, support: 4700, cohesion: 6500, priorities: ['employment', 'wages']},
        {id: 'business', name: 'Enterprise Forum', influence: 6800, support: 4300, cohesion: 6100, priorities: ['growth', 'stability']},
        {id: 'opposition', name: 'Rook campaign', influence: 7000, support: 5000, cohesion: 7000, priorities: ['victory', 'contrast']},
      ],
      institutions: [
        {id: 'press', name: 'National Press Pool', authority: 6600, confidence: 5900, alignment: 5000},
        {id: 'commission', name: 'Election Commission', authority: 9000, confidence: 7600, alignment: 5000},
      ],
    };
  }
  if (mode === 'dictatorship') {
    return {
      scenarioName: 'The Republic of Orinth', maxTurns: 18, treasury: 5600, influence: 6500,
      legitimacy: 5100, publicSentiment: 4700, momentum: 5000, corruption: 4300,
      economy: {growth: 4400, employment: 4900, inflation: 5900, inequality: 6400, resilience: 4200},
      regions: fictionalRegions([['Capital District', 'administration'], ['Iron Coast', 'industry'], ['Verdant Plain', 'food prices'], ['North March', 'public services'], ['Sunward Ports', 'trade']]),
      actors: [
        {id: 'premier', name: 'Sera Venn', role: 'First Minister', factionId: 'technocrats', loyalty: 6300, trust: 5800, ambition: 6800, riskTolerance: 4300, age: 51, memory: []},
        {id: 'marshal', name: 'Marshal Kade', role: 'Defense Council chair', factionId: 'security', loyalty: 5600, trust: 4700, ambition: 7200, riskTolerance: 6100, age: 58, memory: []},
        {id: 'organizer', name: 'Tala Noor', role: 'Civic organizer', factionId: 'civic', loyalty: 2600, trust: 3500, ambition: 5900, riskTolerance: 4700, age: 37, memory: []},
      ],
      factions: [
        {id: 'technocrats', name: 'Economic Council', influence: 5800, support: 5400, cohesion: 6000, priorities: ['growth', 'reform']},
        {id: 'security', name: 'Security Directorate', influence: 7200, support: 5600, cohesion: 7100, priorities: ['stability', 'budgets']},
        {id: 'provincial', name: 'Provincial Governors', influence: 6100, support: 4800, cohesion: 5200, priorities: ['patronage', 'autonomy']},
        {id: 'civic', name: 'Civic Forum', influence: 4300, support: 3900, cohesion: 6500, priorities: ['reform', 'services']},
      ],
      institutions: [
        {id: 'cabinet', name: 'Council of Ministers', authority: 7200, confidence: 5400, alignment: 6100},
        {id: 'assembly', name: 'National Assembly', authority: 4200, confidence: 3900, alignment: 4700},
        {id: 'courts', name: 'High Tribunal', authority: 5100, confidence: 4800, alignment: 5200},
      ],
    };
  }
  if (mode === 'monarchy') {
    return {
      scenarioName: 'The Crown of Valedorn', maxTurns: 18, treasury: 6100, influence: 5700,
      legitimacy: 6800, publicSentiment: 5200, momentum: 5000, corruption: 2800,
      economy: {growth: 4800, employment: 5000, inflation: 4700, inequality: 6100, resilience: 5500},
      regions: fictionalRegions([['Crownlands', 'royal administration'], ['Westmere', 'harvests'], ['High Reach', 'succession'], ['River Counties', 'commerce'], ['South Coast', 'foreign trade']]),
      actors: [
        {id: 'heir', name: 'Princess Elian', role: 'Designated heir', factionId: 'crown', loyalty: 7800, trust: 7300, ambition: 5500, riskTolerance: 3900, age: 24, memory: []},
        {id: 'duke', name: 'Duke Torren', role: 'Senior noble', factionId: 'nobles', loyalty: 4700, trust: 4100, ambition: 7900, riskTolerance: 5200, age: 49, memory: []},
        {id: 'chancellor', name: 'Ari Sorel', role: 'Royal chancellor', factionId: 'reformers', loyalty: 6900, trust: 6500, ambition: 4800, riskTolerance: 3500, age: 43, memory: []},
      ],
      factions: [
        {id: 'crown', name: 'Royal Household', influence: 7000, support: 6800, cohesion: 7200, priorities: ['dynasty', 'continuity']},
        {id: 'nobles', name: 'Great Houses', influence: 7300, support: 5100, cohesion: 5600, priorities: ['privilege', 'succession']},
        {id: 'reformers', name: 'Charter League', influence: 4800, support: 4600, cohesion: 6700, priorities: ['constitution', 'commerce']},
        {id: 'faith', name: 'Temple Concord', influence: 5200, support: 5700, cohesion: 6900, priorities: ['tradition', 'welfare']},
      ],
      institutions: [
        {id: 'council', name: 'Royal Council', authority: 6900, confidence: 6200, alignment: 6500},
        {id: 'estates', name: 'Assembly of Estates', authority: 5000, confidence: 5500, alignment: 4800},
      ],
    };
  }
  return {
    scenarioName: 'The Meridian Transition', maxTurns: 12, treasury: 3900, influence: 5400,
    legitimacy: 3900, publicSentiment: 4600, momentum: 5200, corruption: 3500,
    economy: {growth: 4100, employment: 4700, inflation: 6100, inequality: 6000, resilience: 4000},
    regions: fictionalRegions([['Meridian City', 'constitutional order'], ['Lake Provinces', 'local autonomy'], ['Eastern Corridor', 'trade continuity'], ['Western Plateau', 'public services']]),
    actors: [
      {id: 'judge', name: 'Justice Amari', role: 'Constitutional mediator', factionId: 'legalists', loyalty: 4300, trust: 5600, ambition: 3500, riskTolerance: 2600, age: 55, memory: []},
      {id: 'governor', name: 'Governor Sen', role: 'Regional broker', factionId: 'provincials', loyalty: 4900, trust: 4700, ambition: 6900, riskTolerance: 5400, age: 46, memory: []},
      {id: 'rival', name: 'Cassian Vey', role: 'Rival claimant', factionId: 'old-guard', loyalty: 800, trust: 1200, ambition: 9100, riskTolerance: 7200, age: 50, memory: []},
    ],
    factions: [
      {id: 'legalists', name: 'Constitutional Council', influence: 6000, support: 4800, cohesion: 6700, priorities: ['legality', 'elections']},
      {id: 'provincials', name: 'Provincial Compact', influence: 5500, support: 4500, cohesion: 4900, priorities: ['autonomy', 'services']},
      {id: 'civil-service', name: 'Civil Service', influence: 6500, support: 5200, cohesion: 7200, priorities: ['continuity', 'capacity']},
      {id: 'old-guard', name: 'Old Government Bloc', influence: 6700, support: 4000, cohesion: 6100, priorities: ['restoration', 'control']},
    ],
    institutions: [
      {id: 'court', name: 'Constitutional Court', authority: 6500, confidence: 5100, alignment: 4600},
      {id: 'service', name: 'Public Administration', authority: 7200, confidence: 5700, alignment: 5200},
      {id: 'forum', name: 'National Dialogue Forum', authority: 4300, confidence: 4800, alignment: 5000},
    ],
  };
}

const commonActions: ActionDefinition[] = [
  {id: 'public-address', label: 'National address', description: 'Spend political capital on a focused public case.', category: 'policy', cost: {influence: 500}, target: 'none', effects: [{path: 'publicSentiment', amount: 360}, {path: 'momentum', amount: 220}]},
  {id: 'broker-coalition', label: 'Broker coalition', description: 'Negotiate shared priorities with a political bloc.', category: 'coalition', cost: {influence: 650}, target: 'faction', effects: [{path: 'faction.support', amount: 650}, {path: 'faction.cohesion', amount: 180}, {path: 'legitimacy', amount: 120}]},
  {id: 'invest-region', label: 'Regional initiative', description: 'Direct resources to a strategic region and its central concern.', category: 'economy', cost: {treasury: 750}, target: 'region', effects: [{path: 'region.support', amount: 520}, {path: 'economy.employment', amount: 120}], delayedEffects: {delay: 2, source: 'Regional initiative', changes: [{path: 'economy.growth', amount: 180}, {path: 'publicSentiment', amount: 140}], narrative: 'The regional initiative begins producing visible economic results.'}},
  {id: 'strengthen-institution', label: 'Strengthen institution', description: 'Fund transparent capacity and build durable confidence.', category: 'institution', cost: {treasury: 500, influence: 250}, target: 'institution', effects: [{path: 'institution.confidence', amount: 700}, {path: 'legitimacy', amount: 250}]},
];

export function getActions(mode: GameMode): ActionDefinition[] {
  if (mode === 'presidential') return [
    {id: 'rally', label: 'Organize rally', description: 'Mobilize supporters in a selected state.', category: 'campaign', cost: {treasury: 450}, target: 'region', effects: [{path: 'region.support', amount: 420}, {path: 'momentum', amount: 180}]},
    {id: 'advertise', label: 'Targeted advertising', description: 'Build persuasion and campaign investment in a state.', category: 'campaign', cost: {treasury: 700}, target: 'region', effects: [{path: 'region.support', amount: 560}, {path: 'publicSentiment', amount: 80}]},
    {id: 'fundraise', label: 'Fundraising circuit', description: 'Trade a little momentum for campaign cash.', category: 'campaign', cost: {influence: 250}, target: 'none', effects: [{path: 'treasury', amount: 1450}, {path: 'momentum', amount: -120}]},
    {id: 'debate-prep', label: 'Prepare for debate', description: 'Invest in research and message discipline before the national debate.', category: 'campaign', cost: {treasury: 400, influence: 250}, target: 'none', effects: [{path: 'momentum', amount: 450}, {path: 'publicSentiment', amount: 230}], minimumTurn: 3},
    {id: 'seek-endorsement', label: 'Seek endorsement', description: 'Win over an influential coalition.', category: 'coalition', cost: {influence: 600}, target: 'faction', effects: [{path: 'faction.support', amount: 760}, {path: 'momentum', amount: 170}]},
  ];
  if (mode === 'dictatorship') return [
    ...commonActions,
    {id: 'anti-corruption', label: 'Integrity commission', description: 'Authorize auditable procurement and independent review.', category: 'institution', cost: {treasury: 500, influence: 600}, target: 'institution', effects: [{path: 'legitimacy', amount: 500}, {path: 'publicSentiment', amount: 260}, {path: 'faction.support', targetId: 'provincial', amount: -280}]},
    {id: 'economic-reform', label: 'Economic reform', description: 'Reduce patronage and finance productive investment.', category: 'economy', cost: {treasury: 800, influence: 500}, target: 'none', effects: [{path: 'economy.growth', amount: 180}, {path: 'economy.inflation', amount: -160}], delayedEffects: {delay: 3, source: 'Economic reform', changes: [{path: 'economy.employment', amount: 420}, {path: 'publicSentiment', amount: 240}], narrative: 'Reform investments begin to improve employment.'}},
    {id: 'managed-transition', label: 'Open a transition', description: 'Begin a voluntary constitutional transition if legitimacy is strong.', category: 'transition', cost: {influence: 1200}, target: 'institution', effects: [{path: 'institution.confidence', amount: 800}, {path: 'legitimacy', amount: 450}], minimumTurn: 10, once: true},
  ];
  if (mode === 'monarchy') return [
    ...commonActions,
    {id: 'prepare-heir', label: 'Prepare the heir', description: 'Give the heir responsibility and strengthen dynastic continuity.', category: 'succession', cost: {treasury: 350, influence: 450}, target: 'actor', effects: [{path: 'legitimacy', amount: 380}, {path: 'faction.support', targetId: 'crown', amount: 360}]},
    {id: 'royal-marriage', label: 'Diplomatic marriage', description: 'Form an abstract dynastic alliance through mutual consent.', category: 'succession', cost: {treasury: 600, influence: 300}, target: 'none', effects: [{path: 'legitimacy', amount: 420}, {path: 'economy.resilience', amount: 250}], once: true},
    {id: 'charter-reform', label: 'Negotiate royal charter', description: 'Share authority to stabilize the crown for another generation.', category: 'transition', cost: {influence: 900}, target: 'institution', effects: [{path: 'institution.confidence', amount: 720}, {path: 'publicSentiment', amount: 420}, {path: 'faction.support', targetId: 'nobles', amount: -260}], minimumTurn: 7, once: true},
  ];
  return [
    ...commonActions,
    {id: 'national-dialogue', label: 'National dialogue', description: 'Invite rival blocs into a rules-bound public negotiation.', category: 'coalition', cost: {influence: 650}, target: 'faction', effects: [{path: 'faction.support', amount: 500}, {path: 'legitimacy', amount: 420}, {path: 'momentum', amount: -100}]},
    {id: 'interim-charter', label: 'Draft interim charter', description: 'Set a credible sequence for lawful transitional government.', category: 'transition', cost: {treasury: 350, influence: 700}, target: 'institution', effects: [{path: 'institution.confidence', amount: 800}, {path: 'legitimacy', amount: 550}], minimumTurn: 3, once: true},
    {id: 'service-continuity', label: 'Guarantee public services', description: 'Reassure administrators and keep essential institutions working.', category: 'institution', cost: {treasury: 600}, target: 'institution', effects: [{path: 'institution.confidence', amount: 650}, {path: 'publicSentiment', amount: 260}, {path: 'economy.resilience', amount: 220}]},
  ];
}

export const MODE_COPY: Record<GameMode, {title: string; subtitle: string; objective: string; icon: string}> = {
  presidential: {title: 'Presidential Campaign', subtitle: 'Fifty states. One path to 270.', objective: 'Build a state-by-state coalition and win the fictional 2028 election.', icon: '★'},
  dictatorship: {title: 'The Republic', subtitle: 'Power is a coalition, not a number.', objective: 'Balance elites, institutions, the economy, and a credible political future.', icon: '◆'},
  monarchy: {title: 'The Crown', subtitle: 'Rule today. Secure tomorrow.', objective: 'Steward the realm while building a stable and legitimate succession.', icon: '♛'},
  coup: {title: 'The Transition', subtitle: 'Authority without legitimacy is fragile.', objective: 'Assemble a lawful political transition and govern the coalition that follows.', icon: '⬡'},
};
