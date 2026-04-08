/**
 * Logo component — dos variantes:
 *  "mark"  → solo silueta de la olla, sin líneas de cota. Para navbar.
 *  "full"  → blueprint completo con líneas de medida. Para hero / onboarding.
 */
export default function Logo({ variant = 'mark', className = '' }) {
  if (variant === 'mark') {
    return (
      <svg
        viewBox="0 0 60 60"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-label="MealOps"
      >
        {/* Lid dome */}
        <path
          d="M13 28 Q13 17 30 14 Q47 17 47 28"
          stroke="#1A406B" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round"
        />
        {/* Lid shine */}
        <path
          d="M19 23 Q24 19 32 18"
          stroke="#1A406B" strokeWidth="1.5"
          strokeLinecap="round" opacity="0.35"
        />
        {/* Knob stem */}
        <line x1="30" y1="14" x2="30" y2="9" stroke="#1A406B" strokeWidth="2.5" strokeLinecap="round"/>
        {/* Knob circle */}
        <circle cx="30" cy="6" r="3.5" stroke="#1A406B" strokeWidth="2"/>
        {/* Pot body */}
        <path
          d="M13 28 L13 50 Q13 53 17 53 L43 53 Q47 53 47 50 L47 28"
          stroke="#1A406B" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round"
        />
        {/* Left handle */}
        <path
          d="M13 33 Q5 32 5 39 Q5 45 13 44"
          stroke="#1A406B" strokeWidth="2"
          strokeLinecap="round"
        />
        {/* Right handle */}
        <path
          d="M47 33 Q55 32 55 39 Q55 45 47 44"
          stroke="#1A406B" strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  // Full variant — tu logo PNG
  return (
    <img
      src="/logo.png"
      alt="MealOps"
      className={className}
    />
  );
}
