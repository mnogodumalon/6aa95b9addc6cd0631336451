/**
 * Rezept erfassen — 3-Schritt-Wizard.
 * Steps: 1) Patient wählen → 2) Rezeptdaten erfassen → 3) Leistung und Einheiten → 4) Prüfen & anlegen.
 * Reads: patienten, leistungen. Writes: rezepte (createRezepteEntry).
 * Composes: IntentWizardShell, WizardStep, EntitySelectStep, Bound, Field, ChoiceGroup, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { ChoiceGroup } from '@/components/blocks/ChoiceGroup';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { Bound } from '@/components/blocks/Bound';
import { Field } from '@/components/blocks/Field';
import { useStepForm, useJourneySubmit, useRecordSearch, fieldText, todayIso } from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { tx } from '@/i18n';

export default function RezeptErfassenPage() {
  const [step, setStep] = useState(1);

  const patienten = useRecordSearch(servicePort, 'patienten', {
    searchFields: ['vorname', 'nachname'],
    toItem: p => ({
      id: p.id,
      title: `${fieldText(p, 'vorname')} ${fieldText(p, 'nachname')}`.trim(),
      subtitle: fieldText(p, 'telefon') || fieldText(p, 'email') || undefined,
    }),
  });

  const leistungen = useRecordSearch(servicePort, 'leistungen', {
    searchFields: ['bezeichnung', 'heilmittelkuerzel'],
    toItem: l => ({
      id: l.id,
      title: fieldText(l, 'bezeichnung'),
      subtitle: fieldText(l, 'heilmittelkuerzel') || undefined,
    }),
  });

  const f = useStepForm('rezepte', {
    steps: {
      patient: 1,
      ausstellungsdatum: 2,
      arztpraxis: 2,
      diagnose: 2,
      gueltig_bis: 2,
      frequenz_pro_woche: 2,
      leistung: 3,
      anzahl_einheiten: 3,
      status: 3,
    },
    initial: {
      ausstellungsdatum: todayIso(),
      status: 'offen',
    },
  });

  const submit = useJourneySubmit(servicePort, [
    {
      key: 'rezept',
      entity: 'rezepte',
      form: f,
      primary: true,
    },
  ], { draftKey: 'rezept-erfassen' });

  return (
    <IntentWizardShell
      title={tx('Rezept erfassen')}
      currentStep={step}
      onStepChange={setStep}
      forms={[f]}
      draftKey="rezept-erfassen"
      intro={{
        description: tx('Ein neues Rezept für einen Patienten anlegen und einer Leistung zuordnen.'),
        needs: [tx('Patientenname'), tx('Arztpraxis / Verordnung'), tx('Behandlungsleistung')],
      }}
    >
      {/* Schritt 1: Patient wählen */}
      <WizardStep
        label={tx('Patient')}
        description={tx('Patient auswählen, dem das Rezept zugeordnet wird.')}
      >
        <EntitySelectStep
          {...patienten.select}
          selectedId={f.get('patient') as string}
          onSelect={id => {
            f.set('patient', id, patienten.labelOf(id));
            setStep(2);
          }}
          searchPlaceholder={tx('Name suchen …')}
          create={{ fields: ['vorname', 'nachname', 'geburtsdatum', 'versicherungsart'] }}
        />
      </WizardStep>

      {/* Schritt 2: Rezeptdaten erfassen */}
      <WizardStep
        label={tx('Rezeptdaten')}
        description={tx('Ausstellungsdatum, Arztpraxis und Diagnose des Rezepts erfassen.')}
        needs={['patient']}
      >
        <div className="space-y-4">
          <Bound form={f} name="ausstellungsdatum" />
          <Bound form={f} name="arztpraxis" />
          <Bound form={f} name="diagnose" rows={3} />
          <Bound form={f} name="gueltig_bis" />
          <Bound form={f} name="frequenz_pro_woche" />
          <StepNav
            onNext={() => f.validate(['ausstellungsdatum', 'arztpraxis'])}
            nextStepLabel={tx('Leistung')}
          />
        </div>
      </WizardStep>

      {/* Schritt 3: Leistung und Einheiten */}
      <WizardStep
        label={tx('Leistung')}
        description={tx('Verordnete Leistung, Einheitenanzahl und Status des Rezepts festlegen.')}
        needs={['patient', 'ausstellungsdatum', 'arztpraxis']}
      >
        <div className="space-y-6">
          <EntitySelectStep
            {...leistungen.select}
            selectedId={f.get('leistung') as string}
            onSelect={id => {
              f.set('leistung', id, leistungen.labelOf(id));
            }}
            searchPlaceholder={tx('Leistung oder Kürzel suchen …')}
            create={false}
            emptyText={tx('Keine Leistung gefunden. Leistungen können im Menü verwaltet werden.')}
          />
          <Bound form={f} name="anzahl_einheiten" />
          <Field form={f} name="status">
            <ChoiceGroup {...f.choice('status')} />
          </Field>
          <StepNav
            onNext={() => f.validate(['leistung', 'anzahl_einheiten', 'status'])}
            nextStepLabel={tx('Prüfen')}
          />
        </div>
      </WizardStep>

      {/* Schritt 4: Prüfen & Bestätigen */}
      <WizardStep label={tx('Prüfen')}>
        {!submit.done && (
          <SummaryStep
            forms={[f]}
            submit={submit}
            whatHappensNext={tx('Das Rezept wird gespeichert und steht sofort für die Terminplanung zur Verfügung.')}
            confirmLabel={tx('Rezept anlegen')}
          />
        )}
      </WizardStep>

      {submit.result && (
        <SuccessStep
          result={submit.result}
          forms={[f]}
          submit={submit}
          restartLabel={tx('Weiteres Rezept erfassen')}
          whatHappensNext={tx('Das Rezept kann nun bei der Terminbuchung verwendet werden.')}
          next={[
            { label: tx('Neuen Termin vereinbaren'), href: '#/intents/neuer-termin' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
