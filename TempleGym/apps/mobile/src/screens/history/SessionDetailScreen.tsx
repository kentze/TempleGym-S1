import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { useAuthStore } from '../../store/auth.store';
import type { MainStackParamList } from '../../navigation/types';

type Nav   = NativeStackNavigationProp<MainStackParamList, 'SessionDetail'>;
type Route = RouteProp<MainStackParamList, 'SessionDetail'>;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}

export default function SessionDetailScreen() {
  const navigation   = useNavigation<Nav>();
  const insets       = useSafeAreaInsets();
  const { params }   = useRoute<Route>();
  const { session }  = params;
  const preferMetric = useAuthStore((s) => s.user?.preferMetric ?? true);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <View style={[styles.badge, session.type === 'PUSH' ? styles.badgePush : styles.badgePull]}>
          <Text style={styles.badgeText}>{session.type}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.date}>{formatDate(session.startedAt)}</Text>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{session.durationMinutes}</Text>
            <Text style={styles.statLabel}>min</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{session.pointsEarned}</Text>
            <Text style={styles.statLabel}>pts</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: session.gpsVerified ? Colors.success : Colors.textMuted }]}>
              {session.gpsVerified ? 'Yes' : 'No'}
            </Text>
            <Text style={styles.statLabel}>GPS</Text>
          </View>
        </View>

        {session.exercises.map((ex: { id: string; exerciseId: string; exercise?: { name: string }; sets: unknown }) => (
          <View key={ex.id} style={styles.exerciseCard}>
            <Text style={styles.exerciseName}>{ex.exercise?.name ?? ex.exerciseId}</Text>
            {(ex.sets as { setNumber: number; weightKg: number; reps: number }[]).map((s) => {
              const displayWeight = preferMetric
                ? `${s.weightKg}kg`
                : `${(s.weightKg * 2.20462).toFixed(1)}lbs`;
              return (
                <Text key={s.setNumber} style={styles.setRow}>
                  Set {s.setNumber}: {displayWeight} x {s.reps} reps
                </Text>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: Colors.background },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border },
  back:         { color: Colors.primary, fontSize: 16 },
  badge:        { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  badgePush:    { backgroundColor: `${Colors.primary}30` },
  badgePull:    { backgroundColor: `${Colors.gold}20` },
  badgeText:    { fontSize: 12, fontWeight: '700', color: Colors.text },
  content:      { padding: 20, gap: 16 },
  date:         { fontSize: 18, fontWeight: '600', color: Colors.text },
  statsRow:     { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 16 },
  stat:         { flex: 1, alignItems: 'center', gap: 4 },
  statValue:    { fontSize: 20, fontWeight: '700', color: Colors.primary },
  statLabel:    { fontSize: 12, color: Colors.textMuted },
  statDivider:  { width: 1, backgroundColor: Colors.border, marginHorizontal: 8 },
  exerciseCard: { backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 14, gap: 6 },
  exerciseName: { fontSize: 15, fontWeight: '600', color: Colors.text, marginBottom: 4 },
  setRow:       { fontSize: 13, color: Colors.textMuted },
});
