import type { Patienten, Rezepte, Termine } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { SatelliteSection } from '@/components/SatelliteSection';

export interface PatientenDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Patienten;
  /** 1:N „Rezepte" (patient): VOLLE Liste — der Block filtert auf diesen Record. */
  rezepteList: Rezepte[];
  /** Zeilen-Klick → overlay.push auf das Rezepte-Detail (nie der Edit-Dialog). */
  onOpenRezepte: (record: Rezepte) => void;
  /** Kontextuelles „+": öffnet den Rezepte-Dialog mit diesem Record vorgesetzt. */
  onAddRezepte: () => void;
  /** 1:N „Termine" (patient): VOLLE Liste — der Block filtert auf diesen Record. */
  termineList: Termine[];
  /** Zeilen-Klick → overlay.push auf das Termine-Detail (nie der Edit-Dialog). */
  onOpenTermine: (record: Termine) => void;
  /** Kontextuelles „+": öffnet den Termine-Dialog mit diesem Record vorgesetzt. */
  onAddTermine: () => void;
}

export function PatientenDetails({
  record,
  rezepteList,
  onOpenRezepte,
  onAddRezepte,
  termineList,
  onOpenTermine,
  onAddTermine,
}: PatientenDetailsProps) {
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('patienten', 'vorname')} value={record.fields.vorname} format="text" />
        <RecordField label={fieldLabel('patienten', 'nachname')} value={record.fields.nachname} format="text" />
        <RecordField label={fieldLabel('patienten', 'geburtsdatum')} value={record.fields.geburtsdatum} format="date" />
        <RecordField label={fieldLabel('patienten', 'telefon')} value={record.fields.telefon} format="text" />
        <RecordField label={fieldLabel('patienten', 'email')} value={record.fields.email} format="email" />
        <RecordField label={fieldLabel('patienten', 'strasse')} value={record.fields.strasse} format="text" />
        <RecordField label={fieldLabel('patienten', 'hausnummer')} value={record.fields.hausnummer} format="text" />
        <RecordField label={fieldLabel('patienten', 'plz')} value={record.fields.plz} format="text" />
        <RecordField label={fieldLabel('patienten', 'ort')} value={record.fields.ort} format="text" />
        <RecordField label={fieldLabel('patienten', 'krankenkasse')} value={record.fields.krankenkasse} format="text" />
        <RecordField label={fieldLabel('patienten', 'versichertennummer')} value={record.fields.versichertennummer} format="text" />
        <RecordField label={fieldLabel('patienten', 'versicherungsart')} value={record.fields.versicherungsart} format="pill" />
        <RecordField label={fieldLabel('patienten', 'hausarzt')} value={record.fields.hausarzt} format="text" />
        <RecordField label={fieldLabel('patienten', 'notizen')} value={record.fields.notizen} format="longtext" className="md:col-span-2" />
      </RecordSection>

      <SatelliteSection
        title={appLabel('rezepte')}
        items={rezepteList.filter(r => extractRecordId(r.fields.patient) === record.record_id)}
        map={r => ({ name: r.fields.arztpraxis ?? appLabel('rezepte'), meta: r.fields.ausstellungsdatum })}
        onOpen={onOpenRezepte}
        onAdd={onAddRezepte}
        getKey={r => r.record_id}
      />

      <SatelliteSection
        title={appLabel('termine')}
        items={termineList.filter(r => extractRecordId(r.fields.patient) === record.record_id)}
        map={r => ({ name: appLabel('termine'), meta: r.fields.beginn })}
        onOpen={onOpenTermine}
        onAdd={onAddTermine}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.PATIENTEN} recordId={record.record_id} />
    </>
  );
}
