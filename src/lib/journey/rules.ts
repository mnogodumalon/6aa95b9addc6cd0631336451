/**
 * Field rules — GENERATED from the app metadata. Do not edit.
 *
 * The mechanical truth about every field: what kind it is, whether the
 * platform's base view marks it required, which lookup keys exist, where an
 * applookup points, what the label is. `useStepForm` validates against these
 * rules and phrases its messages with the real labels; `toWirePayload` uses
 * them to shape the create payload; `SHAPES` tells a page which input FORM
 * fits the data (a date pair wants a calendar, not two fields) — it is a
 * signal, not a gate.
 */
import { appLabel, fieldLabel, lookupLabel } from '@/i18n';
import { LOOKUP_OPTIONS } from '@/types/app';

export type EntityKey = 'behandler' | 'patienten' | 'leistungen' | 'rezepte' | 'termine' | 'behandlungen';

/** The text fields of each entity — what a search may run over (generated;
 *  `never` for an entity without text of its own, e.g. a link table). */
export interface StringFields {
  "behandler": "vorname" | "nachname" | "kuerzel" | "email";
  "patienten": "vorname" | "nachname" | "telefon" | "email" | "strasse" | "hausnummer" | "plz" | "ort" | "krankenkasse" | "versichertennummer" | "hausarzt" | "notizen";
  "leistungen": "bezeichnung" | "heilmittelkuerzel";
  "rezepte": "arztpraxis" | "diagnose";
  "termine": "bemerkung";
  "behandlungen": "befund" | "massnahmen" | "verlauf" | "naechste_schritte";
}
export type StringFieldKey<E extends EntityKey> = E extends keyof StringFields ? StringFields[E] : never;

/** The applookup fields of each entity (generated). A pick stored through
 *  `form.set` on one of these must carry its display name — at compile time
 *  (`StepForm.set`), because the review would otherwise show the id. */
export interface RecordFields {
  "behandler": never;
  "patienten": never;
  "leistungen": never;
  "rezepte": "patient" | "leistung";
  "termine": "patient" | "behandler" | "rezept";
  "behandlungen": "termin" | "durchgefuehrte_leistung";
}
export type RecordFieldKey<E extends EntityKey> = E extends keyof RecordFields ? RecordFields[E] : never;

export type FieldKind =
  | 'text'
  | 'textarea'
  | 'email'
  | 'tel'
  | 'url'
  | 'number'
  | 'bool'
  | 'date'
  | 'datetime'
  | 'lookup'
  | 'multilookup'
  | 'record'
  | 'multirecord'
  | 'file'
  | 'geo';

export interface FieldRule {
  key: string;
  fulltype: string;
  kind: FieldKind;
  /** From the app's base view. A public page may override this per field. */
  required: boolean;
  /** Build-time label — `labelOf()` prefers the runtime i18n bundle. */
  label: string;
  /** Whether a journey may write it (`file` is upload-only, never via a journey). */
  writable: boolean;
  maxLength?: number;
  /** lookup / multilookup: the ONLY valid write values. */
  options?: string[];
  /** record / multirecord: the target app (always) and its entity key (when inside this appgroup). */
  targetAppId?: string;
  targetEntity?: EntityKey;
  format?: 'currency';
  /** HTML autocomplete token derived from the field name (given-name, email, tel, …). */
  autoComplete?: string;
}

export interface EntityInfo {
  key: EntityKey;
  appId: string;
  label: string;
  /** PascalCase plural — `get<pascal>()` on the service. */
  pascal: string;
  /** The single-record suffix — `create<single>()` on the service. */
  single: string;
}

/** Input-form signals per entity: which data shape each field (pair) has.
 *  `range`  — two date fields that form a stay/period → AvailabilityRangePicker
 *  `choice` — a lookup with few options → ChoiceGroup pills instead of a select
 *  `record` — an applookup → EntitySelectStep with search, never a raw id field
 *  `stock`  — a quantity that has a stock/capacity counterpart → show it, warn on overshoot */
export type Shape =
  | { kind: 'range'; from: string; to: string }
  | { kind: 'choice'; field: string; count: number }
  | { kind: 'record'; field: string; targetEntity?: EntityKey }
  | { kind: 'stock'; field: string };

