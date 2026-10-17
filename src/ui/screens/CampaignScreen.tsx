import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Alert, Animated, BackHandler, Pressable, StyleSheet, Text, Vibration, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ActionDefinition, ActionInput, AppSettings, GameState, HistoricalRecord, ImpactTiming, MetricChange, MetricImpact, TurnReport} from '../../game/types';
import {getCampaignClock, formatCampaignMoment} from '../../game/campaignClock';
import {concedeCampaign, forecastAction, getLegalActions, processTurn, SimulationError} from '../../game/engine';
import {campaignHealth, closestRegions, formatPercent, formatResource, projectedElectoralVotes} from '../../game/selectors';
import {MODE_COPY} from '../../game/scenarios';
import {canUseWorldAction} from '../../game/world';
import {saveCampaign, unlockAchievements} from '../../services/storage';
import {flushAnalytics, flushExperiences, queueAnalytics, queueExperience} from '../../services/telemetry';
import {advertising} from '../../services/ads';
import {modelPolicy} from '../../services/modelPolicy';
import {playWorldCue, setWorldAmbience} from '../../services/worldAudio';
import {colors, radius, spacing} from '../theme';
import {Card, GhostButton, Meter, PrimaryButton, ScreenContainer, SectionTitle, StatPill, TopBar, type} from '../components/Layout';
import {RegionalGrid, StrategicMap} from '../components/StrategicMap';

type CampaignView = 'brief' | 'map' | 'decisions' | 'actors' | 'more' | 'history' | 'finance' | 'intelligence' | 'statistics' | 'resolution';

export function CampaignScreen({state, settings, onChange, onExit}: {state: GameState; settings: AppSettings; onChange: (state: GameState) => void; onExit: () => void}) {
  const hasUnreadReport = Boolean(state.lastTurnReport && state.lastAcknowledgedReportId !== state.lastTurnReport.id);
  const [view, setView] = useState<CampaignView>(hasUnreadReport ? 'resolution' : state.status === 'active' ? 'brief' : 'statistics');
  const [busy, setBusy] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);
  const submittingRef = useRef(false);
  const acknowledgingRef = useRef(false);
  const leaveCampaign = useCallback(async () => {
    if (state.status !== 'active') await advertising.showAtNaturalTransition();
    onExit();
  }, [onExit, state.status]);
  useEffect(() => {
    setWorldAmbience(settings.sound && state.mode === 'grand_campaign');
    return () => setWorldAmbience(false);
  }, [settings.sound, state.mode]);
  const acknowledgeReport = useCallback(async (naturalTransition: boolean) => {
    if (acknowledgingRef.current) return;
    const report = state.lastTurnReport;
    if (!report) return;
    acknowledgingRef.current = true;
    setAcknowledging(true);
    try {
      const acknowledged = {...state, lastAcknowledgedReportId: report.id};
      onChange(acknowledged);
      await saveCampaign(acknowledged);
      if (naturalTransition && report.phaseChanged) await advertising.showAtNaturalTransition().catch(() => false);
      if (acknowledged.status !== 'active') setView('statistics');
      else if (acknowledged.pendingEvent) setView('decisions');
      else setView('brief');
    } finally {
      acknowledgingRef.current = false;
      setAcknowledging(false);
    }
  }, [onChange, state]);
  const navigateBack = useCallback(() => {
    if (view === 'resolution') {
      acknowledgeReport(false).catch(() => setView(state.status === 'active' ? 'brief' : 'statistics'));
      return true;
    }
    if (state.status !== 'active') { leaveCampaign().catch(onExit); return true; }
    if (view === 'history' || view === 'finance' || view === 'intelligence' || view === 'statistics') setView('more');
    else if (view !== 'brief') setView('brief');
    else onExit();
    return true;
  }, [acknowledgeReport, leaveCampaign, onExit, state.status, view]);
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', navigateBack);
    return () => subscription.remove();
  }, [navigateBack]);
  const submit = async (input: ActionInput) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setBusy(true);
    try {
      const directive = await modelPolicy.infer(state);
      const turn = processTurn(state, input, directive);
      onChange(turn.state);
      setView('resolution');
      const breakingNews = turn.state.world?.news.find(item => item.severity !== 'brief' && !state.world?.news.some(previous => previous.id === item.id));
      const breakingEvent = turn.report.event;
      if (breakingEvent) {
        if (turn.state.mode === 'grand_campaign') playWorldCue('breaking_news.wav', settings.sound);
        Alert.alert(`BREAKING NEWS · ${breakingEvent.severity.toUpperCase()}`, `${breakingEvent.title}\n\n${breakingEvent.narrative}`, [{text: 'Read the turn briefing'}]);
      } else if (breakingNews) {
        const conflict = /war|front|occup|uprising|assault|invasion|clash/i.test(breakingNews.headline);
        playWorldCue(conflict ? 'war_horn.wav' : 'breaking_news.wav', settings.sound);
        Alert.alert(breakingNews.severity === 'crisis' ? 'WORLD CRISIS' : 'WORLD PRESSURE', `${breakingNews.headline}\n\n${breakingNews.detail}`, [{text: 'Read the turn briefing'}]);
      }
      if (settings.haptics) Vibration.vibrate(turn.report.event || turn.report.result ? 30 : 16);
      await Promise.all([
        saveCampaign(turn.state), queueExperience(turn.experience, settings), unlockAchievements(turn.state),
        queueAnalytics({schemaVersion: 1, event: 'turn_complete', occurredAt: new Date().toISOString(), mode: turn.state.mode, difficulty: turn.state.difficulty, value: turn.state.turn}, settings),
      ]);
      await Promise.all([flushExperiences(settings), flushAnalytics(settings)]);
      if (turn.state.status !== 'active') {
        await queueAnalytics({schemaVersion: 1, event: 'campaign_complete', occurredAt: new Date().toISOString(), mode: turn.state.mode, difficulty: turn.state.difficulty, value: turn.state.result?.score}, settings);
      }
    } catch (error) {
      Alert.alert('Action unavailable', error instanceof SimulationError || error instanceof Error ? error.message : 'The action could not be resolved.');
    } finally { submittingRef.current = false; setBusy(false); }
  };
  const end = () => Alert.alert('Concede campaign?', 'The current political contest will end, but its final state remains in your campaign archive.', [
    {text: 'Continue playing', style: 'cancel'}, {text: 'Concede', style: 'destructive', onPress: async () => { const next = concedeCampaign(state); onChange(next); await saveCampaign(next); setView('statistics'); }},
  ]);
  const body = view === 'resolution' && state.lastTurnReport ? <TurnBriefing state={state} report={state.lastTurnReport} settings={settings} busy={busy || acknowledging} onContinue={() => acknowledgeReport(true).catch(error => Alert.alert('Save failed', error instanceof Error ? error.message : 'The briefing could not be closed safely.'))} /> : state.status !== 'active' || view === 'statistics' ? <Results state={state} onExit={state.status === 'active' ? navigateBack : leaveCampaign} /> : view === 'brief' ? <Dashboard state={state} onNavigate={setView} /> : view === 'map' ? state.mode === 'grand_campaign' ? <WorldMapView state={state} onNavigate={setView} /> : <MapView state={state} /> : view === 'decisions' ? <ActionCenter state={state} busy={busy} onSubmit={submit} /> : view === 'actors' ? <PoliticalNetwork state={state} /> : view === 'history' ? <History state={state} /> : view === 'finance' ? <Finance state={state} /> : view === 'intelligence' ? <Intelligence state={state} /> : <More state={state} onNavigate={setView} onSave={() => saveCampaign(state).then(() => Alert.alert('Campaign saved', 'The committed turn was saved with an integrity check.'))} onConcede={end} onExit={onExit} />;
  const clock = getCampaignClock(state.mode, state.turn, state.maxTurns);
  const subtitle = view === 'resolution' && state.lastTurnReport ? `${state.lastTurnReport.timeLabel} report · ${state.lastTurnReport.phaseBefore}` : `${clock.periodLabel} · ${state.phase}`;
  return (
    <>
      <TopBar title={state.scenarioName} subtitle={subtitle} onBack={navigateBack} right={<View style={styles.autosave}><View style={styles.autosaveDot} /><Text style={styles.autosaveText}>AUTO</Text></View>} />
      <View style={styles.flex}>{body}</View>
      {state.status === 'active' && view !== 'resolution' ? <CampaignNav active={view} mode={state.mode} onChange={setView} /> : null}
    </>
  );
}

