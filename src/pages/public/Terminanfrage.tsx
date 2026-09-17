import { useEffect, useMemo, useState } from 'react';
import { PublicShell } from '@/components/PublicShell';
import {
  loadPublicPagesConfig,
  PageUnavailableError,
  type PublicPagesConfig,
  type PublicPageConfig,
} from '@/lib/publicClient';
import { createPublicPort } from '@/lib/journey/publicPort';
import {
  useStepForm,
  useJourneySubmit,
  useRecordSearch,
  type JourneyRecord,
} from '@/lib/journey';
import { tx } from '@/i18n';
import { IntentWizardShell, type WizardStep } from '@/components/blocks/IntentWizardShell';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { Field } from '@/components/blocks/Field';
import { Bound } from '@/components/blocks/Bound';
import { EntitySelectStep, type SelectItem } from '@/components/blocks/EntitySelectStep';

const SLUG = 'terminanfrage';

interface BehandlerItem extends SelectItem {
  id: string;
  title: string;
  subtitle?: string;
}

export default function Terminanfrage() {
  const WIZARD_STEPS: WizardStep[] = [
  { label: tx('Patientendaten'), key: 'patient', description: tx('Bitte geben Sie Ihre persönlichen Daten ein.') },
  { label: tx('Behandler wählen'), key: 'behandler', description: tx('Wählen Sie Ihren gewünschten Behandler.') },
  { label: tx('Wunschtermin'), key: 'termin', description: tx('Geben Sie Ihren Wunschtermin und ein Anliegen an.') },
  { label: tx('Zusammenfassung'), key: 'zusammenfassung' },
];

  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [step, setStep] = useState(1);

  useEffect(() => {
    loadPublicPagesConfig(SLUG)
      .then(c => {
        setCfg(c);
        setPage(c?.pages[SLUG] ?? null);
        setLoading(false);
        if (!c?.pages[SLUG]) setUnavailable(true);
      })
      .catch(err => {
        setLoading(false);
        if (err instanceof PageUnavailableError) setUnavailable(true);
      });
  }, []);

  const port = useMemo(
    () => (cfg && page ? createPublicPort(cfg, page) : null),
    [cfg, page],
  );

  // --- forms (all hooks before any early return) ---
  const patientForm = useStepForm('patienten', {
    fields: ['vorname', 'nachname', 'geburtsdatum', 'telefon', 'email', 'krankenkasse', 'versicherungsart'],
    required: {
      vorname: true,
      nachname: true,
      geburtsdatum: true,
      telefon: false,
      email: false,
      krankenkasse: false,
      versicherungsart: true,
    },
    steps: {
      vorname: 1,
      nachname: 1,
      geburtsdatum: 1,
      telefon: 1,
      email: 1,
      krankenkasse: 1,
      versicherungsart: 1,
    },
    autoComplete: true,
  });

  const terminForm = useStepForm('termine', {
    fields: ['beginn', 'bemerkung'],
    required: {
      beginn: true,
      bemerkung: false,
    },
    steps: {
      beginn: 3,
      bemerkung: 3,
    },
    autoComplete: true,
  });

  // behandler search — only load when port is ready
  const behandlerSearch = useRecordSearch<'behandler', BehandlerItem>(
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    port!,
    'behandler',
    {
      searchFields: ['vorname', 'nachname', 'kuerzel'],
      where: (r: JourneyRecord) => {
        const status = r.fields['status'];
        return (
          typeof status === 'object' &&
          status !== null &&
          (status as { key?: string }).key === 'aktiv'
        );
      },
      toItem: (r: JourneyRecord): BehandlerItem => ({
        id: r.id,
        title: `${r.fields['vorname'] ?? ''} ${r.fields['nachname'] ?? ''}`.trim(),
        subtitle: (r.fields['kuerzel'] as string) ?? undefined,
      }),
      loadAllUpTo: 50,
    },
  );

  const [selectedBehandlerId, setSelectedBehandlerId] = useState<string | null>(null);

  const submit = useJourneySubmit(
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    port!,
    [
      { key: 'patient', entity: 'patienten', form: patientForm },
      {
        key: 'termin',
        entity: 'termine',
        form: terminForm,
        primary: true,
        needs: ['patient'],
        link: { patient: 'patient' },
        values: () => ({
          behandler: selectedBehandlerId
            ? port!.ref(
                page?.endpoints?.find(e => e.entity === 'behandler' && e.op === 'list')?.app_id ?? '',
                selectedBehandlerId,
              )
            : undefined,
        }),
      },
    ],
    { draftKey: SLUG },
  );

  if (loading || !cfg || !page || !port) {
    return <PublicShell loading={loading} unavailable={unavailable} />;
  }

  const handleRestart = () => {
    patientForm.reset();
    terminForm.reset();
    setSelectedBehandlerId(null);
    submit.reset();
    setStep(1);
  };

  const behandlerName =
    selectedBehandlerId
      ? behandlerSearch.labelOf(selectedBehandlerId) ?? tx('Unbekannt')
      : '';

  return (
    <PublicShell
      title={tx('Terminanfrage')}
      description={tx('Stellen Sie eine Anfrage für Ihren ersten Termin — ohne Anmeldung.')}
    >
      <IntentWizardShell
        steps={WIZARD_STEPS}
        currentStep={step}
        onStepChange={setStep}
        back={false}
        forms={[patientForm, terminForm]}
        draftKey={SLUG}
      >
        {/* Schritt 1: Patientendaten */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field form={patientForm} name="vorname">
                <Bound form={patientForm} name="vorname" />
              </Field>
              <Field form={patientForm} name="nachname">
                <Bound form={patientForm} name="nachname" />
              </Field>
            </div>
            <Field form={patientForm} name="geburtsdatum">
              <Bound form={patientForm} name="geburtsdatum" />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field form={patientForm} name="telefon">
                <Bound form={patientForm} name="telefon" />
              </Field>
              <Field form={patientForm} name="email">
                <Bound form={patientForm} name="email" />
              </Field>
            </div>
            <Field form={patientForm} name="krankenkasse">
              <Bound form={patientForm} name="krankenkasse" />
            </Field>
            <Field form={patientForm} name="versicherungsart">
              <Bound form={patientForm} name="versicherungsart" />
            </Field>
            <StepNav
              onNext={() =>
                patientForm.validate([
                  'vorname',
                  'nachname',
                  'geburtsdatum',
                  'versicherungsart',
                ])
              }
              nextStepLabel={tx('Behandler wählen')}
            />
          </div>
        )}

        {/* Schritt 2: Behandler wählen */}
        {step === 2 && (
          <div className="space-y-4">
            <EntitySelectStep
              {...behandlerSearch.select}
              selectedId={selectedBehandlerId}
              onSelect={(id: string) => {
                setSelectedBehandlerId(id);
                const label = behandlerSearch.labelOf(id);
                if (label) patientForm.remember(id, label);
              }}
              avatar="initials"
              emptyText={tx('Keine aktiven Behandler verfügbar.')}
              columns={2}
            />
            <StepNav
              onNext={() => {
                if (!selectedBehandlerId) return tx('Bitte wählen Sie einen Behandler aus.');
                return true;
              }}
              onBack={() => setStep(1)}
              nextStepLabel={tx('Wunschtermin')}
            />
          </div>
        )}

        {/* Schritt 3: Wunschtermin */}
        {step === 3 && (
          <div className="space-y-4">
            <Field form={terminForm} name="beginn">
              <Bound form={terminForm} name="beginn" />
            </Field>
            <Field form={terminForm} name="bemerkung" hint={tx('Beschreiben Sie kurz Ihr Anliegen (optional).')}>
              <Bound form={terminForm} name="bemerkung" rows={4} />
            </Field>
            <StepNav
              onBack={() => setStep(2)}
              onNext={() => terminForm.validate(['beginn'])}
              nextStepLabel={tx('Zusammenfassung')}
            />
          </div>
        )}

        {/* Schritt 4: Zusammenfassung + Abschicken */}
        {step === 4 && !submit.done && (
          <SummaryStep
            forms={[patientForm, terminForm]}
            submit={submit}
            items={[
              {
                key: 'behandler',
                label: tx('Behandler'),
                value: behandlerName,
                step: 2,
              },
            ]}
            whatHappensNext={tx(
              'Wir prüfen Ihre Anfrage und melden uns schnellstmöglich bei Ihnen.',
            )}
            confirmLabel={tx('Terminanfrage absenden')}
          />
        )}

        {/* Erfolg */}
        {submit.result && (
          <SuccessStep
            result={submit.result}
            forms={[patientForm, terminForm]}
            title={tx('Terminanfrage eingegangen')}
            whatHappensNext={tx(
              'Wir haben Ihre Anfrage erhalten und werden uns in Kürze mit Ihnen in Verbindung setzen, um den Termin zu bestätigen.',
            )}
            next={[{ label: tx('Neue Anfrage stellen'), onClick: handleRestart }]}
            submit={submit}
            restartLabel={tx('Neue Anfrage stellen')}
          />
        )}
      </IntentWizardShell>
    </PublicShell>
  );
}
