import { db } from './firebase';
import { doc, setDoc, runTransaction } from 'firebase/firestore';

function generateToken() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 16; i++) token += chars[Math.floor(Math.random() * chars.length)];
  return token;
}

export function buildInviteUrl(token) {
  return `${window.location.origin}?invite=${token}`;
}

export async function createInvite(householdId) {
  const token = generateToken();
  await setDoc(doc(db, 'invites', token), {
    createdBy: householdId,
    createdAt: new Date().toISOString(),
    usedAt: null,
    usedByHousehold: null,
  });
  return token;
}

export async function redeemInvite(token, householdId) {
  const inviteRef = doc(db, 'invites', token);
  await runTransaction(db, async (tx) => {
    const inviteSnap = await tx.get(inviteRef);
    if (!inviteSnap.exists()) throw new Error('INVITE_NOT_FOUND');
    const data = inviteSnap.data();
    if (data.usedAt) throw new Error('INVITE_ALREADY_USED');
    if (data.createdBy === householdId) throw new Error('INVITE_OWN');
    tx.update(inviteRef, { usedAt: new Date().toISOString(), usedByHousehold: householdId });
    tx.update(doc(db, 'households', householdId), { ffActivated: true, freeCallsUsed: 0 });
  });
}
