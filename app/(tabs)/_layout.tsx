import { useTabAuth } from '@/hooks/useTabAuth';
import { Feather, Ionicons } from '@expo/vector-icons';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Tabs } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Platform, Pressable, StyleSheet, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function TabBarIcon(props: {
  iconType?: 'ionicons' | 'material' | 'fa5' | 'fa6' | 'fi';
  name: any;
  color: string;
  size?: number;
  style?: any;
  solid?: boolean;
  animatedStyle?: any;
}) {
  const { iconType = 'ionicons', animatedStyle, ...rest } = props;

  const IconComponent = () => {
    if (iconType === 'material') {
      return <MaterialIcons size={props.size || 24} {...rest} />;
    } else if (iconType === 'fa5') {
      return <FontAwesome5 size={props.size || 24} {...rest} />;
    } else if (iconType === 'fa6') {
      return <FontAwesome6 size={props.size || 24} {...rest} />;
    }
    else if (iconType === 'fi') {
      return <Feather size={props.size || 24} {...rest} />;
    }
    else {
      return <Ionicons size={props.size || 24} {...rest} />;
    }
  };

  if (animatedStyle) {
    return (
      <Animated.View style={animatedStyle}>
        <IconComponent />
      </Animated.View>
    );
  }

  return <IconComponent />;
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
      opacity: new Animated.Value(state.index === 0 ? 0 : 1)
    }))
  ).current;

  // Update animations when tab changes
  useEffect(() => {
    // Animate bubble position
    Animated.spring(animatedValue, {
      toValue: state.index * tabWidth,
      useNativeDriver: true,
      tension: 70,
      friction: 7
    }).start();

    // Animate bubble scale
    Animated.sequence([
      Animated.timing(animatedScale, {
        toValue: 0.85,
        duration: 100,
        useNativeDriver: true
      }),
      Animated.spring(animatedScale, {
        toValue: 1,
        useNativeDriver: true,
        friction: 4
      })
    ]).start();

    // Animate icons
    state.routes.forEach((_: any, i: number) => {
      Animated.parallel([
        Animated.timing(iconAnimations[i].scale, {
          toValue: i === state.index ? 1.1 : 1,
          duration: 200,
          useNativeDriver: true
        }),
        Animated.timing(iconAnimations[i].opacity, {
          toValue: i === state.index ? 0 : 1,
          duration: 150,
          useNativeDriver: true
        })
      ]).start();
    });
  }, [state.index]);

  const getTabIcon = (routeName: string, isFocused: boolean) => {
    switch (routeName) {
      case 'index':
        return {
          iconType: 'material' as const,
          name: 'view-list',
          size: isFocused ? 24 : 26,
        };
      case 'notifications':
        return {
          iconType: 'ionicons' as const,
          name: 'notifications',
          size: isFocused ? 22 : 24,
        };
      case 'chats':
        return {
          iconType: 'fa5' as const,
          name: 'comment',
          size: isFocused ? 22 : 24,
          solid: isFocused,
        };
      case 'add':
        return {
          iconType: 'fi' as const,
          name: 'plus-circle',
          size: isFocused ? 22 : 24,
          solid: isFocused,
        };
      case 'profile':
        return {
          iconType: 'fa5' as const,
          name: 'user',
          size: isFocused ? 22 : 24,
          solid: isFocused,
        };

      default:
        return {
          iconType: 'fa5' as const,
          name: 'question-circle',
          size: isFocused ? 22 : 24,
          solid: isFocused,
        };
    }
  };

  // Animation styles
  const bubbleTranslateX = animatedValue.interpolate({
    inputRange: [0, SCREEN_WIDTH - tabWidth],
    outputRange: [(tabWidth - 34) / 2, SCREEN_WIDTH - tabWidth + (tabWidth - 34) / 2],
    extrapolate: 'clamp'
  });

  const bubbleTransformStyle = {
    transform: [
      { translateX: bubbleTranslateX },
      { translateY: -15 },
      { scale: animatedScale }
    ]
  };

  // Calculate safe bottom padding
  const safeBottomPadding = Math.max(insets.bottom, Platform.OS === 'android' ? 10 : 0);

  return (
    <View style={[styles.tabBarContainer]}>
      {/* Animated Floating Bubble */}
      <Animated.View style={[styles.floatingBubble, bubbleTransformStyle]}>
        <TabBarIcon
          iconType={getTabIcon(state.routes[state.index].name, true).iconType}
          name={getTabIcon(state.routes[state.index].name, true).name}
          color="#FFFFFF"
          size={getTabIcon(state.routes[state.index].name, true).size}
          style={styles.activeIcon}
          solid={getTabIcon(state.routes[state.index].name, true).solid}
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

          if (!isFocused && !event.defaultPrevented) {
            if (checkTabAuth(route.name)) {
              navigation.navigate(route.name);
            }
          }
        };

        const tabIcon = getTabIcon(route.name, isFocused);

        const iconAnimatedStyle = {
          transform: [{ scale: iconAnimations[index].scale }],
          opacity: iconAnimations[index].opacity
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={styles.tabItem}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
          >
            <TabBarIcon
              iconType={tabIcon.iconType}
              name={tabIcon.name}
              color={isFocused ? '#2528be' : '#666'}
              size={tabIcon.size}
              solid={tabIcon.solid}
              animatedStyle={iconAnimatedStyle}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    flexDirection: 'row',
    height: 60,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.06)',
    paddingHorizontal: 10,
    paddingBottom: Platform.OS === 'ios' ? 10 : 0,
    paddingTop: 0,
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
    paddingBottom: 10
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
    top: 5, // Add fixed top positioning
  },
  activeIcon: {
    // Additional styles for active icon if needed
  },
});

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          display: 'none', // Hide the default tab bar
        },
      }}
      tabBar={props => <CustomTabBar {...props} />}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="notifications" />
      <Tabs.Screen name="add" />
      <Tabs.Screen name="chats" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}