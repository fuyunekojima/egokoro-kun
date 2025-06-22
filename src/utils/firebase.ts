import { initializeApp } from 'firebase/app';
import { getDatabase, Database } from 'firebase/database';

// Firebase configuration
// これらの値は公開されても安全です（Firebaseのセキュリティルールで保護）
const firebaseConfig = {
  apiKey: "AIzaSyDO4tZcRAmSlGOmBsBGmhBIPq8aL0z3V0U",
  authDomain: "egokoro-k.firebaseapp.com",
  databaseURL: "https://egokoro-k-default-rtdb.firebaseio.com/",
  projectId: "egokoro-k",
  storageBucket: "egokoro-k.firebasestorage.app",
  messagingSenderId: "488479388323",
  appId: "1:488479388323:web:54bf23d003cb20b74a4516",
  measurementId: "G-BNLPPNX9ZW"
};

// デモ用の設定（実際のFirebaseプロジェクトが必要）
const isDemoMode = false;

let app: any;
let database: Database | null = null;

if (!isDemoMode) {
  try {
    app = initializeApp(firebaseConfig);
    database = getDatabase(app);
  } catch (error) {
    console.warn('Firebase initialization failed, using demo mode:', error);
  }
}

export { database };
export const isFirebaseEnabled = !isDemoMode && database !== null;