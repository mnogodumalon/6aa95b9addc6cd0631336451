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
  fieldText,
} from '@/lib/journey';
import { IntentWizardShell, type WizardStep } from '@/components/blocks/IntentWizardShell';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { EntitySelectStep, type SelectItem } from '@/components/blocks/EntitySelectStep';
import { Field } from '@/components/blocks/Field';
import { Bound } from '@/components/blocks/Bound';
import { tx } from '@/i18n';

const SLUG = 'terminanfrage';

interface BehandlerItem extends SelectItem {
  id: string;
  title: string;
  subtitle?: string;
}

export default function Terminanfrage() {
  const STEPS: WizardStep[] = [
  {
    label: tx('Persönliche Daten'),
    key: 'patient',
    description: tx('Bitte geben Sie Ihre persönlichen Daten ein.'),
  },
  {
    label: tx('Behandler wählen'),
    key: 'behandler',
    description: tx('Wählen Sie einen verfügbaren Behandler aus.'),
  },
  {
    label: tx('Wunschtermin'),
    key: 'termin',
    description: tx('Geben Sie Ihren Wunschtermin und Ihr Anliegen an.'),
  },
  {
    label: tx('Prüfen & Absenden'),
    key: 'summary',
  },
];

  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [step, setStep] = useState(1);
  const [selectedBehandlerId, setSelectedBehandlerId] = useState<string | null>(null);
  const [selectedBehandlerLabel, setSelectedBehandlerLabel] = useState<string>('');

  useEffect(() => {
    loadPublicPagesConfig(SLUG)
      .then((c) => {
        setCfg(c);
        setPage(c?.pages[SLUG] ?? null);
        setLoading(false);
        if (!c?.pages[SLUG]) setUnavailable(true);
      })
      .catch((err) => {
        if (err instanceof PageUnavailableError) setUnavailable(true);
        setLoading(false);
      });
  }, []);

  const port = useMemo(
    () => (cfg && page ? createPublicPort(cfg, page) : null),
    [cfg, page],
  );

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

  const behandlerSearch = useRecordSearch<'behandler', BehandlerItem>(
    port!,
    'behandler',
    {
      searchFields: ['vorname', 'nachname'],
      toItem: (record) => ({
        id: record.id,
        title: `${fieldText(record, 'vorname')} ${fieldText(record, 'nachname')}`.trim(),
        subtitle: fieldText(record, 'kuerzel') || undefined,
      }),
      filter: "r.v_status == 'aktiv'",
    },
  );

  const submit = useJourneySubmit(
    port!,
    [
      {
        key: 'patient',
        entity: 'patienten',
        form: patientForm,
      },
      {
        key: 'termin',
        entity: 'termine',
        form: terminForm,
        primary: true,
        needs: ['patient'],
        link: { patient: 'patient' },
        values: () => ({
          behandler: selectedBehandlerId && port
            ? (() => {
                const ep = page?.endpoints?.find(
                  (e) => e.entity === 'behandler' && e.op === 'list',
                );
                return ep?.app_id
                  ? port.ref(ep.app_id, selectedBehandlerId)
                  : selectedBehandlerId;
              })()
            : undefined,
        }),
      },
    ],
    { draftKey: 'terminanfrage' },
  );

  const handleRestart = () => {
    patientForm.reset();
    terminForm.reset();
    setSelectedBehandlerId(null);
    setSelectedBehandlerLabel('');
    submit.reset();
    setStep(1);
  };

  if (loading) return <PublicShell loading />;
  if (unavailable || !cfg || !page || !port) return <PublicShell unavailable />;

  return (
    <PublicShell
      title={tx('Terminanfrage')}
      description={tx('Stellen Sie online eine Terminanfrage. Wir melden uns schnellstmöglich bei Ihnen.')}
    >
      <IntentWizardShell
        steps={STEPS}
        currentStep={step}
        onStepChange={setStep}
        back={false}
        forms={[patientForm, terminForm]}
        draftKey="terminanfrage"
      >
        {/* Schritt 1: Persönliche Daten */}
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
            <Field form={patientForm} name="telefon">
              <Bound form={patientForm} name="telefon" />
            </Field>
            <Field form={patientForm} name="email">
              <Bound form={patientForm} name="email" />
            </Field>
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
              hideBack
            />
          </div>
        )}

        {/* Schritt 2: Behandler wählen */}
        {step === 2 && (
          <div className="space-y-4">
            <EntitySelectStep
              {...behandlerSearch.select}
              selectedId={selectedBehandlerId}
              onSelect={(id) => {
                setSelectedBehandlerId(id);
                const label = behandlerSearch.labelOf(id) ?? '';
                setSelectedBehandlerLabel(label);
              }}
              avatar="initials"
              searchPlaceholder={tx('Behandler suchen …')}
              emptyText={tx('Derzeit sind keine Behandler verfügbar.')}
            />
            <StepNav
              onBack={() => setStep(1)}
              onNext={() => {
                if (!selectedBehandlerId) return tx('Bitte wählen Sie einen Behandler aus.');
                return true;
              }}
              nextStepLabel={tx('Wunschtermin')}
            />
          </div>
        )}

        {/* Schritt 3: Wunschtermin */}
        {step === 3 && (
          <div className="space-y-4">
            <Field form={terminForm} name="beginn" label={tx('Datum und Uhrzeit des Wunschtermins')}>
              <Bound form={terminForm} name="beginn" />
            </Field>
            <Field form={terminForm} name="bemerkung" label={tx('Anliegen / Bemerkung')}>
              <Bound form={terminForm} name="bemerkung" rows={4} />
            </Field>
            <StepNav
              onBack={() => setStep(2)}
              onNext={() => terminForm.validate(['beginn'])}
              nextStepLabel={tx('Prüfen & Absenden')}
            />
          </div>
        )}

        {/* Schritt 4: Zusammenfassung */}
        {step === 4 && !submit.done && (
          <div className="space-y-4">
            <SummaryStep
              forms={[patientForm, terminForm]}
              submit={submit}
              items={
                selectedBehandlerLabel
                  ? [{ key: 'behandler', label: tx('Behandler'), value: selectedBehandlerLabel, step: 2 }]
                  : []
              }
              whatHappensNext={tx('Wir prüfen Ihren Wunschtermin und melden uns so schnell wie möglich bei Ihnen.')}
              confirmLabel={tx('Terminanfrage absenden')}
            />
          </div>
        )}

        {/* Erfolgsmeldung */}
        {submit.result && (
          <SuccessStep
            result={submit.result}
            forms={[patientForm, terminForm]}
            title={tx('Terminanfrage eingegangen')}
            whatHappensNext={tx('Wir prüfen Ihren Wunschtermin und melden uns so schnell wie möglich bei Ihnen.')}
            facts={[
              {
                label: tx('Patient'),
                value: `${patientForm.get('vorname') as string} ${patientForm.get('nachname') as string}`.trim(),
              },
              { label: tx('Behandler'), value: selectedBehandlerLabel },
            ]}
            next={[{ label: tx('Weitere Anfrage stellen'), onClick: handleRestart }]}
            submit={submit}
            restartLabel={tx('Weitere Anfrage stellen')}
          />
        )}
      </IntentWizardShell>
    </PublicShell>
  );
}
