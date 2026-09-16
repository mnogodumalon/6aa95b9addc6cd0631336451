import { useEffect, useMemo, useState } from 'react';
import { PublicShell } from '@/components/PublicShell';
import {
  loadPublicPagesConfig,
  listPublicRecords,
  PageUnavailableError,
  type PublicPagesConfig,
  type PublicPageConfig,
} from '@/lib/publicClient';
import { createPublicPort } from '@/lib/journey/publicPort';
import { useStepForm, useJourneySubmit } from '@/lib/journey';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Field } from '@/components/blocks/Field';
import { Bound } from '@/components/blocks/Bound';
import { ChoiceGroup } from '@/components/blocks/ChoiceGroup';
import { tx } from '@/i18n';

const SLUG = 'terminanfrage';

interface BehandlerItem {
  id: string;
  title: string;
  subtitle?: string;
}

export default function Terminanfrage() {
  const STEPS = [
  { label: tx('Persönliche Daten'), key: 'persoenlich' },
  { label: tx('Versicherung'), key: 'versicherung' },
  { label: tx('Behandler'), key: 'behandler' },
  { label: tx('Wunschtermin'), key: 'termin' },
  { label: tx('Zusammenfassung'), key: 'zusammenfassung' },
];

  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const [step, setStep] = useState(1);

  const [behandlerItems, setBehandlerItems] = useState<BehandlerItem[]>([]);
  const [behandlerLoading, setBehandlerLoading] = useState(false);
  const [behandlerError, setBehandlerError] = useState<string | null>(null);
  const [selectedBehandlerId, setSelectedBehandlerId] = useState<string | null>(null);
  const [selectedBehandlerLabel, setSelectedBehandlerLabel] = useState<string>('');

  useEffect(() => {
    loadPublicPagesConfig(SLUG)
      .then(c => {
        setCfg(c);
        setPage(c?.pages[SLUG] ?? null);
        setLoading(false);
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
    fields: ['vorname', 'nachname', 'geburtsdatum', 'telefon', 'email'],
    required: {
      vorname: true,
      nachname: true,
      geburtsdatum: true,
      telefon: false,
      email: false,
    },
    steps: {
      vorname: 1,
      nachname: 1,
      geburtsdatum: 1,
      telefon: 1,
      email: 1,
    },
    autoComplete: true,
  });

  const versicherungForm = useStepForm('patienten', {
    fields: ['krankenkasse', 'versicherungsart'],
    required: { krankenkasse: false, versicherungsart: true },
    steps: { krankenkasse: 2, versicherungsart: 2 },
    id: 'versicherung',
    autoComplete: true,
  });

  const terminForm = useStepForm('termine', {
    fields: ['beginn', 'bemerkung'],
    required: { beginn: true, bemerkung: false },
    steps: { beginn: 4, bemerkung: 4 },
    autoComplete: true,
  });

  const submit = useJourneySubmit(
    port!,
    [
      {
        key: 'patient',
        entity: 'patienten',
        form: patientForm,
        values: () => ({
          krankenkasse: versicherungForm.get('krankenkasse'),
          versicherungsart: versicherungForm.get('versicherungsart'),
        }),
      },
      {
        key: 'termin',
        entity: 'termine',
        form: terminForm,
        primary: true,
        needs: ['patient'],
        link: { patient: 'patient' },
        values: (_ctx) => ({
          behandler: selectedBehandlerId && cfg && page
            ? port!.ref(
                page.endpoints?.find(e => e.entity === 'behandler')?.app_id ?? '',
                selectedBehandlerId,
              )
            : undefined,
          ende: terminForm.get('beginn'),
        }),
      },
    ],
    { draftKey: 'terminanfrage' },
  );

  useEffect(() => {
    if (!cfg || !page) return;
    setBehandlerLoading(true);
    const ep = page.endpoints?.find(e => e.entity === 'behandler' && e.op === 'list');
    if (!ep?.app_id) {
      setBehandlerLoading(false);
      return;
    }
    listPublicRecords(cfg, page, { appId: ep.app_id })
      .then(result => {
        const items = Object.values(result).map(r => ({
          id: r.id,
          title: `${(r.fields.vorname as string) ?? ''} ${(r.fields.nachname as string) ?? ''}`.trim(),
          subtitle: (r.fields.kuerzel as string) ?? undefined,
        }));
        setBehandlerItems(items);
        setBehandlerLoading(false);
      })
      .catch(() => {
        setBehandlerError(tx('Behandlerliste konnte nicht geladen werden.'));
        setBehandlerLoading(false);
      });
  }, [cfg, page]);

  const restart = () => {
    patientForm.reset();
    versicherungForm.reset();
    terminForm.reset();
    setSelectedBehandlerId(null);
    setSelectedBehandlerLabel('');
    submit.reset();
    setStep(1);
  };

  if (loading) return <PublicShell loading />;
  if (unavailable || !cfg || !page || !port) return <PublicShell unavailable />;

  if (submit.result) {
    const vorname = patientForm.get('vorname') as string;
    const nachname = patientForm.get('nachname') as string;
    const beginn = terminForm.get('beginn') as string;
    return (
      <PublicShell title={tx('Terminanfrage')} description={tx('Ihre Anfrage wurde erfolgreich übermittelt.')}>
        <SuccessStep
          result={submit.result}
          forms={[patientForm, versicherungForm, terminForm]}
          title={tx('Terminanfrage eingegangen')}
          whatHappensNext={tx('Unser Praxisteam wird sich in Kürze bei Ihnen melden, um den Termin zu bestätigen.')}
          facts={[
            { label: tx('Patient'), value: `${vorname} ${nachname}`.trim() },
            { label: tx('Wunschtermin'), value: beginn ? new Intl.DateTimeFormat('de-DE', { dateStyle: 'full', timeStyle: 'short' }).format(new Date(beginn)) : '' },
            { label: tx('Behandler'), value: selectedBehandlerLabel },
          ]}
          next={[{ label: tx('Weitere Anfrage stellen'), onClick: restart }]}
          actions={{ copy: false, print: false }}
        />
      </PublicShell>
    );
  }

  return (
    <PublicShell title={tx('Terminanfrage')} description={tx('Stellen Sie als neuer Patient eine Terminanfrage. Das Praxisteam meldet sich zur Bestätigung.')}>
      <IntentWizardShell
        steps={STEPS}
        currentStep={step}
        onStepChange={setStep}
        back={false}
        forms={[patientForm, versicherungForm, terminForm]}
        draftKey="terminanfrage"
      >
        {/* Schritt 1: Persönliche Daten */}
        {step === 1 && (
          <div className="space-y-4">
            <Bound form={patientForm} name="vorname" />
            <Bound form={patientForm} name="nachname" />
            <Bound form={patientForm} name="geburtsdatum" as="date" />
            <Bound form={patientForm} name="telefon" />
            <Bound form={patientForm} name="email" />
            <StepNav
              onNext={() => patientForm.validate(['vorname', 'nachname', 'geburtsdatum'])}
              nextStepLabel={tx('Versicherung')}
              hideBack
            />
          </div>
        )}

        {/* Schritt 2: Versicherung */}
        {step === 2 && (
          <div className="space-y-4">
            <Bound form={versicherungForm} name="krankenkasse" />
            <Field form={versicherungForm} name="versicherungsart">
              <ChoiceGroup
                {...versicherungForm.choice('versicherungsart')}
                aria-labelledby="versicherung-versicherungsart-label"
              />
            </Field>
            <StepNav
              onBack={() => setStep(1)}
              onNext={() => versicherungForm.validate(['versicherungsart'])}
              nextStepLabel={tx('Behandler wählen')}
            />
          </div>
        )}

        {/* Schritt 3: Behandler wählen */}
        {step === 3 && (
          <div className="space-y-4">
            <EntitySelectStep
              items={behandlerItems}
              loading={behandlerLoading}
              error={behandlerError}
              selectedId={selectedBehandlerId}
              onSelect={id => {
                const item = behandlerItems.find(b => b.id === id);
                setSelectedBehandlerId(id);
                setSelectedBehandlerLabel(item?.title ?? '');
              }}
              avatar="initials"
              emptyText={tx('Aktuell sind keine Behandler verfügbar.')}
            />
            <StepNav
              onBack={() => setStep(2)}
              onNext={() => {
                if (!selectedBehandlerId) return tx('Bitte wählen Sie einen Behandler aus.');
                return true;
              }}
              nextStepLabel={tx('Wunschtermin')}
            />
          </div>
        )}

        {/* Schritt 4: Wunschtermin */}
        {step === 4 && (
          <div className="space-y-4">
            <Bound form={terminForm} name="beginn" as="date" hint={tx('Datum und gewünschte Uhrzeit des Termins')} />
            <Bound form={terminForm} name="bemerkung" as="textarea" rows={4} hint={tx('Ihr Anliegen oder besondere Wünsche (optional)')} />
            <StepNav
              onBack={() => setStep(3)}
              onNext={() => terminForm.validate(['beginn'])}
              nextStepLabel={tx('Zusammenfassung')}
            />
          </div>
        )}

        {/* Schritt 5: Zusammenfassung */}
        {step === 5 && !submit.done && (
          <SummaryStep
            forms={[patientForm, versicherungForm, terminForm]}
            submit={submit}
            items={[
              { key: 'behandler', label: tx('Behandler'), value: selectedBehandlerLabel, step: 3 },
            ]}
            whatHappensNext={tx('Das Praxisteam prüft Ihre Anfrage und meldet sich zur Terminbestätigung.')}
            confirmLabel={tx('Terminanfrage absenden')}
          />
        )}
      </IntentWizardShell>
    </PublicShell>
  );
}
