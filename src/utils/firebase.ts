import { initializeApp } from 'firebase/app';
import { getDatabase, Database } from 'firebase/database';
import { getAuth, Auth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

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
let auth: Auth | null = null;

if (!isDemoMode) {
  try {
    app = initializeApp(firebaseConfig);
    database = getDatabase(app);
    auth = getAuth(app);
  } catch (error) {
    console.warn('Firebase initialization failed, using demo mode:', error);
  }
}

// 匿名認証を実行する関数
export const authenticateAnonymously = async (): Promise<boolean> => {
  if (!auth) {
    console.warn('Firebase Auth not initialized');
    return false;
  }

  try {
    await signInAnonymously(auth);
    console.log('Anonymous authentication successful');
    return true;
  } catch (error) {
    console.error('Anonymous authentication failed:', error);
    return false;
  }
};

// 認証状態の監視
export const onAuthStateChange = (callback: (isAuthenticated: boolean) => void) => {
  if (!auth) {
    callback(false);
    return () => {};
  }

  return onAuthStateChanged(auth, (user) => {
    callback(!!user);
  });
};

export { database, auth };
export const isFirebaseEnabled = !isDemoMode && database !== null && auth !== null;