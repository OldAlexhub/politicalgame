import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  applyReceipt,
  canonicalJson,
  createWorld,
  dispatchCommand,
  stepSimulation,
  replayCommands,
} from '../packages/simulation';
import { listCareers, saveCareer } from '../src/living/storage';
jest.mock('react-native-keychain', () => ({
  getGenericPassword: jest
    .fn()
    .mockResolvedValue({
      password: JSON.stringify({
        playerId: 'player',
        deviceId: 'device',
        token: 'token-value',
      }),
    }),
  setGenericPassword: jest.fn(),
  resetGenericPassword: jest.fn(),
  ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device' },
}));
import { cloud } from '../src/living/cloud';
const { createHash } = require('node:crypto');
const reply = (body: any, status = 200) => {
  const s = body.career ? body : body.result?.career ? body.result : null;
  if (s)
    s.checksum = createHash('sha256')
      .update(canonicalJson(s.career))
      .digest('hex');
  return Promise.resolve({ ok: status < 400, status, json: async () => body });
};
beforeEach(async () => {
  await AsyncStorage.clear();
});
test('a lost submission response resumes the same idempotent sync request', async () => {
  const initial = createWorld({ seed: 33 });
  const local = stepSimulation(
    dispatchCommand(initial, { id: 'organize', targetId: 'r0' }),
    12,
  );
  const fetchMock = jest
    .fn()
    .mockImplementationOnce(() =>
      reply({ career: initial, revision: 0, receipts: [] }),
    )
    .mockRejectedValueOnce(new Error('network disconnected'))
    .mockImplementationOnce(() => reply({ jobId: 'same-job' }))
    .mockImplementationOnce(() =>
      reply({
        status: 'completed',
        result: { career: local, revision: 1, receipts: [] },
      }),
    );
  globalThis.fetch = fetchMock;
  await expect(cloud.sync(local)).rejects.toThrow('network disconnected');
  const requestId = JSON.parse(fetchMock.mock.calls[1][1].body).requestId;
  const result = await cloud.sync(local);
  expect(JSON.parse(fetchMock.mock.calls[2][1].body).requestId).toBe(requestId);
  expect(canonicalJson(result.career)).toBe(canonicalJson(local));
  expect(
    await AsyncStorage.getItem(`@pss/cloud-pending/${local.id}`),
  ).toBeNull();
});
test('restoring the cloud branch preserves a different local career', async () => {
  const remote = createWorld({ seed: 4 });
  const local = stepSimulation(
    dispatchCommand(remote, { id: 'campaign', targetId: 'r0' }),
    20,
  );
  await saveCareer(local);
  globalThis.fetch = jest
    .fn()
    .mockImplementation(() =>
      reply({ career: remote, revision: 2, receipts: [] }),
    );
  const restored = await cloud.restore(remote.id, local);
  const saves = await listCareers();
  expect(restored.day).toBe(0);
  expect(saves).toHaveLength(2);
  const branch = saves.find(s => s.localBranchOf === remote.id)!;
  expect(branch.day).toBe(20);
  expect(branch.journal).toEqual(local.journal);
  await expect(cloud.sync(branch)).rejects.toThrow('playable locally');
});
test('a conflict response leaves the saved local history intact', async () => {
  const s = createWorld({ seed: 3 });
  await saveCareer(s);
  globalThis.fetch = jest
    .fn()
    .mockImplementation(() => reply({ career: s, revision: 4, receipts: [] }));
  await expect(cloud.sync(s)).rejects.toThrow('both histories');
  expect((await listCareers())[0]).toEqual(s);
});

test('retrying an offer preserves domestic play after a lost response', async () => {
  const initial = createWorld({ seed: 33 });
  await AsyncStorage.setItem(
    `@pss/cloud-cursor/${initial.id}`,
    JSON.stringify({ revision: 1, day: 0, journalLength: 0 }),
  );
  const reserved = applyReceipt(initial, {
    id: 'reservation',
    kind: 'trade',
    amount: -100,
    issuer: 'shared-world',
    detail: 'Reserved trade funds.',
  });
  const fetchMock = jest
    .fn()
    .mockRejectedValueOnce(new Error('network disconnected'))
    .mockImplementationOnce(() =>
      reply({ career: reserved, revision: 2, receipts: [] }),
    );
  globalThis.fetch = fetchMock;
  await expect(cloud.offer(initial, 'foreign', 'trade', 100)).rejects.toThrow(
    'network disconnected',
  );
  const local = stepSimulation(
    dispatchCommand(initial, { id: 'organize', targetId: 'r0' }),
    12,
  );
  const prepared = await cloud.prepareOffer(local);
  const result = await cloud.offer(prepared, 'foreign', 'trade', 100);
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).idempotencyKey).toBe(
    JSON.parse(fetchMock.mock.calls[1][1].body).idempotencyKey,
  );
  expect(result.career).toEqual(replayCommands(reserved, local.journal, 12));
  expect((await listCareers())[0]).toEqual(result.career);
  expect(
    await AsyncStorage.getItem(`@pss/order-outbox/${initial.id}`),
  ).toBeNull();
});

test('a corrupt cloud checkpoint is rejected before replacing a save', async () => {
  const s = createWorld({ seed: 5 });
  await saveCareer(s);
  globalThis.fetch = jest
    .fn()
    .mockResolvedValue({
      ok: true,
      json: async () => ({
        career: s,
        revision: 0,
        checksum: 'corrupt',
        receipts: [],
      }),
    });
  await expect(cloud.restore(s.id, s)).rejects.toThrow('checksum failed');
  expect((await listCareers())[0]).toEqual(s);
});
