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
      projectId: "ef242669-581a-4988-924f-6bf58ec279d9",
    },
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
  owner: "jibinb",
};
