import * as Keychain from 'react-native-keychain';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { APP } from '../config/appConfig';
import {
  canonicalJson,
  replayCommands,
  Receipt,
  WorldState,
} from '../../packages/simulation';
import { saveCareer } from './storage';

const SERVICE = 'political-strategy-player-v2';
interface Identity {
  playerId: string;
  deviceId: string;
  token: string;
}
interface Cursor {
  revision: number;
  day: number;
  journalLength: number;
}
interface Pending {
  requestId: string;
  input: {
    expectedRevision: number;
    day: number;
    commands: WorldState['journal'];
  };
  journalLength: number;
  jobId?: string;
}
export interface SharedCountry {
  id: string;
  name: string;
  countryName: string;
  government: string;
  playerId: string;
}
export interface SharedOrder {
  id: string;
  kind: Receipt['kind'];
  from_career: string;
  to_career: string;
  amount: number;
  status: string;
  expires_at: string;
}
export interface CloudSnapshot {
  checksum: string;
  career: WorldState;
  revision: number;
  receipts: Receipt[];
}
export interface CloudCareer {
  id: string;
  name: string;
  revision: number;
  day: number;
}
export interface Device {
  id: string;
  created_at: string;
  revoked_at: string | null;
}
const cursorKey = (id: string) => `@pss/cloud-cursor/${id}`;
const pendingKey = (id: string) => `@pss/cloud-pending/${id}`;
const newKey = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random()
    .toString(36)
    .slice(2)}`;
const conflict =
  'Cloud conflict: both histories are preserved. Open Cloud careers, then restore the cloud copy; your current progress will remain as a separate local branch.';
async function remember(s: CloudSnapshot) {
  await AsyncStorage.setItem(
    cursorKey(s.career.id),
    JSON.stringify({
      revision: s.revision,
      day: s.career.day,
      journalLength: s.career.journal.length,
    }),
  );
}
async function identity(): Promise<Identity | null> {
  const value = await Keychain.getGenericPassword({ service: SERVICE });
  return value ? JSON.parse(value.password) : null;
}
async function storeIdentity({ playerId, deviceId, token }: Identity) {
  await Keychain.setGenericPassword(
    'player',
    JSON.stringify({ playerId, deviceId, token }),
    {
      service: SERVICE,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    },
  );
}
class CloudError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}
async function request<T>(
  path: string,
  body?: unknown,
  method = body ? 'POST' : 'GET',
): Promise<T> {
  const auth = await identity(),
    controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`${APP.apiBaseUrl}/api/v2${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(auth ? { Authorization: `Bearer ${auth.token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new CloudError(
        response.status === 409
          ? conflict
          : result.error ?? `Server returned ${response.status}`,
        response.status,
      );
    const snapshot = result.career
      ? result
      : result.result?.career
      ? result.result
      : null;
    if (
      snapshot &&
      bytesToHex(sha256(utf8ToBytes(canonicalJson(snapshot.career)))) !==
        snapshot.checksum
    )
      throw new Error(
        'Cloud checkpoint checksum failed. Your local progress is unchanged.',
      );
    return result;
  } finally {
    clearTimeout(timeout);
  }
}
async function waitForJob(id: string): Promise<CloudSnapshot> {
  for (let attempt = 0; attempt < 35; attempt++) {
    const job = await request<{
      status: string;
      result: CloudSnapshot & { status?: number };
      error?: string;
    }>(`/jobs/${id}`);
    if (job.status === 'completed') return job.result;
    if (job.status === 'failed')
      throw new CloudError(
        job.result?.status === 409
          ? conflict
          : job.error ?? 'Replay validation failed.',
        job.result?.status ?? 400,
      );
    await new Promise<void>(resolve => setTimeout(resolve, 800));
  }
  throw new Error(
    'Synchronization is still queued. Retry to resume the same request. Your local progress is safe.',
  );
}
async function sync(current: WorldState): Promise<CloudSnapshot> {
  if (current.localBranchOf)
    throw new Error(
      'This preserved branch is playable locally. Restore the connected copy to resume shared diplomacy.',
    );
  let state = current;
  const raw = await AsyncStorage.getItem(cursorKey(state.id));
  let cursor: Cursor | null = raw ? JSON.parse(raw) : null;
  if (!cursor) {
    const created = await request<CloudSnapshot>('/careers', {
      config: state.config,
      id: state.id,
    });
    if (created.revision !== 0) throw new CloudError(conflict, 409);
    await remember(created);
    cursor = { revision: 0, day: 0, journalLength: 0 };
  }
  for (let chunk = 0; chunk < 30; chunk++) {
    const existing = await AsyncStorage.getItem(pendingKey(state.id));
    let pending: Pending;
    if (existing) pending = JSON.parse(existing);
    else {
      if (state.day < cursor.day || state.journal.length < cursor.journalLength)
        throw new CloudError(conflict, 409);
      let day = Math.min(state.day, cursor.day + 3600);
      const tail = state.journal.slice(cursor.journalLength);
      if (tail.length > 1900) day = Math.min(day, tail[1899].day);
      const commands = tail.filter(e => e.day <= day);
      if (commands.length > 2000)
        throw new Error(
          'Too many commands at this checkpoint. Preserve this branch and restore the cloud copy.',
        );
      pending = {
        requestId: newKey(),
        input: { expectedRevision: cursor.revision, day, commands },
        journalLength: cursor.journalLength + commands.length,
      };
      await AsyncStorage.setItem(pendingKey(state.id), JSON.stringify(pending));
    }
    if (!pending.jobId) {
      const accepted = await request<{ jobId: string }>(
        `/careers/${encodeURIComponent(state.id)}/sync`,
        {
          ...pending.input,
          commands: pending.input.commands.map(({ day, command }) => ({
            day,
            command,
          })),
          requestId: pending.requestId,
        },
      );
      pending.jobId = accepted.jobId;
      await AsyncStorage.setItem(pendingKey(state.id), JSON.stringify(pending));
    }
    let result: CloudSnapshot;
    try {
      result = await waitForJob(pending.jobId);
    } catch (e) {
      if (e instanceof CloudError && e.status < 500)
        await AsyncStorage.removeItem(pendingKey(state.id));
      throw e;
    }
    const prefix = state.journal
      .slice(0, pending.journalLength)
      .map(e => ({ day: e.day, command: e.command }));
    const acceptedPrefix = result.career.journal.map(e => ({
      day: e.day,
      command: e.command,
    }));
    if (
      canonicalJson(prefix) !== canonicalJson(acceptedPrefix) ||
      state.day < result.career.day
    )
      throw new CloudError(conflict, 409);
    let rebased: WorldState;
    try {
      rebased = replayCommands(
        result.career,
        state.journal.slice(pending.journalLength),
        state.day,
      );
    } catch {
      throw new CloudError(conflict, 409);
    }
    await saveCareer(rebased);
    await remember(result);
    await AsyncStorage.removeItem(pendingKey(state.id));
    cursor = {
      revision: result.revision,
      day: result.career.day,
      journalLength: result.career.journal.length,
    };
    state = rebased;
    if (
      cursor.day === state.day &&
      cursor.journalLength === state.journal.length
    )
      return { ...result, career: state };
  }
  throw new Error(
    'A long history was partially synchronized. Retry to continue from the saved checkpoint.',
  );
}
export const cloud = {
  async connected() {
    return Boolean(await identity());
  },
  async register(alias: string) {
    const result = await request<Identity & { recoveryCode: string }>(
      '/players',
      { alias },
    );
    await storeIdentity(result);
    return result.recoveryCode;
  },
  async recover(recoveryCode: string) {
    await storeIdentity(
      await request<Identity>('/players/recover', { recoveryCode }),
    );
  },
  async disconnect() {
    await request('/players/device', {}, 'DELETE');
    await Keychain.resetGenericPassword({ service: SERVICE });
  },
  sync,
  async careers() {
    return request<CloudCareer[]>('/careers');
  },
  async devices() {
    return request<Device[]>('/players/devices');
  },
  async revoke(id: string) {
    await request(`/players/devices/${encodeURIComponent(id)}`, {}, 'DELETE');
    if ((await identity())?.deviceId === id)
      await Keychain.resetGenericPassword({ service: SERVICE });
  },
  async restore(id: string, current: WorldState) {
    const result = await request<CloudSnapshot>(
      `/careers/${encodeURIComponent(id)}`,
    );
    if (
      current.id === id &&
      canonicalJson(current) !== canonicalJson(result.career)
    ) {
      const branch = JSON.parse(JSON.stringify(current)) as WorldState;
      branch.localBranchOf = id;
      branch.id = `${id}-branch-${Date.now()}`;
      branch.name = `${current.name} (local branch)`;
      await saveCareer(branch);
    } else await saveCareer(current);
    await saveCareer(result.career);
    await remember(result);
    await AsyncStorage.removeItem(pendingKey(id));
    await AsyncStorage.removeItem(`@pss/order-outbox/${id}`);
    return result.career;
  },
  async upgrade(
    state: WorldState,
    contentVersion: string,
    policyVersion: string,
  ) {
    const accepted = await sync(state);
    const result = await request<CloudSnapshot>(
      `/careers/${encodeURIComponent(state.id)}/upgrade`,
      {
        expectedRevision: accepted.revision,
        contentVersion,
        policyVersion,
        paused: true,
      },
    );
    await saveCareer(result.career);
    await remember(result);
    return result.career;
  },
  async countries() {
    return request<SharedCountry[]>('/worlds');
  },
  async join(careerId: string) {
    return request('/worlds/join', { careerId });
  },
  async orders(careerId: string) {
    return request<SharedOrder[]>(
      `/orders?careerId=${encodeURIComponent(careerId)}`,
    );
  },
  async prepareOffer(state: WorldState) {
    if (await AsyncStorage.getItem(`@pss/order-outbox/${state.id}`))
      return state;
    return (await sync(state)).career;
  },
  async offer(
    current: WorldState,
    toCareerId: string,
    kind: Receipt['kind'],
    amount: number,
  ) {
    const careerId = current.id;
    const raw = await AsyncStorage.getItem(cursorKey(careerId));
    if (!raw) throw new Error('Synchronize before making a shared commitment.');
    const cursor = JSON.parse(raw) as Cursor;
    const key = `@pss/order-outbox/${careerId}`;
    const previous = await AsyncStorage.getItem(key);
    const payload = previous
      ? JSON.parse(previous)
      : {
          careerId,
          toCareerId,
          kind,
          amount,
          expectedRevision: cursor.revision,
          idempotencyKey: newKey(),
        };
    if (
      previous &&
      (payload.toCareerId !== toCareerId ||
        payload.kind !== kind ||
        payload.amount !== amount)
    )
      throw new Error(
        'Retry the previous offer with its original terms before sending a different offer.',
      );
    await AsyncStorage.setItem(key, JSON.stringify(payload));
    let result: CloudSnapshot;
    try {
      result = await request<CloudSnapshot>('/orders', payload);
    } catch (e) {
      if (e instanceof CloudError && e.status < 500)
        await AsyncStorage.removeItem(key);
      throw e;
    }
    // A lost response may be retried after domestic play continued. Keep that
    // command tail, applying it to the server's reserved-funds checkpoint.
    const prefix = current.journal
      .slice(0, result.career.journal.length)
      .map(({ day, command }) => ({ day, command }));
    const accepted = result.career.journal.map(({ day, command }) => ({
      day,
      command,
    }));
    if (
      current.day < result.career.day ||
      canonicalJson(prefix) !== canonicalJson(accepted)
    )
      throw new CloudError(conflict, 409);
    let rebased: WorldState;
    try {
      rebased = replayCommands(
        result.career,
        current.journal.slice(result.career.journal.length),
        current.day,
      );
    } catch {
      throw new CloudError(conflict, 409);
    }
    await saveCareer(rebased);
    await remember(result);
    await AsyncStorage.removeItem(key);
    return { ...result, career: rebased };
  },
  async respond(id: string, accept: boolean) {
    return request(`/orders/${encodeURIComponent(id)}/respond`, { accept });
  },
};
