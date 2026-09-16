/**
 * Required-field messages — WRITTEN BY THE BUILD AGENT, never by a heuristic.
 *
 * The layer knows two things about an empty required field: that it is
 * required and what its label is. Out of that it can only say „„Anreise" ist
 * ein Pflichtfeld". What the person should do instead („Bitte einen Gast
 * auswählen.") is meaning, and meaning is the agent's: the Phase-2 orchestrator
 * writes one short instruction per required field — what is needed, not why — to
 * `.intents-staging/messages.json`, the integration step validates it against
 * the app metadata and renders it into the block below. Scaffold updates keep
 * the block. Do not edit outside the markers.
 *
 * Every door reads this and nothing else: `useStepForm` (flows and public
 * pages), the generated {Entity}Dialog and the public form's server-error line.
 * A field without a sentence falls back to the label sentence — never to a
 * bare „Dieses Feld ist erforderlich".
 *
 * Required fields per entity (from the base view):
 *   - behandler: vorname (Vorname), nachname (Nachname), kuerzel (Kürzel), status (Status)
 *   - patienten: vorname (Vorname), nachname (Nachname), geburtsdatum (Geburtsdatum), versicherungsart (Versicherungsart)
 *   - leistungen: bezeichnung (Bezeichnung), heilmittelkuerzel (Heilmittelkürzel), dauer_minuten (Dauer (Minuten))
 *   - rezepte: patient (Patient), ausstellungsdatum (Ausstellungsdatum), arztpraxis (Verordnende Arztpraxis), leistung (Leistung), anzahl_einheiten (Anzahl verordnete Einheiten), status (Status)
 *   - termine: patient (Patient), behandler (Behandler), beginn (Datum und Beginn), ende (Ende), raum (Raum), status (Status)
 *   - behandlungen: termin (Termin), durchgefuehrte_leistung (Durchgeführte Leistung)
 */
import { t, tx } from '@/i18n';
import { labelOf, type EntityKey } from './rules';

/** The writable fields of each entity — the keys a message may address (generated). */
export interface MessageFields {
  "behandler": "vorname" | "nachname" | "kuerzel" | "fachgebiete" | "arbeitstage" | "status" | "email";
  "patienten": "vorname" | "nachname" | "geburtsdatum" | "telefon" | "email" | "strasse" | "hausnummer" | "plz" | "ort" | "krankenkasse" | "versichertennummer" | "versicherungsart" | "hausarzt" | "notizen";
  "leistungen": "bezeichnung" | "heilmittelkuerzel" | "dauer_minuten" | "preis_kasse" | "preis_privat";
  "rezepte": "patient" | "ausstellungsdatum" | "arztpraxis" | "diagnose" | "leistung" | "anzahl_einheiten" | "frequenz_pro_woche" | "gueltig_bis" | "status";
  "termine": "patient" | "behandler" | "rezept" | "beginn" | "ende" | "raum" | "status" | "bemerkung";
  "behandlungen": "termin" | "durchgefuehrte_leistung" | "dauer_tatsaechlich" | "befund" | "massnahmen" | "verlauf" | "naechste_schritte";
}
export type MessageFieldKey<E extends EntityKey> = E extends keyof MessageFields ? MessageFields[E] : never;

export const REQUIRED_MESSAGES: { [E in EntityKey]?: Partial<Record<MessageFieldKey<E>, string>> } = {
  // <custom:messages>
  behandler: { vorname: "Bitte den Vornamen eingeben.", nachname: "Bitte den Nachnamen eingeben.", kuerzel: "Bitte ein Kürzel eingeben.", status: "Bitte den Status wählen." },
  patienten: { vorname: "Bitte den Vornamen eingeben.", nachname: "Bitte den Nachnamen eingeben.", geburtsdatum: "Bitte das Geburtsdatum eingeben.", versicherungsart: "Bitte die Versicherungsart wählen." },
  leistungen: { bezeichnung: "Bitte die Bezeichnung eingeben.", heilmittelkuerzel: "Bitte das Heilmittelkürzel eingeben.", dauer_minuten: "Bitte die Dauer in Minuten eingeben." },
  rezepte: { patient: "Bitte einen Patienten auswählen.", ausstellungsdatum: "Bitte das Ausstellungsdatum wählen.", arztpraxis: "Bitte die verordnende Arztpraxis eingeben.", leistung: "Bitte eine Leistung auswählen.", anzahl_einheiten: "Bitte die Anzahl der verordneten Einheiten eingeben.", status: "Bitte den Status wählen." },
  termine: { patient: "Bitte einen Patienten auswählen.", behandler: "Bitte einen Behandler auswählen.", beginn: "Bitte Datum und Uhrzeit des Termins wählen.", ende: "Bitte das Ende des Termins wählen.", raum: "Bitte einen Raum wählen.", status: "Bitte den Status wählen." },
  behandlungen: { termin: "Bitte den zugehörigen Termin wählen.", durchgefuehrte_leistung: "Bitte die durchgeführte Leistung wählen." },
  // </custom:messages>
};

/** The sentence shown when `key` of `entity` is required and empty — the
 *  agent's own text (translated at runtime like every page string), else the
 *  label sentence. Call it while rendering, not at module scope. */
export function requiredMessage(entity: EntityKey, key: string): string {
  const own = (REQUIRED_MESSAGES as Record<string, Record<string, string | undefined> | undefined>)[entity]?.[key];
  if (own && own.trim()) return tx(own);
  return t('v_required', { label: labelOf(entity, key) });
}

/** True when the agent wrote a sentence for the field. */
export function hasOwnMessage(entity: EntityKey, key: string): boolean {
  const own = (REQUIRED_MESSAGES as Record<string, Record<string, string | undefined> | undefined>)[entity]?.[key];
  return Boolean(own && own.trim());
}
