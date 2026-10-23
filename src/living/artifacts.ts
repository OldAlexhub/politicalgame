/* eslint-disable no-bitwise */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { hashes, verify } from '@noble/ed25519';
import { sha256, sha512 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import {
  BASE_CONTENT,
  BASE_POLICY,
  canonicalJson,
  ContentPack,
  NumericalPolicy,
  validateArtifacts,
} from '../../packages/simulation';
import { APP } from '../config/appConfig';
hashes.sha512 = sha512;
const KEY = '@pss/living-artifacts';
export interface SignedArtifact {
  kind: 'content' | 'policy';
  payload: ContentPack | NumericalPolicy;
  checksum: string;
  signature: string;
}
function decode(value: string) {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let buffer = 0,
    bits = 0;
  const bytes: number[] = [];
  for (const c of value
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .replace(/[=]+$/, '')) {
    const index = chars.indexOf(c);
    if (index < 0) throw new Error('Invalid signature encoding.');
    buffer = (buffer << 6) | index;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 255);
    }
  }
  return Uint8Array.from(bytes);
}
export function verifyArtifact(
  a: SignedArtifact,
  publicKey = APP.modelSigningPublicKey,
) {
  if (!['content', 'policy'].includes(a.kind))
    throw new Error('Unknown artifact kind.');
  validateArtifacts(
    a.kind === 'content' ? (a.payload as ContentPack) : BASE_CONTENT,
    a.kind === 'policy' ? (a.payload as NumericalPolicy) : BASE_POLICY,
  );
  if (
    bytesToHex(sha256(utf8ToBytes(canonicalJson(a.payload)))) !== a.checksum ||
    !verify(decode(a.signature), utf8ToBytes(a.checksum), decode(publicKey))
  )
    throw new Error('The update signature or checksum is invalid.');
  return a;
}
async function cached(key = KEY) {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    return (JSON.parse(raw) as SignedArtifact[]).map(a => verifyArtifact(a));
  } catch {
    return [];
  }
}
async function values(previous = false) {
  const packs = await cached(previous ? `${KEY}/previous` : KEY);
  return {
    content: (packs.find(a => a.kind === 'content')?.payload ??
      BASE_CONTENT) as ContentPack,
    policy: (packs.find(a => a.kind === 'policy')?.payload ??
      BASE_POLICY) as NumericalPolicy,
  };
}
export const artifactUpdates = {
  values,
  async check() {
    const current = await cached();
    const next = [...current];
    for (const [path, kind] of [
      ['content', 'content'],
      ['models', 'policy'],
    ] as const) {
      const controller = new AbortController(),
        timer = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch(`${APP.apiBaseUrl}/api/v2/${path}`, {
          signal: controller.signal,
        });
        if (response.status === 404) continue;
        if (!response.ok) throw new Error('Content service is unavailable.');
        const raw = await response.text();
        if (raw.length > 100000)
          throw new Error('Update exceeds the permitted size.');
        const candidate = verifyArtifact(JSON.parse(raw));
        if (candidate.kind !== kind) throw new Error('Artifact type mismatch.');
        const i = next.findIndex(a => a.kind === kind);
        if (i >= 0) next[i] = candidate;
        else next.push(candidate);
      } finally {
        clearTimeout(timer);
      }
    }
    if (canonicalJson(next) !== canonicalJson(current)) {
      await AsyncStorage.setItem(`${KEY}/previous`, JSON.stringify(current));
      await AsyncStorage.setItem(KEY, JSON.stringify(next));
    }
    return values();
  },
};
