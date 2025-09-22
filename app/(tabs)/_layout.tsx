import { useTabAuth } from '@/hooks/useTabAuth';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Platform, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { triggerIndexRefresh } from './index';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function TabBarIcon({
  name,
  color,
  size = 24,
  animatedStyle,
}: {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  size?: number;
  animatedStyle?: any;
}) {
  if (animatedStyle) {
    return (
      <Animated.View style={animatedStyle}>
        <Ionicons name={name} size={size} color={color} />
      </Animated.View>
    );
  }
  return <Ionicons name={name} size={size} color={color} />;
}

function CustomTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { checkTabAuth } = useTabAuth();

  // Hide tab bar on add screen
  const currentRoute = state.routes[state.index];
  if (currentRoute.name === 'add') {
    return null;
  }

  // Animation values
  const tabWidth = SCREEN_WIDTH / state.routes.length;
  const animatedValue = useRef(new Animated.Value(0)).current;
  const animatedScale = useRef(new Animated.Value(1)).current;
  const iconAnimations = useRef(
    state.routes.map(() => ({
      scale: new Animated.Value(1),
      opacity: new Animated.Value(state.index === 0 ? 0 : 1),
    }))
  ).current;

  useEffect(() => {
    // Bubble movement
    Animated.spring(animatedValue, {
      toValue: state.index * tabWidth,
      useNativeDriver: true,
      tension: 70,
      friction: 7,
    }).start();

    // Bubble pop animation
    Animated.sequence([
      Animated.timing(animatedScale, {
        toValue: 0.85,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(animatedScale, {
        toValue: 1,
        useNativeDriver: true,
        friction: 4,
      }),
    ]).start();

    // Icon animations
    state.routes.forEach((_: any, i: number) => {
      Animated.parallel([
        Animated.timing(iconAnimations[i].scale, {
          toValue: i === state.index ? 1.1 : 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(iconAnimations[i].opacity, {
          toValue: i === state.index ? 0 : 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [state.index]);

  const getTabIcon = (routeName: string, isFocused: boolean) => {
    switch (routeName) {
      case 'index':
        return { name: 'list-outline' as const, size: 26 };
      case 'notifications':
        return { name: 'notifications-outline' as const, size: 24 };
      case 'chats':
        return { name: 'chatbox-outline' as const, size: 24 };
      case 'add':
        return { name: 'add-circle' as const, size: 36 };
      case 'profile':
        return { name: 'person-outline' as const, size: 24 };
      default:
        return { name: 'help-circle-outline' as const, size: 24 };
    }
  };

  const bubbleTranslateX = animatedValue.interpolate({
    inputRange: [0, SCREEN_WIDTH - tabWidth],
    outputRange: [(tabWidth - 34) / 2, SCREEN_WIDTH - tabWidth + (tabWidth - 34) / 2],
    extrapolate: 'clamp',
  });

  const bubbleTransformStyle = {
    transform: [
      { translateX: bubbleTranslateX },
      { translateY: -15 },
      { scale: animatedScale },
    ],
  };

  return (
    <View style={styles.tabBarContainer}>
      {/* Floating Bubble */}
      <Animated.View style={[styles.floatingBubble, bubbleTransformStyle]} pointerEvents="none">
        <TabBarIcon
          name={getTabIcon(state.routes[state.index].name, true).name}
          color="#fff"
          size={getTabIcon(state.routes[state.index].name, true).size}
        />
      </Animated.View>

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
        const iconAnimatedStyle = {
          transform: [{ scale: iconAnimations[index].scale }],
          opacity: iconAnimations[index].opacity,
        };

        // ✅ Map route name -> label
        const tabLabels: Record<string, string> = {
          index: "Listing",
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
            {route.name === 'add' ? (
              <TabBarIcon name={tabIcon.name} color="#2528be" size={tabIcon.size} />
            ) : (
              <TabBarIcon
                name={tabIcon.name}
                color={isFocused ? '#2528be' : '#666'}
                size={tabIcon.size}
                animatedStyle={iconAnimatedStyle}
              />
            )}
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
    height: 80,
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
  tabLabel: {
    fontSize: 10,
    color: "#666",
    marginTop: 10,
  },
  tabLabelFocused: {
    color: "#2528be",
    fontWeight: "600",
  },
  focusedTabItem: {
    zIndex: 15,
  },
  floatingBubble: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#2528be',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2528be',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 10,
    top: 5,
    pointerEvents: 'none',
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
