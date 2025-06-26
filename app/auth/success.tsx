import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useAuth } from '../../context/AuthContext';

export default function SuccessScreen() {
  const router = useRouter();
  const { user } = useAuth();
  
  const handleSignIn = () => {
    // Navigate to the main app
    router.replace('/(tabs)');
  };
  
  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.back()}
      >
        <Ionicons name="chevron-back" size={24} color="#333" />
      </TouchableOpacity>
      
      <View style={styles.content}>
        <Text style={styles.title}>Awesome!</Text>
        <Text style={styles.subtitle}>Your account is ready to go.</Text>
        
        <View style={styles.illustrationContainer}>
          <Ionicons name="checkmark-circle" size={120} color="#2528be" />
        </View>
        
        <Text style={styles.message}>Sign in and start exploring!</Text>
        
        <TouchableOpacity
          style={styles.signInButton}
          onPress={handleSignIn}
        >
          <Text style={styles.buttonText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    </View>
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
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
    color: '#333',
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 40,
    color: '#666',
  },
  illustrationContainer: {
    width: 250,
    height: 250,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  message: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 20,
    color: '#333',
  },
  signInButton: {
    backgroundColor: '#2528be',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 8,
    width: '80%',
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 