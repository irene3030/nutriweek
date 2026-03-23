import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { useHousehold } from '../../hooks/useHousehold';

export default function OnboardingScreen() {
  const { user, refreshUserDoc, signOut } = useAuth();
  const { createHousehold, joinHousehold, loading, error } = useHousehold(user, null, refreshUserDoc);
  const [mode, setMode] = useState(null); // 'create' | 'join'
  const [inviteCode, setInviteCode] = useState('');
  const [createdInfo, setCreatedInfo] = useState(null);
  const [joinError, setJoinError] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    try {
      const info = await createHousehold();
      setCreatedInfo(info);
    } catch (err) {
      console.error(err);
    }
  };

  const handleJoin = async () => {
    setJoinError(null);
    if (!inviteCode.trim()) {
      setJoinError('Introduce un código de invitación');
      return;
    }
    try {
      await joinHousehold(inviteCode.trim());
    } catch (err) {
      setJoinError(err.message);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(createdInfo.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (createdInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-orange-50 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="text-5xl mb-3">🎉</div>
            <h2 className="text-2xl font-bold text-gray-900">¡Familia creada!</h2>
            <p className="text-gray-500 mt-2 text-sm">Comparte este código con tu familia para que se unan</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Código de invitación</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-brand-50 rounded-xl px-4 py-3 text-center">
                <span className="text-2xl font-bold tracking-widest text-brand-700">
                  {createdInfo.inviteCode}
                </span>
              </div>
              <button
                onClick={handleCopyCode}
                className="flex items-center gap-1 px-3 py-3 bg-brand-600 text-white rounded-xl hover:bg-brand-700 transition-colors text-sm font-medium"
              >
                {copied ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </>
                )}
              </button>
            </div>
            {copied && <p className="text-brand-600 text-xs text-center mt-2">¡Copiado!</p>}
          </div>

          <button
            onClick={refreshUserDoc}
            className="w-full bg-brand-600 text-white rounded-xl py-3.5 font-semibold hover:bg-brand-700 transition-colors"
          >
            Empezar a planificar →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-orange-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-600 rounded-2xl shadow-lg mb-4">
            <span className="text-3xl">🥦</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">¡Bienvenido/a!</h1>
          <p className="text-gray-500 mt-2 text-sm">¿Cómo quieres empezar?</p>
        </div>

        {!mode ? (
          <div className="space-y-3">
            <button
              onClick={() => setMode('create')}
              className="w-full bg-white border-2 border-brand-200 rounded-2xl p-5 text-left hover:border-brand-400 hover:shadow-md transition-all group"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-brand-100 rounded-xl flex items-center justify-center text-2xl group-hover:bg-brand-200 transition-colors">
                  🏠
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Crear mi familia</h3>
                  <p className="text-sm text-gray-500 mt-0.5">Empieza un nuevo espacio y compártelo con tu pareja</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setMode('join')}
              className="w-full bg-white border-2 border-orange-200 rounded-2xl p-5 text-left hover:border-orange-400 hover:shadow-md transition-all group"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center text-2xl group-hover:bg-orange-200 transition-colors">
                  🔗
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Unirme a una familia</h3>
                  <p className="text-sm text-gray-500 mt-0.5">Introduce el código que te ha compartido tu pareja</p>
                </div>
              </div>
            </button>
          </div>
        ) : mode === 'create' ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <button
              onClick={() => setMode(null)}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Volver
            </button>
            <h3 className="font-semibold text-gray-900 mb-2">Crear familia</h3>
            <p className="text-sm text-gray-500 mb-5">
              Se creará un espacio compartido y recibirás un código de invitación para tu pareja.
            </p>
            {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
            <button
              onClick={handleCreate}
              disabled={loading}
              className="w-full bg-brand-600 text-white rounded-xl py-3.5 font-semibold hover:bg-brand-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {loading ? 'Creando...' : 'Crear familia'}
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <button
              onClick={() => setMode(null)}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Volver
            </button>
            <h3 className="font-semibold text-gray-900 mb-2">Unirme a una familia</h3>
            <p className="text-sm text-gray-500 mb-4">
              Introduce el código de 6 caracteres que te ha enviado tu pareja.
            </p>
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="XXXXXX"
              maxLength={6}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-center text-xl tracking-widest font-bold uppercase focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent mb-3"
            />
            {(joinError || error) && (
              <p className="text-red-600 text-sm mb-3">{joinError || error}</p>
            )}
            <button
              onClick={handleJoin}
              disabled={loading || inviteCode.length < 4}
              className="w-full bg-orange-500 text-white rounded-xl py-3.5 font-semibold hover:bg-orange-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {loading ? 'Uniéndome...' : 'Unirme'}
            </button>
          </div>
        )}

        <button
          onClick={signOut}
          className="w-full text-sm text-gray-400 hover:text-gray-600 mt-6 transition-colors"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
