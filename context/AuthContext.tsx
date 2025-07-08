import axios from 'axios';
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import React, { createContext, useContext, useEffect, useState } from 'react';
import Constants from 'expo-constants';

// Configure Google WebBrowser auth
WebBrowser.maybeCompleteAuthSession();

// API endpoint configuration
const API_URL = 'https://backend.listtra.com'; // Local development server

// Define app scheme for deep linking
const APP_SCHEME = 'listtra';

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

  // Configure Google OAuth based on environment
  const [request, response, promptAsyncOriginal] = isExpoGo
    ? Google.useAuthRequest({
      // For Expo Go - use web client with proxy URI
      clientId: '827930578004-5um6tcqvf554guian9o8uqlui2mso2am.apps.googleusercontent.com',
      scopes: ['profile', 'email'],
      redirectUri: 'https://auth.expo.io/@pre_02/listtra-mobile-app',
    })
    : Google.useAuthRequest({
      // For development builds - use platform-specific clients
      androidClientId: '827930578004-t4j3tr0jes7dfobhib7h2779cir92fq4.apps.googleusercontent.com',
      iosClientId: '827930578004-9t2a9k7cmjevruiee4s0iq5k9h5p3eqg.apps.googleusercontent.com',
      webClientId: '827930578004-5um6tcqvf554guian9o8uqlui2mso2am.apps.googleusercontent.com',
      scopes: ['profile', 'email'],
    });

  console.log("Is Expo Go:", isExpoGo);
  console.log("Redirect URI:", request?.redirectUri);
  console.log('Redirect URI:', AuthSession.makeRedirectUri());
  console.log("App scheme:", APP_SCHEME);
  console.log("Owner:", Constants.expoConfig?.owner);
  console.log("Slug:", Constants.expoConfig?.slug);
  console.log("Responseee", response)

  // Function to store tokens securely
  const storeTokens = async (accessToken: string, refreshToken: string) => {
    try {
      await SecureStore.setItemAsync('accessToken', accessToken);
      await SecureStore.setItemAsync('refreshToken', refreshToken);
      setTokens({ accessToken, refreshToken });
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
                Authorization: `Bearer ${storedTokens.accessToken}`
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
    if (response?.type === 'success') {
      console.log('Google auth success response:', JSON.stringify(response, null, 2));
      handleGoogleAuth(response.authentication);
    } else if (response?.type === 'error') {
      console.error('Google sign-in error details:', JSON.stringify(response.error, null, 2));
      setError(`Google sign in failed: ${response.error?.message || 'Unknown error'}`);
    } else if (response) {
      console.log('Other response type:', response.type);
    }
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
  const refreshAccessToken = async (refreshToken: string | null) => {
    if (!refreshToken) {
      await clearTokens();
      setUser(null);
      return false;
    }

    try {
      const response = await axios.post(`${API_URL}/api/token/refresh/`, {
        refresh: refreshToken
      });

      if (response.data.access) {
        await storeTokens(response.data.access, refreshToken);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Token refresh failed:', error);
      await clearTokens();
      setUser(null);
      return false;
    }
  };

  // Process Google authentication
  const handleGoogleAuth = async (authentication: any) => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('Google auth success, getting user info');
      console.log('Authentication object:', JSON.stringify(authentication, null, 2));

      if (!authentication || !authentication.accessToken) {
        console.error('Invalid authentication object');
        setError('Authentication failed: missing access token');
        setIsLoading(false);
        return false;
      }

      // Get user info from Google
      const userInfoResponse = await fetch('https://www.googleapis.com/userinfo/v2/me', {
        headers: { Authorization: `Bearer ${authentication.accessToken}` },
      });

      if (!userInfoResponse.ok) {
        console.error('Failed to fetch user info:', userInfoResponse.status);
        setError(`Failed to fetch user info: ${userInfoResponse.statusText}`);
        setIsLoading(false);
        return false;
      }

      const userInfo = await userInfoResponse.json();
      console.log('Google user info:', userInfo);

      // Call your backend endpoint with the same data format as the web
      const apiResponse = await axios.post(`${API_URL}/api/auth/google/`, {
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
        id_token: authentication.idToken, // This matches what your web app is sending
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
      const response = await axios.post(`${API_URL}/api/token/`, {
        email,
        password
      });

      if (response.data.access && response.data.refresh) {
        // Store tokens
        await storeTokens(response.data.access, response.data.refresh);

        // Get user profile
        const profileResponse = await axios.get(`${API_URL}/api/profile/`, {
          headers: {
            Authorization: `Bearer ${response.data.access}`
          }
        });

        setUser(profileResponse.data);

        // Navigate to home screen
        router.replace('/(tabs)');
      }
    } catch (error: any) {
      console.error('Login error:', error);

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
    setUser(null);
    await clearTokens();
    router.replace('/auth/signin');
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
      const result = await promptAsyncOriginal({showInRecents: true});
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
    setIsLoading(true);
    setError(null);

    try {
      // Store tokens
      await storeTokens(accessToken, refreshToken);

      if (userData) {
        // Set user data if provided
        setUser(userData);
      } else {
        // Otherwise get user profile from API
        try {
          const profileResponse = await axios.get(`${API_URL}/api/profile/`, {
            headers: {
              Authorization: `Bearer ${accessToken}`
            }
          });

          setUser(profileResponse.data);
        } catch (profileError) {
          console.error('Error fetching profile:', profileError);
        }
      }
    } catch (error: any) {
      console.error('Set tokens error:', error);
      setError('Failed to set authentication tokens.');
    } finally {
      setIsLoading(false);
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
        setTokensDirectly
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext; 