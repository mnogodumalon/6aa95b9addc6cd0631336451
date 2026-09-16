import { useEffect, useMemo, useState } from 'react';
import { PublicShell } from '@/components/PublicShell';
import {
  loadPublicPagesConfig,
  createPublicRecord,
  PageUnavailableError,
  type PublicPagesConfig,
  type PublicPageConfig,
} from '@/lib/publicClient';
import { createPublicPort } from '@/lib/journey/publicPort';
import {
  useStepForm,
  useJourneySubmit,
  useRecordSearch,
  nowIso,
  type JourneyRecord,
} from '@/lib/journey';
import { IntentWizardShell, type WizardStep } from '@/components/blocks/IntentWizardShell';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { Field } from '@/components/blocks/Field';
import { Bound } from '@/components/blocks/Bound';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { tx } from '@/i18n';
import { format, addMinutes, parseISO } from 'date-fns';

interface BehandlerItem {
  id: string;
  title: string;
  subtitle?: string;
}

export default function Terminanfrage() {
  const STEPS: WizardStep[] = [
  { label: tx('Persönliche Daten'), key: 'patient' },
  { label: tx('Terminwunsch'), key: 'termin' },
  { label: tx('Prüfen'), key: 'zusammenfassung' },
];

  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [step, setStep] = useState(1);

  useEffect(() => {
    loadPublicPagesConfig('terminanfrage')
      .then(c => {
        setCfg(c);
        setPage(c?.pages['terminanfrage'] ?? null);
        setLoading(false);
        if (!c?.pages['terminanfrage']) setUnavailable(true);
      })
      .catch(err => {
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
    fields: ['behandler', 'beginn', 'bemerkung'],
    required: {
      behandler: true,
      beginn: true,
      bemerkung: false,
    },
    steps: {
      behandler: 2,
      beginn: 2,
      bemerkung: 2,
    },
    autoComplete: true,
  });

  const behandlerSearch = useRecordSearch<'behandler', BehandlerItem>(
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    port!,
    'behandler',
    {
      searchFields: ['vorname', 'nachname'],
      toItem: (r: JourneyRecord): BehandlerItem => ({
        id: r.id,
        title: `${r.fields.vorname as string} ${r.fields.nachname as string}`,
        subtitle: (r.fields.kuerzel as string) ?? undefined,
      }),
    },
  );

  const submit = useJourneySubmit(
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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
        values: (ctx) => {
          const beginnVal = terminForm.get('beginn') as string | null;
          if (!beginnVal) return {};
          const beginnDate = parseISO(beginnVal);
          const endeDate = addMinutes(beginnDate, 60);
          const endeFormatted = format(endeDate, "yyyy-MM-dd'T'HH:mm");
          const behandlerId = terminForm.get('behandler') as string | null;
          const behandlerEp = page?.endpoints?.find(
            e => e.entity === 'behandler' && e.op === 'list',
          );
          return {
            ende: endeFormatted,
            behandler: behandlerId && behandlerEp?.app_id
              ? ctx.port.ref(behandlerEp.app_id, behandlerId)
              : undefined,
          };
        },
      },
    ],
    { draftKey: 'terminanfrage' },
  );

  if (loading) return <PublicShell loading />;
  if (unavailable || !cfg || !page || !port) return <PublicShell unavailable />;

  const handleRestart = () => {
    submit.reset();
    patientForm.reset();
    terminForm.reset();
    setStep(1);
  };

  return (
    <PublicShell title={tx('Terminanfrage')} description={tx('Stellen Sie Ihre Anfrage – wir melden uns schnellstmöglich bei Ihnen.')}>
      <IntentWizardShell
        steps={STEPS}
        currentStep={step}
        onStepChange={setStep}
        back={false}
        forms={[patientForm, terminForm]}
        draftKey="terminanfrage"
      >
        {/* Step 1 — Persönliche Daten */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field form={patientForm} name="vorname">
                <Bound form={patientForm} name="vorname" />
              </Field>
              <Field form={patientForm} name="nachname">
                <Bound form={patientForm} name="nachname" />
              </Field>
            </div>
            <Bound form={patientForm} name="geburtsdatum" />
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
                patientForm.validate(['vorname', 'nachname', 'geburtsdatum', 'versicherungsart'])
              }
              nextStepLabel={tx('Terminwunsch')}
              hideBack
            />
          </div>
        )}

        {/* Step 2 — Terminwunsch */}
        {step === 2 && (
          <div className="space-y-5">
            <Field form={terminForm} name="behandler" label={tx('Behandler')}>
              <EntitySelectStep
                {...behandlerSearch.select}
                selectedId={terminForm.get('behandler') as string | null}
                onSelect={(id) => {
                  const label = behandlerSearch.labelOf(id) ?? id;
                  terminForm.set('behandler', id, label);
                }}
                avatar="initials"
                emptyText={tx('Keine aktiven Behandler verfügbar')}
                id={terminForm.fieldId('behandler')}
                invalid={!!terminForm.error('behandler')}
                columns={2}
              />
            </Field>
            <Bound form={terminForm} name="beginn" label={tx('Datum und Uhrzeit')} />
            <Field form={terminForm} name="bemerkung" label={tx('Anliegen / Bemerkung')}>
              <Bound form={terminForm} name="bemerkung" as="textarea" rows={4} />
            </Field>
            <StepNav
              onBack={() => setStep(1)}
              onNext={() => terminForm.validate(['behandler', 'beginn'])}
              nextStepLabel={tx('Prüfen')}
            />
          </div>
        )}

        {/* Step 3 — Zusammenfassung */}
        {step === 3 && !submit.done && (
          <SummaryStep
            forms={[patientForm, terminForm]}
            submit={submit}
            whatHappensNext={tx('Wir prüfen Ihre Anfrage und melden uns so bald wie möglich bei Ihnen.')}
            confirmLabel={tx('Anfrage absenden')}
          />
        )}

        {/* Erfolgsmeldung */}
        {submit.result && (
          <SuccessStep
            result={submit.result}
            title={tx('Ihre Terminanfrage wurde übermittelt')}
            whatHappensNext={tx('Vielen Dank! Wir haben Ihre Anfrage erhalten und werden uns in Kürze bei Ihnen melden, um den Termin zu bestätigen.')}
            next={[{ label: tx('Neue Anfrage stellen'), onClick: handleRestart }]}
            actions={{ copy: false, print: false }}
          />
        )}
      </IntentWizardShell>
    </PublicShell>
  );
}
