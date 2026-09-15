import { useState, useMemo } from 'react';
import { format, parseISO, isToday, startOfDay, isBefore, addDays, isAfter } from 'date-fns';
import type { DashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { DashboardGrid } from '@/components/DashboardGrid';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import { CalendarWidget, type CalendarEvent } from '@/components/widgets/CalendarWidget';
import { tx, appLabel, dateFnsLocale } from '@/i18n';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { formatDate, lookupKey } from '@/lib/formatters';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { lookupOption, APP_IDS } from '@/types/app';
import { IconCalendar, IconUserCheck, IconAlertTriangle, IconClipboardList, IconPlus, IconCheck } from '@tabler/icons-react';

export default function DashboardOverview({ data }: { data: DashboardData }) {
  const {
    behandler, patienten, leistungen: _leistungen, rezepte, termine, behandlungen: _behandlungen,
    behandlerMap, patientenMap, rezepteMap, termineMap,
    setTermine, fetchAll,
  } = data;

  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type === 'termine') {
        const st = lookupKey(top.record.fields.status);
        if (st === 'geplant') return {
          label: tx('Bestätigen'),
          onClick: () => confirmTermin(top.record),
        };
        if (st === 'bestaetigt') return {
          label: tx('Erschienen'),
          onClick: () => markErschienen(top.record),
        };
      }
      return undefined;
    },
  });

  const enrichedTermine = crud.enriched.termine;
  const enrichedRezepte = crud.enriched.rezepte;

  const clock = useClock();
  const [filterBehandler, setFilterBehandler] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  // --- Advance helpers ---
  function confirmTermin(termin: typeof termine[0]) {
    const prev = [...termine];
    setTermine(t => t.map(x => x.record_id === termin.record_id
      ? { ...x, fields: { ...x.fields, status: lookupOption('termine', 'status', 'bestaetigt') } }
      : x
    ));
    LivingAppsService.updateTermineEntry(termin.record_id, { status: 'bestaetigt' })
      .then(() => undoToast(tx`${termin.record_id} — bestätigt`, () => {
        setTermine(prev);
        LivingAppsService.updateTermineEntry(termin.record_id, { status: 'geplant' }).catch(() => fetchAll());
      }))
      .catch(() => { setTermine(prev); fetchAll(); });
  }

  function markErschienen(termin: typeof termine[0]) {
    const prev = [...termine];
    setTermine(t => t.map(x => x.record_id === termin.record_id
      ? { ...x, fields: { ...x.fields, status: lookupOption('termine', 'status', 'erschienen') } }
      : x
    ));
    LivingAppsService.updateTermineEntry(termin.record_id, { status: 'erschienen' })
      .then(() => undoToast(tx`${termin.record_id} — erschienen`, () => {
        setTermine(prev);
        LivingAppsService.updateTermineEntry(termin.record_id, { status: 'bestaetigt' }).catch(() => fetchAll());
      }))
      .catch(() => { setTermine(prev); fetchAll(); });
  }

  // --- Derived data ---
  const today = format(clock, 'yyyy-MM-dd');

  const termineHeute = useMemo(() =>
    enrichedTermine.filter(t => {
      if (!t.fields.beginn) return false;
      return t.fields.beginn.startsWith(today);
    }).sort((a, b) => (a.fields.beginn ?? '').localeCompare(b.fields.beginn ?? '')),
    [enrichedTermine, today]
  );

  const nichtErschienen = useMemo(() =>
    enrichedTermine.filter(t => {
      const st = lookupKey(t.fields.status);
      if (st !== 'geplant' && st !== 'bestaetigt') return false;
      if (!t.fields.beginn) return false;
      return isBefore(parseISO(t.fields.beginn), clock) && !t.fields.beginn.startsWith(today);
    }),
    [enrichedTermine, clock, today]
  );

  const aktiveBehandler = useMemo(() =>
    behandler.filter(b => lookupKey(b.fields.status) === 'aktiv'),
    [behandler]
  );

  const offeneRezepte = useMemo(() =>
    enrichedRezepte.filter(r => {
      const st = lookupKey(r.fields.status);
      return st === 'offen' || st === 'in_behandlung';
    }),
    [enrichedRezepte]
  );

  const ablaufendeRezepte = useMemo(() =>
    enrichedRezepte.filter(r => {
      if (!r.fields.gueltig_bis) return false;
      const ablauf = parseISO(r.fields.gueltig_bis);
      const inFuenf = addDays(clock, 5);
      return (isToday(ablauf) || (isAfter(ablauf, startOfDay(clock)) && isBefore(ablauf, inFuenf)));
    }).sort((a, b) => (a.fields.gueltig_bis ?? '').localeCompare(b.fields.gueltig_bis ?? '')),
    [enrichedRezepte, clock]
  );

  const termineWoche = useMemo(() => {
    const von = format(clock, 'yyyy-MM-dd');
    const bis = format(addDays(clock, 6), 'yyyy-MM-dd');
    return enrichedTermine.filter(t => {
      if (!t.fields.beginn) return false;
      const d = t.fields.beginn.slice(0, 10);
      return d >= von && d <= bis;
    });
  }, [enrichedTermine, clock]);

  // --- Context line ---
  const heuteNamen = termineHeute.slice(0, 3).map(t => t.patientName).filter(Boolean);
  const contextLine = termineHeute.length > 0
    ? tx`Heute ${termineHeute.length} Termine — u.a. ${namen(heuteNamen)}`
    : tx`Heute keine Termine geplant`;

  // --- Calendar events ---
  const calEvents = useMemo<CalendarEvent[]>(() => {
    const filtered = filterBehandler
      ? enrichedTermine.filter(t => extractRecordId(t.fields.behandler) === filterBehandler)
      : enrichedTermine;
    const statusFiltered = filterStatus
      ? filtered.filter(t => lookupKey(t.fields.status) === filterStatus)
      : filtered;

    return statusFiltered
      .filter(t => t.fields.beginn)
      .map(t => {
        const st = lookupKey(t.fields.status);
        const tone: CalendarEvent['tone'] =
          st === 'abgesagt' ? 'destructive' :
          st === 'erschienen' ? 'success' :
          st === 'bestaetigt' ? 'primary' :
          st === 'nicht_erschienen' ? 'warning' :
          'default';
        const behandlerName = t.behandlerName || '';
        const patientName = t.patientName || tx('Unbekannt');
        return {
          id: `termin:${t.record_id}`,
          start: t.fields.beginn!,
          end: t.fields.ende,
          title: patientName,
          subtitle: behandlerName || t.fields.raum?.label || '',
          tone,
        };
      });
  }, [enrichedTermine, filterBehandler, filterStatus]);

  // --- Hero: vergangene unbearbeitete Termine ---
  const ueberfaelligText = nichtErschienen.length > 0
    ? namen(nichtErschienen.slice(0, 3).map(t => t.patientName).filter(Boolean))
    : '';

  // --- Drag reschedule ---
  const handleEventDrop = async (eventId: string, newStart: string, newEnd?: string) => {
    const id = eventId.split(':')[1] ?? '';
    const t = termineMap.get(id);
    if (!t) return;
    const st = lookupKey(t.fields.status);
    if (st === 'erschienen' || st === 'abgesagt') {
      return tx('Abgeschlossene Termine können nicht verschoben werden');
    }
    const prev = [...termine];
    setTermine(all => all.map(x => x.record_id === id
      ? { ...x, fields: { ...x.fields, beginn: newStart, ...(newEnd ? { ende: newEnd } : {}) } }
      : x
    ));
    try {
      await LivingAppsService.updateTermineEntry(id, {
        beginn: newStart,
        ...(newEnd ? { ende: newEnd } : {}),
      });
      undoToast(tx('Termin verschoben'), () => {
        setTermine(prev);
        LivingAppsService.updateTermineEntry(id, {
          beginn: t.fields.beginn ?? newStart,
          ...(t.fields.ende ? { ende: t.fields.ende } : {}),
        }).catch(() => fetchAll());
      });
    } catch {
      setTermine(prev);
      fetchAll();
    }
  };

  const handleEventResize = async (eventId: string, newStart: string, newEnd: string) => {
    const id = eventId.split(':')[1] ?? '';
    const t = termineMap.get(id);
    if (!t) return;
    const prev = [...termine];
    setTermine(all => all.map(x => x.record_id === id
      ? { ...x, fields: { ...x.fields, beginn: newStart, ende: newEnd } }
      : x
    ));
    try {
      await LivingAppsService.updateTermineEntry(id, { beginn: newStart, ende: newEnd });
      undoToast(tx('Dauer geändert'), () => {
        setTermine(prev);
        LivingAppsService.updateTermineEntry(id, {
          beginn: t.fields.beginn ?? newStart,
          ende: t.fields.ende ?? newEnd,
        }).catch(() => fetchAll());
      });
    } catch {
      setTermine(prev);
      fetchAll();
    }
  };

  const handleRangeCreate = (start: Date, end: Date) => {
    crud.termine.openCreate({
      beginn: format(start, "yyyy-MM-dd'T'HH:mm"),
      ende: format(end, "yyyy-MM-dd'T'HH:mm"),
    });
  };

  const handleEventClick = (ev: CalendarEvent) => {
    const id = ev.id.split(':')[1] ?? '';
    const termin = termineMap.get(id);
    if (termin) crud.termine.openDetail(termin);
  };

  // --- Unbestätigte heute ---
  const ungeplantHeute = useMemo(() =>
    termineHeute.filter(t => lookupKey(t.fields.status) === 'geplant'),
    [termineHeute]
  );

  // empty dashboard check
  const isEmpty = termine.length === 0 && patienten.length === 0;

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-6 text-center">
        <IconCalendar size={48} className="text-muted-foreground" />
        <div>
          <h2 className="text-xl font-semibold mb-2">{tx('Praxis einrichten')}</h2>
          <p className="text-muted-foreground text-sm max-w-sm">{tx('Lege zunächst Behandler und Patienten an, dann kannst du Termine vergeben.')}</p>
        </div>
        <div className="flex flex-wrap gap-3 justify-center">
          <button
            className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90"
            onClick={() => crud.patienten.openCreate({})}
          >
            <IconPlus size={16} />
            {tx('Ersten Patienten anlegen')}
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-xl bg-secondary text-secondary-foreground px-4 py-2 text-sm font-medium hover:bg-secondary/80"
            onClick={() => crud.behandler.openCreate({})}
          >
            <IconPlus size={16} />
            {tx('Behandler anlegen')}
          </button>
        </div>
        {crud.surfaces}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{gruss(clock)}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{contextLine}</p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 shrink-0"
          onClick={() => crud.termine.openCreate({})}
        >
          <IconPlus size={16} />
          {tx('Neuer Termin')}
        </button>
      </div>

      <DashboardGrid
        variant="wide"
        hero={nichtErschienen.length > 0 ? (
          <HeroBanner
            icon={<IconAlertTriangle size={18} />}
            action={{
              label: tx('Als erschienen markieren'),
              onClick: () => confirmTermin(nichtErschienen[0]),
            }}
          >
            <b>{ueberfaelligText}</b>{' '}
            {nichtErschienen.length === 1
              ? tx('hat einen Termin ohne Status-Rückmeldung.')
              : tx('haben Termine ohne Status-Rückmeldung.')}
          </HeroBanner>
        ) : undefined}
        kpis={
          <StatStrip>
            <StatStripItem
              title={tx('Heute')}
              value={termineHeute.length}
              icon={<IconCalendar size={16} className="shrink-0" />}
              tone={termineHeute.length > 0 ? 'primary' : 'default'}
              onClick={() => setFilterStatus(s => s === 'geplant' ? null : 'geplant')}
              active={filterStatus === 'geplant'}
            />
            <StatStripItem
              title={tx('Unbestätigt')}
              value={ungeplantHeute.length}
              icon={<IconUserCheck size={16} className="shrink-0" />}
              tone={ungeplantHeute.length > 0 ? 'warning' : 'default'}
              onClick={() => setFilterStatus(s => s === 'geplant' ? null : 'geplant')}
              active={filterStatus === 'geplant'}
            />
            <StatStripItem
              title={tx('Diese Woche')}
              value={termineWoche.length}
              icon={<IconCalendar size={16} className="shrink-0" />}
            />
            <StatStripItem
              title={tx('Offene Rezepte')}
              value={offeneRezepte.length}
              icon={<IconClipboardList size={16} className="shrink-0" />}
              tone={offeneRezepte.length > 0 ? 'default' : 'success'}
            />
            {aktiveBehandler.map(b => (
              <StatStripItem
                key={b.record_id}
                title={b.fields.kuerzel ?? (b.fields.vorname ?? '')}
                value={termineHeute.filter(t => extractRecordId(t.fields.behandler) === b.record_id).length}
                tone={lookupKey(b.fields.status) === 'aktiv' ? 'default' : 'warning'}
                onClick={() => setFilterBehandler(f => f === b.record_id ? null : b.record_id)}
                active={filterBehandler === b.record_id}
              />
            ))}
          </StatStrip>
        }
        primary={
          <CalendarWidget
            events={calEvents}
            defaultView="week"
            weekDays={5}
            locale={dateFnsLocale()}
            dayStartHour={7}
            dayEndHour={20}
            dragSnapMinutes={15}
            onEventClick={handleEventClick}
            onEventDrop={handleEventDrop}
            onEventResize={handleEventResize}
            onRangeCreate={handleRangeCreate}
          />
        }
        aside={
          <>
            <WorkList
              title={tx('Heute unbestätigt')}
              items={ungeplantHeute.map(t => ({
                id: t.record_id,
                title: t.patientName || tx('Patient unbekannt'),
                secondLine: (
                  <>
                    <span className="font-medium text-amber-600">{tx('Geplant')}</span>
                    {t.fields.beginn && (
                      <span className="text-muted-foreground"> · {t.fields.beginn.slice(11, 16)} {tx('Uhr')}</span>
                    )}
                    {t.behandlerName && (
                      <span className="text-muted-foreground"> · {t.behandlerName}</span>
                    )}
                  </>
                ),
                action: {
                  label: tx('Bestätigen'),
                  onClick: () => confirmTermin(t),
                },
              }))}
              onItemClick={id => {
                const t = termineMap.get(id);
                if (t) crud.termine.openDetail(t);
              }}
              empty={{
                text: tx('Alle heutigen Termine sind bestätigt.'),
                action: { label: tx('Neuer Termin'), onClick: () => crud.termine.openCreate({}) },
              }}
            />
            <WorkList
              title={tx('Rezepte laufen bald ab')}
              items={ablaufendeRezepte.map(r => ({
                id: r.record_id,
                title: r.patientName || tx('Patient unbekannt'),
                secondLine: (
                  <>
                    <span className="font-medium text-amber-600">{r.leistungName}</span>
                    <span className="text-muted-foreground"> · {tx('bis')} {formatDate(r.fields.gueltig_bis)}</span>
                  </>
                ),
                action: {
                  label: tx('Öffnen'),
                  onClick: () => crud.rezepte.openDetail(r),
                },
              }))}
              onItemClick={id => {
                const r = rezepteMap.get(id);
                if (r) crud.rezepte.openDetail(r);
              }}
              empty={{
                text: ablaufendeRezepte.length === 0
                  ? (offeneRezepte.length > 0
                    ? tx`${offeneRezepte.length} aktive Rezepte, keines läuft in 5 Tagen ab`
                    : tx('Keine aktiven Rezepte'))
                  : tx('Alle Rezepte sind aktuell'),
                action: { label: tx('Neues Rezept'), onClick: () => crud.rezepte.openCreate({}) },
              }}
            />
          </>
        }
      />

      {crud.surfaces}
    </div>
  );
}