function CampaignNav({active, mode, onChange}: {active: CampaignView; mode: GameState['mode']; onChange: (view: CampaignView) => void}) {
  const insets = useSafeAreaInsets();
  const items: Array<[CampaignView, string, string]> = [['brief', '◫', 'Brief'], ['map', '⌁', mode === 'grand_campaign' ? 'World' : 'Map'], ['decisions', '✦', 'Decide'], ['actors', '◎', 'Actors'], ['more', '•••', 'More']];
  return <View style={[styles.nav, {height: 68 + insets.bottom, paddingBottom: Math.max(insets.bottom, 4)}]}>{items.map(([id, icon, label]) => <Pressable accessibilityRole="tab" accessibilityState={{selected: active === id}} key={id} onPress={() => onChange(id)} style={styles.navItem}><Text style={[styles.navIcon, active === id && styles.navActive]}>{icon}</Text><Text style={[styles.navLabel, active === id && styles.navActive]}>{label}</Text></Pressable>)}</View>;
}

function Dashboard({state, onNavigate}: {state: GameState; onNavigate: (view: CampaignView) => void}) {
  const latest = [...state.history].reverse().slice(0, 3);
  const health = campaignHealth(state);
  const report = state.lastTurnReport;
  const drivers = report ? report.sections.flatMap(section => section.impacts.map(impact => ({...impact, source: section.title}))).sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).slice(0, 3) : [];
  return <ScreenContainer>
    <CampaignClockCard state={state} />
    {state.pendingEvent ? <Pressable onPress={() => onNavigate('decisions')} style={styles.eventBanner}><View><Text style={styles.eventKicker}>{state.pendingEvent.severity.toUpperCase()}</Text><Text style={styles.eventTitle}>{state.pendingEvent.title}</Text><Text numberOfLines={2} style={styles.eventText}>{state.pendingEvent.narrative}</Text></View><Text style={styles.chevron}>›</Text></Pressable> : null}
    {state.world?.news[0] ? <Pressable onPress={() => onNavigate('map')} style={[styles.eventBanner, state.world.news[0].severity === 'crisis' && styles.newsCrisis]}><View><Text style={styles.eventKicker}>WORLD DISPATCH · YEAR {state.world.news[0].year}</Text><Text style={styles.eventTitle}>{state.world.news[0].headline}</Text><Text numberOfLines={2} style={styles.eventText}>{state.world.news[0].detail}</Text></View><Text style={styles.chevron}>›</Text></Pressable> : null}
    <View style={styles.statRow}><StatPill label="Legitimacy" value={formatPercent(state.legitimacy)} tone={state.legitimacy >= 5200 ? 'good' : 'warning'} /><StatPill label="Treasury" value={formatResource(state.treasury)} /><StatPill label="Momentum" value={formatPercent(state.momentum)} /></View>
    {state.mode === 'presidential' ? <Card style={styles.projectionCard}><View style={styles.projectionRow}><View><Text style={type.label}>ELECTORAL PROJECTION</Text><Text style={styles.projection}>{projectedElectoralVotes(state)}<Text style={styles.projectionTarget}> / 270</Text></Text></View><View style={styles.raceBadge}><Text style={styles.raceBadgeText}>{projectedElectoralVotes(state) >= 270 ? 'LEADING' : 'PATH OPEN'}</Text></View></View><Meter value={Math.min(10000, projectedElectoralVotes(state) / 270 * 10000)} /></Card> : <Card style={styles.projectionCard}><Text style={type.label}>COALITION HEALTH</Text><Text style={styles.projection}>{formatPercent(health)}</Text><Meter value={health} color={health >= 5000 ? colors.teal : colors.red} /></Card>}
    {report ? <Card style={styles.recapCard}><View style={styles.projectionRow}><View><Text style={type.label}>SINCE {report.timeLabel.toUpperCase()}</Text><Text style={styles.rowTitle}>{report.actionLabel}{report.targetName ? ` · ${report.targetName}` : ''}</Text></View><Text style={[styles.recapMomentum, report.momentum.delta >= 0 ? styles.positive : styles.negative]}>{signedPoints(report.momentum.delta)} momentum</Text></View>{drivers.map(driver => <ImpactLine key={`${driver.path}-${driver.targetId ?? ''}-${driver.source}`} state={state} impact={driver} compact source={driver.source} />)}{state.scheduledEffects.length ? <Pressable onPress={() => onNavigate('history')}><Text style={styles.pendingLink}>{state.scheduledEffects.length} pending consequence{state.scheduledEffects.length === 1 ? '' : 's'} · view timeline</Text></Pressable> : null}</Card> : null}
    <SectionTitle aside="Most competitive">Strategic pressure</SectionTitle>
    {closestRegions(state, 3).map(region => <Pressable key={region.id} onPress={() => onNavigate('map')} style={styles.listRow}><View style={styles.regionBadge}><Text style={styles.regionBadgeText}>{region.abbreviation}</Text></View><View style={styles.rowCopy}><Text style={styles.rowTitle}>{region.name}</Text><Text style={type.small}>{region.issue}</Text></View><View style={styles.alignRight}><Text style={styles.rowValue}>{formatPercent(region.support)}</Text><Text style={type.small}>{region.electoralVotes ? `${region.electoralVotes} EV` : 'support'}</Text></View></Pressable>)}
    <SectionTitle aside="Cause and consequence">Latest intelligence</SectionTitle>
    {latest.map(item => <Card key={item.id}><Text style={styles.historyKind}>{(item.timing ?? item.kind).toUpperCase()} · {item.turn > 0 ? formatCampaignMoment(state.mode, item.turn).toUpperCase() : 'OPENING'}</Text><Text style={styles.rowTitle}>{item.title}</Text><Text style={type.small}>{item.detail}</Text></Card>)}
    <PrimaryButton label={state.pendingEvent ? 'Resolve the active crisis' : 'Review strategic actions'} onPress={() => onNavigate('decisions')} />
  </ScreenContainer>;
}

