import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: ["bezeichnung", "heilmittelkuerzel", "dauer_minuten", "preis_kasse", "preis_privat"],
  defaults: {
    'dauer_minuten': { kind: 'literal', value: 30 },
    'preis_kasse': { kind: 'literal', value: 0 },
    'preis_privat': { kind: 'literal', value: 0 },
  },
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};

export const computedApplookupRefs: Record<string, { lookupKey: string }[]> = {};
