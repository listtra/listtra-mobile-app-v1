import { Ionicons } from '@expo/vector-icons';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWebView } from '../context/WebViewContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function TabBarIcon(props: {
  iconType?: 'ionicons' | 'material' | 'fa5' | 'fa6';
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
    } else {
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

const tabs = [
  { name: 'listings', route: 'listings', label: 'Listings' },
  { name: 'liked', route: 'liked', label: 'Liked' },
  { name: 'add', route: 'add', label: 'Add' },
  { name: 'chats', route: 'chats', label: 'Chats' },
  { name: 'profile', route: 'profile', label: 'Profile' },
];

function CustomTabBar() {
  const insets = useSafeAreaInsets();
  const { currentRoute, navigateToRoute } = useWebView();
  
  // Find current tab index
  const currentTabIndex = tabs.findIndex(tab => tab.route === currentRoute) || 0;
  
  // Animation values
  const tabWidth = SCREEN_WIDTH / tabs.length;
  const animatedValue = useRef(new Animated.Value(0)).current;
  const animatedScale = useRef(new Animated.Value(1)).current;
  const iconAnimations = useRef(
    tabs.map(() => ({
      scale: new Animated.Value(1),
      opacity: new Animated.Value(currentTabIndex === 0 ? 0 : 1)
    }))
  ).current;
  
  // Update animations when tab changes
  useEffect(() => {
    // Animate bubble position
    Animated.spring(animatedValue, {
      toValue: currentTabIndex * tabWidth,
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
    tabs.forEach((_, i) => {
      Animated.parallel([
        Animated.timing(iconAnimations[i].scale, {
          toValue: i === currentTabIndex ? 1.1 : 1,
          duration: 200,
          useNativeDriver: true
        }),
        Animated.timing(iconAnimations[i].opacity, {
          toValue: i === currentTabIndex ? 0 : 1,
          duration: 150,
          useNativeDriver: true
        })
      ]).start();
    });
  }, [currentTabIndex]);
  
  const getTabIcon = (routeName: string, isFocused: boolean) => {
    switch (routeName) {
      case 'listings':
        return {
          iconType: 'material' as const,
          name: 'view-list',
          size: isFocused ? 24 : 26,
        };
      case 'liked':
        return {
          iconType: 'fa5' as const,
          name: 'heart',
          size: isFocused ? 22 : 24,
          solid: isFocused,
        };
      case 'add':
        return {
          iconType: 'fa6' as const,
          name: 'plus',
          size: isFocused ? 24 : 26,
        };
      case 'chats':
        return {
          iconType: 'fa5' as const,
          name: 'comment',
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

  // Hide tab bar on add screen
  if (currentRoute === 'add') {
    return null;
  }

  return (
    <View style={[styles.tabBarContainer, { paddingBottom: safeBottomPadding }]}>
      <View />
      
      {/* Animated Floating Bubble */}
      <Animated.View style={[styles.floatingBubble, bubbleTransformStyle]}>
        <TabBarIcon
          iconType={getTabIcon(tabs[currentTabIndex].route, true).iconType}
          name={getTabIcon(tabs[currentTabIndex].route, true).name}
          color="#FFFFFF"
          size={getTabIcon(tabs[currentTabIndex].route, true).size}
          style={styles.activeIcon}
          solid={getTabIcon(tabs[currentTabIndex].route, true).solid}
        />
      </Animated.View>
      
      {tabs.map((tab, index) => {
        const isFocused = currentTabIndex === index;

        const onPress = () => {
          if (!isFocused) {
            navigateToRoute(tab.route);
          }
        };

        const tabIcon = getTabIcon(tab.route, isFocused);
        
        const iconAnimatedStyle = {
          transform: [{ scale: iconAnimations[index].scale }],
          opacity: iconAnimations[index].opacity
        };

        return (
          <Pressable
            key={tab.name}
            onPress={onPress}
            style={styles.tabItem}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={tab.label}
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
    minHeight: 70,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.06)',
    paddingTop: 10,
    paddingHorizontal: 10,
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
    paddingTop: 10,
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
  },
  activeIcon: {
    // Additional styles for active icon if needed
  },
});

export default CustomTabBar;