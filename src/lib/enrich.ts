import type { EnrichedBehandlungen, EnrichedRezepte, EnrichedTermine } from '@/types/enriched';
import type { Behandler, Behandlungen, Leistungen, Patienten, Rezepte, Termine } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveDisplay(url: unknown, map: Map<string, any>, ...fields: string[]): string {
  if (!url) return '';
  const id = extractRecordId(url);
  if (!id) return '';
  const r = map.get(id);
  if (!r) return '';
  return fields.map(f => String(r.fields[f] ?? '')).join(' ').trim();
}

interface RezepteMaps {
  patientenMap: Map<string, Patienten>;
  leistungenMap: Map<string, Leistungen>;
}

export function enrichRezepte(
  rezepte: Rezepte[],
  maps: RezepteMaps
): EnrichedRezepte[] {
  return rezepte.map(r => ({
    ...r,
    patientName: resolveDisplay(r.fields.patient, maps.patientenMap, 'vorname', 'nachname'),
    leistungName: resolveDisplay(r.fields.leistung, maps.leistungenMap, 'bezeichnung'),
  }));
}

interface TermineMaps {
  patientenMap: Map<string, Patienten>;
  behandlerMap: Map<string, Behandler>;
  rezepteMap: Map<string, Rezepte>;
}

export function enrichTermine(
  termine: Termine[],
  maps: TermineMaps
): EnrichedTermine[] {
  return termine.map(r => ({
    ...r,
    patientName: resolveDisplay(r.fields.patient, maps.patientenMap, 'vorname', 'nachname'),
    behandlerName: resolveDisplay(r.fields.behandler, maps.behandlerMap, 'vorname', 'nachname'),
    rezeptName: resolveDisplay(r.fields.rezept, maps.rezepteMap, 'arztpraxis'),
  }));
}

interface BehandlungenMaps {
  termineMap: Map<string, Termine>;
  leistungenMap: Map<string, Leistungen>;
}

export function enrichBehandlungen(
  behandlungen: Behandlungen[],
  maps: BehandlungenMaps
): EnrichedBehandlungen[] {
  return behandlungen.map(r => ({
    ...r,
    terminName: resolveDisplay(r.fields.termin, maps.termineMap, 'bemerkung'),
    durchgefuehrte_leistungName: resolveDisplay(r.fields.durchgefuehrte_leistung, maps.leistungenMap, 'bezeichnung'),
  }));
}
