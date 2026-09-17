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
import {
  fieldLookup,
  useJourneySubmit,
  useRecordSearch,
  useStepForm,
  type JourneyRecord,
} from '@/lib/journey';
import { IntentWizardShell, type WizardStep } from '@/components/blocks/IntentWizardShell';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { Bound } from '@/components/blocks/Bound';
import { Field } from '@/components/blocks/Field';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { tx } from '@/i18n';

const SLUG = 'terminanfrage';

interface BehandlerItem {
  id: string;
  title: string;
  subtitle?: string;
}

function toBehandlerItem(r: JourneyRecord): BehandlerItem {
  const vorname = (r.fields.vorname as string) ?? '';
  const nachname = (r.fields.nachname as string) ?? '';
  const kuerzel = (r.fields.kuerzel as string) ?? '';
  return {
    id: r.id,
    title: `${vorname} ${nachname}`.trim(),
    subtitle: kuerzel,
  };
}

export default function Terminanfrage() {
  const STEPS: WizardStep[] = [
  {
    label: tx('Patientendaten'),
    key: 'patient',
    description: tx('Bitte deine persönlichen Daten eingeben.'),
  },
  {
    label: tx('Terminwunsch'),
    key: 'termin',
    description: tx('Behandler wählen und Wunschtermin angeben.'),
  },
  { label: tx('Prüfen'), key: 'summary' },
];

  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);

  useEffect(() => {
    loadPublicPagesConfig(SLUG)
      .then(c => {
        setCfg(c);
        setPage(c?.pages[SLUG] ?? null);
      })
      .catch(err => {
        if (err instanceof PageUnavailableError) {
          setPage(null);
        }
      })
      .finally(() => setLoading(false));
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

  const terminForm = useStepForm('termine', {
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

  const behandlerSearch = useRecordSearch(
    port ?? { door: 'public' } as never,
    'behandler',
    {
      searchFields: ['vorname', 'nachname', 'kuerzel'],
      toItem: toBehandlerItem,
      filter: "r.v_status == 'aktiv'",
      where: r => fieldLookup(r, 'status')?.key === 'aktiv',
    },
  );

  const submit = useJourneySubmit(
    port ?? ({ door: 'public' } as never),
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
      },
    ],
    { draftKey: 'terminanfrage' },
  );

  if (loading) return <PublicShell loading />;
  if (!cfg || !page || !port) return <PublicShell unavailable />;

  const behandlerEp = page.endpoints?.find(e => e.entity === 'behandler' && e.op === 'list');

  const handlePatientNext = () => {
    if (behandlerEp) {
      prepareChallenge(cfg, page, 'POST', `/apps/${behandlerEp.app_id ?? ''}/records`);
    }
    return patientForm.validate(['vorname', 'nachname', 'geburtsdatum', 'versicherungsart']);
  };

  const handleTerminNext = () =>
    terminForm.validate(['behandler', 'beginn']);

  const handleRestart = () => {
    submit.reset();
    patientForm.reset();
    terminForm.reset();
    setStep(1);
  };

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
        {/* Step 1: Patientendaten */}
        {step === 1 && (
          <div className="space-y-4">
            <Bound form={patientForm} name="vorname" />
            <Bound form={patientForm} name="nachname" />
            <Bound form={patientForm} name="geburtsdatum" />
            <Bound form={patientForm} name="telefon" />
            <Bound form={patientForm} name="email" />
            <Bound form={patientForm} name="krankenkasse" />
            <Bound form={patientForm} name="versicherungsart" />
            <StepNav
              onNext={handlePatientNext}
              nextStepLabel={tx('Terminwunsch')}
            />
          </div>
        )}

        {/* Step 2: Terminwunsch */}
        {step === 2 && (
          <div className="space-y-6">
            <Field form={terminForm} name="behandler" label={tx('Behandler wählen')}>
              <EntitySelectStep
                {...behandlerSearch.select}
                id={terminForm.fieldId('behandler')}
                invalid={!!terminForm.error('behandler')}
                selectedId={terminForm.get('behandler') as string | null}
                onSelect={id => {
                  const label = behandlerSearch.labelOf(id);
                  terminForm.set('behandler', id, label ?? id);
                }}
                avatar="initials"
                emptyText={tx('Keine aktiven Behandler gefunden.')}
              />
            </Field>

            <Bound form={terminForm} name="beginn" label={tx('Wunschtermin')} />

            <Bound form={terminForm} name="bemerkung" label={tx('Anliegen')} />

            <StepNav
              onNext={handleTerminNext}
              nextStepLabel={tx('Prüfen')}
            />
          </div>
        )}

        {/* Step 3: Summary + Success */}
        {step === 3 && !submit.result && (
          <SummaryStep
            forms={[patientForm, terminForm]}
            submit={submit}
            whatHappensNext={tx('Wir melden uns so schnell wie möglich bei dir, um den Termin zu bestätigen.')}
          />
        )}

        {submit.result && (
          <SuccessStep
            result={submit.result}
            forms={[patientForm, terminForm]}
            whatHappensNext={tx('Deine Anfrage ist bei uns eingegangen. Wir melden uns in Kürze, um den Termin zu bestätigen.')}
            next={[{ label: tx('Weitere Anfrage stellen'), onClick: handleRestart }]}
            submit={submit}
          />
        )}
      </IntentWizardShell>
    </PublicShell>
  );
}
