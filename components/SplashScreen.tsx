// app/splash.tsx
import React, { useEffect } from "react";
import {
  View,
  Image,
  Text,
  StyleSheet,
  Dimensions,
  StatusBar,
  Platform,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withDelay,
  withSequence,
  interpolate,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");

export default function SplashScreen() {
  // ── Shared Values ────────────────────────────────
  const ring1 = useSharedValue(0);
  const ring2 = useSharedValue(0);
  const ring3 = useSharedValue(0);

  const logo = useSharedValue(0);
  const brand = useSharedValue(0);
  const tagline = useSharedValue(0);

  // ── Animate on mount ─────────────────────────────
  useEffect(() => {
    const pulse = () =>
      withRepeat(
        withSequence(
          withTiming(1, { duration: 2500 }),
          withTiming(0, { duration: 0 })
        ),
        -1,
        false
      );

    ring1.value = pulse();
    ring2.value = withDelay(800, pulse());
    ring3.value = withDelay(1600, pulse());

    logo.value = withDelay(200, withTiming(1, { duration: 1000 }));
    brand.value = withDelay(500, withTiming(1, { duration: 800 }));
    tagline.value = withDelay(1000, withTiming(1, { duration: 800 }));
  }, []);


  // ── Animated Styles ─────────────────────────────
  const makeRingStyle = (shared: any) =>
    useAnimatedStyle(() => ({
      transform: [{ scale: interpolate(shared.value, [0, 1], [0, 2]) }],
      opacity: interpolate(shared.value, [0, 1], [0.8, 0]),
    }));

  const ring1Style = makeRingStyle(ring1);
  const ring2Style = makeRingStyle(ring2);
  const ring3Style = makeRingStyle(ring3);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logo.value,
    transform: [{ scale: interpolate(logo.value, [0, 1], [0, 1]) }],
  }));

  const brandStyle = useAnimatedStyle(() => ({
    opacity: brand.value,
    transform: [{ translateY: interpolate(brand.value, [0, 1], [20, 0]) }],
  }));

  const taglineStyle = useAnimatedStyle(() => ({
    opacity: tagline.value,
  }));

  return (
    <View style={styles.root}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <LinearGradient
        colors={["#7c3aed", "#9333ea", "#4f46e5"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.container,
          {
            paddingTop: Platform.OS === "android" ? StatusBar.currentHeight || 0 : 0,
          },
        ]}
      >
        {/* ── Rings ── */}
        <View style={styles.logoContainer}>
          <Animated.View style={[styles.ring, ring1Style]} />
          <Animated.View style={[styles.ring, ring2Style]} />
          <Animated.View style={[styles.ring, ring3Style]} />

          {/* ── Logo ── */}
          <Animated.View style={[styles.logoWrapper, logoStyle]}>
            <Image source={require("../assets/images/zirkly-icon-white-512px.png")} style={styles.logo} resizeMode="contain" />
          </Animated.View>
        </View>

        {/* ── Brand ── */}
        <Animated.View style={[styles.textContainer, brandStyle]}>
          <Text style={styles.brandText}>
            zi<Text style={styles.brandHighlight}>r</Text>kly
          </Text>

          <Animated.View style={taglineStyle}>
            <Text style={styles.tagline}>Where pre-loved comes first</Text>
          </Animated.View>
        </Animated.View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "black" },
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  logoContainer: { position: "relative", alignItems: "center", justifyContent: "center" },
  ring: {
    position: "absolute",
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.3)",
  },
  logoWrapper: { alignItems: "center", justifyContent: "center" },
  logo: { width: 80, height: 80 },
  textContainer: { alignItems: "center", marginTop: 32 },
  brandText: { color: "white", fontSize: 48, fontWeight: "700", letterSpacing: -1 },
  brandHighlight: { color: "#60a5fa" },
  tagline: { color: "rgba(255,255,255,0.8)", fontSize: 16, textAlign: "center", marginTop: 8 },
});
