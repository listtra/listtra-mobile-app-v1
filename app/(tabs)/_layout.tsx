import { useTabAuth } from '@/hooks/useTabAuth';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Dimensions, Platform, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { triggerIndexRefresh } from './index';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function TabBarIcon({
  name,
  color,
  size = 24,
}: {
  name: keyof typeof Ionicons.glyphMap | string;
  color: string;
  size?: number;
}) {
  return <Ionicons name={name as keyof typeof Ionicons.glyphMap} size={size} color={color} />;
}

function CustomTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { checkTabAuth } = useTabAuth();

  // Hide tab bar on add screen
  const currentRoute = state.routes[state.index];
  if (currentRoute.name === 'add') {
    return null;
  }

  const getTabIcon = (routeName: string, isFocused: boolean) => {
    switch (routeName) {
      case 'index':
        return { name: isFocused ? 'home' : 'home-outline' as const, size: 24 };
      case 'notifications':
        return { name: isFocused ? 'notifications' : 'notifications-outline' as const, size: 24 };
      case 'chats':
        return { name: isFocused ? 'paper-plane' : 'paper-plane-outline' as const, size: 24 };
      case 'add':
        return { name: 'add-circle' as const, size: 36 };
      case 'profile':
        return { name: isFocused ? 'person' : 'person-outline' as const, size: 24 };
      default:
        return { name: isFocused ? 'help-circle' : 'help-circle-outline' as const, size: 24 };
    }
  };

  return (
    <View style={styles.tabBarContainer}>
      {state.routes.map((route: any, index: number) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!event.defaultPrevented) {
            if (!isFocused) {
              if (checkTabAuth(route.name)) {
                navigation.navigate(route.name);
              }
            } else {
              if (route.name === 'index') {
                triggerIndexRefresh();
              }
            }
          }
        };

        const tabIcon = getTabIcon(route.name, isFocused);
        const tabLabels: Record<string, string> = {
          index: "Home",
          notifications: "Notification",
          add: "Post an Ad",
          chats: "Message",
          profile: "Profile",
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={[styles.tabItem, isFocused && styles.focusedTabItem]}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            hitSlop={{ top: 10, bottom: 10, left: 5, right: 5 }}
          >
            <View style={styles.iconContainer}>
              {route.name === 'add' ?
                (
                  <TabBarIcon
                    name={tabIcon.name}
                    color={'#2528be'}
                    size={tabIcon.size}
                  />
                ) : (
                  <TabBarIcon
                    name={tabIcon.name}
                    color={isFocused ? '#2528be' : '#666'}
                    size={tabIcon.size}
                  />
                )}
            </View>
            <Text style={[styles.tabLabel, isFocused && styles.tabLabelFocused]}>
              {tabLabels[route.name]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    flexDirection: 'row',
    height: 75,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.06)',
    paddingHorizontal: 10,
    paddingBottom: Platform.OS === 'ios' ? 15 : 0,
    paddingTop: 5,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 5,
  },
  tabItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    paddingBottom: 10,
    zIndex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabLabel: {
    fontSize: 9,
    color: '#666',
    marginTop: 0,
    textAlign: 'center',
  },
  tabLabelFocused: {
    color: '#2528be',
    fontWeight: '600',
  },
  focusedTabItem: {
    zIndex: 15,
  },
});

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: { display: 'none' },
      }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="notifications" />
      <Tabs.Screen name="add" />
      <Tabs.Screen name="chats" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}