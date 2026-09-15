import type { Leistungen, Rezepte, Behandlungen } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { SatelliteSection } from '@/components/SatelliteSection';

export interface LeistungenDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Leistungen;
  /** 1:N „Rezepte" (leistung): VOLLE Liste — der Block filtert auf diesen Record. */
  rezepteList: Rezepte[];
  /** Zeilen-Klick → overlay.push auf das Rezepte-Detail (nie der Edit-Dialog). */
  onOpenRezepte: (record: Rezepte) => void;
  /** Kontextuelles „+": öffnet den Rezepte-Dialog mit diesem Record vorgesetzt. */
  onAddRezepte: () => void;
  /** 1:N „Behandlungen" (durchgefuehrte_leistung): VOLLE Liste — der Block filtert auf diesen Record. */
  behandlungenList: Behandlungen[];
  /** Zeilen-Klick → overlay.push auf das Behandlungen-Detail (nie der Edit-Dialog). */
  onOpenBehandlungen: (record: Behandlungen) => void;
  /** Kontextuelles „+": öffnet den Behandlungen-Dialog mit diesem Record vorgesetzt. */
  onAddBehandlungen: () => void;
}

export function LeistungenDetails({
  record,
  rezepteList,
  onOpenRezepte,
  onAddRezepte,
  behandlungenList,
  onOpenBehandlungen,
  onAddBehandlungen,
}: LeistungenDetailsProps) {
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('leistungen', 'bezeichnung')} value={record.fields.bezeichnung} format="text" />
        <RecordField label={fieldLabel('leistungen', 'heilmittelkuerzel')} value={record.fields.heilmittelkuerzel} format="text" />
        <RecordField label={fieldLabel('leistungen', 'dauer_minuten')} value={record.fields.dauer_minuten} format="text" />
        <RecordField label={fieldLabel('leistungen', 'preis_kasse')} value={record.fields.preis_kasse} format="text" />
        <RecordField label={fieldLabel('leistungen', 'preis_privat')} value={record.fields.preis_privat} format="text" />
      </RecordSection>

      <SatelliteSection
        title={appLabel('rezepte')}
        items={rezepteList.filter(r => extractRecordId(r.fields.leistung) === record.record_id)}
        map={r => ({ name: r.fields.arztpraxis ?? appLabel('rezepte'), meta: r.fields.ausstellungsdatum })}
        onOpen={onOpenRezepte}
        onAdd={onAddRezepte}
        getKey={r => r.record_id}
      />

      <SatelliteSection
        title={appLabel('behandlungen')}
        items={behandlungenList.filter(r => extractRecordId(r.fields.durchgefuehrte_leistung) === record.record_id)}
        map={() => ({ name: appLabel('behandlungen'), meta: undefined })}
        onOpen={onOpenBehandlungen}
        onAdd={onAddBehandlungen}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.LEISTUNGEN} recordId={record.record_id} />
    </>
  );
}
