import React, {useEffect, useState} from 'react';
import {Alert, Pressable, StyleSheet, Switch, Text, TextInput, View} from 'react-native';
import {APP} from '../../config/appConfig';
import {CANDIDATES, MODE_COPY} from '../../game/scenarios';
import {AppSettings, CandidateProfile, Difficulty, GameMode, SaveSlot} from '../../game/types';
import {advertising} from '../../services/ads';
import {deleteSave, loadAchievements} from '../../services/storage';
import {deleteServerTelemetry} from '../../services/telemetry';
import {colors, radius, spacing} from '../theme';
import {Card, GhostButton, HeroBrand, Meter, PrimaryButton, ScreenContainer, SectionTitle, TopBar, type} from '../components/Layout';

export function HomeScreen({onNew, onLoad, onNavigate}: {onNew: () => void; onLoad: () => void; onNavigate: (screen: 'achievements' | 'settings' | 'about') => void}) {
  return (
    <>
      <TopBar title="Political Strategy" subtitle="Fictional grand strategy" />
      <ScreenContainer>
        <HeroBrand />
        <Card style={styles.featureCard}>
          <Text style={styles.featureKicker}>A LIVING POLITICAL SYSTEM</Text>
          <Text style={styles.featureTitle}>Every coalition remembers.</Text>
          <Text style={type.subtitle}>Manage institutions, rivals, resources, and consequences across four complete campaigns.</Text>
        </Card>
        <PrimaryButton label="Begin a new campaign" onPress={onNew} />
        <PrimaryButton label="Resume from saves" onPress={onLoad} tone="dark" />
        <View style={styles.quickRow}>
          <GhostButton label="Achievements" onPress={() => onNavigate('achievements')} />
          <GhostButton label="Settings" onPress={() => onNavigate('settings')} />
          <GhostButton label="About" onPress={() => onNavigate('about')} />
        </View>
        <Text style={styles.fictionNotice}>FICTIONAL SIMULATION · NO GOVERNMENT AFFILIATION · CORE PLAY WORKS OFFLINE</Text>
      </ScreenContainer>
    </>
  );
}

export function ModeSelectScreen({onBack, onSelect}: {onBack: () => void; onSelect: (mode: GameMode) => void}) {
  return (
    <>
      <TopBar title="Choose a campaign" subtitle="Four political systems" onBack={onBack} />
      <ScreenContainer>
        <Text style={type.title}>What kind of power will you pursue?</Text>
        <Text style={type.subtitle}>Each mode uses the same deterministic simulation foundation with different institutions, incentives, and endings.</Text>
        {(Object.keys(MODE_COPY) as GameMode[]).map((mode, index) => {
          const copy = MODE_COPY[mode];
          return (
            <Pressable key={mode} onPress={() => onSelect(mode)} style={({pressed}) => [styles.modeCard, pressed && styles.pressed]}>
              <View style={styles.modeIcon}><Text style={styles.modeIconText}>{copy.icon}</Text></View>
              <View style={styles.modeCopy}>
                <Text style={styles.modeNumber}>0{index + 1}</Text>
                <Text style={styles.modeTitle}>{copy.title}</Text>
                <Text style={styles.modeSubtitle}>{copy.subtitle}</Text>
                <Text style={styles.modeObjective}>{copy.objective}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          );
        })}
      </ScreenContainer>
    </>
  );
}

export interface CampaignConfiguration {mode: GameMode; candidate: CandidateProfile; difficulty: Difficulty; seed: number;}

