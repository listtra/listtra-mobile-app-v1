// app/splash.tsx or components/SplashScreen.tsx
import React from "react";
import {
  View,
  Image,
  Text,
  StyleSheet,
  Dimensions,
  StatusBar,
  Platform,
} from "react-native";
import { MotiView } from "moti";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");

export default function SplashScreen() {
  return (
    <View style={styles.root}>
      {/* Make status bar transparent so gradient shows behind it */}
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />

      <LinearGradient
        colors={["#7c3aed", "#9333ea", "#4f46e5"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.container,
          {
            paddingTop:
              Platform.OS === "android" ? StatusBar.currentHeight || 0 : 0,
          },
        ]}
      >
        {/* Center logo and rings */}
        <View style={styles.logoContainer}>
          {[0, 1, 2].map((index) => (
            <MotiView
              key={index}
              from={{ scale: 0, opacity: 0.8 }}
              animate={{ scale: 2, opacity: 0 }}
              transition={{
                loop: true,
                duration: 2500,
                delay: index * 800,
                type: "timing",
              }}
              style={styles.ring}
            />
          ))}

          <MotiView
            from={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1000, delay: 200 }}
            style={styles.logoWrapper}
          >
            <Image
              source={require("../assets/images/icon3.png")} // ✅ update path if needed
              style={styles.logo}
              resizeMode="contain"
            />
          </MotiView>
        </View>

        {/* Brand name */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ duration: 800, delay: 500 }}
          style={styles.textContainer}
        >
          <Text style={styles.brandText}>
            zi<Text style={styles.brandHighlight}>r</Text>kly
          </Text>

          <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 800, delay: 1000 }}
          >
            <Text style={styles.tagline}>Where pre-loved comes first</Text>
          </MotiView>
        </MotiView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "black", // fallback color behind gradient
  },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logoContainer: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 4,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  logoWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 80,
    height: 80,
  },
  textContainer: {
    alignItems: "center",
    marginTop: 32,
  },
  brandText: {
    color: "white",
    fontSize: 48,
    fontWeight: "700",
    letterSpacing: -1,
  },
  brandHighlight: {
    color: "#60a5fa",
  },
  tagline: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 16,
    textAlign: "center",
    marginTop: 8,
  },
});
