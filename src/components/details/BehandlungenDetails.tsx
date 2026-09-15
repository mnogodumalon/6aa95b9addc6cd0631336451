import type { Behandlungen, Termine, Leistungen } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';

export interface BehandlungenDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Behandlungen;
  /** N:1-Ziel „Termine": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  termineList: Termine[];
  /** Klick auf die Termine-Relation → overlay.push auf dessen Detail. */
  onOpenTermine?: (record: Termine) => void;
  /** N:1-Ziel „Leistungen": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  leistungenList: Leistungen[];
  /** Klick auf die Leistungen-Relation → overlay.push auf dessen Detail. */
  onOpenLeistungen?: (record: Leistungen) => void;
}

export function BehandlungenDetails({
  record,
  termineList,
  onOpenTermine,
  leistungenList,
  onOpenLeistungen,
}: BehandlungenDetailsProps) {
  const terminTarget = termineList.find(r => r.record_id === extractRecordId(record.fields.termin));
  const durchgefuehrte_leistungTarget = leistungenList.find(r => r.record_id === extractRecordId(record.fields.durchgefuehrte_leistung));
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('behandlungen', 'dauer_tatsaechlich')} value={record.fields.dauer_tatsaechlich} format="text" />
        <RecordField label={fieldLabel('behandlungen', 'befund')} value={record.fields.befund} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('behandlungen', 'massnahmen')} value={record.fields.massnahmen} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('behandlungen', 'verlauf')} value={record.fields.verlauf} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('behandlungen', 'naechste_schritte')} value={record.fields.naechste_schritte} format="longtext" className="md:col-span-2" />
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title={t('relations')} cols={2}>
        <RecordRelation
          label={fieldLabel('behandlungen', 'termin')}
          name={terminTarget?.fields.bemerkung ?? '—'}
          meta={undefined}
          onClick={terminTarget && onOpenTermine ? () => onOpenTermine!(terminTarget!) : undefined}
        />
        <RecordRelation
          label={fieldLabel('behandlungen', 'durchgefuehrte_leistung')}
          name={durchgefuehrte_leistungTarget?.fields.bezeichnung ?? '—'}
          meta={[durchgefuehrte_leistungTarget?.fields.heilmittelkuerzel].filter(Boolean).join(' · ') || undefined}
          onClick={durchgefuehrte_leistungTarget && onOpenLeistungen ? () => onOpenLeistungen!(durchgefuehrte_leistungTarget!) : undefined}
        />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.BEHANDLUNGEN} recordId={record.record_id} />
    </>
  );
}
