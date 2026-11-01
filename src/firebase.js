
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDovn7lPXSS5S_KDK-Y9PNEdHBCnvIrtk8",
  authDomain: "concept-vivacqua-zelador.firebaseapp.com",
  databaseURL: "https://concept-vivacqua-zelador-default-rtdb.firebaseio.com",
  projectId: "concept-vivacqua-zelador",
  storageBucket: "concept-vivacqua-zelador.firebasestorage.app",
  messagingSenderId: "1045488626249",
  appId: "1:1045488626249:web:3344d748979ea51d1e2d98",
  measurementId: "G-J6T5W6HFYF"
};

const app = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
