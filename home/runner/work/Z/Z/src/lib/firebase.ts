import { initializeFirebase } from '@/firebase';
import { getStorage } from 'firebase/storage';

// Get the singleton instances from the robust initializer
const { firebaseApp, auth: firebaseAuth, firestore: firestoreDb } = initializeFirebase();
const storage = getStorage(firebaseApp);

// Export them with the names the app currently expects
export const app = firebaseApp;
export const auth = firebaseAuth;
export const db = firestoreDb;
export { storage };
