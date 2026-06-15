import React, { useState } from 'react';
import { View, TextInput, Button, Text, StyleSheet, Alert } from 'react-native';
import { account, saveAuthCredentials } from '@/lib/appwrite';
import { useRouter } from 'expo-router';
import { ID } from 'appwrite';

export default function SignupScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignup() {
    if (!email || !password) {
      Alert.alert('Validation', 'Email and password are required');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Validation', 'Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      console.log('Creating user account...');
      
      // Step 1: Create the user account
      const user = await (account as any).create(ID.unique(), email, password);
      console.log('User created successfully:', user.$id);

      // Step 2: Create session and persist login credentials
      console.log('Creating session...');
      await (account as any).createEmailPasswordSession(email, password);
      await saveAuthCredentials(email, password);
      
      Alert.alert('Success', 'Account created! Logged in.');
      router.replace('/');
    } catch (err: any) {
      console.error('Signup error:', JSON.stringify(err, null, 2));
      const errorMessage = err?.message || 'Signup failed';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>
      <TextInput 
        placeholder="Email" 
        value={email} 
        onChangeText={setEmail} 
        keyboardType="email-address" 
        autoCapitalize="none" 
        style={styles.input} 
      />
      <TextInput 
        placeholder="Password (min 8 chars)" 
        value={password} 
        onChangeText={setPassword} 
        secureTextEntry 
        style={styles.input} 
      />
      <Button 
        title={loading ? 'Creating...' : 'Sign Up'} 
        onPress={handleSignup} 
        disabled={loading} 
      />
      <View style={{height: 12}} />
      <Button 
        title="Already have an account? Login" 
        onPress={() => router.push('/login')} 
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
