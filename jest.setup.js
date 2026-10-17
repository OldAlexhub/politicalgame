/* eslint-env jest, node */
jest.mock('@react-native-async-storage/async-storage', () => {
  const values = new Map();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async key => values.has(key) ? values.get(key) : null),
      setItem: jest.fn(async (key, value) => { values.set(key, value); }),
      removeItem: jest.fn(async key => { values.delete(key); }),
      clear: jest.fn(async () => { values.clear(); }),
      getAllKeys: jest.fn(async () => [...values.keys()]),
    },
  };
});

jest.mock('react-native-google-mobile-ads', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: () => ({initialize: jest.fn().mockResolvedValue([])}),
    BannerAd: () => React.createElement(React.Fragment),
    BannerAdSize: {ANCHORED_ADAPTIVE_BANNER: 'ANCHORED_ADAPTIVE_BANNER'},
    TestIds: {ADAPTIVE_BANNER: 'test-banner', INTERSTITIAL: 'test-interstitial'},
    AdEventType: {LOADED: 'loaded', CLOSED: 'closed', ERROR: 'error'},
    AdsConsent: {
      requestInfoUpdate: jest.fn().mockResolvedValue({canRequestAds: true}),
      loadAndShowConsentFormIfRequired: jest.fn().mockResolvedValue({canRequestAds: true}),
      showPrivacyOptionsForm: jest.fn().mockResolvedValue({canRequestAds: true}),
    },
    InterstitialAd: {createForAdRequest: () => ({addAdEventListener: jest.fn(), load: jest.fn(), show: jest.fn().mockResolvedValue(undefined)})},
  };
});

jest.mock('react-native-sound', () => {
  class MockSound {
    static MAIN_BUNDLE = '';
    static instances = [];
    static setCategory = jest.fn();

    constructor(filename, basePath, onLoad) {
      this.filename = filename;
      this.basePath = basePath;
      this.onLoad = onLoad;
      this.loaded = false;
      this.setVolume = jest.fn(() => this);
      this.setNumberOfLoops = jest.fn(() => this);
      this.play = jest.fn(() => this);
      this.stop = jest.fn(callback => { if (this.loaded) callback?.(); return this; });
      this.release = jest.fn(() => { this.loaded = false; });
      MockSound.instances.push(this);
    }

    finishLoad(error = null) {
      this.loaded = !error;
      this.onLoad?.(error);
    }
  }
  return {__esModule: true, default: MockSound};
});
