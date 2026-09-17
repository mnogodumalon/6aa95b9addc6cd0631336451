import { useEffect, useMemo, useState } from 'react';
import { PublicShell } from '@/components/PublicShell';
import {
  loadPublicPagesConfig,
  PageUnavailableError,
  prepareChallenge,
  type PublicPageConfig,
  type PublicPagesConfig,
} from '@/lib/publicClient';
import { createPublicPort } from '@/lib/journey/publicPort';
import { useStepForm, useJourneySubmit, useRecordSearch } from '@/lib/journey';
import { fieldText } from '@/lib/journey';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { Bound } from '@/components/blocks/Bound';
import { Field } from '@/components/blocks/Field';
import { ChoiceGroup } from '@/components/blocks/ChoiceGroup';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { tx } from '@/i18n';

const SLUG = 'terminanfrage';

export default function Terminanfrage() {
  const STEPS = [
  {
    label: tx('Persönliche Daten'),
    key: 'patient',
    description: tx('Bitte fülle deine Kontaktdaten aus.'),
    needs: ['vorname', 'nachname', 'geburtsdatum', 'versicherungsart'],
  },
  {
    label: tx('Terminwunsch'),
    key: 'termin',
    description: tx('Wähle deinen Wunschtermin und Behandler.'),
    needs: ['behandler', 'beginn'],
  },
  {
    label: tx('Zusammenfassung'),
    key: 'zusammenfassung',
  },
];

  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [step, setStep] = useState(1);

  useEffect(() => {
    loadPublicPagesConfig(SLUG).then(c => {
      setCfg(c);
      setPage(c?.pages[SLUG] ?? null);
      setLoading(false);
    }).catch(err => {
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
      versicherungsart: true,
      telefon: false,
      email: false,
      krankenkasse: false,
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
    // 'patient' is filled by the plan's link: { patient: 'patient' } — the
    // journey layer writes the grant-scoped reference; no visitor input needed.
    fields: ['patient', 'behandler', 'beginn', 'bemerkung'],
    required: {
      patient: true,
      behandler: true,
      beginn: true,
      bemerkung: false,
    },
    steps: {
      patient: 2,
      behandler: 2,
      beginn: 2,
      bemerkung: 2,
    },
    autoComplete: true,
  });

  const behandlerSearch = useRecordSearch(
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    port!,
    'behandler',
    {
      searchFields: ['vorname', 'nachname'],
      toItem: (r) => ({
        id: r.id,
        title: `${fieldText(r, 'vorname')} ${fieldText(r, 'nachname')}`.trim(),
      }),
    },
  );

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
      },
    ],
    { draftKey: 'terminanfrage' },
  );

  // Prepare challenge on first interaction
  const handleFirstInteraction = () => {
    const createEp = page?.endpoints?.find(e => e.entity === 'termine' && e.op === 'create');
    if (cfg && page && createEp?.app_id) {
      prepareChallenge(cfg, page, 'POST', `/apps/${createEp.app_id}/records`);
    }
  };

  if (loading) return <PublicShell loading />;
  if (unavailable || !cfg || !page || !port) return <PublicShell unavailable />;

  const handleRestart = () => {
    patientForm.reset();
    terminForm.reset();
    submit.reset();
    setStep(1);
  };

  return (
    <PublicShell
      title={tx('Terminanfrage')}
      description={tx('Neue Patienten können hier eine Terminanfrage stellen.')}
    >
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div onFocus={handleFirstInteraction} onPointerDown={handleFirstInteraction}>
        <IntentWizardShell
          steps={STEPS}
          currentStep={step}
          onStepChange={setStep}
          back={false}
          forms={[patientForm, terminForm]}
          draftKey="terminanfrage"
        >
          {/* Step 1: Persönliche Daten */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Bound form={patientForm} name="vorname" />
                <Bound form={patientForm} name="nachname" />
              </div>
              <Bound form={patientForm} name="geburtsdatum" />
              <Bound form={patientForm} name="telefon" />
              <Bound form={patientForm} name="email" />
              <Bound form={patientForm} name="krankenkasse" label={tx('Krankenkasse')} />
              <Field form={patientForm} name="versicherungsart" label={tx('Versicherungsart')}>
                <ChoiceGroup
                  {...patientForm.choice('versicherungsart')}
                />
              </Field>
              <StepNav
                onNext={() => patientForm.validate(['vorname', 'nachname', 'geburtsdatum', 'versicherungsart'])}
                nextStepLabel={tx('Terminwunsch')}
              />
            </div>
          )}

          {/* Step 2: Terminwunsch */}
          {step === 2 && (
            <div className="space-y-4">
              <Field form={terminForm} name="behandler" label={tx('Behandler')}>
                <EntitySelectStep
                  {...behandlerSearch.select}
                  {...terminForm.record('behandler')}
                  onSelect={(id) => {
                    terminForm.set('behandler', id, behandlerSearch.labelOf(id) ?? id);
                  }}
                  selectedId={terminForm.get('behandler') as string | null}
                  avatar="initials"
                  emptyText={tx('Kein aktiver Behandler verfügbar.')}
                />
              </Field>
              <Bound form={terminForm} name="beginn" label={tx('Wunschtermin (Datum und Uhrzeit)')} />
              <Bound form={terminForm} name="bemerkung" label={tx('Anliegen / Bemerkung')} rows={4} />
              <StepNav
                onBack={() => setStep(1)}
                onNext={() => terminForm.validate(['behandler', 'beginn'])}
                nextStepLabel={tx('Zusammenfassung')}
              />
            </div>
          )}

          {/* Step 3: Summary & Success */}
          {step === 3 && !submit.result && (
            <SummaryStep
              forms={[patientForm, terminForm]}
              submit={submit}
              whatHappensNext={tx('Wir melden uns in Kürze bei dir, um deinen Termin zu bestätigen.')}
            />
          )}

          {submit.result && (
            <SuccessStep
              result={submit.result}
              forms={[patientForm, terminForm]}
              title={tx('Vielen Dank! Wir melden uns in Kürze bei dir, um deinen Termin zu bestätigen.')}
              whatHappensNext={tx('Wir melden uns in Kürze bei dir, um deinen Termin zu bestätigen.')}
              next={[{ label: tx('Neue Anfrage stellen'), onClick: handleRestart }]}
              submit={submit}
              restartLabel={tx('Neue Anfrage stellen')}
            />
          )}
        </IntentWizardShell>
      </div>
    </PublicShell>
  );
}
