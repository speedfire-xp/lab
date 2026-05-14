import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDxelCzSxjw0IvpDOYgaeoYnNni4cEBiL8",
  authDomain: "manageme-8f3a6.firebaseapp.com",
  projectId: "manageme-8f3a6",
  storageBucket: "manageme-8f3a6.firebasestorage.app",
  messagingSenderId: "1069161695674",
  appId: "1:1069161695674:web:f37ab5e89325805728f583",
  measurementId: "G-Z6DVC8LH8D"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
