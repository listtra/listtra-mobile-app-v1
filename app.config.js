import "dotenv/config";

export default {
  name: "listtra-mobile-app",
  scheme: "listtra",
  icon: "./assets/images/icon.png",
  version: "1.0.0",
  extra: {
    apiUrl: "https://backend.listtra.com",
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
    eas: {
      projectId: "820e18da-a912-4bce-b322-c20119032f5b"
    }
  },
  ios: {
    bundleIdentifier: "com.listtra.app",
    supportsTablet: true,
    googleServicesFile: "./ios/GoogleService-Info.plist",
  },
  android: {
    package: "com.listtra.app",
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#FFFFFF",
    },
    googleServicesFile: "./android/app/google-services.json",
  },
  plugins: [
    "expo-router",
    "expo-notifications",
  ],
  web: {
    bundler: "metro",
  },
  scheme: "listtra",
  owner: "pre_02",
}; 