function MapView({state}: {state: GameState}) {
  return <ScreenContainer><Text style={type.title}>{state.mode === 'presidential' ? 'The electoral map' : 'Regional influence'}</Text><Text style={type.subtitle}>{state.mode === 'presidential' ? 'Fictional support combines starting conditions, campaign investment, national momentum, turnout, rival strategy, and seeded uncertainty.' : 'Regional stability reflects coalition support, public confidence, investment, and local political priorities.'}</Text>{state.mode === 'presidential' ? <StrategicMap state={state} /> : <RegionalGrid state={state} />}</ScreenContainer>;
}

function WorldMapView({state, onNavigate}: {state: GameState; onNavigate: (view: CampaignView) => void}) {
  const world = state.world;
  if (!world) return <ScreenContainer><Text style={type.title}>World record unavailable</Text></ScreenContainer>;
  const owned = world.territories.filter(item => item.ownerId === world.playerNationId).length;
  const playerName = world.nations.find(item => item.player)?.name ?? 'Orinth';
  return <ScreenContainer>
    <Text style={type.title}>The living world</Text>
    <Text style={type.subtitle}>A century of shifting borders, rival governments, trade, and war. Neighbor states act between your decisions; occupied land can be liberated.</Text>
    <View style={styles.statRow}><StatPill label="Year" value={`${world.year} / 120`} /><StatPill label="Territories" value={`${owned} / ${world.territories.length}`} tone={owned >= 7 ? 'good' : 'neutral'} /><StatPill label="Army readiness" value={formatPercent(world.army)} tone={world.army < 3000 ? 'warning' : 'neutral'} /></View>
    <SectionTitle aside="Relations, power, and active treaties">Foreign powers</SectionTitle>
    {world.nations.filter(nation => !nation.player).map(nation => <Card key={nation.id}><View style={styles.projectionRow}><View><Text style={styles.rowTitle}>{nation.name}</Text><Text style={type.small}>{nation.atWar ? 'AT WAR WITH ORINTH' : nation.allied ? 'MUTUAL DEFENSE ALLY' : nation.pactIds?.length ? `REGIONAL PACT · ${nation.pactIds.map(id => world.nations.find(item => item.id === id)?.name ?? id).join(', ')}` : nation.relation < -35 ? 'HOSTILE' : nation.relation > 35 ? 'FRIENDLY' : 'UNALIGNED'} · Power {formatPercent(nation.power)}</Text></View><Text style={[styles.rowValue, nation.relation < -20 ? styles.risk : styles.positive]}>{nation.relation > 0 ? '+' : ''}{nation.relation}</Text></View><Meter value={nation.power} color={nation.atWar ? colors.red : nation.allied ? colors.teal : colors.gold} /></Card>)}
    <SectionTitle aside="Strategic resources and local resistance">Territorial control</SectionTitle>
    {world.territories.map(land => {
      const owner = world.nations.find(nation => nation.id === land.ownerId);
      const isPlayer = land.ownerId === world.playerNationId;
      return <Card key={land.id} style={isPlayer ? styles.territoryOwned : land.formerPlayerLand ? styles.territoryOccupied : undefined}><View style={styles.projectionRow}><View><Text style={styles.rowTitle}>{land.name}</Text><Text style={type.small}>{owner?.name ?? 'Unknown power'} · resource: {land.resource}</Text></View><Text style={styles.rowValue}>{isPlayer ? 'ORINTH' : land.formerPlayerLand ? 'OCCUPIED' : 'FOREIGN'}</Text></View>{isPlayer ? <><Metric label="Local unrest" value={land.unrest} color={land.unrest > 5000 ? colors.red : colors.teal} />{land.resistance > 0 ? <Metric label="Resistance network" value={land.resistance} color={colors.gold} /> : null}</> : land.formerPlayerLand ? <Metric label="Liberation network" value={land.resistance} color={colors.gold} /> : null}</Card>;
    })}
    <SectionTitle aside={`${world.wars.length} active`}>Wars and commercial deals</SectionTitle>
    {world.wars.map(war => {
      const attacker = world.nations.find(nation => nation.id === war.nationId)?.name ?? 'Unknown power';
      const rival = war.targetNationId ? world.nations.find(nation => nation.id === war.targetNationId)?.name ?? 'Unknown power' : undefined;
      return <Card key={war.id} style={styles.warCard}><Text style={styles.eventKicker}>{rival ? 'REGIONAL WAR' : 'ACTIVE WAR'} · YEAR {war.yearsActive + 1}</Text><Text style={styles.rowTitle}>{rival ? `${attacker} vs. ${rival}` : `Orinth vs. ${attacker}`}</Text><Text style={type.small}>Casualties recorded: {numberFormat(war.casualties)} · {rival ? 'Their conflict is reshaping borders and trade.' : 'Annual treasury and morale drain continues until peace.'}</Text></Card>;
    })}
    {world.deals.map(deal => <Card key={deal.id}><Text style={styles.historyKind}>{deal.kind.toUpperCase()} · {deal.yearsRemaining} YEARS LEFT</Text><Text style={styles.rowTitle}>{world.nations.find(nation => nation.id === deal.nationId)?.name}</Text><Text style={type.small}>Annual revenue {formatResource(deal.annualIncome)} · breach risk {Math.round(deal.breachRisk * 100)}%</Text></Card>)}
    {!world.wars.length && !world.deals.length ? <Card><Text style={type.small}>No active wars or commercial agreements. The world will continue to shift as time advances.</Text></Card> : null}
    <SectionTitle aside="Recent dispatches">World news</SectionTitle>
    {world.news.slice(0, 8).map(item => <Card key={item.id} style={item.severity === 'crisis' ? styles.newsCrisis : undefined}><Text style={styles.historyKind}>YEAR {item.year} · {item.severity.toUpperCase()}</Text><Text style={styles.rowTitle}>{item.headline}</Text><Text style={type.small}>{item.detail}</Text></Card>)}
    <PrimaryButton label="Open foreign-affairs decisions" onPress={() => onNavigate('decisions')} tone="dark" />
  </ScreenContainer>;
}

function numberFormat(value: number) { return new Intl.NumberFormat().format(value); }

