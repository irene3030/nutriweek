import { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export function usePrepQueue(householdId) {
  const [prepQueue, setPrepQueue] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!householdId) { setLoading(false); return; }
    const ref = collection(db, 'households', householdId, 'prepQueue');
    const q = query(ref, orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setPrepQueue(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [householdId]);

  async function addToPrepQueue(data) {
    if (!householdId) return null;
    const ref = collection(db, 'households', householdId, 'prepQueue');
    const docRef = await addDoc(ref, { ...data, createdAt: serverTimestamp() });
    return docRef.id;
  }

  async function removeFromPrepQueue(id) {
    if (!householdId) return;
    await deleteDoc(doc(db, 'households', householdId, 'prepQueue', id));
  }

  return { prepQueue, loading, addToPrepQueue, removeFromPrepQueue };
}
