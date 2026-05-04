import { Stack } from 'expo-router';
import React from 'react';

export default function ChatLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false, // Hide all headers by default
        contentStyle: { backgroundColor: 'white' },
        animation: 'slide_from_right',
      }}
    >
      {/* Explicitly hide header for specific screens if needed */}
      <Stack.Screen 
        name="index" 
        options={{ 
          headerShown: false,
          animation: 'slide_from_right'
        }} 
      />
      <Stack.Screen 
        name="[id]" 
        options={{ 
          headerShown: false,
          animation: 'slide_from_right'
        }} 
      />
    </Stack>
  );
}
