/**
 * EntityCrud — pre-generated CRUD + overlay plumbing for the dashboard.
 * Compose it; NEVER re-roll dialog state, submit handlers, an overlay stack
 * or a RecordOverlayHost in the page — this file owns all of it.
 *
 * API at a glance:
 *   const data = useDashboardData();
 *   const crud = useEntityCrud(data, {
 *     // optional — the ONE semantic slot on the overlay: the record's next
 *     // workflow step. Return undefined for types without one.
 *     footer: (top) => top.type === 'behandler'
 *       ? { label: …, onClick: () => … }
 *       : undefined,
 *   });
 *
 *   `top.type` is the SAME camelCase key as `crud.<entity>` — one spelling
 *   per entity, everywhere in this API.
 *   …
 *   crud.behandler.openCreate({ …defaults })   // create dialog, prefilled — defaults are
 *                                       // shape-tolerant: bare lookup keys / record ids are fine
 *   crud.behandler.openEdit(record)            // edit dialog (recordId + defaults wired)
 *   crud.behandler.openDetail(record)          // record overlay — pass the RAW record,
 *                                       // enrichment is resolved inside
 *   crud.overlay                         // RecordOverlayStack<OverlayItem> for drills:
 *                                       // push / pop / replace / close
 *   crud.enriched.behandler              // the display-ready array for EVERY entity —
 *                                       // Enriched* where relations exist, the raw array
 *                                       // otherwise. Reuse these; never call enrich*()
 *                                       // in the page, and never guess which entity has
 *                                       // one: they all do.
 *   {crud.surfaces}                      // render ONCE at the end of the page JSX:
 *                                       // all entity dialogs + the overlay host
 *
 * Built in (do NOT re-implement): optimistic update + Rückgängig counter-write
 * on edit, fetchAll-on-error, edit-from-overlay, and per-entity overlay bodies
 * (RecordHeader + <{Entity}Details> with every relation reachable and the
 * contextual "+" prefilled; list-field back-references additionally get a
 * "choose existing" picker that links an EXISTING record — built in, do not
 * re-roll). Drag writes (onEventDrop/onCardMove) stay YOURS:
 * optimistic setter first, PATCH in background, undoToast with counter-write.
 *
 * Overlay content per entity (the host renders these — you never compose
 * Details blocks yourself):
 *   behandler: vorname, nachname, kuerzel, fachgebiete, arbeitstage, status, email  ·  ← termine (list + contextual +)
 *   patienten: vorname, nachname, geburtsdatum, telefon, email, strasse, hausnummer, plz, …  ·  ← rezepte (list + contextual +) · ← termine (list + contextual +)
 *   leistungen: bezeichnung, heilmittelkuerzel, dauer_minuten, preis_kasse, preis_privat  ·  ← rezepte (list + contextual +) · ← behandlungen (list + contextual +)
 *   rezepte: patient, ausstellungsdatum, arztpraxis, diagnose, leistung, anzahl_einheiten, frequenz_pro_woche, gueltig_bis, …  ·  → patienten · → leistungen · ← termine (list + contextual +)
 *   termine: patient, behandler, rezept, beginn, ende, raum, status, bemerkung  ·  → patienten · → behandler · → rezepte · ← behandlungen (list + contextual +)
 *   behandlungen: termin, durchgefuehrte_leistung, dauer_tatsaechlich, befund, massnahmen, verlauf, naechste_schritte  ·  → termine · → leistungen
 */
import { useState, useMemo, type ReactNode } from 'react';
import type { Behandler, Patienten, Leistungen, Rezepte, Termine, Behandlungen } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { enrichRezepte, enrichTermine, enrichBehandlungen } from '@/lib/enrich';
import type { EnrichedRezepte, EnrichedTermine, EnrichedBehandlungen } from '@/types/enriched';
import { useDashboardData } from '@/hooks/useDashboardData';
import {
  useRecordOverlayStack, RecordOverlayHost, RecordHeader,
  type RecordOverlayStack,
} from '@/components/widgets/RecordView';
import { BehandlerDialog, type BehandlerDialogDefaults } from '@/components/dialogs/BehandlerDialog';
import { BehandlerDetails } from '@/components/details/BehandlerDetails';
import { PatientenDialog, type PatientenDialogDefaults } from '@/components/dialogs/PatientenDialog';
import { PatientenDetails } from '@/components/details/PatientenDetails';
import { LeistungenDialog, type LeistungenDialogDefaults } from '@/components/dialogs/LeistungenDialog';
import { LeistungenDetails } from '@/components/details/LeistungenDetails';
import { RezepteDialog, type RezepteDialogDefaults } from '@/components/dialogs/RezepteDialog';
import { RezepteDetails } from '@/components/details/RezepteDetails';
import { TermineDialog, type TermineDialogDefaults } from '@/components/dialogs/TermineDialog';
import { TermineDetails } from '@/components/details/TermineDetails';
import { BehandlungenDialog, type BehandlungenDialogDefaults } from '@/components/dialogs/BehandlungenDialog';
import { BehandlungenDetails } from '@/components/details/BehandlungenDetails';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { t, appLabel } from '@/i18n';
import { undoToast } from '@/lib/polish';
import { formatDate } from '@/lib/formatters';

