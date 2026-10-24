/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Alert, AppState, Keyboard, ScrollView, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_SETTINGS } from '../src/services/storage';
jest.mock('../src/living/LivingMap', () => ({ LivingMap: () => null }));
jest.mock('../src/living/cloud', () => ({
  cloud: { connected: jest.fn().mockResolvedValue(false) },
}));

jest.mock('../src/ui/components/StrategicMap', () => {
  const ReactModule = require('react');
  return {
    StrategicMap: () => ReactModule.createElement(ReactModule.Fragment),
    RegionalGrid: () => ReactModule.createElement(ReactModule.Fragment),
  };
});
jest.mock('../src/services/modelPolicy', () => ({
  modelPolicy: {
    checkForUpdate: jest.fn().mockResolvedValue({ updated: false }),
    getActiveVersion: jest.fn().mockResolvedValue('rules-1.0.0'),
    infer: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('react-native-safe-area-context', () => {
  const ReactModule = require('react');
  return {
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) =>
      ReactModule.createElement(ReactModule.Fragment, null, children),
    SafeAreaView: ({ children }: { children: React.ReactNode }) =>
      ReactModule.createElement(ReactModule.Fragment, null, children),
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

import App from '../App';
import { SafeAdContainer } from '../src/ui/components/Layout';
import { advertising } from '../src/services/ads';

test('renders the application shell', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App />);
    await Promise.resolve();
  });
  expect(tree!.root).toBeTruthy();
  await ReactTestRenderer.act(async () => {
    tree!.unmount();
  });
});

function findText(root: ReactTestRenderer.ReactTestInstance, value: string) {
  const flatten = (children: unknown): string =>
    Array.isArray(children)
      ? children.map(flatten).join('')
      : typeof children === 'string' || typeof children === 'number'
      ? String(children)
      : '';
  return root
    .findAllByType(Text)
    .find(node => flatten(node.props.children) === value);
}

function pressText(root: ReactTestRenderer.ReactTestInstance, value: string) {
  const flatten = (children: unknown): string =>
    Array.isArray(children)
      ? children.map(flatten).join('')
      : typeof children === 'string' || typeof children === 'number'
      ? String(children)
      : '';
  let node: ReactTestRenderer.ReactTestInstance | null =
    findText(root, value) ?? null;
  while (node && typeof node.props.onPress !== 'function') node = node.parent;
  if (!node)
    throw new Error(
      `No pressable ancestor for ${value}. Available text: ${root
        .findAllByType(Text)
        .map(item => flatten(item.props.children))
        .join(' | ')}`,
    );
  return node.props.onPress;
}

test('enters gameplay even when the initial autosave fails', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  await AsyncStorage.clear();
  await AsyncStorage.setItem(
    '@pss/settings-v1',
    JSON.stringify({
      ...DEFAULT_SETTINGS,
      consent: {
        ...DEFAULT_SETTINGS.consent,
        decidedAt: '2026-10-16T00:00:00.000Z',
      },
    }),
  );
  let tree: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App />);
  });
  await ReactTestRenderer.act(async () => {
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  });
  await ReactTestRenderer.act(async () => {
    pressText(tree!.root, 'Begin a political career')();
  });
  (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
    new Error('storage unavailable'),
  );
  await ReactTestRenderer.act(async () => {
    await pressText(tree!.root, 'Enter the country')();
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  });

  expect(findText(tree!.root, 'REGIONAL INTELLIGENCE')).toBeTruthy();
  expect(findText(tree!.root, 'Save needs retry')).toBeTruthy();
  await ReactTestRenderer.act(async () => {
    tree!.unmount();
  });
  alert.mockRestore();
});

