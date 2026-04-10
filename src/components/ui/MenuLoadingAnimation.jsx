import { useEffect, useState } from 'react';
import { Baby, Leaf, Fish, Bean, Apple, Droplets, Egg, Wheat, Cherry } from 'lucide-react';

const MESSAGES = [
  'Eligiendo verduritas nutritivas...',
  'Pensando en proteínas para el bebé...',
  'Combinando sabores y texturas...',
  'Buscando recetas con hierro...',
  'Equilibrando el menú semanal...',
  'Añadiendo pescado azul...',
  'Revisando variedad de colores...',
];

const FOOD_ORBIT_ICONS = [
  { Icon: Leaf,     color: '#22c55e' },
  { Icon: Fish,     color: '#0ea5e9' },
  { Icon: Bean,     color: '#16a34a' },
  { Icon: Apple,    color: '#f97316' },
  { Icon: Droplets, color: '#ea580c' },
  { Icon: Egg,      color: '#d97706' },
  { Icon: Wheat,    color: '#ca8a04' },
  { Icon: Cherry,   color: '#e11d48' },
];

export default function MenuLoadingAnimation() {
  const [msgIndex, setMsgIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setMsgIndex(i => (i + 1) % MESSAGES.length);
        setVisible(true);
      }, 300);
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <style>{`
        @keyframes orbit {
          from { transform: rotate(var(--start)) translateX(52px) rotate(calc(-1 * var(--start))); }
          to   { transform: rotate(calc(var(--start) + 360deg)) translateX(52px) rotate(calc(-1 * (var(--start) + 360deg))); }
        }
        @keyframes baby-bob {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-6px); }
        }
        @keyframes fade-msg {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .food-orbit {
          position: absolute;
          width: 26px;
          height: 26px;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: orbit var(--dur) linear infinite;
        }
        .baby-bob {
          animation: baby-bob 1.8s ease-in-out infinite;
        }
        .fade-msg {
          animation: fade-msg 0.3s ease-out forwards;
        }
      `}</style>

      <div className="flex flex-col items-center gap-6 py-10">
        {/* Orbit container */}
        <div className="relative w-28 h-28 flex items-center justify-center">
          {/* Orbit ring */}
          <div className="absolute inset-0 rounded-full border border-dashed border-brand-200 opacity-60" />

          {/* Baby in center */}
          <span className="baby-bob flex items-center justify-center select-none text-brand-500">
            <Baby className="w-12 h-12" />
          </span>

          {/* Orbiting food icons */}
          {FOOD_ORBIT_ICONS.map(({ Icon, color }, i) => (
            <span
              key={i}
              className="food-orbit"
              style={{
                '--start': `${i * (360 / FOOD_ORBIT_ICONS.length)}deg`,
                '--dur': `${3.5 + (i % 3) * 0.4}s`,
                top: '50%',
                left: '50%',
                marginTop: '-13px',
                marginLeft: '-13px',
                animationDelay: `${-i * (3.5 / FOOD_ORBIT_ICONS.length)}s`,
              }}
            >
              <Icon style={{ width: 14, height: 14, color }} />
            </span>
          ))}
        </div>

        {/* Cycling message */}
        <div className="h-5 flex items-center">
          {visible && (
            <p className="fade-msg text-sm text-gray-500 text-center">
              {MESSAGES[msgIndex]}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