export function CampaignConfigScreen({mode, onBack, onStart}: {mode: GameMode; onBack: () => void; onStart: (configuration: CampaignConfiguration) => void}) {
  const [candidate, setCandidate] = useState(CANDIDATES[0]);
  const [difficulty, setDifficulty] = useState<Difficulty>('standard');
  const [seedText, setSeedText] = useState(`${Math.floor(Date.now() / 86400000)}`);
  const copy = MODE_COPY[mode];
  return (
    <>
      <TopBar title="New campaign" subtitle={copy.title} onBack={onBack} />
      <ScreenContainer>
        <Text style={type.title}>{copy.title}</Text>
        <Text style={type.subtitle}>{copy.objective}</Text>
        <SectionTitle aside="Changes strategic bonuses">Leadership profile</SectionTitle>
        {CANDIDATES.map(item => (
          <Pressable key={item.id} onPress={() => setCandidate(item)} style={[styles.choiceCard, candidate.id === item.id && styles.choiceActive]}>
            <View style={styles.choiceRadio}>{candidate.id === item.id ? <View style={styles.choiceDot} /> : null}</View>
            <View style={styles.modeCopy}><Text style={styles.choiceTitle}>{item.name}</Text><Text style={styles.choiceMeta}>{item.title} · {item.position}</Text></View>
          </Pressable>
        ))}
        <SectionTitle aside="No hidden AI bonuses">Difficulty</SectionTitle>
        <View style={styles.quickRow}>
          {(['standard', 'veteran', 'strategist'] as Difficulty[]).map(item => <GhostButton key={item} label={item[0].toUpperCase() + item.slice(1)} active={difficulty === item} onPress={() => setDifficulty(item)} />)}
        </View>
        <Card>
          <Text style={type.label}>SCENARIO SEED</Text>
          <Text style={[type.small, styles.spaceBottom]}>Share a seed to replay the same starting conditions and random sequence.</Text>
          <TextInput accessibilityLabel="Scenario seed" keyboardType="number-pad" value={seedText} onChangeText={value => setSeedText(value.replace(/[^0-9]/g, '').slice(0, 10))} placeholder="Seed" placeholderTextColor={colors.darkMuted} style={styles.input} />
        </Card>
        <PrimaryButton label="Enter the political arena" disabled={!seedText} onPress={() => onStart({mode, candidate, difficulty, seed: Math.abs(Math.trunc(Number(seedText))) % 4294967296})} />
      </ScreenContainer>
    </>
  );
}

export function SavesScreen({saves, onBack, onLoad, onChanged}: {saves: SaveSlot[]; onBack: () => void; onLoad: (slot: SaveSlot) => void; onChanged: () => void}) {
  const remove = (slot: SaveSlot) => Alert.alert('Delete save?', `${slot.name} will be removed from this device.`, [
    {text: 'Cancel', style: 'cancel'},
    {text: 'Delete', style: 'destructive', onPress: async () => { await deleteSave(slot.slotId); onChanged(); }},
  ]);
  return (
    <>
      <TopBar title="Campaign archive" subtitle={`${saves.length} local save${saves.length === 1 ? '' : 's'}`} onBack={onBack} />
      <ScreenContainer>
        {!saves.length ? <Card><Text style={styles.choiceTitle}>No saved campaigns</Text><Text style={type.subtitle}>Autosaves appear here after every completed turn.</Text></Card> : saves.map(slot => (
          <Card key={slot.slotId}>
            <View style={styles.saveHeader}><View style={styles.modeCopy}><Text style={styles.choiceTitle}>{slot.state.scenarioName}</Text><Text style={styles.choiceMeta}>{MODE_COPY[slot.state.mode].title} · Turn {slot.state.turn}/{slot.state.maxTurns}</Text></View><Text style={[styles.status, slot.state.status !== 'active' && styles.statusEnded]}>{slot.state.status.toUpperCase()}</Text></View>
            <Text style={[type.small, styles.spaceBottom]}>{new Date(slot.savedAt).toLocaleString()}</Text>
            <Meter value={slot.state.legitimacy} />
            <View style={[styles.quickRow, styles.spaceTop]}><GhostButton label="Delete" onPress={() => remove(slot)} /><View style={styles.grow}><PrimaryButton label="Resume" onPress={() => onLoad(slot)} /></View></View>
          </Card>
        ))}
      </ScreenContainer>
    </>
  );
}

