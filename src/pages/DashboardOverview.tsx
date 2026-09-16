import { useMemo, useState, useCallback } from 'react';
import { format, parseISO, isToday, isBefore, isAfter, addDays, startOfDay } from 'date-fns';
import type { DashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { APP_IDS, LOOKUP_OPTIONS, lookupOption } from '@/types/app';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { formatDate } from '@/lib/formatters';
import { tx, appLabel, dateFnsLocale } from '@/i18n';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { DashboardGrid } from '@/components/DashboardGrid';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { CalendarWidget, type CalendarEvent } from '@/components/widgets/CalendarWidget';
import { IconCalendar, IconAlertCircle, IconClockHour4, IconFileDescription, IconPlus, IconCheck } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';

export default function DashboardOverview({ data }: { data: DashboardData }) {
  const {
    behandler, patienten, rezepte, termine,
    behandlerMap, patientenMap, rezepteMap, termineMap,
    setTermine, fetchAll,
  } = data;

  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type === 'termine') {
        const r = top.record;
        const statusKey = r.fields.status?.key ?? r.fields.status;
        if (statusKey === 'geplant') {
          return {
            label: tx('Bestätigen'),
            onClick: () => confirmTermin(r),
          };
        }
        if (statusKey === 'bestaetigt') {
          return {
            label: tx('Erschienen'),
            onClick: () => setErschienen(r),
          };
        }
      }
      return undefined;
    },
  });

  const enrichedTermine = crud.enriched.termine;
  const enrichedRezepte = crud.enriched.rezepte;

  const clock = useClock();
  const todayKey = format(clock, 'yyyy-MM-dd');

  // ── Helpers ──────────────────────────────────────────────────────────────

  const confirmTermin = useCallback(async (r: typeof termine[0]) => {
    const before = termine;
    setTermine(termine.map(t =>
      t.record_id === r.record_id
        ? { ...t, fields: { ...t.fields, status: lookupOption('termine', 'status', 'bestaetigt') } }
        : t
    ));
    try {
      await LivingAppsService.updateTermineEntry(r.record_id, { status: 'bestaetigt' });
      undoToast(tx`${r.fields.bemerkung ?? patientenMap.get(extractRecordId(r.fields.patient) ?? '')?.fields?.nachname ?? tx('Termin')} — bestätigt`, async () => {
        setTermine(before);
        await LivingAppsService.updateTermineEntry(r.record_id, { status: 'geplant' });
      });
    } catch {
      setTermine(before);
      fetchAll();
    }
  }, [termine, setTermine, patientenMap, fetchAll]);

  const setErschienen = useCallback(async (r: typeof termine[0]) => {
    const before = termine;
    setTermine(termine.map(t =>
      t.record_id === r.record_id
        ? { ...t, fields: { ...t.fields, status: lookupOption('termine', 'status', 'erschienen') } }
        : t
    ));
    try {
      await LivingAppsService.updateTermineEntry(r.record_id, { status: 'erschienen' });
      undoToast(tx`${patientenMap.get(extractRecordId(r.fields.patient) ?? '')?.fields?.nachname ?? tx('Patient')} — erschienen`, async () => {
        setTermine(before);
        await LivingAppsService.updateTermineEntry(r.record_id, { status: 'bestaetigt' });
      });
    } catch {
      setTermine(before);
      fetchAll();
    }
  }, [termine, setTermine, patientenMap, fetchAll]);

  // ── Derived data ─────────────────────────────────────────────────────────

  const heuteTermine = useMemo(
    () => enrichedTermine.filter(t => t.fields.beginn?.startsWith(todayKey)),
    [enrichedTermine, todayKey]
  );

  const nichtErschienen = useMemo(
    () => heuteTermine.filter(t => (t.fields.status?.key ?? t.fields.status) === 'nicht_erschienen'),
    [heuteTermine]
  );

  const dieseWocheTermine = useMemo(() => {
    const weekStart = format(startOfDay(clock), 'yyyy-MM-dd');
    const weekEnd = format(addDays(clock, 7), 'yyyy-MM-dd');
    return enrichedTermine.filter(t => {
      const d = t.fields.beginn?.slice(0, 10) ?? '';
      return d >= weekStart && d < weekEnd;
    });
  }, [enrichedTermine, clock]);

  const offeneRezepte = useMemo(
    () => enrichedRezepte.filter(r => (r.fields.status?.key ?? r.fields.status) === 'offen'),
    [enrichedRezepte]
  );

  const abgelaufeneRezepte = useMemo(
    () => enrichedRezepte.filter(r => {
      const key = r.fields.status?.key ?? r.fields.status;
      if (key === 'abgeschlossen' || key === 'abgelaufen') return false;
      if (!r.fields.gueltig_bis) return false;
      return isBefore(parseISO(r.fields.gueltig_bis), clock);
    }),
    [enrichedRezepte, clock]
  );

  const ungeklaerteHeute = useMemo(
    () => heuteTermine
      .filter(t => {
        const key = t.fields.status?.key ?? t.fields.status;
        return key === 'geplant' || key === 'nicht_erschienen';
      })
      .sort((a, b) => (a.fields.beginn ?? '').localeCompare(b.fields.beginn ?? '')),
    [heuteTermine]
  );

  const baldAblaufendeRezepte = useMemo(
    () => enrichedRezepte
      .filter(r => {
        const key = r.fields.status?.key ?? r.fields.status;
        if (key === 'abgeschlossen' || key === 'abgelaufen') return false;
        if (!r.fields.gueltig_bis) return false;
        const exp = parseISO(r.fields.gueltig_bis);
        return isAfter(exp, clock) && isBefore(exp, addDays(clock, 14));
      })
      .sort((a, b) => (a.fields.gueltig_bis ?? '').localeCompare(b.fields.gueltig_bis ?? '')),
    [enrichedRezepte, clock]
  );

  // ── Calendar events ───────────────────────────────────────────────────────

  const calEvents = useMemo<CalendarEvent[]>(() => {
    return enrichedTermine
      .filter(t => !!t.fields.beginn)
      .map(t => {
        const statusKey = t.fields.status?.key ?? t.fields.status ?? 'geplant';
        let tone: CalendarEvent['tone'] = 'default';
        if (statusKey === 'bestaetigt') tone = 'primary';
        else if (statusKey === 'erschienen') tone = 'success';
        else if (statusKey === 'nicht_erschienen') tone = 'destructive';
        else if (statusKey === 'abgesagt') tone = 'warning';

        const patName = t.patientName || tx('Patient');
        const behandlerShort = behandlerMap.get(extractRecordId(t.fields.behandler) ?? '')?.fields?.kuerzel ?? '';
        const raum = t.fields.raum?.label ?? '';

        return {
          id: `termin:${t.record_id}`,
          start: t.fields.beginn!,
          end: t.fields.ende,
          title: patName,
          subtitle: [behandlerShort, raum].filter(Boolean).join(' · '),
          tone,
        };
      });
  }, [enrichedTermine, behandlerMap]);

  // ── Drag & drop ───────────────────────────────────────────────────────────

  const handleEventDrop = useCallback(async (eventId: string, newStart: string, newEnd?: string) => {
    const recordId = eventId.split(':')[1] ?? '';
    const termin = termineMap.get(recordId);
    if (!termin) return;

    // Double-booking check: same behandler at same time
    const behandlerId = extractRecordId(termin.fields.behandler);
    const conflict = termine.find(t => {
      if (t.record_id === recordId) return false;
      if (extractRecordId(t.fields.behandler) !== behandlerId) return false;
      if (!t.fields.beginn || !t.fields.ende) return false;
      const tStart = t.fields.beginn;
      const tEnd = t.fields.ende;
      const newEnd2 = newEnd ?? newStart;
      return newStart < tEnd && newEnd2 > tStart;
    });
    if (conflict) {
      const conflictPatient = patientenMap.get(extractRecordId(conflict.fields.patient) ?? '');
      const conflictName = [conflictPatient?.fields?.vorname, conflictPatient?.fields?.nachname].filter(Boolean).join(' ');
      return tx`Doppelbelegung mit ${conflictName}`;
    }

    const before = termine;
    setTermine(termine.map(t =>
      t.record_id === recordId
        ? { ...t, fields: { ...t.fields, beginn: newStart, ...(newEnd ? { ende: newEnd } : {}) } }
        : t
    ));
    try {
      await LivingAppsService.updateTermineEntry(recordId, {
        beginn: newStart,
        ...(newEnd ? { ende: newEnd } : {}),
      });
      undoToast(
        tx`Termin verschoben auf ${format(parseISO(newStart), 'EEE dd.MM. HH:mm', { locale: dateFnsLocale() })}`,
        async () => {
          setTermine(before);
          await LivingAppsService.updateTermineEntry(recordId, {
            beginn: termin.fields.beginn!,
            ...(termin.fields.ende ? { ende: termin.fields.ende } : {}),
          });
        }
      );
    } catch {
      setTermine(before);
      fetchAll();
    }
  }, [termine, termineMap, setTermine, patientenMap, fetchAll]);

  const handleEventResize = useCallback(async (eventId: string, newStart: string, newEnd: string) => {
    const recordId = eventId.split(':')[1] ?? '';
    const termin = termineMap.get(recordId);
    if (!termin) return;

    const before = termine;
    setTermine(termine.map(t =>
      t.record_id === recordId
        ? { ...t, fields: { ...t.fields, beginn: newStart, ende: newEnd } }
        : t
    ));
    try {
      await LivingAppsService.updateTermineEntry(recordId, { beginn: newStart, ende: newEnd });
      undoToast(tx('Termin-Dauer angepasst'), async () => {
        setTermine(before);
        await LivingAppsService.updateTermineEntry(recordId, {
          beginn: termin.fields.beginn!,
          ende: termin.fields.ende!,
        });
      });
    } catch {
      setTermine(before);
      fetchAll();
    }
  }, [termine, termineMap, setTermine, fetchAll]);

  const handleRangeCreate = useCallback((start: Date, end: Date) => {
    crud.termine.openCreate({
      beginn: format(start, "yyyy-MM-dd'T'HH:mm"),
      ende: format(end, "yyyy-MM-dd'T'HH:mm"),
    });
  }, [crud]);

  // ── Context line ─────────────────────────────────────────────────────────

  const contextLine = useMemo(() => {
    if (heuteTermine.length === 0) return tx('Heute keine Termine geplant.');
    const patNames = heuteTermine
      .slice(0, 3)
      .map(t => t.patientName)
      .filter(Boolean);
    if (patNames.length === 0) return tx(tx`Heute ${heuteTermine.length} Termine.`);
    return tx`Heute ${heuteTermine.length} Termine — u. a. ${namen(patNames)}.`;
  }, [heuteTermine]);

  // ── Render ────────────────────────────────────────────────────────────────

  const rezeptOptions = useMemo(() => LOOKUP_OPTIONS['rezepte']?.['status'] ?? [], []);

  const hero = nichtErschienen.length > 0 ? (
    <HeroBanner
      icon={<IconAlertCircle size={18} />}
      action={{
        label: tx('Als ungültig markieren'),
        onClick: () => {
          const first = nichtErschienen[0];
          crud.termine.openDetail(first);
        },
      }}
    >
      <b>{namen(nichtErschienen.map(t => t.patientName))}</b>
      {nichtErschienen.length === 1
        ? tx` ist heute nicht erschienen.`
        : tx` sind heute nicht erschienen.`}
    </HeroBanner>
  ) : undefined;

  const kpis = (
    <StatStrip>
      <StatStripItem
        title={tx('Heute')}
        value={heuteTermine.length}
        icon={<IconCalendar size={16} />}
        tone={heuteTermine.length > 0 ? 'primary' : 'default'}
      />
      <StatStripItem
        title={tx('Diese Woche')}
        value={dieseWocheTermine.length}
        icon={<IconClockHour4 size={16} />}
        tone="default"
      />
      <StatStripItem
        title={tx('Offene Rezepte')}
        value={offeneRezepte.length}
        icon={<IconFileDescription size={16} />}
        tone={offeneRezepte.length > 0 ? 'warning' : 'default'}
      />
      <StatStripItem
        title={tx('Bald ablaufend')}
        value={baldAblaufendeRezepte.length}
        icon={<IconAlertCircle size={16} />}
        tone={baldAblaufendeRezepte.length > 0 ? 'destructive' : 'default'}
      />
    </StatStrip>
  );

  const primary = (
    <CalendarWidget
      events={calEvents}
      defaultView="week"
      weekDays={5}
      locale={dateFnsLocale()}
      dayStartHour={7}
      dayEndHour={20}
      dragSnapMinutes={15}
      onEventClick={(ev) => {
        const recordId = ev.id.split(':')[1] ?? '';
        const termin = termineMap.get(recordId);
        if (termin) crud.termine.openDetail(termin);
      }}
      onEventDrop={handleEventDrop}
      onEventResize={handleEventResize}
      onRangeCreate={handleRangeCreate}
    />
  );

  const aside = (
    <>
      <WorkList
        title={tx('Heute ungeklärt')}
        items={ungeklaerteHeute.map(t => {
          const statusKey = t.fields.status?.key ?? t.fields.status ?? 'geplant';
          const isNichtErschienen = statusKey === 'nicht_erschienen';
          const zeit = t.fields.beginn
            ? format(parseISO(t.fields.beginn), 'HH:mm', { locale: dateFnsLocale() })
            : '';
          return {
            id: t.record_id,
            title: t.patientName || tx('Unbekannt'),
            secondLine: (
              <>
                <span className={isNichtErschienen ? 'font-medium text-destructive' : 'text-amber-600 font-medium'}>
                  {isNichtErschienen ? tx('Nicht erschienen') : tx('Geplant')}
                </span>
                {zeit && (
                  <span className="text-muted-foreground"> · {zeit} {tx('Uhr')}</span>
                )}
                {t.behandlerName && (
                  <span className="text-muted-foreground"> · {t.behandlerName}</span>
                )}
              </>
            ),
            action: statusKey === 'geplant'
              ? { label: tx('Bestätigen'), onClick: () => confirmTermin(termineMap.get(t.record_id)!) }
              : { label: tx('Erschienen'), onClick: () => setErschienen(termineMap.get(t.record_id)!) },
          };
        })}
        onItemClick={(id) => {
          const termin = termineMap.get(id);
          if (termin) crud.termine.openDetail(termin);
        }}
        empty={{
          text: tx('Alle Termine heute bestätigt'),
          action: {
            label: tx('Neuen Termin anlegen'),
            onClick: () => crud.termine.openCreate({ beginn: format(clock, "yyyy-MM-dd'T'09:00") }),
          },
        }}
      />
      <WorkList
        title={tx('Rezepte laufen ab')}
        items={baldAblaufendeRezepte.slice(0, 6).map(r => ({
          id: r.record_id,
          title: r.patientName || tx('Unbekannt'),
          secondLine: (
            <>
              <span className="text-amber-600 font-medium">{r.leistungName}</span>
              <span className="text-muted-foreground"> · {tx('bis')} {formatDate(r.fields.gueltig_bis)}</span>
            </>
          ),
          action: {
            label: tx('Anzeigen'),
            onClick: () => crud.rezepte.openDetail(rezepteMap.get(r.record_id)!),
          },
        }))}
        onItemClick={(id) => {
          const rezept = rezepteMap.get(id);
          if (rezept) crud.rezepte.openDetail(rezept);
        }}
        empty={{
          text: tx('Alle Rezepte im grünen Bereich'),
          action: {
            label: tx('Rezept anlegen'),
            onClick: () => crud.rezepte.openCreate({ status: 'offen' }),
          },
        }}
      />
    </>
  );

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{gruss(clock)}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{contextLine}</p>
        </div>
        <Button
          onClick={() => crud.termine.openCreate({})}
          className="shrink-0"
          size="sm"
        >
          <IconPlus size={16} className="shrink-0 mr-1.5" />
          {tx('Neuer Termin')}
        </Button>
      </div>

      <DashboardGrid
        variant="wide"
        hero={hero}
        kpis={kpis}
        primary={primary}
        aside={aside}
      />

      {crud.surfaces}
    </div>
  );
}
