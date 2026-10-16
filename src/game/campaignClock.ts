import {GameMode} from './types';

export interface CampaignClock {
  periodLabel: string;
  deadlineLabel: string;
  remainingLabel: string;
  remainingPeriods: number;
  progress: number;
}

const DEADLINES: Record<GameMode, string> = {
  presidential: 'Election Day',
  dictatorship: 'Political settlement',
  monarchy: 'Succession council',
  coup: 'Interim authority deadline',
};

export function formatCampaignMoment(mode: GameMode, turn: number): string {
  const safeTurn = Math.max(1, Math.round(turn));
  if (mode === 'presidential') return `Week ${safeTurn}`;
  if (mode === 'dictatorship') return `Month ${safeTurn}`;
  if (mode === 'monarchy') {
    const seasons = ['Spring', 'Summer', 'Autumn', 'Winter'];
    return `${seasons[(safeTurn - 1) % seasons.length]}, Year ${Math.floor((safeTurn - 1) / seasons.length) + 1}`;
  }
  const firstDay = (safeTurn - 1) * 3 + 1;
  return `Days ${firstDay}–${firstDay + 2}`;
}

export function getCampaignClock(mode: GameMode, turn: number, maxTurns: number): CampaignClock {
  const safeMax = Math.max(1, Math.round(maxTurns));
  const completed = Math.max(0, Math.min(safeMax, Math.round(turn) - 1));
  const displayTurn = Math.max(1, Math.min(safeMax, Math.round(turn)));
  const remainingPeriods = Math.max(0, safeMax - completed);
  const unit = mode === 'presidential' ? 'week' : mode === 'dictatorship' ? 'month' : mode === 'monarchy' ? 'season' : 'day';
  const remainingAmount = mode === 'coup' ? remainingPeriods * 3 : remainingPeriods;
  return {
    periodLabel: formatCampaignMoment(mode, displayTurn),
    deadlineLabel: DEADLINES[mode],
    remainingLabel: remainingPeriods === 0 ? `${DEADLINES[mode]} reached` : `${remainingAmount} ${unit}${remainingAmount === 1 ? '' : 's'} ${remainingAmount === 1 ? 'remains' : 'remain'}`,
    remainingPeriods,
    progress: Math.round(completed / safeMax * 10000),
  };
}
