import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../../constants/colors';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/auth.store';
import type { UpdateProfileBody, UserProfile } from '@templegym/types';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user, setUser, logout } = useAuthStore();

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [gpsEnabled, setGpsEnabled]               = useState(user?.gpsEnabled ?? true);
  const [preferMetric, setPreferMetric]             = useState(user?.preferMetric ?? true);
  const [leaderboardAnonymous, setLeaderboardAnonymous] = useState(user?.leaderboardAnonymous ?? false);

  // Display values — stored in metric, shown in user's preferred unit
  const [heightDisplay, setHeightDisplay] = useState(() => {
    const h = user?.heightCm;
    if (!h) return '';
    return (user?.preferMetric ? h : h / 2.54).toFixed(1);
  });
  const [weightDisplay, setWeightDisplay] = useState(() => {
    const w = user?.weightKg;
    if (!w) return '';
    return (user?.preferMetric ? w : w * 2.20462).toFixed(1);
  });

  function handleUnitToggle(toMetric: boolean) {
    setPreferMetric(toMetric);
    const h = parseFloat(heightDisplay);
    const w = parseFloat(weightDisplay);
    if (toMetric) {
      // imperial → metric
      if (!isNaN(h)) setHeightDisplay((h * 2.54).toFixed(1));
      if (!isNaN(w)) setWeightDisplay((w / 2.20462).toFixed(1));
    } else {
      // metric → imperial
      if (!isNaN(h)) setHeightDisplay((h / 2.54).toFixed(1));
      if (!isNaN(w)) setWeightDisplay((w * 2.20462).toFixed(1));
    }
  }
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [saved, setSaved]             = useState(false);

  async function handleSave() {
    setError(null);
    setSaved(false);
    setSaving(true);

    const body: UpdateProfileBody = {
      gpsEnabled,
      preferMetric,
      leaderboardAnonymous,
    };
    if (displayName.trim()) {
      if (displayName.trim().length < 2) {
        setError('Display name must be at least 2 characters.');
        setSaving(false);
        return;
      }
      body.displayName = displayName.trim();
    }
    if (heightDisplay) {
      const raw = parseFloat(heightDisplay);
      const h   = preferMetric ? raw : raw * 2.54; // convert in → cm if imperial
      if (isNaN(h) || h < 100 || h > 250) {
        setError(preferMetric
          ? 'Height must be between 100 and 250 cm.'
          : 'Height must be between 39 and 98 in.');
        setSaving(false);
        return;
      }
      body.heightCm = Math.round(h); // DB stores heightCm as Int
    }
    if (weightDisplay) {
      const raw = parseFloat(weightDisplay);
      const w   = preferMetric ? raw : raw / 2.20462; // convert lbs → kg if imperial
      if (isNaN(w) || w < 20 || w > 300) {
        setError(preferMetric
          ? 'Weight must be between 20 and 300 kg.'
          : 'Weight must be between 44 and 661 lbs.');
        setSaving(false);
        return;
      }
      body.weightKg = w;
    }

    try {
      const { data } = await api.patch<UserProfile>('/me/profile', body);
      setUser(data);
      setSaved(true);
      navigation.navigate('Home');
    } catch (e: any) {
      const err = e.response?.data?.error;
      setError(typeof err === 'string' ? err : 'Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  }

  function handleLogout() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: logout },
    ]);
  }

  const unitLabel = preferMetric ? 'kg / cm' : 'lbs / in';

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + 20 }]}>
      <Text style={styles.heading}>Settings</Text>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Profile</Text>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Display name</Text>
          <TextInput
            style={styles.input}
            placeholder="Your name"
            placeholderTextColor={Colors.textMuted}
            value={displayName}
            onChangeText={setDisplayName}
            maxLength={30}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Height ({preferMetric ? 'cm' : 'in'})</Text>
          <TextInput
            style={styles.input}
            placeholder={preferMetric ? '170' : '67'}
            placeholderTextColor={Colors.textMuted}
            keyboardType="decimal-pad"
            value={heightDisplay}
            onChangeText={setHeightDisplay}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Weight ({preferMetric ? 'kg' : 'lbs'})</Text>
          <TextInput
            style={styles.input}
            placeholder={preferMetric ? '70' : '154'}
            placeholderTextColor={Colors.textMuted}
            keyboardType="decimal-pad"
            value={weightDisplay}
            onChangeText={setWeightDisplay}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Preferences</Text>

        <View style={styles.toggle}>
          <View>
            <Text style={styles.toggleLabel}>GPS check-in</Text>
            <Text style={styles.toggleSub}>Earn +25 pts when at Owl Center</Text>
          </View>
          <Switch
            value={gpsEnabled}
            onValueChange={setGpsEnabled}
            trackColor={{ true: Colors.primary }}
            thumbColor={Colors.text}
          />
        </View>

        <View style={styles.toggle}>
          <View>
            <Text style={styles.toggleLabel}>Metric units</Text>
            <Text style={styles.toggleSub}>Currently: {unitLabel}</Text>
          </View>
          <Switch
            value={preferMetric}
            onValueChange={handleUnitToggle}
            trackColor={{ true: Colors.primary }}
            thumbColor={Colors.text}
          />
        </View>

        <View style={styles.toggle}>
          <View>
            <Text style={styles.toggleLabel}>Anonymous on leaderboard</Text>
            <Text style={styles.toggleSub}>Show "Anonymous" instead of your Temple ID</Text>
          </View>
          <Switch
            value={leaderboardAnonymous}
            onValueChange={setLeaderboardAnonymous}
            trackColor={{ true: Colors.primary }}
            thumbColor={Colors.text}
          />
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {saved ? <Text style={styles.success}>Saved.</Text> : null}

      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving
          ? <ActivityIndicator color={Colors.text} />
          : <Text style={styles.saveButtonText}>Save Changes</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>

      {user && (
        <Text style={styles.emailHint}>{user.email}</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: Colors.background },
  content:           { padding: 20, gap: 20 },
  heading:           { fontSize: 22, fontWeight: '700', color: Colors.text },
  section:           { gap: 12 },
  sectionLabel:      { fontSize: 12, fontWeight: '600', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
  field:             { gap: 6 },
  fieldLabel:        { fontSize: 13, color: Colors.textMuted },
  input:             { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, color: Colors.text, fontSize: 15, letterSpacing: 0 },
  toggle:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, padding: 14 },
  toggleLabel:       { fontSize: 15, color: Colors.text },
  toggleSub:         { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  error:             { color: Colors.error, fontSize: 13, textAlign: 'center' },
  success:           { color: Colors.success, fontSize: 13, textAlign: 'center' },
  saveButton:        { backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText:    { color: Colors.text, fontSize: 16, fontWeight: '600' },
  logoutButton:      { borderWidth: 1, borderColor: Colors.error, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  logoutText:        { color: Colors.error, fontSize: 16, fontWeight: '600' },
  emailHint:         { fontSize: 12, color: Colors.textMuted, textAlign: 'center' },
});
