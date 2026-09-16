import { lookupLabel } from '@/i18n';

// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
/** A raw record URL (applookup reference). NEVER render this directly
 *  in JSX — it is a URL, not a display value. Show the enriched `*Name`
 *  field or resolve it via the entity map instead. Assignable to/from
 *  string everywhere; the `& {}` keeps the alias NAME visible in tsc
 *  error messages (a plain primitive alias gets normalized away). */
export type RecordUrl = string & {};
export type GeoLocation = { lat: number; long: number; info?: string };

export type AttachmentType = 'file' | 'note' | 'url' | 'json';
export interface Attachment {
  id: string;
  type: AttachmentType;
  label: string | null;
  value: string | null;
  active: boolean;
  createdat?: string | null;
  updatedat?: string | null;
}

export interface AttachmentInput {
  type: AttachmentType;
  label?: string;
  value: string;
  active?: boolean;
}

export interface Behandler {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    vorname?: string;
    nachname?: string;
    kuerzel?: string;
    fachgebiete?: LookupValue[];
    arbeitstage?: LookupValue[];
    status?: LookupValue;
    email?: string;
  };
}

export interface Patienten {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    vorname?: string;
    nachname?: string;
    geburtsdatum?: string; // Format: YYYY-MM-DD oder ISO String
    telefon?: string;
    email?: string;
    strasse?: string;
    hausnummer?: string;
    plz?: string;
    ort?: string;
    krankenkasse?: string;
    versichertennummer?: string;
    versicherungsart?: LookupValue;
    hausarzt?: string;
    notizen?: string;
  };
}

export interface Leistungen {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    bezeichnung?: string;
    heilmittelkuerzel?: string;
    dauer_minuten?: number;
    preis_kasse?: number;
    preis_privat?: number;
  };
}

export interface Rezepte {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    patient?: RecordUrl; // applookup -> URL zu 'Patienten' Record
    ausstellungsdatum?: string; // Format: YYYY-MM-DD oder ISO String
    arztpraxis?: string;
    diagnose?: string;
    leistung?: RecordUrl; // applookup -> URL zu 'Leistungen' Record
    anzahl_einheiten?: number;
    frequenz_pro_woche?: number;
    gueltig_bis?: string; // Format: YYYY-MM-DD oder ISO String
    status?: LookupValue;
  };
}

export interface Termine {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    patient?: RecordUrl; // applookup -> URL zu 'Patienten' Record
    behandler?: RecordUrl; // applookup -> URL zu 'Behandler' Record
    rezept?: RecordUrl; // applookup -> URL zu 'Rezepte' Record
    beginn?: string; // Format: YYYY-MM-DD oder ISO String
    ende?: string; // Format: YYYY-MM-DD oder ISO String
    raum?: LookupValue;
    status?: LookupValue;
    bemerkung?: string;
  };
}

export interface Behandlungen {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    termin?: RecordUrl; // applookup -> URL zu 'Termine' Record
    durchgefuehrte_leistung?: RecordUrl; // applookup -> URL zu 'Leistungen' Record
    dauer_tatsaechlich?: number;
    befund?: string;
    massnahmen?: string;
    verlauf?: string;
    naechste_schritte?: string;
  };
}

