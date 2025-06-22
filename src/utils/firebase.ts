import { initializeApp } from 'firebase/app';
import { getDatabase, Database } from 'firebase/database';

// Firebase configuration
// これらの値は公開されても安全です（Firebaseのセキュリティルールで保護）
const firebaseConfig = {
  apiKey: "AIzaSyDemo-Replace-With-Your-Config",
  authDomain: "egokoro-kun-demo.firebaseapp.com",
  databaseURL: "https://egokoro-kun-demo-default-rtdb.firebaseio.com",
  projectId: "egokoro-kun-demo",
  storageBucket: "egokoro-kun-demo.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:demo"
};

// デモ用の設定（実際のFirebaseプロジェクトが必要）
const isDemoMode = true;

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