import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  BackHandler,
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  activeSituations,
  actorDialogue,
  approval,
  coalitionSeats,
  Command,
  CommandId,
  createWorld,
  DECISIONS,
  dispatchCommand,
  formatDate,
  getDecisionPreview,
  getTargets,
  PROJECTS,
  ProjectKind,
  regionHappiness,
  StartingPosition,
  stepSimulation,
  WorldState,
} from '../../packages/simulation';
import { AppSettings } from '../game/types';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
} from '../services/storage';
import {
  setGameMusic,
  playWorldCue,
  setWorldAmbience,
} from '../services/worldAudio';
import { LivingMap } from './LivingMap';
import {
  LegacyArchive,
  listCareers,
  listLegacyArchives,
  saveCareer,
} from './storage';
import { SimulationClock } from './clock';
import {
  cloud,
  SharedCountry,
  SharedOrder,
  CloudCareer,
  Device,
} from './cloud';
import { artifactUpdates } from './artifacts';
import { flushTelemetry, recordEvent } from './telemetry';
import { advertising } from '../services/ads';
import { SafeAdContainer } from '../ui/components/Layout';

type Panel =
  | 'region'
  | 'decisions'
  | 'cabinet'
  | 'parliament'
  | 'movement'
  | 'population'
  | 'budget'
  | 'diplomacy'
  | 'commitments'
  | 'briefing'
  | 'online'
  | 'settings';
const portraits = require('../../assets/world/portraits.png');
const pct = (n: number) => `${Math.round(n / 100)}%`;
const money = (n: number) => Math.round(n).toLocaleString();
function Portrait({ index, size = 44 }: { index: number; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        overflow: 'hidden',
        borderRadius: 7,
        backgroundColor: '#24373b',
      }}
    >
      <Image
        source={portraits}
        style={{
          width: size * 4,
          height: size * 4,
          position: 'absolute',
          left: -(index % 4) * size,
          top: -Math.floor(index / 4) * size,
        }}
      />
    </View>
  );
}
function Button({
  children,
  onPress,
  disabled,
  quiet = false,
}: {
  children: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  quiet?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        quiet && styles.quiet,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.buttonText, quiet && styles.quietText]}>
        {children}
      </Text>
    </Pressable>
  );
}
function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}
function Meter({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.meterRow}>
      <View style={styles.between}>
        <Text style={styles.small}>{label}</Text>
        <Text style={styles.metric}>{pct(value)}</Text>
      </View>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            {
              width: `${Math.max(0, Math.min(100, value / 100))}%`,
              backgroundColor: value < 4000 ? '#dc8d6d' : '#8fc1aa',
            },
          ]}
        />
      </View>
    </View>
  );
}
function Row({
  title,
  detail,
  onPress,
}: {
  title: string;
  detail: string;
  onPress?: () => void;
}) {
  return (
    <Pressable disabled={!onPress} onPress={onPress} style={styles.row}>
      <Text style={styles.rowTitle}>
        {title}
        {onPress ? '  →' : ''}
      </Text>
      <Text style={styles.small}>{detail}</Text>
    </Pressable>
  );
}

