import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: ["patient", "behandler", "rezept", {"row": ["beginn", "ende"]}, "raum", "status", "bemerkung"],
  defaults: {
    'beginn': { kind: 'today', withTime: true },
    'ende': { kind: 'todayOffset', days: 0, withTime: true },
    'status': { kind: 'lookup', key: 'geplant', label: 'Geplant' },
  },
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};

export const computedApplookupRefs: Record<string, { lookupKey: string }[]> = {};
