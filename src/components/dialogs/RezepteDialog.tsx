/**
 * RezepteDialog — pre-generated create/edit dialog for Rezepte.
 *
 * Props: open, onClose, onSubmit(fields) => Promise<void>, defaultValues?,
 * recordId? (pass when EDITING — enables the attachments section),
 * patientenList (full hook array — resolves the Patienten applookup),
 * leistungenList (full hook array — resolves the Leistungen applookup),
 * enablePhotoScan?, enablePhotoLocation?.
 *
 * defaultValues is SHAPE-TOLERANT and its prop type is the EXPORTED
 * RezepteDialogDefaults — NOT the entity field type: lookup fields accept
 * the bare KEY string (or LookupValue), applookup fields the bare record id
 * (or record URL); the dialog normalizes. Type prefill STATE with the export:
 *  ❌ useState<Partial<Rezepte['fields']>>({ … })   // LookupValue fields reject string prefills (TS2322)
 *  ✓ useState<RezepteDialogDefaults | undefined>(undefined)
 */
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { Rezepte, Patienten, Leistungen, LookupValue } from '@/types/app';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { extractRecordId, createRecordUrl, cleanFieldsForApi, getUserProfile, LivingAppsService } from '@/services/livingAppsService';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ComputedContext } from '@/config/form-enhancements/types';
import { applyFieldOrder, flattenFieldOrder, applyDefaults, evalComputed, numberInputProps, clampNumberValue, classifyComputed, extractApplookupRefs, mergeApplookupRefs, resolveApplookupRef } from '@/config/form-enhancements/types';
import { formEnhancements, computedDeps, computedApplookupRefs } from '@/config/form-enhancements/Rezepte';
import { AttachmentsSection } from '@/components/AttachmentsSection';
import { requiredMessage } from '@/lib/journey/messages';
import { t, appLabel, fieldLabel, lookupLabel, localeTag, CURRENCY } from '@/i18n';
import { Textarea } from '@/components/ui/textarea';
import { Combobox } from '@/components/Combobox';
import { PatientenDialog } from '@/components/dialogs/PatientenDialog';
import { LeistungenDialog } from '@/components/dialogs/LeistungenDialog';
import { DatePicker } from '@/components/DatePicker';
import { Checkbox } from '@/components/ui/checkbox';
import { IconAlertCircle, IconCamera, IconChevronDown, IconCircleCheck, IconClipboard, IconFileText, IconLoader2, IconPhotoPlus, IconSparkles, IconUpload, IconX } from '@tabler/icons-react';
import { fileToDataUri, extractFromInput, extractPhotoMeta, reverseGeocode } from '@/lib/ai';
import { lookupKey } from '@/lib/formatters';

/** Widened prefill type for RezepteDialog.defaultValues — see file header. */
export type RezepteDialogDefaults = Omit<Rezepte['fields'], 'status'> & {
    status?: LookupValue | string;
  };

interface RezepteDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (fields: Rezepte['fields']) => Promise<void>;
  /** SHAPE-TOLERANT: lookup fields accept the bare key (string) or the
   *  LookupValue object; applookup fields the bare record id or the full
   *  record URL — the dialog normalizes both. */
  defaultValues?: RezepteDialogDefaults;
  /** Record id when editing — enables the attachments section. Omit on create. */
  recordId?: string;
  patientenList: Patienten[];
  leistungenList: Leistungen[];
  enablePhotoScan?: boolean;
  enablePhotoLocation?: boolean;
}

// defaultValues are SHAPE-TOLERANT: the dialog resolves bare lookup keys via
// its own options and bare record ids via the field's target app — consumers
// never carry the LookupValue/record-URL shape in their head.
const NORMALIZE_LOOKUPS: Record<string, readonly { key: string; label: string }[]> = {
  status: LOOKUP_OPTIONS['rezepte']?.['status'] ?? [],
};
const NORMALIZE_APPLOOKUPS: Record<string, string> = {
  patient: APP_IDS.PATIENTEN,
  leistung: APP_IDS.LEISTUNGEN,
};
function normalizeDefaults(values: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...values };
  for (const [k, opts] of Object.entries(NORMALIZE_LOOKUPS)) {
    const v = out[k];
    if (typeof v === 'string') out[k] = opts.find(o => o.key === v) ?? { key: v, label: v };
    else if (Array.isArray(v)) out[k] = v.map(x => (typeof x === 'string' ? opts.find(o => o.key === x) ?? { key: x, label: x } : x));
  }
  for (const [k, appId] of Object.entries(NORMALIZE_APPLOOKUPS)) {
    const v = out[k];
    if (typeof v === 'string' && v !== '' && !v.startsWith('http')) out[k] = createRecordUrl(appId, v);
    else if (Array.isArray(v)) out[k] = v.map(x => (typeof x === 'string' && x !== '' && !x.startsWith('http') ? createRecordUrl(appId, x) : x));
  }
  return out;
}

