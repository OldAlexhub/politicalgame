// World coordinates are independent of the phone aspect ratio.
export const MAP_WIDTH = 800;
export const MAP_HEIGHT = 400;
export const TILE_WIDTH = 40;
export const TILE_HEIGHT = 20;
export const isometricPoint = (x: number, y: number) => ({
  x: 320 + (x - y) * TILE_WIDTH,
  y: 55 + (x + y) * TILE_HEIGHT,
});
export function fitMap(width: number, height: number) {
  const scale = Math.max(
    0.05,
    Math.min((width - 24) / MAP_WIDTH, (height - 64) / MAP_HEIGHT),
  );
  return {
    scale,
    x: (width - MAP_WIDTH * scale) / 2,
    y: 32 + (height - 64 - MAP_HEIGHT * scale) / 2,
  };
}
export function zoomMap(
  camera: { zoom: number; x: number; y: number },
  zoom: number,
  width: number,
  height: number,
) {
  const ratio = zoom / camera.zoom;
  return {
    zoom,
    x: camera.x * ratio + (width / 2) * (1 - ratio),
    y: camera.y * ratio + (height / 2) * (1 - ratio),
  };
}

// Keep touch markers distinct even when nearby provinces overlap in projection.
export function placeMapMarkers(
  points: Array<{ x: number; y: number }>,
  width: number,
  height: number,
) {
  const placed: Array<{ x: number; y: number }> = [];
  for (const point of points) {
    const candidates: Array<{ x: number; y: number; distance: number }> = [];
    for (let y = 58; y <= height - 38; y += 38) {
      for (let x = 6; x <= width - 38; x += 38) {
        candidates.push({
          x,
          y,
          distance: (x + 16 - point.x) ** 2 + (y + 16 - point.y) ** 2,
        });
      }
    }
    candidates.sort((a, b) => a.distance - b.distance);
    const available = candidates.find(c =>
      placed.every(p => Math.abs(c.x - p.x) >= 38 || Math.abs(c.y - p.y) >= 38),
    );
    placed.push(available ?? { x: point.x - 16, y: point.y - 16 });
  }
  return placed;
}
