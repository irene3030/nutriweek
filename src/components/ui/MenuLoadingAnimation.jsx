import { useEffect, useState } from 'react';

const MESSAGES = [
  'Eligiendo verduritas nutritivas...',
  'Pensando en proteínas para el bebé...',
  'Combinando sabores y texturas...',
  'Buscando recetas con hierro...',
  'Equilibrando el menú semanal...',
  'Añadiendo pescado azul...',
  'Revisando variedad de colores...',
];

const FOODS = ['🥦', '🥕', '🍳', '🫐', '🥑', '🍎', '🥚', '🍠'];

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
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: orbit var(--dur) linear infinite;
          font-size: 18px;
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
          <span className="baby-bob text-5xl select-none">👶</span>

          {/* Orbiting food emojis */}
          {FOODS.map((food, i) => (
            <span
              key={food}
              className="food-orbit"
              style={{
                '--start': `${i * (360 / FOODS.length)}deg`,
                '--dur': `${3.5 + (i % 3) * 0.4}s`,
                top: '50%',
                left: '50%',
                marginTop: '-14px',
                marginLeft: '-14px',
                animationDelay: `${-i * (3.5 / FOODS.length)}s`,
              }}
            >
              {food}
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
