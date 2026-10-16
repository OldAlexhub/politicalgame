import AsyncStorage from '@react-native-async-storage/async-storage';
import mobileAds, {AdEventType, AdsConsent, InterstitialAd} from 'react-native-google-mobile-ads';
import {ADMOB} from '../config/appConfig';

const CAP_KEY = '@pss/ad-cap-v1';
const INTERSTITIAL_RETRY_MS = 60_000;
const INTERSTITIAL_MAX_AGE_MS = 55 * 60 * 1000;

export interface AdCapState {day: string; count: number; lastShownAt: number;}
export type AdvertisingEvent = 'interstitial_request' | 'interstitial_loaded' | 'interstitial_impression' | 'interstitial_failure';

export function isInterstitialEligible(cap: AdCapState, now: number) {
  const day = new Date(now).toISOString().slice(0, 10);
  const count = cap.day === day ? cap.count : 0;
  return count < ADMOB.maximumInterstitialsPerDay && now - cap.lastShownAt >= ADMOB.minimumInterstitialIntervalMs;
}

class AdvertisingManager {
  private initialized = false;
  private initializing: Promise<boolean> | null = null;
  private interstitial: ReturnType<typeof InterstitialAd.createForAdRequest> | null = null;
  private loaded = false;
  private loading = false;
  private loadedAt = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private readyListeners = new Set<(ready: boolean) => void>();
  private eventListeners = new Set<(event: AdvertisingEvent) => void>();

  subscribeReady(listener: (ready: boolean) => void) {
    this.readyListeners.add(listener);
    listener(this.initialized);
    return () => this.readyListeners.delete(listener);
  }

  subscribeEvents(listener: (event: AdvertisingEvent) => void) {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  private emitReady() { this.readyListeners.forEach(listener => listener(this.initialized)); }
  private emitEvent(event: AdvertisingEvent) { this.eventListeners.forEach(listener => listener(event)); }

  async initialize() {
    if (this.initialized) return true;
    if (this.initializing) return this.initializing;
    this.initializing = this.initializeOnce().finally(() => { this.initializing = null; });
    return this.initializing;
  }

  private async initializeOnce() {
    try {
      let canRequestAds = false;
      try {
        await AdsConsent.requestInfoUpdate();
        canRequestAds = (await AdsConsent.loadAndShowConsentFormIfRequired()).canRequestAds;
      } catch {
        // A temporary consent-network failure must not discard a valid choice from a prior session.
        canRequestAds = (await AdsConsent.getConsentInfo().catch(() => ({canRequestAds: false}))).canRequestAds;
      }
      if (!canRequestAds) return false;
      await mobileAds().initialize();
      this.prepareInterstitial();
      this.initialized = true;
      this.emitReady();
      this.loadInterstitial();
      return true;
    } catch {
      // Ads are optional; gameplay remains fully available when consent/network/SDK fails.
      return false;
    }
  }

  private prepareInterstitial() {
    if (this.interstitial) return;
    // UMP consent strings are read by the Google Mobile Ads SDK. Do not force every user
    // into non-personalized inventory after they have made a valid privacy choice.
    this.interstitial = InterstitialAd.createForAdRequest(ADMOB.interstitialId);
    this.interstitial.addAdEventListener(AdEventType.LOADED, () => {
      this.loading = false;
      this.loaded = true;
      this.loadedAt = Date.now();
      this.emitEvent('interstitial_loaded');
    });
    this.interstitial.addAdEventListener(AdEventType.CLOSED, () => {
      this.loaded = false;
      this.loadedAt = 0;
      this.loadInterstitial();
    });
    this.interstitial.addAdEventListener(AdEventType.ERROR, () => {
      this.loading = false;
      this.loaded = false;
      this.loadedAt = 0;
      this.emitEvent('interstitial_failure');
      this.scheduleInterstitialRetry();
    });
  }

  private loadInterstitial() {
    if (!this.initialized || !this.interstitial || this.loading || this.loaded) return;
    if (this.retryTimer) { clearTimeout(this.retryTimer); this.retryTimer = null; }
    this.loading = true;
    this.emitEvent('interstitial_request');
    try { this.interstitial.load(); }
    catch {
      this.loading = false;
      this.emitEvent('interstitial_failure');
      this.scheduleInterstitialRetry();
    }
  }

  private scheduleInterstitialRetry() {
    if (this.retryTimer) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.loadInterstitial();
    }, INTERSTITIAL_RETRY_MS);
  }

  async showAtNaturalTransition() {
    if (!this.initialized) await this.initialize();
    if (!this.interstitial || !this.loaded) {
      this.loadInterstitial();
      return false;
    }
    const now = Date.now();
    if (now - this.loadedAt > INTERSTITIAL_MAX_AGE_MS) {
      this.loaded = false;
      this.loadedAt = 0;
      this.loadInterstitial();
      return false;
    }
    const fallback: AdCapState = {day: '', count: 0, lastShownAt: 0};
    let cap = fallback;
    try { cap = JSON.parse(await AsyncStorage.getItem(CAP_KEY) ?? JSON.stringify(fallback)); } catch {}
    if (!isInterstitialEligible(cap, now)) return false;
    try {
      await this.interstitial.show();
      const day = new Date(now).toISOString().slice(0, 10);
      await AsyncStorage.setItem(CAP_KEY, JSON.stringify({day, count: cap.day === day ? cap.count + 1 : 1, lastShownAt: now}));
      this.loaded = false;
      this.emitEvent('interstitial_impression');
      return true;
    } catch {
      this.loaded = false;
      this.emitEvent('interstitial_failure');
      this.loadInterstitial();
      return false;
    }
  }

  async showPrivacyOptions() {
    const result = await AdsConsent.showPrivacyOptionsForm();
    if (result.canRequestAds) await this.initialize();
    return result;
  }
}

export const advertising = new AdvertisingManager();
