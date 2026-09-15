/**
 * Occupancy semantics — DECIDED BY THE BUILD AGENT, never by a heuristic.
 *
 * The Phase-2 orchestrator writes its decision to `.intents-staging/occupancy.json`
 * (stay pair, booked resource, statuses that do not occupy); the integration
 * step validates it against the app metadata and renders it into the block
 * below. Scaffold updates keep the block. Do not edit outside the markers.
 *
 * Both doors read this and nothing else: `occupancyFor` (internal flows AND
 * public pages) and the owner service (the public grant's occupancy read).
 * No rule for an entity = no availability calendar, no occupancy claim —
 * a plain date field pair is shown instead.
 *
 * Facts from the metadata — candidates, NOT decisions:
 *   - behandler: lookups status[aktiv|urlaub|krank]
 *   - patienten: lookups versicherungsart[gesetzlich|privat|selbstzahler]
 *   - leistungen: no date pair, no references
 *   - rezepte: applookups patient→patienten, leistung→leistungen · lookups status[offen|in_behandlung|abgeschlossen|abgelaufen]
 *   - termine: date pairs beginn+ende · applookups patient→patienten, behandler→behandler, rezept→rezepte · lookups raum[raum_1|raum_2|raum_3|geraeteraum], status[geplant|bestaetigt|erschienen|nicht_erschienen|abgesagt]
 *   - behandlungen: applookups termin→termine, durchgefuehrte_leistung→leistungen
 */
import type { EntityKey } from '@/lib/journey/rules';

export interface OccupancyRule {
  /** Arrival / departure fields (the departure day is exclusive). */
  from: string;
  to: string;
  /** applookup field naming the booked RESOURCE (room, vehicle, court).
   *  Omit when the entity itself is the one resource (a single holiday flat). */
  resource?: string;
  /** lookup field + the keys that mean "does NOT occupy" (cancelled, no-show). */
  statusField?: string;
  freeKeys?: string[];
}

export const OCCUPANCY: Partial<Record<EntityKey, OccupancyRule>> = {
  // <custom:occupancy>
  termine: { from: 'beginn', to: 'ende', resource: 'behandler', statusField: 'status', freeKeys: ['abgesagt', 'nicht_erschienen'] },
  // </custom:occupancy>
};
