import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import LogoLoader from '../../components/LogoLoader';
import LogoRefreshOverlay from '../../components/LogoRefreshOverlay';
import { useLogoRefresh } from '../../hooks/useLogoRefresh';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/auth.store';
import type { Exercise } from '@templegym/types';

interface ExerciseStat {
  exercise:     Exercise;
  bestWeightKg: number;
  bestReps:     number;
  achievedAt:   string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export default function StatsScreen() {
  const insets       = useSafeAreaInsets();
  const preferMetric = useAuthStore((s) => s.user?.preferMetric ?? true);
  const { refreshing, logoOpacity, logoScale, onRefresh } = useLogoRefresh();

  const [stats, setStats]     = useState<ExerciseStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await api.get<ExerciseStat[]>('/me/stats');
      setStats(data.sort((a, b) => a.exercise.name.localeCompare(b.exercise.name)));
      setError(null);
    } catch {
      setError('Could not load stats.');
    }
  }, []);

  useEffect(() => {
    (async () => {
      await fetchStats();
      setLoading(false);
    })();
  }, []);

  function handleRefresh() {
    return onRefresh(fetchStats);
  }

  if (loading) return <LogoLoader />;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <FlatList
        data={stats}
        keyExtractor={(item) => item.exercise.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="transparent"
            colors={['transparent']}
          />
        }
        ListHeaderComponent={
          <>
            <Text style={styles.heading}>Personal Records</Text>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </>
        }
        ListEmptyComponent={<Text style={styles.emptyText}>No workouts logged yet.</Text>}
        renderItem={({ item }) => {
          const displayWeight = preferMetric
            ? `${item.bestWeightKg} kg`
            : `${(item.bestWeightKg * 2.20462).toFixed(1)} lbs`;
          return (
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={styles.rowTop}>
                  <Text style={styles.name}>{item.exercise.name}</Text>
                  <View style={[styles.badge, item.exercise.category === 'PUSH' ? styles.badgePush : styles.badgePull]}>
                    <Text style={styles.badgeText}>{item.exercise.category}</Text>
                  </View>
                </View>
                <Text style={styles.muscles}>{item.exercise.muscleGroups.join(', ')}</Text>
                <Text style={styles.date}>{formatDate(item.achievedAt)}</Text>
              </View>
              <View style={styles.prBlock}>
                <Text style={styles.prWeight}>{displayWeight}</Text>
                <Text style={styles.prReps}>{item.bestReps} reps</Text>
              </View>
            </View>
          );
        }}
      />
      <LogoRefreshOverlay opacity={logoOpacity} scale={logoScale} top={insets.top + 6} />
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: Colors.background },
  heading:     { fontSize: 22, fontWeight: '700', color: Colors.text, padding: 20, paddingBottom: 12 },
  errorText:   { color: Colors.error, fontSize: 13, textAlign: 'center', marginTop: 24, marginBottom: 8 },
  list:        { gap: 10, paddingBottom: 8 },
  emptyText:   { color: Colors.textMuted, textAlign: 'center', marginTop: 40 },
  row:         { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 14, gap: 12, marginHorizontal: 16 },
  rowLeft:     { flex: 1, gap: 4 },
  rowTop:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name:        { fontSize: 15, fontWeight: '600', color: Colors.text },
  badge:       { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  badgePush:   { backgroundColor: `${Colors.primary}30` },
  badgePull:   { backgroundColor: `${Colors.gold}20` },
  badgeText:   { fontSize: 10, fontWeight: '700', color: Colors.text },
  muscles:     { fontSize: 12, color: Colors.textMuted },
  date:        { fontSize: 11, color: Colors.textMuted },
  prBlock:     { alignItems: 'flex-end', gap: 2 },
  prWeight:    { fontSize: 18, fontWeight: '700', color: Colors.primary },
  prReps:      { fontSize: 12, color: Colors.textMuted },
});