export const ENTITIES: Record<EntityKey, EntityInfo> = {
  "behandler": {
    "key": "behandler",
    "appId": "6aa95b6e0b2432073b6630bd",
    "label": "Behandler",
    "pascal": "Behandler",
    "single": "BehandlerEntry"
  },
  "patienten": {
    "key": "patienten",
    "appId": "6aa95b74c60e6bda746e344d",
    "label": "Patienten",
    "pascal": "Patienten",
    "single": "PatientenEntry"
  },
  "leistungen": {
    "key": "leistungen",
    "appId": "6aa95b75670b3294bd74ce30",
    "label": "Leistungen",
    "pascal": "Leistungen",
    "single": "LeistungenEntry"
  },
  "rezepte": {
    "key": "rezepte",
    "appId": "6aa95b75b88c875aa3d69835",
    "label": "Rezepte",
    "pascal": "Rezepte",
    "single": "RezepteEntry"
  },
  "termine": {
    "key": "termine",
    "appId": "6aa95b762f3c9b7126955cd6",
    "label": "Termine",
    "pascal": "Termine",
    "single": "TermineEntry"
  },
  "behandlungen": {
    "key": "behandlungen",
    "appId": "6aa95b77462f272481f9faa1",
    "label": "Behandlungen",
    "pascal": "Behandlungen",
    "single": "BehandlungenEntry"
  }
};

