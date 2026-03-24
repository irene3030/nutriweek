import { useState, useEffect } from 'react';

export default function InstallBanner() {
  const [prompt, setPrompt] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Don't show again this session if dismissed
    if (sessionStorage.getItem('pwa-install-dismissed')) return;

    const handler = (e) => {
      e.preventDefault();
      setPrompt(e);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted' || outcome === 'dismissed') {
      setVisible(false);
      setPrompt(null);
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem('pwa-install-dismissed', '1');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-16 left-0 right-0 z-50 px-4 pb-2">
      <div className="max-w-lg mx-auto bg-white border border-brand-200 rounded-2xl shadow-lg px-4 py-3 flex items-center gap-3">
        <span className="text-2xl shrink-0">🥦</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800">Instala NutriWeek</p>
          <p className="text-xs text-gray-500">Accede rápido desde tu pantalla de inicio</p>
        </div>
        <button
          onClick={handleInstall}
          className="shrink-0 bg-brand-600 text-white text-xs font-semibold px-3 py-1.5 rounded-xl hover:bg-brand-700 transition-colors"
        >
          Instalar
        </button>
        <button
          onClick={handleDismiss}
          className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors p-1"
          aria-label="Cerrar"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
