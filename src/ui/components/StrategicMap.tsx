import React, {useMemo, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View} from 'react-native';
import Svg, {G, Path} from 'react-native-svg';
import {geoAlbersUsa, geoPath} from 'd3-geo';
import {feature} from 'topojson-client';
import {GameState, Region} from '../../game/types';
import {formatPercent} from '../../game/selectors';
import {colors, radius, spacing} from '../theme';
import {Card, GhostButton, Meter, type} from './Layout';

declare const require: (path: string) => any;
const topology = require('us-atlas/states-10m.json');
const fipsToState: Record<string, string> = {
  '01': 'al', '02': 'ak', '04': 'az', '05': 'ar', '06': 'ca', '08': 'co', '09': 'ct', '10': 'de', '11': 'dc', '12': 'fl',
  '13': 'ga', '15': 'hi', '16': 'id', '17': 'il', '18': 'in', '19': 'ia', '20': 'ks', '21': 'ky', '22': 'la', '23': 'me',
  '24': 'md', '25': 'ma', '26': 'mi', '27': 'mn', '28': 'ms', '29': 'mo', '30': 'mt', '31': 'ne', '32': 'nv', '33': 'nh',
  '34': 'nj', '35': 'nm', '36': 'ny', '37': 'nc', '38': 'nd', '39': 'oh', '40': 'ok', '41': 'or', '42': 'pa', '44': 'ri',
  '45': 'sc', '46': 'sd', '47': 'tn', '48': 'tx', '49': 'ut', '50': 'vt', '51': 'va', '53': 'wa', '54': 'wv', '55': 'wi', '56': 'wy',
};

export function StrategicMap({state, onSelect}: {state: GameState; onSelect?: (region: Region) => void}) {
  const {width: windowWidth} = useWindowDimensions();
  const width = Math.max(320, windowWidth - spacing.lg * 2);
  const height = width * 0.66;
  const [selectedId, setSelectedId] = useState('pa');
  const [zoom, setZoom] = useState(1);
  const shapes = useMemo(() => {
    const collection = feature(topology, topology.objects.states) as any;
    const projection = geoAlbersUsa().fitSize([width, height], collection);
    const path = geoPath(projection);
    return collection.features.map((shape: any) => ({id: fipsToState[String(shape.id).padStart(2, '0')], path: path(shape) ?? ''})).filter((shape: any) => shape.id);
  }, [height, width]);
  const selected = state.regions.find(region => region.id === selectedId) ?? state.regions[0];
  const choose = (id: string) => {
    const region = state.regions.find(item => item.id === id);
    if (!region) return;
    setSelectedId(id);
    onSelect?.(region);
  };
  return (
    <>
      <View style={styles.mapHeader}><View><Text style={type.label}>FICTIONAL 2028 PROJECTION</Text><Text style={type.small}>Tap a state for simulated support and investment</Text></View><View style={styles.zoom}><GhostButton label="−" onPress={() => setZoom(value => Math.max(1, value - 0.35))} /><GhostButton label="+" onPress={() => setZoom(value => Math.min(2.4, value + 0.35))} /></View></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mapFrame} contentContainerStyle={{width: width * zoom}}>
        <Svg width={width * zoom} height={height * zoom} viewBox={`0 0 ${width} ${height}`} accessibilityLabel="Interactive United States campaign map">
          <G>
            {shapes.map((shape: {id: string; path: string}) => {
              const region = state.regions.find(item => item.id === shape.id);
              if (!region) return null;
              const close = Math.abs(region.support - 5000) < 250;
              const fill = region.support >= 5000 ? colors.gold : close ? '#557D86' : '#7B4650';
              return <Path key={shape.id} d={shape.path} fill={fill} stroke={shape.id === selectedId ? colors.cream : colors.ink} strokeWidth={shape.id === selectedId ? 2.4 : 0.7} onPress={() => choose(shape.id)} />;
            })}
          </G>
        </Svg>
      </ScrollView>
      <Card>
        <View style={styles.stateHeading}><View><Text style={styles.stateName}>{selected.name}</Text><Text style={type.small}>{selected.issue}</Text></View><Text style={styles.ev}>{selected.electoralVotes} EV</Text></View>
        <View style={styles.supportRow}><Text style={styles.support}>{formatPercent(selected.support)}</Text><Text style={type.small}>simulated support · ±{(selected.volatility / 100).toFixed(1)}</Text></View>
        <Meter value={selected.support} color={selected.support >= 5000 ? colors.gold : colors.red} />
        <View style={styles.detailRow}><Text style={type.small}>Investment: {selected.investment}</Text><Text style={type.small}>Turnout: {formatPercent(selected.turnout)}</Text><Text style={type.small}>Undecided: {formatPercent(selected.undecided)}</Text></View>
      </Card>
    </>
  );
}

export function RegionalGrid({state}: {state: GameState}) {
  const [selectedId, setSelectedId] = useState(state.regions[0]?.id);
  const selected = state.regions.find(region => region.id === selectedId) ?? state.regions[0];
  return (
    <>
      <View style={styles.regionGrid}>{state.regions.map(region => <Pressable key={region.id} onPress={() => setSelectedId(region.id)} style={[styles.regionTile, selectedId === region.id && styles.selectedTile]}><Text style={styles.regionCode}>{region.abbreviation}</Text><Meter value={region.support} color={region.support >= 5000 ? colors.teal : colors.gold} /></Pressable>)}</View>
      {selected ? <Card><Text style={styles.stateName}>{selected.name}</Text><Text style={[type.subtitle, styles.issue]}>{selected.issue}</Text><View style={styles.detailRow}><Text style={type.small}>Support {formatPercent(selected.support)}</Text><Text style={type.small}>Confidence {formatPercent(selected.turnout)}</Text><Text style={type.small}>Investment {selected.investment}</Text></View></Card> : null}
    </>
  );
}

const styles = StyleSheet.create({
  mapHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}, zoom: {flexDirection: 'row', gap: spacing.xs}, mapFrame: {borderRadius: radius.md, backgroundColor: '#091B29', borderWidth: 1, borderColor: colors.line},
  stateHeading: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start'}, stateName: {color: colors.text, fontWeight: '900', fontSize: 19}, ev: {color: colors.gold, fontSize: 18, fontWeight: '900'}, supportRow: {flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.sm}, support: {color: colors.text, fontSize: 26, fontWeight: '900'}, detailRow: {flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md},
  regionGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm}, regionTile: {width: '47%', minHeight: 72, backgroundColor: colors.panel, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, padding: spacing.sm, justifyContent: 'space-between'}, selectedTile: {borderColor: colors.gold}, regionCode: {color: colors.text, fontSize: 16, fontWeight: '900'}, issue: {marginTop: 4},
});
