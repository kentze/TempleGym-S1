import { View, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Colors } from '../constants/colors';
import BottomTabBar from './BottomTabBar';
import { MainStackParamList } from './types';
import { useAuthStore } from '../store/auth.store';

const TIERS = [
  { min: 2801, color: Colors.champion },
  { min: 2001, color: Colors.masters },
  { min: 1401, color: Colors.diamond },
  { min: 901,  color: Colors.platinum },
  { min: 501,  color: Colors.gold },
  { min: 201,  color: Colors.silver },
  { min: 1,    color: Colors.bronze },
  { min: 0,    color: null },       // Unranked — no tint
];

function tierTint(pts: number): string | null {
  const tier = TIERS.find((t) => pts >= t.min) ?? TIERS[TIERS.length - 1];
  return tier.color ? tier.color + '0A' : null; // ~4% opacity
}

import HomeScreen           from '../screens/home/HomeScreen';
import WorkoutScreen        from '../screens/workout/WorkoutScreen';
import SessionLoggingScreen from '../screens/workout/SessionLoggingScreen';
import HistoryScreen        from '../screens/history/HistoryScreen';
import SessionDetailScreen  from '../screens/history/SessionDetailScreen';
import LeaderboardScreen    from '../screens/leaderboard/LeaderboardScreen';
import StatsScreen          from '../screens/stats/StatsScreen';
import SettingsScreen       from '../screens/settings/SettingsScreen';
import AddRoutineScreen      from '../screens/routine/AddRoutineScreen';
import ExercisePickerScreen  from '../screens/routine/ExercisePickerScreen';

const Stack = createNativeStackNavigator<MainStackParamList>();

export default function AppNavigator() {
  const weeklyPoints = useAuthStore((s) => s.user?.weeklyPoints ?? 0);
  const tint         = tierTint(weeklyPoints);

  return (
    <View style={styles.container}>
      {tint ? <View style={[StyleSheet.absoluteFill, { backgroundColor: tint, zIndex: 999 }]} pointerEvents="none" /> : null}
      <View style={styles.content}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Home"           component={HomeScreen} />
          <Stack.Screen name="Workout"        component={WorkoutScreen} />
          <Stack.Screen name="SessionLogging" component={SessionLoggingScreen} />
          <Stack.Screen name="History"        component={HistoryScreen} />
          <Stack.Screen name="SessionDetail"  component={SessionDetailScreen} />
          <Stack.Screen name="Leaderboard"    component={LeaderboardScreen} />
          <Stack.Screen name="Stats"           component={StatsScreen} />
          <Stack.Screen name="Settings"       component={SettingsScreen} />
          <Stack.Screen name="AddRoutine"      component={AddRoutineScreen} />
          <Stack.Screen name="ExercisePicker" component={ExercisePickerScreen} options={{ presentation: 'modal' }} />
        </Stack.Navigator>
      </View>
      <BottomTabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'column', backgroundColor: Colors.background },
  content:   { flex: 1 },
});
