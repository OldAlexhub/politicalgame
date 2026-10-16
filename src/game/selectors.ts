import {GameState} from './types';

export function formatPercent(value: number) {
  return `${(value / 100).toFixed(0)}%`;
}

export function formatResource(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return `${Math.round(value)}`;
}

export function projectedElectoralVotes(state: GameState) {
  return state.regions.reduce((sum, region) => sum + (region.support >= 5000 ? region.electoralVotes ?? 0 : 0), 0);
}

export function closestRegions(state: GameState, count = 8) {
  return [...state.regions].sort((a, b) => Math.abs(a.support - 5000) - Math.abs(b.support - 5000) || (b.electoralVotes ?? 0) - (a.electoralVotes ?? 0)).slice(0, count);
}

export function campaignHealth(state: GameState) {
  const faction = state.factions.reduce((sum, item) => sum + item.support, 0) / Math.max(1, state.factions.length);
  const institution = state.institutions.reduce((sum, item) => sum + item.confidence, 0) / Math.max(1, state.institutions.length);
  return Math.round((state.legitimacy + state.publicSentiment + state.momentum + faction + institution) / 5);
}
