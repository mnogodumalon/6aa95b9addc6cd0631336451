/**
 * Neuer Termin — 5-Schritt-Wizard.
 * Steps: 1) Patient wählen → 2) Behandler wählen → 3) Rezept wählen (optional, überspringbar)
 *        → 4) Zeitslot & Raum wählen (mit Verfügbarkeitsprüfung) → 5) Prüfen & anlegen.
 * Reads: patienten, behandler, rezepte, termine (Belegung).
 * Writes: termine (createTermineEntry).
 * Composes: IntentWizardShell, WizardStep, EntitySelectStep, ChoiceGroup,
 *           AvailabilityRangePicker, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { ChoiceGroup } from '@/components/blocks/ChoiceGroup';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { Field } from '@/components/blocks/Field';
import { AvailabilityRangePicker } from '@/components/blocks/AvailabilityRangePicker';
import { DatePicker } from '@/components/DatePicker';
import {
  useStepForm,
  useJourneySubmit,
  useRecordSearch,
  useOccupancy,
  fieldText,
  fieldLookup,
  fieldRef,
  refFilter,
  combineFilters,
  nowIso,
} from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { LOOKUP_OPTIONS } from '@/types/app';
import { tx } from '@/i18n';

const DRAFT_KEY = 'neuer-termin';

export default function NeuerTerminPage() {
  const [step, setStep] = useState(1);

  // ── Formular ──────────────────────────────────────────────────────────────
  const f = useStepForm('termine', {
    steps: {
      patient:   1,
      behandler: 2,
      rezept:    3,
      beginn:    4,
      ende:      4,
      raum:      4,
      status:    4,
      bemerkung: 4,
    },
    initial: {
      status: LOOKUP_OPTIONS['termine']?.['status']?.find(o => o.key === 'geplant')?.key ?? 'geplant',
    },
    required: {
      rezept: false, // Schritt 3 ist optional/überspringbar
    },
  });

  // ── Belegungsprüfung — per Raum, frei wenn status in abgesagt|nicht_erschienen ──
  const raumId = f.get('raum') as string | null;
  const belegung = useOccupancy(servicePort, 'termine', { resource: raumId });

  // ── Record-Suchen ─────────────────────────────────────────────────────────
  const patienten = useRecordSearch(servicePort, 'patienten', {
    searchFields: ['vorname', 'nachname'],
    toItem: p => ({
      id: p.id,
      title: `${fieldText(p, 'vorname')} ${fieldText(p, 'nachname')}`.trim(),
      subtitle: fieldText(p, 'telefon') || undefined,
    }),
    orderby: ['r.v_nachname asc', 'r.v_vorname asc'],
  });

  const behandler = useRecordSearch(servicePort, 'behandler', {
    filter: "r.v_status == 'aktiv'", /* i18n-exempt */
    where: r => fieldLookup(r, 'status')?.key === 'aktiv',
    searchFields: ['vorname', 'nachname', 'kuerzel'],
    toItem: b => ({
      id: b.id,
      title: `${fieldText(b, 'vorname')} ${fieldText(b, 'nachname')}`.trim(),
      subtitle: fieldText(b, 'kuerzel') || undefined,
      status: fieldLookup(b, 'status') ?? undefined,
    }),
    orderby: ['r.v_nachname asc'],
  });

  const patientId = f.get('patient') as string | null;
  const rezepteFilter = patientId
    ? combineFilters(
        refFilter('patient', patientId),
        "r.v_status in ['offen', 'in_behandlung']",
      )
    : undefined;

  const rezepte = useRecordSearch(servicePort, 'rezepte', {
    filter: rezepteFilter,
    where: r =>
      (patientId ? fieldRef(r, 'patient') === patientId : true) &&
      ['offen', 'in_behandlung'].includes(fieldLookup(r, 'status')?.key ?? ''),
    searchFields: ['arztpraxis'],
    toItem: (r, ctx) => ({
      id: r.id,
      title: fieldText(r, 'arztpraxis'),
      subtitle: ctx.ref('leistung'),
      status: fieldLookup(r, 'status') ?? undefined,
    }),
  });

  // ── Plan ──────────────────────────────────────────────────────────────────
  const submit = useJourneySubmit(
    servicePort,
    [{ key: 'termin', entity: 'termine', form: f, primary: true }],
    { draftKey: DRAFT_KEY },
  );

  // Beginn-/Ende-Werte für Raum-Wahl
  const beginnVal = f.get('beginn') as string | null;
  const endeVal   = f.get('ende')   as string | null;

  const raumOptionen = LOOKUP_OPTIONS['termine']?.['raum'] ?? [];
  const statusOptionen = LOOKUP_OPTIONS['termine']?.['status'] ?? [];

  return (
    <IntentWizardShell
      title={tx('Neuer Termin')}
      currentStep={step}
      onStepChange={setStep}
      forms={[f]}
      draftKey={DRAFT_KEY}
      intro={{
        description: tx('Patient, Behandler und Zeitslot in einem Schritt erfassen.'),
        needs: [tx('Patientenname'), tx('Behandler'), tx('Wunschtermin')],
      }}
    >
      {/* ── Schritt 1: Patient ─────────────────────────────────────────── */}
      <WizardStep
        label={tx('Patient')}
        description={tx('Den Patienten für diesen Termin wählen.')}
      >
        <EntitySelectStep
          {...patienten.select}
          selectedId={f.get('patient') as string | null}
          onSelect={id => {
            f.set('patient', id, patienten.labelOf(id));
            // Rezept zurücksetzen, wenn Patient wechselt
            f.set('rezept', null, undefined);
            setStep(2);
          }}
          avatar="initials"
          searchPlaceholder={tx('Vorname oder Nachname …')}
          create={{ fields: ['vorname', 'nachname', 'geburtsdatum', 'telefon'] }}
        />
      </WizardStep>

      {/* ── Schritt 2: Behandler ───────────────────────────────────────── */}
      <WizardStep
        label={tx('Behandler')}
        description={tx('Nur aktive Behandler sind verfügbar.')}
      >
        <EntitySelectStep
          {...behandler.select}
          selectedId={f.get('behandler') as string | null}
          onSelect={id => {
            f.set('behandler', id, behandler.labelOf(id));
            setStep(3);
          }}
          avatar="initials"
          searchPlaceholder={tx('Name oder Kürzel …')}
          emptyText={tx('Aktuell ist kein Behandler als aktiv eingetragen.')}
          create={false}
        />
      </WizardStep>

      {/* ── Schritt 3: Rezept (optional) ───────────────────────────────── */}
      <WizardStep
        label={tx('Rezept')}
        description={tx('Ein offenes Rezept des Patienten zuordnen — oder diesen Schritt überspringen.')}
        needs={['patient']}
      >
        <EntitySelectStep
          {...rezepte.select}
          selectedId={f.get('rezept') as string | null}
          onSelect={id => {
            f.set('rezept', id, rezepte.labelOf(id));
            setStep(4);
          }}
          searchPlaceholder={tx('Arztpraxis …')}
          emptyText={
            patientId
              ? tx('Für diesen Patienten gibt es keine offenen Rezepte.')
              : tx('Bitte zuerst einen Patienten wählen.')
          }
          create={false}
        />
        <div className="mt-4">
          <StepNav
            onBack={() => setStep(2)}
            onNext={() => { setStep(4); }}
            nextLabel={tx('Ohne Rezept weiter')}
            backLabel={tx('Zurück')}
          />
        </div>
      </WizardStep>

      {/* ── Schritt 4: Zeitslot & Raum ─────────────────────────────────── */}
      <WizardStep
        label={tx('Zeitslot & Raum')}
        description={tx('Beginn, Ende und Raum wählen. Belegte Zeiten sind ausgegraut.')}
        needs={['patient', 'behandler']}
      >
        <div className="space-y-5">
          <Field form={f} name="beginn" label={tx('Datum und Beginn')}>
            <DatePicker {...f.date('beginn')} />
          </Field>
          <Field form={f} name="ende" label={tx('Ende')}>
            <DatePicker {...f.date('ende')} />
          </Field>

          {/* Verfügbarkeitsanzeige für den gewählten Raum */}
          {raumId && beginnVal && endeVal && !belegung.isFree(beginnVal, endeVal, raumId) && (
            <p className="text-sm text-destructive">
              {tx('Der gewählte Raum ist in diesem Zeitfenster belegt. Bitte einen anderen Raum oder eine andere Zeit wählen.')}
            </p>
          )}

          <Field form={f} name="raum">
            <ChoiceGroup
              {...f.choice('raum')}
              options={raumOptionen}
            />
          </Field>

          <Field form={f} name="status">
            <ChoiceGroup
              {...f.choice('status')}
              options={statusOptionen}
            />
          </Field>

          <Field form={f} name="bemerkung">
            <textarea
              {...f.field('bemerkung')}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              placeholder={tx('Hinweise für den Behandler …')}
            />
          </Field>

          <StepNav
            onBack={() => setStep(3)}
            onNext={() => {
              const valid = f.validate(['beginn', 'ende', 'raum', 'status']);
              if (!valid) return false;
              // Zusätzliche Prüfung: Raum frei?
              const r = f.get('raum') as string | null;
              const von = f.get('beginn') as string | null;
              const bis = f.get('ende')   as string | null;
              if (r && von && bis && !belegung.isFree(von, bis, r)) {
                return tx('Der Raum ist in diesem Zeitfenster bereits belegt.');
              }
            }}
            nextStepLabel={tx('Prüfen')}
          />
        </div>
      </WizardStep>

      {/* ── Schritt 5: Zusammenfassung ─────────────────────────────────── */}
      <WizardStep label={tx('Prüfen')}>
        {!submit.done && (
          <SummaryStep
            forms={[f]}
            submit={submit}
            whatHappensNext={tx('Der Termin wird sofort angelegt und erscheint im Kalender des Behandlers.')}
            confirmLabel={tx('Termin anlegen')}
          />
        )}
        {submit.result && (
          <SuccessStep
            result={submit.result}
            forms={[f]}
            submit={submit}
            next={[
              { label: tx('Weiteren Termin anlegen'), onClick: () => { submit.reset(); f.reset(); setStep(1); } },
              { label: tx('Behandlung dokumentieren'), href: '#/intents/behandlung-dokumentieren' },
              { label: tx('Zum Dashboard'), href: '#/' },
            ]}
            whatHappensNext={tx('Behandlung nach dem Termin unter „Behandlung dokumentieren" festhalten.')}
            restartLabel={tx('Weiteren Termin anlegen')}
          />
        )}
      </WizardStep>
    </IntentWizardShell>
  );
}
