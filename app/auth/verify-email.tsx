import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';

// API endpoint configuration 
const API_URL = 'https://backend.listtra.com'; // Local development server

export default function VerifyEmailScreen() {
  const { error, clearError, isLoading, setTokensDirectly } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const email = params.email as string;
  
  const [verificationCode, setVerificationCode] = useState<string[]>(Array(6).fill(''));
  const [validationError, setValidationError] = useState('');
  const [isResending, setIsResending] = useState(false);
  
  // Create refs for each input
  const inputRefs = useRef<(TextInput | null)[]>(Array(6).fill(null));
  
  // Clear validation error when inputs change
  useEffect(() => {
    if (validationError) {
      setValidationError('');
    }
    if (error) {
      clearError();
    }
  }, [verificationCode, error, clearError]);
  
  // Handle input change
  const handleCodeChange = (text: string, index: number) => {
    if (text.length > 1) {
      // Handle pasting the entire code
      const pastedCode = text.slice(0, 6).split('');
      const newCode = [...verificationCode];
      
      pastedCode.forEach((char, idx) => {
        if (idx + index < 6) {
          newCode[idx + index] = char;
        }
      });
      
      setVerificationCode(newCode);
      
      // Focus on the last input
      if (pastedCode.length + index >= 6) {
        inputRefs.current[5]?.focus();
      } else {
        inputRefs.current[pastedCode.length + index - 1]?.focus();
      }
    } else {
      // Handle single character input
      const newCode = [...verificationCode];
      newCode[index] = text;
      setVerificationCode(newCode);
      
      // Auto-advance to the next input
      if (text && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    }
  };
  
  // Handle backspace
  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !verificationCode[index] && index > 0) {
      // Move to the previous input when backspace is pressed on an empty input
      inputRefs.current[index - 1]?.focus();
    }
  };
  
  // Verify code
  const handleVerifyCode = async () => {
    // Check if all digits are entered
    if (verificationCode.some(digit => !digit)) {
      setValidationError('Please enter the complete 6-digit code');
      return;
    }
    
    try {
      const code = verificationCode.join('');
      
      const response = await axios.post(`${API_URL}/api/verify-email/`, {
        email,
        verification_code: code
      });
      
      if (response.data.access && response.data.refresh) {
        // Don't store tokens, just navigate to success screen
        // User will need to sign in manually after verification
        router.replace('/auth/signup-success');
      } else {
        setValidationError('Verification failed. Please try again.');
      }
    } catch (error: any) {
      console.error('Verification error:', error);
      if (error.response?.data) {
        if (error.response.data.verification_code) {
          setValidationError(error.response.data.verification_code[0]);
        } else if (error.response.data.detail) {
          setValidationError(error.response.data.detail);
        } else {
          setValidationError('Verification failed. Please try again.');
        }
      } else {
        setValidationError('Network error. Please check your connection.');
      }
    }
  };
  
  // Resend verification code
  const handleResendCode = async () => {
    setIsResending(true);
    setValidationError('');
    
    try {
      await axios.post(`${API_URL}/api/resend-verification/`, { email });
      Alert.alert(
        'Code Sent',
        'A new verification code has been sent to your email.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Resend error:', error);
      setValidationError('Failed to resend code. Please try again.');
    } finally {
      setIsResending(false);
    }
  };
  
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar style="dark" />
      
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.back()}
      >
        <Ionicons name="chevron-back" size={24} color="#333" />
      </TouchableOpacity>
      
      <View style={styles.content}>
        <Text style={styles.title}>Verification Code</Text>
        
        <Text style={styles.subtitle}>
          A One Time Password (OTP) has been sent to your{' '}
          <Text style={styles.emailText}>{email}</Text>.
          Enter it below to proceed.
        </Text>
        
        {/* Error Message */}
        {(error || validationError) && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{validationError || error}</Text>
          </View>
        )}
        
        {/* OTP Input Fields */}
        <View style={styles.otpContainer}>
          {verificationCode.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => { inputRefs.current[index] = ref; }}
              style={styles.otpInput}
              value={digit}
              onChangeText={(text) => handleCodeChange(text, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              keyboardType="numeric"
              maxLength={1}
              selectTextOnFocus
              selectionColor="#2528be"
            />
          ))}
        </View>
        
        {/* Verify Button */}
        <TouchableOpacity
          style={styles.verifyButton}
          onPress={handleVerifyCode}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Verify Code</Text>
          )}
        </TouchableOpacity>
        
        {/* Resend Code */}
        <View style={styles.resendContainer}>
          <Text style={styles.resendText}>Having problem? </Text>
          <TouchableOpacity 
            onPress={handleResendCode}
            disabled={isResending}
          >
            {isResending ? (
              <ActivityIndicator size="small" color="#2528be" />
            ) : (
              <Text style={styles.resendLink}>Resend code</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    padding: 15,
    position: 'absolute',
    top: 45,
    left: 10,
    zIndex: 10,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    color: '#666',
    paddingHorizontal: 20,
  },
  emailText: {
    color: '#2528be',
    fontWeight: 'bold',
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    padding: 10,
    borderRadius: 8,
    marginBottom: 20,
    width: '100%',
  },
  errorText: {
    color: '#D32F2F',
    textAlign: 'center',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '80%',
    marginBottom: 30,
  },
  otpInput: {
    width: 45,
    height: 50,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: 'bold',
  },
  verifyButton: {
    backgroundColor: '#2528be',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 8,
    width: '80%',
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  resendText: {
    color: '#666',
  },
  resendLink: {
    color: '#2528be',
    fontWeight: 'bold',
  },
}); 