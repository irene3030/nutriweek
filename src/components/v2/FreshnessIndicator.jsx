export default function FreshnessIndicator({ expiresAt, daysUntil }) {
  if (!expiresAt) return null;
  const days = daysUntil(expiresAt);

  if (days < 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">
        Caducado
      </span>
    );
  }
  if (days === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">
        Caduca hoy
      </span>
    );
  }
  if (days === 1) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
        Caduca mañana
      </span>
    );
  }
  if (days <= 3) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
        {days} días
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
      {days} días
    </span>
  );
}
