import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Atlas,
  Canvas,
  Circle,
  Group,
  Path,
  Skia,
  useImage,
  useCanvasRef,
} from '@shopify/react-native-skia';
import {
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated';
import {
  activeSituations,
  regionHappiness,
  WorldState,
} from '../../packages/simulation';

const architecture = require('../../assets/world/architecture.png');
const citizens = require('../../assets/world/citizens.png');
const buildingForProject = {
  clinic: 4,
  housing: 6,
  power: 9,
  school: 5,
  industry: 8,
  transport: 15,
};
export function LivingMap({
  state,
  selected,
  onSelect,
  onInstitution,
  reduceMotion,
  paused,
}: {
  state: WorldState;
  selected: string;
  onSelect: (id: string) => void;
  onInstitution: () => void;
  reduceMotion: boolean;
  paused: boolean;
}) {
  const [size, setSize] = useState({ width: 600, height: 400 });
  const [camera, setCamera] = useState({ zoom: 1, x: 0, y: 0 });
  const cameraRef = useRef(camera);
  cameraRef.current = camera;
  const origin = useRef(camera);
  const image = useImage(architecture);
  const people = useImage(citizens);
  const canvas = useCanvasRef();
  useEffect(() => {
    // Loading an atlas must repaint even when the animation clock is paused.
    canvas.current?.redraw();
  }, [canvas, image, people, paused]);
  const clock = useSharedValue(0);
  useFrameCallback(frame => {
    if (!reduceMotion && !paused)
      clock.value += (frame.timeSincePreviousFrame ?? 0) / 1000;
  });
  const position = useCallback(
    (x: number, y: number) => ({
      x: size.width * 0.42 + ((x - y) * size.width) / 17,
      y: size.height * 0.14 + ((x + y) * size.height) / 23,
    }),
    [size.width, size.height],
  );
  const features = useMemo(() => {
    const tiles = [];
    for (let x = 0; x < 10; x++)
      for (let y = 0; y < 7; y++) {
        if ((x === 0 && y > 4) || (x > 7 && y < 1)) continue;
        const p = position(x, y);
        const w = size.width / 17,
          h = size.height / 23;
        const path = Skia.Path.MakeFromSVGString(
          `M ${p.x} ${p.y - h} L ${p.x + w} ${p.y} L ${p.x} ${p.y + h} L ${
            p.x - w
          } ${p.y} Z`,
        )!;
        tiles.push({
          path,
          color:
            x > 7 ||
            ((x === 0 || y === 6) && (x * 7 + y * 13 + state.seed) % 5 === 0)
              ? '#386d73'
              : (x + y) % 3 === 0
              ? '#7f9875'
              : (x * y) % 5 === 0
              ? '#94a17a'
              : '#879774',
        });
      }
    return tiles;
    // positions depend only on canvas dimensions
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height, state.seed]);
  const buildings = useMemo(
    () =>
      state.regions
        .flatMap((r, index) => {
          const p = position(r.x, r.y);
          const own = state.projects.filter(
            pr => pr.regionId === r.id && pr.status === 'operating',
          );
          const ids = [
            index === 0 ? 0 : index % 3 === 0 ? 12 : index % 3 === 1 ? 8 : 11,
            6,
            14,
            ...own.map(pr => buildingForProject[pr.kind]),
          ];
          return ids.slice(0, 6).map((id, i) => ({
            id,
            x: p.x + ((i % 3) - 1) * 28,
            y: p.y + Math.floor(i / 3) * 19 - 36,
            size: i === 0 ? 72 : 48,
          }));
        })
        .sort((a, b) => a.y + a.size - (b.y + b.size)),
    [state.regions, state.projects, position],
  );
  const sources = image
    ? buildings.map(b =>
        Skia.XYWHRect(
          ((b.id % 4) * image.width()) / 4,
          (Math.floor(b.id / 4) * image.height()) / 4,
          image.width() / 4,
          image.height() / 4,
        ),
      )
    : [];
  const transforms = image
    ? buildings.map(b =>
        Skia.RSXform(b.size / (image.width() / 4), 0, b.x - b.size / 2, b.y),
      )
    : [];
  const crowd = state.regions.flatMap(r => {
    const p = position(r.x, r.y);
    const issue = activeSituations(state).find(
      i =>
        i.regionId === r.id && (i.stage === 'protest' || i.stage === 'strike'),
    );
    const visible = Math.min(
      64,
      issue
        ? 20 + Math.round(issue.pressure / 180)
        : 3 + Math.round(r.production / 900),
    );
    // Reanimated can publish transforms before React commits new sprite props.
    // Fixed-capacity slots keep both native arrays the same length across ticks.
    return Array.from({ length: 64 }, (_, i) => ({
      x: p.x + (i % 7) * 5 - 15,
      y: p.y + 20 + Math.floor(i / 7) * 5,
      index: issue ? 4 + (i % 4) : i % 4,
      protest: Boolean(issue),
      visible: i < visible,
    }));
  });
  const props = state.regions.flatMap((r, index) => {
    const p = position(r.x, r.y);
    const items = [
      { index: 12 + (index % 2), x: p.x - 43, y: p.y - 12, size: 30 },
      { index: 14, x: p.x + 30, y: p.y - 27, size: 22 },
    ];
    const construction = state.projects.some(
      pr =>
        pr.regionId === r.id &&
        (pr.status === 'building' || pr.status === 'delayed'),
    );
    items.push({
      index: 15,
      x: p.x + 15,
      y: p.y - 10,
      size: construction ? 38 : 0,
    });
    const moving =
      r.production > 3500 &&
      !state.situations.some(i => i.regionId === r.id && i.stage === 'strike');
    items.push({
      index: r.terrain === 'coast' ? 11 : 8 + (index % 3),
      x: p.x - 10,
      y: p.y + 18,
      size: moving ? 28 : 0,
    });
    return items;
  });
  const propSources = people
    ? props.map(p =>
        Skia.XYWHRect(
          ((p.index % 4) * people.width()) / 4,
          (Math.floor(p.index / 4) * people.height()) / 4,
          people.width() / 4,
          people.height() / 4,
        ),
      )
    : [];
  const propTransforms = useDerivedValue(() =>
    props.map((p, i) =>
      Skia.RSXform(
        people ? p.size / (people.width() / 4) : 1,
        0,
        p.x +
          (p.index >= 8 && p.index <= 11
            ? Math.sin(clock.value / 5 + i) * 12
            : 0),
        p.y,
      ),
    ),
  );
  const peopleSources = people
    ? crowd.map(p =>
        Skia.XYWHRect(
          ((p.index % 4) * people.width()) / 4,
          (Math.floor(p.index / 4) * people.height()) / 4,
          people.width() / 4,
          people.height() / 4,
        ),
      )
    : [];
  const peopleTransforms = useDerivedValue(() =>
    crowd.map((p, i) => {
      const scale = p.visible && people ? 18 / (people.width() / 4) : 0;
      const drift = p.protest
        ? Math.sin(clock.value * 2 + i) * 1.5
        : Math.sin(clock.value / 4 + i) * 9;
      return Skia.RSXform(scale, 0, p.x + drift, p.y);
    }),
  );
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dx) > 5 || Math.abs(g.dy) > 5,
        onPanResponderGrant: () => {
          origin.current = cameraRef.current;
        },
        onPanResponderMove: (_, g) =>
          setCamera({
            ...origin.current,
            x: Math.max(
              -size.width,
              Math.min(size.width, origin.current.x + g.dx),
            ),
            y: Math.max(
              -size.height,
              Math.min(size.height, origin.current.y + g.dy),
            ),
          }),
      }),
    [size],
  );
  const screen = (p: { x: number; y: number }) => ({
    x: p.x * camera.zoom + camera.x,
    y: p.y * camera.zoom + camera.y,
  });
  return (
    <View
      style={styles.map}
      onLayout={e => setSize(e.nativeEvent.layout)}
      {...pan.panHandlers}
    >
      <Canvas ref={canvas} style={StyleSheet.absoluteFill}>
        <Group
          transform={[
            { translateX: camera.x },
            { translateY: camera.y },
            { scale: camera.zoom },
          ]}
        >
          {features.map((t, i) => (
            <Path key={i} path={t.path} color={t.color} />
          ))}
          {state.regions.slice(1).map((r, i) => {
            const a = position(state.regions[i].x, state.regions[i].y),
              b = position(r.x, r.y);
            const road = Skia.Path.MakeFromSVGString(
              `M ${a.x} ${a.y + 10} C ${a.x + 20} ${a.y + 25} ${b.x - 20} ${
                b.y + 20
              } ${b.x} ${b.y + 10}`,
            )!;
            return (
              <Path
                key={r.id}
                path={road}
                color="#c0b99b"
                style="stroke"
                strokeWidth={4}
              />
            );
          })}
          {state.regions.map(r => {
            const p = position(r.x, r.y);
            return (
              <Circle
                key={r.id}
                cx={p.x}
                cy={p.y + 13}
                r={r.id === selected ? 37 : 30}
                color={r.id === selected ? '#d5c587' : '#adad85'}
                opacity={0.65}
              />
            );
          })}
          {image ? (
            <Atlas
              key={`buildings-${buildings.length}`}
              image={image}
              sprites={sources}
              transforms={transforms}
            />
          ) : null}
          {people ? (
            <Atlas
              image={people}
              sprites={peopleSources}
              transforms={peopleTransforms}
            />
          ) : null}
          {people ? (
            <Atlas
              image={people}
              sprites={propSources}
              transforms={propTransforms}
            />
          ) : null}
          {state.regions
            .filter(r => r.production < 3200)
            .map(r => {
              const p = position(r.x, r.y);
              return (
                <Path
                  key={`closed-${r.id}`}
                  path={`M ${p.x - 15} ${p.y - 2} L ${p.x + 14} ${p.y + 10}`}
                  color="#805f51"
                  style="stroke"
                  strokeWidth={7}
                />
              );
            })}
          {state.projects
            .filter(p => p.status === 'building' || p.status === 'delayed')
            .map(p => {
              const r = state.regions.find(x => x.id === p.regionId)!;
              const point = position(r.x, r.y);
              return (
                <Circle
                  key={p.id}
                  cx={point.x + 26}
                  cy={point.y + 12}
                  r={5}
                  color={p.status === 'delayed' ? '#e07557' : '#efd590'}
                />
              );
            })}
        </Group>
      </Canvas>
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        {state.regions.map(r => {
          const p = screen(position(r.x, r.y));
          const pressure = activeSituations(state).filter(
            i => i.regionId === r.id,
          );
          return (
            <Pressable
              key={r.id}
              accessibilityRole="button"
              accessibilityLabel={`${r.name}, happiness ${Math.round(
                regionHappiness(state, r.id) / 100,
              )} percent, ${pressure.length} developing situations`}
              onPress={() => {
                onSelect(r.id);
                if (r.id === selected)
                  setCamera({
                    zoom: 1.8,
                    x: size.width / 2 - position(r.x, r.y).x * 1.8,
                    y: size.height * 0.45 - position(r.x, r.y).y * 1.8,
                  });
              }}
              style={[
                styles.region,
                { left: p.x - 45, top: p.y + 30 * camera.zoom },
                selected === r.id && styles.selected,
              ]}
            >
              <Text numberOfLines={1} style={styles.regionName}>
                {r.name}
              </Text>
              {selected === r.id || camera.zoom >= 1.5 ? (
                <Text
                  style={[
                    styles.condition,
                    pressure.length ? styles.pressure : null,
                  ]}
                >
                  {pressure.length
                    ? `${pressure.length} developing situation${
                        pressure.length === 1 ? '' : 's'
                      }`
                    : `${Math.round(
                        regionHappiness(state, r.id) / 100,
                      )}% living conditions`}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      <View style={styles.legend}>
        <View style={styles.dot} />
        <Text style={styles.legendText}>
          THE COUNTRY · {state.regime.toUpperCase()}
        </Text>
      </View>
      <View style={styles.controls}>
        <Pressable
          accessibilityLabel="Zoom out"
          onPress={() =>
            setCamera(c => ({ ...c, zoom: Math.max(0.65, c.zoom - 0.2) }))
          }
          style={styles.control}
        >
          <Text style={styles.controlText}>−</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Reset map"
          onPress={() => setCamera({ zoom: 1, x: 0, y: 0 })}
          style={styles.control}
        >
          <Text style={styles.reset}>HOME</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Zoom in"
          onPress={() =>
            setCamera(c => ({ ...c, zoom: Math.min(2, c.zoom + 0.2) }))
          }
          style={styles.control}
        >
          <Text style={styles.controlText}>+</Text>
        </Pressable>
      </View>
      <Pressable onPress={onInstitution} style={styles.assembly}>
        <Text style={styles.assemblyText}>ENTER THE ASSEMBLY →</Text>
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  map: { flex: 1, backgroundColor: '#294f54', overflow: 'hidden' },
  region: {
    position: 'absolute',
    width: 90,
    minHeight: 24,
    padding: 4,
    borderRadius: 4,
    backgroundColor: '#172a2ee8',
    borderWidth: 1,
    borderColor: '#67786c',
  },
  selected: { borderColor: '#e9cc81', backgroundColor: '#283c38' },
  regionName: {
    fontSize: 10,
    fontWeight: '800',
    color: '#f0e6cd',
    textAlign: 'center',
  },
  condition: {
    fontSize: 8,
    color: '#a6beb0',
    textAlign: 'center',
    marginTop: 2,
  },
  pressure: { color: '#f4b39c' },
  legend: {
    position: 'absolute',
    left: 16,
    top: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#e1c580' },
  legendText: {
    fontSize: 9,
    color: '#d9e2cf',
    letterSpacing: 1.6,
    fontWeight: '700',
  },
  controls: {
    position: 'absolute',
    right: 12,
    top: 10,
    flexDirection: 'row',
    gap: 4,
  },
  control: {
    minWidth: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#152b2cdd',
    borderRadius: 5,
  },
  controlText: { fontSize: 22, color: '#e7d9b1' },
  reset: { fontSize: 8, color: '#e7d9b1' },
  assembly: {
    position: 'absolute',
    left: 14,
    bottom: 12,
    backgroundColor: '#142b2ce8',
    padding: 12,
    borderRadius: 6,
  },
  assemblyText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    color: '#ddceaa',
  },
});
