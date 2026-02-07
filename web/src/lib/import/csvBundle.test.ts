import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'

import type { DbClient } from '@/lib/repos/types'

import { EXPORT_COLUMNS, type ExportTableName } from '@/lib/export/exportColumns'

import { importCsvBundleZip } from './csvBundle'

function makeEmptyCsvForTable(table: ExportTableName): string {
  return `${EXPORT_COLUMNS[table].join(',')}\n`
}

function makeCsvForSingleRow(table: ExportTableName, rowByCol: Record<string, string>): string {
  const cols = EXPORT_COLUMNS[table]
  const row = cols.map((c) => rowByCol[c] ?? '').join(',')
  return `${cols.join(',')}\n${row}\n`
}

describe('importCsvBundleZip (dry-run)', () => {
  it('accepts a structurally valid empty bundle', async () => {
    const zip = new JSZip()
    const tables = (Object.keys(EXPORT_COLUMNS) as ExportTableName[]).sort((a, b) => a.localeCompare(b))

    zip.file(
      'meta.json',
      `${JSON.stringify(
        { format: 'peptaide-csv-bundle-v1', exported_at: '2026-02-07T00:00:00.000Z', tables },
        null,
        2,
      )}\n`,
    )

    for (const table of tables) {
      zip.file(`tables/${table}.csv`, makeEmptyCsvForTable(table))
    }

    const buf = await zip.generateAsync({ type: 'arraybuffer' })
    const res = await importCsvBundleZip({} as unknown as DbClient, {
      userId: '11111111-1111-1111-1111-111111111111',
      zipData: buf,
      mode: 'dry-run',
    })

    expect(res.ok).toBe(true)
    expect(res.format).toBe('peptaide-csv-bundle-v1')
    expect(res.tables).toHaveLength(tables.length)
    expect(res.errors).toEqual([])
  })

  it('accepts a bundle when CSV header columns are reordered (same set)', async () => {
    const zip = new JSZip()
    const tables = (Object.keys(EXPORT_COLUMNS) as ExportTableName[]).sort((a, b) => a.localeCompare(b))

    zip.file(
      'meta.json',
      `${JSON.stringify(
        { format: 'peptaide-csv-bundle-v1', exported_at: '2026-02-07T00:00:00.000Z', tables },
        null,
        2,
      )}\n`,
    )

    for (const table of tables) {
      if (table !== 'profiles') {
        zip.file(`tables/${table}.csv`, makeEmptyCsvForTable(table))
        continue
      }

      const expectedCols = EXPORT_COLUMNS.profiles
      const cols = [...expectedCols].reverse()
      const rowByCol: Record<string, string> = {
        created_at: '2026-02-07T00:00:00.000Z',
        cycle_gap_default_days: '7',
        default_mass_unit: 'mg',
        default_simulation_n: '2048',
        default_volume_unit: 'mL',
        timezone: 'UTC',
        updated_at: '2026-02-07T00:00:00.000Z',
        user_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      }
      const row = cols.map((c) => rowByCol[c] ?? '').join(',')

      zip.file(`tables/${table}.csv`, `${cols.join(',')}\n${row}\n`)
    }

    const buf = await zip.generateAsync({ type: 'arraybuffer' })
    const res = await importCsvBundleZip({} as unknown as DbClient, {
      userId: '11111111-1111-1111-1111-111111111111',
      zipData: buf,
      mode: 'dry-run',
    })

    expect(res.ok).toBe(true)
    const profiles = res.tables.find((t) => t.table === 'profiles')
    expect(profiles?.rowCount).toBe(1)
  })

  it('returns a structured error for invalid ZIP data', async () => {
    const buf = new TextEncoder().encode('not a zip').buffer
    const res = await importCsvBundleZip({} as unknown as DbClient, {
      userId: '11111111-1111-1111-1111-111111111111',
      zipData: buf,
      mode: 'dry-run',
    })

    expect(res.ok).toBe(false)
    expect(res.errors[0]).toMatch(/Invalid ZIP/i)
    expect(res.tables).toEqual([])
  })

  it('rejects bundles missing table CSVs', async () => {
    const zip = new JSZip()
    zip.file(
      'meta.json',
      `${JSON.stringify(
        { format: 'peptaide-csv-bundle-v1', exported_at: '2026-02-07T00:00:00.000Z', tables: [] },
        null,
        2,
      )}\n`,
    )

    const buf = await zip.generateAsync({ type: 'arraybuffer' })
    const res = await importCsvBundleZip({} as unknown as DbClient, {
      userId: '11111111-1111-1111-1111-111111111111',
      zipData: buf,
      mode: 'dry-run',
    })

    expect(res.ok).toBe(false)
    expect(res.tables.some((t) => t.errors.some((e) => e.includes('Missing tables/')))).toBe(true)
  })
})