export const FIELD_RULES: Record<EntityKey, Record<string, FieldRule>> = {
  "behandler": {
    "vorname": {
      "key": "vorname",
      "fulltype": "string/text",
      "kind": "text",
      "required": true,
      "label": "Vorname",
      "writable": true,
      "maxLength": 4000,
      "autoComplete": "given-name"
    },
    "nachname": {
      "key": "nachname",
      "fulltype": "string/text",
      "kind": "text",
      "required": true,
      "label": "Nachname",
      "writable": true,
      "maxLength": 4000,
      "autoComplete": "family-name"
    },
    "kuerzel": {
      "key": "kuerzel",
      "fulltype": "string/text",
      "kind": "text",
      "required": true,
      "label": "Kürzel",
      "writable": true,
      "maxLength": 4000
    },
    "fachgebiete": {
      "key": "fachgebiete",
      "fulltype": "multiplelookup/checkbox",
      "kind": "multilookup",
      "required": false,
      "label": "Fachgebiete",
      "writable": true,
      "options": [
        "manuelle_therapie",
        "krankengymnastik",
        "lymphdrainage",
        "massage",
        "sportphysio"
      ]
    },
    "arbeitstage": {
      "key": "arbeitstage",
      "fulltype": "multiplelookup/checkbox",
      "kind": "multilookup",
      "required": false,
      "label": "Arbeitstage",
      "writable": true,
      "options": [
        "montag",
        "dienstag",
        "mittwoch",
        "donnerstag",
        "freitag"
      ]
    },
    "status": {
      "key": "status",
      "fulltype": "lookup/radio",
      "kind": "lookup",
      "required": true,
      "label": "Status",
      "writable": true,
      "options": [
        "aktiv",
        "urlaub",
        "krank"
      ]
    },
    "email": {
      "key": "email",
      "fulltype": "string/email",
      "kind": "email",
      "required": false,
      "label": "E-Mail",
      "writable": true,
      "autoComplete": "email"
    }
  },
  "patienten": {
    "vorname": {
      "key": "vorname",
      "fulltype": "string/text",
      "kind": "text",
      "required": true,
      "label": "Vorname",
      "writable": true,
      "maxLength": 4000,
      "autoComplete": "given-name"
    },
    "nachname": {
      "key": "nachname",
      "fulltype": "string/text",
      "kind": "text",
      "required": true,
      "label": "Nachname",
      "writable": true,
      "maxLength": 4000,
      "autoComplete": "family-name"
    },
    "geburtsdatum": {
      "key": "geburtsdatum",
      "fulltype": "date/date",
      "kind": "date",
      "required": true,
      "label": "Geburtsdatum",
      "writable": true,
      "autoComplete": "bday"
    },
    "telefon": {
      "key": "telefon",
      "fulltype": "string/tel",
      "kind": "tel",
      "required": false,
      "label": "Telefon",
      "writable": true,
      "autoComplete": "tel"
    },
    "email": {
      "key": "email",
      "fulltype": "string/email",
      "kind": "email",
      "required": false,
      "label": "E-Mail",
      "writable": true,
      "autoComplete": "email"
    },
    "strasse": {
      "key": "strasse",
      "fulltype": "string/text",
      "kind": "text",
      "required": false,
      "label": "Straße",
      "writable": true,
      "maxLength": 4000,
      "autoComplete": "address-line1"
    },
    "hausnummer": {
      "key": "hausnummer",
      "fulltype": "string/text",
      "kind": "text",
      "required": false,
      "label": "Hausnummer",
      "writable": true,
      "maxLength": 4000
    },
    "plz": {
      "key": "plz",
      "fulltype": "string/text",
      "kind": "text",
      "required": false,
      "label": "Postleitzahl",
      "writable": true,
      "maxLength": 4000,
      "autoComplete": "postal-code"
    },
    "ort": {
      "key": "ort",
      "fulltype": "string/text",
      "kind": "text",
      "required": false,
      "label": "Ort",
      "writable": true,
      "maxLength": 4000,
      "autoComplete": "address-level2"
    },
    "krankenkasse": {
      "key": "krankenkasse",
      "fulltype": "string/text",
      "kind": "text",
      "required": false,
      "label": "Krankenkasse",
      "writable": true,
      "maxLength": 4000
    },
    "versichertennummer": {
      "key": "versichertennummer",
      "fulltype": "string/text",
      "kind": "text",
      "required": false,
      "label": "Versichertennummer",
      "writable": true,
      "maxLength": 4000
    },
    "versicherungsart": {
      "key": "versicherungsart",
      "fulltype": "lookup/radio",
      "kind": "lookup",
      "required": true,
      "label": "Versicherungsart",
      "writable": true,
      "options": [
        "gesetzlich",
        "privat",
        "selbstzahler"
      ]
    },
    "hausarzt": {
      "key": "hausarzt",
      "fulltype": "string/text",
      "kind": "text",
      "required": false,
      "label": "Hausarzt",
      "writable": true,
      "maxLength": 4000
    },
    "notizen": {
      "key": "notizen",
      "fulltype": "string/textarea",
      "kind": "textarea",
      "required": false,
      "label": "Notizen (vertraulich)",
      "writable": true
    }
  },
  "leistungen": {
    "bezeichnung": {
      "key": "bezeichnung",
      "fulltype": "string/text",
      "kind": "text",
      "required": true,
      "label": "Bezeichnung",
      "writable": true,
      "maxLength": 4000
    },
    "heilmittelkuerzel": {
      "key": "heilmittelkuerzel",
      "fulltype": "string/text",
      "kind": "text",
      "required": true,
      "label": "Heilmittelkürzel",
      "writable": true,
      "maxLength": 4000
    },
    "dauer_minuten": {
      "key": "dauer_minuten",
      "fulltype": "number",
      "kind": "number",
      "required": true,
      "label": "Dauer (Minuten)",
      "writable": true
    },
    "preis_kasse": {
      "key": "preis_kasse",
      "fulltype": "number",
      "kind": "number",
      "required": false,
      "label": "Preis Kasse (€)",
      "writable": true,
      "format": "currency"
    },
    "preis_privat": {
      "key": "preis_privat",
      "fulltype": "number",
      "kind": "number",
      "required": false,
      "label": "Preis Privat (€)",
      "writable": true,
      "format": "currency"
    }
  },
  "rezepte": {
    "patient": {
      "key": "patient",
      "fulltype": "applookup/select",
      "kind": "record",
      "required": true,
      "label": "Patient",
      "writable": true,
      "targetAppId": "6aa95b74c60e6bda746e344d",
      "targetEntity": "patienten"
    },
    "ausstellungsdatum": {
      "key": "ausstellungsdatum",
      "fulltype": "date/date",
      "kind": "date",
      "required": true,
      "label": "Ausstellungsdatum",
      "writable": true
    },
    "arztpraxis": {
      "key": "arztpraxis",
      "fulltype": "string/text",
      "kind": "text",
      "required": true,
      "label": "Verordnende Arztpraxis",
      "writable": true,
      "maxLength": 4000
    },
    "diagnose": {
      "key": "diagnose",
      "fulltype": "string/textarea",
      "kind": "textarea",
      "required": false,
      "label": "Diagnose",
      "writable": true
    },
    "leistung": {
      "key": "leistung",
      "fulltype": "applookup/select",
      "kind": "record",
      "required": true,
      "label": "Leistung",
      "writable": true,
      "targetAppId": "6aa95b75670b3294bd74ce30",
      "targetEntity": "leistungen"
    },
    "anzahl_einheiten": {
      "key": "anzahl_einheiten",
      "fulltype": "number",
      "kind": "number",
      "required": true,
      "label": "Anzahl verordnete Einheiten",
      "writable": true
    },
    "frequenz_pro_woche": {
      "key": "frequenz_pro_woche",
      "fulltype": "number",
      "kind": "number",
      "required": false,
      "label": "Frequenz pro Woche",
      "writable": true
    },
    "gueltig_bis": {
      "key": "gueltig_bis",
      "fulltype": "date/date",
      "kind": "date",
      "required": false,
      "label": "Gültig bis",
      "writable": true
    },
    "status": {
      "key": "status",
      "fulltype": "lookup/select",
      "kind": "lookup",
      "required": true,
      "label": "Status",
      "writable": true,
      "options": [
        "offen",
        "in_behandlung",
        "abgeschlossen",
        "abgelaufen"
      ]
    }
  },
  "termine": {
    "patient": {
      "key": "patient",
      "fulltype": "applookup/select",
      "kind": "record",
      "required": true,
      "label": "Patient",
      "writable": true,
      "targetAppId": "6aa95b74c60e6bda746e344d",
      "targetEntity": "patienten"
    },
    "behandler": {
      "key": "behandler",
      "fulltype": "applookup/select",
      "kind": "record",
      "required": true,
      "label": "Behandler",
      "writable": true,
      "targetAppId": "6aa95b6e0b2432073b6630bd",
      "targetEntity": "behandler"
    },
    "rezept": {
      "key": "rezept",
      "fulltype": "applookup/select",
      "kind": "record",
      "required": false,
      "label": "Rezept (optional)",
      "writable": true,
      "targetAppId": "6aa95b75b88c875aa3d69835",
      "targetEntity": "rezepte"
    },
    "beginn": {
      "key": "beginn",
      "fulltype": "date/datetimeminute",
      "kind": "datetime",
      "required": true,
      "label": "Datum und Beginn",
      "writable": true
    },
    "ende": {
      "key": "ende",
      "fulltype": "date/datetimeminute",
      "kind": "datetime",
      "required": true,
      "label": "Ende",
      "writable": true
    },
    "raum": {
      "key": "raum",
      "fulltype": "lookup/select",
      "kind": "lookup",
      "required": true,
      "label": "Raum",
      "writable": true,
      "options": [
        "raum_1",
        "raum_2",
        "raum_3",
        "geraeteraum"
      ]
    },
    "status": {
      "key": "status",
      "fulltype": "lookup/select",
      "kind": "lookup",
      "required": true,
      "label": "Status",
      "writable": true,
      "options": [
        "geplant",
        "bestaetigt",
        "erschienen",
        "nicht_erschienen",
        "abgesagt"
      ]
    },
    "bemerkung": {
      "key": "bemerkung",
      "fulltype": "string/textarea",
      "kind": "textarea",
      "required": false,
      "label": "Bemerkung",
      "writable": true
    }
  },
  "behandlungen": {
    "termin": {
      "key": "termin",
      "fulltype": "applookup/select",
      "kind": "record",
      "required": true,
      "label": "Termin",
      "writable": true,
      "targetAppId": "6aa95b762f3c9b7126955cd6",
      "targetEntity": "termine"
    },
    "durchgefuehrte_leistung": {
      "key": "durchgefuehrte_leistung",
      "fulltype": "applookup/select",
      "kind": "record",
      "required": true,
      "label": "Durchgeführte Leistung",
      "writable": true,
      "targetAppId": "6aa95b75670b3294bd74ce30",
      "targetEntity": "leistungen"
    },
    "dauer_tatsaechlich": {
      "key": "dauer_tatsaechlich",
      "fulltype": "number",
      "kind": "number",
      "required": false,
      "label": "Tatsächliche Dauer (Minuten)",
      "writable": true
    },
    "befund": {
      "key": "befund",
      "fulltype": "string/textarea",
      "kind": "textarea",
      "required": false,
      "label": "Befund (vertraulich)",
      "writable": true
    },
    "massnahmen": {
      "key": "massnahmen",
      "fulltype": "string/textarea",
      "kind": "textarea",
      "required": false,
      "label": "Maßnahmen",
      "writable": true
    },
    "verlauf": {
      "key": "verlauf",
      "fulltype": "string/textarea",
      "kind": "textarea",
      "required": false,
      "label": "Verlauf",
      "writable": true
    },
    "naechste_schritte": {
      "key": "naechste_schritte",
      "fulltype": "string/textarea",
      "kind": "textarea",
      "required": false,
      "label": "Nächste Schritte",
      "writable": true
    }
  }
};

