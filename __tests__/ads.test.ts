import AsyncStorage from '@react-native-async-storage/async-storage';
import mobileAds, {AdEventType, AdsConsent, InterstitialAd} from 'react-native-google-mobile-ads';
import {AdvertisingManager, isInterstitialEligible} from '../src/services/ads';

test('interstitial cap enforces time and daily limits', () => {
  const now = Date.parse('2026-10-15T16:00:00.000Z');
  expect(isInterstitialEligible({day: '2026-10-15', count: 0, lastShownAt: now - 11 * 60 * 1000}, now)).toBe(true);
  expect(isInterstitialEligible({day: '2026-10-15', count: 0, lastShownAt: now - 5 * 60 * 1000}, now)).toBe(false);
  expect(isInterstitialEligible({day: '2026-10-15', count: 3, lastShownAt: 0}, now)).toBe(false);
});

describe('advertising delivery', () => {
  let manager: AdvertisingManager;
  let events: Map<string, (...args: any[]) => void>;
  let ad: {addAdEventListener: jest.Mock; load: jest.Mock; show: jest.Mock};
  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-23T18:00:00Z'));
    jest.clearAllMocks();
    await AsyncStorage.clear();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    (AdsConsent.requestInfoUpdate as jest.Mock).mockResolvedValue({canRequestAds:true});
    (AdsConsent.loadAndShowConsentFormIfRequired as jest.Mock).mockResolvedValue({canRequestAds:true});
    (AdsConsent.getConsentInfo as jest.Mock).mockResolvedValue({canRequestAds:true});
    (AdsConsent.showPrivacyOptionsForm as jest.Mock).mockResolvedValue({canRequestAds:true});
    (mobileAds().initialize as jest.Mock).mockResolvedValue([]);
    events = new Map();
    ad = {
      addAdEventListener: jest.fn((event, listener) => { events.set(event, listener); return () => events.delete(event); }),
      load: jest.fn(),
      show: jest.fn().mockResolvedValue(undefined),
    };
    (InterstitialAd.createForAdRequest as jest.Mock).mockReturnValue(ad);
    manager = new AdvertisingManager();
  });
  afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); jest.restoreAllMocks(); });

  test('recovers an initial network failure without reopening a completed consent choice', async () => {
    (AdsConsent.requestInfoUpdate as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    (AdsConsent.getConsentInfo as jest.Mock).mockResolvedValueOnce({canRequestAds:false});
    expect(await manager.initialize()).toBe(false);
    expect(mobileAds().initialize).not.toHaveBeenCalled();
    expect(await manager.retryInitialization()).toBe(true);
    expect(ad.load).toHaveBeenCalledTimes(1);
    await manager.retryInitialization();
    expect(AdsConsent.requestInfoUpdate).toHaveBeenCalledTimes(2);
  });

  test('uses a still-valid SDK consent result after a network error', async () => {
    (AdsConsent.requestInfoUpdate as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    expect(await manager.initialize()).toBe(true);
    expect(ad.load).toHaveBeenCalledTimes(1);
  });

  test('does not request ads or repeatedly prompt when consent disallows requests', async () => {
    (AdsConsent.loadAndShowConsentFormIfRequired as jest.Mock).mockResolvedValue({canRequestAds:false});
    expect(await manager.initialize()).toBe(false);
    expect(await manager.retryInitialization()).toBe(false);
    expect(await manager.showAtNaturalTransition()).toBe(false);
    expect(AdsConsent.requestInfoUpdate).toHaveBeenCalledTimes(1);
    expect(ad.load).not.toHaveBeenCalled();
    expect(mobileAds().initialize).not.toHaveBeenCalled();
  });

  test('coalesces initialization and prevents two simultaneous transition ads', async () => {
    await Promise.all([manager.initialize(),manager.initialize()]);
    expect(mobileAds().initialize).toHaveBeenCalledTimes(1);
    events.get(AdEventType.LOADED)!();
    const results = await Promise.all([manager.showAtNaturalTransition(),manager.showAtNaturalTransition()]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(ad.show).toHaveBeenCalledTimes(1);
    events.get(AdEventType.CLOSED)!();
    expect(ad.load).toHaveBeenCalledTimes(2);
    events.get(AdEventType.LOADED)!();
    expect(await manager.showAtNaturalTransition()).toBe(false);
    expect(ad.show).toHaveBeenCalledTimes(1);
  });

  test('never presents after the player has already left the transition', async () => {
    await manager.initialize(); events.get(AdEventType.LOADED)!();
    const canShow = jest.fn().mockReturnValueOnce(true).mockReturnValue(false);
    expect(await manager.showAtNaturalTransition(canShow)).toBe(false);
    expect(ad.show).not.toHaveBeenCalled();
    expect(await manager.showAtNaturalTransition()).toBe(true);
  });

  test('repairs malformed persisted cap data after a successful presentation', async () => {
    await AsyncStorage.setItem('@pss/ad-cap-v1','broken legacy data');
    await manager.initialize(); events.get(AdEventType.LOADED)!();
    expect(await manager.showAtNaturalTransition()).toBe(true);
    expect(JSON.parse((await AsyncStorage.getItem('@pss/ad-cap-v1'))!).count).toBe(1);
  });

  test('expires held inventory and retries a failed request', async () => {
    await manager.initialize(); events.get(AdEventType.LOADED)!();
    jest.advanceTimersByTime(56 * 60_000);
    expect(await manager.showAtNaturalTransition()).toBe(false);
    expect(ad.load).toHaveBeenCalledTimes(2);
    events.get(AdEventType.ERROR)!(new Error('no fill'));
    jest.advanceTimersByTime(60_000);
    expect(ad.load).toHaveBeenCalledTimes(3);
    expect(ad.show).not.toHaveBeenCalled();
  });

  test('counts impressions only on the SDK event and hides ads if privacy changes disallow them', async () => {
    const ready = jest.fn(), impression = jest.fn();
    manager.subscribeReady(ready); manager.subscribeEvents(impression);
    await manager.initialize(); events.get(AdEventType.LOADED)!();
    await manager.showAtNaturalTransition();
    expect(impression).not.toHaveBeenCalledWith('interstitial_impression');
    events.get(AdEventType.IMPRESSION)!();
    expect(impression).toHaveBeenCalledWith('interstitial_impression');
    events.get(AdEventType.CLOSED)!();
    (AdsConsent.showPrivacyOptionsForm as jest.Mock).mockResolvedValueOnce({canRequestAds:false});
    await manager.showPrivacyOptions();
    expect(ready).toHaveBeenLastCalledWith(false);
    expect(await manager.showAtNaturalTransition()).toBe(false);
  });
});
