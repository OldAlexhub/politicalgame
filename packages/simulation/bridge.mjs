import { evaluatePolicy, auditWorlds } from './harness.ts';
import readline from 'node:readline';
import { performance } from 'node:perf_hooks';
import {
  BASE_POLICY,
  createWorld,
  stepSimulation,
  dispatchCommand,
  observation,
  assertWorld,
  approval,
  stateChecksum,
} from './index.ts';
const lines = readline.createInterface({ input: process.stdin });
let state;
for await (const line of lines) {
  try {
    const req = JSON.parse(line);
    let result;
    if (req.op === 'reset') {
      state = createWorld(
        req.config ?? { seed: 1 },
        undefined,
        req.policy ?? BASE_POLICY,
      );
      result = { state, observation: observation(state) };
    } else if (req.op === 'step') {
      if (!state) throw new Error('Reset first.');
      if (req.command) state = dispatchCommand(state, req.command);
      state = stepSimulation(state, req.days ?? 7);
      assertWorld(state);
      result = { state, observation: observation(state) };
    } else if (req.op === 'evaluate') {
      result = evaluatePolicy(
        req.policy,
        req.seeds,
        req.days,
        req.playerActions,
      );
    } else if (req.op === 'audit') {
      result = auditWorlds(req.seeds, req.days);
    } else throw new Error('Unknown bridge operation.');
    process.stdout.write(JSON.stringify({ ok: true, result }) + '\n');
  } catch (e) {
    process.stdout.write(
      JSON.stringify({ ok: false, error: e.message }) + '\n',
    );
  }
}
