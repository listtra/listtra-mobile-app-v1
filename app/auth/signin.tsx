import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useAuth } from '../../context/AuthContext';

// Animated Input Component
interface AnimatedInputProps {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  showPasswordToggle?: boolean;
  onTogglePassword?: () => void;
  showPassword?: boolean;
  hasError?: boolean;
}

const AnimatedInput: React.FC<AnimatedInputProps> = ({ 
  label, 
  placeholder, 
  value, 
  onChangeText, 
  secureTextEntry = false, 
  keyboardType = 'default',
  autoCapitalize = 'none',
  showPasswordToggle = false,
  onTogglePassword,
  showPassword = false,
  hasError = false
}) => {
  const animatedValue = useRef(new Animated.Value(value ? 1 : 0)).current;
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: isFocused || value ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isFocused, value]);

  const labelStyle = {
    position: 'absolute' as const,
    left: 16,
    top: animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: [16, -8],
    }),
    fontSize: animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: [16, 12],
    }),
    color: animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: ['#A0A0A0', '#2528be'],
    }),
    backgroundColor: 'white',
    paddingHorizontal: 4,
    zIndex: 1,
  };

  return (
    <View style={styles.animatedInputContainer}>
      <Animated.Text style={labelStyle}>
        {label}
      </Animated.Text>
      <View style={[
        styles.inputWrapper,
        { borderColor: isFocused ? '#2528be' : (hasError ? '#F44336' : '#E0E0E0') }
      ]}>
        <TextInput
          style={[styles.animatedInput, showPasswordToggle && { paddingRight: 50 }]}
          placeholder={isFocused || value ? '' : placeholder}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          placeholderTextColor="#A0A0A0"
        />
        {showPasswordToggle && (
          <Pressable 
            onPress={onTogglePassword}
            style={styles.passwordToggleIcon}
          >
            <Ionicons 
              name={showPassword ? "eye-off" : "eye"} 
              size={20} 
              color="#A0A0A0" 
            />
          </Pressable>
        )}
      </View>
    </View>
  );
};

