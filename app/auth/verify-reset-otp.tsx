import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

const API_URL = 'https://backend.listtra.com';

export default function VerifyResetOTPScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState(false);
  const router = useRouter();
  
  // Create refs for each input
  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Focus on first input when component mounts
  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  const handleOtpChange = (value: string, index: number) => {
    if (value.length > 1) {
      // Handle paste
      const pastedOtp = value.slice(0, 6).split('');
      const newOtp = [...otp];
      pastedOtp.forEach((digit, i) => {
        if (i < 6) newOtp[i] = digit;
      });
      setOtp(newOtp);
      
      // Focus on the last filled input or the last input
      const lastFilledIndex = Math.min(pastedOtp.length - 1, 5);
      if (inputRefs.current[lastFilledIndex]) {
        inputRefs.current[lastFilledIndex].focus();
      }
    } else {
      // Handle single character input
      const newOtp = [...otp];
      newOtp[index] = value;
      setOtp(newOtp);
      
      // Move to next input if current is filled
      if (value && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      // Move to previous input on backspace if current is empty
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOTP = async () => {
    const otpString = otp.join('');
    
    if (otpString.length !== 6) {
      setError('Please enter the complete 6-digit OTP');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/verify-reset-otp/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          email,
          otp: otpString 
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Navigate to reset password screen
        router.push({
          pathname: '/auth/reset-password',
          params: { email, otp: otpString }
        });
      } else {
        setError(data.detail || data.otp?.[0] || 'Invalid OTP');
      }
    } catch (error) {
      console.error('OTP verification error:', error);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setResendLoading(true);
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
        // Clear current OTP and show success message
        setOtp(['', '', '', '', '', '']);
        setError('OTP resent successfully!');
        // Focus on first input
        if (inputRefs.current[0]) {
          inputRefs.current[0].focus();
        }
      } else {
        setError(data.detail || 'Failed to resend OTP');
      }
    } catch (error) {
      console.error('Resend OTP error:', error);
      setError('Network error. Please try again.');
    } finally {
      setResendLoading(false);
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
          <Text style={styles.headerTitle}>Verification OTP</Text>
          <Text style={styles.headerSubtitle}>
            A One Time Password (OTP) has been sent to your {email}.{'\n'}
            Enter it below to proceed.
          </Text>
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
            <View style={[styles.errorContainer, error.includes('successfully') && styles.successContainer]}>
              <Text style={[styles.errorText, error.includes('successfully') && styles.successText]}>
                {error}
              </Text>
            </View>
          )}

          {/* OTP Input */}
          <View style={styles.otpContainer}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => {
                  inputRefs.current[index] = ref;
                }}
                style={styles.otpInput}
                value={digit}
                onChangeText={(value) => handleOtpChange(value, index)}
                onKeyPress={({ nativeEvent: { key } }) => handleKeyPress(key, index)}
                keyboardType="numeric"
                maxLength={1}
                selectTextOnFocus
              />
            ))}
          </View>

          {/* Verify OTP Button */}
          <TouchableOpacity
            style={styles.verifyButton}
            onPress={handleVerifyOTP}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Verify OTP</Text>
            )}
          </TouchableOpacity>

          {/* Resend OTP section */}
          <View style={styles.resendContainer}>
            <Text style={styles.resendText}>Having problem? </Text>
            <TouchableOpacity 
              onPress={handleResendOTP}
              disabled={resendLoading}
            >
              <Text style={styles.resendLink}>
                {resendLoading ? 'Sending...' : 'Resend OTP'}
              </Text>
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
    lineHeight: 22,
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
  successContainer: {
    backgroundColor: '#E8F5E8',
  },
  errorText: {
    color: '#D32F2F',
    fontSize: 14,
  },
  successText: {
    color: '#2E7D32',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    paddingHorizontal: 10,
  },
  otpInput: {
    width: 45,
    height: 45,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
    backgroundColor: 'white',
  },
  verifyButton: {
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
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  resendText: {
    color: '#757575',
    fontSize: 14,
  },
  resendLink: {
    color: '#2528be',
    fontSize: 14,
    fontWeight: '700',
  },
}); 