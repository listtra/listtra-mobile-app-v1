import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

export default function ResetSuccessScreen() {
  const router = useRouter();

  const handleContinue = () => {
    // Navigate back to sign in screen
    router.push('/auth/signin');
  };

  const handleGoBack = () => {
    router.back();
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header with back button */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleGoBack}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Title */}
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Your password{'\n'}has been reset!</Text>
          <Text style={styles.subtitle}>Continue with your new password</Text>
        </View>

        {/* Your Custom Image */}
        <View style={styles.imageContainer}>
          <Image
            source={require('../../assets/images/password-reset-success.png')}
            style={styles.successImage}
            resizeMode="contain"
          />
        </View>

        {/* Continue Button */}
        <TouchableOpacity
          style={styles.continueButton}
          onPress={handleContinue}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
    paddingBottom: 40,
  },
  titleContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    lineHeight: 38,
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  successImage: {
    width: '100%',
    height: '100%',
    maxWidth: 350,
    maxHeight: 400,
  },
  continueButton: {
    backgroundColor: '#2528be',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#2528be',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
}); 