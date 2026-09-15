/**
 * The INTERNAL door of the journey port — authenticated, via LivingAppsService.
 * GENERATED: one lister and one creator per entity. Do not edit.
 *
 *   import { servicePort } from '@/services/journeyPort';
 *
 * Intent pages hand this to `useJourneySubmit` and to shared step blocks. It
 * exposes only list · create · ref — the public subset — so a step written
 * against it also runs on a public page. Undo, edit and delete stay on the
 * page itself (LivingAppsService), never inside a shared step.
 */
import { LivingAppsService, createRecordUrl, type RecordQuery } from '@/services/livingAppsService';
import { toWirePayload, type InternalJourneyPort, type JourneyRecord } from '@/lib/journey/port';
import { buildSearchFilter, byIdFilter, combineFilters } from '@/lib/journey/search';
import type { EntityKey } from '@/lib/journey/rules';

type RawRecord = { record_id: string; fields: Record<string, unknown>; createdat?: string | null };
type RawMutation = { record_id: string; fields?: Record<string, unknown>; created_at?: string | null };

const listers: Record<EntityKey, () => Promise<RawRecord[]>> = {
  'behandler': () => LivingAppsService.getBehandler() as Promise<RawRecord[]>,
  'patienten': () => LivingAppsService.getPatienten() as Promise<RawRecord[]>,
  'leistungen': () => LivingAppsService.getLeistungen() as Promise<RawRecord[]>,
  'rezepte': () => LivingAppsService.getRezepte() as Promise<RawRecord[]>,
  'termine': () => LivingAppsService.getTermine() as Promise<RawRecord[]>,
  'behandlungen': () => LivingAppsService.getBehandlungen() as Promise<RawRecord[]>,
};

/** The query/count half — the REST parameters the plain listers never send. */
const queriers: Record<EntityKey, (q: RecordQuery) => Promise<RawRecord[]>> = {
  'behandler': q => LivingAppsService.queryBehandler(q) as Promise<RawRecord[]>,
  'patienten': q => LivingAppsService.queryPatienten(q) as Promise<RawRecord[]>,
  'leistungen': q => LivingAppsService.queryLeistungen(q) as Promise<RawRecord[]>,
  'rezepte': q => LivingAppsService.queryRezepte(q) as Promise<RawRecord[]>,
  'termine': q => LivingAppsService.queryTermine(q) as Promise<RawRecord[]>,
  'behandlungen': q => LivingAppsService.queryBehandlungen(q) as Promise<RawRecord[]>,
};

const counters: Record<EntityKey, (filter?: string, signal?: AbortSignal) => Promise<number>> = {
  'behandler': (filter, signal) => LivingAppsService.countBehandler(filter, signal),
  'patienten': (filter, signal) => LivingAppsService.countPatienten(filter, signal),
  'leistungen': (filter, signal) => LivingAppsService.countLeistungen(filter, signal),
  'rezepte': (filter, signal) => LivingAppsService.countRezepte(filter, signal),
  'termine': (filter, signal) => LivingAppsService.countTermine(filter, signal),
  'behandlungen': (filter, signal) => LivingAppsService.countBehandlungen(filter, signal),
};

const creators: Record<EntityKey, (fields: Record<string, unknown>) => Promise<RawMutation>> = {
  'behandler': fields => LivingAppsService.createBehandlerEntry(fields as never),
  'patienten': fields => LivingAppsService.createPatientenEntry(fields as never),
  'leistungen': fields => LivingAppsService.createLeistungenEntry(fields as never),
  'rezepte': fields => LivingAppsService.createRezepteEntry(fields as never),
  'termine': fields => LivingAppsService.createTermineEntry(fields as never),
  'behandlungen': fields => LivingAppsService.createBehandlungenEntry(fields as never),
};

const updaters: Record<EntityKey, (id: string, fields: Record<string, unknown>) => Promise<RawMutation>> = {
  'behandler': (id, fields) => LivingAppsService.updateBehandlerEntry(id, fields as never),
  'patienten': (id, fields) => LivingAppsService.updatePatientenEntry(id, fields as never),
  'leistungen': (id, fields) => LivingAppsService.updateLeistungenEntry(id, fields as never),
  'rezepte': (id, fields) => LivingAppsService.updateRezepteEntry(id, fields as never),
  'termine': (id, fields) => LivingAppsService.updateTermineEntry(id, fields as never),
  'behandlungen': (id, fields) => LivingAppsService.updateBehandlungenEntry(id, fields as never),
};

function toJourneyRecord(r: RawRecord): JourneyRecord {
  return { id: r.record_id, fields: r.fields ?? {}, createdAt: r.createdat ?? null };
}

export const servicePort: InternalJourneyPort = {
  door: 'internal',
  async list(entity, opts) {
    // Only a bare list(entity) (or an empty options object) takes the historic
    // load-everything path. ANY explicit option — `limit` included — goes to the
    // server: useRecordSearch's first page of a big entity must not pull the
    // whole table (live 2026-09-02: all 263 employees travelled for a limit-50
    // first page because `limit` alone did not count as a query).
    const usesQuery = !!opts && (opts.search !== undefined || opts.offset !== undefined
      || opts.orderby !== undefined || opts.fields !== undefined || opts.signal !== undefined
      || opts.limit !== undefined || opts.filter !== undefined);
    if (!usesQuery) {
      const rows = await listers[entity]();
      const limited = opts?.limit ? rows.slice(0, opts.limit) : rows;
      return limited.map(toJourneyRecord);
    }
    const filter = combineFilters(opts.filter, opts.search ? buildSearchFilter(opts.search.query, opts.search.fields) : undefined);
    const rows = await queriers[entity]({
      filter, orderby: opts.orderby, limit: opts.limit, offset: opts.offset, fields: opts.fields, signal: opts.signal,
    });
    return rows.map(toJourneyRecord);
  },
  async count(entity, opts) {
    const filter = combineFilters(opts?.filter, opts?.search ? buildSearchFilter(opts.search.query, opts.search.fields) : undefined);
    return counters[entity](filter, opts?.signal);
  },
  async get(entity, id) {
    // One query on the server, not the whole table: `r.id` is the vSQL name
    // of the record id (a live page wrote `r.record_id` and got a 400).
    const rows = await queriers[entity]({ filter: byIdFilter(id), limit: 1 });
    return rows[0] ? toJourneyRecord(rows[0]) : null;
  },
  async create(entity, values) {
    const r = await creators[entity](toWirePayload(entity, values, servicePort));
    return { id: r.record_id, fields: r.fields ?? {}, createdAt: r.created_at ?? null };
  },
  // The same payload rules as create — plain ids in, references shaped here.
  async update(entity, id, values) {
    const r = await updaters[entity](id, toWirePayload(entity, values, servicePort));
    return { id: r.record_id || id, fields: r.fields ?? {}, createdAt: r.created_at ?? null };
  },
  ref: (appId, recordId) => createRecordUrl(appId, recordId),
};