function ActionCenter({state, busy, onSubmit}: {state: GameState; busy: boolean; onSubmit: (input: ActionInput) => void}) {
  const actions = getLegalActions(state);
  const [selected, setSelected] = useState<ActionDefinition | null>(null);
  const [targetId, setTargetId] = useState<string>();
  const targets = selected?.target === 'region' ? state.regions : selected?.target === 'faction' ? state.factions : selected?.target === 'actor' ? state.actors : selected?.target === 'institution' ? state.institutions : selected?.target === 'nation' ? (state.world?.nations.filter(item => !item.player) ?? []) : selected?.target === 'territory' ? (state.world?.territories ?? []) : [];
  const eligibleTargets = selected?.worldEffect ? targets.filter(target => canUseWorldAction(state, selected, target.id)) : targets;
  const choose = (action: ActionDefinition) => { setSelected(action); setTargetId(undefined); };
  return <ScreenContainer>
    <CampaignClockCard state={state} />
    <Text style={type.title}>{state.pendingEvent ? state.pendingEvent.title : 'Strategic decisions'}</Text>
    <Text style={type.subtitle}>{state.pendingEvent ? state.pendingEvent.narrative : 'One committed action advances the turn. Costs, beneficiaries, and delayed consequences remain part of the campaign history.'}</Text>
    <View style={styles.resourceStrip}><Text style={type.small}>Treasury <Text style={styles.inlineValue}>{formatResource(state.treasury)}</Text></Text><Text style={type.small}>Influence <Text style={styles.inlineValue}>{formatResource(state.influence)}</Text></Text></View>
    {actions.map(action => <Pressable disabled={busy} key={action.id} onPress={() => choose(action)} style={[styles.actionCard, selected?.id === action.id && styles.actionSelected]}><View style={styles.actionTop}><Text style={styles.actionCategory}>{action.category.toUpperCase()}</Text><Cost action={action} /></View><Text style={styles.actionTitle}>{action.label}</Text><Text style={type.small}>{action.description}</Text><EffectPreview state={state} action={action} /></Pressable>)}
    {selected ? <Card style={styles.targetPanel}>{selected.target !== 'none' ? <><Text style={styles.choiceHeading}>Choose {selected.target}</Text><Text style={[type.small, styles.spaceBottom]}>{selected.target === 'nation' ? 'Diplomatic terms depend on the current relationship and whether fighting is active.' : selected.target === 'territory' ? 'Front-line access, ownership, and resistance determine which operations are possible.' : 'The target changes who benefits and who remembers the decision.'}</Text><View style={styles.targetList}>{eligibleTargets.map(target => <GhostButton key={target.id} label={target.name} active={targetId === target.id} onPress={() => setTargetId(target.id)} />)}</View>{eligibleTargets.length === 0 ? <Text style={type.small}>No eligible targets right now. Resolve a war, improve relations, or wait for the front to change.</Text> : null}</> : <><Text style={styles.choiceHeading}>Confirm the decision</Text><Text style={type.small}>Committing advances the campaign clock and cannot be undone.</Text></>}<View style={styles.confirmForecast}><EffectPreview state={state} action={selected} targetId={targetId} detailed /></View><View style={styles.spaceTop}><PrimaryButton disabled={(selected.target !== 'none' && (!targetId || !eligibleTargets.some(target => target.id === targetId))) || busy} label={busy ? 'Resolving turn…' : `Commit: ${selected.label}`} onPress={() => onSubmit({id: selected.id, targetId})} /></View></Card> : null}
  </ScreenContainer>;
}

function Cost({action}: {action: ActionDefinition}) {
  const items = Object.entries(action.cost).filter(([, amount]) => amount);
  return <Text style={styles.cost}>{items.length ? items.map(([key, value]) => `${key.slice(0, 3).toUpperCase()} −${value}`).join('  ') : 'NO DIRECT COST'}</Text>;
}

function EffectPreview({state, action, targetId, detailed = false}: {state: GameState; action: ActionDefinition; targetId?: string; detailed?: boolean}) {
  const forecast = forecastAction(state, action, targetId);
  const primary = forecast.immediate.slice(0, detailed ? 4 : 2).map(effect => `${metricLabel(effect.path)} ${formatForecast(effect.minimum, effect.maximum, effect.path)}`).join(' · ');
  return <View style={[styles.effectRow, detailed && styles.detailedForecast]}><View style={styles.forecastCopy}><Text style={styles.forecastLabel}>LIKELY THIS PERIOD</Text><Text style={styles.effectText}>{primary}</Text>{forecast.delayed ? <Text style={styles.delayed}>FOLLOW-THROUGH · {forecast.delayed.dueLabel.toUpperCase()} · {forecast.delayed.impacts.map(effect => `${metricLabel(effect.path)} ${formatForecast(effect.minimum, effect.maximum, effect.path)}`).join(' · ')}</Text> : null}</View></View>;
}

function TurnBriefing({state, report, settings, busy, onContinue}: {state: GameState; report: TurnReport; settings: AppSettings; busy: boolean; onContinue: () => void | Promise<void>}) {
  const reveal = useRef(new Animated.Value(settings.reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    if (settings.reduceMotion) { reveal.setValue(1); return; }
    Animated.timing(reveal, {toValue: 1, duration: 360, useNativeDriver: true}).start();
  }, [reveal, settings.reduceMotion]);
  const direction = report.momentum.delta > 0 ? 'Momentum gained' : report.momentum.delta < 0 ? 'Momentum lost' : 'Momentum held';
  return <ScreenContainer><Animated.View style={[styles.reportWrap, {opacity: reveal, transform: [{translateY: reveal.interpolate({inputRange: [0, 1], outputRange: [12, 0]})}]}]}>
    <Text style={styles.reportKicker}>{report.timeLabel.toUpperCase()} · TURN RESOLVED</Text>
    <Text style={type.title}>{report.actionLabel}</Text>
    <Text style={type.subtitle}>{report.targetName ? `Focused on ${report.targetName}. ` : ''}Here is what changed before the campaign clock advanced.</Text>
    <Card style={styles.momentumCard}><View><Text style={type.label}>{direction.toUpperCase()}</Text><View style={styles.momentumValues}><Text style={styles.momentumNumber}>{formatPercent(report.momentum.before)} <Text style={styles.momentumArrow}>→</Text> </Text><AnimatedPercent from={report.momentum.before} to={report.momentum.after} reduceMotion={settings.reduceMotion} /></View><AnimatedMetricMeter from={report.momentum.before} to={report.momentum.after} reduceMotion={settings.reduceMotion} /></View><Text style={[styles.momentumDelta, report.momentum.delta >= 0 ? styles.positive : styles.negative]}>{signedPoints(report.momentum.delta)}</Text>{report.momentum.contributors.map(item => <Text key={`${item.label}-${item.amount}`} style={type.small}>{item.label}: {signedPoints(item.amount)}</Text>)}</Card>
    {report.sections.map(section => <Card key={section.id} style={styles.reportSection}><Text style={styles.historyKind}>{timingLabel(section.timing)}</Text><Text style={styles.rowTitle}>{section.title}</Text><Text style={type.small}>{section.detail}</Text>{section.impacts.map((impact, index) => <ImpactLine key={`${section.id}-${impact.path}-${impact.targetId ?? ''}-${index}`} state={state} impact={impact} />)}</Card>)}
    {report.scheduled.length ? <><SectionTitle aside="Already committed">On the calendar</SectionTitle>{report.scheduled.map(effect => <Card key={effect.id} style={styles.scheduledCard}><View style={styles.projectionRow}><Text style={styles.rowTitle}>{effect.source}</Text><Text style={styles.dueBadge}>DUE {effect.dueLabel.toUpperCase()}</Text></View><Text style={type.small}>{effect.changes.map(change => `${metricLabel(change.path)} ${forecastRangeForAmount(change.amount, change.path)}`).join(' · ')}</Text></Card>)}</> : null}
    {report.phaseChanged ? <Card style={styles.phaseCard}><Text style={type.label}>NEW PHASE</Text><Text style={styles.rowTitle}>{report.phaseBefore} → {report.phaseAfter}</Text><Text style={type.small}>The strategic environment has entered a new stage.</Text></Card> : null}
    {report.event ? <Card style={styles.eventBanner}><View><Text style={styles.eventKicker}>{report.event.severity.toUpperCase()} AHEAD</Text><Text style={styles.eventTitle}>{report.event.title}</Text><Text style={styles.eventText}>{report.event.narrative}</Text></View></Card> : null}
    <View style={styles.nextPeriod}><Text style={type.small}>{report.result ? 'The campaign has reached its conclusion.' : `Next: ${report.nextTimeLabel} · ${report.phaseAfter}`}</Text></View>
    <PrimaryButton disabled={busy} label={busy ? 'Saving turn…' : report.result ? 'View campaign result' : report.event ? 'Continue to the developing crisis' : 'Continue campaign'} onPress={onContinue} />
  </Animated.View></ScreenContainer>;
}

