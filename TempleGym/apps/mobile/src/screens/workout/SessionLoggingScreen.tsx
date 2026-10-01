import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import LogoLoader from '../../components/LogoLoader';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/auth.store';
import { useWorkoutStore } from '../../store/workout.store';
import { useGps } from '../../hooks/useGps';
import type { MainStackParamList } from '../../navigation/types';
import type { Exercise } from '@templegym/types';

type Nav = NativeStackNavigationProp<MainStackParamList, 'SessionLogging'>;

interface SetInputs {
  weightKg: string;
  reps: string;
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function SessionLoggingScreen() {
  const navigation    = useNavigation<Nav>();
  const insets        = useSafeAreaInsets();
  const user          = useAuthStore((s) => s.user);
  const preferMetric  = user?.preferMetric ?? true;
  const { activeSession, addExercise, addSet, endSession, isSubmitting, clearSession } = useWorkoutStore();
  const { getCoords }  = useGps();

  const [elapsed, setElapsed]                   = useState(0);
  const [availableExercises, setAvailableExercises] = useState<Exercise[]>([]);
  const [pickerVisible, setPickerVisible]        = useState(false);
  const [pickerLoading, setPickerLoading]        = useState(false);
  const [setInputs, setSetInputs]                = useState<Record<string, SetInputs>>({});
  const [error, setError]                        = useState<string | null>(null);

  useEffect(() => {
    if (!activeSession) {
      navigation.goBack();
      return;
    }
    const start   = activeSession.startedAt.getTime();
    const tick    = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeSession]);

  const fetchExercises = useCallback(async () => {
    if (!activeSession) return;
    setPickerLoading(true);
    try {
      const { data } = await api.get<Exercise[]>('/exercises', {
        params: { sessionType: activeSession.type },
      });
      setAvailableExercises(data);
    } catch {
      setError('Could not load exercises.');
    } finally {
      setPickerLoading(false);
    }
  }, [activeSession?.type]);

  function openPicker() {
    if (availableExercises.length === 0) fetchExercises();
    setPickerVisible(true);
  }

  function handlePickExercise(exercise: Exercise) {
    addExercise(exercise);
    setPickerVisible(false);
  }

  function updateSetInput(slotKey: string, field: keyof SetInputs, value: string) {
    setSetInputs((prev) => ({
      ...prev,
      [slotKey]: { ...prev[slotKey], [field]: value },
    }));
  }

  function handleAddSet(slotKey: string) {
    const inputs = setInputs[slotKey];
    const weight = parseFloat(inputs?.weightKg ?? '');
    const reps   = parseInt(inputs?.reps ?? '', 10);
    if (isNaN(weight) || weight < 0 || isNaN(reps) || reps < 1) {
      setError('Enter valid weight and reps before adding a set.');
      return;
    }
    const maxWeight = preferMetric ? 250 : 550;
    if (weight > maxWeight) {
      setError(`Weight cannot exceed ${maxWeight} ${preferMetric ? 'kg' : 'lbs'} per set.`);
      return;
    }
    if (reps > 50) {
      setError('Reps cannot exceed 50 per set.');
      return;
    }
    setError(null);
    const weightKg = preferMetric ? weight : weight / 2.20462;
    addSet(slotKey, { weightKg, reps });
    setSetInputs((prev) => ({ ...prev, [slotKey]: { weightKg: '', reps: '' } }));
  }

  async function handleEndSession() {
    if (!activeSession) return;
    const exercisesWithSets = activeSession.exercises.filter((e) => e.sets.length > 0);
    if (exercisesWithSets.length === 0) {
      Alert.alert('No sets logged', 'Add at least one set before ending the session.');
      return;
    }
    let lat: number | undefined;
    let lng: number | undefined;
    if (user?.gpsEnabled) {
      const coords = await getCoords();
      if (coords) { lat = coords.latitude; lng = coords.longitude; }
    }
    try {
      await endSession(lat, lng);
      navigation.goBack();
    } catch {
      setError('Failed to save session. Try again.');
    }
  }

  function handleDiscard() {
    Alert.alert('Discard session', 'Are you sure you want to discard this session?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => { clearSession(); navigation.goBack(); } },
    ]);
  }

  if (!activeSession) return null;

