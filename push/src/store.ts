/** Storage for devices (push subscriptions) and the minutes each one should be woken. */

export interface Device {
  id: string
  endpoint: string
  p256dh: string
  auth: string
  secretHash: string
  updatedAt: number // epoch ms
}

export interface DueSlot {
  deviceId: string
  at: number // epoch minute
  endpoint: string
  p256dh: string
  auth: string
}

export interface Store {
  getDevice(id: string): Promise<Device | null>
  /** Upsert the device and replace all of its future slots. */
  saveDevice(device: Device, slots: number[]): Promise<void>
  deleteDevice(id: string): Promise<void>
  dueSlots(nowMinute: number, limit: number): Promise<DueSlot[]>
  deleteSlotsUpTo(nowMinute: number): Promise<void>
  pruneDevices(olderThanMs: number): Promise<void>
}

export class D1Store implements Store {
  constructor(private db: D1Database) {}

  async getDevice(id: string) {
    const r = await this.db
      .prepare(
        'SELECT id, endpoint, p256dh, auth, secret_hash AS secretHash, updated_at AS updatedAt FROM devices WHERE id = ?',
      )
      .bind(id)
      .first<Device>()
    return r ?? null
  }

  async saveDevice(d: Device, slots: number[]) {
    const stmts = [
      this.db
        .prepare(
          `INSERT INTO devices (id, endpoint, p256dh, auth, secret_hash, updated_at) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET endpoint = excluded.endpoint, p256dh = excluded.p256dh, auth = excluded.auth, updated_at = excluded.updated_at`,
        )
        .bind(d.id, d.endpoint, d.p256dh, d.auth, d.secretHash, d.updatedAt),
      this.db.prepare('DELETE FROM slots WHERE device_id = ?').bind(d.id),
      ...slots.map((at) =>
        this.db.prepare('INSERT OR IGNORE INTO slots (device_id, at) VALUES (?, ?)').bind(d.id, at),
      ),
    ]
    await this.db.batch(stmts)
  }

  async deleteDevice(id: string) {
    await this.db.batch([
      this.db.prepare('DELETE FROM slots WHERE device_id = ?').bind(id),
      this.db.prepare('DELETE FROM devices WHERE id = ?').bind(id),
    ])
  }

  async dueSlots(nowMinute: number, limit: number) {
    const r = await this.db
      .prepare(
        `SELECT s.device_id AS deviceId, s.at AS at, d.endpoint AS endpoint, d.p256dh AS p256dh, d.auth AS auth
         FROM slots s JOIN devices d ON d.id = s.device_id WHERE s.at <= ? ORDER BY s.at LIMIT ?`,
      )
      .bind(nowMinute, limit)
      .all<DueSlot>()
    return r.results
  }

  async deleteSlotsUpTo(nowMinute: number) {
    await this.db.prepare('DELETE FROM slots WHERE at <= ?').bind(nowMinute).run()
  }

  async pruneDevices(olderThanMs: number) {
    await this.db.batch([
      this.db
        .prepare(
          'DELETE FROM slots WHERE device_id IN (SELECT id FROM devices WHERE updated_at < ?)',
        )
        .bind(olderThanMs),
      this.db.prepare('DELETE FROM devices WHERE updated_at < ?').bind(olderThanMs),
    ])
  }
}

/** In-memory store for tests and local experiments. */
export class MemoryStore implements Store {
  devices = new Map<string, Device>()
  slots = new Map<string, Set<number>>()
  async getDevice(id: string) {
    return this.devices.get(id) ?? null
  }
  async saveDevice(d: Device, slots: number[]) {
    const prev = this.devices.get(d.id)
    this.devices.set(d.id, { ...d, secretHash: prev?.secretHash ?? d.secretHash })
    this.slots.set(d.id, new Set(slots))
  }
  async deleteDevice(id: string) {
    this.devices.delete(id)
    this.slots.delete(id)
  }
  async dueSlots(nowMinute: number, limit: number) {
    const out: DueSlot[] = []
    for (const [deviceId, set] of this.slots) {
      const d = this.devices.get(deviceId)
      if (!d) continue
      for (const at of set)
        if (at <= nowMinute)
          out.push({ deviceId, at, endpoint: d.endpoint, p256dh: d.p256dh, auth: d.auth })
    }
    return out.sort((a, b) => a.at - b.at).slice(0, limit)
  }
  async deleteSlotsUpTo(nowMinute: number) {
    for (const set of this.slots.values())
      for (const at of [...set]) if (at <= nowMinute) set.delete(at)
  }
  async pruneDevices(olderThanMs: number) {
    for (const [id, d] of this.devices) if (d.updatedAt < olderThanMs) await this.deleteDevice(id)
  }
}
