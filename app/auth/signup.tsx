import { Ionicons } from '@expo/vector-icons';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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

export default function SignUpScreen() {
  const { register, isLoading, error, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [termsStatus, setTermsStatus] = useState(''); // 'accepted', 'rejected', or ''
  const [userFriendlyError, setUserFriendlyError] = useState('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const router = useRouter();

  // Check for terms status when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      const checkTermsStatus = async () => {
        try {
          const storedTermsStatus = await SecureStore.getItemAsync('termsStatus');
          if (storedTermsStatus) {
            setTermsStatus(storedTermsStatus);
            // Clear the stored terms status after reading
            await SecureStore.deleteItemAsync('termsStatus');
          }
        } catch (error) {
          console.log('Error checking terms status:', error);
        }
      };

      checkTermsStatus();
    }, [])
  );

  // Process errors to show user-friendly messages
  useEffect(() => {
    if (error) {
      // Check for server errors (HTML or 500)
      if (
        typeof error === 'string' && 
        (error.trim().startsWith('<!DOCTYPE html') || 
         error.trim().startsWith('<html') || 
         error.trim().includes('Server Error (500)') ||
         error.includes('status code 500'))
      ) {
        setUserFriendlyError('Sorry, something went wrong. Please try again later.');
      } 
      // Email already exists
      else if (
        typeof error === 'string' && 
        (error.includes('email') && error.includes('already exists'))
      ) {
        setUserFriendlyError('This email is already registered. Please use another email or sign in.');
      }
      // Other validation errors
      else if (error && typeof error === 'object') {
        setUserFriendlyError('Please check your information and try again.');
      } 
      // Default error
      else {
        setUserFriendlyError('Registration failed. Please try again.');
      }
    } else {
      setUserFriendlyError('');
    }
  }, [error]);

  // Check for pending email from failed Google sign-in
  useEffect(() => {
    const checkPendingEmail = async () => {
      try {
        const pendingEmail = await SecureStore.getItemAsync('pendingEmail');
        if (pendingEmail) {
          setEmail(pendingEmail);
          // Clear the pendingEmail once used
          await SecureStore.deleteItemAsync('pendingEmail');
        }
      } catch (error) {
        console.log('Error checking pending email:', error);
      }
    };

    checkPendingEmail();
  }, []);

  // Clear validation error when inputs change
  useEffect(() => {
    if (validationError) {
      setValidationError('');
    }
  }, [email, password, nickname]);

  // Check if form is complete and terms are accepted
  const isFormValid = () => {
    return (
      email.trim() !== '' &&
      nickname.trim() !== '' &&
      password.trim() !== '' &&
      termsStatus === 'accepted'
    );
  };

  // Validate form before submission
  const validateForm = () => {
    // Clear previous errors
    setValidationError('');
    clearError();

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setValidationError('Please enter a valid email address');
      return false;
    }

    // Validate nickname
    if (!nickname || nickname.length < 3) {
      setValidationError('Nickname should be at least 3 characters long');
      return false;
    }

    // Validate password
    if (password.length < 8) {
      setValidationError('Password should be at least 8 characters long');
      return false;
    }

    // Validate terms acceptance
    if (termsStatus !== 'accepted') {
      setValidationError('You must accept the Terms of Service and Privacy Policy');
      return false;
    }

    return true;
  };

  // Handle sign-up
  const handleSignUp = async () => {
    if (!validateForm()) {
      return;
    }

    const userData = {
      email,
      nickname,
      username: nickname,
      password,
      password_confirm: password, // Use same password for confirmation
    };

    await register(userData);
  };

  // Navigate to terms page
  const handleTermsNavigation = () => {
    router.push('/auth/terms');
  };

  // Get terms status icon and color
  const getTermsStatusIcon = () => {
    if (termsStatus === 'accepted') {
      return <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />;
    } else if (termsStatus === 'rejected') {
      return <Ionicons name="close-circle" size={24} color="#F44336" />;
    }
    // Return null when no action has been taken yet
    return null;
  };

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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
    >
      <StatusBar style="dark" translucent={true} />
      
      {/* Blue Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.push('/auth/signin')}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Sign Up</Text>
          <Text style={styles.headerSubtitle}>Sign up and start exploring!</Text>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={[
          styles.scrollContent,
          keyboardVisible && { paddingBottom: 100 }
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      >
        {/* Form Card */}
        <View style={styles.formCard}>
          {/* Error Message */}
          {(userFriendlyError || validationError) && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>
                {validationError || userFriendlyError}
              </Text>
            </View>
          )}

          {/* Nick name Input */}
          <AnimatedInput
            label="Nick name"
            placeholder=""
            value={nickname}
            onChangeText={setNickname}
            autoCapitalize="none"
          />

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
            hasError={!!(password && password.length < 8)}
          />

          {/* Terms and Conditions */}
          <View style={styles.termsContainer}>
            <View style={styles.termsTextContainer}>
              <Text style={styles.termsText}>
                View and agree to{' '}
                <Text style={styles.termsLink} onPress={handleTermsNavigation}>
                  Terms & Conditions
                </Text>
              </Text>
            </View>
            <View style={styles.termsStatusContainer}>
              {getTermsStatusIcon()}
            </View>
          </View>

          {/* Sign Up Button */}
          <TouchableOpacity
            style={[
              styles.signUpButton,
              { backgroundColor: isFormValid() ? '#2528be' : '#A0A0A0' }
            ]}
            onPress={handleSignUp}
            disabled={isLoading || !isFormValid()}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Sign Up</Text>
            )}
          </TouchableOpacity>

          {/* Sign In Link */}
          <View style={styles.signinContainer}>
            <Text style={styles.signinText}>Already have an account? </Text>
            <Link href="/auth/signin" asChild>
              <TouchableOpacity>
                <Text style={styles.signinLink}>Sign In</Text>
              </TouchableOpacity>
            </Link>
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
  headerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 20,
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
    marginTop: -10,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  formCard: {
    marginTop: Platform.OS === 'ios' ? 30 : 30,
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
  },
  errorContainer: {
    backgroundColor: '#ffeaea',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ffb3b3',
    padding: 14,
    marginBottom: 18,
    alignItems: 'center',
  },
  errorText: {
    color: '#d32f2f',
    fontWeight: 'bold',
    fontSize: 15,
    textAlign: 'center',
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
  },
  inputLabel: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    backgroundColor: 'white',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: 'white',
  },
  passwordInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
  },
  passwordToggle: {
    padding: 16,
  },
  passwordError: {
    color: '#F44336',
    fontSize: 14,
    marginTop: -15,
    marginBottom: 15,
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
    marginTop: 0,
    paddingHorizontal: 4,
  },
  termsTextContainer: {
    flexShrink: 1,
  },
  termsText: {
    fontSize: 14,
    color: '#757575',
    lineHeight: 20,
  },
  termsLink: {
    color: '#2528be',
    fontWeight: '600',
  },
  termsStatusContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    minWidth: 24,
    minHeight: 24,
  },
  signUpButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#2528be',
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
  signinContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  signinText: {
    color: '#757575',
    fontSize: 14,
  },
  signinLink: {
    color: '#2528be',
    fontSize: 14,
    fontWeight: '700',
  },
  backButton: {
    position: 'absolute',
    left: 16,
    top: Platform.OS === 'ios' ? 60 : 60,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    zIndex: 10,
  },
}); 