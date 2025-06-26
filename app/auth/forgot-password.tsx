import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

const API_URL = 'https://backend.listtra.com';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSendOTP = async () => {
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/forgot-password/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        // Navigate to OTP verification screen
        router.push({
          pathname: '/auth/verify-reset-otp',
          params: { email }
        });
      } else {
        // Handle different error scenarios
        if (response.status === 404) {
          // Email not found
          setError('No account found with this email address. Please check your email or sign up.');
        } else {
          // Other errors
          setError(data.detail || data.email?.[0] || 'Failed to send OTP');
        }
      }
    } catch (error) {
      console.error('Forgot password error:', error);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoBack = () => {
    router.back();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'height' : 'height'}
      style={styles.container}
    >
      <StatusBar style="light" />
      
      {/* Blue Header */}
      <View style={styles.header}>
        {/* Back Button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleGoBack}
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>

        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Forgot Password?</Text>
          <Text style={styles.headerSubtitle}>Please enter your email id to proceed</Text>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Form Card */}
        <View style={styles.formCard}>
          {/* Error Message */}
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Email Input */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor="#A0A0A0"
            />
          </View>

          {/* Send OTP Button */}
          <TouchableOpacity
            style={styles.sendOTPButton}
            onPress={handleSendOTP}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Send OTP</Text>
            )}
          </TouchableOpacity>

          {/* Having problem section */}
          <View style={styles.problemContainer}>
            <Text style={styles.problemText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/auth/signup')}>
              <Text style={styles.problemLink}>Sign Up</Text>
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
    paddingTop: Platform.OS === 'ios' ? 90 : 90,
    paddingBottom: 80,
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
    fontSize: 16,
    color: 'white',
    opacity: 0.9,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
    marginTop: -25,
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
  inputContainer: {
    marginBottom: 30,
    position: 'relative',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    backgroundColor: 'white',
  },
  sendOTPButton: {
    backgroundColor: '#2528be',
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
  problemContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  problemText: {
    color: '#757575',
    fontSize: 14,
  },
  problemLink: {
    color: '#2528be',
    fontSize: 14,
    fontWeight: '700',
  },
}); 