import { initializeApp, getApps } from 'firebase/app'
import { getFirestore, doc, setDoc, deleteDoc, serverTimestamp, Timestamp } from 'firebase/firestore'

const COLLECTION = 'lifeops_events'
const SOURCE = 'mealops'

const SLOT_TO_MEAL_TYPE = { comida: 'Comida', cena: 'Cena' }

function getDb() {
  const cfg = {
    apiKey: import.meta.env.VITE_LIFEOPS_HQ_API_KEY,
    authDomain: import.meta.env.VITE_LIFEOPS_HQ_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_LIFEOPS_HQ_PROJECT_ID,
    storageBucket: import.meta.env.VITE_LIFEOPS_HQ_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_LIFEOPS_HQ_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_LIFEOPS_HQ_APP_ID,
  }
  if (!cfg.apiKey || !cfg.projectId) return null
  const existing = getApps().find((a) => a.name === 'lifeops')
  const app = existing ?? initializeApp(cfg, 'lifeops')
  return getFirestore(app)
}

function docId(sourceEntityId) {
  return `${SOURCE}_${sourceEntityId}`
}

async function upsertOrDelete(db, sourceEntityId, data, value) {
  const ref = doc(db, COLLECTION, docId(sourceEntityId))
  if (!value) {
    await deleteDoc(ref)
  } else {
    await setDoc(ref, { ...data, updatedAt: serverTimestamp() }, { merge: true })
  }
}

export async function publishMealToLifeops(slotId, dateStr, items) {
  const mealType = SLOT_TO_MEAL_TYPE[slotId]
  if (!mealType) return
  const db = getDb()
  if (!db) return

  const date = Timestamp.fromDate(new Date(dateStr + 'T12:00:00'))

  const allLabels = items.map((i) => i.label).join(' + ')
  const yaDone = items
    .filter((i) => i.itemType === 'ya-preparado' || (i.itemType === 'manual' && !i.prepNote))
    .map((i) => i.label)
    .join(', ')
  const faltaTodo = items
    .filter((i) => i.itemType === 'acelerador' || (i.itemType === 'manual' && i.prepNote))
    .map((i) => i.prepNote ? `${i.label} (${i.prepNote})` : i.label)
    .join(', ')

  const mealEntityId = `meal-${dateStr}-${slotId}`
  await setDoc(doc(db, COLLECTION, docId(mealEntityId)), {
    source: SOURCE,
    sourceEntityId: mealEntityId,
    type: 'meal',
    status: 'pending',
    priority: 'low',
    title: allLabels,
    description: mealType,
    dateStr,
    date,
    time: null,
    updatedAt: serverTimestamp(),
  }, { merge: true })

  const baseData = { source: SOURCE, type: 'prep', status: 'done', priority: 'low', dateStr, date, time: null }

  await upsertOrDelete(
    db,
    `meal-prep-done-${dateStr}-${slotId}`,
    { ...baseData, sourceEntityId: `meal-prep-done-${dateStr}-${slotId}`, title: yaDone, description: `${slotId}-done` },
    yaDone,
  )
  await upsertOrDelete(
    db,
    `meal-prep-todo-${dateStr}-${slotId}`,
    { ...baseData, sourceEntityId: `meal-prep-todo-${dateStr}-${slotId}`, title: faltaTodo, description: `${slotId}-todo` },
    faltaTodo,
  )
}

export async function deleteMealFromLifeops(slotId, dateStr) {
  if (!SLOT_TO_MEAL_TYPE[slotId]) return
  const db = getDb()
  if (!db) return
  await Promise.all([
    deleteDoc(doc(db, COLLECTION, docId(`meal-${dateStr}-${slotId}`))),
    deleteDoc(doc(db, COLLECTION, docId(`meal-prep-done-${dateStr}-${slotId}`))),
    deleteDoc(doc(db, COLLECTION, docId(`meal-prep-todo-${dateStr}-${slotId}`))),
  ])
}
