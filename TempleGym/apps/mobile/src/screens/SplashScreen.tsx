import { useEffect } from 'react';
import { View, Text, Image, StyleSheet, Dimensions } from 'react-native';
import * as ExpoSplashScreen from 'expo-splash-screen';

const { height: screenHeight } = Dimensions.get('window');

export default function SplashScreen() {
  useEffect(() => {
    ExpoSplashScreen.hideAsync();
  }, []);

  return (
    <View style={styles.container}>
      <Image
        source={require('../../assets/temple-logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.title}>TempleGym</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#A41E35',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 120,
    height: 120,
  },
  title: {
    position: 'absolute',
    bottom: screenHeight * 0.08,
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
});
