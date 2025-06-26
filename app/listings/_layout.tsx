import { Stack } from 'expo-router';
import React from 'react';

// Primary color constant
const PRIMARY_COLOR = '#2528be';

export default function ListingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false, // Hide all headers by default
        headerStyle: {
          backgroundColor: '#FFFFFF',
        },
        headerTintColor: PRIMARY_COLOR,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        title: "",
        headerTitle: "",
        headerBackTitle: "",
        animation: 'slide_from_right',
      }}
    >
      {/* Explicitly hide header for product detail page */}
      <Stack.Screen 
        name="[slug]/[product_id]/page" 
        options={{ 
          headerShown: false,
          title: "",
          headerTitle: "",
          headerBackTitle: "",
          headerBackVisible: false,
          animation: 'slide_from_right'
        }} 
      />
    </Stack>
  );
} 