import { useEffect, useMemo, useState } from 'react';
import { PublicShell } from '@/components/PublicShell';
import {
  loadPublicPagesConfig,
  PageUnavailableError,
  prepareChallenge,
  recordRef,
  type PublicPageConfig,
  type PublicPagesConfig,
} from '@/lib/publicClient';
import { createPublicPort } from '@/lib/journey/publicPort';
import {
  useStepForm,
  useJourneySubmit,
  useRecordSearch,
} from '@/lib/journey';
import { IntentWizardShell, type WizardStep } from '@/components/blocks/IntentWizardShell';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { Bound } from '@/components/blocks/Bound';
import { Field } from '@/components/blocks/Field';
import { ChoiceGroup } from '@/components/blocks/ChoiceGroup';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { tx } from '@/i18n';
import type { JourneyRecord } from '@/lib/journey';

const SLUG = 'terminanfrage';

interface BehandlerItem {
  id: string;
  title: string;
}

export default function Terminanfrage() {
  const STEPS: WizardStep[] = [
  { label: tx('Persönliche Daten'), key: 'person', description: tx('Bitte gib deine Kontaktdaten ein.') },
  { label: tx('Krankenversicherung'), key: 'kasse', description: tx('Deine Versicherungsinformationen.') },
  { label: tx('Behandler & Terminwunsch'), key: 'termin', description: tx('Wähle einen Behandler und deinen Wunschtermin.') },
  { label: tx('Zusammenfassung'), key: 'zusammenfassung' },
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
      krankenkasse: 2,
      versicherungsart: 2,
    },
    autoComplete: true,
  });

  const terminForm = useStepForm('termine', {
    fields: ['patient', 'behandler', 'beginn', 'bemerkung'],
    required: {
      patient: true,
      behandler: true,
      beginn: true,
      bemerkung: false,
    },
    steps: {
      patient: 3,
      behandler: 3,
      beginn: 3,
      bemerkung: 3,
    },
    autoComplete: true,
  });

  const submit = useJourneySubmit(
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

  const behandlerSearch = useRecordSearch<'behandler', BehandlerItem>(
    port!,
    'behandler',
    {
      searchFields: ['vorname', 'nachname'],
      toItem: (r: JourneyRecord): BehandlerItem => ({
        id: r.id,
        title: `${r.fields.vorname as string} ${r.fields.nachname as string}`,
      }),
    },
  );

  if (loading) return <PublicShell loading />;
  if (unavailable || !cfg || !page || !port) return <PublicShell unavailable />;

  const behandlerEp = page.endpoints?.find(e => e.entity === 'behandler' && e.op === 'list');

  function handleFirstInteraction() {
    const patEp = page!.endpoints?.find(e => e.entity === 'patienten' && e.op === 'create');
    if (patEp?.app_id) {
      prepareChallenge(cfg!, page!, 'POST', `/apps/${patEp.app_id}/records`);
    }
  }

  function handleBehandlerSelect(id: string) {
    const label = behandlerSearch.labelOf(id);
    terminForm.set('behandler', id, label);
  }

  function handleRestart() {
    submit.reset();
    patientForm.reset();
    terminForm.reset();
    setStep(1);
  }

  return (
    <PublicShell
      title={page.title}
      description={page.description}
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
          <div className="space-y-4" onFocus={handleFirstInteraction}>
            <Bound form={patientForm} name="vorname" />
            <Bound form={patientForm} name="nachname" />
            <Bound form={patientForm} name="geburtsdatum" />
            <Bound form={patientForm} name="telefon" />
            <Bound form={patientForm} name="email" />
            <StepNav
              onNext={() => patientForm.validate(['vorname', 'nachname', 'geburtsdatum'])}
              nextStepLabel={tx('Krankenversicherung')}
            />
          </div>
        )}

        {/* Schritt 2: Krankenversicherung */}
        {step === 2 && (
          <div className="space-y-4">
            <Bound form={patientForm} name="krankenkasse" />
            <Field form={patientForm} name="versicherungsart">
              <ChoiceGroup {...patientForm.choice('versicherungsart')} />
            </Field>
            <StepNav
              onBack={() => setStep(1)}
              onNext={() => patientForm.validate(['versicherungsart'])}
              nextStepLabel={tx('Behandler & Terminwunsch')}
            />
          </div>
        )}

        {/* Schritt 3: Behandler & Terminwunsch */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <p className="text-sm font-medium mb-2">{tx('Behandler wählen')}</p>
              <EntitySelectStep
                {...behandlerSearch.select}
                selectedId={terminForm.get('behandler') as string | null}
                onSelect={handleBehandlerSelect}
                avatar="initials"
                emptyText={behandlerEp ? tx('Aktuell sind keine Behandler verfügbar.') : tx('Behandler werden geladen …')}
                mode="pills"
                id={terminForm.fieldId('behandler')}
                invalid={!!terminForm.error('behandler')}
              />
            </div>
            <Bound form={terminForm} name="beginn" />
            <Bound form={terminForm} name="bemerkung" rows={4} />
            <StepNav
              onBack={() => setStep(2)}
              onNext={() => terminForm.validate(['behandler', 'beginn'])}
              nextStepLabel={tx('Zusammenfassung')}
            />
          </div>
        )}

        {/* Schritt 4: Zusammenfassung */}
        {step === 4 && !submit.done && (
          <SummaryStep
            forms={[patientForm, terminForm]}
            submit={submit}
            whatHappensNext={tx('Wir melden uns in Kürze bei dir, um deinen Terminwunsch zu bestätigen.')}
          />
        )}

        {/* Erfolgsmeldung */}
        {submit.result && (
          <SuccessStep
            result={submit.result}
            forms={[patientForm, terminForm]}
            whatHappensNext={tx('Wir prüfen deinen Terminwunsch und melden uns so bald wie möglich bei dir.')}
            submit={submit}
            restartLabel={tx('Weitere Anfrage stellen')}
            actions={{ copy: false, print: false }}
          />
        )}
      </IntentWizardShell>
    </PublicShell>
  );
}
