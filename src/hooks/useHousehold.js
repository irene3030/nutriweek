import { useState, useCallback } from 'react';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  arrayUnion,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

function generateHouseholdId() {
  return 'hh_' + Math.random().toString(36).slice(2, 10);
}

function generateInviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function useHousehold(user, userDoc, refreshUserDoc) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const createHousehold = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const householdId = generateHouseholdId();
      const inviteCode = generateInviteCode();

      // Create household document
      const householdRef = doc(db, 'households', householdId);
      await setDoc(householdRef, {
        householdId,
        inviteCode,
        members: [user.uid],
        createdAt: new Date().toISOString(),
        createdBy: user.uid,
      });

      // Update user document
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { householdId });

      await refreshUserDoc();
      return { householdId, inviteCode };
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user, refreshUserDoc]);

  const joinHousehold = useCallback(async (inviteCode) => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      // Find household by inviteCode
      const householdsRef = collection(db, 'households');
      const q = query(householdsRef, where('inviteCode', '==', inviteCode.toUpperCase()));
      const snap = await getDocs(q);

      if (snap.empty) {
        throw new Error('Código de invitación no encontrado');
      }

      const householdDoc = snap.docs[0];
      const householdId = householdDoc.id;

      // Add user to household members
      await updateDoc(doc(db, 'households', householdId), {
        members: arrayUnion(user.uid),
      });

      // Update user document
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { householdId });

      await refreshUserDoc();
      return { householdId };
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user, refreshUserDoc]);

  const getHouseholdData = useCallback(async () => {
    if (!userDoc?.householdId) return null;
    try {
      const snap = await getDoc(doc(db, 'households', userDoc.householdId));
      return snap.exists() ? snap.data() : null;
    } catch (err) {
      console.error('Error getting household data:', err);
      return null;
    }
  }, [userDoc]);

  return { createHousehold, joinHousehold, getHouseholdData, loading, error };
}