const ACHIEVEMENTS = [
  ['strategic-horizon', 'Strategic Horizon', 'Reach turn five in any campaign.'],
  ['full-treasury', 'Deep Reserves', 'Build a treasury of 8,000.'],
  ['broad-coalition', 'Broad Coalition', 'Win majority support from every faction.'],
  ['presidential-victory', 'The 270 Path', 'Win a presidential campaign.'],
  ['dictatorship-victory', 'Durable Coalition', 'Survive the Republic campaign.'],
  ['monarchy-victory', 'The Next Reign', 'Secure a stable dynasty.'],
  ['peaceful-transition', 'Power Transformed', 'Complete a legitimate political transition.'],
] as const;

export function AchievementsScreen({onBack}: {onBack: () => void}) {
  const [unlocked, setUnlocked] = useState<string[]>([]);
  useEffect(() => { loadAchievements().then(setUnlocked); }, []);
  return (
    <>
      <TopBar title="Career achievements" subtitle={`${unlocked.length}/${ACHIEVEMENTS.length} unlocked`} onBack={onBack} />
      <ScreenContainer>
        {ACHIEVEMENTS.map(([id, title, description]) => {
          const earned = unlocked.includes(id);
          return <Card key={id} style={!earned ? styles.locked : undefined}><View style={styles.achievementRow}><Text style={styles.achievementIcon}>{earned ? '✦' : '◇'}</Text><View style={styles.modeCopy}><Text style={styles.choiceTitle}>{title}</Text><Text style={type.small}>{description}</Text></View></View></Card>;
        })}
      </ScreenContainer>
    </>
  );
}

export function SettingsScreen({settings, onBack, onChange, onPrivacy}: {settings: AppSettings; onBack: () => void; onChange: (settings: AppSettings) => void; onPrivacy: () => void}) {
  const toggle = (key: 'reduceMotion' | 'sound' | 'haptics') => onChange({...settings, [key]: !settings[key]});
  return (
    <>
      <TopBar title="Settings" subtitle="Local preferences" onBack={onBack} />
      <ScreenContainer>
        <SettingRow title="Sound" description="Interface and event sounds" value={settings.sound} onChange={() => toggle('sound')} />
        <SettingRow title="Haptics" description="Tactile confirmation on key actions" value={settings.haptics} onChange={() => toggle('haptics')} />
        <SettingRow title="Reduce motion" description="Use restrained interface transitions" value={settings.reduceMotion} onChange={() => toggle('reduceMotion')} />
        <SectionTitle>Privacy and data</SectionTitle>
        <Card><Text style={styles.choiceTitle}>Your choices stay separate</Text><Text style={[type.subtitle, styles.spaceBottom]}>Advertising consent is managed by Google’s consent form. Optional gameplay analytics and collective learning are controlled independently.</Text><PrimaryButton label="Privacy & analytics preferences" onPress={onPrivacy} tone="dark" /></Card>
        <PrimaryButton label="Google ad privacy options" onPress={() => advertising.showPrivacyOptions().catch(() => Alert.alert('Unavailable', 'Privacy options are not required or could not be loaded while offline.'))} tone="dark" />
      </ScreenContainer>
    </>
  );
}

