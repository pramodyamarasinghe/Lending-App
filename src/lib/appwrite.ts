import { Client, Account, ID, Databases, Query } from 'appwrite';
import { 
  APPWRITE_ENDPOINT, 
  APPWRITE_PROJECT, 
  APPWRITE_DATABASE_ID, 
  APPWRITE_CUSTOMERS_COLLECTION_ID,
  APPWRITE_LOANS_COLLECTION_ID,
  APPWRITE_SETTING_COLLECTION_ID,
  APPWRITE_COLLECTERS_COLLECTION_ID,
  APPWRITE_BRANCHES_COLLECTION_ID,
  APPWRITE_COLLECTIONS_COLLECTION_ID
} from '@/constants/appwrite';

const AUTH_KEY = 'APPWRITE_AUTH_CREDENTIALS';

const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT);

export const account = new Account(client);
export const databases = new Databases(client);

export const generateId = () => ID.unique();

export async function getCustomers() {
  try {
    const response = await databases.listDocuments(
      APPWRITE_DATABASE_ID,
      APPWRITE_CUSTOMERS_COLLECTION_ID,
      [Query.limit(1000)]
    );
    return response.documents;
  } catch (error) {
    console.error('getCustomers error:', error);
    throw error;
  }
}

export async function addCustomer(customerData: {
  customerId: string;
  name: string;
  nic: string;
  phone: string;
  address: string;
  risk: string;
  status: string;
}) {
  try {
    const response = await databases.createDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_CUSTOMERS_COLLECTION_ID,
      ID.unique(),
      customerData
    );
    return response;
  } catch (error) {
    console.error('addCustomer error:', error);
    throw error;
  }
}

export async function getLoans() {
  try {
    const response = await databases.listDocuments(
      APPWRITE_DATABASE_ID,
      APPWRITE_LOANS_COLLECTION_ID,
      [Query.limit(1000)]
    );
    return response.documents;
  } catch (error) {
    console.log('getLoans error (using mock fallback):', error);
    throw error;
  }
}

export async function addLoan(loanData: {
  loanId: string;
  customerId: string;
  customerName: string;
  branch: string;
  loanType: string;
  collector: string;
  amount: number;
  interestRate: number;
  duration: number;
  disbursementDate: string;
  loanPurpose: string;
  outstanding: number;
  paidAmount: number;
  status: string;
  risk: string;
}) {
  try {
    const { loanId, ...dataWithoutLoanId } = loanData;
    const response = await databases.createDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_LOANS_COLLECTION_ID,
      loanId,
      dataWithoutLoanId
    );
    return response;
  } catch (error) {
    console.log('addLoan error:', error);
    throw error;
  }
}

export async function updateLoan(documentId: string, updatedFields: Partial<{
  outstanding: number;
  paidAmount: number;
  status: string;
}>) {
  try {
    const response = await databases.updateDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_LOANS_COLLECTION_ID,
      documentId,
      updatedFields
    );
    return response;
  } catch (error) {
    console.log('updateLoan error:', error);
    throw error;
  }
}

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

// Settings Database APIs
export async function getSettings() {
  try {
    const response = await databases.listDocuments(
      APPWRITE_DATABASE_ID,
      APPWRITE_SETTING_COLLECTION_ID
    );
    if (response.documents.length > 0) {
      return response.documents[0];
    }
    
    // Create default settings if empty
    const defaults = {
      Branches: JSON.stringify(["Colombo Central", "Negombo Branch", "Galle Branch", "Kandy Branch"]),
      Collectors: JSON.stringify(["Mahesh Kularatne", "Suresh Perera", "Anura Silva", "Nimal Jayasinghe"])
    };
    
    const newDoc = await databases.createDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_SETTING_COLLECTION_ID,
      'global_settings',
      defaults
    );
    return newDoc;
  } catch (error) {
    console.log('getSettings error:', error);
    throw error;
  }
}

