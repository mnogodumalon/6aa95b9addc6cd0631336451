/**
 * Neuer Termin — 5-Schritt-Wizard.
 * Steps: 1) Patient wählen → 2) Behandler wählen → 3) Zeitfenster wählen (Belegungsprüfung)
 *        → 4) Raum & Details → 5) Zusammenfassung & Anlegen.
 * Reads: patienten, behandler, rezepte. Writes: termine (createTermineEntry).
 * Composes: IntentWizardShell, WizardStep, EntitySelectStep, ChoiceGroup,
 *           DatePicker, StepNav, SummaryStep, SuccessStep, Field, Bound.
 */
import { useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { ChoiceGroup } from '@/components/blocks/ChoiceGroup';
import { Field } from '@/components/blocks/Field';
import { Bound } from '@/components/blocks/Bound';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
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
import { tx } from '@/i18n';

export default function NeuerTerminPage() {
  const [step, setStep] = useState(1);

  // ── Form ──────────────────────────────────────────────────────────────────
  const termin = useStepForm('termine', {
    steps: {
      patient:   1,
      behandler: 2,
      beginn:    3,
      ende:      3,
      raum:      4,
      rezept:    4,
      status:    4,
      bemerkung: 4,
    },
    initial: { status: 'geplant' },
  });

  // ── Patient ───────────────────────────────────────────────────────────────
  const patienten = useRecordSearch(servicePort, 'patienten', {
    searchFields: ['vorname', 'nachname', 'telefon'],
    toItem: p => ({
      id: p.id,
      title: `${fieldText(p, 'vorname')} ${fieldText(p, 'nachname')}`.trim(),
      subtitle: fieldText(p, 'telefon') || undefined,
    }),
    orderby: ['r.v_nachname asc'],
  });

  // ── Behandler (nur aktive) ────────────────────────────────────────────────
  const behandler = useRecordSearch(servicePort, 'behandler', {
    filter: "r.v_status == 'aktiv'",
    where: r => fieldLookup(r, 'status')?.key === 'aktiv',
    searchFields: ['vorname', 'nachname', 'kuerzel'],
    toItem: b => ({
      id: b.id,
      title: `${fieldText(b, 'vorname')} ${fieldText(b, 'nachname')}`.trim(),
      subtitle: fieldText(b, 'kuerzel') || undefined,
    }),
    orderby: ['r.v_nachname asc'],
  });

  // ── Belegungsprüfung für gewählten Behandler ──────────────────────────────
  const pickedBehandlerId = termin.get('behandler') as string | null;
  const belegung = useOccupancy(servicePort, 'termine', {
    resource: pickedBehandlerId ?? null,
  });

  // ── Rezepte des gewählten Patienten (offen | in_behandlung) ───────────────
  const pickedPatientId = termin.get('patient') as string | null;
  const rezepteFilter = pickedPatientId
    ? combineFilters(
        refFilter('patient', pickedPatientId),
        "r.v_status in ['offen', 'in_behandlung']",
      )
    : undefined;
  const rezepte = useRecordSearch(servicePort, 'rezepte', {
    filter: rezepteFilter,
    where: r =>
      fieldRef(r, 'patient') === pickedPatientId &&
      ['offen', 'in_behandlung'].includes(fieldLookup(r, 'status')?.key ?? ''),
    searchFields: ['arztpraxis', 'diagnose'],
    toItem: rx => ({
      id: rx.id,
      title: fieldText(rx, 'arztpraxis'),
      subtitle: fieldText(rx, 'diagnose') || undefined,
      status: fieldLookup(rx, 'status') ?? undefined,
    }),
  });

  // ── Plan ──────────────────────────────────────────────────────────────────
  const submit = useJourneySubmit(
    servicePort,
    [{ key: 'termin', entity: 'termine', form: termin, primary: true }],
    { draftKey: 'neuer-termin' },
  );

  // ── Aktuelle Werte für Belegungsanzeige ───────────────────────────────────
  const beginnVal = termin.get('beginn') as string | null;
  const endeVal   = termin.get('ende')   as string | null;
  const isFrei = belegung.isFree(beginnVal, endeVal, pickedBehandlerId);

  return (
    <IntentWizardShell
      title={tx('Neuer Termin')}
      currentStep={step}
      onStepChange={setStep}
      forms={[termin]}
      draftKey="neuer-termin"
      intro={{
        description: tx('Patient, Behandler und freies Zeitfenster in einem Schritt festlegen.'),
        needs: [tx('Name des Patienten'), tx('Behandler'), tx('Wunschzeit')],
      }}
    >
      {/* ── Schritt 1: Patient wählen ──────────────────────────────────── */}
      <WizardStep
        label={tx('Patient')}
        description={tx('Für wen wird der Termin angelegt?')}
      >
        <EntitySelectStep
          {...patienten.select}
          selectedId={termin.get('patient') as string | null}
          onSelect={id => {
            termin.set('patient', id, patienten.labelOf(id));
            // Rezept-Auswahl zurücksetzen wenn Patient wechselt
            termin.set('rezept', null, '');
            setStep(2);
          }}
          avatar="initials"
          searchPlaceholder={tx('Name oder Telefon eingeben …')}
          create={{ fields: ['vorname', 'nachname', 'telefon', 'geburtsdatum'] }}
        />
      </WizardStep>

      {/* ── Schritt 2: Behandler wählen ────────────────────────────────── */}
      <WizardStep
        label={tx('Behandler')}
        description={tx('Welcher Behandler führt die Therapie durch?')}
        needs={['patient']}
      >
        <EntitySelectStep
          {...behandler.select}
          selectedId={termin.get('behandler') as string | null}
          onSelect={id => {
            termin.set('behandler', id, behandler.labelOf(id));
            setStep(3);
          }}
          avatar="initials"
          searchPlaceholder={tx('Name oder Kürzel …')}
          emptyText={tx('Keine aktiven Behandler gefunden.')}
          create={false}
        />
      </WizardStep>

      {/* ── Schritt 3: Zeitfenster wählen ──────────────────────────────── */}
      <WizardStep
        label={tx('Zeitfenster')}
        description={tx('Beginn und Ende des Termins wählen — gebuchte Zeiten sind gesperrt.')}
        needs={['behandler']}
      >
        <div className="space-y-4">
          <Field form={termin} name="beginn" label={tx('Datum und Beginn')}>
            <DatePicker {...termin.date('beginn')} />
          </Field>
          <Field form={termin} name="ende" label={tx('Ende')}>
            <DatePicker {...termin.date('ende')} />
          </Field>

          {/* Belegungshinweis */}
          {pickedBehandlerId && beginnVal && endeVal && (
            <p className={`text-sm ${isFrei ? 'text-emerald-600' : 'text-destructive'}`}>
              {isFrei
                ? tx('Der Behandler ist in diesem Zeitraum frei.')
                : tx('Der Behandler hat in diesem Zeitraum bereits einen Termin.')}
            </p>
          )}

          {belegung.loading && (
            <p className="text-sm text-muted-foreground">{tx('Belegung wird geprüft …')}</p>
          )}

          <StepNav
            onNext={() => {
              if (!termin.validate(['beginn', 'ende'])) return false;
              if (!isFrei && pickedBehandlerId && beginnVal && endeVal) {
                return tx('Der Behandler ist zu dieser Zeit bereits belegt. Bitte ein anderes Zeitfenster wählen.');
              }
            }}
            nextStepLabel={tx('Raum & Details')}
          />
        </div>
      </WizardStep>

      {/* ── Schritt 4: Raum & Details ──────────────────────────────────── */}
      <WizardStep
        label={tx('Raum & Details')}
        description={tx('Raum zuweisen, optional ein Rezept verknüpfen und Bemerkungen eintragen.')}
        needs={['beginn', 'ende']}
      >
        <div className="space-y-6">
          <Field form={termin} name="raum">
            <ChoiceGroup {...termin.choice('raum')} />
          </Field>

          <Field form={termin} name="status">
            <ChoiceGroup {...termin.choice('status')} />
          </Field>

          {/* Rezept — nur Rezepte des gewählten Patienten */}
          {pickedPatientId ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                {tx('Rezept (optional)')}
              </p>
              {rezepte.select.loading ? (
                <p className="text-sm text-muted-foreground">{tx('Rezepte werden geladen …')}</p>
              ) : rezepte.select.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {tx('Keine offenen Rezepte für diesen Patienten vorhanden.')}
                </p>
              ) : (
                <EntitySelectStep
                  {...rezepte.select}
                  selectedId={termin.get('rezept') as string | null}
                  onSelect={id => {
                    if (termin.get('rezept') === id) {
                      termin.set('rezept', null, '');
                    } else {
                      termin.set('rezept', id, rezepte.labelOf(id));
                    }
                  }}
                  avatar="none"
                  create={false}
                  emptyText={tx('Keine offenen Rezepte für diesen Patienten.')}
                />
              )}
            </div>
          ) : null}

          <Bound form={termin} name="bemerkung" rows={3} />

          <StepNav
            onNext={() => termin.validate(['raum', 'status'])}
            nextStepLabel={tx('Prüfen')}
          />
        </div>
      </WizardStep>

      {/* ── Schritt 5: Zusammenfassung ─────────────────────────────────── */}
      <WizardStep label={tx('Prüfen')}>
        {!submit.done && (
          <SummaryStep
            forms={[termin]}
            submit={submit}
            whatHappensNext={tx('Der Termin erscheint sofort im Kalender und ist für Patient und Behandler sichtbar.')}
            confirmLabel={tx('Termin anlegen')}
          />
        )}
      </WizardStep>

      {/* ── Erfolgsmeldung ─────────────────────────────────────────────── */}
      {submit.result && (
        <SuccessStep
          result={submit.result}
          forms={[termin]}
          submit={submit}
          restartLabel={tx('Weiteren Termin anlegen')}
          whatHappensNext={tx('Zur Dokumentation der Behandlung den Ablauf „Behandlung dokumentieren" nutzen.')}
          next={[
            {
              label: tx('Behandlung dokumentieren'),
              href: '#/intents/behandlung-dokumentieren',
            },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