export function PrivacyScreen({settings, onBack, onChange, onLocalCleared}: {settings: AppSettings; onBack: () => void; onChange: (settings: AppSettings) => void; onLocalCleared: () => Promise<void>}) {
  const consent = settings.consent;
  const update = (changes: Partial<typeof consent>) => onChange({...settings, consent: {...consent, ...changes, decidedAt: new Date().toISOString()}});
  const erase = () => Alert.alert('Delete gameplay data?', 'Local campaigns, achievements, preferences, and queued telemetry will be deleted. If a server is configured, a server-side deletion request will also be attempted.', [
    {text: 'Cancel', style: 'cancel'},
    {text: 'Delete data', style: 'destructive', onPress: async () => { try { await deleteServerTelemetry(); await onLocalCleared(); Alert.alert('Data deleted', 'Local gameplay data was removed.'); } catch (error) { Alert.alert('Deletion incomplete', error instanceof Error ? error.message : 'Please try again.'); } }},
  ]);
  return (
    <>
      <TopBar title="Privacy controls" subtitle="Optional gameplay data" onBack={onBack} />
      <ScreenContainer>
        <Card><Text style={styles.choiceTitle}>Core gameplay is always available</Text><Text style={type.subtitle}>These settings never affect campaign access. Fictional decisions are treated only as game behavior—not as evidence of real beliefs.</Text></Card>
        <SettingRow title="Gameplay analytics" description="Share minimized session, balance, and campaign events to improve the game." value={consent.analytics} onChange={() => update({analytics: !consent.analytics, collectiveLearning: !consent.analytics ? consent.collectiveLearning : false})} />
        <SettingRow title="Collective AI learning" description="Contribute anonymous game-state transitions to controlled batch training. Requires analytics consent." value={consent.collectiveLearning} disabled={!consent.analytics} onChange={() => update({collectiveLearning: !consent.collectiveLearning})} />
        <Card><Text style={type.label}>NOT COLLECTED FOR TRAINING</Text><Text style={type.subtitle}>Names, precise location, contacts, real political beliefs, voting intentions, device fingerprints, and advertising identifiers are excluded from the experience dataset.</Text></Card>
        <PrimaryButton label="Delete local & server-linked gameplay data" onPress={erase} tone="danger" />
      </ScreenContainer>
    </>
  );
}

export function ConsentIntroScreen({onChoose}: {onChoose: (analytics: boolean, learning: boolean) => void}) {
  return (
    <>
      <TopBar title="Your data, your decision" subtitle="Optional gameplay improvement" />
      <ScreenContainer>
        <Text style={type.title}>Help the simulation learn?</Text>
        <Text style={type.subtitle}>Political Strategy Simulator plays fully offline. You can optionally share minimized, pseudonymous gameplay transitions so aggregated player experience can improve future AI opponents.</Text>
        <Card><Text style={styles.choiceTitle}>What is shared</Text><Text style={type.subtitle}>Simulation state features, legal moves, the selected in-game action, AI responses, reward signals, mode, turn, and outcome.</Text></Card>
        <Card><Text style={styles.choiceTitle}>What is not shared</Text><Text style={type.subtitle}>No name, account, contacts, precise location, real political beliefs, voting intention, ad identifier, or device fingerprint is included in the learning dataset.</Text></Card>
        <Card><Text style={styles.choiceTitle}>Separate from advertising</Text><Text style={type.subtitle}>This choice does not control ads. Google’s own consent form handles advertising where required. You may change either choice later and delete gameplay data from Settings.</Text></Card>
        <PrimaryButton label="Share analytics & learning data" onPress={() => onChoose(true, true)} />
        <PrimaryButton label="Play without sharing" onPress={() => onChoose(false, false)} tone="dark" />
      </ScreenContainer>
    </>
  );
}

function SettingRow({title, description, value, disabled = false, onChange}: {title: string; description: string; value: boolean; disabled?: boolean; onChange: () => void}) {
  return <Card style={disabled ? styles.locked : undefined}><View style={styles.settingRow}><View style={styles.modeCopy}><Text style={styles.choiceTitle}>{title}</Text><Text style={type.small}>{description}</Text></View><Switch accessibilityLabel={title} disabled={disabled} value={value} onValueChange={onChange} trackColor={{false: colors.line, true: '#846C34'}} thumbColor={value ? colors.gold : colors.muted} /></View></Card>;
}

