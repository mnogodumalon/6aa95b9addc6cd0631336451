import type { Behandlungen, Rezepte, Termine } from './app';

export type EnrichedRezepte = Rezepte & {
  patientName: string;
  leistungName: string;
};

export type EnrichedTermine = Termine & {
  patientName: string;
  behandlerName: string;
  rezeptName: string;
};

export type EnrichedBehandlungen = Behandlungen & {
  terminName: string;
  durchgefuehrte_leistungName: string;
};
