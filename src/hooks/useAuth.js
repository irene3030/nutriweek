import { useState, useEffect, createContext, useContext } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../lib/firebase';

export const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

export function useAuthProvider() {
  const [user, setUser] = useState(null);
  const [userDoc, setUserDoc] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        // Load user doc from Firestore
        try {
          const userRef = doc(db, 'users', firebaseUser.uid);
          const snap = await getDoc(userRef);
          if (snap.exists()) {
            setUserDoc(snap.data());
          } else {
            // Create user doc if first login
            const newUserDoc = {
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName,
              email: firebaseUser.email,
              householdId: null,
              createdAt: new Date().toISOString(),
            };
            await setDoc(userRef, newUserDoc);
            setUserDoc(newUserDoc);
          }
        } catch (err) {
          console.error('Error loading user doc:', err);
        }
      } else {
        setUser(null);
        setUserDoc(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error('Google sign in error:', err);
      throw err;
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setUserDoc(null);
  };

  const refreshUserDoc = async () => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        setUserDoc(snap.data());
      }
    } catch (err) {
      console.error('Error refreshing user doc:', err);
    }
  };

  const updateUserDoc = (data) => {
    setUserDoc((prev) => ({ ...prev, ...data }));
  };

  return {
    user,
    userDoc,
    loading,
    signInWithGoogle,
    signOut,
    refreshUserDoc,
    updateUserDoc,
  };
}