export function AboutScreen({onBack}: {onBack: () => void}) {
  return (
    <>
      <TopBar title="About & legal" subtitle="Version 1.0.0" onBack={onBack} />
      <ScreenContainer>
        <HeroBrand />
        <Card><Text style={styles.choiceTitle}>A fictional strategy game</Text><Text style={type.subtitle}>Political Strategy Simulator is an original, nonpartisan game by {APP.developer}. It is not affiliated with, endorsed by, or representative of any government, candidate, political party, or election authority. All candidates, countries, events, polls, and outcomes are fictional simulations.</Text></Card>
        <Card><Text style={styles.choiceTitle}>Free with advertising</Text><Text style={type.subtitle}>Every mode is free. There are no purchases, subscriptions, paid campaigns, energy timers, or rewarded ads. Google Mobile Ads may process advertising data subject to consent and Google’s policies.</Text></Card>
        <Card><Text style={styles.choiceTitle}>Open data notice</Text><Text style={type.subtitle}>The U.S. strategic map uses public-domain Census-derived boundary data distributed by us-atlas. Electoral votes use the 2020 census apportionment for the fictional 2028 scenario.</Text></Card>
        <Card><Text style={type.label}>CONTACT</Text><Text style={type.body}>privacy@oldalexhub.example</Text><Text style={type.small}>Replace this documentation placeholder with a monitored address before public release.</Text></Card>
      </ScreenContainer>
    </>
  );
}

const styles = StyleSheet.create({
  featureCard: {backgroundColor: '#152D3E', borderLeftWidth: 3, borderLeftColor: colors.gold}, featureKicker: {color: colors.teal, fontSize: 10, fontWeight: '900', letterSpacing: 1.5}, featureTitle: {color: colors.text, fontSize: 23, fontWeight: '900', marginVertical: 8},
  quickRow: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center'}, fictionNotice: {color: colors.darkMuted, textAlign: 'center', fontSize: 9, lineHeight: 14, letterSpacing: 1.1, marginVertical: spacing.md},
  modeCard: {backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.md, flexDirection: 'row', alignItems: 'center', minHeight: 145}, pressed: {opacity: 0.78}, modeIcon: {width: 52, height: 52, borderRadius: 18, backgroundColor: '#243C4A', alignItems: 'center', justifyContent: 'center', marginRight: spacing.md}, modeIconText: {color: colors.gold, fontSize: 25}, modeCopy: {flex: 1}, modeNumber: {color: colors.gold, fontSize: 9, fontWeight: '900', letterSpacing: 1.4}, modeTitle: {color: colors.text, fontSize: 19, fontWeight: '900', marginTop: 2}, modeSubtitle: {color: colors.goldSoft, fontSize: 12, fontWeight: '700', marginTop: 2}, modeObjective: {color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 7}, chevron: {color: colors.gold, fontSize: 32, paddingLeft: 8},
  choiceCard: {backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md, flexDirection: 'row', alignItems: 'center'}, choiceActive: {borderColor: colors.gold, backgroundColor: '#1A3242'}, choiceRadio: {width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.gold, marginRight: spacing.md, alignItems: 'center', justifyContent: 'center'}, choiceDot: {width: 10, height: 10, borderRadius: 5, backgroundColor: colors.gold}, choiceTitle: {color: colors.text, fontSize: 16, fontWeight: '800'}, choiceMeta: {color: colors.muted, fontSize: 12, marginTop: 3},
  input: {height: 48, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.ink, color: colors.text, fontSize: 17, paddingHorizontal: spacing.md}, spaceBottom: {marginBottom: spacing.md}, spaceTop: {marginTop: spacing.md}, grow: {flex: 1},
  saveHeader: {flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm}, status: {color: colors.teal, fontSize: 9, fontWeight: '900', letterSpacing: 1}, statusEnded: {color: colors.gold}, locked: {opacity: 0.46}, achievementRow: {flexDirection: 'row', alignItems: 'center'}, achievementIcon: {color: colors.gold, fontSize: 26, width: 44}, settingRow: {flexDirection: 'row', alignItems: 'center'},
});
