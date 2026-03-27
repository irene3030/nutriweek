import { useState, useEffect, useCallback } from 'react';
import { AuthContext, useAuth, useAuthProvider } from './hooks/useAuth';
import { setPreCallHook, validateFFCode } from './lib/claude';
import { identify, resetIdentity, track } from './lib/analytics';
import { useWeek } from './hooks/useWeek';
import LoginScreen from './components/auth/LoginScreen';
import OnboardingScreen from './components/auth/OnboardingScreen';
import WeekView from './components/week/WeekView';
import DayView from './components/day/DayView';
import UsualMeals from './components/recipes/UsualMeals';
import { FullPageSpinner } from './components/ui/LoadingSpinner';
import InstallBanner from './components/ui/InstallBanner';
import SpotlightTour from './components/ui/SpotlightTour';
import DayPlayground from './components/playground/DayPlayground';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  getDoc,
  updateDoc,
  runTransaction,
} from 'firebase/firestore';
import { db } from './lib/firebase';

// Tab nav icons (inline SVG)
const TabIcons = {
  week: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  shopping: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  recipes: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  profile: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  day: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
    </svg>
  ),
};

function AppContent() {
  const auth = useAuth();
  const [activeTab, setActiveTab] = useState('week');
  const [selectedDayIndex, setSelectedDayIndex] = useState(null);
  const [savedRecipes, setSavedRecipes] = useState([]);
  const [usualMeals, setUsualMeals] = useState([]);
  const [foodHistory, setFoodHistory] = useState([]);
  const [householdApiKey, setHouseholdApiKey] = useState(null);
  const [householdDoc, setHouseholdDoc] = useState(null);
  const [recipesTab, setRecipesTab] = useState('usual');
  const [showTour, setShowTour] = useState(false);

  const {
    weeks,
    currentWeek,
    currentWeekIndex,
    loading: weeksLoading,
    saving,
    goToPreviousWeek,
    goToNextWeek,
    createWeek,
    deleteWeek,
    updateMeal,
    updateDayMeals,
    updateWeekLabel,
    updateBatchCooking,
    trackMeal,
    copyMeal,
    applyMealFixes,
  } = useWeek(auth.userDoc?.householdId);

  // Identify user in analytics on login/logout
  useEffect(() => {
    if (auth.user) {
      identify(auth.user.uid, { email: auth.user.email, name: auth.user.displayName });
    } else if (!auth.loading) {
      resetIdentity();
    }
  }, [auth.user?.uid, auth.loading]);

  // Update analytics user properties when household loads
  useEffect(() => {
    if (!auth.user || !householdDoc) return;
    identify(auth.user.uid, {
      has_api_key: !!householdDoc.anthropicApiKey,
      has_ff: !!householdDoc.ffActivated,
      household_id: auth.userDoc?.householdId,
    });
  }, [auth.user?.uid, !!householdDoc?.anthropicApiKey, !!householdDoc?.ffActivated]);

  // Show spotlight tour for users who haven't completed it
  useEffect(() => {
    if (auth.userDoc?.householdId && auth.userDoc?.tourCompleted !== true) {
      setShowTour(true);
    }
  }, [auth.userDoc?.householdId, auth.userDoc?.tourCompleted]);

  const handleUpdateKpiConfig = useCallback(async (newConfig) => {
    const householdId = auth.userDoc?.householdId;
    if (!householdId) return;
    await updateDoc(doc(db, 'households', householdId), { kpiConfig: newConfig });
  }, [auth.userDoc?.householdId]);

  const handleTourComplete = useCallback(async () => {
    setShowTour(false);
    if (auth.user) {
      await updateDoc(doc(db, 'users', auth.user.uid), { tourCompleted: true });
    }
  }, [auth.user]);
  // Listen to household doc in real-time (apiKey + usage data)
  useEffect(() => {
    if (!auth.userDoc?.householdId) return;
    const unsub = onSnapshot(doc(db, 'households', auth.userDoc.householdId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setHouseholdApiKey(data.anthropicApiKey || null);
        setHouseholdDoc(data);
      }
    });
    return unsub;
  }, [auth.userDoc?.householdId]);

  // Register pre-call hook: check monthly limit and increment counter
  useEffect(() => {
    const householdId = auth.userDoc?.householdId;
    if (!householdId || !householdDoc) return;

    setPreCallHook(async ({ apiKey }) => {
      const householdRef = doc(db, 'households', householdId);

      if (apiKey) {
        // Personal API key — track monthly usage
        const currentMonth = new Date().toISOString().slice(0, 7);
        const storedMonth = householdDoc.aiCallMonth;
        const calls = storedMonth === currentMonth ? (householdDoc.aiCallsThisMonth || 0) : 0;
        const limit = householdDoc.aiCallLimit || null;
        if (limit && calls >= limit) throw new Error('CALL_LIMIT_EXCEEDED');
        await updateDoc(householdRef, { aiCallsThisMonth: calls + 1, aiCallMonth: currentMonth });
        return;
      }

      // No personal key — check Friends & Family free quota
      if (householdDoc.ffActivated) {
        const used = householdDoc.freeCallsUsed || 0;
        if (used >= 30) throw new Error('FREE_QUOTA_EXCEEDED');
        await updateDoc(householdRef, { freeCallsUsed: used + 1 });
        return;
      }

      throw new Error('NO_API_KEY');
    });
  }, [auth.userDoc?.householdId, householdDoc]);

  // Load saved recipes
  useEffect(() => {
    if (!auth.userDoc?.householdId) return;
    const recipesRef = collection(db, 'households', auth.userDoc.householdId, 'recipes');
    const q = query(recipesRef, orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setSavedRecipes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [auth.userDoc?.householdId]);

  // Load usual meals
  useEffect(() => {
    if (!auth.userDoc?.householdId) return;
    const ref = collection(db, 'households', auth.userDoc.householdId, 'usualMeals');
    const q = query(ref, orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setUsualMeals(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [auth.userDoc?.householdId]);

  // Build simple food history from weeks
  useEffect(() => {
    if (weeks.length < 2) return;
    const history = [];
    const foodWeekMap = {};

    weeks.forEach((week, weekIdx) => {
      if (!week.days) return;
      week.days.forEach((day) => {
        if (!day.meals) return;
        day.meals.forEach((meal) => {
          const text = ((meal.baby || '') + ' ' + (meal.adult || '')).toLowerCase();
          const words = text.split(/[\s,+]+/).filter((w) => w.length > 3);
          words.forEach((word) => {
            if (!foodWeekMap[word]) foodWeekMap[word] = weekIdx;
            else foodWeekMap[word] = Math.min(foodWeekMap[word], weekIdx);
          });
        });
      });
    });

    for (const [food, lastWeekIdx] of Object.entries(foodWeekMap)) {
      if (lastWeekIdx > 2) {
        history.push({ food, weeksAgo: lastWeekIdx, lastSeen: weeks[lastWeekIdx]?.label });
      }
    }

    setFoodHistory(history.slice(0, 20));
  }, [weeks]);

  const handleDayClick = (dayIndex) => {
    setSelectedDayIndex(dayIndex);
  };

  const handleBackFromDay = (newDayIndex) => {
    if (typeof newDayIndex === 'number') {
      setSelectedDayIndex(newDayIndex);
    } else {
      setSelectedDayIndex(null);
    }
  };

  const handleNewWeek = async (mondayDate, label, daysData) => {
    await createWeek(mondayDate, label, daysData);
    track('week_created', { generated_with_ai: !!daysData });
  };

  const handleDeleteWeek = async (weekId) => {
    await deleteWeek(weekId);
    track('week_deleted');
  };

  const handleApplyFixes = async (fixes) => {
    await applyMealFixes(currentWeek.id, fixes);
    track('ai_kpi_fix_applied', { fix_count: fixes.length });
  };

  const handleAddMealToSlot = (dayName, tipo, mealData) => {
    if (!currentWeek) return;
    const dayIdx = currentWeek.days.findIndex(d => d.day === dayName);
    if (dayIdx === -1) return;
    const day = currentWeek.days[dayIdx];
    const mealIdx = day.meals?.findIndex(m => m.tipo === tipo);
    if (mealIdx === undefined || mealIdx === -1) return;
    updateMeal(currentWeek.id, dayIdx, mealIdx, mealData);
  };

  // Render loading state
  if (auth.loading) return <FullPageSpinner label="Iniciando MealOps..." />;

  // Render login if not authenticated
  if (!auth.user) return <LoginScreen />;

  // Render onboarding if no household
  if (!auth.userDoc?.householdId) return <OnboardingScreen />;

  const drawerOpen = selectedDayIndex !== null && currentWeek;

  return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Main content */}
        <div className="flex-1 pb-16" style={{ paddingBottom: 'calc(4rem + env(safe-area-inset-bottom))' }}>
          {activeTab === 'week' && (
            <WeekView
              weeks={weeks}
              currentWeek={currentWeek}
              currentWeekIndex={currentWeekIndex}
              loading={weeksLoading}
              saving={saving}
              onGoToPrevious={goToPreviousWeek}
              onGoToNext={goToNextWeek}
              onNewWeek={handleNewWeek}
              onDeleteWeek={handleDeleteWeek}
              onUpdateLabel={updateWeekLabel}
              onDayClick={handleDayClick}
              onAddMealToSlot={handleAddMealToSlot}
              onUpdateBatchCooking={updateBatchCooking}
              onApplyFixes={handleApplyFixes}
              foodHistory={foodHistory}
              savedRecipes={savedRecipes}
              usualMeals={usualMeals}
              apiKey={householdApiKey}
              hasAiAccess={
                !!householdApiKey ||
                (!!householdDoc?.ffActivated && (householdDoc?.freeCallsUsed || 0) < 30)
              }
              householdId={auth.userDoc?.householdId}
              kpiConfig={householdDoc?.kpiConfig}
              onUpdateKpiConfig={handleUpdateKpiConfig}
            />
          )}

          {activeTab === 'recipes' && (
            <div className="min-h-screen bg-gray-50">
              <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
                <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-2">
                  <span className="text-xl">⭐</span>
                  <h1 className="text-lg font-bold text-gray-900">Comidas habituales</h1>
                </div>
              </header>
              <div className="max-w-2xl mx-auto px-4 py-4">
                <UsualMeals
                  householdId={auth.userDoc?.householdId}
                  apiKey={householdApiKey}
                  hasAiAccess={
                    !!householdApiKey ||
                    (!!householdDoc?.ffActivated && (householdDoc?.freeCallsUsed || 0) < 30)
                  }
                />
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <ProfileTab auth={auth} householdDoc={householdDoc} />
          )}

          {activeTab === 'day' && (
            <DayPlayground
              apiKey={householdApiKey}
              hasAiAccess={
                !!householdApiKey ||
                (!!householdDoc?.ffActivated && (householdDoc?.freeCallsUsed || 0) < 30)
              }
            />
          )}
        </div>

        {/* Day drawer */}
        {drawerOpen && (
          <>
            <div
              className="fixed inset-0 z-30 bg-black/20"
              onClick={() => setSelectedDayIndex(null)}
            />
            <div className="drawer-slide-in fixed right-0 top-0 bottom-0 z-40 w-full sm:w-[440px] bg-white shadow-2xl flex flex-col">
              <DayView
                weekDoc={currentWeek}
                dayIndex={selectedDayIndex}
                householdId={auth.userDoc.householdId}
                apiKey={householdApiKey}
                hasAiAccess={
                  !!householdApiKey ||
                  (!!householdDoc?.ffActivated && (householdDoc?.freeCallsUsed || 0) < 30)
                }
                onBack={handleBackFromDay}
                onSaveMeal={(weekId, dIdx, mIdx, data) => updateMeal(weekId, dIdx, mIdx, data)}
                onTrackMeal={(weekId, dIdx, mIdx, trackData) => trackMeal(weekId, dIdx, mIdx, trackData)}
                onCopyMeal={(weekId, srcDayIdx, srcMealIdx, tgtDayIdx, tgtMealIdx) =>
                  copyMeal(weekId, srcDayIdx, srcMealIdx, tgtDayIdx, tgtMealIdx)
                }
                onReorderMeals={(weekId, dIdx, newMeals) => updateDayMeals(weekId, dIdx, newMeals)}
              />
            </div>
          </>
        )}

        <InstallBanner />

        {showTour && <SpotlightTour onComplete={handleTourComplete} />}

        {/* Bottom tab bar */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-20 pb-[env(safe-area-inset-bottom)]">
          <div className="max-w-lg mx-auto flex">
            {[
              { id: 'week', label: 'Semana', tour: 'tab-week' },
              { id: 'day', label: 'Día' },
              { id: 'recipes', label: 'Comidas', tour: 'tab-recipes' },
              { id: 'profile', label: 'Perfil', tour: 'tab-profile' },
            ].map((tab) => (
              <button
                key={tab.id}
                data-tour={tab.tour}
                onClick={() => { setActiveTab(tab.id); track('tab_viewed', { tab: tab.id }); }}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2 px-2 transition-colors ${
                  activeTab === tab.id
                    ? 'text-brand-600'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {TabIcons[tab.id]}
                <span className="text-xs font-medium">{tab.label}</span>
              </button>
            ))}
          </div>
        </nav>
      </div>
  );
}

function ProfileTab({ auth, householdDoc }) {
  const [members, setMembers] = useState([]);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [apiKeySaving, setApiKeySaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [limitInput, setLimitInput] = useState('');
  const [limitSaved, setLimitSaved] = useState(false);
  const [ffCodeInput, setFfCodeInput] = useState('');
  const [ffLoading, setFfLoading] = useState(false);
  const [ffError, setFfError] = useState('');

  // Sync inputs when householdDoc arrives (real-time)
  useEffect(() => {
    if (!householdDoc) return;
    setApiKeyInput(householdDoc.anthropicApiKey || '');
    setLimitInput(householdDoc.aiCallLimit ? String(householdDoc.aiCallLimit) : '');
  }, [householdDoc?.anthropicApiKey, householdDoc?.aiCallLimit]);

  // Load members
  useEffect(() => {
    if (!householdDoc?.members?.length) return;
    Promise.all(householdDoc.members.map(uid => getDoc(doc(db, 'users', uid))))
      .then(docs => setMembers(docs.filter(d => d.exists()).map(d => ({ uid: d.id, ...d.data() }))));
  }, [JSON.stringify(householdDoc?.members)]);

  const householdId = auth.userDoc?.householdId;

  const handleSaveApiKey = async () => {
    if (!householdId) return;
    setApiKeySaving(true);
    try {
      await updateDoc(doc(db, 'households', householdId), { anthropicApiKey: apiKeyInput.trim() });
      track('api_key_saved');
      setApiKeySaved(true);
      setTimeout(() => setApiKeySaved(false), 2500);
    } catch (err) {
      alert('Error guardando la key: ' + err.message);
    } finally {
      setApiKeySaving(false);
    }
  };

  const handleSaveLimit = async () => {
    if (!householdId) return;
    const val = limitInput.trim() === '' ? null : parseInt(limitInput, 10);
    await updateDoc(doc(db, 'households', householdId), { aiCallLimit: val });
    setLimitSaved(true);
    setTimeout(() => setLimitSaved(false), 2000);
  };

  const handleActivateFF = async () => {
    if (!householdId || !ffCodeInput.trim()) return;
    setFfLoading(true);
    setFfError('');
    try {
      const result = await validateFFCode(ffCodeInput.trim());
      if (!result.valid) {
        setFfError('Código no válido. Comprueba que lo has escrito bien.');
        return;
      }
      // Atomically increment the global activation counter (max 10 households)
      const metaRef = doc(db, 'meta', 'ffActivation');
      await runTransaction(db, async (tx) => {
        const metaSnap = await tx.get(metaRef);
        const count = metaSnap.exists() ? (metaSnap.data().count || 0) : 0;
        if (count >= 10) throw new Error('Ya no quedan plazas disponibles con este código.');
        tx.set(metaRef, { count: count + 1 }, { merge: true });
        tx.update(doc(db, 'households', householdId), { ffActivated: true, freeCallsUsed: 0 });
      });
      track('ff_code_activated');
      setFfCodeInput('');
    } catch (err) {
      setFfError(err.message || 'Error activando el código.');
    } finally {
      setFfLoading(false);
    }
  };

  // Usage this month
  const currentMonth = new Date().toISOString().slice(0, 7);
  const callsThisMonth = householdDoc?.aiCallMonth === currentMonth
    ? (householdDoc?.aiCallsThisMonth || 0) : 0;
  const callLimit = householdDoc?.aiCallLimit || null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-2">
          <span className="text-xl">👤</span>
          <h1 className="text-lg font-bold text-gray-900">Perfil</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* User info */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4">
          {auth.user?.photoURL ? (
            <img src={auth.user.photoURL} alt={auth.user.displayName} className="w-14 h-14 rounded-full" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-brand-100 flex items-center justify-center text-2xl">
              {auth.user?.displayName?.[0] || '?'}
            </div>
          )}
          <div>
            <p className="font-semibold text-gray-900">{auth.user?.displayName}</p>
            <p className="text-sm text-gray-500">{auth.user?.email}</p>
          </div>
        </div>

        {/* Household info */}
        {householdDoc && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-800 mb-3">Tu familia</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Código de invitación</span>
                <span className="font-bold tracking-widest text-brand-700 bg-brand-50 px-3 py-1 rounded-lg">
                  {householdDoc.inviteCode}
                </span>
              </div>
              <div>
                <span className="text-sm text-gray-500 block mb-2">Miembros ({members.length})</span>
                <div className="space-y-2">
                  {members.map(m => (
                    <div key={m.uid} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-sm font-semibold text-brand-700 shrink-0">
                        {m.displayName?.[0] || '?'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{m.displayName || 'Sin nombre'}</p>
                        <p className="text-xs text-gray-400 truncate">{m.email}</p>
                      </div>
                      {m.uid === auth.user?.uid && (
                        <span className="text-xs text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full shrink-0">Tú</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Anthropic API Key */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
          <div>
            <h3 className="font-semibold text-gray-800 mb-1">API key de IA (Anthropic)</h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Necesaria para generar menús, regenerar comidas y el batch cooking.
              Compartida entre todos los miembros de tu familia.
            </p>
          </div>

          {/* Cost estimate */}
          <div className="bg-brand-50 border border-brand-100 rounded-xl p-3 space-y-1">
            <p className="text-xs font-semibold text-brand-700">💡 ¿Cuánto cuesta?</p>
            <p className="text-xs text-brand-800 leading-relaxed">
              La app usa Claude Haiku, el modelo más económico de Anthropic.
              Generar una semana completa cuesta aproximadamente <strong>$0,01</strong>.
              Un mes de uso típico (4 semanas + retoques) sale por <strong>menos de $0,10</strong> — menos de 10 céntimos.
            </p>
            <p className="text-xs text-brand-700 mt-1">
              Necesitas al menos <strong>$5 de crédito</strong> para activar el uso.
              Recarga en{' '}
              <a
                href="https://console.anthropic.com/settings/billing"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-medium"
              >
                console.anthropic.com → Billing
              </a>
              .
            </p>
          </div>

          {/* Key input */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="sk-ant-..."
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent pr-10"
                />
                <button
                  onClick={() => setShowApiKey((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showApiKey ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              <button
                onClick={handleSaveApiKey}
                disabled={apiKeySaving || !apiKeyInput.trim()}
                className="bg-brand-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors disabled:opacity-50 shrink-0"
              >
                {apiKeySaved ? '✓ Guardada' : apiKeySaving ? '...' : 'Guardar'}
              </button>
            </div>
            {apiKeyInput && !apiKeyInput.startsWith('sk-ant-') && (
              <p className="text-xs text-amber-600">La key debería empezar por sk-ant-</p>
            )}
          </div>

          {/* Usage + limit */}
          <div className="border-t border-gray-100 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Llamadas este mes</span>
              <span className={`text-sm font-semibold ${callLimit && callsThisMonth >= callLimit ? 'text-red-600' : 'text-gray-800'}`}>
                {callsThisMonth}{callLimit ? ` / ${callLimit}` : ''}
                {callLimit && callsThisMonth >= callLimit && ' — límite alcanzado'}
              </span>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">
                Límite mensual de llamadas <span className="text-gray-400">(deja vacío para sin límite)</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  value={limitInput}
                  onChange={e => setLimitInput(e.target.value)}
                  placeholder="Ej: 30"
                  className="w-28 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
                <button
                  onClick={handleSaveLimit}
                  className="bg-gray-800 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-900 transition-colors"
                >
                  {limitSaved ? '✓' : 'Guardar'}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Con el límite en 30 llamadas, el coste máximo mensual sería ~$0,30.
              </p>
            </div>
          </div>
        </div>

        {/* Friends & Family free quota */}
        {householdDoc && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
            <div>
              <h3 className="font-semibold text-gray-800 mb-1">🎁 Código Friends & Family</h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                Si tienes un código de invitación, actívalo para obtener 30 llamadas gratuitas sin necesidad de API key propia.
              </p>
            </div>

            {householdDoc.ffActivated ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-brand-50 rounded-xl px-4 py-3">
                  <span className="text-sm text-brand-800 font-medium">✓ Código activado</span>
                  <span className={`text-sm font-semibold ${(householdDoc.freeCallsUsed || 0) >= 30 ? 'text-red-600' : 'text-brand-700'}`}>
                    {householdDoc.freeCallsUsed || 0} / 30 llamadas usadas
                  </span>
                </div>
                {(householdDoc.freeCallsUsed || 0) >= 30 && (
                  <p className="text-xs text-amber-600">Has agotado las llamadas gratuitas. Añade tu API key para continuar.</p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={ffCodeInput}
                    onChange={e => setFfCodeInput(e.target.value.toUpperCase())}
                    placeholder="Código de invitación"
                    maxLength={30}
                    className="flex-1 border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent uppercase tracking-widest"
                  />
                  <button
                    onClick={handleActivateFF}
                    disabled={ffLoading || !ffCodeInput.trim()}
                    className="bg-brand-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors disabled:opacity-50 shrink-0"
                  >
                    {ffLoading ? '...' : 'Activar'}
                  </button>
                </div>
                {ffError && <p className="text-xs text-red-600">{ffError}</p>}
              </div>
            )}
          </div>
        )}

        {/* App info */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-800 mb-3">Sobre MealOps</h3>
          <div className="space-y-1 text-sm text-gray-500">
            <p>🥄 Planificador BLW para bebés ~12 meses</p>
            <p>🤖 Generación de menús con Claude AI</p>
            <p>📊 KPIs nutricionales automáticos</p>
            <p>🛒 Lista de la compra integrada</p>
          </div>
        </div>

        {/* Dev-only testing panel */}
        {import.meta.env.DEV && import.meta.env.VITE_SHOW_DEV_PANEL === 'true' && householdDoc && (
          <div className="border-2 border-dashed border-amber-300 rounded-2xl p-4 space-y-3 bg-amber-50">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">🛠 Panel de testing (solo dev)</p>
            <p className="text-xs text-amber-600">Simula el estado de un usuario nuevo sin API key ni código F&F activado.</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={async () => {
                  if (!confirm('¿Simular usuario nuevo? Borrará tu API key y resetará el estado F&F.')) return;
                  await updateDoc(doc(db, 'households', householdId), {
                    anthropicApiKey: '',
                    ffActivated: false,
                    freeCallsUsed: 0,
                  });
                }}
                className="text-xs bg-amber-500 text-white px-3 py-1.5 rounded-lg hover:bg-amber-600 transition-colors font-medium"
              >
                Resetear a usuario nuevo
              </button>
              <button
                onClick={async () => {
                  if (!confirm('¿Simular F&F activado con 28/30 llamadas usadas?')) return;
                  await updateDoc(doc(db, 'households', householdId), {
                    anthropicApiKey: '',
                    ffActivated: true,
                    freeCallsUsed: 28,
                  });
                }}
                className="text-xs bg-amber-500 text-white px-3 py-1.5 rounded-lg hover:bg-amber-600 transition-colors font-medium"
              >
                Simular F&F casi agotado (28/30)
              </button>
              <button
                onClick={async () => {
                  if (!confirm('¿Simular F&F agotado (30/30)?')) return;
                  await updateDoc(doc(db, 'households', householdId), {
                    anthropicApiKey: '',
                    ffActivated: true,
                    freeCallsUsed: 30,
                  });
                }}
                className="text-xs bg-amber-500 text-white px-3 py-1.5 rounded-lg hover:bg-amber-600 transition-colors font-medium"
              >
                Simular F&F agotado (30/30)
              </button>
            </div>
            <p className="text-xs text-amber-500 italic">Este bloque no aparece en producción.</p>
          </div>
        )}

        {/* Sign out */}
        <button
          onClick={auth.signOut}
          className="w-full border border-red-200 text-red-600 rounded-xl py-3 font-medium hover:bg-red-50 transition-colors"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const auth = useAuthProvider();
  return (
    <AuthContext.Provider value={auth}>
      <AppContent />
    </AuthContext.Provider>
  );
}
