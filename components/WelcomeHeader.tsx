import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function WelcomeHeader() {
  const { user, isAuthenticated } = useAuth();

  // if (!isAuthenticated || !user) {
  //   return null;
  // }

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <View style={styles.container}>
      <View>
        <Image
          source={require('../assets/images/Logo.png')}
          style={styles.avatarImage}
          resizeMode="contain"
        />
      </View>
      <View style={styles.content}>
        <View style={styles.textContainer}>
          <View style={styles.welcomeRow}>
            <Text style={styles.greeting}>{getGreeting()} </Text>
            <Text style={styles.username}>
              {isAuthenticated && user?.nickname ? `${user.nickname}!` : '!'}
            </Text>

          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8f8f8',
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textContainer: {
    flex: 1,
  },
  greeting: {
    fontSize: 14,
    color: '#000000',
    marginBottom: 4,
  },
  welcomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  welcomeText: {
    fontSize: 18,
    color: '#333',
    fontWeight: '600',
  },
  avatarImage: {
    width: 150,
    height: 60,
    borderRadius: 20,
  },
  username: {
    fontSize: 14,
    color: '#2528be',
    marginRight: 6,
  },
  avatarText: {
    fontSize: 16,
    color: 'white',
    fontWeight: 'bold',
  },
});