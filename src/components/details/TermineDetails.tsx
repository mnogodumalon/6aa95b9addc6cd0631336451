import type { Termine, Patienten, Behandler, Rezepte, Behandlungen } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { SatelliteSection } from '@/components/SatelliteSection';

export interface TermineDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Termine;
  /** N:1-Ziel „Patienten": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  patientenList: Patienten[];
  /** Klick auf die Patienten-Relation → overlay.push auf dessen Detail. */
  onOpenPatienten?: (record: Patienten) => void;
  /** N:1-Ziel „Behandler": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  behandlerList: Behandler[];
  /** Klick auf die Behandler-Relation → overlay.push auf dessen Detail. */
  onOpenBehandler?: (record: Behandler) => void;
  /** N:1-Ziel „Rezepte": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  rezepteList: Rezepte[];
  /** Klick auf die Rezepte-Relation → overlay.push auf dessen Detail. */
  onOpenRezepte?: (record: Rezepte) => void;
  /** 1:N „Behandlungen" (termin): VOLLE Liste — der Block filtert auf diesen Record. */
  behandlungenList: Behandlungen[];
  /** Zeilen-Klick → overlay.push auf das Behandlungen-Detail (nie der Edit-Dialog). */
  onOpenBehandlungen: (record: Behandlungen) => void;
  /** Kontextuelles „+": öffnet den Behandlungen-Dialog mit diesem Record vorgesetzt. */
  onAddBehandlungen: () => void;
}

export function TermineDetails({
  record,
  patientenList,
  onOpenPatienten,
  behandlerList,
  onOpenBehandler,
  rezepteList,
  onOpenRezepte,
  behandlungenList,
  onOpenBehandlungen,
  onAddBehandlungen,
}: TermineDetailsProps) {
  const patientTarget = patientenList.find(r => r.record_id === extractRecordId(record.fields.patient));
  const behandlerTarget = behandlerList.find(r => r.record_id === extractRecordId(record.fields.behandler));
  const rezeptTarget = rezepteList.find(r => r.record_id === extractRecordId(record.fields.rezept));
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('termine', 'beginn')} value={record.fields.beginn} format="datetime" />
        <RecordField label={fieldLabel('termine', 'ende')} value={record.fields.ende} format="datetime" />
        <RecordField label={fieldLabel('termine', 'raum')} value={record.fields.raum} format="pill" />
        <RecordField label={fieldLabel('termine', 'status')} value={record.fields.status} format="pill" />
        <RecordField label={fieldLabel('termine', 'bemerkung')} value={record.fields.bemerkung} format="longtext" className="md:col-span-2" />
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title={t('relations')} cols={2}>
        <RecordRelation
          label={fieldLabel('termine', 'patient')}
          name={patientTarget?.fields.vorname ?? '—'}
          meta={[patientTarget?.fields.telefon, patientTarget?.fields.email].filter(Boolean).join(' · ') || undefined}
          onClick={patientTarget && onOpenPatienten ? () => onOpenPatienten!(patientTarget!) : undefined}
        />
        <RecordRelation
          label={fieldLabel('termine', 'behandler')}
          name={behandlerTarget?.fields.vorname ?? '—'}
          meta={[behandlerTarget?.fields.email].filter(Boolean).join(' · ') || undefined}
          onClick={behandlerTarget && onOpenBehandler ? () => onOpenBehandler!(behandlerTarget!) : undefined}
        />
        <RecordRelation
          label={fieldLabel('termine', 'rezept')}
          name={rezeptTarget?.fields.arztpraxis ?? '—'}
          meta={undefined}
          onClick={rezeptTarget && onOpenRezepte ? () => onOpenRezepte!(rezeptTarget!) : undefined}
        />
      </RecordSection>

      <SatelliteSection
        title={appLabel('behandlungen')}
        items={behandlungenList.filter(r => extractRecordId(r.fields.termin) === record.record_id)}
        map={() => ({ name: appLabel('behandlungen'), meta: undefined })}
        onOpen={onOpenBehandlungen}
        onAdd={onAddBehandlungen}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.TERMINE} recordId={record.record_id} />
    </>
  );
}
