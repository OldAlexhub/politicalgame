import React, {useState} from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {Text} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {createCampaign, processTurn} from '../src/game/engine';
import {DEFAULT_SETTINGS} from '../src/services/storage';
import {CampaignScreen} from '../src/ui/screens/CampaignScreen';

jest.mock('../src/ui/components/StrategicMap', () => {
  const ReactModule = require('react');
  return {StrategicMap: () => ReactModule.createElement(ReactModule.Fragment), RegionalGrid: () => ReactModule.createElement(ReactModule.Fragment)};
});
jest.mock('../src/services/modelPolicy', () => ({
  modelPolicy: {infer: jest.fn().mockResolvedValue(undefined)},
}));
jest.mock('../src/services/telemetry', () => ({
  flushAnalytics: jest.fn().mockResolvedValue(undefined), flushExperiences: jest.fn().mockResolvedValue(undefined),
  queueAnalytics: jest.fn().mockResolvedValue(undefined), queueExperience: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../src/services/ads', () => ({
  advertising: {showAtNaturalTransition: jest.fn().mockResolvedValue(false)},
}));

const metrics = {frame: {x: 0, y: 0, width: 390, height: 844}, insets: {top: 24, left: 0, right: 0, bottom: 24}};

function findText(root: ReactTestRenderer.ReactTestInstance, value: string) {
  const flatten = (children: unknown): string => Array.isArray(children) ? children.map(flatten).join('') : typeof children === 'string' || typeof children === 'number' ? String(children) : '';
  return root.findAllByType(Text).find(node => flatten(node.props.children) === value);
}

function pressText(root: ReactTestRenderer.ReactTestInstance, value: string) {
  let node: ReactTestRenderer.ReactTestInstance | null = findText(root, value) ?? null;
  while (node && typeof node.props.onPress !== 'function') node = node.parent;
  if (!node) throw new Error(`No pressable ancestor for ${value}`);
  return node.props.onPress;
}

test('a decision resolves into a briefing and Back acknowledges without undoing it', async () => {
  const initial = createCampaign({mode: 'presidential', seed: 501, createdAt: '2026-01-01T00:00:00.000Z'});
  let current = initial;
  function Harness() {
    const [state, setState] = useState(initial);
    return <CampaignScreen state={state} settings={{...DEFAULT_SETTINGS, reduceMotion: true, haptics: false}} onChange={next => { current = next; setState(next); }} onExit={jest.fn()} />;
  }
  let tree: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<SafeAreaProvider initialMetrics={metrics}><Harness /></SafeAreaProvider>);
  });

  await ReactTestRenderer.act(async () => { pressText(tree!.root, 'Review strategic actions')(); });
  await ReactTestRenderer.act(async () => { pressText(tree!.root, 'Organize rally')(); });
  await ReactTestRenderer.act(async () => { pressText(tree!.root, 'Pennsylvania')(); });
  const commit = pressText(tree!.root, 'Commit: Organize rally');
  await ReactTestRenderer.act(async () => { await Promise.all([commit(), commit()]); });

  expect(current.actionHistory).toHaveLength(1);
  expect(findText(tree!.root, 'WEEK 1 · TURN RESOLVED')).toBeTruthy();
  await ReactTestRenderer.act(async () => { tree!.root.findByProps({accessibilityLabel: 'Go back'}).props.onPress(); await Promise.resolve(); });
  expect(current.actionHistory).toHaveLength(1);
  expect(current.lastAcknowledgedReportId).toBe(current.lastTurnReport?.id);
  expect(findText(tree!.root, 'Review strategic actions')).toBeTruthy();
});

test('an unacknowledged saved report reopens before the next decision', async () => {
  const initial = createCampaign({mode: 'coup', seed: 502, createdAt: '2026-01-01T00:00:00.000Z'});
  const resolved = processTurn(initial, {id: 'public-address'}).state;
  let tree: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<SafeAreaProvider initialMetrics={metrics}><CampaignScreen state={resolved} settings={{...DEFAULT_SETTINGS, reduceMotion: true, haptics: false}} onChange={jest.fn()} onExit={jest.fn()} /></SafeAreaProvider>);
  });
  expect(findText(tree!.root, 'DAYS 1–3 · TURN RESOLVED')).toBeTruthy();
});
