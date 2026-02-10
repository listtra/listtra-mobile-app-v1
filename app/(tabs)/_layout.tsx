import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';

export default function TabLayout() {
  return (
    <>
      <StatusBar style="dark" backgroundColor="#f5f5f5" />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: 'none' },
        }}
      >
        <Tabs.Screen name="index" />
      </Tabs>
    </>
  );
}