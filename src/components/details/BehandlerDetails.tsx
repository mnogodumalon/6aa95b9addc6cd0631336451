import type { Behandler, Termine } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { SatelliteSection } from '@/components/SatelliteSection';

export interface BehandlerDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Behandler;
  /** 1:N „Termine" (behandler): VOLLE Liste — der Block filtert auf diesen Record. */
  termineList: Termine[];
  /** Zeilen-Klick → overlay.push auf das Termine-Detail (nie der Edit-Dialog). */
  onOpenTermine: (record: Termine) => void;
  /** Kontextuelles „+": öffnet den Termine-Dialog mit diesem Record vorgesetzt. */
  onAddTermine: () => void;
}

export function BehandlerDetails({
  record,
  termineList,
  onOpenTermine,
  onAddTermine,
}: BehandlerDetailsProps) {
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('behandler', 'vorname')} value={record.fields.vorname} format="text" />
        <RecordField label={fieldLabel('behandler', 'nachname')} value={record.fields.nachname} format="text" />
        <RecordField label={fieldLabel('behandler', 'kuerzel')} value={record.fields.kuerzel} format="text" />
        <RecordField label={fieldLabel('behandler', 'fachgebiete')} value={Array.isArray(record.fields.fachgebiete) ? record.fields.fachgebiete.map((v: unknown) => (v && typeof v === 'object' && 'label' in v) ? (v as {label: unknown}).label : v).join(', ') : null} format="text" />
        <RecordField label={fieldLabel('behandler', 'arbeitstage')} value={Array.isArray(record.fields.arbeitstage) ? record.fields.arbeitstage.map((v: unknown) => (v && typeof v === 'object' && 'label' in v) ? (v as {label: unknown}).label : v).join(', ') : null} format="text" />
        <RecordField label={fieldLabel('behandler', 'status')} value={record.fields.status} format="pill" />
        <RecordField label={fieldLabel('behandler', 'email')} value={record.fields.email} format="email" />
      </RecordSection>

      <SatelliteSection
        title={appLabel('termine')}
        items={termineList.filter(r => extractRecordId(r.fields.behandler) === record.record_id)}
        map={r => ({ name: appLabel('termine'), meta: r.fields.beginn })}
        onOpen={onOpenTermine}
        onAdd={onAddTermine}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.BEHANDLER} recordId={record.record_id} />
    </>
  );
}
