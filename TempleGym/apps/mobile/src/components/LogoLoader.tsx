import { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';

export default function LogoLoader() {
  const scale   = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    Animated.spring(opacity, { toValue: 1, useNativeDriver: true, friction: 6 }).start();
    Animated.spring(scale,   { toValue: 1, useNativeDriver: true, friction: 6 }).start(() => {
      pulseRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.08, duration: 600, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1.00, duration: 600, useNativeDriver: true }),
        ]),
      );
      pulseRef.current.start();
    });
    return () => { pulseRef.current?.stop(); };
  }, []);

  return (
    <View style={styles.container}>
      <Animated.Image
        source={require('../../assets/temple-logo.png')}
        style={[styles.logo, { opacity, transform: [{ scale }] }]}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
  logo:      { width: 52, height: 52 },
});