type FakeCall = {
  table: string
  op: 'select' | 'insert' | 'upsert' | 'delete'
}

type FakePostgrestError = { message: string; details?: string | null; hint?: string | null; code?: string }

class FakeQuery {
  private op: FakeCall['op'] | null = null
  private table: string
  private filters: Record<string, unknown> = {}
  private payload: unknown = null
  private limitCount: number | null = null
  private maybeSingleMode = false
  private selectColumns: string | null = null

  constructor(private db: FakeDb, table: string) {
    this.table = table
  }

  select(columns = '*') {
    this.op = 'select'
    this.selectColumns = columns
    return this
  }

  insert(payload: unknown) {
    this.op = 'insert'
    this.payload = payload
    return this
  }

  upsert(payload: unknown) {
    this.op = 'upsert'
    this.payload = payload
    return this
  }

  delete() {
    this.op = 'delete'
    return this
  }

  eq(column: string, value: unknown) {
    this.filters[column] = value
    return this
  }

  limit(n: number) {
    this.limitCount = n
    return this
  }

  maybeSingle() {
    this.maybeSingleMode = true
    this.limitCount = 1
    return this
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: FakePostgrestError | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected)
  }

  private async execute(): Promise<{ data: unknown; error: FakePostgrestError | null }> {
    if (!this.op) {
      throw new Error('FakeQuery used without an operation')
    }

    this.db.calls.push({ table: this.table, op: this.op })

    if (this.op === 'select') {
      // For the import code paths, selects are only used for "is table empty?" checks and
      // for capturing the existing profile row.
      if (this.table === 'profiles' && this.maybeSingleMode) {
        return { data: this.db.existingProfile, error: null }
      }
      return { data: [], error: null }
    }

    if (this.op === 'insert') {
      if (this.db.failOnInsertTable === this.table) {
        return { data: null, error: { message: `boom: ${this.table}` } }
      }
      return { data: null, error: null }
    }

    if (this.op === 'upsert') {
      this.db.upserts.push({ table: this.table, payload: this.payload })
      return { data: null, error: null }
    }

    if (this.op === 'delete') {
      return { data: null, error: null }
    }

    return { data: null, error: { message: 'Unsupported fake op' } }
  }
}

class FakeDb {
  public calls: FakeCall[] = []
  public upserts: Array<{ table: string; payload: unknown }> = []

  constructor(
    public opts: {
      existingProfile: unknown | null
      failOnInsertTable: string | null
    },
  ) {}

  get existingProfile() {
    return this.opts.existingProfile
  }

  get failOnInsertTable() {
    return this.opts.failOnInsertTable
  }

  from(table: string) {
    return new FakeQuery(this, table)
  }
}

