import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: ["termin", "durchgefuehrte_leistung", "dauer_tatsaechlich", "befund", "massnahmen", "verlauf", "naechste_schritte"],
  defaults: {},
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};

export const computedApplookupRefs: Record<string, { lookupKey: string }[]> = {};