export function RezepteDialog({ open, onClose, onSubmit, defaultValues, recordId, patientenList, leistungenList, enablePhotoScan = true, enablePhotoLocation = true }: RezepteDialogProps) {
  const [fields, setFields] = useState<Partial<Rezepte['fields']>>({});
  const [saving, setSaving] = useState(false);
  const normalizedDefaults = useMemo<Record<string, unknown> | undefined>(
    () => (defaultValues ? normalizeDefaults(defaultValues as Record<string, unknown>) : undefined),
    [defaultValues],
  );
  // Dirty-tracking: in edit-mode the Speichern button is disabled until the
  // user actually changes something. JSON.stringify is good enough for our
  // fields (plain values + LookupValue objects + string arrays).
  const isDirty = useMemo(() => {
    if (!normalizedDefaults) return true;  // create-mode: always allow submit
    try {
      return JSON.stringify(fields) !== JSON.stringify(normalizedDefaults);
    } catch {
      return true;
    }
  }, [fields, normalizedDefaults]);
  // Inline-Create state for "Patienten" target. The dropdown's
  // "+ Neuer …" option opens a sub-dialog; on submit we POST, add the new
  // record to the local `extraPatienten` list, and select it in
  // the originating Combobox via the captured `createPatientenField`.
  const [createPatientenOpen, setCreatePatientenOpen] = useState(false);
  const [createPatientenInitial, setCreatePatientenInitial] = useState('');
  const [createPatientenField, setCreatePatientenField] = useState<string>('');
  const [extraPatienten, setExtraPatienten] = useState< Patienten[]>([]);
  const patientenListAll = useMemo(
    () => [...patientenList, ...extraPatienten],
    [patientenList, extraPatienten],
  );
  function openCreatePatienten(fieldKey: string, q: string) {
    setCreatePatientenField(fieldKey);
    setCreatePatientenInitial(q);
    setCreatePatientenOpen(true);
  }
  // Inline-Create state for "Leistungen" target. The dropdown's
  // "+ Neuer …" option opens a sub-dialog; on submit we POST, add the new
  // record to the local `extraLeistungen` list, and select it in
  // the originating Combobox via the captured `createLeistungenField`.
  const [createLeistungenOpen, setCreateLeistungenOpen] = useState(false);
  const [createLeistungenInitial, setCreateLeistungenInitial] = useState('');
  const [createLeistungenField, setCreateLeistungenField] = useState<string>('');
  const [extraLeistungen, setExtraLeistungen] = useState< Leistungen[]>([]);
  const leistungenListAll = useMemo(
    () => [...leistungenList, ...extraLeistungen],
    [leistungenList, extraLeistungen],
  );
  function openCreateLeistungen(fieldKey: string, q: string) {
    setCreateLeistungenField(fieldKey);
    setCreateLeistungenInitial(q);
    setCreateLeistungenOpen(true);
  }
  const [showErrors, setShowErrors] = useState(false);
  const REQUIRED_FIELDS = ['patient', 'ausstellungsdatum', 'arztpraxis', 'leistung', 'anzahl_einheiten', 'status'] as const;
  const missingRequired = REQUIRED_FIELDS.filter(k => {
    const v = (fields as Record<string, unknown>)[k];
    return v == null || v === '' || (Array.isArray(v) && v.length === 0);
  });
  const [aiOpen, setAiOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [usePersonalInfo, setUsePersonalInfo] = useState(() => {
    try { return localStorage.getItem('ai-use-personal-info') === 'true'; } catch { return false; }
  });
  const [showProfileInfo, setShowProfileInfo] = useState(false);
  const [profileData, setProfileData] = useState<Record<string, unknown> | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [aiText, setAiText] = useState('');

  // Computed-field plumbing. Pure no-op when formEnhancements.computed is {}.
  // The number renderer uses computedValues only as a fallback when the user
  // hasn't typed anything — clearing the input always restores the computation.
  // computedContext exposes applookup list props so { kind: 'applookup', ... }
  // operands can resolve to numeric fields on the target record.
  const computedContext = useMemo<ComputedContext>(() => ({
    lookupLists: {
      'patient': patientenList,
      'leistung': leistungenList,
    },
  }), [patientenList, leistungenList, ]);
  const computedValues = useMemo<Record<string, number | null>>(() => {
    let out: Record<string, number | null> = {};
    const entries = Object.entries(formEnhancements.computed);
    for (let i = 0; i < 5; i++) {
      const merged: Record<string, unknown> = { ...(fields as Record<string, unknown>) };
      for (const [k, v] of Object.entries(out)) {
        if (v === null) continue;
        const cur = merged[k];
        if (cur === undefined || cur === null || cur === '') merged[k] = v;
      }
      const next: Record<string, number | null> = {};
      let changed = false;
      for (const [key, spec] of entries) {
        const v = evalComputed(spec, merged, computedContext);
        next[key] = v;
        if (v !== out[key]) changed = true;
      }
      out = next;
      if (!changed) break;
    }
    return out;
  }, [fields, computedContext]);

  useEffect(() => {
    if (open) {
      setFields(applyDefaults(normalizedDefaults ?? {}, formEnhancements.defaults) as Partial<Rezepte['fields']>);
      setPreview(null);
      setScanSuccess(false);
      setAiText('');
      setSubmitError(null);
    }
  }, [open, normalizedDefaults]);
  useEffect(() => {
    try { localStorage.setItem('ai-use-personal-info', String(usePersonalInfo)); } catch {}
  }, [usePersonalInfo]);
  async function handleShowProfileInfo() {
    if (showProfileInfo) { setShowProfileInfo(false); return; }
    setProfileLoading(true);
    try {
      const p = await getUserProfile();
      setProfileData(p);
    } catch {
      setProfileData(null);
    } finally {
      setProfileLoading(false);
      setShowProfileInfo(true);
    }
  }

  // Submit errors surface IN the dialog (it is modal — a banner in the page
  // body would be hidden behind it). A consumer onSubmit that THROWS (the
  // documented "throw to prevent closing" validation pattern) lands here:
  // the dialog stays open, nothing is saved, the message is visible.
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (missingRequired.length > 0) {
      setShowErrors(true);
      return;
    }
    setSaving(true);
    setSubmitError(null);
    try {
      // Fill empty number slots from computed values; user-typed values always win.
      // CRITICAL: only backend-mapped keys may be backfilled. Virtual computeds
      // (sub-agent invents `_netto`, `_bestellung_gesamtbetrag` etc. for the
      // "Berechnungen" display) have no backend counterpart — writing them
      // triggers a 422 from the Living-Apps API ("field does not exist").
      const merged = { ...fields };
      for (const [key, val] of Object.entries(computedValues)) {
        if (val === null) continue;
        if (!backendFieldSet.has(key)) continue;
        const cur = (merged as Record<string, unknown>)[key];
        if (cur === undefined || cur === null || cur === '') {
          (merged as Record<string, unknown>)[key] = val;
        }
      }
      const clean = cleanFieldsForApi(merged, 'rezepte');
      await onSubmit(clean as Rezepte['fields']);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error && err.message ? err.message : t('submit_error'));
    } finally {
      setSaving(false);
    }
  }

  async function handleAiExtract(file?: File) {
    if (!file && !aiText.trim()) return;
    setScanning(true);
    setScanSuccess(false);
    try {
      let uri: string | undefined;
      let gps: { latitude: number; longitude: number } | null = null;
      let geoAddr = '';
      const parts: string[] = [];
      if (file) {
        const [dataUri, meta] = await Promise.all([fileToDataUri(file), extractPhotoMeta(file)]);
        uri = dataUri;
        if (file.type.startsWith('image/')) setPreview(uri);
        gps = enablePhotoLocation ? meta?.gps ?? null : null;
        if (gps) {
          geoAddr = await reverseGeocode(gps.latitude, gps.longitude);
          parts.push(`Location coordinates: ${gps.latitude}, ${gps.longitude}`);
          if (geoAddr) parts.push(`Reverse-geocoded address: ${geoAddr}`);
        }
        if (meta?.dateTime) {
          parts.push(`Date taken: ${meta.dateTime.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3')}`);
        }
      }
      const contextParts: string[] = [];
      if (parts.length) {
        contextParts.push(`<photo-metadata>\nThe following metadata was extracted from the photo\'s EXIF data:\n${parts.join('\n')}\n</photo-metadata>`);
      }
      contextParts.push(`<available-records field="patient" entity="Patienten">\n${JSON.stringify(patientenList.map(r => ({ record_id: r.record_id, ...r.fields })), null, 2)}\n</available-records>`);
      contextParts.push(`<available-records field="leistung" entity="Leistungen">\n${JSON.stringify(leistungenList.map(r => ({ record_id: r.record_id, ...r.fields })), null, 2)}\n</available-records>`);
      if (usePersonalInfo) {
        try {
          const profile = await getUserProfile();
          contextParts.push(`<user-profile>\nThe following is the logged-in user\'s personal information. Use this to pre-fill relevant fields like name, email, address, company etc. when appropriate:\n${JSON.stringify(profile, null, 2)}\n</user-profile>`);
        } catch (err) {
          console.warn('Failed to fetch user profile:', err);
        }
      }
      const photoContext = contextParts.length ? contextParts.join('\n') : undefined;
      const schema = `{\n  "patient": string | null, // Display name from Patienten (see <available-records>)\n  "ausstellungsdatum": string | null, // YYYY-MM-DD\n  "arztpraxis": string | null, // Verordnende Arztpraxis\n  "diagnose": string | null, // Diagnose\n  "leistung": string | null, // Display name from Leistungen (see <available-records>)\n  "anzahl_einheiten": number | null, // Anzahl verordnete Einheiten\n  "frequenz_pro_woche": number | null, // Frequenz pro Woche\n  "gueltig_bis": string | null, // YYYY-MM-DD\n  "status": LookupValue | null, // Status (select one key: "offen" | "in_behandlung" | "abgeschlossen" | "abgelaufen") mapping: offen=Offen, in_behandlung=In Behandlung, abgeschlossen=Abgeschlossen, abgelaufen=Abgelaufen\n}`;
      const raw = await extractFromInput<Record<string, unknown>>(schema, {
        dataUri: uri,
        userText: aiText.trim() || undefined,
        photoContext,
        intent: DIALOG_INTENT,
      });
      setFields(prev => {
        const merged = { ...prev } as Record<string, unknown>;
        function matchName(name: string, candidates: string[]): boolean {
          const n = name.toLowerCase().trim();
          return candidates.some(c => c.toLowerCase().includes(n) || n.includes(c.toLowerCase()));
        }
        const applookupKeys = new Set<string>(["patient", "leistung"]);
        for (const [k, v] of Object.entries(raw)) {
          if (applookupKeys.has(k)) continue;
          if (v != null) merged[k] = v;
        }
        const patientName = raw['patient'] as string | null;
        if (patientName) {
          const patientMatch = patientenList.find(r => matchName(patientName!, [[r.fields.vorname ?? '', r.fields.nachname ?? ''].filter(Boolean).join(' ')]));
          if (patientMatch) merged['patient'] = createRecordUrl(APP_IDS.PATIENTEN, patientMatch.record_id);
        }
        const leistungName = raw['leistung'] as string | null;
        if (leistungName) {
          const leistungMatch = leistungenList.find(r => matchName(leistungName!, [String(r.fields.bezeichnung ?? '')]));
          if (leistungMatch) merged['leistung'] = createRecordUrl(APP_IDS.LEISTUNGEN, leistungMatch.record_id);
        }
        return merged as Partial<Rezepte['fields']>;
      });
      setAiText('');
      setScanSuccess(true);
      setTimeout(() => setScanSuccess(false), 3000);
    } catch (err) {
      console.error(`${t('scan_error')}:`, err);
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setScanning(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleAiExtract(f);
    e.target.value = '';
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
      handleAiExtract(file);
    }
  }, []);

  const DIALOG_INTENT = defaultValues
    ? t('edit_entity', { entity: appLabel('rezepte') })
    : t('new_entity', { entity: appLabel('rezepte') });

  const fieldBlocks: Record<string, React.ReactNode> = {
    'patient': (
      <div key="patient" className="space-y-1.5">
        <Label htmlFor="patient">{fieldLabel('rezepte', 'patient')} <span className="text-destructive" aria-hidden="true">*</span></Label>
        <Combobox
          id="patient"
          placeholder=""
          items={patientenListAll.map(r => ({
            id: r.record_id,
            label: String(r.fields.vorname ?? r.record_id),
          }))}
          value={extractRecordId(fields.patient)}
          onChange={id => setFields(f => ({ ...f, patient: id ? createRecordUrl(APP_IDS.PATIENTEN, id) : undefined }))}
          onCreateNew={(q) => openCreatePatienten("patient", q)}
          createLabel={t('create_in', { entity: appLabel('patienten') })}
        />
        {showErrors && !fields.patient && (
          <p className="text-xs text-destructive mt-1" role="alert">{requiredMessage('rezepte', 'patient')}</p>
        )}
      </div>
    ),
    'ausstellungsdatum': (
      <div key="ausstellungsdatum" className="space-y-1.5">
        <Label htmlFor="ausstellungsdatum">{fieldLabel('rezepte', 'ausstellungsdatum')} <span className="text-destructive" aria-hidden="true">*</span></Label>
        <DatePicker
          id="ausstellungsdatum"
          placeholder=""
          mode="date"
          value={fields.ausstellungsdatum ?? null}
          onChange={v => setFields(f => ({ ...f, ausstellungsdatum: v ?? undefined }))}
          required
        />
        {showErrors && !fields.ausstellungsdatum && (
          <p className="text-xs text-destructive mt-1" role="alert">{requiredMessage('rezepte', 'ausstellungsdatum')}</p>
        )}
      </div>
    ),
    'arztpraxis': (
      <div key="arztpraxis" className="space-y-1.5">
        <Label htmlFor="arztpraxis">{fieldLabel('rezepte', 'arztpraxis')} <span className="text-destructive" aria-hidden="true">*</span></Label>
        <Input
          id="arztpraxis"
          placeholder=""
          value={fields.arztpraxis ?? ''}
          onChange={e => setFields(f => ({ ...f, arztpraxis: e.target.value }))}
          required
        />
        {showErrors && !fields.arztpraxis && (
          <p className="text-xs text-destructive mt-1" role="alert">{requiredMessage('rezepte', 'arztpraxis')}</p>
        )}
      </div>
    ),
    'diagnose': (
      <div key="diagnose" className="space-y-1.5">
        <Label htmlFor="diagnose">{fieldLabel('rezepte', 'diagnose')}</Label>
        <Textarea
          id="diagnose"
          placeholder=""
          value={fields.diagnose ?? ''}
          onChange={e => setFields(f => ({ ...f, diagnose: e.target.value }))}
          rows={3}
        />
      </div>
    ),
    'leistung': (
      <div key="leistung" className="space-y-1.5">
        <Label htmlFor="leistung">{fieldLabel('rezepte', 'leistung')} <span className="text-destructive" aria-hidden="true">*</span></Label>
        <Combobox
          id="leistung"
          placeholder=""
          items={leistungenListAll.map(r => ({
            id: r.record_id,
            label: String(r.fields.bezeichnung ?? r.record_id),
          }))}
          value={extractRecordId(fields.leistung)}
          onChange={id => setFields(f => ({ ...f, leistung: id ? createRecordUrl(APP_IDS.LEISTUNGEN, id) : undefined }))}
          onCreateNew={(q) => openCreateLeistungen("leistung", q)}
          createLabel={t('create_in', { entity: appLabel('leistungen') })}
        />
        {showErrors && !fields.leistung && (
          <p className="text-xs text-destructive mt-1" role="alert">{requiredMessage('rezepte', 'leistung')}</p>
        )}
      </div>
    ),
    'anzahl_einheiten': (
      <div key="anzahl_einheiten" className="space-y-1.5">
        <Label htmlFor="anzahl_einheiten">{fieldLabel('rezepte', 'anzahl_einheiten')} <span className="text-destructive" aria-hidden="true">*</span></Label>
        <Input
          id="anzahl_einheiten"
          type="number"
          inputMode="decimal"
          step="any"
          {...numberInputProps(formEnhancements, 'anzahl_einheiten')}
          placeholder=""
          value={fields.anzahl_einheiten !== undefined ? fields.anzahl_einheiten : (computedValues['anzahl_einheiten'] ?? '')}
          onChange={e => setFields(f => ({ ...f, anzahl_einheiten: clampNumberValue(formEnhancements, 'anzahl_einheiten', e.target.value) }))}
        />
        {showErrors && !fields.anzahl_einheiten && (
          <p className="text-xs text-destructive mt-1" role="alert">{requiredMessage('rezepte', 'anzahl_einheiten')}</p>
        )}
      </div>
    ),
    'frequenz_pro_woche': (
      <div key="frequenz_pro_woche" className="space-y-1.5">
        <Label htmlFor="frequenz_pro_woche">{fieldLabel('rezepte', 'frequenz_pro_woche')}</Label>
        <Input
          id="frequenz_pro_woche"
          type="number"
          inputMode="decimal"
          step="any"
          {...numberInputProps(formEnhancements, 'frequenz_pro_woche')}
          placeholder=""
          value={fields.frequenz_pro_woche !== undefined ? fields.frequenz_pro_woche : (computedValues['frequenz_pro_woche'] ?? '')}
          onChange={e => setFields(f => ({ ...f, frequenz_pro_woche: clampNumberValue(formEnhancements, 'frequenz_pro_woche', e.target.value) }))}
        />
      </div>
    ),
    'gueltig_bis': (
      <div key="gueltig_bis" className="space-y-1.5">
        <Label htmlFor="gueltig_bis">{fieldLabel('rezepte', 'gueltig_bis')}</Label>
        <DatePicker
          id="gueltig_bis"
          placeholder=""
          mode="date"
          value={fields.gueltig_bis ?? null}
          onChange={v => setFields(f => ({ ...f, gueltig_bis: v ?? undefined }))}
        />
      </div>
    ),
    'status': (
      <div key="status" className="space-y-1.5">
        <Label htmlFor="status">{fieldLabel('rezepte', 'status')} <span className="text-destructive" aria-hidden="true">*</span></Label>
        <div role="radiogroup" className="flex flex-wrap gap-1.5">
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.status) === 'offen'}
            onClick={() => setFields(f => ({ ...f, status: (lookupKey(f.status) === 'offen' ? undefined : 'offen') as any }))}
            className={`inline-flex items-center justify-center min-h-9 max-sm:min-h-11 max-sm:px-4 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.status) === 'offen'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            {lookupLabel('rezepte', 'status', 'offen') ?? 'Offen'}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.status) === 'in_behandlung'}
            onClick={() => setFields(f => ({ ...f, status: (lookupKey(f.status) === 'in_behandlung' ? undefined : 'in_behandlung') as any }))}
            className={`inline-flex items-center justify-center min-h-9 max-sm:min-h-11 max-sm:px-4 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.status) === 'in_behandlung'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            {lookupLabel('rezepte', 'status', 'in_behandlung') ?? 'In Behandlung'}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.status) === 'abgeschlossen'}
            onClick={() => setFields(f => ({ ...f, status: (lookupKey(f.status) === 'abgeschlossen' ? undefined : 'abgeschlossen') as any }))}
            className={`inline-flex items-center justify-center min-h-9 max-sm:min-h-11 max-sm:px-4 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.status) === 'abgeschlossen'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            {lookupLabel('rezepte', 'status', 'abgeschlossen') ?? 'Abgeschlossen'}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={lookupKey(fields.status) === 'abgelaufen'}
            onClick={() => setFields(f => ({ ...f, status: (lookupKey(f.status) === 'abgelaufen' ? undefined : 'abgelaufen') as any }))}
            className={`inline-flex items-center justify-center min-h-9 max-sm:min-h-11 max-sm:px-4 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              lookupKey(fields.status) === 'abgelaufen'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground border-input hover:bg-accent'
            }`}
          >
            {lookupLabel('rezepte', 'status', 'abgelaufen') ?? 'Abgelaufen'}
          </button>
        </div>
        {showErrors && !fields.status && (
          <p className="text-xs text-destructive mt-1" role="alert">{requiredMessage('rezepte', 'status')}</p>
        )}
      </div>
    ),
  };
  const orderedFields = applyFieldOrder(Object.keys(fieldBlocks), formEnhancements.fieldOrder);
  const orderedFieldsKey = orderedFields.map((it) => typeof it === 'string' ? it : it.row.join('+')).join(',');

  // Render-Modell für Computed-Felder:
  //
  //   • BACKEND-FELDER mit computed-Eintrag (z.B. gesamtpreis bei einer
  //     Katzenpension) bleiben als normales Eingabe-Feld stehen. Der Number-
  //     Input nutzt den computed-Wert als Vorschlag, der User kann jederzeit
  //     überschreiben (clearing → restore computed).
  //   • VIRTUELLE computed-Keys (Eintrag in formEnhancements.computed, ABER
  //     kein passendes Backend-Feld in orderedFields) erscheinen NICHT als
  //     Input, sondern unten als kompakte 'Berechnungen'-Übersicht oder als
  //     Inline-Hint unter dem letzten beitragenden Input.
  const FIELD_LABELS: Record<string, string> = {"patient": "Patient", "ausstellungsdatum": "Ausstellungsdatum", "arztpraxis": "Verordnende Arztpraxis", "diagnose": "Diagnose", "leistung": "Leistung", "anzahl_einheiten": "Anzahl verordnete Einheiten", "frequenz_pro_woche": "Frequenz pro Woche", "gueltig_bis": "Gültig bis", "status": "Status"};
  const CURRENCY_KEYS = new Set<string>([]);
  // Applookup-Referenz-Labels: pro applookup-Feld in dieser Form (ownKey)
  // eine Map { lookupKey: label } für ALLE Felder des Target-Schemas. Wird
  // beim Render-Walk gefiltert auf die in der computed-Formel tatsächlich
  // referenzierten lookupKeys (siehe applookupRefs unten).
  const APPLOOKUP_LABELS: Record<string, Record<string, string>> = {"patient": {"vorname": "Vorname", "nachname": "Nachname", "geburtsdatum": "Geburtsdatum", "telefon": "Telefon", "email": "E-Mail", "strasse": "Straße", "hausnummer": "Hausnummer", "plz": "Postleitzahl", "ort": "Ort", "krankenkasse": "Krankenkasse", "versichertennummer": "Versichertennummer", "versicherungsart": "Versicherungsart", "hausarzt": "Hausarzt", "notizen": "Notizen (vertraulich)"}, "leistung": {"bezeichnung": "Bezeichnung", "heilmittelkuerzel": "Heilmittelkürzel", "dauer_minuten": "Dauer (Minuten)", "preis_kasse": "Preis Kasse (€)", "preis_privat": "Preis Privat (€)"}};
  const inputFields = useMemo(() => flattenFieldOrder(orderedFields), [orderedFieldsKey]);
  const backendFieldSet = useMemo(() => new Set(inputFields), [inputFields.join(',')]);
  const virtualComputed = useMemo(
    () => Object.fromEntries(
      Object.entries(formEnhancements.computed).filter(([k]) => !backendFieldSet.has(k)),
    ),
    [backendFieldSet],
  );
  const virtualFormEnhancements = useMemo(
    () => ({ ...formEnhancements, computed: virtualComputed }),
    [virtualComputed],
  );
  const computedLayout = useMemo(
    () => classifyComputed(virtualFormEnhancements, inputFields, computedDeps),
    [virtualFormEnhancements, inputFields.join(',')],
  );
  // Applookup-Referenzen: pro ownKey (Lookup-Feld im Form) die Liste der
  // lookupKeys, die in irgendeiner computed-Formel referenziert werden.
  // MODUS-1: aus dem Spec-Tree extrahiert. MODUS-2: aus dem Build-Time-
  // Export computedApplookupRefs (parse-formulas hat Regex-Pairs gesammelt).
  // Pro (ownKey, lookupKey)-Paar nur einmal; pro ownKey können aber mehrere
  // lookupKeys gleichzeitig auftauchen (z.B. einzelpreis UND karten10_preis
  // beim Yoga-Kurs), und alle werden separat als Inline-Hint gerendert.
  const applookupRefs = useMemo(
    () => mergeApplookupRefs(
      extractApplookupRefs(formEnhancements.computed),
      computedApplookupRefs,
    ),
    [],
  );
  function summaryLabel(k: string): string {
    if (FIELD_LABELS[k]) return FIELD_LABELS[k];
    // Leading underscore(s) als Virtual-Marker abstreifen; Unterstriche zu
    // Leerzeichen, jedes Wort kapitalisieren. Umlaute kommen vom Sub-Agent
    // direkt im Key (z. B. `_buchung_dauer_nächte`) — JS/TS/Vite unterstützen
    // Unicode-Identifier nativ, daher keine ASCII-Transliteration nötig.
    return k.replace(/^_+/, '')
      .split('_')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  function formatSummaryValue(k: string, v: unknown): string {
    if (v === undefined || v === null || v === '' || (typeof v === 'number' && !Number.isFinite(v))) return '—';
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n)) return String(v);
    // Backend-Feld mit €-Label ODER virtueller Computed-Key, dessen Name nach Geld aussieht.
    const looksLikeCurrency = CURRENCY_KEYS.has(k) || /(?:kosten|preis|betrag|gesamt|netto|brutto|summe|mwst|rabatt|anzahlung|umsatz|saldo)/i.test(k);
    if (looksLikeCurrency) {
      return n.toLocaleString(localeTag(), { style: 'currency', currency: CURRENCY, minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return n.toLocaleString(localeTag(), { maximumFractionDigits: 2 });
  }

  return (
    <>
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[92vh] flex flex-col overflow-hidden p-0 gap-0 max-sm:[&>button]:size-10 max-sm:[&>button]:grid max-sm:[&>button]:place-items-center max-sm:[&>button]:rounded-full max-sm:[&>button]:border max-sm:[&>button]:border-input max-sm:[&>button]:bg-background max-sm:[&>button]:opacity-100 max-sm:[&>button>svg]:size-5">
        <DialogHeader className="px-6 pt-5 pb-3 border-b flex flex-row items-center gap-3 space-y-0">
          <DialogTitle className="flex-1 truncate text-left">{DIALOG_INTENT}</DialogTitle>
          {enablePhotoScan && (
            <button
              type="button"
              onClick={() => setAiOpen(o => !o)}
              aria-expanded={aiOpen}
              aria-controls="ai-fill-panel"
              className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 max-sm:py-2.5 max-sm:px-4 text-xs font-semibold transition-all mr-7 max-sm:mr-12 shadow-sm ${
                aiOpen
                  ? 'bg-primary text-primary-foreground ring-2 ring-primary/30'
                  : 'bg-primary/10 text-primary border border-primary/30 hover:bg-primary/15 hover:border-primary/50'
              }`}
            >
              <IconSparkles className={`h-3.5 w-3.5 ${aiOpen ? '' : 'text-primary'}`} />
              <span className="hidden sm:inline">{t('smart_fill')}</span>
              <IconChevronDown className={`h-3 w-3 transition-transform ${aiOpen ? 'rotate-180' : ''}`} />
            </button>
          )}
        </DialogHeader>
        {enablePhotoScan && aiOpen && (
          <div id="ai-fill-panel" className="border-b bg-muted/20 px-6 py-4 space-y-3">
            <p className="text-xs text-muted-foreground">{t('scan_header_sub')}</p>
            <div className="flex items-start gap-2 pl-0.5">
              <Checkbox
                id="ai-use-personal-info"
                checked={usePersonalInfo}
                onCheckedChange={(v) => setUsePersonalInfo(!!v)}
                className="mt-0.5"
              />
              <span className="text-xs text-muted-foreground leading-snug">
                <Label htmlFor="ai-use-personal-info" className="text-xs font-normal text-muted-foreground cursor-pointer inline">
                  {t('useinfo_label')}
                </Label>
                {' '}
                <button type="button" onClick={handleShowProfileInfo} className="text-xs text-primary hover:underline whitespace-nowrap">
                  {profileLoading ? t('useinfo_loading') : `(${t('useinfo_more')})`}
                </button>
              </span>
            </div>
            {showProfileInfo && (
              <div className="rounded-md border bg-muted/50 p-2 text-xs max-h-40 overflow-y-auto">
                <p className="font-medium mb-1">{t('profile_preamble')}</p>
                {profileData ? Object.values(profileData).map((v, i) => (
                  <span key={i}>{i > 0 && ", "}{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
                )) : (
                  <span className="text-muted-foreground">{t('useinfo_error')}</span>
                )}
              </div>
            )}

            <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileSelect} />
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !scanning && fileInputRef.current?.click()}
              className={`
                relative rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer
                ${scanning
                  ? 'border-primary/40 bg-primary/5'
                  : scanSuccess
                    ? 'border-green-500/40 bg-green-50/50 dark:bg-green-950/20'
                    : dragOver
                      ? 'border-primary bg-primary/10 scale-[1.01]'
                      : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
                }
              `}
            >
              {scanning ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <IconLoader2 className="h-7 w-7 text-primary animate-spin" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">{t('scan_analyzing')}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t('scan_analyzing_sub')}</p>
                  </div>
                </div>
              ) : scanSuccess ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="h-14 w-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <IconCircleCheck className="h-7 w-7 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-green-700 dark:text-green-400">{t('scan_success')}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t('scan_success_sub')}</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="h-14 w-14 rounded-full bg-primary/8 flex items-center justify-center">
                    <IconPhotoPlus className="h-7 w-7 text-primary/70" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">{t('scan_upload')}</p>
                  </div>
                </div>
              )}

              {preview && !scanning && (
                <div className="absolute top-2 right-2">
                  <div className="relative group">
                    <img src={preview} alt="" className="h-10 w-10 rounded-md object-cover border shadow-sm" />
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setPreview(null); }}
                      className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-muted-foreground/80 text-white flex items-center justify-center"
                    >
                      <IconX className="h-2.5 w-2.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Button type="button" variant="outline" size="sm" className="h-10 text-xs" disabled={scanning}
                onClick={e => { e.stopPropagation(); cameraInputRef.current?.click(); }}>
                <IconCamera className="h-3.5 w-3.5 mr-1" />{t('scan_camera_btn')}
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-10 text-xs" disabled={scanning}
                onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                <IconUpload className="h-3.5 w-3.5 mr-1" />{t('scan_file_btn')}
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-10 text-xs" disabled={scanning}
                onClick={e => {
                  e.stopPropagation();
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = 'application/pdf,.pdf';
                    fileInputRef.current.click();
                    setTimeout(() => { if (fileInputRef.current) fileInputRef.current.accept = 'image/*,application/pdf'; }, 100);
                  }
                }}>
                <IconFileText className="h-3.5 w-3.5 mr-1" />{t('scan_doc_btn')}
              </Button>
            </div>

            <div className="relative">
              <Textarea
                placeholder={t('scan_text_placeholder')}
                value={aiText}
                onChange={e => {
                  setAiText(e.target.value);
                  const el = e.target;
                  el.style.height = 'auto';
                  el.style.height = Math.min(Math.max(el.scrollHeight, 56), 96) + 'px';
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && aiText.trim() && !scanning) {
                    e.preventDefault();
                    handleAiExtract();
                  }
                }}
                disabled={scanning}
                rows={2}
                className="pr-12 resize-none text-sm overflow-y-auto"
              />
              <button
                type="button"
                className="absolute right-2 top-2 h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                disabled={scanning}
                onClick={async () => {
                  try {
                    const text = await navigator.clipboard.readText();
                    if (text) setAiText(prev => prev ? prev + '\n' + text : text);
                  } catch {}
                }}
                title={t('paste')}
              >
                <IconClipboard className="h-4 w-4" />
              </button>
            </div>
            {aiText.trim() && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full h-9 text-xs"
                disabled={scanning}
                onClick={() => handleAiExtract()}
              >
                <IconSparkles className="h-3.5 w-3.5 mr-1.5" />{t('scan_text_analyze')}
              </Button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col min-h-0 min-w-0 max-sm:[&_input]:h-11">
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-4 space-y-4 min-w-0">
            {(() => {
              const renderField = (k: string) => {
                const inlineHints = computedLayout.anchors[k] ?? [];
                const refs = applookupRefs[k] ?? [];
                return (
                  <div key={k} className="space-y-1.5 min-w-0">
                    {fieldBlocks[k]}
                    {refs.map(({ lookupKey }) => {
                      // Show the live numeric value the formula will pull from
                      // the selected lookup target (e.g. "Monatspreis: 34,90 €"
                      // under the Tarif combobox). Hidden while no lookup is
                      // selected or the target field is non-numeric.
                      const v = resolveApplookupRef(k, lookupKey, fields as Record<string, unknown>, computedContext);
                      if (v === null) return null;
                      const lbl = APPLOOKUP_LABELS[k]?.[lookupKey] ?? lookupKey;
                      const text = formatSummaryValue(lookupKey, v);
                      return (
                        <div key={`alh-${k}-${lookupKey}`} className="flex items-center gap-1.5 pl-3 text-xs text-muted-foreground">
                          <span className="text-primary/70">→</span>
                          <span>{lbl}</span>
                          <span className="ml-auto font-medium tabular-nums text-foreground">{text}</span>
                        </div>
                      );
                    })}
                    {inlineHints.map((cKey) => {
                      const v = computedValues[cKey];
                      const text = formatSummaryValue(cKey, v);
                      if (text === '—') return null;
                      return (
                        <div key={cKey} className="flex items-center gap-1.5 pl-3 text-xs text-muted-foreground">
                          <span className="text-primary/70">→</span>
                          <span>{summaryLabel(cKey)}</span>
                          <span className="ml-auto font-medium tabular-nums text-foreground">{text}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              };
              return orderedFields.map((item, idx) => {
                if (typeof item === 'string') return renderField(item);
                const cols = item.cols ?? `repeat(${item.row.length}, minmax(0, 1fr))`;
                return (
                  <div key={`row-${idx}`} className="grid gap-3" style={{ gridTemplateColumns: cols }}>
                    {item.row.map(renderField)}
                  </div>
                );
              });
            })()}
            {(computedLayout.aggregates.length > 0 || computedLayout.finalTotal) && (
              <div className="mt-6 pt-4 border-t border-border space-y-1.5">
                {computedLayout.aggregates.length > 0 && (
                  <dl className="space-y-1.5 pb-2">
                    {computedLayout.aggregates.map((k) => {
                      const userVal = (fields as Record<string, unknown>)[k];
                      const computed = computedValues[k];
                      const v = userVal !== undefined && userVal !== null && userVal !== '' ? userVal : computed;
                      return (
                        <div key={k} className="flex justify-between items-baseline gap-3">
                          <dt className="text-sm text-muted-foreground truncate">{summaryLabel(k)}</dt>
                          <dd className="text-sm font-medium tabular-nums whitespace-nowrap">{formatSummaryValue(k, v)}</dd>
                        </div>
                      );
                    })}
                  </dl>
                )}
                {computedLayout.finalTotal && (() => {
                  const k = computedLayout.finalTotal;
                  const userVal = (fields as Record<string, unknown>)[k];
                  const computed = computedValues[k];
                  const v = userVal !== undefined && userVal !== null && userVal !== '' ? userVal : computed;
                  // Innere Border nur wenn aggregates existieren — sonst hätten wir
                  // zwei direkt aufeinanderfolgende Striche (Outer + Inner) mit nur
                  // einer Aggregat-Zeile dazwischen → zu viel visuelles Rauschen.
                  const sep = computedLayout.aggregates.length > 0 ? 'pt-3 border-t border-border' : 'pt-1';
                  return (
                    <div className={`flex justify-between items-baseline gap-3 ${sep}`}>
                      <span className="text-base font-semibold text-foreground">{summaryLabel(k)}</span>
                      <span className="text-lg font-bold tabular-nums whitespace-nowrap text-foreground">{formatSummaryValue(k, v)}</span>
                    </div>
                  );
                })()}
              </div>
            )}
            {showErrors && missingRequired.length > 0 && (
              <p className="text-xs text-destructive flex items-center gap-1.5" role="alert">
                <IconAlertCircle className="h-3.5 w-3.5 shrink-0" />
                {t('missing_required')}
              </p>
            )}
            {recordId && (
              <div className="pt-2 border-t border-border">
                <AttachmentsSection appId={APP_IDS.REZEPTE} recordId={recordId} />
              </div>
            )}
          </div>
          {submitError && (
            <div className="flex items-start gap-2 border-t border-destructive/20 bg-destructive/10 px-6 py-2.5 text-sm text-destructive" role="alert">
              <IconAlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span className="min-w-0 break-words">{submitError}</span>
            </div>
          )}
          <DialogFooter className="sticky bottom-0 border-t bg-background/95 backdrop-blur px-6 py-3 gap-2 max-sm:flex-row">
            <Button type="button" variant="outline" onClick={onClose} className="max-sm:h-12 max-sm:flex-1 max-sm:text-base">{t('cancel')}</Button>
            <Button
              type="submit"
              className="max-sm:h-12 max-sm:flex-1 max-sm:text-base"
              disabled={saving || !isDirty || (showErrors && missingRequired.length > 0)}
            >
              {saving ? t('saving') : defaultValues ? t('save') : t('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    {createPatientenOpen && (
      <PatientenDialog
        open={createPatientenOpen}
        onClose={() => setCreatePatientenOpen(false)}
        onSubmit={async (newFields) => {
          const result = await LivingAppsService.createPatientenEntry(newFields as any) as { id?: string };
          if (result?.id) {
            const newRec = { record_id: result.id, fields: newFields } as unknown as Patienten;
            setExtraPatienten(prev => [...prev, newRec]);
            const url = createRecordUrl(APP_IDS.PATIENTEN, result.id);
            setFields(prev => ({ ...prev, [createPatientenField]: url } as any));
          }
          setCreatePatientenOpen(false);
        }}
        defaultValues={createPatientenInitial
          ? ({ vorname: createPatientenInitial } as any)
          : undefined}
      />
    )}
    {createLeistungenOpen && (
      <LeistungenDialog
        open={createLeistungenOpen}
        onClose={() => setCreateLeistungenOpen(false)}
        onSubmit={async (newFields) => {
          const result = await LivingAppsService.createLeistungenEntry(newFields as any) as { id?: string };
          if (result?.id) {
            const newRec = { record_id: result.id, fields: newFields } as unknown as Leistungen;
            setExtraLeistungen(prev => [...prev, newRec]);
            const url = createRecordUrl(APP_IDS.LEISTUNGEN, result.id);
            setFields(prev => ({ ...prev, [createLeistungenField]: url } as any));
          }
          setCreateLeistungenOpen(false);
        }}
        defaultValues={createLeistungenInitial
          ? ({ bezeichnung: createLeistungenInitial } as any)
          : undefined}
      />
    )}
    </>
  );
}