describe('importCsvBundleZip (apply rollback)', () => {
  async function makeBundle(opts: { includeSubstance: boolean; includeRoute: boolean }): Promise<ArrayBuffer> {
    const zip = new JSZip()
    const tables = (Object.keys(EXPORT_COLUMNS) as ExportTableName[]).sort((a, b) => a.localeCompare(b))

    zip.file(
      'meta.json',
      `${JSON.stringify(
        { format: 'peptaide-csv-bundle-v1', exported_at: '2026-02-07T00:00:00.000Z', tables },
        null,
        2,
      )}\n`,
    )

    for (const table of tables) {
      if (table === 'profiles') {
        zip.file(
          'tables/profiles.csv',
          makeCsvForSingleRow('profiles', {
            created_at: '2026-02-07T00:00:00.000Z',
            cycle_gap_default_days: '7',
            default_mass_unit: 'mg',
            default_simulation_n: '2048',
            default_volume_unit: 'mL',
            timezone: 'UTC',
            updated_at: '2026-02-07T00:00:00.000Z',
            user_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          }),
        )
        continue
      }

      if (table === 'substances' && opts.includeSubstance) {
        zip.file(
          'tables/substances.csv',
          makeCsvForSingleRow('substances', {
            canonical_name: 'demo_substance',
            created_at: '2026-02-07T00:00:00.000Z',
            deleted_at: '',
            display_name: 'Demo substance',
            family: 'peptide',
            id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
            notes: '',
            target_compartment_default: 'systemic',
            updated_at: '2026-02-07T00:00:00.000Z',
            user_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          }),
        )
        continue
      }

      if (table === 'routes' && opts.includeRoute) {
        zip.file(
          'tables/routes.csv',
          makeCsvForSingleRow('routes', {
            created_at: '2026-02-07T00:00:00.000Z',
            default_input_kind: 'mass',
            default_input_unit: 'mg',
            deleted_at: '',
            id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
            name: 'demo_route',
            notes: '',
            supports_device_calibration: 'false',
            updated_at: '2026-02-07T00:00:00.000Z',
            user_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          }),
        )
        continue
      }

      zip.file(`tables/${table}.csv`, makeEmptyCsvForTable(table))
    }

    return await zip.generateAsync({ type: 'arraybuffer' })
  }

  it('rolls back to an empty dataset in replace mode after an insert failure', async () => {
    const userId = '11111111-1111-1111-1111-111111111111'
    const zipData = await makeBundle({ includeSubstance: true, includeRoute: true })

    const db = new FakeDb({ existingProfile: null, failOnInsertTable: 'routes' })

    const res = await importCsvBundleZip(db as unknown as DbClient, {
      userId,
      zipData,
      mode: 'apply',
      replaceExisting: true,
    })

    expect(res.ok).toBe(false)
    expect(res.errors[0]).toMatch(/Import apply failed/i)

    const deletes = db.calls.filter((c) => c.op === 'delete').map((c) => c.table)
    // `replaceExisting=true` calls delete-all up front and again during rollback.
    expect(deletes.filter((t) => t === 'substances')).toHaveLength(2)
    expect(deletes.filter((t) => t === 'routes')).toHaveLength(2)
    expect(deletes.filter((t) => t === 'profiles')).toHaveLength(2)
  })

  it('rolls back non-profile tables and restores the existing profile in non-replace mode', async () => {
    const userId = '11111111-1111-1111-1111-111111111111'
    const zipData = await makeBundle({ includeSubstance: true, includeRoute: true })

    const existingProfile = {
      user_id: userId,
      timezone: 'America/Los_Angeles',
      default_mass_unit: 'mg',
      default_volume_unit: 'mL',
      default_simulation_n: 1024,
      cycle_gap_default_days: 5,
      created_at: '2026-02-07T00:00:00.000Z',
      updated_at: '2026-02-07T00:00:00.000Z',
    }

    const db = new FakeDb({ existingProfile, failOnInsertTable: 'routes' })

    const res = await importCsvBundleZip(db as unknown as DbClient, {
      userId,
      zipData,
      mode: 'apply',
      replaceExisting: false,
    })

    expect(res.ok).toBe(false)
    expect(res.errors[0]).toMatch(/Import apply failed/i)

    const deletes = db.calls.filter((c) => c.op === 'delete').map((c) => c.table)
    expect(deletes).toContain('substances')
    expect(deletes).toContain('routes')
    expect(deletes).not.toContain('profiles')

    const profileUpserts = db.upserts.filter((u) => u.table === 'profiles')
    // First upsert is from the import bundle; second upsert restores the pre-import profile.
    expect(profileUpserts).toHaveLength(2)
  })
})