test('keeps the ad footer outside scrolling content throughout a career and shows an interstitial only after saving home', async () => {
  await AsyncStorage.clear();
  const show = jest
    .spyOn(advertising, 'showAtNaturalTransition')
    .mockResolvedValue(false);
  let tree: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App />);
  });
  const checkFooter = () => {
    const footer = tree!.root.findByType(SafeAdContainer);
    expect(footer.props.visible).toBe(true);
    let parent = footer.parent;
    while (parent) {
      expect(parent.type).not.toBe(ScrollView);
      parent = parent.parent;
    }
    expect(tree!.root.findAllByType(SafeAdContainer)).toHaveLength(1);
  };
  checkFooter();
  await ReactTestRenderer.act(async () => {
    pressText(tree!.root, 'Begin a political career')();
  });
  checkFooter();
  await ReactTestRenderer.act(async () => {
    pressText(tree!.root, 'Enter the country')();
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  });
  checkFooter();
  expect(show).not.toHaveBeenCalled();
  await ReactTestRenderer.act(async () => {
    pressText(tree!.root, 'Settings')();
  });
  (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
    new Error('save unavailable'),
  );
  await ReactTestRenderer.act(async () => {
    await pressText(tree!.root, 'Save and return home')();
  });
  expect(show).not.toHaveBeenCalled();
  await ReactTestRenderer.act(async () => {
    await pressText(tree!.root, 'Save and return home')();
  });
  expect(show).toHaveBeenCalledTimes(1);
  expect(findText(tree!.root, 'History is unwritten.')).toBeTruthy();
  checkFooter();
  await ReactTestRenderer.act(async () => {
    tree!.unmount();
  });
  show.mockRestore();
});

function byLabel(root: ReactTestRenderer.ReactTestInstance, label: string) {
  return root.findAll(
    node =>
      node.props.accessibilityLabel === label &&
      typeof node.props.onPress === 'function',
  )[0];
}

test('portrait navigation preserves simulation time, review pauses, background protection, and keyboard ad recovery', async () => {
  jest.useFakeTimers();
  const appState = jest.spyOn(AppState, 'addEventListener');
  const keyboard = jest.spyOn(Keyboard, 'addListener');
  appState.mockClear();
  keyboard.mockClear();
  await AsyncStorage.clear();
  let tree: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App />);
  });
  await ReactTestRenderer.act(async () => {
    pressText(tree!.root, 'Begin a political career')();
  });
  await ReactTestRenderer.act(async () => {
    await pressText(tree!.root, 'Enter the country')();
  });
  const root = () => tree!.root;
  const press = async (text: string) =>
    ReactTestRenderer.act(async () => {
      pressText(root(), text)();
    });
  const click = async (label: string) =>
    ReactTestRenderer.act(async () => {
      byLabel(root(), label).props.onPress();
    });
  await click('Run at 2 times speed');
  await click('Government');
  expect(byLabel(root(), 'Run at 2 times speed').props.disabled).toBe(true);
  expect(
    byLabel(root(), 'Pause simulation').props.accessibilityState.selected,
  ).toBe(true);
  const dateText = () =>
    root()
      .findAllByType(Text)
      .map(n => JSON.stringify(n.props.children))
      .find(v => v.includes('Reviewing'));
  const before = dateText();
  expect(before).toBeDefined();
  await ReactTestRenderer.act(async () => {
    jest.advanceTimersByTime(16000);
  });
  expect(dateText()).toBe(before);
  let commitNode = findText(root(), 'Commit decision')!.parent;
  while (commitNode) {
    expect(commitNode.type).not.toBe(ScrollView);
    commitNode = commitNode.parent;
  }
  await press('Assembly');
  expect(findText(root(), 'The balance of power')).toBeTruthy();
  expect(
    byLabel(root(), 'Run at 2 times speed').props.accessibilityState.selected,
  ).toBe(true);
  await press('Country');
  await click('Government');
  const listener = appState.mock.calls.find(([name]) => name === 'change')![1];
  await ReactTestRenderer.act(async () => {
    listener('background');
    listener('active');
  });
  await press('Country');
  expect(
    byLabel(root(), 'Pause simulation').props.accessibilityState.selected,
  ).toBe(true);
  await press('Movement');
  expect(byLabel(root(), 'Movement').props.accessibilityState.selected).toBe(
    true,
  );
  await press('World');
  await press('Connected world');
  const show = keyboard.mock.calls.find(
    ([name]) => name === 'keyboardDidShow',
  )![1];
  const hide = keyboard.mock.calls.find(
    ([name]) => name === 'keyboardDidHide',
  )![1];
  await ReactTestRenderer.act(async () => {
    show({} as never);
  });
  expect(root().findByType(SafeAdContainer).props.visible).toBe(false);
  await ReactTestRenderer.act(async () => {
    hide({} as never);
  });
  expect(root().findByType(SafeAdContainer).props.visible).toBe(true);
  await press('Chronicle');
  await press('Promises');
  await ReactTestRenderer.act(async () => {
    tree!.unmount();
  });
  appState.mockRestore();
  keyboard.mockRestore();
  jest.useRealTimers();
});