export default function SignInScreen() {
  const { login, loginWithGoogle, isLoading, error, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const router = useRouter();

  // Check for pending email from failed Google sign-in
  useEffect(() => {
    const checkPendingEmail = async () => {
      const pendingEmail = await SecureStore.getItemAsync('pendingEmail');
      if (pendingEmail) {
        setShowSignupPrompt(true);
        setEmail(pendingEmail);
      }
    };

    checkPendingEmail();
  }, []);

  // Check if error contains sign-up prompt
  useEffect(() => {
    if (error && error.includes('Please sign up first')) {
      setShowSignupPrompt(true);
    }
  }, [error]);

  // Handle keyboard events
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => setKeyboardVisible(false)
    );

    return () => {
      keyboardDidHideListener?.remove();
      keyboardDidShowListener?.remove();
    };
  }, []);

  // Handle sign-in with email/password
  const handleSignIn = async () => {
    if (!email || !password) {
      return;
    }
    await login(email, password);
  };

  // Handle Google sign-in
  const handleGoogleSignIn = async () => {
    clearError();
    setShowSignupPrompt(false);
    console.log('Starting Google sign-in...');
    try {
      await loginWithGoogle();
    } catch (err) {
      console.error('Google sign-in error:', err);
    }
  };

  // Handle navigation to sign-up
  const handleGoToSignUp = () => {
    router.push('/auth/signup');
  };

  // Handle back navigation
  const handleGoBack = () => {
    router.back();
  };

  // Check if form is complete
  const isFormValid = () => {
    return email.trim() !== '' && password.trim() !== '';
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
    >
      <StatusBar style="light" />
      
      {/* Blue Header */}
      <View style={styles.header}>
        {/* Back Button */}
        

        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Sign In</Text>
          <Text style={styles.headerSubtitle}>Sign in and start exploring!</Text>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={[
          styles.scrollContent,
          keyboardVisible && { paddingBottom: 100 }
        ]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      >
        {/* Form Card */}
        <View style={styles.formCard}>
          {/* Error Message */}
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              {showSignupPrompt && (
                <TouchableOpacity
                  style={styles.signupPromptButton}
                  onPress={handleGoToSignUp}
                >
                  <Text style={styles.signupPromptButtonText}>Go to Sign Up</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Email Input */}
          <AnimatedInput
            label="Email"
            placeholder=""
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          {/* Password Input */}
          <AnimatedInput
            label="Password"
            placeholder=""
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            showPasswordToggle={true}
            onTogglePassword={() => setShowPassword(!showPassword)}
            showPassword={showPassword}
          />

          {/* Forgot Password Link */}
          <TouchableOpacity
            style={styles.forgotPasswordContainer}
            onPress={() => router.push('/auth/forgot-password')}
          >
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>

          {/* Sign In Button */}
          <TouchableOpacity
            style={[
              styles.signInButton,
              { backgroundColor: isFormValid() ? '#2528be' : '#A0A0A0' }
            ]}
            onPress={handleSignIn}
            disabled={isLoading || !isFormValid()}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          {/* Sign Up Link */}
          <View style={styles.signupContainer}>
            <Text style={styles.signupText}>Don't have an account? </Text>
            <Link href="/auth/signup" asChild>
              <TouchableOpacity>
                <Text style={styles.signupLink}>Sign Up</Text>
              </TouchableOpacity>
            </Link>
          </View>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Or with</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Social Login Buttons */}
          <View style={styles.socialContainer}>
            <TouchableOpacity
              style={styles.socialButton}
              onPress={handleGoogleSignIn}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              <FontAwesome name="google" size={20} color="#DB4437" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.socialButton}
              onPress={() => {
                // Apple sign-in functionality to be implemented later
                console.log('Apple sign-in pressed');
              }}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              <FontAwesome name="apple" size={20} color="#000000" />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  header: {
    backgroundColor: '#2528be',
    paddingTop: Platform.OS === 'ios' ? 80 : 80,
    paddingBottom: 60,
    position: 'relative',
    zIndex: 1,
  },
  backButton: {
    position: 'absolute',
    left: 16,
    top: Platform.OS === 'ios' ? 40 : 40,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    zIndex: 10,
  },
  headerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 20,
    zIndex: 1,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 18,
    color: 'white',
    opacity: 0.9,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
    marginTop: -25, // Helps create the overlap effect
  },
  formCard: {
    marginTop: Platform.OS === 'ios' ? 60 : 40,
    backgroundColor: 'white',
    borderRadius: 24,
    marginHorizontal: 20,
    paddingHorizontal: 20,
    paddingVertical: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 10,
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#D32F2F',
    fontSize: 14,
  },
  signupPromptButton: {
    backgroundColor: '#2528be',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  signupPromptButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  // Animated Input Styles
  animatedInputContainer: {
    marginBottom: 20,
    position: 'relative',
  },
  inputWrapper: {
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: 'white',
  },
  animatedInput: {
    padding: 16,
    fontSize: 16,
    color: '#333',
  },
  passwordToggleIcon: {
    position: 'absolute',
    right: 16,
    top: 16,
  },
  // Legacy styles (keeping for compatibility)
  inputContainer: {
    marginBottom: 20,
    position: 'relative',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    paddingRight: 50,
    backgroundColor: 'white',
  },
  inputIcon: {
    position: 'absolute',
    right: 15,
    top: 15,
  },
  signInButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#4054F9',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  dividerText: {
    marginHorizontal: 15,
    color: '#9E9E9E',
    fontSize: 14,
  },
  socialContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 8,
    marginBottom: 16,
  },
  socialButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  signupText: {
    color: '#757575',
    fontSize: 14,
  },
  signupLink: {
    color: '#2528be',
    fontSize: 14,
    fontWeight: '700',
  },
  forgotPasswordContainer: {
    alignItems: 'flex-end',
    marginBottom: 5,
  },
  forgotPasswordText: {
    color: '#2528be',
    fontSize: 14,
    fontWeight: '600',
  },
}); 