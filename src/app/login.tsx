import React, { useState } from 'react';
import { View, TextInput, Button, Text, StyleSheet, Alert } from 'react-native';
import { account, saveAuthCredentials } from '@/lib/appwrite';
import { useRouter } from 'expo-router';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Validation', 'Email and password are required');
      return;
    }
    setLoading(true);
    try {
      console.log('Logging in with:', { email });
      // Use createEmailPasswordSession which is available in v26
      const session = await (account as any).createEmailPasswordSession(email, password);
      console.log('Session created:', session);
      await saveAuthCredentials(email, password);
      Alert.alert('Success', 'Logged in successfully!');
      router.replace('/');
    } catch (err: any) {
      console.error('Login error full object:', JSON.stringify(err, null, 2));
      const errorMessage = err?.message || err?.response?.message || 'Login failed';
      Alert.alert('Login Error', errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login</Text>
      <TextInput 
        placeholder="Email" 
        value={email} 
        onChangeText={setEmail} 
        keyboardType="email-address" 
        autoCapitalize="none" 
        style={styles.input} 
      />
      <TextInput 
        placeholder="Password" 
        value={password} 
        onChangeText={setPassword} 
        secureTextEntry 
        style={styles.input} 
      />
      <Button 
        title={loading ? 'Signing in...' : 'Sign In'} 
        onPress={handleLogin} 
        disabled={loading} 
      />
      <View style={{height: 12}} />
      <Button 
        title="Create New Account" 
        onPress={() => router.push('/signup')} 
        color="#888"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#f5f5f5' },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 12, marginBottom: 16, borderRadius: 6, backgroundColor: '#fff' },
});