function CampaignClockCard({state}: {state: GameState}) {
  const clock = getCampaignClock(state.mode, state.turn, state.maxTurns);
  return <Card style={styles.clockCard}><View style={styles.projectionRow}><View><Text style={type.label}>CAMPAIGN CLOCK</Text><Text style={styles.clockPeriod}>{clock.periodLabel}</Text></View><View style={styles.alignRight}><Text style={styles.clockDeadline}>{clock.deadlineLabel}</Text><Text style={type.small}>{clock.remainingLabel}</Text></View></View><Meter value={clock.progress} color={clock.remainingPeriods <= 3 ? colors.red : colors.gold} /></Card>;
}

function AnimatedPercent({from, to, reduceMotion}: {from: number; to: number; reduceMotion: boolean}) {
  const progress = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const [value, setValue] = useState(reduceMotion ? to : from);
  useEffect(() => {
    if (reduceMotion) { setValue(to); return; }
    progress.setValue(0);
    const listener = progress.addListener(({value: amount}) => setValue(Math.round(from + (to - from) * amount)));
    const animation = Animated.timing(progress, {toValue: 1, duration: 520, useNativeDriver: false});
    animation.start();
    return () => { animation.stop(); progress.removeListener(listener); };
  }, [from, progress, reduceMotion, to]);
  return <Text style={styles.momentumNumber}>{formatPercent(value)}</Text>;
}

function AnimatedMetricMeter({from, to, reduceMotion}: {from: number; to: number; reduceMotion: boolean}) {
  const value = useRef(new Animated.Value(reduceMotion ? to : from)).current;
  useEffect(() => {
    if (reduceMotion) { value.setValue(to); return; }
    value.setValue(from);
    const animation = Animated.timing(value, {toValue: to, duration: 520, useNativeDriver: false});
    animation.start();
    return () => animation.stop();
  }, [from, reduceMotion, to, value]);
  const width = value.interpolate({inputRange: [0, 10000], outputRange: ['0%', '100%'], extrapolate: 'clamp'});
  return <View style={styles.animatedMeter}><Animated.View style={[styles.animatedMeterFill, {width}]} /></View>;
}

function ImpactLine({state, impact, compact = false, source}: {state: GameState; impact: MetricImpact; compact?: boolean; source?: string}) {
  const target = findTarget(state, impact.targetId);
  return <View style={[styles.impactLine, compact && styles.impactCompact]}><View style={styles.impactCopy}><Text style={styles.impactName}>{metricLabel(impact.path)}{target ? ` · ${target}` : ''}</Text>{source ? <Text numberOfLines={1} style={styles.impactSource}>{source}</Text> : null}</View>{!compact ? <Text style={styles.impactValues}>{formatMetricValue(impact.path, impact.before)} → {formatMetricValue(impact.path, impact.after)}</Text> : null}<Text style={[styles.impactDelta, impact.amount >= 0 ? styles.positive : styles.negative]}>{formatImpactAmount(impact.path, impact.amount)}</Text></View>;
}

function PoliticalNetwork({state}: {state: GameState}) {
  const [section, setSection] = useState<'actors' | 'factions' | 'institutions'>('actors');
  return <ScreenContainer><Text style={type.title}>Political network</Text><Text style={type.subtitle}>Trust, ambition, institutional confidence, and remembered decisions shape future behavior.</Text><View style={styles.tabRow}>{(['actors', 'factions', 'institutions'] as const).map(item => <GhostButton key={item} label={item[0].toUpperCase() + item.slice(1)} active={section === item} onPress={() => setSection(item)} />)}</View>
    {section === 'actors' ? state.actors.map(actor => <Card key={actor.id}><View style={styles.personHeader}><View style={styles.avatar}><Text style={styles.avatarText}>{actor.name.split(' ').map(part => part[0]).join('').slice(0, 2)}</Text></View><View style={styles.rowCopy}><Text style={styles.rowTitle}>{actor.name}{actor.age ? ` · ${actor.age}` : ''}</Text><Text style={type.small}>{actor.role}</Text></View><Text style={styles.memoryCount}>{actor.memory.length} memories</Text></View><Metric label="Trust" value={actor.trust} /><Metric label="Loyalty" value={actor.loyalty} /><Metric label="Ambition" value={actor.ambition} color={colors.gold} /></Card>) : section === 'factions' ? state.factions.map(faction => <Card key={faction.id}><View style={styles.projectionRow}><View><Text style={styles.rowTitle}>{faction.name}</Text><Text style={type.small}>{faction.priorities.join(' · ')}</Text></View><Text style={styles.rowValue}>{formatPercent(faction.support)}</Text></View><Metric label="Support" value={faction.support} /><Metric label="Cohesion" value={faction.cohesion} color={colors.blue} /><Metric label="Influence" value={faction.influence} color={colors.gold} /></Card>) : state.institutions.map(institution => <Card key={institution.id}><View style={styles.projectionRow}><Text style={styles.rowTitle}>{institution.name}</Text><Text style={styles.rowValue}>{formatPercent(institution.confidence)}</Text></View><Metric label="Public confidence" value={institution.confidence} /><Metric label="Authority" value={institution.authority} color={colors.gold} /><Metric label="Alignment" value={institution.alignment} color={colors.blue} /></Card>)}
  </ScreenContainer>;
}

function Finance({state}: {state: GameState}) {
  const metrics: Array<[string, number, string]> = [['Growth', state.economy.growth, 'Productive activity'], ['Employment', state.economy.employment, 'Participation and opportunity'], ['Price stability', 10000 - state.economy.inflation, 'Inverse of inflation pressure'], ['Equality', 10000 - state.economy.inequality, 'Distribution of gains'], ['Resilience', state.economy.resilience, 'Capacity to absorb shocks']];
  return <ScreenContainer><Text style={type.title}>Treasury & economy</Text><View style={styles.statRow}><StatPill label="Treasury" value={formatResource(state.treasury)} /><StatPill label="Growth" value={formatPercent(state.economy.growth)} tone={state.economy.growth >= 5000 ? 'good' : 'warning'} /></View><Card>{metrics.map(([label, value, description]) => <View key={label} style={styles.economyRow}><View style={styles.projectionRow}><View><Text style={styles.rowTitle}>{label}</Text><Text style={type.small}>{description}</Text></View><Text style={styles.rowValue}>{formatPercent(value)}</Text></View><Meter value={value} color={value >= 5000 ? colors.teal : colors.red} /></View>)}</Card><Card><Text style={styles.rowTitle}>How the economy moves</Text><Text style={type.subtitle}>Growth, employment, price pressure, inequality, and resilience update each turn. The treasury receives revenue from productive growth; low reserves add inflation pressure. Many investments mature after a delay.</Text></Card></ScreenContainer>;
}