export const APP_IDS = {
  BEHANDLER: '6aa95b6e0b2432073b6630bd',
  PATIENTEN: '6aa95b74c60e6bda746e344d',
  LEISTUNGEN: '6aa95b75670b3294bd74ce30',
  REZEPTE: '6aa95b75b88c875aa3d69835',
  TERMINE: '6aa95b762f3c9b7126955cd6',
  BEHANDLUNGEN: '6aa95b77462f272481f9faa1',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {
  'behandler': {
    fachgebiete: [{ key: "manuelle_therapie", get label() { return lookupLabel('behandler', 'fachgebiete', "manuelle_therapie") ?? "Manuelle Therapie"; } }, { key: "krankengymnastik", get label() { return lookupLabel('behandler', 'fachgebiete', "krankengymnastik") ?? "Krankengymnastik"; } }, { key: "lymphdrainage", get label() { return lookupLabel('behandler', 'fachgebiete', "lymphdrainage") ?? "Lymphdrainage"; } }, { key: "massage", get label() { return lookupLabel('behandler', 'fachgebiete', "massage") ?? "Massage"; } }, { key: "sportphysio", get label() { return lookupLabel('behandler', 'fachgebiete', "sportphysio") ?? "Sportphysio"; } }],
    arbeitstage: [{ key: "montag", get label() { return lookupLabel('behandler', 'arbeitstage', "montag") ?? "Montag"; } }, { key: "dienstag", get label() { return lookupLabel('behandler', 'arbeitstage', "dienstag") ?? "Dienstag"; } }, { key: "mittwoch", get label() { return lookupLabel('behandler', 'arbeitstage', "mittwoch") ?? "Mittwoch"; } }, { key: "donnerstag", get label() { return lookupLabel('behandler', 'arbeitstage', "donnerstag") ?? "Donnerstag"; } }, { key: "freitag", get label() { return lookupLabel('behandler', 'arbeitstage', "freitag") ?? "Freitag"; } }],
    status: [{ key: "aktiv", get label() { return lookupLabel('behandler', 'status', "aktiv") ?? "Aktiv"; } }, { key: "urlaub", get label() { return lookupLabel('behandler', 'status', "urlaub") ?? "Urlaub"; } }, { key: "krank", get label() { return lookupLabel('behandler', 'status', "krank") ?? "Krank"; } }],
  },
  'patienten': {
    versicherungsart: [{ key: "gesetzlich", get label() { return lookupLabel('patienten', 'versicherungsart', "gesetzlich") ?? "Gesetzlich"; } }, { key: "privat", get label() { return lookupLabel('patienten', 'versicherungsart', "privat") ?? "Privat"; } }, { key: "selbstzahler", get label() { return lookupLabel('patienten', 'versicherungsart', "selbstzahler") ?? "Selbstzahler"; } }],
  },
  'rezepte': {
    status: [{ key: "offen", get label() { return lookupLabel('rezepte', 'status', "offen") ?? "Offen"; } }, { key: "in_behandlung", get label() { return lookupLabel('rezepte', 'status', "in_behandlung") ?? "In Behandlung"; } }, { key: "abgeschlossen", get label() { return lookupLabel('rezepte', 'status', "abgeschlossen") ?? "Abgeschlossen"; } }, { key: "abgelaufen", get label() { return lookupLabel('rezepte', 'status', "abgelaufen") ?? "Abgelaufen"; } }],
  },
  'termine': {
    raum: [{ key: "raum_1", get label() { return lookupLabel('termine', 'raum', "raum_1") ?? "Raum 1"; } }, { key: "raum_2", get label() { return lookupLabel('termine', 'raum', "raum_2") ?? "Raum 2"; } }, { key: "raum_3", get label() { return lookupLabel('termine', 'raum', "raum_3") ?? "Raum 3"; } }, { key: "geraeteraum", get label() { return lookupLabel('termine', 'raum', "geraeteraum") ?? "Geräteraum"; } }],
    status: [{ key: "geplant", get label() { return lookupLabel('termine', 'status', "geplant") ?? "Geplant"; } }, { key: "bestaetigt", get label() { return lookupLabel('termine', 'status', "bestaetigt") ?? "Bestätigt"; } }, { key: "erschienen", get label() { return lookupLabel('termine', 'status', "erschienen") ?? "Erschienen"; } }, { key: "nicht_erschienen", get label() { return lookupLabel('termine', 'status', "nicht_erschienen") ?? "Nicht erschienen"; } }, { key: "abgesagt", get label() { return lookupLabel('termine', 'status', "abgesagt") ?? "Abgesagt"; } }],
  },
};

// Optimistic LookupValue writes: never re-type a label — resolve the schema
// option instead (its label is a locale-aware getter; falls back to the key).
// WRONG: status: { key: 'offen', label: 'Offen' }   (frozen in one language)
// RIGHT: status: lookupOption('<appKey>', 'status', 'offen')
export function lookupOption(app: string, field: string, key: string): LookupValue {
  return LOOKUP_OPTIONS[app]?.[field]?.find(o => o.key === key) ?? { key, label: key };
}

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'behandler': {
    'vorname': 'string/text',
    'nachname': 'string/text',
    'kuerzel': 'string/text',
    'fachgebiete': 'multiplelookup/checkbox',
    'arbeitstage': 'multiplelookup/checkbox',
    'status': 'lookup/radio',
    'email': 'string/email',
  },
  'patienten': {
    'vorname': 'string/text',
    'nachname': 'string/text',
    'geburtsdatum': 'date/date',
    'telefon': 'string/tel',
    'email': 'string/email',
    'strasse': 'string/text',
    'hausnummer': 'string/text',
    'plz': 'string/text',
    'ort': 'string/text',
    'krankenkasse': 'string/text',
    'versichertennummer': 'string/text',
    'versicherungsart': 'lookup/radio',
    'hausarzt': 'string/text',
    'notizen': 'string/textarea',
  },
  'leistungen': {
    'bezeichnung': 'string/text',
    'heilmittelkuerzel': 'string/text',
    'dauer_minuten': 'number',
    'preis_kasse': 'number',
    'preis_privat': 'number',
  },
  'rezepte': {
    'patient': 'applookup/select',
    'ausstellungsdatum': 'date/date',
    'arztpraxis': 'string/text',
    'diagnose': 'string/textarea',
    'leistung': 'applookup/select',
    'anzahl_einheiten': 'number',
    'frequenz_pro_woche': 'number',
    'gueltig_bis': 'date/date',
    'status': 'lookup/select',
  },
  'termine': {
    'patient': 'applookup/select',
    'behandler': 'applookup/select',
    'rezept': 'applookup/select',
    'beginn': 'date/datetimeminute',
    'ende': 'date/datetimeminute',
    'raum': 'lookup/select',
    'status': 'lookup/select',
    'bemerkung': 'string/textarea',
  },
  'behandlungen': {
    'termin': 'applookup/select',
    'durchgefuehrte_leistung': 'applookup/select',
    'dauer_tatsaechlich': 'number',
    'befund': 'string/textarea',
    'massnahmen': 'string/textarea',
    'verlauf': 'string/textarea',
    'naechste_schritte': 'string/textarea',
  },
};

export const HUB_TOPOLOGY: Record<string, { field: string; entity: string }[]> = {
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateBehandler = StripLookup<Behandler['fields']>;
export type CreatePatienten = StripLookup<Patienten['fields']>;
export type CreateLeistungen = StripLookup<Leistungen['fields']>;
export type CreateRezepte = StripLookup<Rezepte['fields']>;
export type CreateTermine = StripLookup<Termine['fields']>;
export type CreateBehandlungen = StripLookup<Behandlungen['fields']>;