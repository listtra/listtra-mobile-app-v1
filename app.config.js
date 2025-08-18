import "dotenv/config";

export default {
  expo: {
    name: "listtra-mobile-app",
    slug: "listtra-mobile-app",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "listtra",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,

    ios: {
      bundleIdentifier: "com.listtra.app",
      supportsTablet: true,
      statusBarStyle: "dark-content",
      googleServicesFile: "./ios/GoogleService-Info.plist",
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
        backgroundColor: "#ffffff",
      },
      edgeToEdgeEnabled: false,
      statusBarStyle: "dark-content",
      softInputMode: "adjustResize",
      statusBarBackgroundColor: "#f8f8f8",
      statusBarTranslucent: false,
      googleServicesFile: "./android/app/google-services.json",
      permissions: [
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION",
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

    experiments: {
      typedRoutes: true,
    },

    extra: {
      apiUrl: "https://backend.listtra.com",
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
      googleWebClientId: process.env.GOOGLE_WEB_CLIENT_ID,
      googleAndroidClientId: process.env.GOOGLE_ANDROID_CLIENT_ID,
      googleIosClientId: process.env.GOOGLE_IOS_CLIENT_ID,
      eas: {
        projectId: "ef242669-581a-4988-924f-6bf58ec279d9",
      },
    },

    owner: "jibinb",
  },
};
