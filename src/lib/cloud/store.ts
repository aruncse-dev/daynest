/**
 * Where the encrypted family copy lives. The Sheet holds only:
 *   data tab: key (opaque HMAC) | updatedAt | deleted | payload (AES-GCM)
 *   meta tab: format version, salt, key check
 * Rows are never removed or reordered (deletions are rows with deleted = 1),
 * so a row's position is stable and can be updated in place.
 */

export interface CloudRow {
  key: string
  updatedAt: string
  deleted: boolean
  payload: string
  /** 1-based sheet row, when the row already exists */
  row?: number
}

export interface CloudMeta {
  v: number
  salt: string
  check: string
  createdAt: string
}

export interface CloudStore {
  readAll(): Promise<{ rows: CloudRow[]; meta: CloudMeta | null }>
  writeMeta(meta: CloudMeta): Promise<void>
  /** Update rows that have `row`, append the rest. */
  upsert(rows: CloudRow[]): Promise<void>
}

/** In-memory store for tests and the tour. */
export class MemoryStore implements CloudStore {
  rows: CloudRow[] = []
  meta: CloudMeta | null = null
  async readAll() {
    return {
      rows: this.rows.map((r, i) => ({ ...r, row: i + 2 })),
      meta: this.meta ? { ...this.meta } : null,
    }
  }
  async writeMeta(meta: CloudMeta) {
    this.meta = { ...meta }
  }
  async upsert(rows: CloudRow[]) {
    for (const r of rows) {
      const clean = { key: r.key, updatedAt: r.updatedAt, deleted: r.deleted, payload: r.payload }
      if (r.row) this.rows[r.row - 2] = clean
      else this.rows.push(clean)
    }
  }
}
