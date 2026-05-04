# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
npm install

# Start dev server (choose platform in terminal)
npx expo start

# Run on specific platform
npx expo run:ios
npx expo run:android

# Lint
npm run lint

# EAS builds
eas build --profile development --platform ios
eas build --profile development --platform android
eas build --profile production --platform ios
eas build --profile production --platform android
```

There is no test suite in this project.

After native dependency changes, run `npx pod-install` (iOS) or let `expo run:android` rebuild automatically.

## Environment Setup

Copy `.env` and fill in required values. The app reads these via `app.config.js` using `dotenv/config`:

- `GOOGLE_MAPS_API_KEY` — Google Maps for location autocomplete
- `GOOGLE_WEB_CLIENT_ID`, `GOOGLE_ANDROID_CLIENT_ID`, `GOOGLE_IOS_CLIENT_ID` — Google Sign-In
- `GOOGLE_IOS_URL_SCHEME` — iOS URL scheme for Google Sign-In callback

`app.config.js` hardcodes `apiUrl: "http://localhost:8000"` in the `extra` field — update this for staging/production.

Push notifications require a physical device and a dev build (not Expo Go). The iOS APNs `.p8` key must be uploaded to the Firebase Console for APNs↔FCM token exchange to work.

## Architecture

This is a **WebView-shell** React Native app. Almost all UI lives in an external Next.js web app; the native app wraps it in `react-native-webview` and provides native capabilities via a message-passing bridge.

### WebView Bridge (`components/PersistentWebView.tsx`)

The core component. It renders the web app and handles a bidirectional message protocol:

- **Web → Native messages** (`onMessage`): The web app posts JSON messages that trigger native actions — OAuth sign-in (`OPEN_WEB_OAUTH`), image picking (`OPEN_IMAGE_PICKER`), location requests (`REQUEST_NATIVE_LOCATION`), share sheet (`SHARE_LISTING`), navigation, and auth events.
- **Native → Web messages** (`postMessage`): After handling, the native side posts results back — auth tokens (`GOOGLE_AUTH_SUCCESS`, `APPLE_AUTH_SUCCESS`, `IMAGES_SELECTED`, `NATIVE_LOCATION_SUCCESS`, etc.).

The `BASE_URL` switches between `http://localhost:3000` (dev) and `https://staging.zirkly.com` (prod) based on `__DEV__`.

Safe area insets are injected into the WebView as `window.SAFE_AREA_INSETS` and a CSS variable `--safe-area-bottom` so the web app can handle native safe areas.

### Routing (`app/` — Expo Router file-based routing)

- `app/_layout.tsx` — Root layout: wraps everything in `AuthProvider`, manages splash screen fade-out, mounts `usePushNotifications` hook
- `app/(tabs)/index.tsx` — Main screen, loads `PersistentWebView` at `/listings`
- `app/(tabs)/_layout.tsx` — Tab bar is hidden; tabs are used only for route grouping
- `app/listings/[slug]/[product_id]/page.tsx` — Listing detail (WebView)
- `app/chat/[id].tsx` — Chat screen (WebView)
- `app/profiles/[nickname].tsx` — Profile screen (WebView)

Each screen is essentially just a `PersistentWebView` with a different route path.

### Auth (`context/AuthContext.tsx`)

JWT-based auth using `AsyncStorage`. On app start:
1. Detects fresh installs by checking a stored version key (clears stale tokens on reinstall)
2. Validates/loads stored JWT; decodes to check expiry
3. Fetches `/api/profile/` to confirm session; falls back to token refresh via `/api/token/refresh/`

A 60-second interval proactively refreshes tokens expiring within 5 minutes.

`setTokensDirectly` is the hook used when the WebView completes OAuth — it receives tokens from the web app's auth flow and stores them natively.

### Push Notifications

Two-layer setup:
1. **`hooks/usePushNotifications.ts`** — The active implementation, mounted in `_layout.tsx`. Registers/unregisters device token on auth state changes and handles notification tap routing (offer events → chat, price drops → listing page).
2. **`context/PushNotificationContext.tsx`** — Older context-based approach, not currently wired up in the app root.

On iOS, `@react-native-firebase/messaging` is used to exchange the APNs token for an FCM registration token (because the Django backend uses `firebase-admin` which requires FCM tokens). On Android, `expo-notifications` returns an FCM token directly.

Device tokens are registered with the backend at `/api/notifications_new/register-device/`.

### Social Auth Services

- `services/googleSignInService.ts` — Singleton that configures `@react-native-google-signin/google-signin`, runs native sign-in flow, then exchanges the Google `id_token` with the Django backend at `/api/auth/google/`
- `services/appleSignInService.ts` — Same pattern for Apple Sign-In via `expo-apple-authentication`

Both return `{ success, tokens, user }` which `AuthContext` passes back to the WebView as a postMessage.

### iOS Native Config

- Firebase is initialized in `ios/Zirkly/AppDelegate.swift`
- `ios/Podfile` uses `use_frameworks! :linkage => :static` (required for Firebase + React Native)
- `GoogleService-Info.plist` must exist at both root and `ios/Zirkly/` (two copies)
- `expo-build-properties` plugin sets `useFrameworks: "static"` and adds `GoogleUtilities` with `modular_headers: true`

## Key Constraints

- **No tab bar UI** — The tab bar is hidden; navigation happens entirely through WebView message events or native push notification taps.
- **Firebase on iOS requires static frameworks** — Any new native library that conflicts with static linking will break the iOS build.
- **Push notifications don't work in Expo Go** — Always test on a dev build on a physical device.
- **WebView URL whitelist** — External URLs open in the system browser via `Linking.openURL`; only `zirkly.com`, `staging.zirkly.com`, and `localhost` stay in the WebView.
