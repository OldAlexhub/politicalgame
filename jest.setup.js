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
