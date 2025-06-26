# Google Sign-In Setup for iOS

This guide explains how to properly set up and test Google Sign-In for your iOS app.

## Prerequisites

1. You need a Mac computer with Xcode installed
2. You need to have an Apple Developer account
3. You need a Google Cloud Platform project with OAuth credentials

## Setup Steps

### 1. Configure Google Cloud Platform

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project or create a new one
3. Navigate to "APIs & Services" > "Credentials"
4. Create an OAuth client ID for iOS:
   - Application type: iOS
   - Bundle ID: `com.listtra.app` (must match your Xcode project)
   - App Store ID: (optional)
   - Team ID: (from your Apple Developer account)

### 2. Configure URL Scheme in Xcode

1. Open your iOS project in Xcode:
   ```
   npx expo prebuild --platform ios
   open ios/listtra-mobile-app.xcworkspace
   ```

2. Select your project in the Navigator
3. Go to "Info" tab > "URL Types"
4. Add a new URL type:
   - Identifier: `com.googleusercontent.apps.[YOUR-CLIENT-ID]`
   - URL Schemes: `com.googleusercontent.apps.[YOUR-CLIENT-ID]`
   - Role: Editor

### 3. Update Associated Domains

1. In Xcode, select your project in the Navigator
2. Go to "Signing & Capabilities"
3. Add "Associated Domains" capability
4. Add: `applinks:backend.listtra.com`

### 4. Test the Authentication Flow

1. Build and run your app on a real iOS device or simulator
2. Try signing in with Google
3. After authentication, you should be redirected back to your app

## Troubleshooting

### If the redirect fails:

1. Verify your URL scheme is correctly configured in Xcode
2. Ensure your Google OAuth credentials are correct
3. Check the iOS app's bundle identifier matches what's in Google Cloud Console
4. Verify the redirect URI in your auth configuration matches your URL scheme

### Debug with Safari Developer Tools:

If using a simulator, you can debug WebView issues:
1. In Safari, go to Develop > Simulator > [Your WebView]
2. Check the console for any errors during the authentication process

## Notes for Development vs Production

- For development, you may need separate OAuth credentials
- Ensure your backend's redirect URI matches what you've configured
- For production builds, verify the production backend URL is used 