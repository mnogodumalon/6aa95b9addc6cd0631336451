import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Behandler, Patienten, Leistungen, Rezepte, Termine, Behandlungen } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { t } from '@/i18n';

/** Dashboard data + the OPTIMISTIC-WRITE API.
 *
 *  The per-entity setters (`set<Entity>`) are exported for exactly one job:
 *  optimistic updates on drag writes (onEventDrop / onEventResize /
 *  onCardMove). Call the setter FIRST — the bar/card lands instantly — then
 *  fire the PATCH in the background and call `fetchAll()` ONLY in the catch.
 *  Never await the PATCH before updating state (the UI freezes for the full
 *  round-trip on every drag) and never refetch after a successful write.
 *  There is no other mechanism (no `__optimistic`, no `mutate`).
 */
/** Entities this hook can load — the same keys the journey layer uses. */
export type DashboardEntity = 'behandler' | 'patienten' | 'leistungen' | 'rezepte' | 'termine' | 'behandlungen';

export interface DashboardDataOptions {
  /** Entities this page does NOT need (picked through useRecordSearch instead).
   *  Every flow page mounts this hook on its own route, so without `omit` a
   *  page that searches 3.000 guests server-side would still pull all 3.000
   *  through the side door. */
  omit?: DashboardEntity[];
}

export function useDashboardData(options: DashboardDataOptions = {}) {
  // A string key, not the array: an inline `omit={['gaeste']}` is a new array
  // on every render and would restart the fetch forever.
  const omitKey = (options.omit ?? []).slice().sort().join('|');
  const [behandler, setBehandler] = useState<Behandler[]>([]);
  const [patienten, setPatienten] = useState<Patienten[]>([]);
  const [leistungen, setLeistungen] = useState<Leistungen[]>([]);
  const [rezepte, setRezepte] = useState<Rezepte[]>([]);
  const [termine, setTermine] = useState<Termine[]>([]);
  const [behandlungen, setBehandlungen] = useState<Behandlungen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAll = useCallback(async () => {
    setError(null);
    const omit = new Set(omitKey ? omitKey.split('|') : []);
    try {
      const [behandlerData, patientenData, leistungenData, rezepteData, termineData, behandlungenData] = await Promise.all([
        omit.has('behandler') ? Promise.resolve([] as Behandler[]) : LivingAppsService.getBehandler(),
        omit.has('patienten') ? Promise.resolve([] as Patienten[]) : LivingAppsService.getPatienten(),
        omit.has('leistungen') ? Promise.resolve([] as Leistungen[]) : LivingAppsService.getLeistungen(),
        omit.has('rezepte') ? Promise.resolve([] as Rezepte[]) : LivingAppsService.getRezepte(),
        omit.has('termine') ? Promise.resolve([] as Termine[]) : LivingAppsService.getTermine(),
        omit.has('behandlungen') ? Promise.resolve([] as Behandlungen[]) : LivingAppsService.getBehandlungen(),
      ]);
      setBehandler(behandlerData);
      setPatienten(patientenData);
      setLeistungen(leistungenData);
      setRezepte(rezepteData);
      setTermine(termineData);
      setBehandlungen(behandlungenData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(t('data_load_failed')));
    } finally {
      setLoading(false);
    }
  }, [omitKey]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Silent background refresh (no loading state change → no flicker)
  useEffect(() => {
    const omit = new Set(omitKey ? omitKey.split('|') : []);
    async function silentRefresh() {
      try {
        const [behandlerData, patientenData, leistungenData, rezepteData, termineData, behandlungenData] = await Promise.all([
          omit.has('behandler') ? Promise.resolve([] as Behandler[]) : LivingAppsService.getBehandler(),
          omit.has('patienten') ? Promise.resolve([] as Patienten[]) : LivingAppsService.getPatienten(),
          omit.has('leistungen') ? Promise.resolve([] as Leistungen[]) : LivingAppsService.getLeistungen(),
          omit.has('rezepte') ? Promise.resolve([] as Rezepte[]) : LivingAppsService.getRezepte(),
          omit.has('termine') ? Promise.resolve([] as Termine[]) : LivingAppsService.getTermine(),
          omit.has('behandlungen') ? Promise.resolve([] as Behandlungen[]) : LivingAppsService.getBehandlungen(),
        ]);
        setBehandler(behandlerData);
        setPatienten(patientenData);
        setLeistungen(leistungenData);
        setRezepte(rezepteData);
        setTermine(termineData);
        setBehandlungen(behandlungenData);
      } catch {
        // silently ignore — stale data is better than no data
      }
    }
    function handleRefresh() { void silentRefresh(); }
    // assistant:data-changed comes from the assistant (<la-klar-assistant>)
    // after every mutation. The element additionally fires the legacy
    // dashboard-refresh event for OLD deployed bundles — do NOT subscribe to
    // both here, or every mutation fetches twice.
    window.addEventListener('assistant:data-changed', handleRefresh);
    return () => window.removeEventListener('assistant:data-changed', handleRefresh);
  }, [omitKey]);

  const behandlerMap = useMemo(() => {
    const m = new Map<string, Behandler>();
    behandler.forEach(r => m.set(r.record_id, r));
    return m;
  }, [behandler]);

  const patientenMap = useMemo(() => {
    const m = new Map<string, Patienten>();
    patienten.forEach(r => m.set(r.record_id, r));
    return m;
  }, [patienten]);

  const leistungenMap = useMemo(() => {
    const m = new Map<string, Leistungen>();
    leistungen.forEach(r => m.set(r.record_id, r));
    return m;
  }, [leistungen]);

  const rezepteMap = useMemo(() => {
    const m = new Map<string, Rezepte>();
    rezepte.forEach(r => m.set(r.record_id, r));
    return m;
  }, [rezepte]);

  const termineMap = useMemo(() => {
    const m = new Map<string, Termine>();
    termine.forEach(r => m.set(r.record_id, r));
    return m;
  }, [termine]);

  return { behandler, setBehandler, patienten, setPatienten, leistungen, setLeistungen, rezepte, setRezepte, termine, setTermine, behandlungen, setBehandlungen, loading, error, fetchAll, behandlerMap, patientenMap, leistungenMap, rezepteMap, termineMap };
}

/** The hook's return — the `data` prop of DashboardOverview in the Ready-Wrapper form. */
export type DashboardData = ReturnType<typeof useDashboardData>;