// The overlay union — one branch per entity, `record` typed the way the data
// flows: Enriched* where enrichment exists, the raw record type otherwise.
// The host resolves enrichment itself; pages pass raw records everywhere.
export type OverlayItem =
  | { type: 'behandler'; record: Behandler }
  | { type: 'patienten'; record: Patienten }
  | { type: 'leistungen'; record: Leistungen }
  | { type: 'rezepte'; record: EnrichedRezepte }
  | { type: 'termine'; record: EnrichedTermine }
  | { type: 'behandlungen'; record: EnrichedBehandlungen };

/** The useDashboardData() return — pass it in, never re-fetch inside. */
export type EntityCrudData = ReturnType<typeof useDashboardData>;

export interface EntityCrudOptions {
  /** Per-type overlay footer — the record's next workflow step. */
  footer?: (top: OverlayItem) => ReactNode | { label: ReactNode; onClick: () => void } | undefined;
  placement?: 'side' | 'center';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export interface EntityCrudApi<TRecord, TDefaults> {
  /** Open the create dialog, optionally prefilled (shape-tolerant defaults). */
  openCreate: (defaults?: TDefaults) => void;
  /** Open the edit dialog for a record (recordId + defaults are wired). */
  openEdit: (record: TRecord) => void;
  /** Open the record overlay (raw record is fine — enrichment resolved inside). */
  openDetail: (record: TRecord) => void;
}

export interface EntityCrud {
  /** The overlay stack for drills: push / pop / replace / close. */
  overlay: RecordOverlayStack<OverlayItem>;
  /** Render ONCE at the end of the page JSX — all dialogs + the overlay host. */
  surfaces: ReactNode;
  behandler: EntityCrudApi<Behandler, BehandlerDialogDefaults>;
  patienten: EntityCrudApi<Patienten, PatientenDialogDefaults>;
  leistungen: EntityCrudApi<Leistungen, LeistungenDialogDefaults>;
  rezepte: EntityCrudApi<Rezepte, RezepteDialogDefaults>;
  termine: EntityCrudApi<Termine, TermineDialogDefaults>;
  behandlungen: EntityCrudApi<Behandlungen, BehandlungenDialogDefaults>;
  /** The display-ready array per entity: Enriched* where an enrich function
   *  exists, the raw array otherwise. One key per entity so no page has to
   *  know which is which. Reuse these; never re-enrich in the page. */
  enriched: { behandler: Behandler[]; patienten: Patienten[]; leistungen: Leistungen[]; rezepte: EnrichedRezepte[]; termine: EnrichedTermine[]; behandlungen: EnrichedBehandlungen[] };
}

export function useEntityCrud(data: EntityCrudData, options?: EntityCrudOptions): EntityCrud {
  const overlay = useRecordOverlayStack<OverlayItem>();
  const [behandlerDialog, setBehandlerDialog] = useState<{ defaults?: BehandlerDialogDefaults; editing?: Behandler } | null>(null);
  const [patientenDialog, setPatientenDialog] = useState<{ defaults?: PatientenDialogDefaults; editing?: Patienten } | null>(null);
  const [leistungenDialog, setLeistungenDialog] = useState<{ defaults?: LeistungenDialogDefaults; editing?: Leistungen } | null>(null);
  const [rezepteDialog, setRezepteDialog] = useState<{ defaults?: RezepteDialogDefaults; editing?: Rezepte } | null>(null);
  const [termineDialog, setTermineDialog] = useState<{ defaults?: TermineDialogDefaults; editing?: Termine } | null>(null);
  const [behandlungenDialog, setBehandlungenDialog] = useState<{ defaults?: BehandlungenDialogDefaults; editing?: Behandlungen } | null>(null);
  const enrichedRezepte = useMemo(() => enrichRezepte(data.rezepte, { patientenMap: data.patientenMap, leistungenMap: data.leistungenMap }), [data.rezepte, data.patientenMap, data.leistungenMap]);
  const enrichedTermine = useMemo(() => enrichTermine(data.termine, { patientenMap: data.patientenMap, behandlerMap: data.behandlerMap, rezepteMap: data.rezepteMap }), [data.termine, data.patientenMap, data.behandlerMap, data.rezepteMap]);
  const enrichedBehandlungen = useMemo(() => enrichBehandlungen(data.behandlungen, { termineMap: data.termineMap, leistungenMap: data.leistungenMap }), [data.behandlungen, data.termineMap, data.leistungenMap]);

  function detailBehandler(record: Behandler, push = false) {
    const item: OverlayItem = { type: 'behandler', record };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitBehandler(fields: Behandler['fields']) {
    const editing = behandlerDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setBehandler(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateBehandlerEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('behandler')} — ${t('crud_updated')}`, async () => {
        data.setBehandler(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateBehandlerEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createBehandlerEntry(fields);
      undoToast(`${appLabel('behandler')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  function detailPatienten(record: Patienten, push = false) {
    const item: OverlayItem = { type: 'patienten', record };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitPatienten(fields: Patienten['fields']) {
    const editing = patientenDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setPatienten(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updatePatientenEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('patienten')} — ${t('crud_updated')}`, async () => {
        data.setPatienten(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updatePatientenEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createPatientenEntry(fields);
      undoToast(`${appLabel('patienten')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  function detailLeistungen(record: Leistungen, push = false) {
    const item: OverlayItem = { type: 'leistungen', record };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitLeistungen(fields: Leistungen['fields']) {
    const editing = leistungenDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setLeistungen(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateLeistungenEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('leistungen')} — ${t('crud_updated')}`, async () => {
        data.setLeistungen(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateLeistungenEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createLeistungenEntry(fields);
      undoToast(`${appLabel('leistungen')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  function detailRezepte(record: Rezepte, push = false) {
    const rec = enrichedRezepte.find(r => r.record_id === record.record_id);
    if (!rec) return;
    const item: OverlayItem = { type: 'rezepte', record: rec };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitRezepte(fields: Rezepte['fields']) {
    const editing = rezepteDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setRezepte(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateRezepteEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('rezepte')} — ${t('crud_updated')}`, async () => {
        data.setRezepte(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateRezepteEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createRezepteEntry(fields);
      undoToast(`${appLabel('rezepte')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  function detailTermine(record: Termine, push = false) {
    const rec = enrichedTermine.find(r => r.record_id === record.record_id);
    if (!rec) return;
    const item: OverlayItem = { type: 'termine', record: rec };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitTermine(fields: Termine['fields']) {
    const editing = termineDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setTermine(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateTermineEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('termine')} — ${t('crud_updated')}`, async () => {
        data.setTermine(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateTermineEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createTermineEntry(fields);
      undoToast(`${appLabel('termine')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  function detailBehandlungen(record: Behandlungen, push = false) {
    const rec = enrichedBehandlungen.find(r => r.record_id === record.record_id);
    if (!rec) return;
    const item: OverlayItem = { type: 'behandlungen', record: rec };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitBehandlungen(fields: Behandlungen['fields']) {
    const editing = behandlungenDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setBehandlungen(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateBehandlungenEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('behandlungen')} — ${t('crud_updated')}`, async () => {
        data.setBehandlungen(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateBehandlungenEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createBehandlungenEntry(fields);
      undoToast(`${appLabel('behandlungen')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  const surfaces = (
    <>
      <BehandlerDialog
        open={behandlerDialog !== null}
        onClose={() => setBehandlerDialog(null)}
        onSubmit={submitBehandler}
        defaultValues={behandlerDialog?.defaults}
        recordId={behandlerDialog?.editing?.record_id}
        enablePhotoScan={AI_PHOTO_SCAN['Behandler']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Behandler']}
      />
      <PatientenDialog
        open={patientenDialog !== null}
        onClose={() => setPatientenDialog(null)}
        onSubmit={submitPatienten}
        defaultValues={patientenDialog?.defaults}
        recordId={patientenDialog?.editing?.record_id}
        enablePhotoScan={AI_PHOTO_SCAN['Patienten']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Patienten']}
      />
      <LeistungenDialog
        open={leistungenDialog !== null}
        onClose={() => setLeistungenDialog(null)}
        onSubmit={submitLeistungen}
        defaultValues={leistungenDialog?.defaults}
        recordId={leistungenDialog?.editing?.record_id}
        enablePhotoScan={AI_PHOTO_SCAN['Leistungen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Leistungen']}
      />
      <RezepteDialog
        open={rezepteDialog !== null}
        onClose={() => setRezepteDialog(null)}
        onSubmit={submitRezepte}
        defaultValues={rezepteDialog?.defaults}
        recordId={rezepteDialog?.editing?.record_id}
        patientenList={data.patienten}
        leistungenList={data.leistungen}
        enablePhotoScan={AI_PHOTO_SCAN['Rezepte']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Rezepte']}
      />
      <TermineDialog
        open={termineDialog !== null}
        onClose={() => setTermineDialog(null)}
        onSubmit={submitTermine}
        defaultValues={termineDialog?.defaults}
        recordId={termineDialog?.editing?.record_id}
        patientenList={data.patienten}
        behandlerList={data.behandler}
        rezepteList={data.rezepte}
        enablePhotoScan={AI_PHOTO_SCAN['Termine']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Termine']}
      />
      <BehandlungenDialog
        open={behandlungenDialog !== null}
        onClose={() => setBehandlungenDialog(null)}
        onSubmit={submitBehandlungen}
        defaultValues={behandlungenDialog?.defaults}
        recordId={behandlungenDialog?.editing?.record_id}
        termineList={data.termine}
        leistungenList={data.leistungen}
        enablePhotoScan={AI_PHOTO_SCAN['Behandlungen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Behandlungen']}
      />
      <RecordOverlayHost
        overlay={overlay}
        placement={options?.placement}
        size={options?.size}
        footer={options?.footer}
        render={(top) => {
          if (top.type === 'behandler') {
            return (
              <>
                <RecordHeader title={top.record.fields.vorname ?? appLabel('behandler')} subtitle={undefined} />
                <BehandlerDetails
                  record={top.record}
                  termineList={data.termine}
                  onOpenTermine={(r) => detailTermine(r, true)}
                  onAddTermine={() => setTermineDialog({ defaults: { behandler: createRecordUrl(APP_IDS.BEHANDLER, top.record.record_id) } })}
                />
              </>
            );
          }
          if (top.type === 'patienten') {
            return (
              <>
                <RecordHeader title={top.record.fields.vorname ?? appLabel('patienten')} subtitle={top.record.fields.geburtsdatum ? formatDate(top.record.fields.geburtsdatum) : undefined} />
                <PatientenDetails
                  record={top.record}
                  rezepteList={data.rezepte}
                  onOpenRezepte={(r) => detailRezepte(r, true)}
                  onAddRezepte={() => setRezepteDialog({ defaults: { patient: createRecordUrl(APP_IDS.PATIENTEN, top.record.record_id) } })}
                  termineList={data.termine}
                  onOpenTermine={(r) => detailTermine(r, true)}
                  onAddTermine={() => setTermineDialog({ defaults: { patient: createRecordUrl(APP_IDS.PATIENTEN, top.record.record_id) } })}
                />
              </>
            );
          }
          if (top.type === 'leistungen') {
            return (
              <>
                <RecordHeader title={top.record.fields.bezeichnung ?? appLabel('leistungen')} subtitle={undefined} />
                <LeistungenDetails
                  record={top.record}
                  rezepteList={data.rezepte}
                  onOpenRezepte={(r) => detailRezepte(r, true)}
                  onAddRezepte={() => setRezepteDialog({ defaults: { leistung: createRecordUrl(APP_IDS.LEISTUNGEN, top.record.record_id) } })}
                  behandlungenList={data.behandlungen}
                  onOpenBehandlungen={(r) => detailBehandlungen(r, true)}
                  onAddBehandlungen={() => setBehandlungenDialog({ defaults: { durchgefuehrte_leistung: createRecordUrl(APP_IDS.LEISTUNGEN, top.record.record_id) } })}
                />
              </>
            );
          }
          if (top.type === 'rezepte') {
            return (
              <>
                <RecordHeader title={top.record.fields.arztpraxis ?? appLabel('rezepte')} subtitle={top.record.fields.ausstellungsdatum ? formatDate(top.record.fields.ausstellungsdatum) : undefined} />
                <RezepteDetails
                  record={top.record}
                  patientenList={data.patienten}
                  onOpenPatienten={(r) => detailPatienten(r, true)}
                  leistungenList={data.leistungen}
                  onOpenLeistungen={(r) => detailLeistungen(r, true)}
                  termineList={data.termine}
                  onOpenTermine={(r) => detailTermine(r, true)}
                  onAddTermine={() => setTermineDialog({ defaults: { rezept: createRecordUrl(APP_IDS.REZEPTE, top.record.record_id) } })}
                />
              </>
            );
          }
          if (top.type === 'termine') {
            return (
              <>
                <RecordHeader title={appLabel('termine')} subtitle={top.record.fields.beginn ? formatDate(top.record.fields.beginn) : undefined} />
                <TermineDetails
                  record={top.record}
                  patientenList={data.patienten}
                  onOpenPatienten={(r) => detailPatienten(r, true)}
                  behandlerList={data.behandler}
                  onOpenBehandler={(r) => detailBehandler(r, true)}
                  rezepteList={data.rezepte}
                  onOpenRezepte={(r) => detailRezepte(r, true)}
                  behandlungenList={data.behandlungen}
                  onOpenBehandlungen={(r) => detailBehandlungen(r, true)}
                  onAddBehandlungen={() => setBehandlungenDialog({ defaults: { termin: createRecordUrl(APP_IDS.TERMINE, top.record.record_id) } })}
                />
              </>
            );
          }
          if (top.type === 'behandlungen') {
            return (
              <>
                <RecordHeader title={appLabel('behandlungen')} subtitle={undefined} />
                <BehandlungenDetails
                  record={top.record}
                  termineList={data.termine}
                  onOpenTermine={(r) => detailTermine(r, true)}
                  leistungenList={data.leistungen}
                  onOpenLeistungen={(r) => detailLeistungen(r, true)}
                />
              </>
            );
          }
          return null;
        }}
        onEdit={(top) => {
          overlay.close();
          if (top.type === 'behandler') setBehandlerDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'patienten') setPatientenDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'leistungen') setLeistungenDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'rezepte') setRezepteDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'termine') setTermineDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'behandlungen') setBehandlungenDialog({ editing: top.record, defaults: top.record.fields });
        }}
      />
    </>
  );

  return {
    overlay,
    surfaces,
    behandler: {
      openCreate: (defaults?: BehandlerDialogDefaults) => setBehandlerDialog({ defaults }),
      openEdit: (record: Behandler) => setBehandlerDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: Behandler) => detailBehandler(record, false),
    },
    patienten: {
      openCreate: (defaults?: PatientenDialogDefaults) => setPatientenDialog({ defaults }),
      openEdit: (record: Patienten) => setPatientenDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: Patienten) => detailPatienten(record, false),
    },
    leistungen: {
      openCreate: (defaults?: LeistungenDialogDefaults) => setLeistungenDialog({ defaults }),
      openEdit: (record: Leistungen) => setLeistungenDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: Leistungen) => detailLeistungen(record, false),
    },
    rezepte: {
      openCreate: (defaults?: RezepteDialogDefaults) => setRezepteDialog({ defaults }),
      openEdit: (record: Rezepte) => setRezepteDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: Rezepte) => detailRezepte(record, false),
    },
    termine: {
      openCreate: (defaults?: TermineDialogDefaults) => setTermineDialog({ defaults }),
      openEdit: (record: Termine) => setTermineDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: Termine) => detailTermine(record, false),
    },
    behandlungen: {
      openCreate: (defaults?: BehandlungenDialogDefaults) => setBehandlungenDialog({ defaults }),
      openEdit: (record: Behandlungen) => setBehandlungenDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: Behandlungen) => detailBehandlungen(record, false),
    },
    enriched: { behandler: data.behandler, patienten: data.patienten, leistungen: data.leistungen, rezepte: enrichedRezepte, termine: enrichedTermine, behandlungen: enrichedBehandlungen },
  };
}
