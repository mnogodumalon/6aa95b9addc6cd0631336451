import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: ["patient", "ausstellungsdatum", "arztpraxis", "diagnose", "leistung", "anzahl_einheiten", "frequenz_pro_woche", "gueltig_bis", "status"],
  defaults: {
    'ausstellungsdatum': { kind: 'today' },
    'anzahl_einheiten': { kind: 'literal', value: 1 },
    'frequenz_pro_woche': { kind: 'literal', value: 1 },
    'status': { kind: 'lookup', key: 'offen', label: 'Offen' },
  },
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};

export const computedApplookupRefs: Record<string, { lookupKey: string }[]> = {};