function Intelligence({state}: {state: GameState}) {
  const risks = useMemo(() => {
    const list = [
      {label: 'Coalition fracture', value: 10000 - Math.min(...state.factions.map(item => item.support)), detail: 'Weakest faction support'},
      {label: 'Institutional weakness', value: 10000 - Math.min(...state.institutions.map(item => item.confidence)), detail: 'Weakest institution confidence'},
      {label: 'Economic shock', value: Math.round((state.economy.inflation + state.economy.inequality + (10000 - state.economy.resilience)) / 3), detail: 'Prices, inequality, and resilience'},
      {label: 'Rival initiative', value: Math.round(state.actors.reduce((max, actor) => Math.max(max, actor.ambition * actor.riskTolerance / 10000), 0)), detail: 'Highest ambition and risk tolerance'},
    ];
    return list.sort((a, b) => b.value - a.value);
  }, [state]);
  return <ScreenContainer><Text style={type.title}>Adviser intelligence</Text><Text style={type.subtitle}>Explainable risk estimates derive from the live simulation. They are not real-world predictions.</Text>{risks.map((risk, index) => <Card key={risk.label}><View style={styles.projectionRow}><View><Text style={styles.historyKind}>PRIORITY {index + 1}</Text><Text style={styles.rowTitle}>{risk.label}</Text><Text style={type.small}>{risk.detail}</Text></View><Text style={[styles.rowValue, risk.value > 6000 && styles.risk]}>{formatPercent(risk.value)}</Text></View><Meter value={risk.value} color={risk.value > 6000 ? colors.red : colors.gold} /></Card>)}</ScreenContainer>;
}

function History({state}: {state: GameState}) {
  const [focused, setFocused] = useState<string>();
  const groups = useMemo(() => {
    const grouped = new Map<string, HistoricalRecord[]>();
    state.history.forEach(item => {
      const key = item.resolutionId ?? `legacy-${item.id}`;
      grouped.set(key, [...(grouped.get(key) ?? []), item]);
    });
    return [...grouped.entries()].sort((a, b) => Math.max(...b[1].map(item => item.turn)) - Math.max(...a[1].map(item => item.turn)));
  }, [state.history]);
  return <ScreenContainer><Text style={type.title}>Decision timeline</Text><Text style={type.subtitle}>Every period connects your decision to immediate reactions, background pressures, and consequences that arrived later.</Text>
    {state.scheduledEffects.length ? <><SectionTitle aside={`${state.scheduledEffects.length} pending`}>On the calendar</SectionTitle>{state.scheduledEffects.map(effect => <Pressable accessibilityRole="button" key={effect.id} onPress={() => setFocused(effect.sourceResolutionId)} style={styles.pendingCard}><View style={styles.projectionRow}><View style={styles.rowCopy}><Text style={styles.rowTitle}>{effect.source}</Text><Text style={type.small}>Committed {effect.createdTurn ? formatCampaignMoment(state.mode, effect.createdTurn) : 'before this update'} · tap to highlight its origin</Text></View><Text style={styles.dueBadge}>{formatCampaignMoment(state.mode, effect.dueTurn).toUpperCase()}</Text></View><Text style={styles.pendingEffects}>{effect.changes.map(change => `${metricLabel(change.path)} ${forecastRangeForAmount(change.amount, change.path)}`).join(' · ')}</Text></Pressable>)}</> : null}
    <SectionTitle aside={`${groups.length} decision groups`}>Cause and consequence</SectionTitle>
    {groups.map(([id, records]) => {
      const decision = records.find(item => item.kind === 'decision') ?? records[0];
      const turn = decision.turn;
      return <Card key={id} style={[styles.timelineGroup, focused === id ? styles.timelineFocused : {}]}><Text style={styles.historyKind}>{turn > 0 ? formatCampaignMoment(state.mode, turn).toUpperCase() : 'CAMPAIGN OPENING'}</Text><Text style={styles.timelineTitle}>{decision.title}</Text>{records.map(item => <View key={item.id} style={styles.historyRecord}><Text style={styles.recordTiming}>{timingLabel(item.timing ?? timingFromKind(item.kind))}</Text><Text style={styles.rowTitle}>{item.title}</Text><Text style={type.small}>{item.detail}</Text>{item.impacts?.map((impact, index) => <ImpactLine key={`${item.id}-${index}`} state={state} impact={impact} />)}{item.legacy && item.deltas ? <Text style={styles.delta}>Legacy record · {Object.entries(item.deltas).map(([key, value]) => `${metricLabel(key.split(':')[0] as MetricChange['path'])} ${formatImpactAmount(key.split(':')[0] as MetricChange['path'], value)}`).join(' · ')}</Text> : null}</View>)}</Card>;
    })}
  </ScreenContainer>;
}

function More({state, onNavigate, onSave, onConcede, onExit}: {state: GameState; onNavigate: (view: CampaignView) => void; onSave: () => void; onConcede: () => void; onExit: () => void}) {
  const options: Array<[CampaignView, string, string]> = [['finance', 'Treasury & resources', 'Inspect economic causes and pressures.'], ['intelligence', 'Intelligence & advisers', 'Review explainable strategic risks.'], ['history', 'Campaign history', 'Audit decisions and consequences.'], ['statistics', 'Campaign statistics', 'Review the current scorecard.']];
  return <ScreenContainer><Text style={type.title}>Campaign office</Text>{options.map(([id, label, description]) => <Pressable key={id} onPress={() => onNavigate(id)} style={styles.moreRow}><View><Text style={styles.rowTitle}>{label}</Text><Text style={type.small}>{description}</Text></View><Text style={styles.chevron}>›</Text></Pressable>)}<SectionTitle>Campaign file</SectionTitle><PrimaryButton label="Save committed turn" onPress={onSave} tone="dark" /><PrimaryButton label="Return to main menu" onPress={onExit} tone="dark" /><PrimaryButton label="Concede / end campaign" onPress={onConcede} tone="danger" /><Text style={styles.fictionNotice}>{MODE_COPY[state.mode].objective}</Text></ScreenContainer>;
}

function Results({state, onExit}: {state: GameState; onExit: () => void}) {
  const result = state.result;
  if (!result) return <ScreenContainer><Text style={type.title}>Campaign statistics</Text><LiveStatistics state={state} /><PrimaryButton label="Return to campaign" onPress={onExit} /></ScreenContainer>;
  const won = state.status === 'victory' || state.status === 'transitioned';
  return <ScreenContainer><View style={styles.resultHero}><Text style={styles.resultKicker}>{won ? 'CAMPAIGN COMPLETE' : 'THE CAMPAIGN ENDS'}</Text><Text style={styles.resultIcon}>{won ? '✦' : '◇'}</Text><Text style={styles.resultTitle}>{result.ending}</Text><Text style={styles.resultSummary}>{result.summary}</Text></View>{result.playerElectoralVotes !== undefined ? <View style={styles.electionScore}><View><Text style={styles.scoreNumber}>{result.playerElectoralVotes}</Text><Text style={type.small}>YOUR ELECTORS</Text></View><Text style={styles.scoreDivider}>—</Text><View style={styles.alignRight}><Text style={styles.scoreNumber}>{result.opponentElectoralVotes}</Text><Text style={type.small}>RIVAL ELECTORS</Text></View></View> : null}<LiveStatistics state={state} /><PrimaryButton label="Return to main menu" onPress={onExit} /></ScreenContainer>;
}

