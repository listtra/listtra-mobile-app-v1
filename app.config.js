import "dotenv/config";

export default {
  expo: {
    name: "Zirkly",
    slug: "zirkly-mobile-app",
    version: "1.0.7",
    orientation: "portrait",
    icon: "./assets/images/icon3.png",
    scheme: "zirkly",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,

    ios: {
      bundleIdentifier: "com.zirkly.app",
      associatedDomains: [
        //"applinks:zirkly.com",
        "applinks:www.zirkly.com",
      ],
      entitlements: {
        "com.apple.developer.applesignin": ["Default"],
      },
      buildNumber: "26",
      supportsTablet: true,
      statusBarStyle: "dark-content",
      statusBarBackgroundColor: "#ffffff",
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
            "zirkly.com": {
              NSIncludesSubdomains: true,
              NSExceptionMinimumTLSVersion: "TLSv1.2",
              NSExceptionRequiresForwardSecrecy: true,
            },
            "backend.listtra.com": {
              NSIncludesSubdomains: true,
              NSExceptionMinimumTLSVersion: "TLSv1.2",
              NSExceptionRequiresForwardSecrecy: true,
            },
            "dev.zirkly.com": {
              NSIncludesSubdomains: true,
              NSExceptionMinimumTLSVersion: "TLSv1.2",
              NSExceptionRequiresForwardSecrecy: true,
            },
          },
        },
      },
    },

    android: {
      package: "com.zirkly.app",
      intentFilters: [
        {
          action: "VIEW",
          autoVerify: true,
          data: [
            // {
            //   scheme: "https",
            //   host: "zirkly.com",
            //   pathPrefix: "/listings"
            // },
            {
              scheme: "https",
              host: "www.zirkly.com",
              pathPrefix: "/listings",
            },
            // {
            //   scheme: "https",
            //   host: "zirkly.com"
            // },
            {
              scheme: "https",
              host: "www.zirkly.com",
            },
          ],
          category: ["BROWSABLE", "DEFAULT"],
        },
      ],
      versionCode: 26,
      edgeToEdgeEnabled: false,
      statusBarStyle: "dark-content",
      softInputMode: "adjustResize",
      statusBarBackgroundColor: "#ffffff",
      statusBarTranslucent: false,
      googleServicesFile: "./google-services.json",
      permissions: ["ACCESS_COARSE_LOCATION", "ACCESS_FINE_LOCATION", "CAMERA"],
    },

    web: {
      bundler: "metro",
      output: "server",
      favicon: "./assets/images/favicon.png",
    },

    plugins: [
      "expo-secure-store",
      "expo-router",
      "expo-apple-authentication",
      "expo-notifications",
      // [
      //   "expo-splash-screen",
      //   {
      //     image: "./assets/images/splash-icon.png",
      //     imageWidth: 200,
      //     resizeMode: "contain",
      //     backgroundColor: "#ffffff",
      //   },
      // ],
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
      // Add Google Sign-In plugin
      [
        "@react-native-google-signin/google-signin",
        {
          iosUrlScheme:
            "com.googleusercontent.apps.827930578004-9t2a9k7cmjevruiee4s0iq5k9h5p3eqg",
        },
      ],
      [
        "expo-image-picker",
        {
          photosPermission:
            "Allow $(PRODUCT_NAME) to access your photos to upload listing images.",
          cameraPermission:
            "Allow $(PRODUCT_NAME) to access your camera to take photos for listings.",
          microphonePermission: false, // Set to true if you need audio recording
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
        projectId: "4b354982-5b2c-4a00-8860-d4701f089a23",
      },
    },
    owner: "jibinb",
  },
};
