import { useState, useEffect, useCallback } from 'react';

const PADDING = 10;

const STEPS = [
  {
    selector: '[data-tour="tab-week"]',
    title: 'Tu menú de la semana',
    text: 'El centro de todo. Aquí tienes el menú completo de la semana, generado y adaptado a tu familia. Pulsa + para crear tu primera semana.',
  },
  {
    selector: '[data-tour="new-week-btn"]',
    title: 'Genera el menú con IA',
    text: 'Dile qué ingredientes tienes, cuántos días quieres planificar y qué objetivos nutricionales importan esta semana. Claude construye un menú equilibrado en segundos.',
  },
  {
    selector: '[data-tour="kpi-pills"]',
    title: 'Nutrición bajo control',
    text: 'De un vistazo ves si el menú cubre hierro, pescado azul, legumbres, fruta y verduras. Si algo falla, la IA puede corregirlo automáticamente.',
  },
  {
    selector: '[data-tour="quick-meal-btn"]',
    title: '¿No sabes qué cocinar hoy?',
    text: 'Dile a la IA lo que tienes en la nevera y te propone una comida en segundos, adaptada al bebé y al adulto.',
  },
  {
    selector: '[data-tour="batch-cooking-btn"]',
    title: 'Cocina una vez, come toda la semana',
    text: 'La app agrupa las preparaciones del menú para que cocines de forma eficiente: qué hacer primero, qué se puede hacer en paralelo y cuánto aguarda cada cosa. ⚠️ En mejora continua.',
  },
  {
    selector: '[data-tour="shopping-btn"]',
    title: 'Lista de la compra automática',
    text: 'Se genera sola a partir del menú. Solo tienes que ir marcando lo que ya tienes o lo que compras. Sin olvidar nada.',
  },
  {
    selector: '[data-tour="tab-day"]',
    title: 'El detalle de cada día',
    text: 'Entra en cualquier día para ver cada franja horaria, registrar cómo fue la comida y recibir una sugerencia de cena adaptada a lo que ya ha comido el bebé ese día.',
    navigate: 'day',
  },
  {
    selector: '[data-tour="tab-recipes"]',
    title: 'Tus comidas habituales',
    text: 'Aquí guardas las comidas que ya conoces y funcionan en casa. La IA las tiene en cuenta al generar el menú para no proponer siempre lo mismo.',
    navigate: 'recipes',
  },
  {
    selector: '[data-tour="add-meal-btn"]',
    title: 'Añade una comida en segundos',
    text: 'Escribe el nombre o sube una foto del plato. La IA identifica los ingredientes y etiqueta automáticamente su valor nutricional: hierro, proteína, verdura...',
    navigate: 'recipes',
  },
  {
    selector: '[data-tour="baby-profile"]',
    title: 'Perfil de tu bebé',
    text: 'Añade el nombre, fecha de nacimiento y si toma lactancia. La IA usa esta info para adaptar las raciones y recomendaciones.',
    navigate: 'profile',
  },
  {
    selector: '[data-tour="tab-profile"]',
    title: 'Configura tu perfil',
    text: 'Indica la edad del bebé, las franjas horarias que usáis y conecta tu API key de Claude. Todo esto personaliza cada generación.',
    navigate: 'profile',
  },
];

export default function SpotlightTour({ onComplete, onNavigate }) {
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
    if (currentStep.navigate && onNavigate) {
      onNavigate(currentStep.navigate);
    }
    // Small delay so the DOM settles after tab navigation
    const t = setTimeout(measure, 80);
    window.addEventListener('resize', measure);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', measure);
    };
  }, [measure, currentStep.navigate, onNavigate]);

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
