import React, {PropsWithChildren, useEffect, useRef, useState} from 'react';
import {
  Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StatusBar, StyleSheet,
  Text, View, ViewStyle,
} from 'react-native';
import {BannerAd, BannerAdSize} from 'react-native-google-mobile-ads';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {ADMOB, APP} from '../../config/appConfig';
import {colors, radius, spacing} from '../theme';

export function AppShell({children}: PropsWithChildren) {
  return (
    <View style={styles.shell}>
      <StatusBar barStyle="light-content" />
      <View pointerEvents="none" style={styles.glowOne} />
      <View pointerEvents="none" style={styles.glowTwo} />
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        {children}
      </SafeAreaView>
    </View>
  );
}

export function ScreenContainer({children, scroll = true, contentStyle}: PropsWithChildren<{scroll?: boolean; contentStyle?: ViewStyle}>) {
  const insets = useSafeAreaInsets();
  if (!scroll) return <View style={[styles.screen, {paddingBottom: insets.bottom + spacing.md}, contentStyle]}>{children}</View>;
  return <ScrollView style={styles.screen} contentContainerStyle={[styles.scrollContent, {paddingBottom: insets.bottom + 96}, contentStyle]} keyboardShouldPersistTaps="handled">{children}</ScrollView>;
}

export function KeyboardSafeScreen({children}: PropsWithChildren) {
  return <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>{children}</KeyboardAvoidingView>;
}

export function TopBar({title, subtitle, onBack, right}: {title: string; subtitle?: string; onBack?: () => void; right?: React.ReactNode}) {
  return (
    <View style={styles.topBar}>
      {onBack ? <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={onBack} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable> : <Image source={require('../../../assets/logo.png')} style={styles.miniLogo} />}
      <View style={styles.topTitleWrap}><Text numberOfLines={1} style={styles.topTitle}>{title}</Text>{subtitle ? <Text numberOfLines={1} style={styles.topSubtitle}>{subtitle}</Text> : null}</View>
      <View style={styles.topRight}>{right}</View>
    </View>
  );
}

export function SafeBottomBar({children}: PropsWithChildren) {
  const insets = useSafeAreaInsets();
  return <View style={[styles.bottomBar, {paddingBottom: Math.max(insets.bottom, spacing.sm)}]}>{children}</View>;
}

