export default {
  name: "listtra-mobile-app",
  scheme: "listtra",
  icon: "./assets/images/icon.png",
  version: "1.0.0",
  extra: {
    apiUrl: "https://backend.listtra.com",
    eas: {
      projectId: "820e18da-a912-4bce-b322-c20119032f5b"
    }
  },
  ios: {
    bundleIdentifier: "com.listtra.app",
    supportsTablet: true,
  },
  android: {
    package: "com.listtra.app",
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#FFFFFF",
    },
  },
  plugins: [
    "expo-router",
  ],
  web: {
    bundler: "metro",
  },
  scheme: "listtra",
  owner: "pre_02",
}; 