export const SHAPES: Record<EntityKey, Shape[]> = {
  "behandler": [
    {
      "kind": "choice",
      "field": "status",
      "count": 3
    }
  ],
  "patienten": [
    {
      "kind": "choice",
      "field": "versicherungsart",
      "count": 3
    }
  ],
  "leistungen": [],
  "rezepte": [
    {
      "kind": "choice",
      "field": "status",
      "count": 4
    },
    {
      "kind": "record",
      "field": "patient",
      "targetEntity": "patienten"
    },
    {
      "kind": "record",
      "field": "leistung",
      "targetEntity": "leistungen"
    }
  ],
  "termine": [
    {
      "kind": "range",
      "from": "beginn",
      "to": "ende"
    },
    {
      "kind": "choice",
      "field": "raum",
      "count": 4
    },
    {
      "kind": "choice",
      "field": "status",
      "count": 5
    },
    {
      "kind": "record",
      "field": "patient",
      "targetEntity": "patienten"
    },
    {
      "kind": "record",
      "field": "behandler",
      "targetEntity": "behandler"
    },
    {
      "kind": "record",
      "field": "rezept",
      "targetEntity": "rezepte"
    }
  ],
  "behandlungen": [
    {
      "kind": "record",
      "field": "termin",
      "targetEntity": "termine"
    },
    {
      "kind": "record",
      "field": "durchgefuehrte_leistung",
      "targetEntity": "leistungen"
    }
  ]
};

