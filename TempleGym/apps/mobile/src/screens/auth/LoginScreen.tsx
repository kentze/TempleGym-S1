import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Dimensions,
  Animated,
} from 'react-native';
import { Image } from 'expo-image';
import Constants from 'expo-constants';
import { Colors } from '../../constants/colors';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/auth.store';
import type { AuthResponse } from '@templegym/types';

type Step = 'email' | 'code';

const { height: screenHeight } = Dimensions.get('window');
const TEMPLE_USERNAME = /^tu[a-z]\d{5}$/i;

export default function LoginScreen() {
  const { setToken, setUser, sessionExpired, setSessionExpired } = useAuthStore();
  const [expiredBanner, setExpiredBanner] = useState(false);

  useEffect(() => {
    if (sessionExpired) {
      setExpiredBanner(true);
      setSessionExpired(false);
    }
  }, [sessionExpired, setSessionExpired]);

  const [step, setStep]               = useState<Step>('email');
  const [prefix, setPrefix]           = useState('');
  const [code, setCode]               = useState('');
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [emailFocused, setEmailFocused] = useState(false);

  const fullEmail = `${prefix.toLowerCase()}@temple.edu`;
  const isFloated = !!prefix || emailFocused;

  // Hooter spring entrance
  const hooterScale = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    Animated.spring(hooterScale, { toValue: 1, damping: 8, stiffness: 100, useNativeDriver: true }).start();
  }, []);

  // Button press scale
  const buttonScale = useRef(new Animated.Value(1)).current;

  function handlePressIn() {
    if (loading) return;
    buttonScale.stopAnimation();
    Animated.timing(buttonScale, { toValue: 0.95, duration: 120, useNativeDriver: true }).start();
  }

  function handlePressOut() {
    if (loading) return;
    buttonScale.stopAnimation();
    Animated.sequence([
      Animated.timing(buttonScale, { toValue: 1.06, duration: 150, useNativeDriver: true }),
      Animated.timing(buttonScale, { toValue: 1,    duration: 120, useNativeDriver: true }),
    ]).start();
  }

  // Entrance animations (single progress value per element: 0→1)
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleScale   = useRef(new Animated.Value(0.3)).current;
  const subtitleAnim = useRef(new Animated.Value(0)).current;
  const inputAnim    = useRef(new Animated.Value(0)).current;
  const btnAnim      = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(100),
      Animated.parallel([
        Animated.spring(titleOpacity, { toValue: 1, useNativeDriver: true }),
        Animated.spring(titleScale,   { toValue: 1, damping: 10, stiffness: 120, useNativeDriver: true }),
      ]),
    ]).start();

    Animated.sequence([
      Animated.delay(150),
      Animated.timing(subtitleAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    Animated.sequence([
      Animated.delay(300),
      Animated.timing(inputAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    Animated.sequence([
      Animated.delay(450),
      Animated.timing(btnAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  // Float label slide
  const floatLabelY = useRef(new Animated.Value(13)).current;
  useEffect(() => {
    Animated.timing(floatLabelY, { toValue: isFloated ? 0 : 13, duration: 180, useNativeDriver: true }).start();
  }, [isFloated]);

  function handlePrefixChange(raw: string) {
    setPrefix(raw.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8));
  }

  async function handleRequestOtp() {
    setError(null);
    if (!TEMPLE_USERNAME.test(prefix)) {
      setError('Enter a valid Temple username (e.g. tur78663).');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/request-otp', { email: fullEmail });
      setStep('code');
    } catch (e: any) {
      const err = e.response?.data?.error;
      setError(typeof err === 'string' ? err : 'Failed to send code. Try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    setError(null);
    if (code.length !== 6) {
      setError('Enter the 6-digit code sent to your email.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post<AuthResponse>('/auth/verify-otp', {
        email: fullEmail,
        code,
      });
      await setToken(data.token);
      setUser(data.user);
    } catch (e: any) {
      const err = e.response?.data?.error;
      setError(typeof err === 'string' ? err : 'Invalid or expired code.');
    } finally {
      setLoading(false);
    }
  }

  const slideUp = (anim: Animated.Value) => ({
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
  });

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        {expiredBanner && (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>Your session has expired. Please sign in again.</Text>
          </View>
        )}

        <View style={styles.headerGroup}>
          <Animated.View style={[styles.hooterContainer, { transform: [{ scale: hooterScale }] }]}>
            <Image
              source={require('../../../assets/hooter.gif')}
              style={styles.hooter}
              contentFit="contain"
            />
          </Animated.View>

          <Animated.View style={{ opacity: titleOpacity, transform: [{ scale: titleScale }] }}>
            <Text style={styles.title}>TempleGym</Text>
            <Text style={styles.slogan}>Study Hard. Lift Harder.</Text>
          </Animated.View>
        </View>

        <Animated.View style={[styles.subtitleWrapper, slideUp(subtitleAnim)]}>
          <Text style={styles.subtitle}>
            {step === 'email' ? 'Sign in with your Temple username' : `Code sent to ${fullEmail}`}
          </Text>
        </Animated.View>

        <Animated.View style={slideUp(inputAnim)}>
          {step === 'email' ? (
            <View style={styles.emailRow}>
              <View style={styles.prefixContainer}>
                <Animated.View
                  pointerEvents="none"
                  style={[styles.floatLabelWrap, { transform: [{ translateY: floatLabelY }] }]}
                >
                  <Text style={[styles.floatLabel, isFloated && styles.floatLabelSmall]}>
                    {isFloated ? 'Temple username' : 'tur78663'}
                  </Text>
                </Animated.View>
                <TextInput
                  key="prefix-input"
                  style={[styles.prefixInput, { color: isFloated ? Colors.text : 'transparent' }]}
                  value={prefix}
                  onChangeText={handlePrefixChange}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  autoCapitalize="none"
                  autoCorrect={false}
                  onSubmitEditing={handleRequestOtp}
                  returnKeyType="send"
                />
              </View>
              <View style={styles.suffixBox}>
                <Text style={styles.suffixText}>@temple.edu</Text>
              </View>
            </View>
          ) : (
            <TextInput
              key="code-input"
              style={[styles.input, styles.inputCode]}
              placeholder="000000"
              placeholderTextColor={Colors.textMuted}
              keyboardType="number-pad"
              maxLength={6}
              value={code}
              onChangeText={setCode}
              onSubmitEditing={handleVerifyOtp}
              returnKeyType="done"
              autoFocus
            />
          )}
        </Animated.View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Animated.View style={slideUp(btnAnim)}>
          <Pressable
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={step === 'email' ? handleRequestOtp : handleVerifyOtp}
            disabled={loading}
          >
            <Animated.View style={[styles.button, loading && styles.buttonDisabled, { transform: [{ scale: buttonScale }] }]}>
              {loading
                ? <ActivityIndicator color={Colors.text} />
                : <Text style={styles.buttonText}>{step === 'email' ? 'Send Code' : 'Sign In'}</Text>
              }
            </Animated.View>
          </Pressable>
        </Animated.View>

        {step === 'code' && (
          <Pressable onPress={() => { setStep('email'); setCode(''); setError(null); }}>
            <Text style={styles.back}>Use a different username</Text>
          </Pressable>
        )}
      </View>
      <Text style={styles.version}>v{Constants.expoConfig?.version}</Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'flex-start', paddingTop: screenHeight * 0.22, padding: 24 },
  card:            { width: '100%', maxWidth: 360, gap: 16 },
  headerGroup:     { gap: 4 },
  banner:          { backgroundColor: `${Colors.error}20`, borderWidth: 1, borderColor: Colors.error, borderRadius: 8, padding: 12 },
  bannerText:      { color: Colors.error, fontSize: 13, textAlign: 'center' },
  title:           { fontSize: 28, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  slogan:          { fontSize: 13, color: Colors.textMuted, textAlign: 'center', marginTop: 4 },
  subtitleWrapper: { marginTop: 40 },
  subtitle:        { fontSize: 14, color: Colors.textMuted, textAlign: 'center' },
  emailRow:          { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Colors.border, borderRadius: 10, backgroundColor: Colors.surface, overflow: 'hidden', height: 56 },
  prefixContainer:   { flex: 1, position: 'relative', height: '100%' },
  floatLabelWrap:    { position: 'absolute', top: 6, left: 16 },
  floatLabel:        { color: Colors.textMuted, fontSize: 16 },
  floatLabelSmall:   { fontSize: 11 },
  prefixInput:       { position: 'absolute', top: 24, left: 0, right: 0, bottom: 0, paddingHorizontal: 16, fontSize: 16 },
  suffixBox:         { paddingHorizontal: 12, borderLeftWidth: 1, borderLeftColor: Colors.border, height: '100%', justifyContent: 'center' },
  suffixText:        { color: Colors.textMuted, fontSize: 16 },
  input:           { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12, color: Colors.text, fontSize: 16, letterSpacing: 0 },
  inputCode:       { textAlign: 'center', letterSpacing: 8, fontSize: 22 },
  error:           { color: Colors.error, fontSize: 13, textAlign: 'center' },
  button:          { backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  buttonDisabled:  { opacity: 0.6 },
  buttonText:      { color: Colors.text, fontSize: 16, fontWeight: '600' },
  back:            { color: Colors.textMuted, fontSize: 13, textAlign: 'center', textDecorationLine: 'underline' },
  version:         { position: 'absolute', bottom: 12, right: 28, fontSize: 11, color: Colors.textMuted },
  hooterContainer: { alignItems: 'center' },
  hooter:          { width: 120, height: 120 },
});