export function SafeAdContainer({visible = true, placement, onRequest, onLoad, onImpression, onFailure}: {
  visible?: boolean;
  placement: string;
  onRequest?: () => void;
  onLoad?: () => void;
  onImpression?: () => void;
  onFailure?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [retry, setRetry] = useState(0);
  const [width, setWidth] = useState(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onRequestRef = useRef(onRequest);
  useEffect(() => { onRequestRef.current = onRequest; }, [onRequest]);
  useEffect(() => {
    if (visible && width > 0) onRequestRef.current?.();
  }, [visible, placement, retry, width]);
  useEffect(() => {
    if (!visible && retryTimer.current) {
      clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
  }, [visible]);
  useEffect(() => () => { if (retryTimer.current) clearTimeout(retryTimer.current); }, []);
  if (!visible) return null;
  return (
    <View
      testID="advertising-footer"
      onLayout={event => setWidth(Math.floor(event.nativeEvent.layout.width))}
      style={[styles.adContainer, {paddingBottom: Math.max(insets.bottom, spacing.xs)}]}>
      <Text style={styles.adLabel}>ADVERTISEMENT</Text>
      {width > 0 && <BannerAd
        key={`${placement}-${width}-${retry}`}
        unitId={ADMOB.bannerId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        width={width}
        onAdLoaded={() => {
          if (retryTimer.current) { clearTimeout(retryTimer.current); retryTimer.current = null; }
          if (__DEV__) console.info('[ads] banner_loaded');
          onLoad?.();
        }}
        onAdImpression={onImpression}
        onAdFailedToLoad={error => {
          console.warn('[ads] banner_load_failed', error.code ?? error.message);
          onFailure?.();
          if (retryTimer.current) clearTimeout(retryTimer.current);
          retryTimer.current = setTimeout(() => {
            retryTimer.current = null;
            setRetry(value => value + 1);
          }, 60_000);
        }}
      />}
    </View>
  );
}

export function HeroBrand() {
  return (
    <View style={styles.heroBrand}>
      <Image source={require('../../../assets/logo.png')} style={styles.logo} />
      <Text style={styles.eyebrow}>OLD ALEX HUB PRESENTS</Text>
      <Text style={styles.brandTitle}>{APP.name.toUpperCase()}</Text>
      <Text style={styles.tagline}>{APP.tagline}</Text>
    </View>
  );
}

export function SectionTitle({children, aside}: PropsWithChildren<{aside?: string}>) {
  return <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>{children}</Text>{aside ? <Text style={styles.sectionAside}>{aside}</Text> : null}</View>;
}

export function Card({children, style}: PropsWithChildren<{style?: ViewStyle | ViewStyle[]}>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function PrimaryButton({label, onPress, disabled = false, tone = 'gold'}: {label: string; onPress: () => void; disabled?: boolean; tone?: 'gold' | 'dark' | 'danger'}) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({pressed}) => [styles.primaryButton, tone === 'dark' && styles.darkButton, tone === 'danger' && styles.dangerButton, disabled && styles.disabled, pressed && !disabled && styles.pressed]}><Text style={[styles.primaryButtonText, tone !== 'gold' && styles.lightButtonText]}>{label}</Text></Pressable>;
}

export function GhostButton({label, onPress, active = false}: {label: string; onPress: () => void; active?: boolean}) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({pressed}) => [styles.ghostButton, active && styles.ghostActive, pressed && styles.pressed]}><Text style={[styles.ghostText, active && styles.ghostActiveText]}>{label}</Text></Pressable>;
}

export function StatPill({label, value, tone = 'neutral'}: {label: string; value: string; tone?: 'neutral' | 'good' | 'warning'}) {
  return <View style={styles.stat}><Text style={styles.statLabel}>{label}</Text><Text style={[styles.statValue, tone === 'good' && styles.good, tone === 'warning' && styles.warning]}>{value}</Text></View>;
}

export function Meter({value, color = colors.gold}: {value: number; color?: string}) {
  const safe = Math.max(0, Math.min(100, value / 100));
  return <View style={styles.meter}><View style={[styles.meterFill, {width: `${safe}%`, backgroundColor: color}]} /></View>;
}

export const type = StyleSheet.create({
  title: {color: colors.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.6},
  subtitle: {color: colors.muted, fontSize: 15, lineHeight: 22},
  body: {color: colors.text, fontSize: 15, lineHeight: 22},
  small: {color: colors.muted, fontSize: 12, lineHeight: 17},
  label: {color: colors.goldSoft, fontSize: 11, fontWeight: '800', letterSpacing: 1.2},
});

const styles = StyleSheet.create({
  flex: {flex: 1}, shell: {flex: 1, backgroundColor: colors.ink}, safe: {flex: 1}, screen: {flex: 1},
  scrollContent: {paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.md},
  glowOne: {position: 'absolute', width: 340, height: 340, borderRadius: 170, backgroundColor: '#123D50', opacity: 0.25, top: -180, right: -130},
  glowTwo: {position: 'absolute', width: 240, height: 240, borderRadius: 120, backgroundColor: '#5B4422', opacity: 0.14, bottom: 20, left: -170},
  topBar: {minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line, backgroundColor: 'rgba(7,18,31,0.94)'},
  topTitleWrap: {flex: 1, paddingHorizontal: spacing.sm}, topTitle: {color: colors.text, fontSize: 17, fontWeight: '800'}, topSubtitle: {color: colors.muted, fontSize: 11, marginTop: 2}, topRight: {minWidth: 36, alignItems: 'flex-end'},
  back: {width: 40, height: 40, alignItems: 'center', justifyContent: 'center'}, backText: {color: colors.gold, fontSize: 38, lineHeight: 40}, miniLogo: {width: 38, height: 38, borderRadius: 10},
  heroBrand: {alignItems: 'center', paddingTop: spacing.md, paddingBottom: spacing.lg}, logo: {width: 116, height: 116, borderRadius: 28, marginBottom: spacing.md, borderWidth: 1, borderColor: '#365066'},
  eyebrow: {color: colors.gold, fontSize: 10, fontWeight: '800', letterSpacing: 2.1, marginBottom: 8}, brandTitle: {color: colors.text, textAlign: 'center', fontSize: 28, fontWeight: '900', lineHeight: 32, maxWidth: 330, letterSpacing: -0.6}, tagline: {color: colors.muted, fontSize: 13, letterSpacing: 0.5, marginTop: 10},
  sectionHeading: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: spacing.sm}, sectionTitle: {color: colors.text, fontSize: 17, fontWeight: '800'}, sectionAside: {color: colors.muted, fontSize: 11},
  card: {backgroundColor: colors.panel, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: spacing.md},
  primaryButton: {minHeight: 52, borderRadius: radius.md, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg}, darkButton: {backgroundColor: colors.panelRaised, borderWidth: 1, borderColor: colors.line}, dangerButton: {backgroundColor: '#7E3434'}, disabled: {opacity: 0.35}, pressed: {opacity: 0.78, transform: [{scale: 0.99}]}, primaryButtonText: {color: colors.ink, fontSize: 15, fontWeight: '900'}, lightButtonText: {color: colors.text},
  ghostButton: {minHeight: 40, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, justifyContent: 'center', alignItems: 'center'}, ghostActive: {backgroundColor: colors.gold, borderColor: colors.gold}, ghostText: {color: colors.muted, fontSize: 12, fontWeight: '800'}, ghostActiveText: {color: colors.ink},
  stat: {minWidth: 92, flex: 1, backgroundColor: colors.panel, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: spacing.md}, statLabel: {color: colors.muted, fontSize: 10, fontWeight: '700', letterSpacing: 0.7, textTransform: 'uppercase'}, statValue: {color: colors.text, fontSize: 20, fontWeight: '900', marginTop: 4}, good: {color: colors.teal}, warning: {color: colors.red},
  meter: {height: 7, borderRadius: radius.pill, backgroundColor: '#071722', overflow: 'hidden'}, meterFill: {height: '100%', borderRadius: radius.pill},
  bottomBar: {backgroundColor: colors.navy, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, paddingHorizontal: spacing.sm, paddingTop: spacing.sm, flexDirection: 'row', gap: spacing.xs},
  adContainer: {alignSelf: 'stretch', flexShrink: 0, alignItems: 'center', minHeight: 58, paddingTop: 6, backgroundColor: '#081521', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line}, adLabel: {color: colors.darkMuted, fontSize: 7, letterSpacing: 1.4, marginVertical: 2},
});
