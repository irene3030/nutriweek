import { useState, useEffect } from 'react';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export function useSlotTemplates(householdId) {
  const [templates, setTemplates] = useState({});

  useEffect(() => {
    if (!householdId) return;
    const ref = doc(db, 'households', householdId);
    return onSnapshot(ref, (snap) => {
      setTemplates(snap.data()?.slotTemplates ?? {});
    });
  }, [householdId]);

  async function saveTemplate(slotId, items) {
    if (!householdId) return;
    const minimal = items.map(({ label, itemType, tags }) => ({
      label,
      itemType: itemType || 'manual',
      tags: tags || [],
    }));
    await updateDoc(doc(db, 'households', householdId), {
      [`slotTemplates.${slotId}`]: minimal,
    });
  }

  return { templates, saveTemplate };
}
