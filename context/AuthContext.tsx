import axios from 'axios';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { googleSignInService } from '../services/googleSignInService';

// Configure Google WebBrowser auth (keeping for web fallback)
//WebBrowser.maybeCompleteAuthSession();

// API endpoint configuration
const API_URL = 'https://backend.listtra.com';

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
  register: (userData: any) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  tokens: {
    accessToken: string | null;
    refreshToken: string | null;
  };
  storeTokens: (accessToken: string, refreshToken: string, userData?: any) => Promise<void>;
  setTokensDirectly: (accessToken: string, refreshToken: string, userData?: any) => Promise<void>;
  handleGoogleSignIn: () => Promise<{ success: boolean; tokens?: any; user?: any; error?: string }>;
};

// Create the context with default values
const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: false,
  isInitializing: true,
  isAuthenticated: false,
  error: null,
  login: async () => { },
  register: async () => { },
  logout: async () => { },
  clearError: () => { },
  tokens: {
    accessToken: null,
    refreshToken: null
  },
  setTokensDirectly: async () => { },
  storeTokens: async () => { },
  handleGoogleSignIn: async () => ({ success: false }),
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

  // Function to store tokens securely
  const storeTokens = async (accessToken: string, refreshToken: string, userData?: any) => {
    try {
      console.log('Storing tokens, token lengths:', accessToken.length, refreshToken.length);
      console.log('User data to store:', userData);

      // Special handling for Expo Go
      if (isExpoGo) {
        console.log('Using Expo Go token storage approach');
        await SecureStore.deleteItemAsync('accessToken');
        await SecureStore.deleteItemAsync('refreshToken');
        await new Promise(resolve => setTimeout(resolve, 100));
        await SecureStore.setItemAsync('accessToken', accessToken);
        await SecureStore.setItemAsync('refreshToken', refreshToken);

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
        await SecureStore.setItemAsync('accessToken', accessToken);
        await SecureStore.setItemAsync('refreshToken', refreshToken);
      }

      // Update state
      setTokens({ accessToken, refreshToken });

      // Set user data if provided
      if (userData) {
        console.log('Setting user data from storeTokens:', userData);
        setUser(userData);
      }

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

    // Sign out from Google as well
    try {
      await googleSignInService.signOut();
    } catch (error) {
      console.error('Error signing out from Google:', error);
    }

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

  // Function to directly set tokens (useful for WebView integration)
  // In setTokensDirectly function, make sure you're setting the user:
  const setTokensDirectly = async (accessToken: string, refreshToken: string, userData?: any) => {
    try {
      await storeTokens(accessToken, refreshToken, userData);

      if (userData) {
        console.log('🔧 Setting user in setTokensDirectly:', userData);
        setUser(userData);
      } else {
        // If no userData provided, fetch it using the access token
        try {
          const response = await axios.get(`${API_URL}/api/profile/`, {
            headers: {
              Authorization: `Bearer ${accessToken}`
            }
          });
          console.log('🔧 Fetched user profile:', response.data);
          setUser(response.data);
        } catch (error) {
          console.error('Error fetching user profile with provided token:', error);
        }
      }
      return true;
    } catch (error) {
      console.error('Error setting tokens directly:', error);
      return false;
    }
  };

  // Updated handleGoogleSignIn to use native Google Sign-In
  const handleGoogleSignIn = async (): Promise<{ success: boolean; tokens?: any; user?: any; error?: string }> => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('🚀 AuthContext: Starting native Google Sign-In...');

      const result = await googleSignInService.signIn();
      console.log('🚀 AuthContext: GoogleSignInService result:', result);

      if (result.success && result.tokens && result.user) {
        console.log('🚀 AuthContext: Native Google Sign-In successful');
        console.log('🚀 AuthContext: Tokens:', result.tokens);
        console.log('🚀 AuthContext: User:', result.user);

        console.log('🚀 AuthContext: Google sign-in successful - returning tokens and user');
        setIsLoading(false);

        return {
          success: true,
          tokens: result.tokens,
          user: result.user
        };
      } else {
        console.error('🚀 AuthContext: Native Google Sign-In failed:', result.error);
        setError(result.error || 'Google Sign-In failed');
        setIsLoading(false);
        return { success: false, error: result.error || 'Google Sign-In failed' };
      }
    } catch (error: any) {
      console.error('🚀 AuthContext: Google sign in error:', error);
      setError('Authentication failed. Please try again.');
      setIsLoading(false);
      return { success: false, error: 'Authentication failed' };
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
        register,
        logout,
        clearError,
        tokens,
        setTokensDirectly: async (accessToken: string, refreshToken: string, userData?: any): Promise<void> => {
          await setTokensDirectly(accessToken, refreshToken, userData);
        },
        handleGoogleSignIn,
        storeTokens: async (accessToken: string, refreshToken: string, userData?: any): Promise<void> => {
          await storeTokens(accessToken, refreshToken);
          if (userData) {
            setUser(userData);
          }
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext; 