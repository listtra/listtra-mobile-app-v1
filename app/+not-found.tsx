import { Stack, useRouter } from 'expo-router';
import { StyleSheet, ActivityIndicator, View } from 'react-native';
import { useEffect } from 'react';

export default function NotFoundScreen() {
  const router = useRouter();

  // useEffect(() => {
  //   // Automatically redirect to home after a brief moment
  //   const timer = setTimeout(() => {
  //     router.replace('/(tabs)');
  //   }, 500);

  //   return () => clearTimeout(timer);
  // }, []);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { backgroundColor: '#f5f5f5' }]}>
        <ActivityIndicator size="large" color="#2528be" />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
});