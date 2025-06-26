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
  View,
} from 'react-native';

export default function SignUpSuccessScreen() {
  const router = useRouter();

  const handleGoToSignIn = () => {
    router.replace('/auth/signin');
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
          <Text style={styles.title}>Awesome!</Text>
          <Text style={styles.subtitle}>Your account is ready to go.</Text>
        </View>

        {/* Success Image */}
        <View style={styles.imageContainer}>
          <Image
            source={require('../../assets/images/password-reset-success.png')}
            style={styles.successImage}
            resizeMode="contain"
          />
        </View>

        {/* Bottom Section */}
        <View style={styles.bottomSection}>
          <Text style={styles.actionText}>Sign in and start exploring!</Text>
          
          <TouchableOpacity
            style={styles.signInButton}
            onPress={handleGoToSignIn}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
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
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#757575',
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
  bottomSection: {
    alignItems: 'center',
    paddingTop: 20,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 24,
    textAlign: 'center',
  },
  signInButton: {
    backgroundColor: '#2528be',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 32,
    alignItems: 'center',
    width: '100%',
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