  const addedIds = new Set(activeSession.exercises.map((e) => e.exerciseId));
  const pickable = availableExercises.filter((e) => !addedIds.has(e.id));

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <View>
          <Text style={styles.sessionType}>{activeSession.type} Session</Text>
          <Text style={styles.timer}>{formatElapsed(elapsed)}</Text>
        </View>
        <TouchableOpacity onPress={handleDiscard}>
          <Text style={styles.discard}>Discard</Text>
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {activeSession.exercises.map((ex) => (
          <View key={ex.slotKey} style={styles.exerciseCard}>
            <Text style={styles.exerciseName}>{ex.name}</Text>

            {ex.sets.map((s) => {
              const displayWeight = preferMetric
                ? `${s.weightKg}kg`
                : `${(s.weightKg * 2.20462).toFixed(1)}lbs`;
              return (
                <Text key={s.setNumber} style={styles.setRow}>
                  Set {s.setNumber}: {displayWeight} x {s.reps} reps
                </Text>
              );
            })}

            <View style={styles.setInputRow}>
              <TextInput
                style={styles.setInput}
                placeholder={preferMetric ? 'kg' : 'lbs'}
                placeholderTextColor={Colors.textMuted}
                keyboardType="decimal-pad"
                value={setInputs[ex.slotKey]?.weightKg ?? ''}
                onChangeText={(v) => updateSetInput(ex.slotKey, 'weightKg', v)}
              />
              <TextInput
                style={styles.setInput}
                placeholder="reps"
                placeholderTextColor={Colors.textMuted}
                keyboardType="number-pad"
                value={setInputs[ex.slotKey]?.reps ?? ''}
                onChangeText={(v) => updateSetInput(ex.slotKey, 'reps', v)}
              />
              <TouchableOpacity
                style={styles.addSetButton}
                onPress={() => handleAddSet(ex.slotKey)}
              >
                <Text style={styles.addSetButtonText}>+ Set</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.addExerciseButton} onPress={openPicker}>
          <Text style={styles.addExerciseText}>Add Exercise</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[styles.endButton, isSubmitting && styles.endButtonDisabled]}
          onPress={handleEndSession}
          disabled={isSubmitting}
        >
          {isSubmitting
            ? <ActivityIndicator color={Colors.text} />
            : <Text style={styles.endButtonText}>End Session</Text>
          }
        </TouchableOpacity>
      </View>

      <Modal visible={pickerVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPickerVisible(false)}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Exercise</Text>
            <TouchableOpacity onPress={() => setPickerVisible(false)}>
              <Text style={styles.modalClose}>Done</Text>
            </TouchableOpacity>
          </View>
          {pickerLoading
            ? <LogoLoader />
            : (
              <FlatList
                data={pickable}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.pickerRow} onPress={() => handlePickExercise(item)}>
                    <View>
                      <Text style={styles.pickerName}>{item.name}</Text>
                      <Text style={styles.pickerMuscles}>{item.muscleGroups.join(', ')}</Text>
                    </View>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={<Text style={styles.emptyText}>All exercises already added.</Text>}
              />
            )
          }
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: Colors.background },
  header:             { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border },
  sessionType:        { fontSize: 13, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
  timer:              { fontSize: 32, fontWeight: '700', color: Colors.text, fontVariant: ['tabular-nums'] },
  discard:            { color: Colors.error, fontSize: 14 },
  error:              { color: Colors.error, fontSize: 13, textAlign: 'center', paddingHorizontal: 20, paddingTop: 8 },
  scroll:             { flex: 1 },
  scrollContent:      { padding: 16, gap: 12 },
  exerciseCard:       { backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 14, gap: 8 },
  exerciseName:       { fontSize: 16, fontWeight: '600', color: Colors.text },
  setRow:             { fontSize: 13, color: Colors.textMuted },
  setInputRow:        { flexDirection: 'row', gap: 8, alignItems: 'center' },
  setInput:           { flex: 1, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: Colors.text, fontSize: 14, letterSpacing: 0 },
  addSetButton:       { backgroundColor: Colors.primaryFaded, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  addSetButtonText:   { color: Colors.primary, fontSize: 14, fontWeight: '600' },
  addExerciseButton:  { borderWidth: 1, borderColor: Colors.border, borderRadius: 12, borderStyle: 'dashed', paddingVertical: 14, alignItems: 'center' },
  addExerciseText:    { color: Colors.textMuted, fontSize: 15 },
  footer:             { padding: 16, paddingBottom: 0, borderTopWidth: 1, borderTopColor: Colors.border },
  endButton:          { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  endButtonDisabled:  { opacity: 0.6 },
  endButtonText:      { color: Colors.text, fontSize: 16, fontWeight: '700' },
  modal:              { flex: 1, backgroundColor: Colors.background },
  modalHeader:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle:         { fontSize: 18, fontWeight: '700', color: Colors.text },
  modalClose:         { color: Colors.primary, fontSize: 16 },
  pickerRow:          { padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  pickerName:         { fontSize: 16, color: Colors.text },
  pickerMuscles:      { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  emptyText:          { textAlign: 'center', color: Colors.textMuted, marginTop: 32 },
});