function LiveStatistics({state}: {state: GameState}) {
  const positiveMemories = state.actors.flatMap(actor => actor.memory).filter(memory => memory.sentiment > 0).length;
  return <><SectionTitle>Final scorecard</SectionTitle><View style={styles.statRow}><StatPill label="Score" value={`${state.result?.score ?? campaignHealth(state)}`} /><StatPill label="Turns" value={`${Math.min(state.turn, state.maxTurns)}`} /><StatPill label="Actions" value={`${state.actionHistory.length}`} /></View><Card><Metric label="Legitimacy" value={state.legitimacy} /><Metric label="Public sentiment" value={state.publicSentiment} color={colors.blue} /><Metric label="Momentum" value={state.momentum} color={colors.gold} /><View style={styles.detailGrid}><Text style={type.small}>Coalition memories: {state.actors.flatMap(actor => actor.memory).length}</Text><Text style={type.small}>Positive memories: {positiveMemories}</Text><Text style={type.small}>Delayed effects pending: {state.scheduledEffects.length}</Text><Text style={type.small}>Policy: {state.policyVersion}</Text></View></Card></>;
}

function Metric({label, value, color = colors.teal}: {label: string; value: number; color?: string}) {
  return <View style={styles.metric}><View style={styles.metricLabel}><Text style={type.small}>{label}</Text><Text style={type.small}>{formatPercent(value)}</Text></View><Meter value={value} color={color} /></View>;
}

const METRIC_LABELS: Record<MetricChange['path'], string> = {
  publicSentiment: 'Public sentiment', legitimacy: 'Legitimacy', momentum: 'Momentum', treasury: 'Treasury', influence: 'Influence',
  'economy.growth': 'Economic growth', 'economy.employment': 'Employment', 'economy.inflation': 'Inflation', 'economy.inequality': 'Inequality', 'economy.resilience': 'Economic resilience',
  'faction.support': 'Faction support', 'faction.cohesion': 'Faction cohesion', 'faction.influence': 'Faction resources', 'institution.confidence': 'Institution confidence',
  'region.support': 'Regional support', 'region.opponentSupport': 'Rival regional support', 'region.undecided': 'Undecided voters', 'region.investment': 'Regional investment',
  'actor.trust': 'Personal trust', 'actor.loyalty': 'Personal loyalty',
};

function metricLabel(path: MetricChange['path']) { return METRIC_LABELS[path] ?? path; }
function isResource(path: MetricChange['path']) { return path === 'treasury' || path === 'influence' || path === 'region.investment'; }
function formatMetricValue(path: MetricChange['path'], value: number) { return isResource(path) ? formatResource(value) : formatPercent(value); }
function formatImpactAmount(path: MetricChange['path'], amount: number) {
  const sign = amount >= 0 ? '+' : '−';
  return isResource(path) ? `${sign}${formatResource(Math.abs(amount))}` : `${sign}${(Math.abs(amount) / 100).toFixed(1)} pts`;
}
function signedPoints(amount: number) { return `${amount >= 0 ? '+' : '−'}${(Math.abs(amount) / 100).toFixed(1)} pts`; }
function formatForecast(minimum: number, maximum: number, path: MetricChange['path']) {
  return `${formatImpactAmount(path, minimum)} to ${formatImpactAmount(path, maximum)}`;
}
function forecastRangeForAmount(amount: number, path: MetricChange['path']) {
  const a = Math.round(amount * 0.85);
  const b = Math.round(amount * 1.15);
  return formatForecast(Math.min(a, b), Math.max(a, b), path);
}
function findTarget(state: GameState, targetId?: string) {
  if (!targetId) return undefined;
  return [...state.regions, ...state.factions, ...state.actors, ...state.institutions, ...(state.world?.nations ?? []), ...(state.world?.territories ?? [])].find(item => item.id === targetId)?.name;
}
function timingFromKind(kind: HistoricalRecord['kind']): ImpactTiming {
  return kind === 'decision' ? 'immediate' : kind === 'opponent' ? 'opponent' : kind === 'event' ? 'event' : kind === 'result' ? 'result' : 'systemic';
}
function timingLabel(timing: ImpactTiming) {
  return ({cost: 'RESOURCE COST', immediate: 'YOUR DECISION', opponent: 'POLITICAL REACTION', systemic: 'UNDERLYING TREND', delayed: 'PROMISE CAME DUE', event: 'NEW DEVELOPMENT', result: 'CAMPAIGN RESULT'} as Record<ImpactTiming, string>)[timing];
}

