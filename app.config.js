import "dotenv/config";

const strip = (id) => id?.replace(".apps.googleusercontent.com", "");

export default {
  name: "listtra-mobile-app",
  slug: "listtra-mobile-app",
  scheme: "com.listtra.app", // Single scheme for dev client compatibility
  icon: "./assets/images/icon.png",
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  extra: {
    apiUrl: "https://backend.listtra.com",
    GOOGLE_WEB_CLIENT_ID: process.env.GOOGLE_WEB_CLIENT_ID,
    GOOGLE_ANDROID_CLIENT_ID: process.env.GOOGLE_ANDROID_CLIENT_ID,
    GOOGLE_IOS_CLIENT_ID: process.env.GOOGLE_IOS_CLIENT_ID,
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
    router: {},
    eas: { projectId: "ef242669-581a-4988-924f-6bf58ec279d9" },
  },
  ios: {
    bundleIdentifier: "com.listtra.app",
    supportsTablet: true,
    statusBarStyle: "dark-content",
    googleServicesFile: "./GoogleService-Info.plist",
    infoPlist: {
      UIStatusBarStyle: "UIStatusBarStyleDarkContent",
      UIViewControllerBasedStatusBarAppearance: false,
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: false,
        NSExceptionDomains: {
          "res.cloudinary.com": {
            NSExceptionAllowsInsecureHTTPLoads: false,
            NSIncludesSubdomains: true,
            NSExceptionMinimumTLSVersion: "TLSv1.2",
            NSExceptionRequiresForwardSecrecy: true,
          },
          "cloudinary.com": {
            NSIncludesSubdomains: true,
            NSExceptionMinimumTLSVersion: "TLSv1.2",
            NSExceptionRequiresForwardSecrecy: true,
          },
          "listtra.com": {
            NSIncludesSubdomains: true,
            NSExceptionMinimumTLSVersion: "TLSv1.2",
            NSExceptionRequiresForwardSecrecy: true,
          },
          "backend.listtra.com": {
            NSIncludesSubdomains: true,
            NSExceptionMinimumTLSVersion: "TLSv1.2",
            NSExceptionRequiresForwardSecrecy: true,
          },
        },
      },
    },
  },
  android: {
    package: "com.listtra.app",
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#FFFFFF",
    },
    edgeToEdgeEnabled: false,
    statusBarStyle: "dark-content",
    softInputMode: "adjustResize",
    statusBarBackgroundColor: "#ffffff",
    statusBarTranslucent: true,
    googleServicesFile: "./google-services.json",
    permissions: [
      "ACCESS_COARSE_LOCATION",
      "ACCESS_FINE_LOCATION",
      "ACCESS_BACKGROUND_LOCATION",
    ],
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          {
            scheme: "com.listtra.app",
          },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  web: {
    bundler: "metro",
    output: "server",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    "expo-notifications",
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
      },
    ],
    [
      "expo-location",
      {
        locationAlwaysAndWhenInUsePermission:
          "Allow $(PRODUCT_NAME) to use your location to help you find nearby items and automatically set your pickup location.",
        locationAlwaysPermission:
          "Allow $(PRODUCT_NAME) to use your location to help you find nearby items and automatically set your pickup location.",
        locationWhenInUsePermission:
          "Allow $(PRODUCT_NAME) to use your location to help you find nearby items and automatically set your pickup location.",
      },
    ],
  ],
  experiments: { typedRoutes: true },
  owner: "jibinb",
}; 