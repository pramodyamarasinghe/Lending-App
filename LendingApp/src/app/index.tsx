import React, { useState } from 'react';
import { View, Button, Text, StyleSheet, Alert } from 'react-native';
import { account, clearAuthCredentials } from '@/lib/appwrite';
import { useRouter } from 'expo-router';


export default function HomeScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await account.deleteSession('current');
      await clearAuthCredentials();
      Alert.alert('Success', 'Logged out');
      router.replace('/login');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Logout failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Lending App Dashboard</Text>
      <Text style={styles.subtitle}>You are logged in!</Text>
      
      <View style={styles.content}>
        <Text style={styles.text}>Welcome to your dashboard</Text>
        <Text style={styles.text}>This is the home page after successful authentication</Text>
      </View>

      <View style={styles.buttonContainer}>
        <Button 
          title={loading ? 'Logging out...' : 'Logout'} 
          onPress={handleLogout} 
          disabled={loading}
          color="#ff6b6b"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  content: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 8,
    marginBottom: 20,
    width: '100%',
  },
  text: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
  },
  buttonContainer: {
    width: '100%',
  },
});
