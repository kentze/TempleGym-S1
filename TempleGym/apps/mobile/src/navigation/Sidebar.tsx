import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import { Colors } from '../constants/colors';

const NAV_ITEMS = [
  { key: 'Home',        label: 'Home' },
  { key: 'History',     label: 'History' },
  { key: 'Leaderboard', label: 'Board' },
  { key: 'Favourites',  label: 'Fav' },
] as const;

function activeBase(name: string): string {
  if (name === 'Workout' || name === 'SessionLogging') return 'Home';
  if (name === 'SessionDetail')                        return 'History';
  return name;
}

export default function Sidebar() {
  const navigation = useNavigation<any>();
  const routeName  = useNavigationState((s) => s?.routes[s?.index ?? 0]?.name ?? 'Home');
  const active     = activeBase(routeName);

  return (
    <View style={styles.sidebar}>
      {NAV_ITEMS.map((item) => (
        <TouchableOpacity
          key={item.key}
          style={[styles.item, active === item.key && styles.itemActive]}
          onPress={() => navigation.navigate(item.key)}
        >
          <Text style={[styles.label, active === item.key && styles.labelActive]}>{item.label}</Text>
        </TouchableOpacity>
      ))}
      <View style={styles.spacer} />
      <TouchableOpacity
        style={[styles.item, active === 'Settings' && styles.itemActive]}
        onPress={() => navigation.navigate('Settings')}
      >
        <Text style={[styles.label, active === 'Settings' && styles.labelActive]}>Settings</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar:     { width: 56, backgroundColor: Colors.surfaceDeep, alignItems: 'center', paddingVertical: 16, gap: 4, borderRightWidth: 1, borderRightColor: Colors.border },
  item:        { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 2 },
  itemActive:  { backgroundColor: `${Colors.primary}1a` },
  label:       { fontSize: 9, color: Colors.textMuted },
  labelActive: { color: Colors.primary },
  spacer:      { flex: 1 },
});
