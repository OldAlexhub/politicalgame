import AsyncStorage from '@react-native-async-storage/async-storage';
import {APP} from '../config/appConfig';
import {AppSettings, GameplayExperience} from '../game/types';

const QUEUE_KEY = '@pss/experience-queue-v1';
const ANALYTICS_QUEUE_KEY = '@pss/analytics-queue-v1';
const INSTALL_KEY = '@pss/anonymous-install-v1';
const MAX_QUEUE = 300;

export interface AnalyticsEvent {
  schemaVersion: 1;
  event: 'session_start' | 'session_end' | 'campaign_start' | 'turn_complete' | 'campaign_complete' | 'ad_request' | 'ad_loaded' | 'ad_impression' | 'ad_failure';
  occurredAt: string;
  mode?: string;
  difficulty?: string;
  value?: number;
}

export async function queueExperience(experience: GameplayExperience, settings: AppSettings) {
  if (!settings.consent.analytics || !settings.consent.collectiveLearning) return;
  const queue = await readQueue<GameplayExperience>();
  queue.push(experience);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE)));
}

export async function queueAnalytics(event: AnalyticsEvent, settings: AppSettings) {
  if (!settings.consent.analytics) return;
  const queue = await readQueue<AnalyticsEvent>(ANALYTICS_QUEUE_KEY);
  queue.push(event);
  await AsyncStorage.setItem(ANALYTICS_QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE)));
}

export async function flushAnalytics(settings: AppSettings): Promise<{uploaded: number; remaining: number}> {
  const queue = await readQueue<AnalyticsEvent>(ANALYTICS_QUEUE_KEY);
  if (!settings.consent.analytics || !APP.apiBaseUrl || !queue.length) return {uploaded: 0, remaining: queue.length};
  const batch = queue.slice(0, 100);
  try {
    const response = await fetch(`${APP.apiBaseUrl}/api/v1/analytics`, {
      method: 'POST', headers: {'Content-Type': 'application/json', 'X-Install-Token': await anonymousInstallationId()},
      body: JSON.stringify({consent: true, events: batch}),
    });
    if (!response.ok) throw new Error(`Analytics upload failed (${response.status}).`);
    const remaining = queue.slice(batch.length);
    await AsyncStorage.setItem(ANALYTICS_QUEUE_KEY, JSON.stringify(remaining));
    return {uploaded: batch.length, remaining: remaining.length};
  } catch { return {uploaded: 0, remaining: queue.length}; }
}

export async function flushExperiences(settings: AppSettings): Promise<{uploaded: number; remaining: number}> {
  if (!settings.consent.analytics || !settings.consent.collectiveLearning || !APP.apiBaseUrl) return {uploaded: 0, remaining: (await readQueue()).length};
  const queue = await readQueue<GameplayExperience>();
  if (!queue.length) return {uploaded: 0, remaining: 0};
  const batch = queue.slice(0, 50);
  const installationId = await anonymousInstallationId();
  try {
    const response = await fetch(`${APP.apiBaseUrl}/api/v1/experiences`, {
      method: 'POST', headers: {'Content-Type': 'application/json', 'X-Install-Token': installationId},
      body: JSON.stringify({consent: true, experiences: batch}),
    });
    if (!response.ok) throw new Error(`Telemetry upload failed (${response.status}).`);
    const remaining = queue.slice(batch.length);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
    return {uploaded: batch.length, remaining: remaining.length};
  } catch {
    return {uploaded: 0, remaining: queue.length};
  }
}

async function anonymousInstallationId() {
  let id = await AsyncStorage.getItem(INSTALL_KEY);
  if (!id) {
    id = `anon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
    await AsyncStorage.setItem(INSTALL_KEY, id);
  }
  return id;
}

async function readQueue<T>(key = QUEUE_KEY): Promise<T[]> {
  try { return JSON.parse(await AsyncStorage.getItem(key) ?? '[]'); } catch { return []; }
}
