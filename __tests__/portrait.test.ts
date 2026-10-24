import {
  fitMap,
  isometricPoint,
  MAP_WIDTH,
  MAP_HEIGHT,
  zoomMap,
  placeMapMarkers,
} from '../src/living/mapGeometry';

test.each([
  [320, 155],
  [411, 250],
  [411, 600],
  [800, 400],
])('fits the entire country without stretching at %s × %s', (width, height) => {
  const fit = fitMap(width, height);
  expect(fit.x).toBeGreaterThanOrEqual(0);
  expect(fit.y).toBeGreaterThanOrEqual(0);
  expect(fit.x + MAP_WIDTH * fit.scale).toBeLessThanOrEqual(width);
  expect(fit.y + MAP_HEIGHT * fit.scale).toBeLessThanOrEqual(height);
  const a = isometricPoint(2, 2),
    b = isometricPoint(3, 2);
  expect(((b.x - a.x) * fit.scale) / ((b.y - a.y) * fit.scale)).toBeCloseTo(2);
});

test('zoom preserves the world point under the viewport center', () => {
  const camera = { zoom: 1.2, x: -40, y: 15 };
  const next = zoomMap(camera, 2, 400, 600);
  expect((200 - next.x) / next.zoom).toBeCloseTo(
    (200 - camera.x) / camera.zoom,
  );
  expect((300 - next.y) / next.zoom).toBeCloseTo(
    (300 - camera.y) / camera.zoom,
  );
});

test('compact map markers remain distinct and tappable', () => {
  const points = Array.from({ length: 8 }, (_, i) => ({
    x: 180 + i * 3,
    y: 100 + i,
  }));
  const markers = placeMapMarkers(points, 360, 220);
  for (let i = 0; i < markers.length; i++) {
    expect(markers[i].x).toBeGreaterThanOrEqual(0);
    expect(markers[i].x + 32).toBeLessThanOrEqual(360);
    expect(markers[i].y + 32).toBeLessThanOrEqual(220);
    for (let j = 0; j < i; j++) {
      expect(
        Math.abs(markers[i].x - markers[j].x) >= 38 ||
          Math.abs(markers[i].y - markers[j].y) >= 38,
      ).toBe(true);
    }
  }
});
