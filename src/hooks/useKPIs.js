import { useMemo } from 'react';
import { calculateKPIs } from '../lib/kpis';

export function useKPIs(weekDoc) {
  const kpis = useMemo(() => calculateKPIs(weekDoc), [weekDoc]);
  return kpis;
}
