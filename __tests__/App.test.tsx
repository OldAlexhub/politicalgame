/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

jest.mock('../src/ui/components/StrategicMap', () => {
  const ReactModule = require('react');
  return {StrategicMap: () => ReactModule.createElement(ReactModule.Fragment), RegionalGrid: () => ReactModule.createElement(ReactModule.Fragment)};
});
jest.mock('../src/services/modelPolicy', () => ({
  modelPolicy: {checkForUpdate: jest.fn().mockResolvedValue({updated: false}), getActiveVersion: jest.fn().mockResolvedValue('rules-1.0.0'), infer: jest.fn().mockResolvedValue(undefined)},
}));

import App from '../App';

test('renders the application shell', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App />);
    await Promise.resolve();
  });
  expect(tree!.root).toBeTruthy();
});
