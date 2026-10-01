import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ScrollView,
} from 'react-native';
import LogoLoader from '../../components/LogoLoader';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { api } from '../../services/api';
import type { MainStackParamList } from '../../navigation/types';
import type { Exercise, SessionType } from '@templegym/types';

type Nav   = NativeStackNavigationProp<MainStackParamList, 'ExercisePicker'>;
type Route = RouteProp<MainStackParamList, 'ExercisePicker'>;

const CATEGORIES: { key: SessionType; label: string; subtitle: string }[] = [
  { key: 'PUSH',      label: 'Push',      subtitle: 'Chest · Shoulders · Triceps' },
  { key: 'PULL',      label: 'Pull',      subtitle: 'Back · Biceps · Rear Delts' },
  { key: 'LEGS',      label: 'Legs',      subtitle: 'Quads · Hamstrings · Glutes · Calves' },
  { key: 'CARDIO',    label: 'Cardio',    subtitle: 'Running · Cycling · Rowing' },
  { key: 'FULL_BODY', label: 'Full Body', subtitle: 'Compound · Multi-muscle' },
];

export default function ExercisePickerScreen() {
  const navigation  = useNavigation<Nav>();
  const { params }  = useRoute<Route>();
const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState<SessionType>('PUSH');

  useEffect(() => {
    api.get<Exercise[]>('/exercises')
      .then(({ data }) => setExercises(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleSelect(exercise: Exercise) {
    params.onSelect(exercise);
    navigation.goBack();
  }

  const filtered = activeTab === 'FULL_BODY'
    ? exercises.filter((e) => e.category === 'PUSH' || e.category === 'PULL' || e.category === 'FULL_BODY')
    : exercises.filter((e) => e.category === activeTab);

  if (loading) return <LogoLoader />;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pick an Exercise</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Category tabs */}
      <View style={styles.tabsWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabs}
        >
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.key}
              style={[styles.tab, activeTab === cat.key && styles.tabActive]}
              onPress={() => setActiveTab(cat.key)}
            >
              <Text style={[styles.tabText, activeTab === cat.key && styles.tabTextActive]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Exercise list */}
      <FlatList
        style={{ flex: 1 }}
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.slider}
        ListHeaderComponent={
          <Text style={styles.subtitle}>
            {CATEGORIES.find((c) => c.key === activeTab)?.subtitle}
          </Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => handleSelect(item)}
            activeOpacity={0.8}
          >
            <View style={styles.cardAccent} />
            <View style={styles.cardBody}>
              <Text style={styles.cardCategory}>{item.category}</Text>
              <Text style={styles.cardName}>{item.name}</Text>
              {item.subCategory ? (
                <Text style={styles.cardSub}>{item.subCategory}</Text>
              ) : null}
              <View style={styles.cardMuscleList}>
                {item.muscleGroups.map((m) => (
                  <View key={m} style={styles.musclePill}>
                    <Text style={styles.musclePillText}>{m}</Text>
                  </View>
                ))}
              </View>
            </View>
            <View style={styles.cardSelectRow}>
              <Text style={styles.cardSelectText}>Tap to select</Text>
              <Ionicons name="arrow-forward-circle-outline" size={18} color={Colors.primary} />
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>No exercises found.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: Colors.background },
  header:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn:         { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  headerTitle:     { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: Colors.text },
  headerSpacer:    { width: 36 },
  tabsWrap:        { height: 58, overflow: 'hidden' },
  tabs:            { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4, alignItems: 'flex-start' },
  tab:             { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  tabActive:       { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText:         { fontSize: 14, fontWeight: '600', color: Colors.textMuted },
  tabTextActive:   { color: Colors.text },
  subtitle:        { fontSize: 12, color: Colors.textMuted, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  loader:          { marginTop: 60 },
  slider:          { paddingHorizontal: 20, paddingBottom: 24, gap: 12, flexGrow: 1 },
  card:            { backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  cardAccent:      { height: 4, backgroundColor: Colors.primary },
  cardBody:        { padding: 16, gap: 6 },
  cardCategory:    { fontSize: 10, fontWeight: '700', color: Colors.primary, letterSpacing: 1, textTransform: 'uppercase' },
  cardName:        { fontSize: 17, fontWeight: '700', color: Colors.text, lineHeight: 22 },
  cardSub:         { fontSize: 12, color: Colors.textMuted },
  cardMuscleList:  { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  musclePill:      { backgroundColor: Colors.primaryFaded, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  musclePillText:  { fontSize: 11, color: Colors.primary, fontWeight: '500' },
  cardSelectRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: Colors.border, paddingHorizontal: 16, paddingVertical: 10 },
  cardSelectText:  { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  emptyWrap:       { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyText:       { fontSize: 14, color: Colors.textMuted },
});
