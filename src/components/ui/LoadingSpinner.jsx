export default function LoadingSpinner({ size = 'md', className = '', label = 'Cargando...' }) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-2',
    lg: 'w-12 h-12 border-3',
  };

  return (
    <div className={`flex flex-col items-center justify-center gap-2 ${className}`} role="status" aria-label={label}>
      <div
        className={`${sizeClasses[size]} rounded-full border-brand-200 border-t-brand-600 animate-spin`}
      />
      {label && size !== 'sm' && (
        <span className="text-sm text-gray-500">{label}</span>
      )}
    </div>
  );
}

export function FullPageSpinner({ label = 'Cargando...' }) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingSpinner size="lg" label={label} />
    </div>
  );
}
