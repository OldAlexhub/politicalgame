import {
  createWorld,
  stepSimulation,
  dispatchCommand,
  getDecisionPreview,
  getTargets,
  assertWorld,
  DECISIONS,
  PROJECTS,
  stateChecksum,
  approval,
  BASE_POLICY,
} from './index.ts';
import type {
  Command,
  CommandId,
  NumericalPolicy,
  WorldState,
} from './types.ts';

/** Scripted player baselines run against the exact engine, never a second economic model. */
export function baselineCommand(
  s: WorldState,
  round: number,
  profile: string[] = [],
): Command | undefined {
  const weakest = [...s.regions].sort((a, b) => a.services - b.services)[0];
  const priorities: Command[] = [
    { id: 'peace', targetId: s.neighbors.find(n => n.war)?.id },
    { id: 'project', targetId: weakest.id, option: 'clinic' },
    { id: 'investigate', targetId: 'courts' },
    { id: 'organize', targetId: weakest.id },
    { id: 'campaign', targetId: `r${round % 8}` },
    { id: 'negotiate', targetId: `a${round % 24}`, option: 'policy' },
  ];
  if (s.treasury < 1500)
    priorities.unshift(
      { id: 'tax', value: Math.min(38, s.taxRate + 2) },
      { id: 'borrow' },
    );
  const desired = profile.length
    ? profile[(s.seed + round) % profile.length]
    : undefined;
  if (desired && DECISIONS.some(d => d.id === desired && d.id !== 'retire'))
    priorities.unshift({
      id: desired as CommandId,
      targetId: getTargets(s, desired as CommandId)[
        round % Math.max(1, getTargets(s, desired as CommandId).length)
      ]?.id,
      option:
        desired === 'negotiate'
          ? 'policy'
          : desired === 'reform'
          ? 'republic'
          : 'clinic',
      value: desired === 'tax' ? 28 : 40,
    });
  return priorities.find(c => getDecisionPreview(s, c).allowed);
}
export function evaluatePolicy(
  policy: NumericalPolicy = BASE_POLICY,
  seeds = [1, 2, 3, 4, 5],
  days = 1440,
  profile: string[] = [],
) {
  const started = Date.now();
  let wins = 0,
    lowest = 10000,
    actions = 0;
  const plans = new Set<string>();
  for (const seed of seeds) {
    let s = createWorld({ seed }, undefined, policy);
    for (let day = 0; day < days; day += 30) {
      const c = baselineCommand(s, day / 30, profile);
      if (c) {
        s = dispatchCommand(s, c);
        actions++;
      }
      s = stepSimulation(s, Math.min(30, days - day));
      assertWorld(s);
      s.actors.forEach(a => plans.add(a.plan));
      lowest = Math.min(lowest, approval(s));
    }
    wins += s.role === 'government' ? 1 : 0;
  }
  return {
    invalidActionRate: 0,
    playerGovernmentRate: wins / seeds.length,
    decisionDiversity: plans.size / 6,
    minimumApproval: lowest / 10000,
    msPerCountry: (Date.now() - started) / seeds.length,
    seeds: seeds.length,
    actions,
  };
}
export function auditWorlds(seeds = 100, days = 10800) {
  const started = Date.now(),
    hashes = new Set<string>();
  let minTreasury = Infinity,
    maxDebt = 0,
    actions = 0,
    officeChanges = 0,
    delivered = 0,
    broken = 0,
    crises = 0,
    maxSaveBytes = 0;
  const actionIds = DECISIONS.filter(d => d.id !== 'retire').map(d => d.id);
  for (let seed = 0; seed < seeds; seed++) {
    let s = createWorld({
      seed,
      start:
        seed % 3 === 0
          ? 'opposition'
          : seed % 3 === 1
          ? 'government'
          : 'successor',
      difficulty: seed % 2 ? 'standard' : 'strategist',
    });
    for (let day = 0; day < days; day += 90) {
      const id = actionIds[(seed + day / 90) % actionIds.length];
      const targets = getTargets(s, id);
      const command: Command = {
        id,
        targetId: targets[(seed + day / 90) % Math.max(1, targets.length)]?.id,
        option:
          id === 'reform'
            ? ['republic', 'monarchy', 'autocracy'][seed % 3]
            : id === 'negotiate'
            ? ['policy', 'funding', 'portfolio'][seed % 3]
            : Object.keys(PROJECTS)[seed % 6],
        value: id === 'tax' ? 20 + (seed % 20) : seed % 80,
      };
      if (getDecisionPreview(s, command).allowed) {
        s = dispatchCommand(s, command);
        actions++;
      } else {
        const c = baselineCommand(s, day / 90);
        if (c) {
          s = dispatchCommand(s, c);
          actions++;
        }
      }
      const before = s.role;
      s = stepSimulation(s, Math.min(90, days - day));
      assertWorld(s);
      if (s.role !== before) officeChanges++;
      if (
        !getDecisionPreview(stepSimulation(s, 30), {
          id: 'organize',
          targetId: 'r0',
        }).allowed
      )
        throw new Error(`Unintended action dead end, seed ${seed}, day ${day}`);
      minTreasury = Math.min(minTreasury, s.treasury);
      maxDebt = Math.max(maxDebt, s.debt);
    }
    hashes.add(stateChecksum(s));
    delivered += s.commitments.filter(c => c.status === 'fulfilled').length;
    broken += s.commitments.filter(c => c.status === 'broken').length;
    crises += s.news.filter(n => n.severity === 'crisis').length;
    maxSaveBytes = Math.max(maxSaveBytes, JSON.stringify(s).length);
  }
  return {
    engineVersion: '2.0.0',
    seeds,
    years: days / 360,
    distinctOutcomes: hashes.size,
    actions,
    officeChanges,
    delivered,
    broken,
    crises,
    minTreasury,
    maxDebt,
    maxSaveBytes,
    elapsedMs: Date.now() - started,
  };
}
