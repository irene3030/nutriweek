import { useState, useEffect } from 'react';
import { AuthContext, useAuth, useAuthProvider } from './hooks/useAuth';
import { useWeek } from './hooks/useWeek';
import LoginScreen from './components/auth/LoginScreen';
import OnboardingScreen from './components/auth/OnboardingScreen';
import WeekView from './components/week/WeekView';
import DayView from './components/day/DayView';
import ShoppingList from './components/shopping/ShoppingList';
import RecipeSearch from './components/recipes/RecipeSearch';
import { FullPageSpinner } from './components/ui/LoadingSpinner';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  getDoc,
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
};

function AppContent() {
  const auth = useAuth();
  const [activeTab, setActiveTab] = useState('week');
  const [selectedDayIndex, setSelectedDayIndex] = useState(null);
  const [savedRecipes, setSavedRecipes] = useState([]);
  const [foodHistory, setFoodHistory] = useState([]);

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
    trackMeal,
    copyMeal,
  } = useWeek(auth.userDoc?.householdId);

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
  };

  // Render loading state
  if (auth.loading) return <FullPageSpinner label="Iniciando NutriWeek..." />;

  // Render login if not authenticated
  if (!auth.user) return <LoginScreen />;

  // Render onboarding if no household
  if (!auth.userDoc?.householdId) return <OnboardingScreen />;

  // Day view (full screen, no tab bar)
  if (selectedDayIndex !== null && currentWeek) {
    return (
      <DayView
          weekDoc={currentWeek}
          dayIndex={selectedDayIndex}
          householdId={auth.userDoc.householdId}
          onBack={handleBackFromDay}
          onSaveMeal={(weekId, dIdx, mIdx, data) => updateMeal(weekId, dIdx, mIdx, data)}
          onTrackMeal={(weekId, dIdx, mIdx, trackData) => trackMeal(weekId, dIdx, mIdx, trackData)}
          onCopyMeal={(weekId, srcDayIdx, srcMealIdx, tgtDayIdx, tgtMealIdx) =>
            copyMeal(weekId, srcDayIdx, srcMealIdx, tgtDayIdx, tgtMealIdx)
          }
          onReorderMeals={(weekId, dIdx, newMeals) => updateDayMeals(weekId, dIdx, newMeals)}
        />
    );
  }

  return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Main content */}
        <div className="flex-1 pb-16">
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
              onDeleteWeek={deleteWeek}
              onUpdateLabel={updateWeekLabel}
              onDayClick={handleDayClick}
              foodHistory={foodHistory}
              savedRecipes={savedRecipes}
            />
          )}

          {activeTab === 'shopping' && (
            <div className="min-h-screen bg-gray-50">
              <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
                <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-2">
                  <span className="text-xl">🛒</span>
                  <h1 className="text-lg font-bold text-gray-900">Lista de la compra</h1>
                </div>
              </header>
              <ShoppingList
                weekDoc={currentWeek}
                householdId={auth.userDoc?.householdId}
              />
            </div>
          )}

          {activeTab === 'recipes' && (
            <div className="min-h-screen bg-gray-50">
              <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
                <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-2">
                  <span className="text-xl">📖</span>
                  <h1 className="text-lg font-bold text-gray-900">Mis recetas</h1>
                </div>
              </header>
              <div className="max-w-2xl mx-auto px-4 py-4">
                <RecipeSearch
                  householdId={auth.userDoc?.householdId}
                  onSelect={null}
                />
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <ProfileTab auth={auth} />
          )}
        </div>

        {/* Bottom tab bar */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-20">
          <div className="max-w-lg mx-auto flex">
            {[
              { id: 'week', label: 'Semana' },
              { id: 'shopping', label: 'Compra' },
              { id: 'recipes', label: 'Recetas' },
              { id: 'profile', label: 'Perfil' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
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

function ProfileTab({ auth }) {
  const [householdData, setHouseholdData] = useState(null);

  useEffect(() => {
    if (!auth.userDoc?.householdId) return;
    getDoc(doc(db, 'households', auth.userDoc.householdId)).then((snap) => {
      if (snap.exists()) setHouseholdData(snap.data());
    });
  }, [auth.userDoc?.householdId]);

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
            <img
              src={auth.user.photoURL}
              alt={auth.user.displayName}
              className="w-14 h-14 rounded-full"
            />
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
        {householdData && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-800 mb-3">Tu familia</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Código de invitación</span>
                <span className="font-bold tracking-widest text-brand-700 bg-brand-50 px-3 py-1 rounded-lg">
                  {householdData.inviteCode}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Miembros</span>
                <span className="text-sm text-gray-700">{householdData.members?.length || 1}</span>
              </div>
            </div>
          </div>
        )}

        {/* App info */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-800 mb-3">Sobre NutriWeek</h3>
          <div className="space-y-1 text-sm text-gray-500">
            <p>🥦 Planificador BLW para bebés ~12 meses</p>
            <p>🤖 Generación de menús con Claude AI</p>
            <p>📊 KPIs nutricionales automáticos</p>
            <p>🛒 Lista de la compra integrada</p>
          </div>
        </div>

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
