import React, {useEffect, useRef, useState} from 'react';
import {ActivityIndicator, Alert, AppState, BackHandler, StyleSheet, Text, View} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {createCampaign} from './src/game/engine';
import {AppSettings, GameMode, GameState, SaveSlot} from './src/game/types';
import {advertising} from './src/services/ads';
import {modelPolicy} from './src/services/modelPolicy';
import {flushAnalytics, queueAnalytics} from './src/services/telemetry';
import {clearLocalData, DEFAULT_SETTINGS, listSaves, loadSettings, saveCampaign, saveSettings} from './src/services/storage';
import {AppShell, SafeAdContainer} from './src/ui/components/Layout';
import {CampaignScreen} from './src/ui/screens/CampaignScreen';
import {
  AboutScreen, AchievementsScreen, CampaignConfiguration, CampaignConfigScreen, ConsentIntroScreen,
  HomeScreen, ModeSelectScreen, PrivacyScreen, SavesScreen, SettingsScreen,
} from './src/ui/screens/HomeScreens';
import {colors} from './src/ui/theme';

type AppScreen = 'home' | 'modes' | 'config' | 'campaign' | 'saves' | 'achievements' | 'settings' | 'privacy' | 'about' | 'consent';

function App() {
  const [screen, setScreen] = useState<AppScreen>('home');
  const [mode, setMode] = useState<GameMode>('presidential');
  const [campaign, setCampaign] = useState<GameState | null>(null);
  const [saves, setSaves] = useState<SaveSlot[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  const [adsReady, setAdsReady] = useState(false);
  const [startingCampaign, setStartingCampaign] = useState(false);
  const settingsRef = useRef(settings);
  const startingCampaignRef = useRef(false);
  const sessionStartedAt = useRef(Date.now());
  const appState = useRef(AppState.currentState);

  useEffect(() => { settingsRef.current = settings; }, [settings]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screen === 'campaign') return false;
      if (screen === 'home' || screen === 'consent') {
        Alert.alert('Exit game?', 'Your committed campaign turns are already saved.', [
          {text: 'Keep playing', style: 'cancel'},
          {text: 'Exit', onPress: () => BackHandler.exitApp()},
        ]);
      } else if (screen === 'config') setScreen('modes');
      else if (screen === 'privacy') setScreen('settings');
      else setScreen('home');
      return true;
    });
    return () => subscription.remove();
  }, [screen]);

  const refreshSaves = async () => setSaves(await listSaves());
  useEffect(() => {
    const unsubscribeAds = advertising.subscribeReady(setAdsReady);
    const unsubscribeAdEvents = advertising.subscribeEvents(event => {
      const analyticsEvent = event === 'interstitial_request' ? 'ad_request' : event === 'interstitial_loaded' ? 'ad_loaded' : event === 'interstitial_impression' ? 'ad_impression' : 'ad_failure';
      queueAnalytics({schemaVersion: 1, event: analyticsEvent, occurredAt: new Date().toISOString(), value: 2}, settingsRef.current).catch(() => undefined);
    });
    Promise.all([loadSettings(), listSaves()]).then(([storedSettings, storedSaves]) => {
      setSettings(storedSettings);
      setSaves(storedSaves);
      if (!storedSettings.consent.decidedAt) setScreen('consent');
      if (storedSettings.consent.analytics) {
        queueAnalytics({schemaVersion: 1, event: 'session_start', occurredAt: new Date().toISOString()}, storedSettings).then(() => flushAnalytics(storedSettings));
      }
      setReady(true);
    });
    advertising.initialize().catch(() => false);
    modelPolicy.checkForUpdate().catch(() => undefined);
    const subscription = AppState.addEventListener('change', nextState => {
      const previous = appState.current;
      if (previous === 'active' && nextState !== 'active') {
        const seconds = Math.max(1, Math.round((Date.now() - sessionStartedAt.current) / 1000));
        queueAnalytics({schemaVersion: 1, event: 'session_end', occurredAt: new Date().toISOString(), value: seconds}, settingsRef.current)
          .then(() => flushAnalytics(settingsRef.current));
      } else if (previous !== 'active' && nextState === 'active') {
        sessionStartedAt.current = Date.now();
        advertising.initialize().catch(() => false);
        queueAnalytics({schemaVersion: 1, event: 'session_start', occurredAt: new Date().toISOString()}, settingsRef.current)
          .then(() => flushAnalytics(settingsRef.current));
      }
      appState.current = nextState;
    });
    return () => { subscription.remove(); unsubscribeAds(); unsubscribeAdEvents(); };
  }, []);

  const updateSettings = (next: AppSettings) => {
    setSettings(next);
    saveSettings(next).catch(() => undefined);
  };
  const begin = async (configuration: CampaignConfiguration) => {
    if (startingCampaignRef.current) return;
    startingCampaignRef.current = true;
    setStartingCampaign(true);
    try {
      const next = createCampaign({mode: configuration.mode, candidateId: configuration.candidate.id, difficulty: configuration.difficulty, seed: configuration.seed});
      next.policyVersion = await modelPolicy.getActiveVersion().catch(() => next.policyVersion);

      // Enter gameplay before optional bookkeeping. A storage or telemetry failure
      // must never strand the player on the setup screen or reject the press handler.
      setCampaign(next);
      setScreen('campaign');
      saveCampaign(next)
        .then(refreshSaves)
        .catch(() => Alert.alert('Autosave unavailable', 'The campaign started, but it could not be saved on this device. You can keep playing and try saving again later.'));
      queueAnalytics({schemaVersion: 1, event: 'campaign_start', occurredAt: new Date().toISOString(), mode: next.mode, difficulty: next.difficulty}, settings)
        .catch(() => undefined);
    } catch (error) {
      Alert.alert('Could not start campaign', error instanceof Error ? error.message : 'The campaign could not be created.');
    } finally {
      startingCampaignRef.current = false;
      setStartingCampaign(false);
    }
  };
  const chooseConsent = (analytics: boolean, collectiveLearning: boolean) => {
    updateSettings({...settings, consent: {analytics, collectiveLearning, decidedAt: new Date().toISOString()}});
    setScreen('home');
  };
  const clearAll = async () => {
    await clearLocalData();
    setCampaign(null);
    setSaves([]);
    const next = {...DEFAULT_SETTINGS, consent: {analytics: false, collectiveLearning: false, decidedAt: new Date().toISOString()}};
    setSettings(next);
    await saveSettings(next);
    setScreen('home');
  };

  let content: React.ReactNode;
  if (!ready) content = <View style={styles.loading}><ActivityIndicator color={colors.gold} /><Text style={styles.loadingText}>Preparing the simulation…</Text></View>;
  else if (screen === 'consent') content = <ConsentIntroScreen onChoose={chooseConsent} />;
  else if (screen === 'home') content = <HomeScreen onNew={() => setScreen('modes')} onLoad={() => { refreshSaves(); setScreen('saves'); }} onNavigate={setScreen} />;
  else if (screen === 'modes') content = <ModeSelectScreen onBack={() => setScreen('home')} onSelect={selected => { setMode(selected); setScreen('config'); }} />;
  else if (screen === 'config') content = <CampaignConfigScreen mode={mode} starting={startingCampaign} onBack={() => setScreen('modes')} onStart={begin} />;
  else if (screen === 'campaign' && campaign) content = <CampaignScreen state={campaign} settings={settings} onChange={setCampaign} onExit={() => { refreshSaves(); setScreen('home'); }} />;
  else if (screen === 'saves') content = <SavesScreen saves={saves} onBack={() => setScreen('home')} onLoad={slot => { setCampaign(slot.state); setScreen('campaign'); }} onChanged={refreshSaves} />;
  else if (screen === 'achievements') content = <AchievementsScreen onBack={() => setScreen('home')} />;
  else if (screen === 'settings') content = <SettingsScreen settings={settings} onBack={() => setScreen('home')} onChange={updateSettings} onPrivacy={() => setScreen('privacy')} />;
  else if (screen === 'privacy') content = <PrivacyScreen settings={settings} onBack={() => setScreen('settings')} onChange={updateSettings} onLocalCleared={clearAll} />;
  else content = <AboutScreen onBack={() => setScreen('home')} />;

  const bannerPlacement = screen === 'campaign'
    ? campaign && campaign.status !== 'active' && (!campaign.lastTurnReport || campaign.lastAcknowledgedReportId === campaign.lastTurnReport.id) ? 'campaign_results' : null
    : ({home: 'main_menu', modes: 'campaign_selection', config: 'campaign_setup', saves: 'saved_campaigns', achievements: 'achievements', about: 'about'} as Partial<Record<AppScreen, string>>)[screen] ?? null;
  return (
    <SafeAreaProvider>
      <AppShell>
        {content}
        <SafeAdContainer
          visible={adsReady && bannerPlacement !== null}
          placement={bannerPlacement ?? 'hidden'}
          onRequest={() => { queueAnalytics({schemaVersion: 1, event: 'ad_request', occurredAt: new Date().toISOString(), value: 1}, settings).catch(() => undefined); }}
          onLoad={() => { queueAnalytics({schemaVersion: 1, event: 'ad_loaded', occurredAt: new Date().toISOString(), value: 1}, settings).catch(() => undefined); }}
          onImpression={() => { queueAnalytics({schemaVersion: 1, event: 'ad_impression', occurredAt: new Date().toISOString()}, settings).catch(() => undefined); }}
          onFailure={() => { queueAnalytics({schemaVersion: 1, event: 'ad_failure', occurredAt: new Date().toISOString()}, settings).catch(() => undefined); }}
        />
      </AppShell>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink},
  loadingText: {color: colors.muted, marginTop: 16, fontSize: 13},
});

export default App;
