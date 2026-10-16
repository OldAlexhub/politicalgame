import {Region} from '../types';

// 2020 census apportionment, used for the fictional 2028 campaign: 538 total electors.
const STATE_DATA: Array<[string, string, number, number, string]> = [
  ['AL', 'Alabama', 9, 4450, 'industrial transition'], ['AK', 'Alaska', 3, 4850, 'energy and access'],
  ['AZ', 'Arizona', 11, 5000, 'water security'], ['AR', 'Arkansas', 6, 4400, 'rural investment'],
  ['CA', 'California', 54, 5550, 'housing affordability'], ['CO', 'Colorado', 10, 5250, 'land and growth'],
  ['CT', 'Connecticut', 7, 5350, 'cost of living'], ['DE', 'Delaware', 3, 5200, 'coastal resilience'],
  ['DC', 'District of Columbia', 3, 6500, 'public administration'], ['FL', 'Florida', 30, 4950, 'insurance markets'],
  ['GA', 'Georgia', 16, 5000, 'regional growth'], ['HI', 'Hawaii', 4, 5650, 'island costs'],
  ['ID', 'Idaho', 4, 4250, 'growth management'], ['IL', 'Illinois', 19, 5350, 'public finance'],
  ['IN', 'Indiana', 11, 4550, 'advanced manufacturing'], ['IA', 'Iowa', 6, 4800, 'agricultural markets'],
  ['KS', 'Kansas', 6, 4550, 'water and farming'], ['KY', 'Kentucky', 8, 4450, 'regional health'],
  ['LA', 'Louisiana', 8, 4500, 'coastal economy'], ['ME', 'Maine', 4, 5150, 'rural services'],
  ['MD', 'Maryland', 10, 5650, 'transportation'], ['MA', 'Massachusetts', 11, 5850, 'education costs'],
  ['MI', 'Michigan', 15, 5050, 'industrial renewal'], ['MN', 'Minnesota', 10, 5300, 'farm and metro balance'],
  ['MS', 'Mississippi', 6, 4500, 'infrastructure'], ['MO', 'Missouri', 10, 4600, 'small business'],
  ['MT', 'Montana', 4, 4650, 'public lands'], ['NE', 'Nebraska', 5, 4650, 'agricultural trade'],
  ['NV', 'Nevada', 6, 5050, 'water and tourism'], ['NH', 'New Hampshire', 4, 5100, 'local economy'],
  ['NJ', 'New Jersey', 14, 5550, 'property costs'], ['NM', 'New Mexico', 5, 5450, 'water and opportunity'],
  ['NY', 'New York', 28, 5700, 'housing and transit'], ['NC', 'North Carolina', 16, 4950, 'education and growth'],
  ['ND', 'North Dakota', 3, 4300, 'energy markets'], ['OH', 'Ohio', 17, 4800, 'manufacturing'],
  ['OK', 'Oklahoma', 7, 4250, 'energy diversification'], ['OR', 'Oregon', 8, 5550, 'housing supply'],
  ['PA', 'Pennsylvania', 19, 5000, 'jobs and communities'], ['RI', 'Rhode Island', 4, 5500, 'small business costs'],
  ['SC', 'South Carolina', 9, 4650, 'coastal growth'], ['SD', 'South Dakota', 3, 4400, 'rural services'],
  ['TN', 'Tennessee', 11, 4450, 'rapid growth'], ['TX', 'Texas', 40, 4750, 'energy and infrastructure'],
  ['UT', 'Utah', 6, 4500, 'housing growth'], ['VT', 'Vermont', 3, 6000, 'rural affordability'],
  ['VA', 'Virginia', 13, 5350, 'regional opportunity'], ['WA', 'Washington', 12, 5650, 'technology and housing'],
  ['WV', 'West Virginia', 4, 4100, 'economic transition'], ['WI', 'Wisconsin', 10, 5000, 'farm and factory economy'],
  ['WY', 'Wyoming', 3, 4150, 'energy transition'],
];

export const TOTAL_ELECTORAL_VOTES = STATE_DATA.reduce((sum, state) => sum + state[2], 0);

export function createUSRegions(): Region[] {
  return STATE_DATA.map(([abbreviation, name, electoralVotes, support, issue], index) => ({
    id: abbreviation.toLowerCase(),
    name,
    abbreviation,
    electoralVotes,
    support,
    opponentSupport: 10000 - support - 600,
    undecided: 600,
    investment: 0,
    turnout: 6500 + ((index * 137) % 1200),
    volatility: 250 + ((index * 83) % 500),
    issue,
  }));
}
