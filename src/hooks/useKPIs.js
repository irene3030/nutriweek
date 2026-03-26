import { useMemo } from 'react';
import { calculateKPIs } from '../lib/kpis';

export function useKPIs(weekDoc, customKPIs = []) {
  const kpis = useMemo(() => calculateKPIs(weekDoc, customKPIs), [weekDoc, customKPIs]);
  return kpis;
}
