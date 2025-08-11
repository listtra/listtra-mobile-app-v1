import axios from 'axios';
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Configure Google WebBrowser auth
WebBrowser.maybeCompleteAuthSession();

// API endpoint configuration
const API_URL = 'https://backend.listtra.com'; // Local development server

// Define app scheme for deep linking
const APP_SCHEME = 'com.listtra.app';

// Define types for our context
type User = {
  id: string;
  email: string;
  nickname: string;
};

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  isInitializing: boolean;
  isAuthenticated: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  register: (userData: any) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  tokens: {
    accessToken: string | null;
    refreshToken: string | null;
  };
  setTokensDirectly: (accessToken: string, refreshToken: string, userData?: any) => Promise<void>;
};

// Create the context with default values
const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: false,
  isInitializing: true,
  isAuthenticated: false,
  error: null,
  login: async () => { },
  loginWithGoogle: async () => { },
  register: async () => { },
  logout: async () => { },
  clearError: () => { },
  tokens: {
    accessToken: null,
    refreshToken: null
  },
  setTokensDirectly: async () => { },
});

// Hook to use the auth context
export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [tokens, setTokens] = useState({
    accessToken: null as string | null,
    refreshToken: null as string | null,
  });

  const isExpoGo = Constants.executionEnvironment === 'storeClient';

  const WEB_CLIENT_ID = (Constants.expoConfig?.extra as any)?.GOOGLE_WEB_CLIENT_ID;
  const ANDROID_CLIENT_ID = (Constants.expoConfig?.extra as any)?.GOOGLE_ANDROID_CLIENT_ID;
  const IOS_CLIENT_ID = (Constants.expoConfig?.extra as any)?.GOOGLE_IOS_CLIENT_ID;

  console.log('isExpoGo', isExpoGo);
  console.log('WEB_CLIENT_ID', WEB_CLIENT_ID);
  console.log('ANDROID_CLIENT_ID', ANDROID_CLIENT_ID);
  console.log('IOS_CLIENT_ID', IOS_CLIENT_ID);

  // Generate a nonce for implicit id_token flow (required by Google when requesting id_token)
  const nonce = useMemo(() => {
    const bytes: number[] = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
    return bytes.map((b) => ('0' + b.toString(16)).slice(-2)).join('');
  }, []);

  // Configure Google OAuth based on environment
  const [request, response, promptAsyncOriginal] = isExpoGo
    ? Google.useAuthRequest({
      // For Expo Go - use web client with proxy URI
      clientId: WEB_CLIENT_ID,
      scopes: ['profile', 'email', 'openid'],
      redirectUri: AuthSession.makeRedirectUri({ useProxy: true } as any),
      responseType: 'id_token' as any,
      usePKCE: false as any,
      extraParams: { prompt: 'select_account', nonce }
    })
    : Google.useAuthRequest({
      // For development builds - use platform-specific clients
      androidClientId: ANDROID_CLIENT_ID,
      iosClientId: IOS_CLIENT_ID,
      webClientId: WEB_CLIENT_ID,
      scopes: ['profile', 'email', 'openid'],
      responseType: 'code' as any,
      usePKCE: true as any,
      extraParams: { prompt: 'select_account' },
    });

  // Function to store tokens securely
  const storeTokens = async (accessToken: string, refreshToken: string) => {
    try {
      console.log('Storing tokens, token lengths:', accessToken.length, refreshToken.length);

      // Special handling for Expo Go
      if (isExpoGo) {
        console.log('Using Expo Go token storage approach');
        // In Expo Go, we need to ensure the tokens are stored correctly
        // First clear any existing tokens
        await SecureStore.deleteItemAsync('accessToken');
        await SecureStore.deleteItemAsync('refreshToken');

        // Small delay to ensure deletion is complete
        await new Promise(resolve => setTimeout(resolve, 100));

        // Now store the new tokens
        await SecureStore.setItemAsync('accessToken', accessToken);
        await SecureStore.setItemAsync('refreshToken', refreshToken);

        // Verify tokens were stored correctly
        const storedAccessToken = await SecureStore.getItemAsync('accessToken');
        const storedRefreshToken = await SecureStore.getItemAsync('refreshToken');

        console.log('Tokens stored verification:', {
          accessTokenStored: !!storedAccessToken,
          refreshTokenStored: !!storedRefreshToken,
          accessTokenLength: storedAccessToken?.length,
          refreshTokenLength: storedRefreshToken?.length
        });

        if (!storedAccessToken || !storedRefreshToken) {
          console.error('Failed to store tokens in Expo Go');
        }
      } else {
        // Normal storage for development builds
        await SecureStore.setItemAsync('accessToken', accessToken);
        await SecureStore.setItemAsync('refreshToken', refreshToken);
      }

      // Update state
      setTokens({ accessToken, refreshToken });
      console.log('Token state updated');
    } catch (error) {
      console.error('Error storing tokens:', error);
    }
  };

  // Function to load tokens from secure storage
  const loadTokens = async () => {
    try {
      const accessToken = await SecureStore.getItemAsync('accessToken');
      const refreshToken = await SecureStore.getItemAsync('refreshToken');

      if (accessToken && refreshToken) {
        setTokens({ accessToken, refreshToken });
        return { accessToken, refreshToken };
      }
      return null;
    } catch (error) {
      console.error('Error loading tokens:', error);
      return null;
    }
  };

  // Function to clear tokens from secure storage
  const clearTokens = async () => {
    try {
      await SecureStore.deleteItemAsync('accessToken');
      await SecureStore.deleteItemAsync('refreshToken');
      setTokens({ accessToken: null, refreshToken: null });
    } catch (error) {
      console.error('Error clearing tokens:', error);
    }
  };

  // Initialize auth state on app start
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedTokens = await loadTokens();

        if (storedTokens?.accessToken) {
          // Validate token and get user profile
          try {
            const response = await axios.get(`${API_URL}/api/profile/`, {
              headers: {
                Authorization: `Bearer ${storedTokens.accessToken}`,
                'X-Expo-Go': isExpoGo ? 'true' : 'false'
              }
            });
            console.log('Profile response(User):', response.data);

            setUser(response.data);
          } catch (error) {
            // If token is invalid or expired, try refresh
            if (storedTokens.refreshToken) {
              await refreshAccessToken(storedTokens.refreshToken);
            } else {
              // If no refresh token, clear user and tokens
              await clearTokens();
              setUser(null);
            }
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        setIsInitializing(false);
      }
    };

    initializeAuth();
  }, []);

  // Handle Google auth response
  useEffect(() => {
    console.log('Google auth response received:', response);
    const doExchange = async () => {
      try {
        if (response?.type !== 'success') return;
        console.log('Google auth success response:', JSON.stringify(response, null, 2));

        // Native (code + PKCE): exchange the code for tokens to get id_token
        const authParams: any = (response as any)?.params || {};
        if (authParams.code) {
          const code: string = authParams.code;
          const redirectUri = (request as any)?.redirectUri || AuthSession.makeRedirectUri({ scheme: APP_SCHEME, path: 'oauthredirect' });
          console.log('Using redirectUri for exchange:', redirectUri);
          const clientIdToUse = Platform.OS === 'android' ? ANDROID_CLIENT_ID : IOS_CLIENT_ID;
          const discovery = {
            authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
            tokenEndpoint: 'https://oauth2.googleapis.com/token',
          } as const;

          const tokenResult: any = await AuthSession.exchangeCodeAsync(
            {
              clientId: clientIdToUse,
              code,
              redirectUri,
              extraParams: { code_verifier: (request as any)?.codeVerifier },
            },
            discovery
          );

          const idTokenExchanged: string | undefined = tokenResult?.id_token;
          await handleGoogleAuth({ idToken: idTokenExchanged });
          return;
        }

        // Expo Go (implicit): use id_token directly
        const idToken = (response as any)?.params?.id_token || (response as any)?.authentication?.idToken;
        await handleGoogleAuth({ idToken });
      } catch (err) {
        console.error('Error during Google code exchange:', err);
        setError('Google sign in failed during token exchange');
      }
    };

    doExchange();
  }, [response]);

  // Set up token refresh mechanism
  useEffect(() => {
    const checkTokenExpiration = async () => {
      const storedTokens = await loadTokens();
      if (!storedTokens?.accessToken) return;

      try {
        // Decode JWT to check expiration
        const base64Url = storedTokens.accessToken.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
          atob(base64).split('').map(c => {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          }).join('')
        );

        const { exp } = JSON.parse(jsonPayload);
        const expiresIn = exp * 1000 - Date.now();
        const minutes = Math.floor(expiresIn / 60000);
        const seconds = Math.floor((expiresIn % 60000) / 1000);
        console.log(`Token expires in: ${minutes} minutes and ${seconds} seconds`);


        // If token expires in less than 5 minutes, refresh it
        if (expiresIn < 5 * 60 * 1000) {
          console.log('Token expiring soon, refreshing...');
          await refreshAccessToken(storedTokens.refreshToken);
        }
      } catch (error) {
        console.error('Error checking token expiration:', error);
      }
    };

    // Check token expiration every minute
    const interval = setInterval(checkTokenExpiration, 60000);

    // Check immediately on mount
    checkTokenExpiration();

    return () => clearInterval(interval);
  }, []);

  // Function to handle refresh token
  // Function to handle refresh token
  const refreshAccessToken = async (refreshToken: string | null) => {
    console.log('=== TOKEN REFRESH STARTED ===');
    console.log('Refresh token available:', !!refreshToken);

    if (!refreshToken) {
      console.log('No refresh token, clearing auth state');
      await clearTokens();
      setUser(null);
      return false;
    }

    try {
      console.log('Making token refresh request...');
      const response = await axios.post(`${API_URL}/api/token/refresh/`, {
        refresh: refreshToken
      });

      if (response.data.access) {
        console.log('Token refresh successful, storing new tokens');
        await storeTokens(response.data.access, refreshToken);

        // Fetch user profile after token refresh to maintain authentication state
        console.log('Fetching user profile after token refresh...');
        try {
          const profileResponse = await axios.get(`${API_URL}/api/profile/`, {
            headers: {
              Authorization: `Bearer ${response.data.access}`,
              'X-Expo-Go': isExpoGo ? 'true' : 'false'
            }
          });

          console.log('Profile refreshed successfully:', profileResponse.data);
          console.log('User state before update:', user);
          setUser(profileResponse.data);
          console.log('User state updated after token refresh');
          console.log('isAuthenticated should now be:', !!(profileResponse.data && response.data.access));
        } catch (profileError) {
          console.error('Error fetching profile after token refresh:', profileError);
          console.log('Clearing auth state due to profile fetch failure');
          // If profile fetch fails after token refresh, clear everything
          await clearTokens();
          setUser(null);
          return false;
        }

        console.log('=== TOKEN REFRESH COMPLETED SUCCESSFULLY ===');
        return true;
      }

      console.log('Token refresh response missing access token');
      return false;
    } catch (error) {
      console.error('Token refresh failed:', error);
      console.log('Clearing auth state due to token refresh failure');
      await clearTokens();
      setUser(null);
      return false;
    }
  };

  // Process Google authentication using ID token only
  const handleGoogleAuth = async ({ idToken }: { idToken?: string }) => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('Handling Google auth with ID token');
      if (!idToken) {
        console.error('Missing ID token in Google auth response');
        setError('Authentication failed: missing ID token');
        setIsLoading(false);
        return false;
      }

      // Send only the ID token to backend; backend will verify and issue app tokens
      const apiResponse = await axios.post(`${API_URL}/api/auth/google/`, {
        id_token: idToken,
      });

      if (apiResponse.data.access && apiResponse.data.refresh) {
        // Store tokens
        await storeTokens(apiResponse.data.access, apiResponse.data.refresh);

        // Set user data
        setUser({
          id: apiResponse.data.user_id,
          email: apiResponse.data.email,
          nickname: apiResponse.data.nickname,
        });

        // Navigate to home screen
        router.replace('/(tabs)');
        return true;
      }

      return false;
    } catch (error: any) {
      console.error('Google auth error:', error);
      console.error('Error response:', error.response?.data);

      // Check if it's an account not found error - need to handle this the same way as web
      if (error.response?.status === 400) {
        // Store pending email for signup if needed
        if (error.response?.data?.email) {
          await SecureStore.setItemAsync('pendingEmail', error.response.data.email);
        }
        setError('No account found with this email. Please sign up first.');
      } else {
        setError(`Sign in with Google failed: ${error.message || 'Unknown error'}`);
      }

      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Regular email/password login
  const login = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('Starting login process with email:', email);
      console.log('Is Expo Go environment:', isExpoGo);

      const response = await axios.post(`${API_URL}/api/token/`, {
        email,
        password,
        is_expo_go: isExpoGo
      }, {
        headers: {
          'X-Expo-Go': isExpoGo ? 'true' : 'false'
        }
      });

      console.log('Login response received:', JSON.stringify({
        success: true,
        has_access_token: !!response.data.access,
        has_refresh_token: !!response.data.refresh,
        token_length: response.data.access ? response.data.access.length : 0
      }));

      if (response.data.access && response.data.refresh) {
        // Store tokens
        console.log('About to store tokens');
        await storeTokens(response.data.access, response.data.refresh);
        console.log('Tokens stored successfully');

        // Get user profile
        console.log('Fetching user profile');
        try {
          const profileResponse = await axios.get(`${API_URL}/api/profile/`, {
            headers: {
              Authorization: `Bearer ${response.data.access}`
            }
          });

          console.log('Profile fetched successfully:', JSON.stringify({
            has_profile_data: !!profileResponse.data,
            profile_keys: profileResponse.data ? Object.keys(profileResponse.data) : []
          }));

          setUser(profileResponse.data);
          console.log('User state updated');

          // Navigate to home screen
          console.log('Navigating to home screen');
          router.replace('/(tabs)');
        } catch (profileError) {
          console.error('Error fetching profile:', profileError);
          setError('Login successful but failed to fetch user profile');
        }
      }
    } catch (error: any) {
      console.error('Login error:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);

      // Check if this is an email verification error
      if (error.response?.data?.require_verification) {
        // Redirect to verification page
        router.push({
          pathname: '/auth/verify-email',
          params: { email }
        });
        return;
      }

      setError(error.response?.data?.detail || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Register new user
  const register = async (userData: any) => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('Attempting registration with data:', userData);
      // Register user
      const registerResponse = await axios.post(`${API_URL}/api/register/`, userData);
      console.log('Registration response:', registerResponse.data);

      // Check if registration requires email verification
      if (registerResponse.data.require_verification) {
        // Navigate to verification screen with email
        router.push({
          pathname: '/auth/verify-email',
          params: { email: userData.email }
        });
      } else {
        // If no verification required, go to success page instead of auto-login
        router.replace('/auth/signup-success');
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      if (error.response) {
        console.error('Error status:', error.response.status);
        console.error('Error data:', error.response.data);

        // Handle validation errors more specifically
        if (error.response.data) {
          const errorMessages = [];
          for (const field in error.response.data) {
            errorMessages.push(`${field}: ${error.response.data[field]}`);
          }
          if (errorMessages.length > 0) {
            setError(errorMessages.join(', '));
          } else {
            setError(error.response.data.detail || 'Registration failed. Please try again.');
          }
        }
      } else {
        setError('Registration failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Logout user
  const logout = async () => {
    console.log('Logging out user from mobile app');

    // Clear user state first
    setUser(null);

    // Clear tokens from secure storage
    await clearTokens();

    console.log('Mobile app logout completed - tokens and user cleared');

    // Note: WebView auth clearing is handled in PersistentWebView component
    // when isAuthenticated becomes false
  };

  // Clear error messages
  const clearError = () => {
    setError(null);
  };

  // Trigger Google login flow
  const loginWithGoogle = async () => {
    setError(null);
    console.log('Starting Google sign-in flow...');
    try {
      if (!request) {
        console.log('No request object available');
        setError('Failed to initialize Google sign in. Please try again.');
        return;
      }

      console.log('Auth request config:', JSON.stringify(request, null, 2));
      console.log('About to call promptAsync...');
      const result = await promptAsyncOriginal({ showInRecents: true });
      console.log('Prompt result type:', result?.type);
      console.log('Prompt result:', JSON.stringify(result, null, 2));

      // More detailed error handling
      if (result.type === 'error') {
        console.error('Google auth error:', result.error);
        if (result.error?.message?.includes('state')) {
          setError('Authentication failed. Please try again (state mismatch).');
        } else {
          setError(`Google sign-in failed: ${result.error?.message || 'Unknown error'}`);
        }
      } else if (result.type === 'cancel') {
        console.log('User cancelled Google sign-in');
      } else if (result.type === 'dismiss') {
        console.log('Google sign-in was dismissed');
        console.log('This usually means the redirect URI is not properly configured in Google Cloud Console');
        console.log('Or there might be an issue with the OAuth consent screen');
      }
    } catch (error) {
      console.error('Google sign in prompt error:', error);
      setError('Failed to start Google sign in. Please try again.');
    }
  };

  // Function to directly set tokens (useful for WebView integration)
  const setTokensDirectly = async (accessToken: string, refreshToken: string, userData?: any) => {
    try {
      await storeTokens(accessToken, refreshToken);

      if (userData) {
        setUser(userData);
      } else {
        // If no userData provided, fetch it using the access token
        try {
          const response = await axios.get(`${API_URL}/api/profile/`, {
            headers: {
              Authorization: `Bearer ${accessToken}`
            }
          });

          setUser(response.data);
        } catch (error) {
          console.error('Error fetching user profile with provided token:', error);
          // If profile fetch fails, don't set user
        }
      }

      // Navigate to home screen with tabs
      console.log('Navigating to home screen from setTokensDirectly');
      router.replace('/(tabs)');

      return true;
    } catch (error) {
      console.error('Error setting tokens directly:', error);
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isInitializing,
        isAuthenticated: !!user && !!tokens.accessToken,
        error,
        login,
        loginWithGoogle,
        register,
        logout,
        clearError,
        tokens,
        setTokensDirectly: async (accessToken: string, refreshToken: string, userData?: any): Promise<void> => {
          await setTokensDirectly(accessToken, refreshToken, userData);
        }
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext; 