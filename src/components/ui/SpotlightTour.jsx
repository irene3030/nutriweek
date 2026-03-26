import { useState, useEffect, useCallback } from 'react';

const PADDING = 10;

const STEPS = [
  {
    selector: '[data-tour="tab-week"]',
    title: 'Tu menú semanal',
    text: 'Aquí ves el menú de la semana. Pulsa + para crear tu primera semana.',
  },
  {
    selector: '[data-tour="new-week-btn"]',
    title: 'Generar con IA',
    text: 'Claude puede generarte un menú completo basado en tus ingredientes.',
  },
  {
    selector: '[data-tour="kpi-pills"]',
    title: 'Objetivos nutricionales',
    text: 'Aquí ves si el menú cumple los objetivos nutricionales de la semana.',
  },
  {
    selector: '[data-tour="tab-recipes"]',
    title: 'Tus recetas',
    text: 'Guarda las comidas que ya le gustan a tu bebé para reutilizarlas.',
  },
  {
    selector: '[data-tour="tab-profile"]',
    title: 'Configura la IA',
    text: 'Para usar la IA necesitas añadir tu API key de Claude o un código de invitación.',
  },
];

export default function SpotlightTour({ onComplete }) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState(null);
  const [winSize, setWinSize] = useState({ w: window.innerWidth, h: window.innerHeight });

  const currentStep = STEPS[step];

  const measure = useCallback(() => {
    setWinSize({ w: window.innerWidth, h: window.innerHeight });
    const el = document.querySelector(currentStep.selector);
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({ x: r.x, y: r.y, width: r.width, height: r.height });
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [currentStep.selector]);

  useEffect(() => {
    // Small delay so the DOM settles after tab navigation
    const t = setTimeout(measure, 80);
    window.addEventListener('resize', measure);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', measure);
    };
  }, [measure]);

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      onComplete();
    }
  };

  // Tooltip positioning
  const tooltipW = Math.min(272, winSize.w - 32);
  let tooltipStyle;

  if (rect) {
    const spaceBelow = winSize.h - rect.y - rect.height - PADDING;
    const spaceAbove = rect.y - PADDING;
    let left = rect.x + rect.width / 2 - tooltipW / 2;
    left = Math.max(16, Math.min(left, winSize.w - tooltipW - 16));

    if (spaceBelow >= 140 || spaceBelow >= spaceAbove) {
      tooltipStyle = { top: rect.y + rect.height + PADDING + 8, left, width: tooltipW };
    } else {
      tooltipStyle = {
        top: rect.y - PADDING - 8 - 140, // approximate tooltip height
        left,
        width: tooltipW,
      };
    }
  } else {
    tooltipStyle = {
      top: winSize.h / 2 - 80,
      left: (winSize.w - tooltipW) / 2,
      width: tooltipW,
    };
  }

  return (
    <div className="fixed inset-0 z-50" style={{ pointerEvents: 'auto' }}>
      {/* Dark overlay with spotlight hole */}
      <svg
        className="absolute inset-0"
        width={winSize.w}
        height={winSize.h}
        style={{ pointerEvents: 'none' }}
      >
        <defs>
          <mask id="tour-mask">
            <rect width={winSize.w} height={winSize.h} fill="white" />
            {rect && (
              <rect
                x={rect.x - PADDING}
                y={rect.y - PADDING}
                width={rect.width + PADDING * 2}
                height={rect.height + PADDING * 2}
                rx={10}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width={winSize.w}
          height={winSize.h}
          fill="rgba(0,0,0,0.62)"
          mask="url(#tour-mask)"
        />
      </svg>

      {/* Tooltip */}
      <div
        className="absolute bg-white rounded-2xl shadow-2xl p-4 space-y-3"
        style={{ ...tooltipStyle, zIndex: 60 }}
      >
        {/* Progress dots */}
        <div className="flex gap-1.5 items-center">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-200 ${
                i === step ? 'bg-brand-600 w-5' : i < step ? 'bg-brand-300 w-1.5' : 'bg-gray-200 w-1.5'
              }`}
            />
          ))}
        </div>

        <div>
          <p className="font-semibold text-gray-900 text-sm">{currentStep.title}</p>
          <p className="text-gray-500 text-sm mt-0.5 leading-relaxed">{currentStep.text}</p>
        </div>

        <div className="flex items-center justify-between pt-0.5">
          <button
            onClick={onComplete}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Omitir tour
          </button>
          <button
            onClick={handleNext}
            className="bg-brand-600 text-white text-sm font-medium px-4 py-1.5 rounded-xl hover:bg-brand-700 transition-colors"
          >
            {step < STEPS.length - 1 ? 'Siguiente →' : 'Empezar'}
          </button>
        </div>
      </div>
    </div>
  );
}