export async function updateSettings(branches: string[], collectors: string[]) {
  try {
    const data = {
      Branches: JSON.stringify(branches),
      Collectors: JSON.stringify(collectors)
    };
    
    try {
      const response = await databases.updateDocument(
        APPWRITE_DATABASE_ID,
        APPWRITE_SETTING_COLLECTION_ID,
        'global_settings',
        data
      );
      return response;
    } catch (err: any) {
      if (err.code === 404) {
        const response = await databases.createDocument(
          APPWRITE_DATABASE_ID,
          APPWRITE_SETTING_COLLECTION_ID,
          'global_settings',
          data
        );
        return response;
      }
      throw err;
    }
  } catch (error) {
    console.log('updateSettings error:', error);
    throw error;
  }
}

export async function getCollectors() {
  try {
    const response = await databases.listDocuments(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTERS_COLLECTION_ID
    );
    return response.documents;
  } catch (error) {
    console.log('getCollectors error:', error);
    throw error;
  }
}

export async function addCollector(name: string, phone: string | number, NIC?: string) {
  try {
    const data: any = {
      name,
      phone
    };
    if (NIC) {
      data.NIC = NIC;
    }
    const response = await databases.createDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTERS_COLLECTION_ID,
      ID.unique(),
      data
    );
    return response;
  } catch (error) {
    console.log('addCollector error:', error);
    throw error;
  }
}

export async function deleteCollectorById(documentId: string) {
  try {
    const response = await databases.deleteDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTERS_COLLECTION_ID,
      documentId
    );
    return response;
  } catch (error) {
    console.log('deleteCollectorById error:', error);
    throw error;
  }
}

// Branches Database APIs
export async function getBranches() {
  try {
    const response = await databases.listDocuments(
      APPWRITE_DATABASE_ID,
      APPWRITE_BRANCHES_COLLECTION_ID
    );
    return response.documents;
  } catch (error) {
    console.log('getBranches error:', error);
    throw error;
  }
}

export async function addBranch(name: string) {
  try {
    const response = await databases.createDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_BRANCHES_COLLECTION_ID,
      ID.unique(),
      { name }
    );
    return response;
  } catch (error) {
    console.log('addBranch error:', error);
    throw error;
  }
}

export async function deleteBranchById(documentId: string) {
  try {
    const response = await databases.deleteDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_BRANCHES_COLLECTION_ID,
      documentId
    );
    return response;
  } catch (error) {
    console.log('deleteBranchById error:', error);
    throw error;
  }
}

// Collections Database APIs
export interface CollectionRecord {
  receiptId: string;
  time: string;
  customerName: string;
  loanId: string;
  collectorName: string;
  amount: number | null;
  status: "Collected" | "Promise to Pay";
  date: string;
}

export async function getCollectionRecords() {
  try {
    const response = await databases.listDocuments(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTIONS_COLLECTION_ID,
      [
        Query.orderDesc('$createdAt'),
        Query.limit(1000)
      ]
    );
    
    const dummyNames = [
      "Priyantha Bandara", 
      "Samantha Fernando", 
      "Sunil Shantha", 
      "Nirmala Kumari", 
      "Chandra Silva", 
      "Kamal Hashim", 
      "Aruni Ranasinghe", 
      "Fathima Riza"
    ];
    
    const docs = response.documents;
    const cleanDocs = [];
    
    for (const doc of docs) {
      if (dummyNames.includes(doc.customerName)) {
        console.log(`Auto-deleting dummy record: ${doc.$id} (${doc.customerName})`);
        try {
          await databases.deleteDocument(
            APPWRITE_DATABASE_ID,
            APPWRITE_COLLECTIONS_COLLECTION_ID,
            doc.$id
          );
        } catch (delErr) {
          console.error(`Failed to auto-delete document ${doc.$id}:`, delErr);
        }
      } else {
        cleanDocs.push(doc);
      }
    }
    
    return cleanDocs;
  } catch (error) {
    console.error('getCollectionRecords error:', error);
    throw error;
  }
}

export async function addCollectionRecord(record: {
  receiptId: string;
  time: string;
  customerName: string;
  loanId: string;
  collectorName: string;
  amount: number | null;
  status: "Collected" | "Promise to Pay";
  date: string;
}) {
  try {
    const response = await databases.createDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTIONS_COLLECTION_ID,
      ID.unique(),
      record
    );
    return response;
  } catch (error) {
    console.error('addCollectionRecord error:', error);
    throw error;
  }
}
