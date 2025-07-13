# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React Native mobile application for Listtra, a marketplace platform, built with Expo. The app provides a native mobile experience for browsing listings, chatting with sellers, and managing user profiles.

## Development Commands

### Core Commands
- `npm start` - Start the Expo development server
- `npm run android` - Run on Android emulator/device
- `npm run ios` - Run on iOS simulator/device
- `npm run web` - Run in web browser
- `npm run lint` - Run ESLint to check code quality
- `npm run reset-project` - Reset to blank project structure

### Build Commands
- `eas build --platform android` - Build Android APK/AAB
- `eas build --platform ios` - Build iOS app
- `eas build --platform all` - Build for both platforms

## Architecture

### Core Structure
- **Expo Router** - File-based routing with app directory structure
- **React Navigation** - Tab-based navigation with custom animated tab bar
- **Context API** - State management for authentication, notifications, and push notifications
- **WebView Integration** - Seamless integration with web platform using custom WebViewScreen component

### Key Components
- `WebViewScreen` - Custom WebView wrapper that handles authentication token injection, header hiding, and image loading fixes
- `AuthGuard` - Route protection component that manages authentication state
- Custom Tab Bar - Animated floating bubble navigation with icon transitions

### Authentication Flow
- Multi-provider authentication (email/password, Google OAuth)
- JWT token management with automatic refresh
- Secure token storage using Expo SecureStore
- WebView token injection for seamless web integration
- Special handling for Expo Go vs development builds

### API Integration
- Backend: `https://backend.listtra.com`
- Token-based authentication with Bearer tokens
- Push notification registration and management
- Notification polling and real-time updates

## Context Architecture

### AuthContext
- User authentication state management
- Token storage and refresh logic
- Google OAuth integration
- Environment-specific configuration (Expo Go vs dev builds)

### NotificationContext
- In-app notification management
- Real-time notification polling
- Unread count tracking
- Notification interaction handling

### PushNotificationContext
- Expo push notification registration
- Device token management
- Notification permission handling
- Deep linking integration

## WebView Integration

The app uses a sophisticated WebView integration to provide seamless access to the web platform:

### Token Injection
- Automatic injection of access/refresh tokens as URL parameters
- User ID parameter for ownership verification
- Native authentication flag for backend recognition

### UI Customization
- Automatic header hiding using comprehensive CSS injection
- Image loading fixes for Cloudinary and backend URLs
- CORS proxy fallback for failed image loads
- Responsive design adjustments for mobile

### Message Communication
- Two-way communication between WebView and native app
- Authentication validation messages
- Navigation state monitoring
- Error handling and fallback mechanisms

## Navigation Structure

### Tab Navigation
- Home/Listings (`index.tsx`)
- Liked Items (`liked.tsx`)
- Add Listing (`add.tsx`)
- Chats (`chats.tsx`)
- Profile (`profile.tsx`)

### Stack Navigation
- Authentication flow (`auth/`)
- Individual chat screens (`chat/[id].tsx`)
- Listing details (`listings/[slug]/[product_id]/`)
- Profile viewing (`profiles/[nickname].tsx`)
- Search functionality (`search/page.tsx`)

## Key Features

### Authentication
- Email/password login and registration
- Google OAuth integration
- Email verification flow
- Password reset functionality
- Secure token management

### Listings
- Browse marketplace listings
- View detailed product information
- Like/unlike functionality
- Search and filtering

### Messaging
- Real-time chat with sellers
- Message history
- Push notifications for new messages

### Notifications
- In-app notification system
- Push notification support
- Notification permission handling
- Unread count tracking

## Configuration

### Environment Variables
- `GOOGLE_MAPS_API_KEY` - Google Maps API key for location services
- API endpoint configured in `app.config.js`

### Platform-Specific Setup
- Android: Package name `com.listtra.app`
- iOS: Bundle identifier `com.listtra.app`
- Custom URL scheme: `listtra`

### Google OAuth Configuration
- Multiple client IDs for different platforms
- Environment-specific redirect URIs
- Expo Go vs development build handling

## Development Notes

### Expo Go vs Development Builds
The app has special handling for Expo Go environment:
- Different Google OAuth client configuration
- Modified token storage approach
- Enhanced debugging and fallback mechanisms

### WebView Token Management
- Tokens are injected as URL parameters for web platform authentication
- Automatic token refresh handling
- Validation failure recovery

### Image Loading
- Comprehensive image loading fixes for WebView
- Cloudinary URL optimization
- CORS proxy fallback for failed images
- Placeholder image handling

### Push Notifications
- Expo push notification service integration
- Device token registration with backend
- Notification permission management
- Deep linking support

## Testing

### Google Authentication
- Test users must be added to Google Cloud Console during development
- Use `/auth/google-debug` page for debugging OAuth issues
- Verify redirect URIs and SHA-1 fingerprints

### WebView Integration
- Test token injection and authentication flow
- Verify header hiding and UI customization
- Test image loading fixes
- Validate message communication

## Common Issues

### Google OAuth Errors
- "Access blocked: authorisation error" - Check Google Cloud Console configuration
- State mismatch errors - Verify redirect URIs
- SHA-1 fingerprint issues - Regenerate and update in Google Cloud Console

### WebView Issues
- Image loading failures - Check Cloudinary configuration and CORS settings
- Token validation failures - Verify backend authentication handling
- Header visibility - Update CSS injection rules

### Build Issues
- EAS build configuration in `eas.json`
- Platform-specific credentials management
- Environment variable handling