import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { config } from './config.js';
import { hashPassword } from './crypto.js';
import { activeStatuses, type Meeting, type MeetingStatus, type Mom, type Participant, type Snapshot, type TranscriptSegment, type User, type UserWithSecret, type Role } from './models.js';
const { Pool } = pg;

const iso = (value: unknown) => value ? new Date(value as string).toISOString() : undefined;

function userRow(r: any): User {
  return {
    id: r.id,
    username: r.username ?? r.object_id ?? '',
    tenantId: r.tenant_id ?? r.tenantId ?? 'local',
    objectId: r.object_id ?? r.objectId ?? '',
    email: r.email ?? '',
    displayName: r.display_name ?? r.displayName ?? '',
    role: r.role,
    mustChangePassword: Boolean(r.must_change_password ?? r.mustChangePassword),
    createdAt: iso(r.created_at ?? r.createdAt),
    updatedAt: iso(r.updated_at ?? r.updatedAt),
  };
}

function userSecretRow(r: any): UserWithSecret {
  return {
    ...userRow(r),
    passwordHash: r.password_hash ?? r.passwordHash ?? '',
    salt: r.salt ?? '',
  };
}

export const SILENCE_HALLUCINATION_PATTERNS = [
  /^thank you( very much)?[.!]?$/i,
  /^thanks( a lot| for watching)?[.!]?$/i,
  /^thank you for watching[.!]?$/i,
  /^obrigad[oa][.!]?$/i,
  /^subtitles? by.*$/i,
  /^sous-titres par.*$/i,
  /^transcribed by.*$/i,
  /^(please )?like and subscribe[.!]?$/i,
  /^(please )?subscribe[.!]?$/i,
  /^you$/i,
  /^\.+$/,
];

export function isHallucination(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length < 2) return true;
  return SILENCE_HALLUCINATION_PATTERNS.some(p => p.test(trimmed));
}

function meetingRow(r: any): Meeting {
  return {
    id: r.id,
    ownerId: r.owner_id,
    engineId: r.engine_id ?? undefined,
    encryptedUrl: r.encrypted_url ?? undefined,
    title: r.title,
    botName: r.bot_name,
    status: r.status,
    failureCode: r.failure_code ?? undefined,
    failureMessage: r.failure_message ?? undefined,
    recordingObjectKey: r.recording_object_key ?? undefined,
    consentedAt: iso(r.consented_at)!,
    startedAt: iso(r.started_at),
    endedAt: iso(r.ended_at),
    expiresAt: iso(r.expires_at)!,
    createdAt: iso(r.created_at)!,
    updatedAt: iso(r.updated_at)!,
  };
}

export class Repository {
  private pool = config.databaseUrl ? new Pool({
    connectionString: config.databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000
  }) : undefined;
  private users = new Map<string, UserWithSecret>();
  private meetings = new Map<string, Meeting>();
  private participants: Participant[] = [];
  private transcript: TranscriptSegment[] = [];
  private snapshots: Snapshot[] = [];
  private moms = new Map<string, Mom[]>();

  constructor() {
    this.pool?.on('error', (err) => {
      console.warn('PostgreSQL idle client disconnected:', err?.message || String(err));
    });
  }

  async init() {
    if (this.pool) {
      const p1 = resolve(dirname(fileURLToPath(import.meta.url)), '../migrations/001_init.sql');
      await this.pool.query(await readFile(p1, 'utf8'));
      const p2 = resolve(dirname(fileURLToPath(import.meta.url)), '../migrations/002_auth_users.sql');
      await this.pool.query(await readFile(p2, 'utf8'));
    }
    await this.seedDefaultUsers();
  }

  async healthy() {
    if (!this.pool) return true;
    await this.pool.query('SELECT 1');
    return true;
  }

  async close() {
    await this.pool?.end();
  }

