import { Animated, StyleSheet } from 'react-native';

interface Props {
  opacity: Animated.Value;
  scale:   Animated.Value;
  top:     number;
}

export default function LogoRefreshOverlay({ opacity, scale, top }: Props) {
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.wrap, { top, opacity }]}
    >
      <Animated.Image
        source={require('../../assets/temple-logo.png')}
        style={[styles.img, { transform: [{ scale }] }]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 200 },
  img:  { width: 38, height: 38, resizeMode: 'contain' },
});
