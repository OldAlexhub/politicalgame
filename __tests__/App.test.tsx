/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {Alert, Text} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {DEFAULT_SETTINGS} from '../src/services/storage';

jest.mock('../src/ui/components/StrategicMap', () => {
  const ReactModule = require('react');
  return {StrategicMap: () => ReactModule.createElement(ReactModule.Fragment), RegionalGrid: () => ReactModule.createElement(ReactModule.Fragment)};
});
jest.mock('../src/services/modelPolicy', () => ({
  modelPolicy: {checkForUpdate: jest.fn().mockResolvedValue({updated: false}), getActiveVersion: jest.fn().mockResolvedValue('rules-1.0.0'), infer: jest.fn().mockResolvedValue(undefined)},
}));
jest.mock('react-native-safe-area-context', () => {
  const ReactModule = require('react');
  return {
    SafeAreaProvider: ({children}: {children: React.ReactNode}) => ReactModule.createElement(ReactModule.Fragment, null, children),
    SafeAreaView: ({children}: {children: React.ReactNode}) => ReactModule.createElement(ReactModule.Fragment, null, children),
    useSafeAreaInsets: () => ({top: 0, right: 0, bottom: 0, left: 0}),
  };
});

import App from '../App';

test('renders the application shell', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App />);
    await Promise.resolve();
  });
  expect(tree!.root).toBeTruthy();
});

function findText(root: ReactTestRenderer.ReactTestInstance, value: string) {
  const flatten = (children: unknown): string => Array.isArray(children) ? children.map(flatten).join('') : typeof children === 'string' || typeof children === 'number' ? String(children) : '';
  return root.findAllByType(Text).find(node => flatten(node.props.children) === value);
}

function pressText(root: ReactTestRenderer.ReactTestInstance, value: string) {
  const flatten = (children: unknown): string => Array.isArray(children) ? children.map(flatten).join('') : typeof children === 'string' || typeof children === 'number' ? String(children) : '';
  let node: ReactTestRenderer.ReactTestInstance | null = findText(root, value) ?? null;
  while (node && typeof node.props.onPress !== 'function') node = node.parent;
  if (!node) throw new Error(`No pressable ancestor for ${value}. Available text: ${root.findAllByType(Text).map(item => flatten(item.props.children)).join(' | ')}`);
  return node.props.onPress;
}

test('enters gameplay even when the initial autosave fails', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  await AsyncStorage.clear();
  await AsyncStorage.setItem('@pss/settings-v1', JSON.stringify({...DEFAULT_SETTINGS, consent: {...DEFAULT_SETTINGS.consent, decidedAt: '2026-10-16T00:00:00.000Z'}}));
  let tree: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App />);
  });
  await ReactTestRenderer.act(async () => { await new Promise<void>(resolve => setTimeout(resolve, 0)); });
  await ReactTestRenderer.act(async () => { pressText(tree!.root, 'Begin a new campaign')(); });
  await ReactTestRenderer.act(async () => { pressText(tree!.root, 'Presidential Campaign')(); });
  (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('storage unavailable'));
  await ReactTestRenderer.act(async () => {
    await pressText(tree!.root, 'Enter the political arena')();
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  });

  expect(findText(tree!.root, 'The Open 2028 Election')).toBeTruthy();
  expect(alert).toHaveBeenCalledWith('Autosave unavailable', expect.any(String));
  alert.mockRestore();
});
