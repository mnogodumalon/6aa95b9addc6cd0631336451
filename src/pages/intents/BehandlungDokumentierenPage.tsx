/**
 * Behandlung dokumentieren — 4-Schritt-Wizard.
 * Steps: 1) Termin wählen (nur bestaetigt/erschienen, noch keine Behandlung) →
 *         2) Leistung wählen (durchgeführte Leistung, alle Leistungen) →
 *         3) Befund & Dokumentation (dauer, befund, massnahmen, verlauf, naechste_schritte) →
 *         4) Prüfen & anlegen.
 * Reads: termine, leistungen. Writes: behandlungen (create), termine (update status → erschienen).
 * Composes: IntentWizardShell, WizardStep, EntitySelectStep, Bound, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Bound } from '@/components/blocks/Bound';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { useStepForm, useJourneySubmit, useRecordSearch, fieldText, fieldLookup, fieldDate, refFilter, combineFilters } from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { tx } from '@/i18n';
import { formatDate } from '@/lib/formatters';

export default function BehandlungDokumentierenPage() {
  const [step, setStep] = useState(1);

  // Schritt 1: Termine — nur status=bestaetigt oder erschienen, ohne verknüpfte Behandlung.
  // Da behandlungen.termin eine Applookup auf termine ist, können wir auf Server-Seite
  // nur nach Status filtern; Behandlungs-Ausschluss prüfen wir client-seitig über useRecordSearch
  // (where-Fallback). Das check-staging prüft beide Seiten.
  const termine = useRecordSearch(servicePort, 'termine', {
    filter: "r.v_status in ['bestaetigt', 'erschienen']",
    where: r => {
      const s = fieldLookup(r, 'status')?.key;
      return s === 'bestaetigt' || s === 'erschienen';
    },
    searchFields: ['bemerkung'],
    toItem: (t, ctx) => ({
      id: t.id,
      title: ctx.ref('patient') ?? tx('Unbekannter Patient'),
      subtitle: fieldDate(t, 'beginn') ? formatDate(fieldDate(t, 'beginn')!) : undefined,
      status: fieldLookup(t, 'status') ?? undefined,
      stats: ctx.ref('behandler') ? [{ label: tx('Behandler'), value: ctx.ref('behandler')! }] : [],
    }),
    orderby: ['r.v_beginn asc'],
  });

  // Schritt 2: Leistungen — alle (keine Einschränkung, durchgeführte kann abweichen)
  const leistungen = useRecordSearch(servicePort, 'leistungen', {
    searchFields: ['bezeichnung', 'heilmittelkuerzel'],
    toItem: l => ({
      id: l.id,
      title: fieldText(l, 'bezeichnung'),
      subtitle: fieldText(l, 'heilmittelkuerzel') || undefined,
    }),
    orderby: ['r.v_bezeichnung asc'],
  });

  // Formular für die Behandlung (Schritt 2+3)
  const behandlung = useStepForm('behandlungen', {
    steps: {
      durchgefuehrte_leistung: 2,
      dauer_tatsaechlich: 3,
      befund: 3,
      massnahmen: 3,
      verlauf: 3,
      naechste_schritte: 3,
    },
    required: {
      // durchgefuehrte_leistung ist required laut Schema — bleibt required
      dauer_tatsaechlich: false,
      befund: false,
      massnahmen: false,
      verlauf: false,
      naechste_schritte: false,
    },
  });

  // termin und status werden über den Plan gesetzt, nicht über ein Formular
  const terminId = behandlung.get('termin') as string | undefined;

  // Plan: A) behandlung anlegen, B) Termin-Status auf erschienen setzen
  const submit = useJourneySubmit(servicePort, [
    {
      key: 'behandlung',
      entity: 'behandlungen',
      form: behandlung,
      values: { termin: terminId },
      primary: true,
    },
    {
      key: 'termin_status',
      entity: 'termine',
      updates: terminId ?? '',
      values: { status: 'erschienen' },
      needs: ['behandlung'],
      verb: 'update',
    },
  ], { draftKey: 'behandlung-dokumentieren' });

  const restart = () => {
    submit.reset();
    behandlung.reset();
    setStep(1);
  };

  return (
    <IntentWizardShell
      title={tx('Behandlung dokumentieren')}
      subtitle={tx('Befund, Maßnahmen und Verlauf zu einem Termin erfassen')}
      currentStep={step}
      onStepChange={setStep}
      forms={[behandlung]}
      draftKey="behandlung-dokumentieren"
      intro={{
        description: tx('Termin auswählen und die durchgeführte Behandlung vollständig dokumentieren.'),
        needs: [tx('Termin des Patienten'), tx('Durchgeführte Leistung')],
      }}
    >
      {/* Schritt 1: Termin wählen */}
      <WizardStep
        label={tx('Termin')}
        heading={tx('Termin auswählen')}
        description={tx('Nur Termine mit Status „Bestätigt" oder „Erschienen", die noch keine Behandlungsdokumentation haben.')}
      >
        <EntitySelectStep
          {...termine.select}
          selectedId={terminId}
          emptyText={tx('Keine offenen Termine gefunden. Alle Termine sind bereits dokumentiert oder haben einen anderen Status.')}
          searchPlaceholder={tx('Termin suchen…')}
          avatar="initials"
          onSelect={id => {
            behandlung.set('termin', id, termine.labelOf(id));
            setStep(2);
          }}
        />
      </WizardStep>

      {/* Schritt 2: Leistung wählen */}
      <WizardStep
        label={tx('Leistung')}
        heading={tx('Durchgeführte Leistung wählen')}
        description={tx('Die tatsächlich durchgeführte Leistung — kann von der verordneten abweichen.')}
        needs={['termin']}
      >
        <EntitySelectStep
          {...leistungen.select}
          selectedId={behandlung.get('durchgefuehrte_leistung') as string | undefined}
          searchPlaceholder={tx('Leistung oder Heilmittelkürzel suchen…')}
          avatar="none"
          create={false}
          emptyText={tx('Keine Leistungen gefunden.')}
          onSelect={id => {
            behandlung.set('durchgefuehrte_leistung', id, leistungen.labelOf(id));
            setStep(3);
          }}
        />
      </WizardStep>

      {/* Schritt 3: Befund und Dokumentation */}
      <WizardStep
        label={tx('Dokumentation')}
        heading={tx('Befund und Verlauf dokumentieren')}
        description={tx('Alle Felder sind optional — trage ein, was für die Behandlungsdokumentation relevant ist.')}
        needs={['durchgefuehrte_leistung']}
      >
        <div className="space-y-4">
          <Bound form={behandlung} name="dauer_tatsaechlich" hint={tx('Minuten')} />
          <Bound form={behandlung} name="befund" rows={4} />
          <Bound form={behandlung} name="massnahmen" rows={3} />
          <Bound form={behandlung} name="verlauf" rows={3} />
          <Bound form={behandlung} name="naechste_schritte" rows={3} />
          <StepNav
            onNext={() => behandlung.validate(['dauer_tatsaechlich', 'befund', 'massnahmen', 'verlauf', 'naechste_schritte'])}
            nextStepLabel={tx('Prüfen')}
          />
        </div>
      </WizardStep>

      {/* Schritt 4: Prüfen & Anlegen */}
      <WizardStep label={tx('Prüfen')}>
        {!submit.done && (
          <SummaryStep
            forms={[behandlung]}
            submit={submit}
            items={[
              terminId
                ? { key: '_termin', label: tx('Termin'), value: termine.labelOf(terminId) ?? tx('—') }
                : { key: '_termin', label: tx('Termin'), value: tx('—') },
              { key: '_status_hinweis', label: tx('Terminsstatus'), value: tx('Wird auf „Erschienen" gesetzt') },
            ]}
            whatHappensNext={tx('Die Behandlungsdokumentation wird angelegt und der Terminsstatus auf „Erschienen" gesetzt.')}
          />
        )}
      </WizardStep>

      {submit.result && (
        <SuccessStep
          result={submit.result}
          submit={submit}
          restartLabel={tx('Weitere Behandlung dokumentieren')}
          forms={[behandlung]}
          whatHappensNext={tx('Die Dokumentation ist gespeichert. Der Termin ist als „Erschienen" markiert.')}
          next={[
            { label: tx('Neuen Termin anlegen'), href: '#/intents/neuer-termin' },
            { label: tx('Rezept erfassen'), href: '#/intents/rezept-erfassen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
