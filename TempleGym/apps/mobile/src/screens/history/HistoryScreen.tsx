import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import LogoLoader from '../../components/LogoLoader';
import LogoRefreshOverlay from '../../components/LogoRefreshOverlay';
import { useLogoRefresh } from '../../hooks/useLogoRefresh';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { api } from '../../services/api';
import type { MainStackParamList } from '../../navigation/types';
import type { WorkoutSession, WorkoutsListResponse } from '@templegym/types';

type Nav = NativeStackNavigationProp<MainStackParamList, 'History'>;

const PAGE_SIZE = 20;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function HistoryScreen() {
  const navigation = useNavigation<Nav>();
  const insets     = useSafeAreaInsets();

  const { refreshing, logoOpacity, logoScale, onRefresh } = useLogoRefresh();

  const [sessions, setSessions]       = useState<WorkoutSession[]>([]);
  const [total, setTotal]             = useState(0);
  const [loading, setLoading]         = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const fetchPage = useCallback(async (offset: number, replace: boolean) => {
    try {
      const { data } = await api.get<WorkoutsListResponse>('/me/workouts', {
        params: { limit: PAGE_SIZE, offset },
      });
      setSessions((prev) => replace ? data.sessions : [...prev, ...data.sessions]);
      setTotal(data.total);
      setError(null);
    } catch {
      setError('Could not load history.');
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchPage(0, true);
      setLoading(false);
    })();
  }, []);

  function handleRefresh() {
    return onRefresh(() => fetchPage(0, true));
  }

  async function handleLoadMore() {
    if (loadingMore || sessions.length >= total) return;
    setLoadingMore(true);
    await fetchPage(sessions.length, false);
    setLoadingMore(false);
  }

  if (loading) return <LogoLoader />;

  if (error && sessions.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={handleRefresh} style={styles.retryButton}>
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="transparent"
            colors={['transparent']}
          />
        }
        ListHeaderComponent={<Text style={styles.heading}>History</Text>}
        ListEmptyComponent={<Text style={styles.emptyText}>No sessions yet.</Text>}
        ListFooterComponent={loadingMore ? <ActivityIndicator color={Colors.primary} style={{ marginVertical: 12 }} /> : null}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate('SessionDetail', { session: item })}
            activeOpacity={0.75}
          >
            <View style={[styles.badge, item.type === 'PUSH' ? styles.badgePush : styles.badgePull]}>
              <Text style={styles.badgeText}>{item.type}</Text>
            </View>
            <View style={styles.rowInfo}>
              <Text style={styles.rowDate}>{formatDate(item.startedAt)}</Text>
              <Text style={styles.rowMeta}>{item.durationMinutes} min · {item.pointsEarned} pts</Text>
            </View>
            <Text style={styles.rowArrow}>›</Text>
          </TouchableOpacity>
        )}
      />
      <LogoRefreshOverlay opacity={logoOpacity} scale={logoScale} top={insets.top + 6} />
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: Colors.background },
  center:      { flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', gap: 12 },
  heading:     { fontSize: 22, fontWeight: '700', color: Colors.text, padding: 20, paddingBottom: 12 },
  list:        { paddingBottom: 8, gap: 10 },
  emptyText:   { color: Colors.textMuted, textAlign: 'center', marginTop: 40 },
  errorText:   { color: Colors.error, textAlign: 'center' },
  retryButton: { paddingHorizontal: 20, paddingVertical: 8 },
  retryText:   { color: Colors.primary, fontSize: 14 },
  row:         { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 14, gap: 12, marginHorizontal: 16 },
  badge:       { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  badgePush:   { backgroundColor: `${Colors.primary}30` },
  badgePull:   { backgroundColor: `${Colors.gold}20` },
  badgeText:   { fontSize: 11, fontWeight: '700', color: Colors.text },
  rowInfo:     { flex: 1, gap: 2 },
  rowDate:     { fontSize: 15, fontWeight: '600', color: Colors.text },
  rowMeta:     { fontSize: 12, color: Colors.textMuted },
  rowArrow:    { fontSize: 20, color: Colors.textMuted },
});
