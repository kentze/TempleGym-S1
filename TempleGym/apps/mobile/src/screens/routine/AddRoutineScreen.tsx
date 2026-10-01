import { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  PanResponder,
  Easing,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import type { MainStackParamList } from '../../navigation/types';
import type { Exercise } from '@templegym/types';

type Nav   = NativeStackNavigationProp<MainStackParamList, 'AddRoutine'>;
type Route = RouteProp<MainStackParamList, 'AddRoutine'>;

// Height of one row + the gap below it.
// Must match: exerciseRow vertical padding (12+12=24) + content (~44) + gap (8) ≈ 76
const ITEM_H = 76;

// All animations run on the JS thread so setValue/addListener stay in sync.
const TIMING = (v: Animated.Value, toValue: number, duration: number) =>
  Animated.timing(v, { toValue, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false });

export default function AddRoutineScreen() {
  const navigation = useNavigation<Nav>();
  const route      = useRoute<Route>();
  const { params } = route;
  const insets     = useSafeAreaInsets();

  const editIndexRef = useRef(params?.editIndex);
  const isEditing    = editIndexRef.current !== undefined;

  const [name, setName]           = useState(params?.initialName ?? '');
  const [exercises, setExercises] = useState<Exercise[]>(params?.initialExercises ?? []);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  // Y translation for the floating item
  const dragY = useRef(new Animated.Value(0)).current;

  // Refs read inside PanResponder callbacks (stale-closure safe)
  const activeRef     = useRef<number | null>(null);
  const targetRef     = useRef<number | null>(null);
  const exLenRef      = useRef(exercises.length);
  const listenerIdRef = useRef<string | null>(null);

  // Per-slot Y-shift animations (one value per visual position)
  const itemShifts = useRef<Animated.Value[]>(
    Array.from({ length: exercises.length }, () => new Animated.Value(0)),
  );
  const prCacheRef = useRef<Map<number, ReturnType<typeof PanResponder.create>>>(new Map());
  const prevLenRef = useRef(exercises.length);

  // Keep arrays in sync when exercises are added / removed
  if (prevLenRef.current !== exercises.length) {
    const old = itemShifts.current;
    itemShifts.current = Array.from(
      { length: exercises.length },
      (_, i) => old[i] ?? new Animated.Value(0),
    );
    prCacheRef.current.clear();
    prevLenRef.current = exercises.length;
    exLenRef.current   = exercises.length;
  }

  // Animate every neighbour to their new position given a from→to drag
  function animateNeighbours(from: number, to: number, duration = 160) {
    itemShifts.current.forEach((anim, i) => {
      if (i === from) return;
      let toValue = 0;
      if (from < to && i > from && i <= to) toValue = -ITEM_H;
      if (from > to && i < from && i >= to) toValue =  ITEM_H;
      TIMING(anim, toValue, duration).start();
    });
  }

  function stopAndReset() {
    itemShifts.current.forEach(v => { v.stopAnimation(); v.setValue(0); });
    dragY.stopAnimation();
    dragY.setValue(0);
  }

  function getPanResponder(index: number) {
    if (!prCacheRef.current.has(index)) {
      prCacheRef.current.set(index, PanResponder.create({
        onStartShouldSetPanResponder: () => true,

        onPanResponderGrant: () => {
          activeRef.current = index;
          targetRef.current = index;
          dragY.setValue(0);
          setDraggingIndex(index);

          // Animate neighbours directly from the Animated.Value — zero React
          // state updates means zero render lag during the gesture.
          listenerIdRef.current = dragY.addListener(({ value }) => {
            const from = activeRef.current;
            if (from === null) return;
            const next = Math.max(0, Math.min(
              exLenRef.current - 1,
              from + Math.round(value / ITEM_H),
            ));
            if (next === targetRef.current) return;
            targetRef.current = next;
            animateNeighbours(from, next);
          });
        },

        onPanResponderMove: (_, gs) => {
          dragY.setValue(gs.dy);
        },

        onPanResponderRelease: (_, gs) => {
          const from = activeRef.current;
          if (listenerIdRef.current) {
            dragY.removeListener(listenerIdRef.current);
            listenerIdRef.current = null;
          }
          if (from === null) return;

          const to = Math.max(0, Math.min(
            exLenRef.current - 1,
            from + Math.round(gs.dy / ITEM_H),
          ));

          // Snap the floating item to its exact landing position.
          // When the animation finishes, the dragged item is visually AT
          // layout[to], so resetting dragY to 0 and reordering the array
          // means layout[to] === visual position — no jump.
          const snapY = (to - from) * ITEM_H;
          animateNeighbours(from, to, 120);
          TIMING(dragY, snapY, 120).start(() => {
            stopAndReset();
            setExercises(prev => {
              const next = [...prev];
              const [item] = next.splice(from, 1);
              next.splice(to, 0, item);
              return next;
            });
            prCacheRef.current.clear();
            activeRef.current = null;
            targetRef.current = null;
            setDraggingIndex(null);
          });
        },

        onPanResponderTerminate: () => {
          if (listenerIdRef.current) {
            dragY.removeListener(listenerIdRef.current);
            listenerIdRef.current = null;
          }
          stopAndReset();
          prCacheRef.current.clear();
          activeRef.current = null;
          targetRef.current = null;
          setDraggingIndex(null);
        },
      }));
    }
    return prCacheRef.current.get(index)!;
  }

  function handleAddExercise() {
    navigation.navigate('ExercisePicker', {
      onSelect: (exercise) => setExercises(prev => [...prev, exercise]),
    });
  }

  function removeExercise(index: number) {
    setExercises(prev => prev.filter((_, i) => i !== index));
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Text style={styles.headerLabel}>{isEditing ? 'Editing in' : 'Adding to'}</Text>
          <Text style={styles.headerFolder}>{params.folderName}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={draggingIndex === null}
      >
        <Text style={styles.sectionLabel}>Routine Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Upper Body, Leg Day, Cardio..."
          placeholderTextColor={Colors.textMuted}
          value={name}
          onChangeText={setName}
          autoFocus
          maxLength={40}
          returnKeyType="done"
        />

        <Text style={[styles.sectionLabel, styles.sectionSpacing]}>Workout Content</Text>

        {exercises.length === 0 ? (
          <View style={styles.emptyContent}>
            <Ionicons name="barbell-outline" size={28} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No exercises added yet</Text>
          </View>
        ) : (
          <View style={styles.exerciseList}>
            {exercises.map((ex, i) => {
              const isDragging = draggingIndex === i;
              const shiftAnim  = itemShifts.current[i] ?? new Animated.Value(0);
              return (
                <Animated.View
                  key={`${ex.id}-${i}`}
                  style={{
                    transform:  [{ translateY: isDragging ? dragY : shiftAnim }],
                    zIndex:     isDragging ? 99 : 1,
                    // Shadow only on the active item (iOS)
                    shadowColor:   isDragging ? '#000' : 'transparent',
                    shadowOpacity: isDragging ? 0.2 : 0,
                    shadowRadius:  isDragging ? 8 : 0,
                    shadowOffset:  { width: 0, height: isDragging ? 4 : 0 },
                    // Android elevation
                    elevation: isDragging ? 10 : 0,
                  }}
                >
                  <View style={[styles.exerciseRow, isDragging && styles.exerciseRowDragging]}>
                    <View style={styles.exerciseOrder} {...getPanResponder(i).panHandlers}>
                      <Text style={styles.exerciseOrderNum}>{i + 1}</Text>
                    </View>
                    <View style={styles.exerciseInfo}>
                      <Text style={styles.exerciseName}>{ex.name}</Text>
                      <Text style={styles.exerciseMuscles}>{ex.muscleGroups.join(', ')}</Text>
                    </View>
                    <TouchableOpacity onPress={() => removeExercise(i)} hitSlop={8}>
                      <Ionicons name="close-circle-outline" size={22} color={Colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              );
            })}
          </View>
        )}

        <TouchableOpacity style={styles.addExerciseBtn} onPress={handleAddExercise} activeOpacity={0.75}>
          <Ionicons name="add-circle-outline" size={18} color={Colors.primary} />
          <Text style={styles.addExerciseBtnText}>+ Exercise</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[styles.saveBtn, !name.trim() && styles.saveBtnDisabled]}
          onPress={() => {
            navigation.navigate('Home', {
              newRoutine: {
                folderId:  params.folderId,
                name:      name.trim(),
                exercises,
              },
              replaceIndex: editIndexRef.current,
            });
          }}
          disabled={!name.trim()}
        >
          <Text style={styles.saveBtnText}>{isEditing ? 'Update Routine' : 'Save Routine'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:            { flex: 1, backgroundColor: Colors.background },
  header:               { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 12 },
  backBtn:              { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  headerTitle:          { gap: 1 },
  headerLabel:          { fontSize: 11, color: Colors.textMuted, fontWeight: '500' },
  headerFolder:         { fontSize: 16, fontWeight: '700', color: Colors.text },
  content:              { padding: 20, gap: 10, paddingBottom: 24 },
  sectionLabel:         { fontSize: 12, fontWeight: '600', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  sectionSpacing:       { marginTop: 12 },
  input:                { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: Colors.text, fontSize: 16, letterSpacing: 0 },
  emptyContent:         { alignItems: 'center', paddingVertical: 24, gap: 8, backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
  emptyText:            { fontSize: 13, color: Colors.textMuted },
  exerciseList:         { gap: 8 },
  exerciseRow:          { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 12, gap: 12 },
  exerciseRowDragging:  { borderColor: Colors.primary },
  exerciseOrder:        { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primaryFaded, alignItems: 'center', justifyContent: 'center' },
  exerciseOrderNum:     { fontSize: 13, fontWeight: '700', color: Colors.primary },
  exerciseInfo:         { flex: 1, gap: 2 },
  exerciseName:         { fontSize: 15, fontWeight: '600', color: Colors.text },
  exerciseMuscles:      { fontSize: 12, color: Colors.textMuted },
  addExerciseBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: Colors.border, borderStyle: 'dashed', borderRadius: 12, paddingVertical: 14, marginTop: 4 },
  addExerciseBtnText:   { fontSize: 15, fontWeight: '600', color: Colors.primary },
  footer:               { padding: 16, paddingTop: 0, borderTopWidth: 1, borderTopColor: Colors.border },
  saveBtn:              { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  saveBtnDisabled:      { opacity: 0.4 },
  saveBtnText:          { color: Colors.text, fontSize: 16, fontWeight: '700' },
});
