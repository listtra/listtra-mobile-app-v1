// app/auth/_layout.tsx
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';

export default function AuthLayout() {
  return (
    <>
      <StatusBar style="dark" backgroundColor="#f5f5f5" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: 'white' },
        }}
      />
    </>
  );
}