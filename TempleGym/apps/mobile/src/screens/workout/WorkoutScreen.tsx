import { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList, 'Workout'>;

export default function WorkoutScreen() {
  const navigation = useNavigation<Nav>();

  useEffect(() => {
    navigation.replace('Home');
  }, []);

  return null;
}
