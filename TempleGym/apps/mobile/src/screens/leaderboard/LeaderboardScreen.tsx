import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
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
import type { LeaderboardResponse, LeaderboardEntry } from '@templegym/types';

function formatReset(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

export default function LeaderboardScreen() {
  const user   = useAuthStore((s) => s.user);
  const insets = useSafeAreaInsets();

  const { refreshing, logoOpacity, logoScale, onRefresh } = useLogoRefresh();

  const [data, setData]       = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const { data: res } = await api.get<LeaderboardResponse>('/leaderboard/weekly');
      setData(res);
      setError(null);
    } catch {
      setError('Could not load leaderboard.');
    }
  }, []);

  useEffect(() => {
    (async () => {
      await fetchData();
      setLoading(false);
    })();
  }, []);

  function handleRefresh() {
    return onRefresh(fetchData);
  }

  if (loading) return <LogoLoader />;

  if (error || !data) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error ?? 'No data.'}</Text>
        <TouchableOpacity onPress={handleRefresh} style={styles.retryButton}>
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const myRank    = data.myRank;
  const isVisible = myRank ? data.entries.some((e) => e.userId === user?.id) : false;

  function rankColor(rank: number): string {
    if (rank === 1) return Colors.gold;
    if (rank === 2) return Colors.silver;
    if (rank === 3) return Colors.bronze;
    if (rank <= 10) return Colors.text;
    return Colors.textMuted;
  }

  function renderEntry({ item }: { item: LeaderboardEntry }) {
    const isMe  = item.userId === user?.id;
    const color = rankColor(item.rank);
    return (
      <View style={[styles.row, isMe && styles.rowHighlight, item.rank <= 3 && { borderColor: color + '60' }]}>
        <Text style={[styles.rank, { color }]}>{item.rank}</Text>
        <Text style={styles.name} numberOfLines={1}>
          {item.username}
          {isMe ? ' (you)' : ''}
        </Text>
        <Text style={[styles.score, { color }]}>{item.weeklyScore} pts</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <FlatList
        data={data.entries}
        keyExtractor={(item) => item.userId}
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
          <View style={styles.heading}>
            <Text style={styles.headingText}>Weekly Board</Text>
            <Text style={styles.headingMeta}>{data.week} · resets {formatReset(data.resetAt)}</Text>
          </View>
        }
        renderItem={renderEntry}
        ListEmptyComponent={<Text style={styles.emptyText}>No entries yet this week.</Text>}
      />

      {myRank && !isVisible && (
        <View style={styles.stickyFooter}>
          <Text style={styles.stickyText}>
            You — Rank {myRank.rank} — {myRank.weeklyScore} pts
          </Text>
        </View>
      )}
      <LogoRefreshOverlay opacity={logoOpacity} scale={logoScale} top={insets.top + 6} />
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: Colors.background },
  center:       { flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', gap: 12 },
  heading:      { padding: 20, paddingBottom: 12, gap: 4 },
  headingText:  { fontSize: 22, fontWeight: '700', color: Colors.text },
  headingMeta:  { fontSize: 12, color: Colors.textMuted },
  list:         { gap: 8, paddingBottom: 8 },
  emptyText:    { color: Colors.textMuted, textAlign: 'center', marginTop: 40 },
  errorText:    { color: Colors.error, textAlign: 'center' },
  retryButton:  { paddingHorizontal: 20, paddingVertical: 8 },
  retryText:    { color: Colors.primary, fontSize: 14 },
  row:          { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingVertical: 12, paddingHorizontal: 14, gap: 12, marginHorizontal: 16 },
  rowHighlight: { borderColor: Colors.primary, backgroundColor: Colors.primaryFaded },
  rank:         { width: 28, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  name:         { flex: 1, fontSize: 15, color: Colors.text },
  score:        { fontSize: 14, fontWeight: '600', color: Colors.primary },
  stickyFooter: { borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.primaryFaded, padding: 14, alignItems: 'center' },
  stickyText:   { fontSize: 14, fontWeight: '600', color: Colors.primary },
});