export default function LivingApp() {
  const inspectorScroll = useRef<React.ElementRef<typeof ScrollView>>(null);
  const [ready, setReady] = useState(false);
  const [adsReady, setAdsReady] = useState(false);
  const [world, setWorld] = useState<WorldState | null>(null);
  const worldRef = useRef<WorldState | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [screen, setScreen] = useState<'home' | 'new' | 'saves' | 'archive'>(
    'home',
  );
  const [careers, setCareers] = useState<WorldState[]>([]);
  const [archives, setArchives] = useState<LegacyArchive[]>([]);
  const [archive, setArchive] = useState<LegacyArchive | null>(null);
  const [seed, setSeed] = useState(`${Math.floor(Math.random() * 4294967295)}`);
  const [start, setStart] = useState<StartingPosition>('government');
  const [difficulty, setDifficulty] = useState<
    'standard' | 'veteran' | 'strategist'
  >('standard');
  const [panel, setPanel] = useState<Panel>('region');
  const [regionId, setRegionId] = useState('r0');
  const [speed, setSpeed] = useState<0 | 1 | 2 | 4>(0);
  const speedRef = useRef<0 | 1 | 2 | 4>(0);
  const [saveStatus, setSaveStatus] = useState('Saved locally');
  const [notice, setNotice] = useState('');
  const [autoPause, setAutoPause] = useState(true);
  const [historyLimit, setHistoryLimit] = useState(100);
  const clock = useRef(new SimulationClock());
  const [decisionRequest, setDecisionRequest] = useState<{
    id: CommandId;
    targetId?: string;
  }>({ id: 'campaign' });
  const settingsRef = useRef(settings);
  const [foreground, setForeground] = useState(true);
  settingsRef.current = settings;
  const commit = useCallback((next: WorldState, persist = true) => {
    worldRef.current = next;
    setWorld(next);
    if (persist) {
      setSaveStatus('Saving…');
      saveCareer(next)
        .then(() => setSaveStatus('Saved locally'))
        .catch(() => {
          setSaveStatus('Save needs retry');
          setNotice(
            'Your career is still in memory. Retry saving before leaving.',
          );
        });
    }
  }, []);
  const pause = useCallback(() => {
    speedRef.current = 0;
    setSpeed(0);
    clock.current.reset(Date.now());
  }, []);
  const openPanel = useCallback(
    (p: Panel) => {
      if (p === 'online' || p === 'settings') pause();
      setPanel(p);
    },
    [pause],
  );
  useEffect(() => {
    const unsubscribe = advertising.subscribeReady(setAdsReady);
    advertising.initialize();
    return () => {
      unsubscribe();
    };
  }, []);
  useEffect(() => {
    flushTelemetry(settings);
    const timer = setInterval(() => flushTelemetry(settingsRef.current), 30000);
    return () => clearInterval(timer);
  }, [settings]);
  useEffect(() => {
    Promise.all([loadSettings(), listCareers(), listLegacyArchives()])
      .then(([st, cs, old]) => {
        setSettings(st);
        setCareers(cs);
        setArchives(old);
      })
      .finally(() => setReady(true));
  }, []);
  const hasWorld = Boolean(world);
  useEffect(() => {
    setGameMusic(foreground && settings.sound && hasWorld);
    return () => setGameMusic(false);
  }, [settings.sound, hasWorld, foreground]);
  const ambienceScene =
    !foreground || !settings.sound || !world
      ? 'quiet'
      : activeSituations(world).some(
          i =>
            i.regionId === regionId && ['protest', 'strike'].includes(i.stage),
        )
      ? 'crowd'
      : world.neighbors.some(n => n.war)
      ? 'crisis'
      : ['cabinet', 'parliament'].includes(panel)
      ? 'institution'
      : 'city';
  useEffect(() => {
    setWorldAmbience(ambienceScene);
    return () => setWorldAmbience('quiet');
  }, [ambienceScene]);
  useEffect(() => {
    clock.current.reset(Date.now());
    const timer = setInterval(() => {
      const s = worldRef.current;
      if (!s || s.status !== 'active') return;
      const days = clock.current.sample(Date.now(), speedRef.current);
      if (!days) return;
      const next = stepSimulation(s, days);
      if (autoPause && next.lastCriticalId !== s.lastCriticalId) {
        pause();
        setNotice('A critical political development needs your attention.');
        playWorldCue('breaking_news.wav', settingsRef.current.sound);
      }
      commit(
        next,
        next.day % 10 === 0 || next.lastCriticalId !== s.lastCriticalId,
      );
    }, 250);
    const sub = AppState.addEventListener('change', state => {
      setForeground(state === 'active');
      pause();
      if (state !== 'active' && worldRef.current)
        saveCareer(worldRef.current).catch(() =>
          setSaveStatus('Save needs retry'),
        );
      setGameMusic(
        state === 'active' &&
          settingsRef.current.sound &&
          Boolean(worldRef.current),
      );
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [autoPause, commit, pause]);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (world) {
        pause();
        setPanel('settings');
        return true;
      }
      if (screen !== 'home') {
        setScreen('home');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [world, screen, pause]);
  const updateSettings = (next: AppSettings) => {
    setSettings(next);
    saveSettings(next).catch(() => setNotice('Settings could not be saved.'));
  };
  const leave = async () => {
    pause();
    if (worldRef.current) {
      try {
        await saveCareer(worldRef.current);
      } catch {
        setNotice(
          'Save failed. Your career remains open so progress is not lost.',
        );
        return;
      }
    }
    worldRef.current = null;
    setWorld(null);
    setCareers(await listCareers());
    setScreen('home');
  };
  const enter = (next: WorldState) => {
    pause();
    setRegionId(next.regions.find(r => r.services < 3500)?.id ?? 'r0');
    setPanel('region');
    setNotice('Inspect your country, then press ▶ to let time advance.');
    commit(next);
    if (next.day === 0) recordEvent(settingsRef.current, next, 'career_start');
  };
  const beginCareer = async () => {
    const { content, policy } = await artifactUpdates.values();
    enter(
      createWorld(
        {
          seed: Number(seed),
          start,
          difficulty,
          id: `career-${Date.now()}-${seed}`,
        },
        content,
        policy,
      ),
    );
  };
  const act = (command: Command) => {
    try {
      const before = worldRef.current!;
      const next = dispatchCommand(before, command);
      commit(next);
      recordEvent(
        settingsRef.current,
        next,
        command.id === 'retire' ? 'career_retired' : 'decision',
        command.id,
      );
      setNotice(next.news[0]?.title ?? 'Decision recorded');
      if (next.lastCriticalId !== before.lastCriticalId) pause();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : 'The decision could not be completed.',
      );
    }
  };
  const cycleSpeed = (next: 0 | 1 | 2 | 4) => {
    speedRef.current = next;
    setSpeed(next);
    clock.current.reset(Date.now());
  };
  const showSaves = async () => {
    setCareers(await listCareers());
    setArchives(await listLegacyArchives());
    setScreen('saves');
  };
  const preview = React.useMemo(
    () => createWorld({ seed: Number(seed) || 1, start }),
    [seed, start],
  );
  if (!ready)
    return (
      <SafeAreaProvider>
        <View style={[styles.root, styles.center]}>
          <ActivityIndicator color="#e4c98b" />
          <Text style={styles.small}>Opening the national archive…</Text>
        </View>
      </SafeAreaProvider>
    );
  return (
    <SafeAreaProvider>
      <StatusBar hidden />
      <SafeAreaView
        style={styles.root}
        edges={['left', 'right', 'bottom', 'top']}
      >
        {world ? (
          <>
            <View style={styles.topbar}>
              <Pressable
                onPress={() => openPanel('settings')}
                style={styles.brand}
              >
                <Text style={styles.country}>{world.name.toUpperCase()}</Text>
                <Text style={styles.eyebrow}>
                  {world.role.toUpperCase()} · {world.movement.name}
                </Text>
              </Pressable>
              <View style={styles.topMetric}>
                <Text style={styles.eyebrow}>TREASURY</Text>
                <Text style={styles.topValue}>{money(world.treasury)}</Text>
              </View>
              <Pressable
                onPress={() => setPanel('population')}
                style={styles.topMetric}
              >
                <Text style={styles.eyebrow}>PUBLIC SUPPORT</Text>
                <Text style={styles.topValue}>{pct(approval(world))}</Text>
              </Pressable>
              <View style={styles.topMetric}>
                <Text style={styles.eyebrow}>LEGITIMACY</Text>
                <Text style={styles.topValue}>{pct(world.legitimacy)}</Text>
              </View>
              <View style={styles.time}>
                <Text style={styles.date}>{formatDate(world.day)}</Text>
                <View style={styles.timeButtons}>
                  {([0, 1, 2, 4] as const).map(v => (
                    <Pressable
                      key={v}
                      accessibilityLabel={
                        v === 0 ? 'Pause simulation' : `Run at ${v} times speed`
                      }
                      disabled={
                        world.status !== 'active' ||
                        panel === 'online' ||
                        panel === 'settings'
                      }
                      onPress={() => cycleSpeed(v)}
                      style={[
                        styles.timeButton,
                        speed === v && styles.timeActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.timeText,
                          speed === v && styles.timeActiveText,
                        ]}
                      >
                        {v === 0 ? 'Ⅱ' : v === 1 ? '▶' : `${v}×`}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
            <View style={styles.main}>
              <View style={styles.worldColumn}>
                <LivingMap
                  state={world}
                  selected={regionId}
                  onSelect={id => {
                    setRegionId(id);
                    setPanel('region');
                  }}
                  onInstitution={() => setPanel('parliament')}
                  reduceMotion={settings.reduceMotion}
                  paused={speed === 0}
                />
                <Pressable
                  onPress={() => setPanel('briefing')}
                  style={styles.dispatch}
                >
                  <Text style={styles.dispatchTag}>
                    {world.news[0]?.severity === 'crisis'
                      ? 'BREAKING'
                      : 'DISPATCH'}
                  </Text>
                  <View style={styles.flex}>
                    <Text numberOfLines={1} style={styles.dispatchTitle}>
                      {world.news[0]?.title}
                    </Text>
                    <Text numberOfLines={1} style={styles.dispatchDetail}>
                      {world.news[0]?.detail}
                    </Text>
                  </View>
                  <Text style={styles.dispatchArrow}>→</Text>
                </Pressable>
              </View>
              <View style={styles.inspector}>
                <View style={styles.panelHeader}>
                  <Text style={styles.label}>
                    {panel === 'region'
                      ? 'REGIONAL INTELLIGENCE'
                      : panel.toUpperCase()}
                  </Text>
                  <Pressable
                    onPress={() => {
                      pause();
                      commit(worldRef.current!);
                    }}
                  >
                    <Text style={styles.saveLabel}>{saveStatus}</Text>
                  </Pressable>
                </View>
                <ScrollView
                  ref={inspectorScroll}
                  contentContainerStyle={styles.panelContent}
                  key={panel === 'region' ? regionId : panel}
                >
                  {world.status === 'retired' ? (
                    <>
                      <Text style={styles.heading}>The historical record</Text>
                      <Text style={styles.body}>{world.legacy}</Text>
                      <Button onPress={() => leave()}>
                        Return to the archive
                      </Button>
                    </>
                  ) : panel === 'region' ? (
                    <RegionPanel
                      world={world}
                      id={regionId}
                      onAction={(id, target) => {
                        setPanel('decisions');
                        setDecisionRequest({ id, targetId: target });
                      }}
                    />
                  ) : panel === 'decisions' ? (
                    <DecisionPanel
                      world={world}
                      onNavigate={() =>
                        inspectorScroll.current?.scrollTo({
                          y: 0,
                          animated: false,
                        })
                      }
                      regionId={regionId}
                      onAct={act}
                      request={decisionRequest}
                    />
                  ) : panel === 'cabinet' ? (
                    <>
                      <Text style={styles.heading}>
                        People behind the power
                      </Text>
                      <Text style={styles.small}>
                        Ambition, competence and remembered decisions shape
                        every relationship.
                      </Text>
                      {world.actors.map(a => (
                        <View key={a.id} style={styles.person}>
                          <View style={styles.personHeader}>
                            <Portrait index={a.portrait} />
                            <View style={styles.flex}>
                              <Text style={styles.rowTitle}>{a.name}</Text>
                              <Text style={styles.small}>
                                {a.office ?? a.role} ·{' '}
                                {
                                  world.factions.find(f => f.id === a.factionId)
                                    ?.name
                                }
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.quote}>
                            “{actorDialogue(world, a)}”
                          </Text>
                          <Text style={styles.small}>
                            Competence {pct(a.competence)} · Trust{' '}
                            {pct(a.trust)} · Ambition {pct(a.ambition)}
                          </Text>
                          {a.memories.at(-1) ? (
                            <Text style={styles.memory}>
                              REMEMBERS: {a.memories.at(-1)!.subject}
                            </Text>
                          ) : null}
                          <Button
                            quiet
                            onPress={() => {
                              setDecisionRequest({
                                id: 'negotiate',
                                targetId: a.id,
                              });
                              setPanel('decisions');
                            }}
                          >
                            Open negotiations
                          </Button>
                        </View>
                      ))}
                    </>
                  ) : panel === 'parliament' ? (
                    <>
                      <Text style={styles.heading}>The balance of power</Text>
                      <Text style={styles.bigNumber}>
                        {coalitionSeats(world)}
                        <Text style={styles.small}> / 100 coalition seats</Text>
                      </Text>
                      <Text style={styles.small}>
                        51 seats pass ordinary legislation. Constitutional
                        change also requires legitimacy.
                      </Text>
                      {world.factions.map(f => (
                        <View key={f.id} style={styles.row}>
                          <View style={styles.between}>
                            <Text style={styles.rowTitle}>{f.name}</Text>
                            <Text style={styles.metric}>{f.seats}</Text>
                          </View>
                          <Text style={styles.small}>
                            {f.coalition ? 'COALITION' : 'OUTSIDE COALITION'} ·{' '}
                            {f.priorities.join(', ')}
                          </Text>
                          <Meter
                            label="Support for your leadership"
                            value={f.support}
                          />
                        </View>
                      ))}
                      <Label>INSTITUTIONS</Label>
                      {world.institutions.map(i => (
                        <View key={i.id} style={styles.row}>
                          <Text style={styles.rowTitle}>{i.name}</Text>
                          <Meter label="Independence" value={i.independence} />
                          <Meter label="Capacity" value={i.capacity} />
                          <Button
                            quiet
                            onPress={() => {
                              setDecisionRequest({
                                id: 'investigate',
                                targetId: i.id,
                              });
                              setPanel('decisions');
                            }}
                          >
                            Discuss an inquiry
                          </Button>
                        </View>
                      ))}
                    </>
                  ) : panel === 'movement' ? (
                    <>
                      <View style={styles.personHeader}>
                        <Portrait index={world.leader.portrait} size={64} />
                        <View style={styles.flex}>
                          <Label>YOUR LEADERSHIP</Label>
                          <Text style={styles.heading}>
                            {world.leader.name}
                          </Text>
                          <Text style={styles.small}>
                            Age {world.leader.age} · Generation{' '}
                            {world.leader.generation}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.subheading}>
                        {world.movement.name}
                      </Text>
                      <Meter
                        label="Organization"
                        value={world.movement.organization}
                      />
                      <Meter
                        label="Reputation"
                        value={world.movement.reputation}
                      />
                      <Text style={styles.body}>
                        Political capital: {world.movement.influence} / 100
                      </Text>
                      <Text style={styles.body}>
                        Movement funds: {money(world.movement.funds)}.
                        Membership donations arrive monthly.
                      </Text>
                      <Text style={styles.small}>
                        {world.role === 'government'
                          ? 'Your movement holds executive office. Governing makes you accountable for delivery.'
                          : world.role === 'opposition'
                          ? 'Build public support, organize and negotiate. Losing office is a new political chapter.'
                          : 'Build relationships and prepare a legitimate succession.'}
                      </Text>
                      <Row
                        title="Next political settlement"
                        detail={`${Math.max(
                          0,
                          world.electionDay - world.day,
                        )} days · ${world.regime}`}
                        onPress={() => setPanel('parliament')}
                      />
                      <Button
                        onPress={() => {
                          setDecisionRequest({
                            id: 'organize',
                            targetId: regionId,
                          });
                          setPanel('decisions');
                        }}
                      >
                        Organize in the provinces
                      </Button>
                      <Button
                        quiet
                        onPress={() => {
                          setDecisionRequest({
                            id: 'succession',
                            targetId: world.actors[0].id,
                          });
                          setPanel('decisions');
                        }}
                      >
                        Plan the next generation
                      </Button>
                    </>
                  ) : panel === 'population' ? (
                    <>
                      <Text style={styles.heading}>
                        A country of different lives
                      </Text>
                      <Text style={styles.small}>
                        National approval is the population-weighted support of
                        these communities.
                      </Text>
                      {world.regions.map(r => (
                        <View key={r.id}>
                          <Text style={styles.subheading}>{r.name}</Text>
                          {r.cohorts.map(c => (
                            <View key={c.id} style={styles.row}>
                              <View style={styles.between}>
                                <Text style={styles.rowTitle}>
                                  {c.group.toUpperCase()}
                                </Text>
                                <Text style={styles.metric}>
                                  {money(c.size)}
                                </Text>
                              </View>
                              <Meter
                                label="Political support"
                                value={c.support}
                              />
                              <Text style={styles.small}>
                                Employment {pct(c.employment)} · Household
                                income {money(c.income)} · Living costs{' '}
                                {money(c.costOfLiving)}
                              </Text>
                              <Text style={styles.small}>
                                {Object.entries(c.needs)
                                  .map(([n, v]) => `${n} ${pct(v)}`)
                                  .join(' · ')}
                              </Text>
                            </View>
                          ))}
                        </View>
                      ))}
                    </>
                  ) : panel === 'budget' ? (
                    <>
                      <Text style={styles.heading}>The public accounts</Text>
                      <Text style={styles.bigNumber}>
                        {world.budget.net >= 0 ? '+' : ''}
                        {money(world.budget.net)}
                      </Text>
                      <Text style={styles.small}>
                        Projected monthly balance · next settlement in{' '}
                        {30 - (world.day % 30)} days
                      </Text>
                      {[
                        ['Tax and trade revenue', world.budget.revenue],
                        ['Committed expenditure', -world.budget.expenses],
                        ['Debt service included', -world.budget.debtService],
                        [
                          'Service maintenance included',
                          -world.budget.projectMaintenance,
                        ],
                        ['Outstanding debt', world.debt],
                      ].map(([label, value]) => (
                        <View
                          key={String(label)}
                          style={[styles.row, styles.between]}
                        >
                          <Text style={styles.small}>{label}</Text>
                          <Text style={styles.metric}>
                            {money(Number(value))}
                          </Text>
                        </View>
                      ))}
                      <Meter
                        label="Employment"
                        value={world.economy.employment}
                      />
                      <Meter
                        label="Purchasing power"
                        value={world.economy.purchasingPower}
                      />
                      <Text style={styles.small}>
                        Tax rate {world.taxRate}% · Fuel support{' '}
                        {world.fuelSubsidy}%
                      </Text>
                      <Button
                        onPress={() => {
                          setDecisionRequest({ id: 'subsidy' });
                          setPanel('decisions');
                        }}
                      >
                        Rebalance household support
                      </Button>
                      <Button
                        quiet
                        onPress={() => {
                          setDecisionRequest({ id: 'tax' });
                          setPanel('decisions');
                        }}
                      >
                        Negotiate taxation
                      </Button>
                      <Button
                        quiet
                        onPress={() => {
                          setDecisionRequest({ id: 'borrow' });
                          setPanel('decisions');
                        }}
                      >
                        Review borrowing terms
                      </Button>
                    </>
                  ) : panel === 'diplomacy' ? (
                    <>
                      <Text style={styles.heading}>Beyond the border</Text>
                      <Text style={styles.small}>
                        Neighbors pursue their own interests. Trade and conflict
                        reach households through prices and public finances.
                      </Text>
                      {world.neighbors.map(n => (
                        <View key={n.id} style={styles.row}>
                          <Text style={styles.rowTitle}>{n.name}</Text>
                          <Text style={styles.small}>
                            {n.war
                              ? 'ACTIVE CONFLICT'
                              : n.allied
                              ? 'ALLY'
                              : n.trade
                              ? 'TRADING PARTNER'
                              : 'UNALIGNED'}{' '}
                            · Relations {n.relation > 0 ? '+' : ''}
                            {n.relation}
                          </Text>
                          <Meter label="National power" value={n.power} />
                          <Button
                            quiet
                            onPress={() => {
                              setDecisionRequest({
                                id: n.war ? 'peace' : 'trade',
                                targetId: n.id,
                              });
                              setPanel('decisions');
                            }}
                          >
                            Open diplomatic talks
                          </Button>
                        </View>
                      ))}
                      <Button onPress={() => openPanel('online')}>
                        Connect with other countries
                      </Button>
                    </>
                  ) : panel === 'commitments' ? (
                    <>
                      <Text style={styles.heading}>
                        The promises people remember
                      </Text>
                      {world.commitments.length === 0 ? (
                        <Text style={styles.small}>
                          No public commitments yet. Promises made during
                          negotiations also appear here.
                        </Text>
                      ) : (
                        world.commitments
                          .slice()
                          .reverse()
                          .map(c => (
                            <Row
                              key={c.id}
                              title={`${PROJECTS[c.kind].label} · ${c.status}`}
                              detail={`${
                                world.regions.find(r => r.id === c.regionId)
                                  ?.name
                              } · ${
                                c.status === 'open'
                                  ? `${c.dueDay - world.day} days to deliver`
                                  : formatDate(c.dueDay)
                              }`}
                              onPress={() => {
                                setRegionId(c.regionId);
                                setPanel('region');
                              }}
                            />
                          ))
                      )}
                      <Label>PUBLIC PROJECTS</Label>
                      {world.projects.length === 0 ? (
                        <Text style={styles.small}>
                          Commission a project through a regional budget
                          decision.
                        </Text>
                      ) : (
                        world.projects.map(p => (
                          <View key={p.id} style={styles.row}>
                            <Text style={styles.rowTitle}>
                              {PROJECTS[p.kind].label}
                            </Text>
                            <Text style={styles.small}>
                              {
                                world.regions.find(r => r.id === p.regionId)
                                  ?.name
                              }{' '}
                              · {p.status}
                            </Text>
                            <Meter label="Delivery" value={p.progress} />
                            <Text style={styles.small}>
                              Maintenance {p.maintenance} each month
                            </Text>
                          </View>
                        ))
                      )}
                    </>
                  ) : panel === 'briefing' ? (
                    <>
                      <Text style={styles.heading}>The national record</Text>
                      {world.news.slice(0, historyLimit).map(n => (
                        <Pressable
                          key={n.id}
                          style={styles.row}
                          onPress={() => {
                            if (n.regionId) {
                              setRegionId(n.regionId);
                              setPanel('region');
                            }
                          }}
                        >
                          <Text
                            style={[
                              styles.label,
                              n.severity === 'crisis' && styles.danger,
                            ]}
                          >
                            {formatDate(n.day)} · {n.severity}
                          </Text>
                          <Text style={styles.rowTitle}>{n.title}</Text>
                          <Text style={styles.body}>{n.detail}</Text>
                          {n.impacts.map((v, i) => (
                            <Text key={i} style={styles.memory}>
                              {v}
                            </Text>
                          ))}
                          {n.sourceId ? (
                            <Text style={styles.small}>
                              Linked consequence:{' '}
                              {world.news.find(x => x.id === n.sourceId)
                                ?.title ?? n.sourceId}
                            </Text>
                          ) : null}
                        </Pressable>
                      ))}
                      {world.news.length > historyLimit ? (
                        <Button
                          quiet
                          onPress={() => setHistoryLimit(v => v + 100)}
                        >
                          Read earlier history
                        </Button>
                      ) : null}
                    </>
                  ) : panel === 'online' ? (
                    <OnlinePanel
                      key={world.id}
                      world={world}
                      onUpdate={next => commit(next)}
                      onNotice={setNotice}
                    />
                  ) : (
                    <>
                      <Text style={styles.heading}>Your political world</Text>
                      <Setting
                        label="Sound and ambience"
                        value={settings.sound}
                        onChange={v =>
                          updateSettings({ ...settings, sound: v })
                        }
                      />
                      <Setting
                        label="Reduce motion"
                        value={settings.reduceMotion}
                        onChange={v =>
                          updateSettings({ ...settings, reduceMotion: v })
                        }
                      />
                      <Setting
                        label="Pause for critical developments"
                        value={autoPause}
                        onChange={setAutoPause}
                      />
                      <Setting
                        label="Optional gameplay analytics"
                        value={settings.consent.analytics}
                        onChange={v =>
                          updateSettings({
                            ...settings,
                            consent: {
                              ...settings.consent,
                              analytics: v,
                              decidedAt: new Date().toISOString(),
                            },
                          })
                        }
                      />
                      <Setting
                        label="Help train political opponents"
                        value={settings.consent.collectiveLearning}
                        onChange={v =>
                          updateSettings({
                            ...settings,
                            consent: {
                              ...settings.consent,
                              collectiveLearning: v,
                              decidedAt: new Date().toISOString(),
                            },
                          })
                        }
                      />
                      <Text style={styles.small}>
                        Political opponents use rules and trained numerical
                        policies. No LLMs. Your country pauses when the app is
                        closed.
                      </Text>
                      <Button onPress={() => commit(worldRef.current!)}>
                        Save now
                      </Button>
                      <Button
                        quiet
                        onPress={() =>
                          advertising
                            .showPrivacyOptions()
                            .catch(() =>
                              setNotice(
                                'Advertising privacy options are temporarily unavailable.',
                              ),
                            )
                        }
                      >
                        Advertising privacy
                      </Button>
                      <Text style={styles.small}>
                        Content {world.contentVersion} · Opponents{' '}
                        {world.policyVersion}. Careers keep their chosen
                        versions.
                      </Text>
                      <Button
                        quiet
                        onPress={() =>
                          artifactUpdates
                            .check()
                            .then(v =>
                              setNotice(
                                `Verified content ${v.content.version}, opponents ${v.policy.version}. New careers use these versions. Connected careers can adopt them from Connected world.`,
                              ),
                            )
                            .catch(e => setNotice(e.message))
                        }
                      >
                        Check for signed updates
                      </Button>
                      <Button quiet onPress={() => leave()}>
                        Save and return home
                      </Button>
                      <Button
                        quiet
                        onPress={() =>
                          Alert.alert(
                            'Record your legacy?',
                            'Retirement closes this career. Its history remains in your archive.',
                            [
                              { text: 'Continue', style: 'cancel' },
                              {
                                text: 'Retire',
                                onPress: () => act({ id: 'retire' }),
                              },
                            ],
                          )
                        }
                      >
                        Retire from public life
                      </Button>
                    </>
                  )}
                </ScrollView>
              </View>
            </View>
            {notice ? (
              <Pressable
                accessibilityLabel="Dismiss status message"
                onPress={() => setNotice('')}
                style={styles.notice}
              >
                <Text numberOfLines={2} style={styles.noticeText}>
                  {notice}
                </Text>
                <Text style={styles.noticeText}>×</Text>
              </Pressable>
            ) : null}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.nav}
              contentContainerStyle={styles.navContent}
            >
              {(
                [
                  ['region', 'Country'],
                  ['decisions', 'Decisions'],
                  ['cabinet', 'Cabinet'],
                  ['parliament', 'Assembly'],
                  ['movement', 'Movement'],
                  ['population', 'People'],
                  ['budget', 'Treasury'],
                  ['diplomacy', 'Foreign affairs'],
                  ['commitments', 'Promises'],
                  ['briefing', 'Chronicle'],
                  ['online', 'Connected world'],
                  ['settings', 'Settings'],
                ] as Array<[Panel, string]>
              ).map(([id, label]) => (
                <Pressable
                  key={id}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: panel === id }}
                  onPress={() => openPanel(id)}
                  style={[styles.navItem, panel === id && styles.navSelected]}
                >
                  <Text
                    style={[
                      styles.navText,
                      panel === id && styles.navTextSelected,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        ) : (
          <View style={styles.main}>
            <View style={styles.homeScene}>
              <LivingMap
                state={preview}
                selected=""
                onSelect={() => setScreen('new')}
                onInstitution={() => setScreen('new')}
                reduceMotion={settings.reduceMotion}
                paused={false}
              />
              <View pointerEvents="none" style={styles.hero}>
                <Text style={styles.heroKicker}>
                  OLD ALEX HUB · POLITICAL STRATEGY
                </Text>
                <Text style={styles.heroTitle}>
                  A country lives.{'\n'}Power changes hands.
                </Text>
                <Text style={styles.heroSubtitle}>
                  The promises. The people. The price of power.
                </Text>
              </View>
            </View>
            <View style={styles.homePanel}>
              <ScrollView contentContainerStyle={styles.homeContent}>
                {screen === 'home' ? (
                  <>
                    <Label>A LIVING POLITICAL WORLD</Label>
                    <Text style={styles.heading}>History is unwritten.</Text>
                    <Text style={styles.body}>
                      Build a movement. Govern a divided country. Face the
                      consequences—and find your way back.
                    </Text>
                    <Button onPress={() => setScreen('new')}>
                      Begin a political career
                    </Button>
                    <Button quiet onPress={showSaves}>
                      Continue / archives
                    </Button>
                    <View style={styles.homeRule} />
                    <Text style={styles.small}>
                      One world. Elections, coalitions, succession and upheaval.
                    </Text>
                    <Text style={styles.small}>
                      Fully playable offline. Optional connected countries.
                    </Text>
                    <Setting
                      label="Sound"
                      value={settings.sound}
                      onChange={v => updateSettings({ ...settings, sound: v })}
                    />
                    <Text style={styles.footnote}>
                      FICTIONAL COUNTRIES · VERSION 2.0
                    </Text>
                    <SafeAdContainer
                      placement="living-home"
                      visible={adsReady}
                    />
                  </>
                ) : screen === 'new' ? (
                  <>
                    <Button quiet onPress={() => setScreen('home')}>
                      ← Home
                    </Button>
                    <Label>YOUR NEXT CHAPTER</Label>
                    <Text style={styles.heading}>{preview.name}</Text>
                    <Text style={styles.small}>{preview.motto}</Text>
                    <Label>STARTING POSITION</Label>
                    {(
                      [
                        [
                          'government',
                          'A fragile government',
                          'You have authority. Now deliver.',
                        ],
                        [
                          'opposition',
                          'An opposition movement',
                          'Build the coalition that can win.',
                        ],
                        [
                          'successor',
                          'A royal successor',
                          'Earn the trust to inherit power.',
                        ],
                      ] as const
                    ).map(([id, title, detail]) => (
                      <Pressable
                        key={id}
                        onPress={() => setStart(id)}
                        style={[styles.choice, start === id && styles.chosen]}
                      >
                        <Text style={styles.rowTitle}>{title}</Text>
                        <Text style={styles.small}>{detail}</Text>
                      </Pressable>
                    ))}
                    <Label>PRESSURE</Label>
                    <View style={styles.wrap}>
                      {(['standard', 'veteran', 'strategist'] as const).map(
                        d => (
                          <Button
                            key={d}
                            quiet={difficulty !== d}
                            onPress={() => setDifficulty(d)}
                          >
                            {d}
                          </Button>
                        ),
                      )}
                    </View>
                    <Label>COUNTRY SEED</Label>
                    <View style={styles.personHeader}>
                      <TextInput
                        accessibilityLabel="Country seed"
                        keyboardType="number-pad"
                        value={seed}
                        onChangeText={v =>
                          setSeed(v.replace(/[^0-9]/g, '').slice(0, 10))
                        }
                        style={[styles.input, styles.flex]}
                      />
                      <Button
                        quiet
                        onPress={() =>
                          setSeed(`${Math.floor(Math.random() * 4294967295)}`)
                        }
                      >
                        ↻
                      </Button>
                    </View>
                    <Button
                      disabled={!seed || Number(seed) > 4294967295}
                      onPress={() => {
                        beginCareer().catch(e => setNotice(e.message));
                      }}
                    >
                      Enter the country
                    </Button>
                  </>
                ) : screen === 'saves' ? (
                  <>
                    <Button quiet onPress={() => setScreen('home')}>
                      ← Home
                    </Button>
                    <Text style={styles.heading}>Your political histories</Text>
                    {careers.length === 0 ? (
                      <Text style={styles.small}>
                        Your first career will appear here.
                      </Text>
                    ) : (
                      careers.map(c => (
                        <Row
                          key={c.id}
                          title={`${c.name} · ${c.role}`}
                          detail={`${formatDate(c.day)} · ${c.status}`}
                          onPress={() => enter(c)}
                        />
                      ))
                    )}
                    <Label>EARLIER CAMPAIGN ARCHIVES</Label>
                    <Text style={styles.small}>
                      Previous campaigns remain readable. New careers share the
                      unified world simulation.
                    </Text>
                    {archives.map(a => (
                      <Row
                        key={a.id}
                        title={a.name}
                        detail={`${a.mode} · Turn ${a.turn} · ${a.status}`}
                        onPress={() => {
                          setArchive(a);
                          setScreen('archive');
                        }}
                      />
                    ))}
                  </>
                ) : (
                  <>
                    <Button quiet onPress={() => setScreen('saves')}>
                      ← Archives
                    </Button>
                    <Text style={styles.heading}>{archive?.name}</Text>
                    <Text style={styles.body}>
                      {archive?.result?.summary ??
                        'Preserved political history'}
                    </Text>
                    {archive?.history
                      .slice()
                      .reverse()
                      .map((n, i) => (
                        <Row key={i} title={n.title} detail={n.detail} />
                      ))}
                  </>
                )}
              </ScrollView>
            </View>
          </View>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

// Request selection is passed explicitly so regional and actor links retain their target.
// These hooks live in a wrapper below; no module-global campaign state is retained.

function Setting({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.between}>
      <Text style={[styles.small, styles.flex]}>{label}</Text>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ false: '#405452', true: '#628d78' }}
        thumbColor="#ead9ae"
      />
    </View>
  );
}
function RegionPanel({
  world,
  id,
  onAction,
}: {
  world: WorldState;
  id: string;
  onAction: (id: CommandId, target: string) => void;
}) {
  const r = world.regions.find(x => x.id === id) ?? world.regions[0];
  const issues = activeSituations(world).filter(i => i.regionId === r.id);
  const people = r.cohorts.reduce((n, c) => n + c.size, 0);
  return (
    <>
      <Label>{r.identity.toUpperCase()}</Label>
      <Text style={styles.heading}>{r.name}</Text>
      <Text style={styles.small}>
        {money(people)} residents · {r.terrain}
      </Text>
      <Meter label="Living conditions" value={regionHappiness(world, r.id)} />
      <Meter label="Public service capacity" value={r.services} />
      <Meter label="Administrative capacity" value={r.capacity} />
      {issues.map(i => (
        <View key={i.id} style={styles.issue}>
          <Label>{i.stage.toUpperCase()}</Label>
          <Text style={styles.rowTitle}>{i.demand}</Text>
          <Text style={styles.body}>{i.causes.join(' ')}</Text>
          <Text style={styles.small}>
            Organized by {world.actors.find(a => a.id === i.actorId)?.name}
          </Text>
          <Button
            quiet
            onPress={() =>
              i.kind === 'corruption'
                ? onAction('investigate', 'courts')
                : i.kind === 'succession'
                ? onAction('negotiate', i.actorId)
                : i.kind === 'war' && world.role === 'government'
                ? onAction('peace', world.neighbors.find(n => n.war)?.id ?? '')
                : i.kind === 'constitutional' && world.role === 'government'
                ? onAction('reform', 'assembly')
                : onAction(
                    world.role === 'government' ? 'settle' : 'organize',
                    world.role === 'government' ? i.id : r.id,
                  )
            }
          >
            {world.role === 'government'
              ? 'Negotiate with organizers'
              : 'Organize your response'}
          </Button>
        </View>
      ))}
      <Label>LOCAL POLITICAL PRIORITIES</Label>
      {r.cohorts
        .slice()
        .sort((a, b) => b.grievance - a.grievance)
        .slice(0, 3)
        .map(c => (
          <Row
            key={c.id}
            title={c.group}
            detail={`Support ${pct(c.support)} · Grievance ${pct(
              c.grievance,
            )} · Health ${pct(c.needs.health)}`}
          />
        ))}
      <Button
        onPress={() =>
          onAction(world.role === 'government' ? 'project' : 'campaign', r.id)
        }
      >
        {world.role === 'government'
          ? 'Review regional investment'
          : 'Visit this constituency'}
      </Button>
      <Button quiet onPress={() => onAction('promise', r.id)}>
        Make a public commitment
      </Button>
      <Label>PROJECT DELIVERY</Label>
      {world.projects
        .filter(p => p.regionId === r.id)
        .map(p => (
          <View key={p.id}>
            <Text style={styles.small}>
              {PROJECTS[p.kind].label} · {p.status}
            </Text>
            <Meter label="Completion" value={p.progress} />
          </View>
        ))}
    </>
  );
}
function DecisionPanel({
  world,
  onNavigate,
  regionId,
  onAct,
  request,
}: {
  world: WorldState;
  onNavigate: () => void;
  regionId: string;
  onAct: (c: Command) => void;
  request?: { id: CommandId; targetId?: string };
}) {
  const [id, setId] = useState<CommandId>(request?.id ?? 'campaign');
  const [targetId, setTargetId] = useState(request?.targetId ?? regionId);
  const [option, setOption] = useState('clinic');
  const [value, setValue] = useState('35');
  const [category, setCategory] = useState('all');
  const [browsing, setBrowsing] = useState(false);
  const [choosingTarget, setChoosingTarget] = useState(false);
  useEffect(() => {
    if (request) {
      setId(request.id);
      setTargetId(request.targetId ?? regionId);
      setOption(
        request.id === 'negotiate'
          ? 'policy'
          : request.id === 'reform'
          ? 'republic'
          : 'clinic',
      );
      setValue(
        String(request.id === 'tax' ? world.taxRate : world.fuelSubsidy),
      );
    }
  }, [request, regionId, world.taxRate, world.fuelSubsidy]);
  const definition = DECISIONS.find(d => d.id === id)!;
  const command: Command = { id, targetId, option, value: Number(value) };
  const preview = getDecisionPreview(world, command);
  const targets = getTargets(world, id);
  return (
    <>
      <Text style={styles.heading}>
        {browsing ? 'Political actions' : definition.label}
      </Text>
      <Text style={styles.small}>
        Political capital {world.movement.influence}/100
      </Text>
      <Button
        quiet
        onPress={() => {
          setBrowsing(!browsing);
          onNavigate();
        }}
      >
        {browsing ? 'Return to decision' : 'Choose another action'}
      </Button>
      {!browsing ? (
        <>
          <View style={styles.confirm}>
            <Label>YOUR DECISION</Label>
            <Text style={styles.small}>{definition.description}</Text>
            {targets.length ? (
              <>
                <Button
                  quiet
                  onPress={() => setChoosingTarget(!choosingTarget)}
                >
                  {targets.find(t => t.id === targetId)?.name ??
                    `Choose ${definition.target}`}{' '}
                  · Change
                </Button>
                {choosingTarget ? (
                  <View style={styles.wrap}>
                    {targets.map(t => (
                      <Pressable
                        key={t.id}
                        onPress={() => {
                          setTargetId(t.id);
                          setChoosingTarget(false);
                        }}
                        style={[
                          styles.chip,
                          t.id === targetId && styles.chipActive,
                        ]}
                      >
                        <Text style={styles.small}>{t.name}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </>
            ) : definition.target !== 'none' ? (
              <Text style={styles.small}>
                No eligible {definition.target} currently exists.
              </Text>
            ) : null}
            {id === 'project' || id === 'promise' ? (
              <View style={styles.wrap}>
                {(Object.keys(PROJECTS) as ProjectKind[]).map(k => (
                  <Pressable
                    key={k}
                    onPress={() => setOption(k)}
                    style={[styles.chip, option === k && styles.chipActive]}
                  >
                    <Text style={styles.small}>{PROJECTS[k].label}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {id === 'negotiate' ? (
              <View style={styles.wrap}>
                {[
                  'policy',
                  'portfolio',
                  'funding',
                  'endorsement',
                  'counteroffer',
                ].map(k => (
                  <Button
                    key={k}
                    quiet={option !== k}
                    onPress={() => setOption(k)}
                  >
                    {k}
                  </Button>
                ))}
              </View>
            ) : null}
            {id === 'reform' ? (
              <View style={styles.wrap}>
                {['republic', 'monarchy', 'autocracy'].map(k => (
                  <Button
                    key={k}
                    quiet={option !== k}
                    onPress={() => setOption(k)}
                  >
                    {k}
                  </Button>
                ))}
              </View>
            ) : null}
            {id === 'tax' || id === 'subsidy' ? (
              <>
                <Text style={styles.small}>
                  New level: {id === 'tax' ? '0–50' : '0–100'}%
                </Text>
                <TextInput
                  accessibilityLabel="Policy level"
                  value={value}
                  onChangeText={v => setValue(v.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  style={styles.input}
                />
              </>
            ) : null}
            <Text style={styles.metric}>
              {preview.account === 'movement' ? 'Movement funds' : 'Treasury'}{' '}
              {preview.cost} · Political capital {preview.influence}
            </Text>
            {preview.consequences.map((c, i) => (
              <Text key={i} style={styles.small}>
                • {c}
              </Text>
            ))}
            {preview.dueDay ? (
              <Text style={styles.small}>
                Expected delivery: {formatDate(preview.dueDay)}
              </Text>
            ) : null}
            {preview.reason ? (
              <Text style={styles.danger}>{preview.reason}</Text>
            ) : null}
            <Button
              disabled={!preview.allowed}
              onPress={() =>
                onAct({ ...command, clientId: `local-${world.revision}-${id}` })
              }
            >
              Commit decision
            </Button>
          </View>
        </>
      ) : (
        <>
          <Label>ALL POLITICAL ACTIONS</Label>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.wrap}>
              {[
                'all',
                'movement',
                'government',
                'economy',
                'power',
                'diplomacy',
              ].map(c => (
                <Pressable
                  key={c}
                  onPress={() => setCategory(c)}
                  style={[styles.chip, category === c && styles.chipActive]}
                >
                  <Text style={styles.small}>{c}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
          {DECISIONS.filter(
            d =>
              d.id !== 'retire' &&
              (category === 'all' || d.category === category),
          ).map(d => (
            <Pressable
              key={d.id}
              onPress={() => {
                setBrowsing(false);
                setChoosingTarget(false);
                onNavigate();
                setId(d.id);
                setTargetId(
                  getTargets(world, d.id).find(t => t.id === regionId)?.id ??
                    getTargets(world, d.id)[0]?.id ??
                    '',
                );
                setOption(
                  d.id === 'negotiate'
                    ? 'policy'
                    : d.id === 'reform'
                    ? 'republic'
                    : 'clinic',
                );
                setValue(
                  String(d.id === 'tax' ? world.taxRate : world.fuelSubsidy),
                );
              }}
              style={[styles.action, d.id === id && styles.chosen]}
            >
              <Text style={styles.rowTitle}>{d.label}</Text>
              {d.id === id ? (
                <Text style={styles.small}>{d.description}</Text>
              ) : null}
              {d.government && world.role !== 'government' ? (
                <Text style={styles.muted}>Requires executive office</Text>
              ) : null}
            </Pressable>
          ))}
        </>
      )}
    </>
  );
}
function OnlinePanel({
  world,
  onUpdate,
  onNotice,
}: {
  world: WorldState;
  onUpdate: (s: WorldState) => void;
  onNotice: (s: string) => void;
}) {
  const [connected, setConnected] = useState(false);
  const [alias, setAlias] = useState('');
  const [recovery, setRecovery] = useState('');
  const [newCode, setNewCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [countries, setCountries] = useState<SharedCountry[]>([]);
  const [cloudCareers, setCloudCareers] = useState<CloudCareer[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [orders, setOrders] = useState<SharedOrder[]>([]);
  const [kind, setKind] = useState<
    'trade' | 'aid' | 'alliance' | 'sanction' | 'vote' | 'dispute'
  >('trade');
  const [amount, setAmount] = useState('100');
  useEffect(() => {
    cloud
      .connected()
      .then(setConnected)
      .catch(() => setConnected(false));
  }, []);
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await action();
    } catch (e) {
      onNotice(
        e instanceof Error
          ? e.message
          : 'The server is unavailable. Offline play remains available.',
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Text style={styles.heading}>A world beyond your own</Text>
      <Text style={styles.body}>
        Run your country offline. Connect for asynchronous diplomacy with other
        players.
      </Text>
      <Text style={styles.small}>
        Incoming disputes wait for your return. No unattended conquest. Cloud
        play is optional.
      </Text>
      {busy ? <ActivityIndicator color="#e5cb8c" /> : null}
      {!connected ? (
        <>
          <Label>CREATE A GUEST IDENTITY</Label>
          <TextInput
            accessibilityLabel="Public alias"
            value={alias}
            onChangeText={setAlias}
            placeholder="Public alias"
            placeholderTextColor="#8a9b92"
            maxLength={24}
            style={styles.input}
          />
          <Button
            disabled={busy || alias.trim().length < 3}
            onPress={() =>
              run(async () => {
                const code = await cloud.register(alias.trim());
                setNewCode(code);
                setConnected(true);
              })
            }
          >
            Create connected identity
          </Button>
          <Label>RESTORE AN IDENTITY</Label>
          <TextInput
            accessibilityLabel="Recovery code"
            value={recovery}
            onChangeText={setRecovery}
            placeholder="Recovery code"
            placeholderTextColor="#8a9b92"
            autoCapitalize="none"
            style={styles.input}
          />
          <Button
            quiet
            disabled={busy || recovery.length < 16}
            onPress={() =>
              run(async () => {
                await cloud.recover(recovery.trim());
                setConnected(true);
              })
            }
          >
            Restore identity
          </Button>
        </>
      ) : (
        <>
          {newCode ? (
            <View style={styles.issue}>
              <Label>KEEP YOUR RECOVERY CODE</Label>
              <Text selectable style={styles.body}>
                {newCode}
              </Text>
              <Text style={styles.small}>
                Store it privately. It restores your identity on another device.
              </Text>
            </View>
          ) : null}
          <Button
            disabled={busy}
            onPress={() =>
              run(async () => {
                const result = await cloud.sync(world);
                onUpdate(result.career);
                onNotice(
                  'Cloud synchronized. Incoming settlements are recorded in your chronicle.',
                );
              })
            }
          >
            Synchronize this career
          </Button>
          <Button
            quiet
            disabled={busy}
            onPress={() =>
              run(async () => {
                await cloud.join(world.id);
                setCountries(await cloud.countries());
                setOrders(await cloud.orders(world.id));
                onNotice('Connected countries refreshed.');
              })
            }
          >
            Join / refresh the connected world
          </Button>
          <Label>DIPLOMATIC TERMS</Label>
          <Button
            quiet
            disabled={busy}
            onPress={() =>
              run(async () => {
                setCloudCareers(await cloud.careers());
                setDevices(await cloud.devices());
              })
            }
          >
            Cloud careers and devices
          </Button>
          {cloudCareers.map(c => (
            <View key={c.id} style={styles.row}>
              <Text style={styles.rowTitle}>
                {c.name} · {formatDate(Number(c.day))}
              </Text>
              <Button
                quiet
                disabled={busy}
                onPress={() =>
                  run(async () => {
                    onUpdate(await cloud.restore(c.id, world));
                    onNotice(
                      'Cloud career restored. Any different local progress is preserved in the career archive as a playable local branch.',
                    );
                  })
                }
              >
                Restore cloud copy
              </Button>
            </View>
          ))}
          {devices
            .filter(d => !d.revoked_at)
            .map(d => (
              <Row
                key={d.id}
                title={`Device ${d.id.slice(0, 8)}`}
                detail={`Registered ${new Date(
                  d.created_at,
                ).toLocaleDateString()} · Tap to revoke`}
                onPress={() =>
                  run(async () => {
                    await cloud.revoke(d.id);
                    setDevices(await cloud.devices().catch(() => []));
                    setConnected(await cloud.connected());
                  })
                }
              />
            ))}
          <Button
            quiet
            disabled={busy}
            onPress={() =>
              run(async () => {
                const v = await artifactUpdates.check();
                onUpdate(
                  await cloud.upgrade(
                    world,
                    v.content.version,
                    v.policy.version,
                  ),
                );
                onNotice('Signed updates adopted at this paused checkpoint.');
              })
            }
          >
            Adopt verified updates
          </Button>
          <Button
            quiet
            disabled={busy}
            onPress={() =>
              run(async () => {
                const v = await artifactUpdates.values(true);
                onUpdate(
                  await cloud.upgrade(
                    world,
                    v.content.version,
                    v.policy.version,
                  ),
                );
                onNotice(
                  'Previous content and opponent rules restored at this checkpoint.',
                );
              })
            }
          >
            Restore previous rules
          </Button>
          <View style={styles.wrap}>
            {(
              [
                'trade',
                'aid',
                'alliance',
                'sanction',
                'vote',
                'dispute',
              ] as const
            ).map(k => (
              <Button key={k} quiet={kind !== k} onPress={() => setKind(k)}>
                {k}
              </Button>
            ))}
          </View>
          <Text style={styles.small}>
            Offer amount (trade or aid, 1–500 credits)
          </Text>
          <TextInput
            accessibilityLabel="Diplomatic amount"
            value={amount}
            onChangeText={v => setAmount(v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            style={styles.input}
          />
          {countries
            .filter(c => c.id !== world.id)
            .map(c => (
              <View key={c.id} style={styles.row}>
                <Text style={styles.rowTitle}>{c.countryName}</Text>
                <Text style={styles.small}>
                  {c.name} · {c.government}
                </Text>
                <Button
                  quiet
                  disabled={busy}
                  onPress={() =>
                    run(async () => {
                      const prepared = await cloud.prepareOffer(world);
                      onUpdate(prepared);
                      const settled = await cloud.offer(
                        prepared,
                        c.id,
                        kind,
                        Number(amount),
                      );
                      onUpdate(settled.career);
                      setOrders(await cloud.orders(world.id));
                      onNotice(
                        'Offer recorded. Synchronize before returning to domestic play.',
                      );
                    })
                  }
                >
                  Send {kind} proposal
                </Button>
              </View>
            ))}
          <Label>OFFERS AND DISPUTES</Label>
          {orders.length === 0 ? (
            <Text style={styles.small}>
              No diplomatic orders yet. Connect another country to exchange
              offers.
            </Text>
          ) : (
            orders.map(o => (
              <View key={o.id} style={styles.row}>
                <Text style={styles.rowTitle}>
                  {o.kind} · {o.amount} credits
                </Text>
                <Text style={styles.small}>
                  {o.status} ·{' '}
                  {o.to_career === world.id ? 'Incoming' : 'Outgoing'}
                </Text>
                {o.status === 'pending' && o.to_career === world.id ? (
                  <View style={styles.wrap}>
                    <Button
                      disabled={busy}
                      onPress={() =>
                        run(async () => {
                          await cloud.respond(o.id, true);
                          setOrders(await cloud.orders(world.id));
                        })
                      }
                    >
                      Accept
                    </Button>
                    <Button
                      quiet
                      disabled={busy}
                      onPress={() =>
                        run(async () => {
                          await cloud.respond(o.id, false);
                          setOrders(await cloud.orders(world.id));
                        })
                      }
                    >
                      Decline
                    </Button>
                  </View>
                ) : null}
              </View>
            ))
          )}
          <Button
            quiet
            disabled={busy}
            onPress={() =>
              run(async () => {
                await cloud.disconnect();
                setConnected(false);
              })
            }
          >
            Disconnect this device
          </Button>
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#12252a' },
  center: { alignItems: 'center', justifyContent: 'center', gap: 15 },
  flex: { flex: 1 },
  main: { flex: 1, flexDirection: 'row' },
  topbar: {
    height: 62,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 20,
    backgroundColor: '#13292d',
    borderBottomColor: '#45564e',
    borderBottomWidth: 1,
  },
  brand: { flex: 1 },
  country: {
    fontSize: 20,
    color: '#f1e5c9',
    letterSpacing: 2,
    fontWeight: '800',
  },
  eyebrow: { fontSize: 8, color: '#9aaca0', letterSpacing: 1.1, marginTop: 3 },
  topMetric: { minWidth: 70 },
  topValue: { color: '#f0dfb4', fontSize: 19, fontWeight: '600', marginTop: 3 },
  time: { alignItems: 'flex-end' },
  date: { color: '#c9d4c7', fontSize: 10 },
  timeButtons: { flexDirection: 'row', gap: 4, marginTop: 5 },
  timeButton: {
    minWidth: 32,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    backgroundColor: '#253e3e',
  },
  timeActive: { backgroundColor: '#d8c38f' },
  timeText: { color: '#c6d5c8', fontWeight: '800', fontSize: 12 },
  timeActiveText: { color: '#1e3435' },
  worldColumn: { flex: 1 },
  inspector: {
    width: 310,
    backgroundColor: '#172e32',
    borderLeftWidth: 1,
    borderLeftColor: '#536153',
  },
  panelHeader: {
    height: 38,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#354d49',
  },
  saveLabel: { fontSize: 8, color: '#a6beab' },
  panelContent: { padding: 16, gap: 12, paddingBottom: 36 },
  label: {
    fontSize: 9,
    color: '#c6b485',
    letterSpacing: 1.4,
    fontWeight: '800',
  },
  heading: {
    fontFamily: 'serif',
    fontSize: 26,
    lineHeight: 30,
    color: '#f1e3c9',
  },
  subheading: {
    fontSize: 17,
    color: '#eedebd',
    fontWeight: '700',
    marginTop: 8,
  },
  body: { fontSize: 12, lineHeight: 18, color: '#ccd4c7' },
  small: { fontSize: 10, lineHeight: 15, color: '#aabbb0' },
  muted: { fontSize: 9, color: '#879c92', marginTop: 3 },
  button: {
    minHeight: 39,
    backgroundColor: '#deca98',
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 11, color: '#173033', fontWeight: '800' },
  quiet: { backgroundColor: '#2b4441', borderWidth: 1, borderColor: '#536459' },
  quietText: { color: '#e1d8bd' },
  disabled: { opacity: 0.38 },
  pressed: { opacity: 0.75 },
  between: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  meterRow: { gap: 6, marginBottom: 4 },
  metric: { color: '#dccb9d', fontSize: 12, fontWeight: '700' },
  track: {
    height: 4,
    backgroundColor: '#304641',
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: { height: 4, borderRadius: 3 },
  row: {
    borderBottomWidth: 1,
    borderBottomColor: '#344b47',
    paddingVertical: 11,
    gap: 5,
  },
  rowTitle: { color: '#e7ddc4', fontSize: 12, fontWeight: '700' },
  issue: {
    borderLeftWidth: 2,
    borderLeftColor: '#dc9978',
    backgroundColor: '#303c35',
    padding: 12,
    gap: 8,
    borderRadius: 4,
  },
  person: {
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#3c514a',
  },
  personHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  quote: {
    fontFamily: 'serif',
    color: '#daceb1',
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  memory: { fontSize: 9, lineHeight: 14, color: '#c4b88d' },
  bigNumber: { fontFamily: 'serif', fontSize: 40, color: '#e4cd96' },
  danger: { fontSize: 11, color: '#efa88a', lineHeight: 16 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    padding: 8,
    borderRadius: 5,
    backgroundColor: '#203c3d',
    borderWidth: 1,
    borderColor: '#41574e',
  },
  chipActive: { borderColor: '#d8be83', backgroundColor: '#3b4d41' },
  action: {
    paddingVertical: 10,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: '#334e47',
    borderRadius: 5,
    gap: 5,
  },
  chosen: { borderColor: '#c9ae74', backgroundColor: '#2f433b' },
  confirm: {
    borderTopWidth: 2,
    borderTopColor: '#c4aa74',
    paddingTop: 16,
    gap: 12,
    marginTop: 8,
  },
  input: {
    minHeight: 40,
    color: '#f2e1bf',
    backgroundColor: '#10262c',
    borderWidth: 1,
    borderColor: '#4d6559',
    borderRadius: 5,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  dispatch: {
    height: 55,
    backgroundColor: '#172b2d',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 12,
    borderTopColor: '#4b5a4e',
    borderTopWidth: 1,
  },
  dispatchTag: {
    fontSize: 8,
    letterSpacing: 1.3,
    fontWeight: '800',
    color: '#d2b985',
  },
  dispatchTitle: { fontFamily: 'serif', color: '#e9ddbf', fontSize: 14 },
  dispatchDetail: { color: '#91a69b', fontSize: 9, marginTop: 3 },
  dispatchArrow: { color: '#cdb789', fontSize: 20 },
  notice: {
    minHeight: 26,
    backgroundColor: '#465343',
    paddingHorizontal: 15,
    paddingVertical: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  noticeText: { color: '#f1e4c3', fontSize: 10, flexShrink: 1 },
  nav: {
    flexGrow: 0,
    height: 44,
    maxHeight: 44,
    backgroundColor: '#10272c',
    borderTopWidth: 1,
    borderTopColor: '#3c534c',
  },
  navContent: { paddingHorizontal: 9, gap: 3, alignItems: 'center' },
  navItem: {
    height: 38,
    paddingHorizontal: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  navSelected: { borderBottomColor: '#d5bb83' },
  navText: { fontSize: 10, fontWeight: '700', color: '#91a99e' },
  navTextSelected: { color: '#ead6a9' },
  homeScene: { flex: 1 },
  homePanel: { width: 330, backgroundColor: '#172e32' },
  homeContent: { padding: 28, gap: 17, paddingBottom: 45 },
  hero: {
    position: 'absolute',
    top: 20,
    left: 24,
    right: 20,
    padding: 20,
    backgroundColor: '#142a2bdb',
    borderLeftWidth: 2,
    borderLeftColor: '#d3bc80',
  },
  heroKicker: { fontSize: 9, letterSpacing: 2, color: '#c5b78b' },
  heroTitle: {
    fontFamily: 'serif',
    fontSize: 34,
    lineHeight: 39,
    color: '#f1e3c6',
    marginTop: 12,
  },
  heroSubtitle: { fontSize: 11, color: '#c8cebb', marginTop: 12 },
  homeRule: { height: 1, backgroundColor: '#46584e', marginVertical: 5 },
  footnote: { fontSize: 8, letterSpacing: 1, color: '#809b8c' },
  choice: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#42584e',
    borderRadius: 6,
    gap: 5,
  },
});
