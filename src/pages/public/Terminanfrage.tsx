import { useEffect, useMemo, useState } from 'react';
import { PublicShell } from '@/components/PublicShell';
import {
  loadPublicPagesConfig,
  prepareChallenge,
  PageUnavailableError,
  type PublicPagesConfig,
  type PublicPageConfig,
} from '@/lib/publicClient';
import { createPublicPort } from '@/lib/journey/publicPort';
import {
  useStepForm,
  useJourneySubmit,
  useRecordSearch,
  fieldLookup,
  type JourneyRecord,
} from '@/lib/journey';
import { IntentWizardShell, type WizardStep } from '@/components/blocks/IntentWizardShell';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { ChoiceGroup } from '@/components/blocks/ChoiceGroup';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Field } from '@/components/blocks/Field';
import { Bound } from '@/components/blocks/Bound';
import { tx } from '@/i18n';

const SLUG = 'terminanfrage';

interface BehandlerItem {
  id: string;
  title: string;
}

export default function Terminanfrage() {
  const STEPS: WizardStep[] = [
  { label: tx('Persönliche Daten'), key: 'patient' },
  { label: tx('Wunschtermin'), key: 'termin' },
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
      if (err instanceof PageUnavailableError) {
        setUnavailable(true);
      }
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

  const termineForm = useStepForm('termine', {
    fields: ['patient', 'behandler', 'beginn', 'bemerkung'],
    required: {
      behandler: true,
      beginn: true,
    },
    steps: {
      behandler: 2,
      beginn: 2,
      bemerkung: 2,
    },
    autoComplete: true,
  });

  const behandlerSearch = useRecordSearch<'behandler', BehandlerItem>(
    port ?? ({} as never),
    'behandler',
    {
      searchFields: ['vorname', 'nachname'],
      filter: "r.v_status == 'aktiv'",
      toItem: (r: JourneyRecord): BehandlerItem => ({
        id: r.id,
        title: `${r.fields.vorname as string} ${r.fields.nachname as string}`,
      }),
      orderby: ['r.v_nachname'],
    },
  );

  const submit = useJourneySubmit(
    port ?? ({} as never),
    [
      {
        key: 'patient',
        entity: 'patienten',
        form: patientForm,
      },
      {
        key: 'termin',
        entity: 'termine',
        form: termineForm,
        primary: true,
        needs: ['patient'],
        link: { patient: 'patient' },
      },
    ],
    { draftKey: 'terminanfrage' },
  );

  if (loading || (!cfg && !unavailable)) {
    return <PublicShell loading />;
  }
  if (unavailable || !cfg || !page) {
    return <PublicShell unavailable />;
  }

  const versicherungsartOptions = [
    { key: 'gesetzlich', label: tx('Gesetzlich') },
    { key: 'privat', label: tx('Privat') },
    { key: 'selbstzahler', label: tx('Selbstzahler') },
  ];

  const selectedBehandlerId = termineForm.get('behandler') as string | null;
  const selectedBehandlerName =
    selectedBehandlerId ? behandlerSearch.labelOf(selectedBehandlerId) ?? '' : '';
  const beginValue = termineForm.get('beginn') as string | null;

  const handleFirstInteraction = () => {
    const ep = page.endpoints?.find(e => e.entity === 'patienten' && e.op === 'create');
    if (ep?.app_id) {
      prepareChallenge(cfg, page, 'POST', `/apps/${ep.app_id}/records`);
    }
  };

  const restart = () => {
    submit.reset();
    patientForm.reset();
    termineForm.reset();
    setStep(1);
  };

  return (
    <PublicShell
      title={tx('Terminanfrage')}
      description={tx('Füllen Sie das Formular aus, um einen Wunschtermin anzufragen. Wir melden uns zeitnah bei Ihnen.')}
    >
      <IntentWizardShell
        steps={STEPS}
        currentStep={step}
        onStepChange={setStep}
        back={false}
        forms={[patientForm, termineForm]}
        draftKey="terminanfrage"
      >
        {/* Step 1 — Persönliche Daten */}
        {step === 1 && !submit.done && (
          <div className="space-y-4" onFocus={handleFirstInteraction}>
            <Field form={patientForm} name="vorname" label={tx('Vorname')}>
              <Bound form={patientForm} name="vorname" />
            </Field>
            <Field form={patientForm} name="nachname" label={tx('Nachname')}>
              <Bound form={patientForm} name="nachname" />
            </Field>
            <Field form={patientForm} name="geburtsdatum" label={tx('Geburtsdatum')}>
              <Bound form={patientForm} name="geburtsdatum" />
            </Field>
            <Field form={patientForm} name="telefon" label={tx('Telefon')}>
              <Bound form={patientForm} name="telefon" />
            </Field>
            <Field form={patientForm} name="email" label={tx('E-Mail')}>
              <Bound form={patientForm} name="email" />
            </Field>
            <Field form={patientForm} name="krankenkasse" label={tx('Krankenkasse')}>
              <Bound form={patientForm} name="krankenkasse" />
            </Field>
            <Field form={patientForm} name="versicherungsart" label={tx('Versicherungsart')}>
              <ChoiceGroup
                {...patientForm.choice('versicherungsart')}
                options={versicherungsartOptions}
              />
            </Field>
            <StepNav
              onNext={() => patientForm.validate(['vorname', 'nachname', 'geburtsdatum', 'versicherungsart'])}
              nextStepLabel={tx('Wunschtermin')}
              hideBack
            />
          </div>
        )}

        {/* Step 2 — Wunschtermin */}
        {step === 2 && !submit.done && (
          <div className="space-y-4">
            <Field form={termineForm} name="behandler" label={tx('Gewünschter Behandler')}>
              <EntitySelectStep
                {...behandlerSearch.select}
                id={termineForm.fieldId('behandler')}
                invalid={termineForm.error('behandler') !== undefined}
                selectedId={selectedBehandlerId}
                onSelect={(id: string) => {
                  const label = behandlerSearch.labelOf(id) ?? '';
                  termineForm.set('behandler', id, label);
                }}
                avatar="initials"
                emptyText={tx('Keine aktiven Behandler gefunden.')}
                columns={2}
              />
            </Field>
            <Field form={termineForm} name="beginn" label={tx('Wunschtermin')}>
              <Bound form={termineForm} name="beginn" />
            </Field>
            <Field form={termineForm} name="bemerkung" label={tx('Anliegen / Bemerkung')}>
              <Bound form={termineForm} name="bemerkung" as="textarea" rows={4} />
            </Field>
            <StepNav
              onBack={() => setStep(1)}
              onNext={() => termineForm.validate(['behandler', 'beginn'])}
              nextStepLabel={tx('Zusammenfassung')}
            />
          </div>
        )}

        {/* Step 3 — Zusammenfassung */}
        {step === 3 && !submit.done && (
          <SummaryStep
            forms={[patientForm, termineForm]}
            submit={submit}
            whatHappensNext={tx('Wir prüfen Ihre Anfrage und melden uns telefonisch oder per E-Mail bei Ihnen.')}
            confirmLabel={tx('Anfrage absenden')}
          />
        )}

        {/* Erfolg */}
        {submit.done && submit.result && (
          <SuccessStep
            result={submit.result}
            title={tx('Ihre Anfrage ist eingegangen.')}
            whatHappensNext={
              <div className="space-y-1 text-sm">
                {selectedBehandlerName && (
                  <p>{tx('Gewünschter Behandler')}: <strong>{selectedBehandlerName}</strong></p>
                )}
                {beginValue && (
                  <p>{tx('Wunschtermin')}: <strong>{beginValue.replace('T', ' ')}</strong></p>
                )}
                <p>{tx('Wir melden uns telefonisch oder per E-Mail bei Ihnen.')}</p>
              </div>
            }
            forms={[patientForm, termineForm]}
            submit={submit}
            restartLabel={tx('Weitere Anfrage stellen')}
            next={[{ label: tx('Weitere Anfrage stellen'), onClick: restart }]}
          />
        )}
      </IntentWizardShell>
    </PublicShell>
  );
}
