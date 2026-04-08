import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import Logo from '../ui/Logo';
import { CalendarDays, Bot, BarChart2, ShoppingCart } from 'lucide-react';

export default function LoginScreen() {
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError('Error al iniciar sesión. Inténtalo de nuevo.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <Logo variant="full" className="w-40 h-40 mx-auto block mb-4" />
          <h1 className="text-3xl font-bold text-gray-900">MealOps</h1>
          <p className="text-gray-500 mt-2 text-sm">Planificador de alimentación BLW</p>
        </div>

        {/* Feature list */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6 space-y-3">
          {[
            { Icon: CalendarDays, text: 'Menú semanal para bebé y familia' },
            { Icon: Bot, text: 'Generación con IA (Claude)' },
            { Icon: BarChart2, text: 'KPIs nutricionales automáticos' },
            { Icon: ShoppingCart, text: 'Lista de la compra integrada' },
          ].map(({ Icon, text }) => (
            <div key={text} className="flex items-center gap-3">
              <Icon className="w-5 h-5 text-brand-600 shrink-0" />
              <span className="text-sm text-gray-700">{text}</span>
            </div>
          ))}
        </div>

        {/* Sign in button */}
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 rounded-xl px-5 py-3.5 text-gray-700 font-medium shadow-sm hover:shadow-md hover:border-gray-400 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
          )}
          {loading ? 'Iniciando sesión...' : 'Continuar con Google'}
        </button>

        {error && (
          <p className="text-red-600 text-sm text-center mt-3">{error}</p>
        )}

        <p className="text-xs text-gray-400 text-center mt-6">
          Tus datos se guardan de forma segura en Firebase.
        </p>
      </div>
    </div>
  );
}