/** The fields a record of this entity is recognised by (a person: first and
 *  last name; else its title-like text field) — the same choice the dashboard's
 *  enrichment makes for `<key>Name`. `useRecordSearch` resolves an applookup to
 *  this name (`ctx.ref('gast')` in `toItem`). */
export const DISPLAY_FIELDS: Record<EntityKey, string[]> = {
  "behandler": [
    "vorname",
    "nachname"
  ],
  "patienten": [
    "vorname",
    "nachname"
  ],
  "leistungen": [
    "bezeichnung"
  ],
  "rezepte": [
    "arztpraxis"
  ],
  "termine": [
    "bemerkung"
  ],
  "behandlungen": [
    "befund"
  ]
};

/** The display name of a record: its display fields joined, else the first
 *  non-empty text value, else ''. */
export function displayNameOf(entity: EntityKey, fields: Record<string, unknown>): string {
  const parts = (DISPLAY_FIELDS[entity] ?? [])
    .map(k => fields[k])
    .filter((v): v is string => typeof v === 'string' && v.trim() !== '')
    .map(v => v.trim());
  if (parts.length > 0) return parts.join(' ');
  for (const [k, rule] of Object.entries(FIELD_RULES[entity] ?? {})) {
    if (rule.kind !== 'text' && rule.kind !== 'email') continue;
    const v = fields[k];
    if (typeof v === 'string' && v.trim() !== '') return v.trim();
  }
  return '';
}

export function ruleOf(entity: EntityKey, key: string): FieldRule | undefined {
  return FIELD_RULES[entity]?.[key];
}

/** The field label as the user sees it — runtime bundle first, generated label second. */
export function labelOf(entity: EntityKey, key: string): string {
  const fromBundle = fieldLabel(entity, key);
  if (fromBundle !== key) return fromBundle;
  return ruleOf(entity, key)?.label ?? key;
}

export function entityLabel(entity: EntityKey): string {
  const fromBundle = appLabel(entity);
  if (fromBundle !== entity) return fromBundle;
  return ENTITIES[entity]?.label ?? entity;
}

/** Lookup options with runtime labels — the only legitimate source of `{key,label}` pairs. */
export function optionsOf(entity: EntityKey, key: string): Array<{ key: string; label: string }> {
  const generated = (LOOKUP_OPTIONS as Record<string, Record<string, Array<{ key: string; label: string }>>>)[entity]?.[key];
  if (generated && generated.length) return generated.map(o => ({ key: o.key, label: o.label }));
  const keys = ruleOf(entity, key)?.options ?? [];
  return keys.map(k => ({ key: k, label: lookupLabel(entity, key, k) ?? k }));
}

export function isEmptyValue(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'object' && 'from' in (v as object) && 'to' in (v as object)) {
    const r = v as { from: unknown; to: unknown };
    return isEmptyValue(r.from) && isEmptyValue(r.to);
  }
  return false;
}
