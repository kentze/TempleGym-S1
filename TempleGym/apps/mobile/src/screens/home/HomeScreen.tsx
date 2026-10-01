import { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Modal,
  Pressable,
  Animated,
  LayoutAnimation,
  Dimensions,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "../../constants/colors";
import { api } from "../../services/api";
import { useAuthStore } from "../../store/auth.store";
import { useWorkoutStore } from "../../store/workout.store";
import { useRoutinesStore } from "../../store/routines.store";
import type { MainStackParamList } from "../../navigation/types";
import type {
  Exercise,
  SessionType,
  WorkoutSession,
  WorkoutsListResponse,
} from "@templegym/types";

const TIERS = [
  { name: "Champion", min: 2801, color: Colors.champion },
  { name: "Master", min: 2001, color: Colors.masters },
  { name: "Diamond", min: 1401, color: Colors.diamond },
  { name: "Platinum", min: 901, color: Colors.platinum },
  { name: "Gold", min: 501, color: Colors.gold },
  { name: "Silver", min: 201, color: Colors.silver },
  { name: "Bronze", min: 1, color: Colors.bronze },
  { name: "Unranked", min: 0, color: Colors.unranked },
];

function getTier(pts: number) {
  return TIERS.find((t) => pts >= t.min) ?? TIERS[TIERS.length - 1];
}

function tierBg(pts: number) {
  const hex = getTier(pts).color;
  return hex + "18";
}

function tierOuterBg(pts: number) {
  const hex = getTier(pts).color;
  return hex + "0C"; // ~5% — very light halo on the outer card
}

type Nav = NativeStackNavigationProp<MainStackParamList, "Home">;
type Route = RouteProp<MainStackParamList, "Home">;

const SESSION_INFO: Record<
  SessionType,
  { label: string; description: string }
> = {
  PUSH: { label: "Push", description: "Chest, shoulders and triceps" },
  PULL: { label: "Pull", description: "Back, biceps and rear delts" },
  LEGS: { label: "Legs", description: "Quads, hamstrings, glutes and calves" },
  CARDIO: { label: "Cardio", description: "Running, cycling, rowing, etc." },
  FULL_BODY: {
    label: "Full Body",
    description: "A mix of upper and lower body exercises",
  },
};

const SESSION_CARDS = (Object.keys(SESSION_INFO) as SessionType[]).map(
  (type) => ({ type, ...SESSION_INFO[type] }),
);

function suggestedSession(lastType: SessionType | null): SessionType {
  if (!lastType || lastType === "CARDIO" || lastType === "FULL_BODY") return "PUSH";
  if (lastType === "PUSH") return "PULL";
  if (lastType === "PULL") return "LEGS";
  return "PUSH"; // LEGS → back to start of PPL cycle
}

function detectType(exs: { category: SessionType }[]): SessionType {
  if (!exs.length) return "PUSH";
  const counts = {} as Record<SessionType, number>;
  for (const e of exs) counts[e.category] = (counts[e.category] ?? 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] as SessionType;
}

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const startSession = useWorkoutStore((s) => s.startSession);

  const {
    folders,
    defaultItems,
    _defaultOpen,
    hydrate,
    addFolder,
    toggleFolder,
    addToFolder,
    addToDefault,
    setDefaultOpen,
    removeRoutineItem,
    duplicateRoutineItem,
    replaceRoutineItem,
    deleteFolder,
    deleteDefaultFolder,
    _defaultHidden,
  } = useRoutinesStore();
  const defaultRoutineName = "My Routine";

  const [lastWorkout, setLastWorkout] = useState<WorkoutSession | null>(null);
  const [infoVisible, setInfoVisible] = useState(false);
  const [planVisible, setPlanVisible] = useState(false);
  const [routineExpanded, setRoutineExpanded] = useState(false);
  const [folderVisible, setFolderVisible] = useState(false);
  const [newRoutineName, setNewRoutineName] = useState("");
  const [glowingId, setGlowingId] = useState<number | "default" | null>(null);
  const [popupId, setPopupId] = useState<number | "default" | null>(null);
  const [popupTop, setPopupTop] = useState(0);

  // 3-dot card popup: key is `"folderId:itemIndex"`
  const [cardMenuKey, setCardMenuKey] = useState<string | null>(null);
  const [cardMenuTop, setCardMenuTop] = useState(0);

  // Hydrate persisted routines on mount (scoped to logged-in user)
  useEffect(() => {
    if (user?.id) hydrate(user.id);
  }, [user?.id]);

  // Receive saved/updated routine navigated back from AddRoutineScreen
  useEffect(() => {
    const nr = route.params?.newRoutine;
    const idx = route.params?.replaceIndex;
    if (!nr) return;
    if (idx !== undefined) {
      replaceRoutineItem(nr.folderId, idx, nr);
    } else if (nr.folderId === "default") {
      addToDefault(nr);
    } else {
      addToFolder(nr.folderId as number, nr);
    }
    navigation.setParams({ newRoutine: undefined, replaceIndex: undefined });
  }, [route.params?.newRoutine]);

  function handleAddRoutine() {
    setNewRoutineName("");
    setFolderVisible(true);
  }

  function handleConfirmRoutine() {
    const name = newRoutineName.trim();
    if (!name) return;
    addFolder(name);
    setFolderVisible(false);
  }

  function handleBarbellPress(id: number | "default", pageY: number) {
    setGlowingId(id);
    setTimeout(() => setGlowingId(null), 600);
    setPopupTop(pageY - 16);
    setPopupId((prev) => (prev === id ? null : id));
  }
  const [refreshing, setRefreshing] = useState(false);

  // Temple-logo refresh indicator
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.7)).current;
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (refreshing) {
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 200,
          friction: 12,
        }),
      ]).start(() => {
        pulseRef.current = Animated.loop(
          Animated.sequence([
            Animated.timing(logoScale, {
              toValue: 1.12,
              duration: 500,
              useNativeDriver: true,
            }),
            Animated.timing(logoScale, {
              toValue: 0.93,
              duration: 500,
              useNativeDriver: true,
            }),
          ]),
        );
        pulseRef.current.start();
      });
    } else {
      pulseRef.current?.stop();
      pulseRef.current = null;
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 0.7,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [refreshing]);

  async function fetchHomeData() {
    await Promise.all([
      api
        .get<WorkoutsListResponse>("/me/workouts?limit=1")
        .then(({ data }) => {
          setLastWorkout(data.sessions[0] ?? null);
        })
        .catch(() => {}),
      api
        .get("/me")
        .then(({ data }) => setUser(data))
        .catch(() => {}),
    ]);
  }

  useEffect(() => {
    fetchHomeData();
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    await fetchHomeData();
    setRefreshing(false);
  }

  const firstName = user?.displayName ?? user?.email?.split("@")[0] ?? "there";

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const todayType = suggestedSession(lastWorkout?.type ?? null);
  const todaySession = SESSION_INFO[todayType];

  function openCardMenu(
    folderId: number | "default",
    index: number,
    pageY: number,
  ) {
    const key = `${folderId}:${index}`;
    const screenH = Dimensions.get("window").height;
    const menuH = 150; // 3 items ~41px each + 2 dividers + buffer
    const clamped = Math.min(pageY - 16, screenH - menuH - 20);
    setCardMenuTop(clamped);
    setCardMenuKey((prev) => (prev === key ? null : key));
  }

  function handleStart(type: SessionType) {
    setPlanVisible(false);
    setRoutineExpanded(false);
    startSession(type);
    navigation.navigate("SessionLogging");
  }

  function handleStartRoutine(exercises: Exercise[]) {
    setPlanVisible(false);
    setRoutineExpanded(false);
    startSession(detectType(exercises), exercises);
    navigation.navigate("SessionLogging");
  }

  // All routine items across every folder (custom + default)
  const allRoutineItems = [...defaultItems, ...folders.flatMap((f) => f.items)];

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 16 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="transparent"
            colors={["transparent"]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.date}>{today}</Text>
            <Text style={styles.greeting}>Hey, {firstName}</Text>
          </View>
          <TouchableOpacity
            style={styles.settingsBtn}
            onPress={() => navigation.navigate("Settings")}
          >
            <Ionicons
              name="settings-outline"
              size={22}
              color={Colors.textMuted}
            />
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View
          style={[
            styles.statsRow,
            (user?.weeklyPoints ?? 0) > 0 && {
              backgroundColor: tierOuterBg(user!.weeklyPoints),
            },
          ]}
        >
          <View style={[styles.statCard, { borderRadius: 10, padding: 8 }]}>
            <Text style={styles.statValue}>{user?.totalPoints ?? 0}</Text>
            <Text style={styles.statLabel}>Total Points</Text>
          </View>
          <View style={styles.statDivider} />
          <View
            style={[
              styles.statCard,
              {
                backgroundColor: tierBg(user?.weeklyPoints ?? 0),
                borderRadius: 10,
                padding: 8,
                margin: 7,
              },
            ]}
          >
            <Text
              style={[
                styles.statValue,
                { color: getTier(user?.weeklyPoints ?? 0).color },
              ]}
            >
              {user?.weeklyPoints ?? 0}
            </Text>
            <Text style={styles.statLabel}>This Week</Text>
            <Text
              style={[
                styles.statTier,
                { color: getTier(user?.weeklyPoints ?? 0).color },
              ]}
            >
              {getTier(user?.weeklyPoints ?? 0).name}
            </Text>
          </View>
        </View>

        {/* Today's Workout */}
        <View style={styles.todayHeader}>
          <Text style={styles.sectionLabel}>Today's Workout</Text>
          <TouchableOpacity onPress={() => setInfoVisible(true)} hitSlop={8}>
            <View style={styles.infoBtn}>
              <Text style={styles.infoBtnText}>?</Text>
            </View>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.ghostCard}
          onPress={() => setPlanVisible(true)}
          activeOpacity={0.75}
        >
          <Ionicons
            name="add-circle-outline"
            size={22}
            color={Colors.textMuted}
          />
          <View style={styles.ghostCardBody}>
            <Text style={styles.ghostCardTitle}>Plan today's workout</Text>
            <Text style={styles.ghostCardSub}>
              {todaySession.label} day recommended
            </Text>
          </View>
        </TouchableOpacity>

        {/* Start a Session */}
        <Text style={styles.sectionLabel}>Start a Session</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.sessionCardsScroll}
          contentContainerStyle={styles.sessionCardsContent}
        >
          {SESSION_CARDS.map((card) => (
            <TouchableOpacity
              key={card.type}
              style={styles.sessionScrollCard}
              onPress={() => handleStart(card.type)}
              activeOpacity={0.75}
            >
              <View style={styles.sessionScrollCardAccent} />
              <View style={styles.sessionScrollCardBody}>
                <Text style={styles.sessionScrollCardLabel}>{card.label}</Text>
                <Text style={styles.sessionScrollCardDesc}>{card.description}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Routines */}
        <View style={styles.routinesSectionHeader}>
          <Text style={styles.sectionLabel}>Routines</Text>
          <TouchableOpacity onPress={handleAddRoutine} hitSlop={8}>
            <Ionicons
              name="folder-open-outline"
              size={18}
              color={Colors.textMuted}
            />
          </TouchableOpacity>
        </View>

        {folders.map((routine) => (
          <View key={routine.id} style={styles.routineGroup}>
            <TouchableOpacity
              style={styles.routinesHeader}
              onPress={() => {
                LayoutAnimation.configureNext(
                  LayoutAnimation.Presets.easeInEaseOut,
                );
                toggleFolder(routine.id);
              }}
              activeOpacity={0.75}
            >
              <View
                style={{
                  transform: [{ rotate: routine.open ? "90deg" : "0deg" }],
                }}
              >
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={Colors.textMuted}
                />
              </View>
              <Text style={styles.routinesTitle}>{routine.name}</Text>
              <TouchableOpacity
                onPress={(e) =>
                  handleBarbellPress(routine.id, e.nativeEvent.pageY)
                }
                hitSlop={8}
              >
                <Ionicons
                  name="barbell-outline"
                  size={20}
                  color={
                    glowingId === routine.id ? Colors.primary : Colors.textMuted
                  }
                />
              </TouchableOpacity>
            </TouchableOpacity>

            {routine.open && (
              <View style={styles.routinesDropdown}>
                {routine.items.map((item, i) => (
                  <View key={i} style={styles.routineCard}>
                    <View style={styles.routineCardHeader}>
                      <Text style={styles.routineCardType}>{item.name}</Text>
                      <TouchableOpacity
                        onPress={(e) =>
                          openCardMenu(routine.id, i, e.nativeEvent.pageY)
                        }
                        hitSlop={8}
                      >
                        <Ionicons
                          name="ellipsis-horizontal"
                          size={18}
                          color={Colors.textMuted}
                        />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.routineCardCount}>
                      {item.exercises.length} exercise
                      {item.exercises.length !== 1 ? "s" : ""}
                    </Text>
                    {item.exercises.length === 0 ? (
                      <Text style={styles.routineCardEmpty}>No exercises</Text>
                    ) : (
                      item.exercises.map((ex, idx, arr) => (
                        <Text
                          key={`${ex.id}-${idx}`}
                          style={
                            idx === arr.length - 1
                              ? styles.routineCardLastEx
                              : styles.routineCardExercise
                          }
                        >
                          {ex.name}
                        </Text>
                      ))
                    )}
                    <TouchableOpacity
                      style={styles.routineCardStart}
                      onPress={() => handleStartRoutine(item.exercises)}
                    >
                      <Text style={styles.routineCardStartText}>Start</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}

        {/* Default My Routine */}
        {!_defaultHidden && <View style={styles.routineGroup}>
          <TouchableOpacity
            style={styles.routinesHeader}
            onPress={() => {
              LayoutAnimation.configureNext(
                LayoutAnimation.Presets.easeInEaseOut,
              );
              setDefaultOpen(!_defaultOpen);
            }}
            activeOpacity={0.75}
          >
            <View
              style={{
                transform: [{ rotate: _defaultOpen ? "90deg" : "0deg" }],
              }}
            >
              <Ionicons
                name="chevron-forward"
                size={18}
                color={Colors.textMuted}
              />
            </View>
            <Text style={styles.routinesTitle}>{defaultRoutineName}</Text>
            <TouchableOpacity
              onPress={(e) =>
                handleBarbellPress("default", e.nativeEvent.pageY)
              }
              hitSlop={8}
            >
              <Ionicons
                name="barbell-outline"
                size={20}
                color={
                  glowingId === "default" ? Colors.primary : Colors.textMuted
                }
              />
            </TouchableOpacity>
          </TouchableOpacity>

          {_defaultOpen && (
            <View style={styles.routinesDropdown}>
              {defaultItems.map((item, i) => (
                <View key={i} style={styles.routineCard}>
                  <View style={styles.routineCardHeader}>
                    <Text style={styles.routineCardType}>{item.name}</Text>
                    <TouchableOpacity
                      onPress={(e) =>
                        openCardMenu("default", i, e.nativeEvent.pageY)
                      }
                      hitSlop={8}
                    >
                      <Ionicons
                        name="ellipsis-horizontal"
                        size={18}
                        color={Colors.textMuted}
                      />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.routineCardCount}>
                    {item.exercises.length} exercise
                    {item.exercises.length !== 1 ? "s" : ""}
                  </Text>
                  {item.exercises.length === 0 ? (
                    <Text style={styles.routineCardEmpty}>No exercises</Text>
                  ) : (
                    item.exercises.map((ex, idx, arr) => (
                      <Text
                        key={ex.id}
                        style={
                          idx === arr.length - 1
                            ? styles.routineCardLastEx
                            : styles.routineCardExercise
                        }
                      >
                        {ex.name}
                      </Text>
                    ))
                  )}
                  <TouchableOpacity
                    style={styles.routineCardStart}
                    onPress={() => handleStartRoutine(item.exercises)}
                  >
                    <Text style={styles.routineCardStartText}>Start</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>}

        {/* Info Modal */}
        <Modal visible={infoVisible} transparent animationType="fade">
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setInfoVisible(false)}
          >
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Session Types</Text>
              <Text style={styles.modalBody}>
                <Text style={styles.modalBold}>Push</Text> — Chest, shoulders
                and triceps. Muscles involved in pushing movements.
              </Text>
              <Text style={styles.modalBody}>
                <Text style={styles.modalBold}>Pull</Text> — Back, biceps and
                rear delts. Muscles involved in pulling movements.
              </Text>
              <Text style={styles.modalBody}>
                <Text style={styles.modalBold}>Legs</Text> — Quads, hamstrings,
                glutes and calves.
              </Text>
              <Text style={styles.modalBody}>
                <Text style={styles.modalBold}>Cardio</Text> — Running, cycling,
                rowing, and other endurance work.
              </Text>
              <Text style={styles.modalBody}>
                <Text style={styles.modalBold}>Full Body</Text> — A mix of upper
                and lower body exercises.
              </Text>
              <Text style={styles.modalHint}>
                Today's suggestion follows a Push → Pull → Legs cycle based on
                your last session.
              </Text>
              <TouchableOpacity
                style={styles.modalClose}
                onPress={() => setInfoVisible(false)}
              >
                <Text style={styles.modalCloseText}>Got it</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>

        {/* Plan Picker Modal */}
        <Modal visible={planVisible} transparent animationType="fade">
          <Pressable
            style={styles.modalOverlay}
            onPress={() => {
              setPlanVisible(false);
              setRoutineExpanded(false);
            }}
          >
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Choose your session</Text>
              <Text style={styles.modalHint}>
                {todaySession.label} day recommended based on your last session.
              </Text>
              {SESSION_CARDS.map((card) => (
                <TouchableOpacity
                  key={card.type}
                  style={[
                    styles.sessionCard,
                    card.type === todayType && styles.planCardHighlight,
                  ]}
                  onPress={() => handleStart(card.type)}
                  activeOpacity={0.75}
                >
                  <View style={styles.sessionCardAccent} />
                  <View style={styles.sessionCardBody}>
                    <Text style={styles.sessionCardLabel}>{card.label}</Text>
                    <Text style={styles.sessionCardDesc}>
                      {card.description}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={Colors.primary}
                    style={styles.sessionCardChevron}
                  />
                </TouchableOpacity>
              ))}

              {/* Routine card */}
              <TouchableOpacity
                style={[
                  styles.sessionCard,
                  styles.routinePlanCard,
                  routineExpanded && styles.planCardHighlight,
                ]}
                onPress={() => setRoutineExpanded((v) => !v)}
                activeOpacity={0.75}
              >
                <View
                  style={[
                    styles.sessionCardAccent,
                    { backgroundColor: Colors.textMuted },
                  ]}
                />
                <View style={styles.sessionCardBody}>
                  <Text style={styles.sessionCardLabel}>Routine</Text>
                  <Text style={styles.sessionCardDesc}>
                    {allRoutineItems.length > 0
                      ? `${allRoutineItems.length} saved routine${allRoutineItems.length !== 1 ? "s" : ""}`
                      : "No routines yet"}
                  </Text>
                </View>
                <Ionicons
                  name={routineExpanded ? "chevron-down" : "chevron-forward"}
                  size={20}
                  color={Colors.textMuted}
                  style={styles.sessionCardChevron}
                />
              </TouchableOpacity>

              {routineExpanded &&
                (allRoutineItems.length === 0 ? (
                  <Text style={styles.planRoutineEmpty}>
                    Create a routine from the home screen first.
                  </Text>
                ) : (
                  allRoutineItems.map((item, i) => (
                    <TouchableOpacity
                      key={i}
                      style={styles.planRoutineItem}
                      onPress={() => handleStartRoutine(item.exercises)}
                      activeOpacity={0.75}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.planRoutineName}>{item.name}</Text>
                        <Text style={styles.planRoutineCount}>
                          {item.exercises.length} exercise
                          {item.exercises.length !== 1 ? "s" : ""}
                          {" · "}
                          {detectType(item.exercises)}
                        </Text>
                      </View>
                      <Ionicons
                        name="play-circle-outline"
                        size={22}
                        color={Colors.primary}
                      />
                    </TouchableOpacity>
                  ))
                ))}

              <TouchableOpacity
                style={styles.planCancelBtn}
                onPress={() => {
                  setPlanVisible(false);
                  setRoutineExpanded(false);
                }}
              >
                <Text style={styles.planCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>

        {/* New Folder Modal */}
        <Modal visible={folderVisible} transparent animationType="fade">
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setFolderVisible(false)}
          >
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>New Routine</Text>
              <TextInput
                style={styles.folderInput}
                placeholder="Routine name"
                placeholderTextColor={Colors.textMuted}
                value={newRoutineName}
                onChangeText={setNewRoutineName}
                autoFocus
                maxLength={30}
                onSubmitEditing={handleConfirmRoutine}
                returnKeyType="done"
              />
              <TouchableOpacity
                style={[
                  styles.modalClose,
                  !newRoutineName.trim() && { opacity: 0.4 },
                ]}
                onPress={handleConfirmRoutine}
                disabled={!newRoutineName.trim()}
              >
                <Text style={styles.modalCloseText}>Create</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.planCancelBtn}
                onPress={() => setFolderVisible(false)}
              >
                <Text style={styles.planCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>
      </ScrollView>

      {/* Temple-logo pull-to-refresh indicator */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.refreshLogoWrap,
          { top: insets.top + 6, opacity: logoOpacity },
        ]}
      >
        <Animated.Image
          source={require("../../../assets/temple-logo.png")}
          style={[styles.refreshLogoImg, { transform: [{ scale: logoScale }] }]}
        />
      </Animated.View>

      {/* 3-dot card menu popup */}
      {cardMenuKey !== null &&
        (() => {
          const [rawId, rawIdx] = cardMenuKey.split(":");
          const folderId = rawId === "default" ? "default" : Number(rawId);
          const itemIndex = Number(rawIdx);
          const item =
            folderId === "default"
              ? defaultItems[itemIndex]
              : folders.find((f) => f.id === folderId)?.items[itemIndex];
          const folderName =
            folderId === "default"
              ? defaultRoutineName
              : (folders.find((f) => f.id === folderId)?.name ?? "");
          if (!item) return null;
          return (
            <Pressable
              style={styles.popupOverlay}
              onPress={() => setCardMenuKey(null)}
            >
              <View style={[styles.cardMenu, { top: cardMenuTop }]}>
                <TouchableOpacity
                  style={styles.cardMenuItem}
                  onPress={() => {
                    setCardMenuKey(null);
                    navigation.navigate("AddRoutine", {
                      folderId,
                      folderName,
                      editIndex: itemIndex,
                      initialName: item.name,
                      initialExercises: item.exercises,
                    });
                  }}
                >
                  <Ionicons
                    name="pencil-outline"
                    size={16}
                    color={Colors.text}
                  />
                  <Text style={styles.cardMenuText}>Edit</Text>
                </TouchableOpacity>
                <View style={styles.cardMenuDivider} />
                <TouchableOpacity
                  style={styles.cardMenuItem}
                  onPress={() => {
                    duplicateRoutineItem(folderId, itemIndex);
                    setCardMenuKey(null);
                  }}
                >
                  <Ionicons name="copy-outline" size={16} color={Colors.text} />
                  <Text style={styles.cardMenuText}>Duplicate</Text>
                </TouchableOpacity>
                <View style={styles.cardMenuDivider} />
                <TouchableOpacity
                  style={styles.cardMenuItem}
                  onPress={() => {
                    removeRoutineItem(folderId, itemIndex);
                    setCardMenuKey(null);
                  }}
                >
                  <Ionicons
                    name="trash-outline"
                    size={16}
                    color={Colors.error}
                  />
                  <Text style={[styles.cardMenuText, { color: Colors.error }]}>
                    Delete
                  </Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          );
        })()}

      {/* Floating barbell popup — outside ScrollView so it overlays everything */}
      {popupId !== null &&
        (() => {
          const isDefault    = popupId === "default";
          const visibleCount = folders.length + (_defaultHidden ? 0 : 1);
          const canDelete    = visibleCount > 1;
          const folderName   = isDefault
            ? defaultRoutineName
            : (folders.find((f) => f.id === popupId)?.name ?? "");
          return (
            <Pressable
              style={styles.popupOverlay}
              onPress={() => setPopupId(null)}
            >
              <View style={[styles.barbellPopup, { top: popupTop }]}>
                <TouchableOpacity
                  style={styles.popupRow}
                  onPress={() => {
                    setPopupId(null);
                    navigation.navigate("AddRoutine", {
                      folderId: popupId!,
                      folderName,
                    });
                  }}
                  activeOpacity={0.75}
                >
                  <Ionicons name="add-circle-outline" size={16} color={Colors.primary} />
                  <Text style={styles.barbellPopupText}>Add new routine</Text>
                </TouchableOpacity>
                {canDelete && (
                  <>
                    <View style={styles.popupDivider} />
                    <TouchableOpacity
                      style={styles.popupRow}
                      onPress={() => {
                        setPopupId(null);
                        if (isDefault) {
                          deleteDefaultFolder();
                        } else {
                          deleteFolder(popupId as number);
                        }
                      }}
                      activeOpacity={0.75}
                    >
                      <Ionicons name="trash-outline" size={16} color={Colors.error} />
                      <Text style={[styles.barbellPopupText, { color: Colors.error }]}>Delete folder</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </Pressable>
          );
        })()}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, gap: 16, paddingBottom: 24 },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  date: { fontSize: 13, color: Colors.textMuted, marginBottom: 2 },
  greeting: { fontSize: 24, fontWeight: "700", color: Colors.text },
  settingsBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },

  // Today's Workout header row
  todayHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  infoBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.textMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  infoBtnText: { fontSize: 11, color: Colors.textMuted, fontWeight: "600" },

  // Ghost placeholder card
  ghostCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: "dashed",
    padding: 18,
    gap: 12,
  },
  ghostCardBody: { gap: 3 },
  ghostCardTitle: { fontSize: 15, fontWeight: "600", color: Colors.textMuted },
  ghostCardSub: { fontSize: 12, color: Colors.textMuted },

  // Stats
  statsRow: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 5,
  },
  statCard: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4 },
  statValue: { fontSize: 28, fontWeight: "700", color: Colors.primary },
  statLabel: { fontSize: 12, color: Colors.textMuted },
  statDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 8,
  },
  statTier: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 2,
    marginBottom: 4,
  },

  // Session cards
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  // Horizontal scroll cards (Start a Session)
  sessionCardsScroll: { marginHorizontal: -20 },
  sessionCardsContent: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
  },
  sessionScrollCard: {
    width: 130,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  sessionScrollCardAccent: {
    height: 4,
    backgroundColor: Colors.primary,
  },
  sessionScrollCardBody: {
    padding: 12,
    gap: 4,
  },
  sessionScrollCardLabel: { fontSize: 15, fontWeight: "700", color: Colors.text },
  sessionScrollCardDesc: { fontSize: 12, color: Colors.textMuted },
  // Full-width session cards (plan picker modal)
  sessionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  sessionCardAccent: {
    width: 4,
    alignSelf: "stretch",
    backgroundColor: Colors.primary,
  },
  sessionCardBody: {
    flex: 1,
    paddingVertical: 18,
    paddingHorizontal: 16,
    gap: 4,
  },
  sessionCardLabel: { fontSize: 17, fontWeight: "700", color: Colors.text },
  sessionCardDesc: { fontSize: 13, color: Colors.textMuted },
  sessionCardChevron: { marginRight: 16 },

  // Routines
  routinesSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  routineGroup: { gap: 10 },
  routinesHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    gap: 12,
  },
  routinesTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: Colors.text,
  },
  routinesDropdown: { gap: 10 },
  routineCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 4,
  },
  routineCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  routineCardType: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.text,
    flex: 1,
  },
  routineCardCount: { fontSize: 12, color: Colors.textMuted, marginBottom: 6 },
  routineCardEmpty: { fontSize: 13, color: Colors.textMuted, fontStyle: 'italic', paddingRight: 64 },
  routineCardExercise: { fontSize: 14, color: Colors.text },
  routineCardLastEx: { fontSize: 14, color: Colors.text, paddingRight: 64 },
  routineCardStart: {
    position: "absolute",
    right: 16,
    bottom: 10,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  routineCardStartText: { fontSize: 13, fontWeight: "700", color: Colors.text },

  // Info modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 24,
    gap: 12,
    width: "100%",
  },
  modalTitle: { fontSize: 17, fontWeight: "700", color: Colors.text },
  modalBody: { fontSize: 14, color: Colors.textMuted, lineHeight: 20 },
  modalBold: { fontWeight: "700", color: Colors.text },
  modalHint: { fontSize: 12, color: Colors.textMuted, fontStyle: "italic" },
  modalClose: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 4,
  },
  modalCloseText: { color: Colors.text, fontSize: 15, fontWeight: "600" },
  planCardHighlight: { borderColor: Colors.primary },
  popupOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  barbellPopup: {
    position: "absolute",
    right: 20,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  popupRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  popupDivider: { height: 1, backgroundColor: Colors.border },
  barbellPopupText: { fontSize: 13, color: Colors.text, fontWeight: "500" },
  folderInput: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: Colors.text,
    fontSize: 15,
    letterSpacing: 0,
  },
  refreshLogoWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 200,
  },
  refreshLogoImg: { width: 38, height: 38, resizeMode: "contain" },
  cardMenu: {
    position: "absolute",
    right: 20,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
    minWidth: 160,
  },
  cardMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  cardMenuText: { fontSize: 14, color: Colors.text, fontWeight: "500" },
  cardMenuDivider: { height: 1, backgroundColor: Colors.border },
  planCancelBtn: { paddingVertical: 10, alignItems: "center" },
  planCancelText: { color: Colors.textMuted, fontSize: 14 },
  routinePlanCard: { borderColor: Colors.border },
  planRoutineItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  planRoutineName: { fontSize: 15, fontWeight: "600", color: Colors.text },
  planRoutineCount: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  planRoutineEmpty: {
    fontSize: 13,
    color: Colors.textMuted,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 8,
  },
});
