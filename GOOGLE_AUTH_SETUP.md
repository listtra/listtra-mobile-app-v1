# Google Authentication Setup Guide

This document provides step-by-step instructions to properly set up Google OAuth authentication for your Listtra mobile app.

## Error: "Access blocked: authorisation error"

If you're seeing this error when trying to use Google Sign-in, it means the app doesn't comply with Google's OAuth 2.0 policy. This is usually due to incorrect OAuth configuration in the Google Cloud Console.

## Fix: Configure Google Cloud Console

1. **Go to the Google Cloud Console**
   - Visit [https://console.cloud.google.com/](https://console.cloud.google.com/)
   - Select your project that contains the OAuth credentials

2. **Configure OAuth Consent Screen**
   - Navigate to "APIs & Services" → "OAuth consent screen"
   - If you're in testing, set the User Type to "External"
   - Fill in the required App information:
     - App name: Listtra
     - User support email: Your support email
     - Developer contact information: Your email
   - Add the following scopes:
     - `./auth/userinfo.email`
     - `./auth/userinfo.profile`
   - In the "Test users" section, add all email addresses that will be testing the app
   - Save the changes

3. **Update Credentials**
   - Navigate to "APIs & Services" → "Credentials"
   - Find the OAuth 2.0 Client ID used for your app
   - Click on it to edit

   For Web client:
   - Ensure the correct JavaScript origins are added (for web usage)
   - For development: `http://localhost:19006`, `https://localhost:19006`
   
   For Android client:
   - Make sure the correct package name is entered: `com.listtra.app`
   - Generate and add the SHA-1 certificate fingerprint using:
     ```
     cd android && ./gradlew signingReport
     ```
     or if using Expo:
     ```
     expo credentials:manager
     ```
   
   For iOS client:
   - Make sure the correct Bundle ID is entered: `com.listtra.app`

4. **Add Redirect URIs**
   - Still in the credentials section, add these redirect URIs:
     - `com.listtra.app:/oauth2redirect/google`
     - `com.listtra.app:/`
     - `https://auth.expo.io/@pre_02/listtra-mobile-app`

5. **Publish the App to Production**
   - Once testing is complete, in the OAuth consent screen, click "Publish App"
   - This removes the "unverified app" warning
   - For apps with less than 100 users, verification may not be required

## Implementation in the App

After configuring the Google Cloud Console correctly, update your app:

1. **Update app.json**
   ```json
   {
     "expo": {
       "scheme": "com.listtra.app",
       "android": {
         "package": "com.listtra.app"
       },
       "ios": {
         "bundleIdentifier": "com.listtra.app"
       }
     }
   }
   ```

2. **Test with Google Sign-in Debug Page**
   - Visit the debug page in your app at `/auth/google-debug`
   - This will help diagnose any remaining issues

## Common Causes of Auth Errors

1. **Missing redirect URIs** - Ensure all required redirect URIs are added to your Google Cloud Console
2. **SHA-1 mismatch** - Make sure the SHA-1 fingerprint in Google Cloud Console matches your app's actual fingerprint
3. **Test user not added** - During development, make sure your test Google account is added to the Test users list
4. **Scopes mismatch** - Ensure the scopes requested in your app match those configured in the consent screen

## Need Further Assistance?

If you continue to experience issues:

1. Check the logs for detailed error messages
2. Verify all credentials are correctly copied between the Google Cloud Console and your app
3. Make sure your app is using the latest version of the Expo AuthSession module 