const styles = StyleSheet.create({
  flex: {flex: 1}, autosave: {flexDirection: 'row', alignItems: 'center', gap: 4}, autosaveDot: {width: 6, height: 6, borderRadius: 3, backgroundColor: colors.teal}, autosaveText: {fontSize: 8, fontWeight: '900', color: colors.muted, letterSpacing: 0.8},
  nav: {backgroundColor: colors.navy, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, flexDirection: 'row'}, navItem: {flex: 1, alignItems: 'center', justifyContent: 'center'}, navIcon: {color: colors.darkMuted, fontSize: 18, fontWeight: '800'}, navLabel: {color: colors.darkMuted, fontSize: 9, fontWeight: '800', marginTop: 4}, navActive: {color: colors.gold},
  eventBanner: {backgroundColor: '#2A2430', borderRadius: radius.md, borderWidth: 1, borderColor: '#7A5C57', padding: spacing.md, flexDirection: 'row', justifyContent: 'space-between'}, eventKicker: {color: colors.red, fontSize: 9, letterSpacing: 1.3, fontWeight: '900'}, eventTitle: {color: colors.text, fontSize: 18, fontWeight: '900', marginVertical: 4}, eventText: {color: colors.muted, fontSize: 12, lineHeight: 17, maxWidth: 290}, chevron: {color: colors.gold, fontSize: 28, alignSelf: 'center'},
  territoryOwned: {borderColor: '#397b6b', backgroundColor: '#112c32'}, territoryOccupied: {borderColor: '#a34b4b', backgroundColor: '#321f28'}, warCard: {borderColor: '#a34b4b', backgroundColor: '#321f28'}, newsCrisis: {borderLeftWidth: 3, borderLeftColor: colors.red},
  statRow: {flexDirection: 'row', gap: spacing.sm}, projectionCard: {gap: spacing.md}, projectionRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md}, projection: {color: colors.text, fontSize: 34, fontWeight: '900', marginTop: 3}, projectionTarget: {color: colors.muted, fontSize: 18}, raceBadge: {paddingVertical: 5, paddingHorizontal: 9, backgroundColor: '#173B3B', borderRadius: radius.pill}, raceBadgeText: {color: colors.teal, fontSize: 9, fontWeight: '900', letterSpacing: 0.8},
  listRow: {minHeight: 72, backgroundColor: colors.panel, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: spacing.md, flexDirection: 'row', alignItems: 'center'}, regionBadge: {width: 40, height: 40, borderRadius: 12, backgroundColor: '#243B4A', alignItems: 'center', justifyContent: 'center', marginRight: spacing.md}, regionBadgeText: {color: colors.gold, fontWeight: '900'}, rowCopy: {flex: 1}, rowTitle: {color: colors.text, fontSize: 15, fontWeight: '800', marginBottom: 3}, rowValue: {color: colors.goldSoft, fontSize: 17, fontWeight: '900'}, alignRight: {alignItems: 'flex-end'}, historyKind: {color: colors.gold, fontSize: 9, fontWeight: '900', letterSpacing: 1.1, marginBottom: 5},
  resourceStrip: {flexDirection: 'row', gap: spacing.lg}, inlineValue: {color: colors.goldSoft, fontWeight: '900'}, actionCard: {backgroundColor: colors.panel, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: spacing.md}, actionSelected: {borderColor: colors.gold, backgroundColor: '#183142'}, actionTop: {flexDirection: 'row', justifyContent: 'space-between'}, actionCategory: {color: colors.teal, fontSize: 9, fontWeight: '900', letterSpacing: 1.2}, cost: {color: colors.goldSoft, fontSize: 9, fontWeight: '800'}, actionTitle: {color: colors.text, fontSize: 18, fontWeight: '900', marginVertical: 7}, effectRow: {marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}, effectText: {color: colors.teal, fontSize: 10, fontWeight: '800'}, delayed: {color: colors.blue, fontSize: 8, fontWeight: '900'}, targetPanel: {borderColor: colors.gold}, choiceHeading: {color: colors.text, fontSize: 18, fontWeight: '900'}, targetList: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm}, spaceBottom: {marginBottom: spacing.md}, spaceTop: {marginTop: spacing.md},
  tabRow: {flexDirection: 'row', gap: spacing.sm}, personHeader: {flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md}, avatar: {width: 44, height: 44, borderRadius: 16, backgroundColor: '#284556', alignItems: 'center', justifyContent: 'center', marginRight: spacing.md}, avatarText: {color: colors.goldSoft, fontWeight: '900'}, memoryCount: {color: colors.muted, fontSize: 9}, metric: {marginTop: spacing.md}, metricLabel: {flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5}, economyRow: {marginBottom: spacing.lg},
  risk: {color: colors.red}, timeline: {flexDirection: 'row'}, timelineRail: {width: 24, alignItems: 'center', borderRightWidth: 1, borderRightColor: colors.line, marginRight: spacing.md}, timelineDot: {width: 9, height: 9, borderRadius: 5, backgroundColor: colors.gold, marginRight: -24, marginTop: 5}, timelineCopy: {flex: 1, paddingBottom: spacing.xl}, delta: {color: colors.teal, fontSize: 9, marginTop: spacing.sm}, moreRow: {backgroundColor: colors.panel, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: spacing.md, minHeight: 74, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}, fictionNotice: {color: colors.darkMuted, textAlign: 'center', fontSize: 10, lineHeight: 15, margin: spacing.md},
  resultHero: {alignItems: 'center', paddingVertical: spacing.xl}, resultKicker: {color: colors.gold, fontSize: 10, fontWeight: '900', letterSpacing: 2}, resultIcon: {color: colors.gold, fontSize: 50, marginVertical: spacing.md}, resultTitle: {color: colors.text, textAlign: 'center', fontSize: 30, fontWeight: '900'}, resultSummary: {color: colors.muted, textAlign: 'center', fontSize: 15, lineHeight: 23, marginTop: spacing.md, maxWidth: 360}, electionScore: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', backgroundColor: colors.panel, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: spacing.lg}, scoreNumber: {color: colors.goldSoft, fontSize: 42, fontWeight: '900'}, scoreDivider: {color: colors.line, fontSize: 34}, detailGrid: {marginTop: spacing.lg, gap: spacing.sm},
  clockCard: {gap: spacing.md, borderColor: '#4B5660'}, clockPeriod: {color: colors.text, fontSize: 22, fontWeight: '900', marginTop: 3}, clockDeadline: {color: colors.goldSoft, fontSize: 12, fontWeight: '800'},
  recapCard: {gap: spacing.sm, borderColor: '#315C62'}, recapMomentum: {fontSize: 11, fontWeight: '900'}, pendingLink: {color: colors.blue, fontSize: 11, fontWeight: '800', marginTop: spacing.xs},
  forecastCopy: {flex: 1, gap: 5}, forecastLabel: {color: colors.muted, fontSize: 8, fontWeight: '900', letterSpacing: 0.8}, detailedForecast: {paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line}, confirmForecast: {marginTop: spacing.md},
  reportWrap: {gap: spacing.md}, reportKicker: {color: colors.gold, fontSize: 10, fontWeight: '900', letterSpacing: 1.4}, momentumCard: {gap: spacing.sm, borderColor: colors.gold}, momentumValues: {flexDirection: 'row', alignItems: 'baseline'}, momentumNumber: {color: colors.text, fontSize: 25, fontWeight: '900', marginTop: 5}, momentumArrow: {color: colors.muted}, momentumDelta: {fontSize: 20, fontWeight: '900'}, animatedMeter: {height: 7, borderRadius: radius.pill, backgroundColor: '#071722', overflow: 'hidden', marginTop: spacing.sm}, animatedMeterFill: {height: '100%', borderRadius: radius.pill, backgroundColor: colors.gold}, reportSection: {gap: spacing.xs}, scheduledCard: {gap: spacing.sm, borderColor: '#31556B'}, dueBadge: {color: colors.blue, fontSize: 9, fontWeight: '900', letterSpacing: 0.6}, phaseCard: {gap: spacing.xs, borderColor: colors.gold}, nextPeriod: {alignItems: 'center', paddingVertical: spacing.xs},
  impactLine: {minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, marginTop: spacing.sm, paddingTop: spacing.sm}, impactCompact: {minHeight: 30, marginTop: 0, paddingTop: spacing.xs}, impactCopy: {flex: 1}, impactName: {color: colors.text, fontSize: 11, fontWeight: '800'}, impactSource: {color: colors.darkMuted, fontSize: 9, marginTop: 2}, impactValues: {color: colors.muted, fontSize: 10}, impactDelta: {minWidth: 58, textAlign: 'right', fontSize: 11, fontWeight: '900'}, positive: {color: colors.teal}, negative: {color: colors.red},
  pendingCard: {backgroundColor: '#102C43', borderRadius: radius.md, borderWidth: 1, borderColor: '#31556B', padding: spacing.md, gap: spacing.sm}, pendingEffects: {color: colors.blue, fontSize: 10, fontWeight: '800'}, timelineGroup: {gap: spacing.sm}, timelineFocused: {borderColor: colors.gold, borderWidth: 2}, timelineTitle: {color: colors.text, fontSize: 20, fontWeight: '900'}, historyRecord: {borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, paddingTop: spacing.md, gap: 3}, recordTiming: {color: colors.teal, fontSize: 8, fontWeight: '900', letterSpacing: 0.9},
});
