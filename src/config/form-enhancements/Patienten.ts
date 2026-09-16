import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [{"row": ["vorname", "nachname"]}, "geburtsdatum", "telefon", "email", {"row": ["strasse", "hausnummer"], "cols": "2fr 1fr"}, {"row": ["plz", "ort"], "cols": "1fr 2fr"}, "krankenkasse", "versichertennummer", "versicherungsart", "hausarzt", "notizen"],
  defaults: {
    'versicherungsart': { kind: 'lookup', key: 'gesetzlich', label: 'Gesetzlich' },
  },
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};

export const computedApplookupRefs: Record<string, { lookupKey: string }[]> = {};
