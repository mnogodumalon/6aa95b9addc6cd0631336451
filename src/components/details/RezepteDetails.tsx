import type { Rezepte, Patienten, Leistungen, Termine } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { SatelliteSection } from '@/components/SatelliteSection';

export interface RezepteDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Rezepte;
  /** N:1-Ziel „Patienten": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  patientenList: Patienten[];
  /** Klick auf die Patienten-Relation → overlay.push auf dessen Detail. */
  onOpenPatienten?: (record: Patienten) => void;
  /** N:1-Ziel „Leistungen": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  leistungenList: Leistungen[];
  /** Klick auf die Leistungen-Relation → overlay.push auf dessen Detail. */
  onOpenLeistungen?: (record: Leistungen) => void;
  /** 1:N „Termine" (rezept): VOLLE Liste — der Block filtert auf diesen Record. */
  termineList: Termine[];
  /** Zeilen-Klick → overlay.push auf das Termine-Detail (nie der Edit-Dialog). */
  onOpenTermine: (record: Termine) => void;
  /** Kontextuelles „+": öffnet den Termine-Dialog mit diesem Record vorgesetzt. */
  onAddTermine: () => void;
}

export function RezepteDetails({
  record,
  patientenList,
  onOpenPatienten,
  leistungenList,
  onOpenLeistungen,
  termineList,
  onOpenTermine,
  onAddTermine,
}: RezepteDetailsProps) {
  const patientTarget = patientenList.find(r => r.record_id === extractRecordId(record.fields.patient));
  const leistungTarget = leistungenList.find(r => r.record_id === extractRecordId(record.fields.leistung));
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('rezepte', 'ausstellungsdatum')} value={record.fields.ausstellungsdatum} format="date" />
        <RecordField label={fieldLabel('rezepte', 'arztpraxis')} value={record.fields.arztpraxis} format="text" />
        <RecordField label={fieldLabel('rezepte', 'diagnose')} value={record.fields.diagnose} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('rezepte', 'anzahl_einheiten')} value={record.fields.anzahl_einheiten} format="text" />
        <RecordField label={fieldLabel('rezepte', 'frequenz_pro_woche')} value={record.fields.frequenz_pro_woche} format="text" />
        <RecordField label={fieldLabel('rezepte', 'gueltig_bis')} value={record.fields.gueltig_bis} format="date" />
        <RecordField label={fieldLabel('rezepte', 'status')} value={record.fields.status} format="pill" />
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title={t('relations')} cols={2}>
        <RecordRelation
          label={fieldLabel('rezepte', 'patient')}
          name={patientTarget?.fields.vorname ?? '—'}
          meta={[patientTarget?.fields.telefon, patientTarget?.fields.email].filter(Boolean).join(' · ') || undefined}
          onClick={patientTarget && onOpenPatienten ? () => onOpenPatienten!(patientTarget!) : undefined}
        />
        <RecordRelation
          label={fieldLabel('rezepte', 'leistung')}
          name={leistungTarget?.fields.bezeichnung ?? '—'}
          meta={[leistungTarget?.fields.heilmittelkuerzel].filter(Boolean).join(' · ') || undefined}
          onClick={leistungTarget && onOpenLeistungen ? () => onOpenLeistungen!(leistungTarget!) : undefined}
        />
      </RecordSection>

      <SatelliteSection
        title={appLabel('termine')}
        items={termineList.filter(r => extractRecordId(r.fields.rezept) === record.record_id)}
        map={r => ({ name: appLabel('termine'), meta: r.fields.beginn })}
        onOpen={onOpenTermine}
        onAdd={onAddTermine}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.REZEPTE} recordId={record.record_id} />
    </>
  );
}