  async seedDefaultUsers() {
    const devPass = await hashPassword('fatimaarif');
    const adminPass = await hashPassword('ai@123');

    if (!this.pool) {
      const devId = randomUUID();
      const adminId = randomUUID();
      this.users.clear();
      this.users.set(devId, {
        id: devId,
        username: 'azeemniazi',
        passwordHash: devPass.hash,
        salt: devPass.salt,
        displayName: 'Azeem Niazi',
        role: 'dev',
        mustChangePassword: false,
        tenantId: 'local',
        objectId: 'azeemniazi',
        email: 'azeemniazi@cloudcore.local',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      this.users.set(adminId, {
        id: adminId,
        username: 'muhammadali',
        passwordHash: adminPass.hash,
        salt: adminPass.salt,
        displayName: 'Muhammad Ali',
        role: 'admin',
        mustChangePassword: false,
        tenantId: 'local',
        objectId: 'muhammadali',
        email: 'muhammadali@cloudcore.local',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      return;
    }

    try {
      const devRes = await this.pool.query(`
        INSERT INTO users(id, username, password_hash, salt, display_name, role, must_change_password, tenant_id, object_id, email)
        VALUES($1, 'azeemniazi', $2, $3, 'Azeem Niazi', 'dev', false, 'local', 'azeemniazi', 'azeemniazi@cloudcore.local')
        ON CONFLICT (LOWER(username)) DO UPDATE SET
          password_hash = EXCLUDED.password_hash,
          salt = EXCLUDED.salt,
          role = 'dev',
          display_name = 'Azeem Niazi',
          must_change_password = false,
          updated_at = now()
        RETURNING id
      `, [randomUUID(), devPass.hash, devPass.salt]);
      const devId = devRes.rows[0]?.id;

      await this.pool.query(`
        INSERT INTO users(id, username, password_hash, salt, display_name, role, must_change_password, tenant_id, object_id, email)
        VALUES($1, 'muhammadali', $2, $3, 'Muhammad Ali', 'admin', false, 'local', 'muhammadali', 'muhammadali@cloudcore.local')
        ON CONFLICT (LOWER(username)) DO UPDATE SET
          password_hash = EXCLUDED.password_hash,
          salt = EXCLUDED.salt,
          role = 'admin',
          display_name = 'Muhammad Ali',
          must_change_password = false,
          updated_at = now()
        RETURNING id
      `, [randomUUID(), adminPass.hash, adminPass.salt]);

      if (devId) {
        await this.pool.query(`
          UPDATE meetings SET owner_id = $1
          WHERE owner_id NOT IN (
            SELECT id FROM users WHERE LOWER(COALESCE(username, '')) IN ('azeemniazi', 'muhammadali')
          )
        `, [devId]);
      }

      await this.pool.query(`
        DELETE FROM users
        WHERE LOWER(COALESCE(username, '')) NOT IN ('azeemniazi', 'muhammadali')
      `);
    } catch (err) {
      console.error('Error seeding default users:', err);
    }
  }

  async findUserByUsername(username: string): Promise<UserWithSecret | undefined> {
    const norm = username.trim().toLowerCase();
    if (!this.pool) {
      return [...this.users.values()].find(u => u.username?.toLowerCase() === norm || u.objectId?.toLowerCase() === norm);
    }
    const q = await this.pool.query(
      'SELECT * FROM users WHERE LOWER(username) = $1 OR LOWER(object_id) = $1 LIMIT 1',
      [norm]
    );
    return q.rows[0] ? userSecretRow(q.rows[0]) : undefined;
  }

  async findUserById(id: string): Promise<UserWithSecret | undefined> {
    if (!this.pool) return this.users.get(id);
    const q = await this.pool.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [id]);
    return q.rows[0] ? userSecretRow(q.rows[0]) : undefined;
  }

  async listUsers(): Promise<User[]> {
    if (!this.pool) {
      return [...this.users.values()]
        .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''))
        .map(u => ({ ...u, passwordHash: undefined as any, salt: undefined as any }));
    }
    const q = await this.pool.query('SELECT id, username, display_name, email, role, must_change_password, created_at, updated_at FROM users ORDER BY created_at ASC');
    return q.rows.map(userRow);
  }

  async createUser(input: {
    username: string;
    passwordHash: string;
    salt: string;
    displayName: string;
    role: Role;
    mustChangePassword?: boolean;
  }): Promise<User> {
    const id = randomUUID();
    const mustChange = Boolean(input.mustChangePassword);
    if (!this.pool) {
      const user: UserWithSecret = {
        id,
        username: input.username,
        passwordHash: input.passwordHash,
        salt: input.salt,
        displayName: input.displayName,
        role: input.role,
        mustChangePassword: mustChange,
        tenantId: 'local',
        objectId: input.username,
        email: `${input.username}@cloudcore.local`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.users.set(id, user);
      return userRow(user);
    }
    const q = await this.pool.query(`
      INSERT INTO users(id, username, password_hash, salt, display_name, role, must_change_password, tenant_id, object_id, email)
      VALUES($1, $2, $3, $4, $5, $6, $7, 'local', $2, $8)
      RETURNING *
    `, [
      id,
      input.username,
      input.passwordHash,
      input.salt,
      input.displayName,
      input.role,
      mustChange,
      `${input.username}@cloudcore.local`
    ]);
    return userRow(q.rows[0]);
  }

  async updateUserPassword(id: string, passwordHash: string, salt: string, mustChangePassword = false): Promise<void> {
    if (!this.pool) {
      const u = this.users.get(id);
      if (u) {
        u.passwordHash = passwordHash;
        u.salt = salt;
        u.mustChangePassword = mustChangePassword;
        u.updatedAt = new Date().toISOString();
      }
      return;
    }
    await this.pool.query(
      'UPDATE users SET password_hash = $2, salt = $3, must_change_password = $4, updated_at = now() WHERE id = $1',
      [id, passwordHash, salt, mustChangePassword]
    );
  }

  async deleteUser(id: string): Promise<void> {
    if (!this.pool) {
      this.users.delete(id);
      return;
    }
    const dev = await this.findUserByUsername('azeemniazi');
    if (dev && dev.id !== id) {
      await this.pool.query('UPDATE meetings SET owner_id = $1 WHERE owner_id = $2', [dev.id, id]);
    }
    await this.pool.query('DELETE FROM users WHERE id = $1', [id]);
  }

  async upsertUser(input: Omit<User, 'id'>): Promise<User> {
    const username = input.username || input.objectId || 'user';
    if (!this.pool) {
      const key = `${input.tenantId}:${input.objectId}`;
      const found = [...this.users.values()].find(u => `${u.tenantId}:${u.objectId}` === key);
      const value: UserWithSecret = {
        id: found?.id ?? randomUUID(),
        passwordHash: found?.passwordHash ?? '',
        salt: found?.salt ?? '',
        mustChangePassword: found?.mustChangePassword ?? false,
        ...input,
        username,
      };
      this.users.set(value.id, value);
      return userRow(value);
    }
    const q = await this.pool.query(`
      INSERT INTO users(id, tenant_id, object_id, email, display_name, role, username)
      VALUES($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT(tenant_id, object_id) DO UPDATE SET
        email = EXCLUDED.email,
        display_name = EXCLUDED.display_name,
        role = EXCLUDED.role,
        updated_at = now()
      RETURNING *
    `, [randomUUID(), input.tenantId ?? 'local', input.objectId, input.email ?? '', input.displayName, input.role, username]);
    return userRow(q.rows[0]);
  }

  async activeCount() {
    if (!this.pool) return [...this.meetings.values()].filter(m => activeStatuses.includes(m.status)).length;
    const q = await this.pool.query('SELECT count(*)::int count FROM meetings WHERE status=ANY($1)', [activeStatuses]);
    return q.rows[0].count as number;
  }

  async listActiveMeetings() {
    if (!this.pool) return [...this.meetings.values()].filter(m => activeStatuses.includes(m.status));
    const q = await this.pool.query('SELECT * FROM meetings WHERE status=ANY($1)', [activeStatuses]);
    return q.rows.map(meetingRow);
  }

  async findMeetingByEngineId(engineId: string) {
    if (!this.pool) return [...this.meetings.values()].find(m => m.engineId === engineId);
    const q = await this.pool.query('SELECT * FROM meetings WHERE engine_id=$1 ORDER BY created_at DESC LIMIT 1', [engineId]);
    return q.rows[0] ? meetingRow(q.rows[0]) : undefined;
  }

  async createMeeting(input: { ownerId: string; encryptedUrl: string; botName: string; consentedAt: string; expiresAt: string }) {
    const value: Meeting = {
      id: randomUUID(),
      ownerId: input.ownerId,
      encryptedUrl: input.encryptedUrl,
      title: 'Microsoft Teams meeting',
      botName: input.botName,
      status: 'launching',
      consentedAt: input.consentedAt,
      expiresAt: input.expiresAt,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (!this.pool) {
      this.meetings.set(value.id, value);
      return value;
    }
    const q = await this.pool.query(
      `INSERT INTO meetings(id,owner_id,encrypted_url,bot_name,status,consented_at,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [value.id, value.ownerId, value.encryptedUrl, value.botName, value.status, value.consentedAt, value.expiresAt]
    );
    return meetingRow(q.rows[0]);
  }

  async listMeetings(user: User) {
    const isPrivileged = user.role === 'admin' || user.role === 'dev';
    if (!this.pool) {
      return [...this.meetings.values()]
        .filter(m => isPrivileged || m.ownerId === user.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(m => ({ ...m, encryptedUrl: undefined }));
    }
    const q = await this.pool.query(
      `SELECT * FROM meetings ${isPrivileged ? '' : 'WHERE owner_id=$1'} ORDER BY created_at DESC LIMIT 100`,
      isPrivileged ? [] : [user.id]
    );
    return q.rows.map(meetingRow).map(m => ({ ...m, encryptedUrl: undefined }));
  }

  async getMeeting(id: string, user?: User) {
    let value: Meeting | undefined;
    if (!this.pool) value = this.meetings.get(id);
    else {
      const q = await this.pool.query('SELECT * FROM meetings WHERE id=$1', [id]);
      value = q.rows[0] ? meetingRow(q.rows[0]) : undefined;
    }
    const isPrivileged = user?.role === 'admin' || user?.role === 'dev';
    if (!value || (user && !isPrivileged && value.ownerId !== user.id)) return undefined;
    return value;
  }

  async updateMeeting(id: string, patch: Partial<Pick<Meeting, 'engineId' | 'encryptedUrl' | 'status' | 'failureCode' | 'failureMessage' | 'recordingObjectKey' | 'startedAt' | 'endedAt' | 'title'>>) {
    if (!this.pool) {
      const current = this.meetings.get(id);
      if (!current) return;
      this.meetings.set(id, { ...current, ...patch, updatedAt: new Date().toISOString() });
      return;
    }
    const columns: Record<string, string> = {
      engineId: 'engine_id',
      encryptedUrl: 'encrypted_url',
      status: 'status',
      failureCode: 'failure_code',
      failureMessage: 'failure_message',
      recordingObjectKey: 'recording_object_key',
      startedAt: 'started_at',
      endedAt: 'ended_at',
      title: 'title'
    };
    const entries = Object.entries(patch).filter(([k]) => columns[k]);
    if (!entries.length) return;
    const values = entries.map(([, v]) => v ?? null);
    const set = entries.map(([k], i) => `${columns[k]}=$${i + 2}`).join(',');
    await this.pool.query(`UPDATE meetings SET ${set},updated_at=now() WHERE id=$1`, [id, ...values]);
  }

  async addParticipant(input: Omit<Participant, 'id'>) {
    const p = { id: randomUUID(), ...input };
    if (!this.pool) {
      const existing = this.participants.find(x => x.meetingId === p.meetingId && ((p.externalId && x.externalId === p.externalId) || x.displayName === p.displayName));
      if (existing) return existing;
      this.participants.push(p);
      return p;
    }
    const q = await this.pool.query('SELECT * FROM participants WHERE meeting_id=$1 AND (($2::text IS NOT NULL AND external_id=$2) OR display_name=$3) LIMIT 1', [p.meetingId, p.externalId ?? null, p.displayName]);
    if (q.rows[0]) return q.rows[0];
    await this.pool.query('INSERT INTO participants(id,meeting_id,external_id,display_name,joined_at,left_at) VALUES($1,$2,$3,$4,$5,$6)', [p.id, p.meetingId, p.externalId ?? null, p.displayName, p.joinedAt, p.leftAt ?? null]);
    return p;
  }

  async endParticipant(meetingId: string, externalId: string, leftAt: string) {
    if (!this.pool) {
      const p = this.participants.find(x => x.meetingId === meetingId && x.externalId === externalId && !x.leftAt);
      if (p) p.leftAt = leftAt;
      return;
    }
    await this.pool.query('UPDATE participants SET left_at=$3 WHERE meeting_id=$1 AND external_id=$2 AND left_at IS NULL', [meetingId, externalId, leftAt]);
  }

  async addTranscript(input: Omit<TranscriptSegment, 'id'>): Promise<TranscriptSegment | undefined> {
    const text = input.text?.trim() ?? '';
    if (!text || isHallucination(text)) return undefined;
    const s = { id: randomUUID(), ...input, text };
    if (!this.pool) {
      const windowIdx = this.transcript.findIndex(x => x.meetingId === s.meetingId && Math.abs(x.startMs - s.startMs) <= 1500);
      if (windowIdx !== -1 && this.transcript[windowIdx]) {
        const existing = this.transcript[windowIdx]!;
        if (s.text.toLowerCase().includes(existing.text.toLowerCase()) || s.text.length >= existing.text.length) {
          const updated: TranscriptSegment = { ...existing, text: s.text, endMs: Math.max(existing.endMs, s.endMs), confidence: s.confidence ?? existing.confidence };
          this.transcript[windowIdx] = updated;
          return updated;
        } else {
          const updated: TranscriptSegment = { ...existing, endMs: Math.max(existing.endMs, s.endMs) };
          this.transcript[windowIdx] = updated;
          return updated;
        }
      }
      const recent = this.transcript.filter(x => x.meetingId === s.meetingId && x.startMs <= s.startMs).slice(-3);
      if (recent.some(x => x.text.toLowerCase() === s.text.toLowerCase())) return undefined;
      if (recent.some(x => (x.text.toLowerCase().includes(s.text.toLowerCase()) || s.text.toLowerCase().includes(x.text.toLowerCase())) && Math.abs(s.startMs - x.endMs) <= 5000)) return undefined;
      this.transcript.push(s);
      return s;
    }
    const windowRow = await this.pool.query(
      'SELECT id, start_ms, end_ms, text FROM transcript_segments WHERE meeting_id=$1 AND abs(start_ms - $2) <= 1500 LIMIT 1',
      [s.meetingId, s.startMs]
    );
    if (windowRow.rows[0]) {
      const existing = windowRow.rows[0];
      const exText = String(existing.text);
      if (s.text.toLowerCase().includes(exText.toLowerCase()) || s.text.length >= exText.length) {
        await this.pool.query(
          'UPDATE transcript_segments SET text=$1, end_ms=GREATEST(end_ms, $2), confidence=COALESCE($3, confidence) WHERE id=$4',
          [s.text, s.endMs, s.confidence ?? null, existing.id]
        );
      } else {
        await this.pool.query('UPDATE transcript_segments SET end_ms=GREATEST(end_ms, $1) WHERE id=$2', [s.endMs, existing.id]);
      }
      return { ...s, id: existing.id };
    }
    const recentRows = await this.pool.query(
      'SELECT id, text, start_ms, end_ms FROM transcript_segments WHERE meeting_id=$1 AND start_ms <= $2 ORDER BY start_ms DESC LIMIT 3',
      [s.meetingId, s.startMs]
    );
    for (const r of recentRows.rows) {
      const rText = String(r.text).trim().toLowerCase();
      if (rText === s.text.toLowerCase()) return undefined;
      if ((rText.includes(s.text.toLowerCase()) || s.text.toLowerCase().includes(rText)) && Math.abs(s.startMs - Number(r.end_ms)) <= 5000) return undefined;
    }
    await this.pool.query(
      'INSERT INTO transcript_segments(id,meeting_id,speaker_name,start_ms,end_ms,text,confidence) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(meeting_id,start_ms,end_ms,text) DO NOTHING',
      [s.id, s.meetingId, s.speakerName ?? null, s.startMs, s.endMs, s.text, s.confidence ?? null]
    );
    return s;
  }

  async addSnapshot(input: Omit<Snapshot, 'id'>) {
    const s = { id: randomUUID(), ...input };
    if (!this.pool) {
      this.snapshots.push(s);
      return s;
    }
    await this.pool.query('INSERT INTO snapshots(id,meeting_id,object_key,captured_at_ms,perceptual_hash) VALUES($1,$2,$3,$4,$5)', [s.id, s.meetingId, s.objectKey, s.capturedAtMs, s.perceptualHash ?? null]);
    return s;
  }

  async getMeetingDetail(id: string, user?: User) {
    const m = await this.getMeeting(id, user);
    if (!m) return undefined;
    if (!this.pool) {
      return {
        ...m,
        encryptedUrl: undefined,
        participants: this.participants.filter(x => x.meetingId === id),
        transcript: this.transcript.filter(x => x.meetingId === id).sort((a, b) => a.startMs - b.startMs),
        snapshots: this.snapshots.filter(x => x.meetingId === id).sort((a, b) => a.capturedAtMs - b.capturedAtMs),
        mom: this.moms.get(id)?.at(-1)
      };
    }
    const [p, t, s, mom] = await Promise.all([
      this.pool.query('SELECT * FROM participants WHERE meeting_id=$1 ORDER BY joined_at', [id]),
      this.pool.query('SELECT * FROM transcript_segments WHERE meeting_id=$1 ORDER BY start_ms', [id]),
      this.pool.query('SELECT * FROM snapshots WHERE meeting_id=$1 ORDER BY captured_at_ms', [id]),
      this.pool.query('SELECT content FROM meeting_summaries WHERE meeting_id=$1 ORDER BY version DESC LIMIT 1', [id])
    ]);
    return {
      ...m,
      encryptedUrl: undefined,
      participants: p.rows.map((r: any) => ({
        id: r.id,
        meetingId: r.meeting_id,
        externalId: r.external_id ?? undefined,
        displayName: r.display_name,
        joinedAt: iso(r.joined_at)!,
        leftAt: iso(r.left_at)
      })),
      transcript: t.rows.map((r: any) => ({
        id: r.id,
        meetingId: r.meeting_id,
        speakerName: r.speaker_name ?? undefined,
        startMs: r.start_ms,
        endMs: r.end_ms,
        text: r.text,
        confidence: r.confidence ?? undefined
      })),
      snapshots: s.rows.map((r: any) => ({
        id: r.id,
        meetingId: r.meeting_id,
        objectKey: r.object_key,
        capturedAtMs: r.captured_at_ms,
        perceptualHash: r.perceptual_hash ?? undefined
      })),
      mom: mom.rows[0]?.content
    };
  }

  async saveMom(meetingId: string, content: Mom) {
    if (!this.pool) {
      const versions = this.moms.get(meetingId) ?? [];
      versions.push(content);
      this.moms.set(meetingId, versions);
      return;
    }
    await this.pool.query(
      `INSERT INTO meeting_summaries(id,meeting_id,version,content) SELECT $1,$2,COALESCE(max(version),0)+1,$3 FROM meeting_summaries WHERE meeting_id=$2`,
      [randomUUID(), meetingId, JSON.stringify(content)]
    );
  }

  async audit(actorId: string | undefined, meetingId: string | undefined, eventType: string, details: Record<string, unknown> = {}) {
    if (!this.pool) return;
    await this.pool.query('INSERT INTO audit_events(id,actor_id,meeting_id,event_type,details) VALUES($1,$2,$3,$4,$5)', [randomUUID(), actorId ?? null, meetingId ?? null, eventType, JSON.stringify(details)]);
  }

  async expiredMeetings() {
    if (!this.pool) return [...this.meetings.values()].filter(m => new Date(m.expiresAt) < new Date());
    const q = await this.pool.query('SELECT * FROM meetings WHERE expires_at<now()');
    return q.rows.map(meetingRow);
  }

  async purgeMeeting(id: string) {
    if (!this.pool) {
      this.meetings.delete(id);
      this.participants = this.participants.filter(x => x.meetingId !== id);
      this.transcript = this.transcript.filter(x => x.meetingId !== id);
      this.snapshots = this.snapshots.filter(x => x.meetingId !== id);
      this.moms.delete(id);
      return;
    }
    await this.pool.query('DELETE FROM meetings WHERE id=$1', [id]);
  }

  async purgeOldUrls() {
    if (!this.pool) {
      for (const m of this.meetings.values()) if (m.endedAt && Date.now() - Date.parse(m.endedAt) > 86400000) m.encryptedUrl = undefined;
      return;
    }
    await this.pool.query(`UPDATE meetings SET encrypted_url=NULL WHERE ended_at<now()-interval '24 hours'`);
  }
}

export const repository = new Repository();
