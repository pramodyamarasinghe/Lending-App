import { Client, Account, ID } from 'appwrite';
import { APPWRITE_ENDPOINT, APPWRITE_PROJECT } from '@/constants/appwrite';

const AUTH_KEY = 'APPWRITE_AUTH_CREDENTIALS';

const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT);

export const account = new Account(client);

export const generateId = () => ID.unique();

// Simple in-memory storage fallback for Expo Go
let authStore: { email: string; password: string } | null = null;

export async function saveAuthCredentials(email: string, password: string) {
  try {
    authStore = { email, password };
    console.log('Credentials saved (in-memory)');
  } catch (error) {
    console.error('saveAuthCredentials error:', error);
  }
}

export async function loadAuthCredentials() {
  try {
    return authStore || null;
  } catch (error) {
    console.error('loadAuthCredentials error:', error);
    return null;
  }
}

export async function clearAuthCredentials() {
  try {
    authStore = null;
    console.log('Credentials cleared');
  } catch (error) {
    console.error('clearAuthCredentials error:', error);
  }
}

export async function autoLoginWithSavedCredentials() {
  const creds = await loadAuthCredentials();
  if (!creds?.email || !creds?.password) {
    return false;
  }
  try {
    await (account as any).createEmailPasswordSession(creds.email, creds.password);
    return true;
  } catch (error) {
    console.error('autoLoginWithSavedCredentials error:', error);
    await clearAuthCredentials();
    return false;
  }
}
