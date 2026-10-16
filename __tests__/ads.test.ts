import {isInterstitialEligible} from '../src/services/ads';

test('interstitial cap enforces time and daily limits', () => {
  const now = Date.parse('2026-10-15T16:00:00.000Z');
  expect(isInterstitialEligible({day: '2026-10-15', count: 0, lastShownAt: now - 11 * 60 * 1000}, now)).toBe(true);
  expect(isInterstitialEligible({day: '2026-10-15', count: 0, lastShownAt: now - 5 * 60 * 1000}, now)).toBe(false);
  expect(isInterstitialEligible({day: '2026-10-15', count: 3, lastShownAt: 0}, now)).toBe(false);
});
