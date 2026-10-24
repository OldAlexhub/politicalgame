import {TestIds} from 'react-native-google-mobile-ads';

export const APP = {
  name: 'Political Strategy Simulator',
  version: '2.0.3',
  developer: 'Old Alex Hub',
  supportEmail: 'info@oldalexhub.com',
  tagline: 'Gain Power. Rule Nations. Shape History.',
  packageName: 'com.oldalexhub.politicalstrategysimulator',
  apiBaseUrl: __DEV__ ? 'http://10.0.2.2:8787' : 'https://game.server.oldalexhub.com',
  modelSigningPublicKey: '8MCv919oKs7BNgx_ZEPL4CnfziwNp8S1oydSUfHZnOA',
} as const;

export const ADMOB = {
  appId: 'ca-app-pub-7831002909037560~4080202967',
  bannerId: __DEV__ ? TestIds.ADAPTIVE_BANNER : 'ca-app-pub-7831002909037560/8921466100',
  interstitialId: __DEV__ ? TestIds.INTERSTITIAL : 'ca-app-pub-7831002909037560/8386279483',
  minimumInterstitialIntervalMs: 10 * 60 * 1000,
  maximumInterstitialsPerDay: 3,
} as const;
