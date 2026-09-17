import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PublicShell } from '@/components/PublicShell';
import {
  loadPublicPagesConfig,
  PageUnavailableError,
  prepareChallenge,
  type PublicPageConfig,
  type PublicPagesConfig,
} from '@/lib/publicClient';
import { createPublicPort } from '@/lib/journey/publicPort';
import { useJourneySubmit } from '@/lib/journey/useJourneySubmit';
import { useStepForm } from '@/lib/journey/useStepForm';
import { fieldLookup } from '@/lib/journey/fields';
import type { JourneyRecord } from '@/lib/journey/port';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Bound } from '@/components/blocks/Bound';
import { Field } from '@/components/blocks/Field';
import { tx } from '@/i18n';

const SLUG = 'terminanfrage';

interface BehandlerItem {
  id: string;
  title: string;
}

function toBehandlerItem(r: JourneyRecord): BehandlerItem {
  const vorname = (r.fields.vorname as string) ?? '';
  const nachname = (r.fields.nachname as string) ?? '';
  return { id: r.id, title: `${vorname} ${nachname}`.trim() };
}

function Inner({ cfg, page }: { cfg: PublicPagesConfig; page: PublicPageConfig }) {
  const STEPS = [
  {
    key: 'patient',
    label: tx('Patientendaten'),
    heading: tx('Patientendaten'),
    description: tx('Bitte gib deine persönlichen Daten ein.'),
  },
  {
    key: 'behandler',
    label: tx('Behandler wählen'),
    heading: tx('Behandler wählen'),
    description: tx('Wähle einen verfügbaren Behandler aus.'),
  },
  {
    key: 'termin',
    label: tx('Wunschtermin'),
    heading: tx('Wunschtermin'),
    description: tx('Wann möchtest du einen Termin haben?'),
  },
  {
    key: 'pruefen',
    label: tx('Prüfen & Absenden'),
  },
];

  const [step, setStep] = useState(1);

  const port = useMemo(() => createPublicPort(cfg, page), [cfg, page]);

  // Step 1: Patienten form
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

  // Step 2+3: Termin form
  // 'patient' is in fields so the plan's link can inject it at submit time.
  const terminForm = useStepForm('termine', {
    fields: ['patient', 'behandler', 'beginn', 'bemerkung'],
    required: {
      patient: true,
      behandler: true,
      beginn: true,
      bemerkung: false,
    },
    steps: {
      behandler: 2,
      beginn: 3,
      bemerkung: 3,
    },
    autoComplete: true,
  });

  // Load active Behandler (manual load — avoids useRecordSearch which pulls @/lib/sentry)
  const [behandlerItems, setBehandlerItems] = useState<BehandlerItem[]>([]);
  const [behandlerLoading, setBehandlerLoading] = useState(true);
  const labelMapRef = useRef(new Map<string, string>());
  const labelOf = useCallback((id: string) => labelMapRef.current.get(id), []);

  useEffect(() => {
    let cancelled = false;
    port.list('behandler').then((rows) => {
      if (cancelled) return;
      const active = rows.filter((r) => {
        const status = fieldLookup(r, 'status');
        return status?.key === 'aktiv';
      });
      const items = active.map(toBehandlerItem);
      for (const item of items) labelMapRef.current.set(item.id, item.title);
      setBehandlerItems(items);
      setBehandlerLoading(false);
    }).catch(() => { if (!cancelled) setBehandlerLoading(false); });
    return () => { cancelled = true; };
  }, [port]);

  // Prepare challenge on mount for fast submit
  useEffect(() => {
    const patientEp = page.endpoints?.find(
      (e) => e.entity === 'patienten' && e.op === 'create',
    );
    if (patientEp?.app_id) {
      prepareChallenge(cfg, page, 'POST', `/apps/${patientEp.app_id}/records`);
    }
  }, [cfg, page]);

  const submit = useJourneySubmit(
    port,
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
    { draftKey: SLUG },
  );

  const restart = () => {
    submit.reset();
    patientForm.reset();
    terminForm.reset();
    setStep(1);
  };

  if (submit.result) {
    const behandlerId = terminForm.get('behandler') as string | null;
    const behandlerLabel = behandlerId
      ? (labelOf(behandlerId) ?? '')
      : '';
    const beginnVal = terminForm.get('beginn') as string | null;

    return (
      <SuccessStep
        result={submit.result}
        forms={[patientForm, terminForm]}
        title={tx('Terminanfrage eingegangen')}
        whatHappensNext={tx(
          'Wir prüfen deinen Wunschtermin und melden uns zeitnah bei dir.',
        )}
        facts={[
          ...(behandlerLabel ? [{ label: tx('Behandler'), value: behandlerLabel }] : []),
          ...(beginnVal ? [{ label: tx('Wunschtermin'), value: beginnVal.replace('T', ' ') }] : []),
        ]}
        next={[{ label: tx('Weitere Anfrage stellen'), onClick: restart }]}
        submit={submit}
        restartLabel={tx('Weitere Anfrage stellen')}
      />
    );
  }

  return (
    <IntentWizardShell
      steps={STEPS}
      currentStep={step}
      onStepChange={setStep}
      back={false}
      forms={[patientForm, terminForm]}
      draftKey={SLUG}
    >
      {/* Step 1 — Patientendaten */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Bound form={patientForm} name="vorname" />
            <Bound form={patientForm} name="nachname" />
          </div>
          <Bound form={patientForm} name="geburtsdatum" />
          <Bound form={patientForm} name="telefon" />
          <Bound form={patientForm} name="email" />
          <Bound form={patientForm} name="krankenkasse" />
          <Bound form={patientForm} name="versicherungsart" />
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

      {/* Step 2 — Behandler wählen */}
      {step === 2 && (
        <div className="space-y-4">
          <Field form={terminForm} name="behandler" label={tx('Behandler')}>
            <EntitySelectStep
              items={behandlerItems}
              loading={behandlerLoading}
              id={terminForm.fieldId('behandler')}
              invalid={!!terminForm.error('behandler')}
              selectedId={terminForm.get('behandler') as string | null}
              onSelect={(id) => {
                const label = labelOf(id) ?? '';
                terminForm.set('behandler', id, label);
              }}
              avatar="initials"
              searchPlaceholder={tx('Behandler suchen …')}
              emptyText={tx('Keine aktiven Behandler verfügbar.')}
            />
          </Field>
          <StepNav
            onNext={() => terminForm.validate(['behandler'])}
            nextStepLabel={tx('Wunschtermin')}
          />
        </div>
      )}

      {/* Step 3 — Wunschtermin */}
      {step === 3 && (
        <div className="space-y-4">
          <Bound form={terminForm} name="beginn" label={tx('Wunschtermin (Datum & Uhrzeit)')} />
          <Bound form={terminForm} name="bemerkung" label={tx('Anliegen / Bemerkung')} rows={4} />
          <StepNav
            onNext={() => terminForm.validate(['beginn'])}
            nextStepLabel={tx('Prüfen & Absenden')}
          />
        </div>
      )}

      {/* Step 4 — Prüfen & Absenden */}
      {step === 4 && !submit.done && (
        <SummaryStep
          forms={[patientForm, terminForm]}
          submit={submit}
          whatHappensNext={tx(
            'Wir prüfen deinen Wunschtermin und melden uns zeitnah bei dir.',
          )}
          confirmLabel={tx('Anfrage absenden')}
        />
      )}
    </IntentWizardShell>
  );
}

export default function Terminanfrage() {
  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

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

  if (loading || !cfg || !page) {
    return <PublicShell loading={loading} unavailable={unavailable} />;
  }

  return (
    <PublicShell
      title={page.title}
      description={page.description}
    >
      <Inner cfg={cfg} page={page} />
    </PublicShell>
  );
}
