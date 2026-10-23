import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppSettings } from '../game/types';
import { APP } from '../config/appConfig';
import { observation, WorldState } from '../../packages/simulation';
const KEY = '@pss/telemetry-v2';
interface Event {
  event:
    | 'career_start'
    | 'career_retired'
    | 'decision'
    | 'performance'
    | 'learning'
    | 'sync_failure';
  day: number;
  action?: string;
  features?: number[];
  value?: number;
}
let queue = Promise.resolve();
export function recordEvent(
  settings: AppSettings,
  state: WorldState,
  event: Event['event'],
  action?: string,
) {
  if (!settings.consent.analytics) return;
  queue = queue
    .catch(() => {})
    .then(async () => {
      const events: Event[] = JSON.parse(
        (await AsyncStorage.getItem(KEY)) ?? '[]',
      );
      events.push({ event, day: state.day, ...(action ? { action } : {}) });
      if (event === 'decision' && settings.consent.collectiveLearning)
        events.push({
          event: 'learning',
          day: state.day,
          action,
          features: observation(state).map(v => Math.max(-2, Math.min(2, v))),
        });
      await AsyncStorage.setItem(KEY, JSON.stringify(events.slice(-120)));
    })
    .catch(() => {});
}
export function flushTelemetry(settings: AppSettings) {
  queue = queue
    .catch(() => {})
    .then(async () => {
      if (!settings.consent.analytics) {
        await AsyncStorage.removeItem(KEY);
        return;
      }
      let events: Event[] = JSON.parse(
        (await AsyncStorage.getItem(KEY)) ?? '[]',
      );
      if (!settings.consent.collectiveLearning)
        events = events.filter(e => e.event !== 'learning');
      if (!events.length) {
        await AsyncStorage.removeItem(KEY);
        return;
      }
      let token = await AsyncStorage.getItem('@pss/telemetry-install-v2');
      if (!token) {
        token = `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}-${Math.random().toString(36).slice(2)}`;
        await AsyncStorage.setItem('@pss/telemetry-install-v2', token);
      }
      const controller = new AbortController(),
        timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetch(`${APP.apiBaseUrl}/api/v2/telemetry`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Install-Token': token,
          },
          body: JSON.stringify({ consent: true, events: events.slice(0, 30) }),
          signal: controller.signal,
        });
        if (response.ok)
          await AsyncStorage.setItem(KEY, JSON.stringify(events.slice(30)));
      } finally {
        clearTimeout(timeout);
      }
    })
    .catch(() => {});
  return queue;
}
