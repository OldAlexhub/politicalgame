/* eslint-disable no-bitwise, no-div-regex */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {hashes, verify} from '@noble/ed25519';
import {sha256, sha512} from '@noble/hashes/sha2.js';
import {bytesToHex, utf8ToBytes} from '@noble/hashes/utils.js';
import {InferenceSession, Tensor} from 'onnxruntime-react-native';
import {APP} from '../config/appConfig';
import {ENGINE_VERSION, extractFeatures} from '../game/engine';
import {GameState} from '../game/types';

hashes.sha512 = sha512;
const ACTIVE_KEY = '@pss/model-active-v1';
const PREVIOUS_KEY = '@pss/model-previous-v1';
const STAGED_KEY = '@pss/model-staged-v1';

interface ModelManifest {
  version: string;
  engineVersion: string;
  schemaVersion: number;
  checksum: string;
  metrics: Record<string, unknown>;
  file: string;
  signature: string;
  approvedAt: string;
}

interface CachedPolicy {manifest: ModelManifest; modelBase64: string;}

class ModelPolicy {
  private session: InferenceSession | null = null;
  private loadedVersion: string | null = null;

  async checkForUpdate() {
    if (!APP.apiBaseUrl) return {updated: false, reason: 'offline_configuration'};
    try {
      const response = await fetch(`${APP.apiBaseUrl}/api/v1/models/latest`);
      if (!response.ok) return {updated: false, reason: `manifest_${response.status}`};
      const manifest = await response.json() as ModelManifest;
      this.assertCompatible(manifest);
      const active = await this.active();
      if (active?.manifest.version === manifest.version) return {updated: false, reason: 'current'};
      const modelUrl = new URL(manifest.file, APP.apiBaseUrl).toString();
      const modelResponse = await fetch(modelUrl);
      if (!modelResponse.ok) throw new Error(`Model download failed (${modelResponse.status}).`);
      const bytes = new Uint8Array(await modelResponse.arrayBuffer());
      if (bytesToHex(sha256(bytes)) !== manifest.checksum) throw new Error('Model checksum validation failed.');
      if (!this.verifyManifest(manifest)) throw new Error('Model signature validation failed.');
      const cached: CachedPolicy = {manifest, modelBase64: encodeBase64(bytes)};
      await AsyncStorage.setItem(STAGED_KEY, JSON.stringify(cached));
      await InferenceSession.create(bytes);
      if (active) await AsyncStorage.setItem(PREVIOUS_KEY, JSON.stringify(active));
      await AsyncStorage.setItem(ACTIVE_KEY, JSON.stringify(cached));
      await AsyncStorage.removeItem(STAGED_KEY);
      this.session = null;
      this.loadedVersion = null;
      return {updated: true, version: manifest.version};
    } catch (error) {
      await AsyncStorage.removeItem(STAGED_KEY);
      return {updated: false, reason: error instanceof Error ? error.message : 'update_failed'};
    }
  }

  async getActiveVersion() { return (await this.active())?.manifest.version ?? 'rules-1.0.0'; }

  async infer(state: GameState): Promise<number | undefined> {
    if (state.policyVersion === 'rules-1.0.0') return undefined;
    try {
      const cached = await this.active();
      if (!cached || cached.manifest.version !== state.policyVersion) return undefined;
      if (!this.session || this.loadedVersion !== cached.manifest.version) {
        this.session = await InferenceSession.create(decodeBase64(cached.modelBase64));
        this.loadedVersion = cached.manifest.version;
      }
      const features = Float32Array.from(extractFeatures(state));
      const output = await this.session.run({observation: new Tensor('float32', features, [1, 24])});
      const values = Array.from(output.action_scores.data as Float32Array);
      const eligible = state.mode === 'grand_campaign'
        ? this.legalWorldDirectives(state, values.length)
        : this.legalDomesticDirectives(state, values.length);
      return eligible.reduce((best, index) => values[index] > values[best] ? index : best, eligible[0] ?? 0);
    } catch {
      await this.rollback();
      return undefined;
    }
  }

  async rollback() {
    const previous = await AsyncStorage.getItem(PREVIOUS_KEY);
    if (previous) await AsyncStorage.setItem(ACTIVE_KEY, previous);
    else await AsyncStorage.removeItem(ACTIVE_KEY);
    this.session = null;
    this.loadedVersion = null;
  }

