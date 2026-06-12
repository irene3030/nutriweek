import { generateKpiPhrases } from '../../lib/kpis';

export default function KpiInsights({ kpis }) {
  const phrases = generateKpiPhrases(kpis);
  if (!phrases.length) return null;

  return (
    <ul className="space-y-0.5 px-1">
      {phrases.map(({ id, text }) => (
        <li key={id} className="text-xs text-gray-400 leading-relaxed">
          · {text}
        </li>
      ))}
    </ul>
  );
}
