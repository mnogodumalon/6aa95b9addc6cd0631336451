/**
 * Behandlung dokumentieren — 4-Schritt-Wizard.
 * Steps: 1) Termin wählen (status=erschienen, noch keine Behandlung) → 2) Leistung wählen →
 *        3) Befund & Details → 4) Zusammenfassung & Anlegen.
 * Reads: termine, behandlungen (für Duplikat-Check), leistungen.
 * Writes: behandlungen (createBehandlungenEntry).
 * Composes: IntentWizardShell, WizardStep, EntitySelectStep, Bound, StepNav, SummaryStep, SuccessStep.
 */
import { useState, useEffect } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Bound } from '@/components/blocks/Bound';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import {
  useStepForm,
  useJourneySubmit,
  useRecordSearch,
  fieldText,
  fieldLookup,
  fieldNumber,
  fieldRef,
  refFilter,
  todayIso,
} from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { tx } from '@/i18n';

export default function BehandlungDokumentierenPage() {
  const [step, setStep] = useState(1);

  // Step 1: Termine mit status=erschienen
  const termine = useRecordSearch(servicePort, 'termine', {
    filter: "r.v_status == 'erschienen'",
    where: r => fieldLookup(r, 'status')?.key === 'erschienen',
    searchFields: ['bemerkung'],
    toItem: t => {
      const beginn = fieldText(t, 'beginn');
      const datumLabel = beginn ? beginn.slice(0, 16).replace('T', ' ') : '';
      return {
        id: t.id,
        title: datumLabel || tx('Termin'),
        subtitle: fieldText(t, 'bemerkung') || undefined,
        status: fieldLookup(t, 'status') ?? undefined,
      };
    },
    orderby: ['r.v_beginn desc'],
  });

  // Step 2: Leistungen (alle)
  const leistungen = useRecordSearch(servicePort, 'leistungen', {
    searchFields: ['bezeichnung', 'heilmittelkuerzel'],
    toItem: l => ({
      id: l.id,
      title: fieldText(l, 'bezeichnung'),
      subtitle: fieldText(l, 'heilmittelkuerzel') || undefined,
      stats: fieldNumber(l, 'dauer_minuten') != null
        ? [{ label: tx('Dauer'), value: `${fieldNumber(l, 'dauer_minuten')} min` }]
        : undefined,
    }),
  });

  // Formular für behandlungen
  const f = useStepForm('behandlungen', {
    steps: {
      termin: 1,
      durchgefuehrte_leistung: 2,
      dauer_tatsaechlich: 3,
      befund: 3,
      massnahmen: 3,
      verlauf: 3,
      naechste_schritte: 3,
    },
    initial: { dauer_tatsaechlich: '' },
  });

  // Duplikat-Warnung: Prüfe ob bereits eine Behandlung für den gewählten Termin existiert
  const terminId = f.get('termin') as string | undefined;
  const [duplikatWarnung, setDuplikatWarnung] = useState<string | null>(null);

  useEffect(() => {
    if (!terminId) { setDuplikatWarnung(null); return; }
    let active = true;
    const controller = new AbortController();
    servicePort
      .list('behandlungen', {
        filter: refFilter('termin', terminId),
        signal: controller.signal,
      })
      .then(results => {
        if (!active) return;
        setDuplikatWarnung(
          results.length > 0
            ? tx('Für diesen Termin wurde bereits eine Behandlung dokumentiert.')
            : null,
        );
      })
      .catch(() => { /* ignoriere Abbruch */ });
    return () => { active = false; controller.abort(); };
  }, [terminId]);

  // Wenn Leistung gewählt: Dauer aus Leistung vorbelegen
  const leistungId = f.get('durchgefuehrte_leistung') as string | undefined;
  useEffect(() => {
    if (!leistungId) return;
    const rec = leistungen.recordOf(leistungId);
    if (!rec) return;
    const dauer = fieldNumber(rec, 'dauer_minuten');
    if (dauer != null) {
      f.set('dauer_tatsaechlich', String(dauer));
    }
  }, [leistungId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Plan: eine Behandlung anlegen
  const submit = useJourneySubmit(
    servicePort,
    [{ key: 'behandlung', entity: 'behandlungen', form: f, primary: true }],
    { draftKey: 'behandlung-dokumentieren' },
  );

  const terminLabel = termine.labelOf(terminId ?? '') ?? '';
  const leistungLabel = leistungen.labelOf(leistungId ?? '') ?? '';

  return (
    <IntentWizardShell
      title={tx('Behandlung dokumentieren')}
      currentStep={step}
      onStepChange={setStep}
      forms={[f]}
      draftKey="behandlung-dokumentieren"
      intro={{
        description: tx('Eine Behandlung zu einem abgeschlossenen Termin erfassen.'),
        needs: [tx('Abgeschlossener Termin (erschienen)'), tx('Durchgeführte Leistung'), tx('Befund')],
      }}
    >
      {/* Schritt 1: Termin wählen */}
      <WizardStep
        label={tx('Termin')}
        description={tx('Einen Termin mit Status „erschienen" auswählen, der noch nicht dokumentiert wurde.')}
      >
        {duplikatWarnung && terminId && (
          <div className="mb-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
            {duplikatWarnung}
          </div>
        )}
        <EntitySelectStep
          {...termine.select}
          selectedId={terminId ?? null}
          avatar="none"
          emptyText={tx('Keine Termine mit Status „erschienen" gefunden.')}
          onSelect={id => {
            f.set('termin', id, termine.labelOf(id));
            setStep(2);
          }}
        />
        {terminId && (
          <StepNav
            onNext={() => f.validate(['termin'])}
            nextStepLabel={tx('Leistung')}
          />
        )}
      </WizardStep>

      {/* Schritt 2: Leistung wählen */}
      <WizardStep
        label={tx('Leistung')}
        description={tx('Die durchgeführte Leistung auswählen.')}
        needs={['termin']}
      >
        <EntitySelectStep
          {...leistungen.select}
          selectedId={leistungId ?? null}
          avatar="none"
          searchPlaceholder={tx('Bezeichnung oder Kürzel suchen …')}
          emptyText={tx('Keine Leistungen gefunden.')}
          onSelect={id => {
            f.set('durchgefuehrte_leistung', id, leistungen.labelOf(id));
            setStep(3);
          }}
        />
        {leistungId && (
          <StepNav
            onBack={() => setStep(1)}
            onNext={() => f.validate(['durchgefuehrte_leistung'])}
            nextStepLabel={tx('Details')}
          />
        )}
        {!leistungId && (
          <StepNav onBack={() => setStep(1)} nextDisabled />
        )}
      </WizardStep>

      {/* Schritt 3: Befund & Details */}
      <WizardStep
        label={tx('Details')}
        description={tx('Befund, Maßnahmen und Verlauf zur Behandlung festhalten.')}
        needs={['termin', 'durchgefuehrte_leistung']}
      >
        <div className="space-y-4">
          <Bound form={f} name="dauer_tatsaechlich" hint={tx('In Minuten — vorbelegt aus der Leistung')} />
          <Bound form={f} name="befund" rows={4} hint={tx('Vertraulich — nur für interne Nutzung')} />
          <Bound form={f} name="massnahmen" rows={3} />
          <Bound form={f} name="verlauf" rows={3} />
          <Bound form={f} name="naechste_schritte" rows={3} />
          <StepNav
            onBack={() => setStep(2)}
            onNext={() => f.validate(['befund'])}
            nextStepLabel={tx('Prüfen')}
          />
        </div>
      </WizardStep>

      {/* Schritt 4: Zusammenfassung */}
      <WizardStep label={tx('Prüfen')}>
        {!submit.done && (
          <SummaryStep
            forms={[f]}
            submit={submit}
            items={[
              { key: '_termin', label: tx('Termin'), value: terminLabel, step: 1, keys: ['termin'] },
              { key: '_leistung', label: tx('Leistung'), value: leistungLabel, step: 2, keys: ['durchgefuehrte_leistung'] },
            ]}
            whatHappensNext={tx(
              'Die Behandlung wird gespeichert. Eine Einheit des verknüpften Rezepts gilt als verbraucht.',
            )}
            confirmLabel={tx('Behandlung dokumentieren')}
          />
        )}
      </WizardStep>

      {/* Erfolgsmeldung */}
      {submit.result && (
        <SuccessStep
          result={submit.result}
          forms={[f]}
          whatHappensNext={tx(
            'Die Behandlung ist dokumentiert. Eine Einheit des verknüpften Rezepts wurde verbraucht.',
          )}
          next={[
            {
              label: tx('Weitere Behandlung dokumentieren'),
              href: '#/intents/behandlung-dokumentieren',
            },
            { label: tx('Neuen Termin anlegen'), href: '#/intents/neuer-termin' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