  private async active(): Promise<CachedPolicy | null> {
    try {
      const raw = await AsyncStorage.getItem(ACTIVE_KEY);
      if (!raw) return null;
      const cached = JSON.parse(raw) as CachedPolicy;
      this.assertCompatible(cached.manifest);
      if (!this.verifyManifest(cached.manifest)) throw new Error('Cached model signature failed.');
      if (bytesToHex(sha256(decodeBase64(cached.modelBase64))) !== cached.manifest.checksum) throw new Error('Cached model checksum failed.');
      return cached;
    } catch { return null; }
  }

  private assertCompatible(manifest: ModelManifest) {
    if (manifest.schemaVersion !== 2 || manifest.engineVersion !== ENGINE_VERSION || !/^\d+\.\d+\.\d+/.test(manifest.version)) throw new Error('Model is incompatible with this simulation version.');
  }

  private legalWorldDirectives(state: GameState, outputSize: number) {
    const features = extractFeatures(state);
    const [territory, army, relations, wars, allies, deals, occupied, resistance] = features.slice(16);
    const legal = [
      wars < 0.01 && relations > 0.32,
      wars < 0.01 && deals < 0.94,
      wars < 0.01 && relations > 0.52 && allies < 0.95,
      wars < 0.01 && relations < 0.74,
      wars > 0.01,
      army < 0.98,
      wars > 0.01 && territory < 0.96,
      occupied > 0.01 || resistance > 0.05,
    ];
    const eligible = legal.flatMap((isLegal, offset) => isLegal && offset + 8 < outputSize ? [offset + 8] : []);
    return eligible.length ? eligible : (outputSize > 13 ? [13] : []);
  }

  private legalDomesticDirectives(state: GameState, outputSize: number) {
    const features = extractFeatures(state);
    const influence = features[2];
    const treasury = features[1];
    const legal = [
      influence >= 0.05,
      influence >= 0.05,
      treasury >= 0.06,
      treasury >= 0.06,
      treasury >= 0.06,
      true,
      influence >= 0.05,
      influence >= 0.05 && state.mode !== 'presidential' && state.turn >= Math.max(3, Math.floor(state.maxTurns / 2)),
    ];
    const eligible = legal.flatMap((isLegal, index) => isLegal && index < outputSize ? [index] : []);
    return eligible.length ? eligible : (outputSize > 5 ? [5] : []);
  }

  private verifyManifest(manifest: ModelManifest) {
    const signed = {version: manifest.version, engineVersion: manifest.engineVersion, schemaVersion: manifest.schemaVersion, checksum: manifest.checksum, metrics: manifest.metrics, file: manifest.file};
    return verify(decodeBase64(manifest.signature), utf8ToBytes(JSON.stringify(signed)), decodeBase64(APP.modelSigningPublicKey));
  }
}

function encodeBase64(bytes: Uint8Array) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const chunk = (bytes[index] << 16) | ((bytes[index + 1] ?? 0) << 8) | (bytes[index + 2] ?? 0);
    result += alphabet[(chunk >> 18) & 63] + alphabet[(chunk >> 12) & 63] + (index + 1 < bytes.length ? alphabet[(chunk >> 6) & 63] : '=') + (index + 2 < bytes.length ? alphabet[chunk & 63] : '=');
  }
  return result;
}

function decodeBase64(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes: number[] = [];
  for (let index = 0; index < normalized.length; index += 4) {
    const a = alphabet.indexOf(normalized[index]);
    const b = alphabet.indexOf(normalized[index + 1]);
    const c = normalized[index + 2] ? alphabet.indexOf(normalized[index + 2]) : 0;
    const d = normalized[index + 3] ? alphabet.indexOf(normalized[index + 3]) : 0;
    const chunk = (a << 18) | (b << 12) | (c << 6) | d;
    bytes.push((chunk >> 16) & 255);
    if (index + 2 < normalized.length) bytes.push((chunk >> 8) & 255);
    if (index + 3 < normalized.length) bytes.push(chunk & 255);
  }
  return Uint8Array.from(bytes);
}

export const modelPolicy = new ModelPolicy();
