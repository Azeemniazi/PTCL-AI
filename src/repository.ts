import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { config } from './config.js';
import { hashPassword } from './crypto.js';
import { activeStatuses, type Meeting, type MeetingStatus, type Mom, type Participant, type Snapshot, type TranscriptSegment, type User, type UserWithSecret, type Role, type KnowledgeFolder, type KnowledgeDocument, type GeneratedAsset, type ImageJob } from './models.js';
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

function folderRow(r: any): KnowledgeFolder {
  return {
    id: r.id,
    userId: r.user_id ?? r.userId,
    parentId: r.parent_id ?? r.parentId ?? null,
    name: r.name,
    isShared: Boolean(r.is_shared ?? r.isShared ?? true),
    color: r.color ?? '#005437',
    createdAt: iso(r.created_at ?? r.createdAt)!,
    updatedAt: iso(r.updated_at ?? r.updatedAt)!,
    creatorName: r.creator_name ?? r.creatorName,
    fileCount: typeof r.file_count === 'number' ? Number(r.file_count) : (typeof r.fileCount === 'number' ? r.fileCount : undefined),
    totalSizeBytes: typeof r.total_size_bytes === 'number' ? Number(r.total_size_bytes) : (typeof r.totalSizeBytes === 'number' ? r.totalSizeBytes : undefined),
  };
}

function documentRow(r: any): KnowledgeDocument {
  return {
    id: r.id,
    userId: r.user_id ?? r.userId,
    folderId: r.folder_id ?? r.folderId ?? null,
    filename: r.filename,
    mimeType: r.mime_type ?? r.mimeType ?? 'application/octet-stream',
    sizeBytes: Number(r.size_bytes ?? r.sizeBytes ?? 0),
    storagePath: r.storage_path ?? r.storagePath ?? '',
    isShared: Boolean(r.is_shared ?? r.isShared ?? true),
    status: r.status ?? 'ready',
    extractedText: r.extracted_text ?? r.extractedText,
    tokenCount: Number(r.token_count ?? r.tokenCount ?? 0),
    createdAt: iso(r.created_at ?? r.createdAt)!,
    updatedAt: iso(r.updated_at ?? r.updatedAt)!,
    creatorName: r.creator_name ?? r.creatorName,
    folderName: r.folder_name ?? r.folderName,
  };
}

function generatedAssetRow(r: any): GeneratedAsset {
  return {
    id: r.id,
    userId: r.user_id ?? r.userId,
    url: r.url,
    filename: r.filename,
    prompt: r.prompt,
    negativePrompt: r.negative_prompt ?? r.negativePrompt ?? undefined,
    style: r.style,
    aspectRatio: r.aspect_ratio ?? r.aspectRatio,
    seed: Number(r.seed),
    steps: Number(r.steps ?? 4),
    cfgScale: Number(r.cfg_scale ?? r.cfgScale ?? 1.0),
    width: Number(r.width),
    height: Number(r.height),
    durationMs: Number(r.duration_ms ?? r.durationMs ?? 0),
    operation: r.operation ?? 'generate',
    sourceAssetId: r.source_asset_id ?? r.sourceAssetId ?? undefined,
    sourceName: r.source_name ?? r.sourceName ?? undefined,
    strength: r.strength !== null && r.strength !== undefined ? Number(r.strength) : undefined,
    renderKind: r.render_kind ?? r.renderKind ?? 'generated',
    createdAt: iso(r.created_at ?? r.createdAt)!,
  };
}

function imageJobRow(r: any): ImageJob {
  const asset = r.asset ? (typeof r.asset === 'string' ? JSON.parse(r.asset) : r.asset) : undefined;
  return {
    id: r.id,
    userId: r.user_id ?? r.userId,
    prompt: r.prompt,
    negativePrompt: r.negative_prompt ?? r.negativePrompt ?? undefined,
    style: r.style,
    aspectRatio: r.aspect_ratio ?? r.aspectRatio,
    seed: Number(r.seed),
    steps: Number(r.steps ?? 4),
    cfgScale: Number(r.cfg_scale ?? r.cfgScale ?? 1.0),
    width: Number(r.width),
    height: Number(r.height),
    status: r.status,
    operation: r.operation ?? 'generate',
    sourceAssetId: r.source_asset_id ?? r.sourceAssetId ?? undefined,
    sourceName: r.source_name ?? r.sourceName ?? undefined,
    referenceFilename: r.reference_filename ?? r.referenceFilename ?? undefined,
    strength: r.strength !== null && r.strength !== undefined ? Number(r.strength) : undefined,
    progress: Number(r.progress ?? 0),
    stageText: r.stage_text ?? r.stageText ?? '',
    error: r.error ?? undefined,
    asset: asset ? generatedAssetRow(asset) : undefined,
    startedAt: iso(r.started_at ?? r.startedAt)!,
    completedAt: iso(r.completed_at ?? r.completedAt),
    estimatedDurationMs: Number(r.estimated_duration_ms ?? r.estimatedDurationMs ?? 0),
    createdAt: iso(r.created_at ?? r.createdAt),
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
  private knowledgeFolders = new Map<string, KnowledgeFolder>();
  private knowledgeDocuments = new Map<string, KnowledgeDocument>();
  private generatedAssets = new Map<string, GeneratedAsset>();
  private imageJobs = new Map<string, ImageJob>();

  constructor() {
    this.pool?.on('error', (err) => {
      console.warn('PostgreSQL idle client disconnected:', err?.message || String(err));
    });
  }

  async init() {
    if (this.pool) {
      const dir = dirname(fileURLToPath(import.meta.url));
      for (const file of [
        '001_init.sql',
        '002_auth_users.sql',
        '003_scalability_and_indexes.sql',
        '004_knowledge_hub.sql',
        '005_trigram_knowledge_search.sql',
        '006_image_studio.sql'
      ]) {
        await this.pool.query(await readFile(resolve(dir, '../migrations', file), 'utf8'));
      }
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
    const devPass = await hashPassword(config.initialDevPassword);
    const adminPass = await hashPassword(config.initialAdminPassword);

    if (!this.pool) {
      for (const [id, u] of this.users.entries()) {
        if (!u.passwordHash) this.users.delete(id);
      }
      if (![...this.users.values()].some(u => u.username?.toLowerCase() === 'azeemniazi')) {
        const devId = randomUUID();
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
      }
      if (![...this.users.values()].some(u => u.username?.toLowerCase() === 'muhammadali')) {
        const adminId = randomUUID();
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
      }
      return;
    }

    try {
      let devId: string;
      const existingDev = await this.pool.query(`SELECT id, password_hash FROM users WHERE LOWER(username) = 'azeemniazi' OR object_id = 'azeemniazi' LIMIT 1`);
      if (existingDev.rows.length > 0) {
        devId = existingDev.rows[0].id;
        await this.pool.query(`
          UPDATE users SET
            username = 'azeemniazi',
            password_hash = COALESCE(NULLIF(password_hash, ''), $1),
            salt = COALESCE(NULLIF(salt, ''), $2),
            role = 'dev',
            display_name = 'Azeem Niazi',
            must_change_password = false,
            updated_at = now()
          WHERE id = $3
        `, [devPass.hash, devPass.salt, devId]);
      } else {
        devId = randomUUID();
        await this.pool.query(`
          INSERT INTO users(id, username, password_hash, salt, display_name, role, must_change_password, tenant_id, object_id, email)
          VALUES($1, 'azeemniazi', $2, $3, 'Azeem Niazi', 'dev', false, 'local', 'azeemniazi', 'azeemniazi@cloudcore.local')
        `, [devId, devPass.hash, devPass.salt]);
      }

      const existingAdmin = await this.pool.query(`SELECT id, password_hash FROM users WHERE LOWER(username) = 'muhammadali' OR object_id = 'muhammadali' LIMIT 1`);
      if (existingAdmin.rows.length > 0) {
        await this.pool.query(`
          UPDATE users SET
            username = 'muhammadali',
            password_hash = COALESCE(NULLIF(password_hash, ''), $1),
            salt = COALESCE(NULLIF(salt, ''), $2),
            role = 'admin',
            display_name = 'Muhammad Ali',
            must_change_password = false,
            updated_at = now()
          WHERE id = $3
        `, [adminPass.hash, adminPass.salt, existingAdmin.rows[0].id]);
      } else {
        await this.pool.query(`
          INSERT INTO users(id, username, password_hash, salt, display_name, role, must_change_password, tenant_id, object_id, email)
          VALUES($1, 'muhammadali', $2, $3, 'Muhammad Ali', 'admin', false, 'local', 'muhammadali', 'muhammadali@cloudcore.local')
        `, [randomUUID(), adminPass.hash, adminPass.salt]);
      }

      if (devId) {
        await this.pool.query(`
          UPDATE meetings SET owner_id = $1
          WHERE owner_id IN (
            SELECT id FROM users
            WHERE (password_hash IS NULL OR password_hash = '')
              AND LOWER(COALESCE(username, '')) NOT IN ('azeemniazi', 'muhammadali')
          )
        `, [devId]);
      }

      await this.pool.query(`
        DELETE FROM users
        WHERE (password_hash IS NULL OR password_hash = '')
          AND LOWER(COALESCE(username, '')) NOT IN ('azeemniazi', 'muhammadali')
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

  async updateUserProfile(id: string, input: { displayName: string; email: string }): Promise<User | undefined> {
    if (!this.pool) {
      const u = this.users.get(id);
      if (!u) return undefined;
      u.displayName = input.displayName;
      u.email = input.email;
      u.updatedAt = new Date().toISOString();
      return userRow(u);
    }
    const q = await this.pool.query(
      'UPDATE users SET display_name = $2, email = $3, updated_at = now() WHERE id = $1 RETURNING *',
      [id, input.displayName, input.email]
    );
    return q.rows[0] ? userRow(q.rows[0]) : undefined;
  }

  async deleteUser(id: string): Promise<void> {
    const dev = await this.findUserByUsername('azeemniazi');
    if (!this.pool) {
      if (dev && dev.id !== id) {
        for (const meeting of this.meetings.values()) {
          if (meeting.ownerId === id) meeting.ownerId = dev.id;
        }
      }
      for (const [docId, doc] of this.knowledgeDocuments.entries()) {
        if (doc.userId === id) this.knowledgeDocuments.delete(docId);
      }
      for (const [folderId, folder] of this.knowledgeFolders.entries()) {
        if (folder.userId === id) this.knowledgeFolders.delete(folderId);
      }
      for (const [assetId, asset] of this.generatedAssets.entries()) {
        if (asset.userId === id) this.generatedAssets.delete(assetId);
      }
      for (const [jobId, job] of this.imageJobs.entries()) {
        if (job.userId === id) this.imageJobs.delete(jobId);
      }
      this.users.delete(id);
      return;
    }
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
    const normNew = s.text.toLowerCase();
    const shouldReplaceText = (exText: string) => normNew.includes(exText.toLowerCase()) || s.text.length >= exText.length;
    const isDuplicateRecent = (exText: string, exEndMs: number) => {
      const normEx = exText.trim().toLowerCase();
      return normEx === normNew || ((normEx.includes(normNew) || normNew.includes(normEx)) && Math.abs(s.startMs - exEndMs) <= 5000);
    };

    if (!this.pool) {
      const windowIdx = this.transcript.findIndex(x => x.meetingId === s.meetingId && Math.abs(x.startMs - s.startMs) <= 1500);
      if (windowIdx !== -1 && this.transcript[windowIdx]) {
        const existing = this.transcript[windowIdx]!;
        const updated: TranscriptSegment = shouldReplaceText(existing.text)
          ? { ...existing, text: s.text, endMs: Math.max(existing.endMs, s.endMs), confidence: s.confidence ?? existing.confidence }
          : { ...existing, endMs: Math.max(existing.endMs, s.endMs) };
        this.transcript[windowIdx] = updated;
        return updated;
      }
      const recent = this.transcript.filter(x => x.meetingId === s.meetingId && x.startMs <= s.startMs).slice(-3);
      if (recent.some(x => isDuplicateRecent(x.text, x.endMs))) return undefined;
      this.transcript.push(s);
      return s;
    }
    const windowRow = await this.pool.query(
      'SELECT id, start_ms, end_ms, text FROM transcript_segments WHERE meeting_id=$1 AND abs(start_ms - $2) <= 1500 LIMIT 1',
      [s.meetingId, s.startMs]
    );
    if (windowRow.rows[0]) {
      const existing = windowRow.rows[0];
      if (shouldReplaceText(String(existing.text))) {
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
    if (recentRows.rows.some((r: any) => isDuplicateRecent(String(r.text), Number(r.end_ms)))) return undefined;
    await this.pool.query(
      'INSERT INTO transcript_segments(id,meeting_id,speaker_name,start_ms,end_ms,text,confidence) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(meeting_id,start_ms,end_ms,text) DO NOTHING',
      [s.id, s.meetingId, s.speakerName ?? null, s.startMs, s.endMs, s.text, s.confidence ?? null]
    );
    return s;
  }

  async addTranscriptBatch(meetingId: string, segments: Omit<TranscriptSegment, 'id' | 'meetingId'>[]): Promise<number> {
    if (!segments.length) return 0;
    if (!this.pool) {
      let count = 0;
      for (const seg of segments) {
        if (await this.addTranscript({ meetingId, ...seg })) count++;
      }
      return count;
    }
    const minStart = Math.max(0, Math.min(...segments.map(s => s.startMs)) - 15_000);
    const existingRows = await this.pool.query(
      'SELECT id, speaker_name, start_ms, end_ms, text, confidence FROM transcript_segments WHERE meeting_id=$1 AND start_ms >= $2 ORDER BY start_ms ASC',
      [meetingId, minStart]
    );
    const working: TranscriptSegment[] = existingRows.rows.map((r: any) => ({
      id: String(r.id),
      meetingId,
      speakerName: r.speaker_name ?? undefined,
      startMs: Number(r.start_ms),
      endMs: Number(r.end_ms),
      text: String(r.text),
      confidence: r.confidence != null ? Number(r.confidence) : undefined
    }));
    const toInsert: TranscriptSegment[] = [];
    const toUpdate = new Map<string, TranscriptSegment>();

    for (const raw of segments) {
      const text = raw.text?.trim() ?? '';
      if (!text || isHallucination(text)) continue;
      const s: TranscriptSegment = { id: randomUUID(), meetingId, ...raw, text };
      const normNew = s.text.toLowerCase();
      const shouldReplaceText = (exText: string) => normNew.includes(exText.toLowerCase()) || s.text.length >= exText.length;
      const isDuplicateRecent = (exText: string, exEndMs: number) => {
        const normEx = exText.trim().toLowerCase();
        return normEx === normNew || ((normEx.includes(normNew) || normNew.includes(normEx)) && Math.abs(s.startMs - exEndMs) <= 5000);
      };

      const windowIdx = working.findIndex(x => Math.abs(x.startMs - s.startMs) <= 1500);
      if (windowIdx !== -1 && working[windowIdx]) {
        const ex = working[windowIdx]!;
        const updated: TranscriptSegment = shouldReplaceText(ex.text)
          ? { ...ex, text: s.text, endMs: Math.max(ex.endMs, s.endMs), confidence: s.confidence ?? ex.confidence }
          : { ...ex, endMs: Math.max(ex.endMs, s.endMs) };
        working[windowIdx] = updated;
        if (!toInsert.some(ins => ins.id === updated.id)) {
          toUpdate.set(updated.id, updated);
        }
        continue;
      }
      const recent = working.filter(x => x.startMs <= s.startMs).slice(-3);
      if (recent.some(x => isDuplicateRecent(x.text, x.endMs))) continue;
      working.push(s);
      toInsert.push(s);
    }

    for (const u of toUpdate.values()) {
      await this.pool.query(
        'UPDATE transcript_segments SET text=$1, end_ms=$2, confidence=$3 WHERE id=$4',
        [u.text, u.endMs, u.confidence ?? null, u.id]
      );
    }
    if (toInsert.length > 0) {
      await this.pool.query(
        `INSERT INTO transcript_segments(id, meeting_id, speaker_name, start_ms, end_ms, text, confidence)
         SELECT * FROM UNNEST($1::uuid[], $2::uuid[], $3::text[], $4::int[], $5::int[], $6::text[], $7::real[])
         ON CONFLICT(meeting_id, start_ms, end_ms, text) DO NOTHING`,
        [
          toInsert.map(x => x.id),
          toInsert.map(x => x.meetingId),
          toInsert.map(x => x.speakerName ?? null),
          toInsert.map(x => x.startMs),
          toInsert.map(x => x.endMs),
          toInsert.map(x => x.text),
          toInsert.map(x => x.confidence ?? null)
        ]
      );
    }
    return toInsert.length + toUpdate.size;
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
      `INSERT INTO meeting_summaries(id,meeting_id,version,content)
       SELECT $1,$2,COALESCE(max(version),0)+1,$3 FROM meeting_summaries WHERE meeting_id=$2
       ON CONFLICT (meeting_id, version) DO UPDATE SET content = EXCLUDED.content, created_at = now()`,
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

  // --- KNOWLEDGE HUB ---

  async createFolder(input: { userId: string; name: string; isShared?: boolean; parentId?: string | null; color?: string }): Promise<KnowledgeFolder> {
    const id = randomUUID();
    const isShared = input.isShared ?? true;
    const parentId = input.parentId ?? null;
    const color = input.color ?? '#005437';
    const now = new Date().toISOString();
    const user = await this.findUserById(input.userId);
    const creatorName = user?.displayName || 'User';

    if (!this.pool) {
      const folder: KnowledgeFolder = {
        id,
        userId: input.userId,
        name: input.name,
        isShared,
        parentId,
        color,
        createdAt: now,
        updatedAt: now,
        creatorName,
        fileCount: 0,
        totalSizeBytes: 0
      };
      this.knowledgeFolders.set(id, folder);
      return folder;
    }

    const q = await this.pool.query(
      `INSERT INTO knowledge_folders(id, user_id, parent_id, name, is_shared, color, created_at, updated_at)
       VALUES($1, $2, $3, $4, $5, $6, $7, $7)
       RETURNING *`,
      [id, input.userId, parentId, input.name, isShared, color, now]
    );
    const row = q.rows[0];
    row.creator_name = creatorName;
    row.file_count = 0;
    row.total_size_bytes = 0;
    return folderRow(row);
  }

  async findOrCreateFolderHierarchy(
    userId: string,
    folderSegments: string[],
    baseParentId?: string | null,
    isShared?: boolean
  ): Promise<string | null> {
    if (!folderSegments || !folderSegments.length) return baseParentId ?? null;
    let currentParentId: string | null = (baseParentId && baseParentId.trim() && baseParentId !== 'null') ? baseParentId.trim() : null;
    const shared = isShared ?? true;

    for (const rawSegment of folderSegments) {
      const cleanSegment = rawSegment.trim().slice(0, 100);
      if (!cleanSegment || cleanSegment === '.' || cleanSegment === '..') continue;

      if (!this.pool) {
        let existing = [...this.knowledgeFolders.values()].find(f => {
          const matchParent = currentParentId ? f.parentId === currentParentId : (f.parentId == null || f.parentId === '');
          const matchName = f.name.toLowerCase() === cleanSegment.toLowerCase();
          const matchAccess = f.isShared || f.userId === userId;
          return matchParent && matchName && matchAccess;
        });

        if (!existing) {
          existing = await this.createFolder({
            userId,
            name: cleanSegment,
            parentId: currentParentId,
            isShared: shared
          });
        }
        currentParentId = existing.id;
      } else {
        const lookup = await this.pool.query(
          `SELECT id FROM knowledge_folders
           WHERE (parent_id = $1 OR ($1 IS NULL AND parent_id IS NULL))
             AND LOWER(name) = LOWER($2)
             AND (is_shared = true OR user_id = $3)
           ORDER BY created_at ASC
           LIMIT 1`,
          [currentParentId, cleanSegment, userId]
        );

        if (lookup.rows.length > 0) {
          currentParentId = lookup.rows[0].id;
        } else {
          const created = await this.createFolder({
            userId,
            name: cleanSegment,
            parentId: currentParentId,
            isShared: shared
          });
          currentParentId = created.id;
        }
      }
    }
    return currentParentId;
  }

  async listFolders(userId: string, scope?: 'all' | 'shared' | 'personal'): Promise<KnowledgeFolder[]> {
    if (!this.pool) {
      const folders = [...this.knowledgeFolders.values()].filter(f => {
        if (scope === 'shared') return f.isShared;
        if (scope === 'personal') return !f.isShared && f.userId === userId;
        return f.isShared || f.userId === userId;
      });
      return folders.map(f => {
        const files = [...this.knowledgeDocuments.values()].filter(d => d.folderId === f.id);
        const user = this.users.get(f.userId);
        return {
          ...f,
          creatorName: user?.displayName || f.creatorName,
          fileCount: files.length,
          totalSizeBytes: files.reduce((acc, doc) => acc + doc.sizeBytes, 0)
        };
      });
    }

    let filterClause = '(f.is_shared = true OR f.user_id = $1)';
    const params: any[] = [userId];
    if (scope === 'shared') {
      filterClause = 'f.is_shared = true';
      params.length = 0;
    } else if (scope === 'personal') {
      filterClause = '(f.is_shared = false AND f.user_id = $1)';
    }

    const q = await this.pool.query(
      `SELECT f.*, u.display_name AS creator_name,
              COUNT(d.id)::int AS file_count,
              COALESCE(SUM(d.size_bytes), 0)::bigint AS total_size_bytes
       FROM knowledge_folders f
       LEFT JOIN users u ON f.user_id = u.id
       LEFT JOIN knowledge_documents d ON d.folder_id = f.id
       WHERE ${filterClause}
       GROUP BY f.id, u.display_name
       ORDER BY f.created_at ASC`,
      params
    );
    return q.rows.map(folderRow);
  }

  async getFolderById(id: string): Promise<KnowledgeFolder | undefined> {
    if (!this.pool) {
      const f = this.knowledgeFolders.get(id);
      if (!f) return undefined;
      const files = [...this.knowledgeDocuments.values()].filter(d => d.folderId === f.id);
      const user = this.users.get(f.userId);
      return {
        ...f,
        creatorName: user?.displayName || f.creatorName,
        fileCount: files.length,
        totalSizeBytes: files.reduce((acc, doc) => acc + doc.sizeBytes, 0)
      };
    }
    const q = await this.pool.query(
      `SELECT f.*, u.display_name AS creator_name,
              COUNT(d.id)::int AS file_count,
              COALESCE(SUM(d.size_bytes), 0)::bigint AS total_size_bytes
       FROM knowledge_folders f
       LEFT JOIN users u ON f.user_id = u.id
       LEFT JOIN knowledge_documents d ON d.folder_id = f.id
       WHERE f.id = $1
       GROUP BY f.id, u.display_name`,
      [id]
    );
    return q.rows[0] ? folderRow(q.rows[0]) : undefined;
  }

  async updateFolder(id: string, userId: string, input: { name?: string; isShared?: boolean }, isPrivileged = false): Promise<KnowledgeFolder | undefined> {
    const existing = await this.getFolderById(id);
    if (!existing) return undefined;
    if (existing.userId !== userId && !isPrivileged) throw new Error('Unauthorized to modify this folder.');

    const name = input.name?.trim() || existing.name;
    const isShared = typeof input.isShared === 'boolean' ? input.isShared : existing.isShared;
    const now = new Date().toISOString();

    if (!this.pool) {
      existing.name = name;
      existing.isShared = isShared;
      existing.updatedAt = now;
      this.knowledgeFolders.set(id, existing);
      return existing;
    }

    const q = await this.pool.query(
      `UPDATE knowledge_folders
       SET name = $2, is_shared = $3, updated_at = $4
       WHERE id = $1
       RETURNING *`,
      [id, name, isShared, now]
    );
    return q.rows[0] ? folderRow(q.rows[0]) : undefined;
  }

  async deleteFolder(id: string, userId: string, cascade = false, isPrivileged = false): Promise<boolean> {
    const existing = await this.getFolderById(id);
    if (!existing) return false;
    if (existing.userId !== userId && !isPrivileged) throw new Error('Unauthorized to delete this folder.');

    if (!this.pool) {
      const folderIdsToDelete = new Set<string>([id]);
      if (cascade) {
        let added = true;
        while (added) {
          added = false;
          for (const f of this.knowledgeFolders.values()) {
            if (f.parentId && folderIdsToDelete.has(f.parentId) && !folderIdsToDelete.has(f.id)) {
              folderIdsToDelete.add(f.id);
              added = true;
            }
          }
        }
        for (const [docId, doc] of this.knowledgeDocuments.entries()) {
          if (doc.folderId && folderIdsToDelete.has(doc.folderId)) this.knowledgeDocuments.delete(docId);
        }
        for (const fId of folderIdsToDelete) {
          this.knowledgeFolders.delete(fId);
        }
        return true;
      } else {
        for (const doc of this.knowledgeDocuments.values()) {
          if (doc.folderId === id) doc.folderId = null;
        }
        return this.knowledgeFolders.delete(id);
      }
    }

    if (cascade) {
      await this.pool.query('DELETE FROM knowledge_documents WHERE folder_id = $1', [id]);
    } else {
      await this.pool.query('UPDATE knowledge_documents SET folder_id = NULL WHERE folder_id = $1', [id]);
    }
    const q = await this.pool.query('DELETE FROM knowledge_folders WHERE id = $1', [id]);
    return (q.rowCount ?? 0) > 0;
  }

  async createDocument(input: {
    userId: string;
    folderId?: string | null;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    storagePath: string;
    isShared?: boolean;
    status?: 'ready' | 'indexing' | 'failed';
    extractedText?: string;
    tokenCount?: number;
  }): Promise<KnowledgeDocument> {
    const id = randomUUID();
    const folderId = input.folderId ?? null;
    const isShared = input.isShared ?? true;
    const status = input.status ?? 'ready';
    const now = new Date().toISOString();
    const user = await this.findUserById(input.userId);
    const creatorName = user?.displayName || 'User';

    let folderName: string | undefined;
    if (folderId) {
      const f = await this.getFolderById(folderId);
      folderName = f?.name;
    }

    if (!this.pool) {
      const doc: KnowledgeDocument = {
        id,
        userId: input.userId,
        folderId,
        filename: input.filename,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        storagePath: input.storagePath,
        isShared,
        status,
        extractedText: input.extractedText,
        tokenCount: input.tokenCount ?? 0,
        createdAt: now,
        updatedAt: now,
        creatorName,
        folderName
      };
      this.knowledgeDocuments.set(id, doc);
      return doc;
    }

    const q = await this.pool.query(
      `INSERT INTO knowledge_documents(id, user_id, folder_id, filename, mime_type, size_bytes, storage_path, is_shared, status, extracted_text, token_count, created_at, updated_at)
       VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)
       RETURNING *`,
      [id, input.userId, folderId, input.filename, input.mimeType, input.sizeBytes, input.storagePath, isShared, status, input.extractedText ?? null, input.tokenCount ?? 0, now]
    );
    const row = q.rows[0];
    row.creator_name = creatorName;
    row.folder_name = folderName;
    return documentRow(row);
  }

  async listDocuments(userId: string, filters?: {
    folderId?: string | null;
    scope?: 'all' | 'shared' | 'personal';
    search?: string;
    type?: string;
  }): Promise<KnowledgeDocument[]> {
    if (!this.pool) {
      const search = filters?.search?.toLowerCase().trim();
      const type = filters?.type?.toLowerCase().trim();
      const docs = [...this.knowledgeDocuments.values()].filter(d => {
        if (filters?.scope === 'shared' && !d.isShared) return false;
        if (filters?.scope === 'personal' && (d.isShared || d.userId !== userId)) return false;
        if (!filters?.scope || filters.scope === 'all') {
          if (!d.isShared && d.userId !== userId) return false;
        }
        if (filters?.folderId !== undefined) {
          if (filters.folderId === null && d.folderId !== null && d.folderId !== undefined) return false;
          if (filters.folderId && d.folderId !== filters.folderId) return false;
        }
        if (type && type !== 'all') {
          const ext = d.filename.split('.').pop()?.toLowerCase();
          if (type === 'pdf' && ext !== 'pdf') return false;
          if (type === 'word' && !['doc', 'docx'].includes(ext || '')) return false;
          if (type === 'excel' && !['xls', 'xlsx', 'csv'].includes(ext || '')) return false;
          if (type === 'text' && !['txt', 'md', 'json'].includes(ext || '')) return false;
        }
        if (search) {
          const inName = d.filename.toLowerCase().includes(search);
          const inText = (d.extractedText || '').toLowerCase().includes(search);
          if (!inName && !inText) return false;
        }
        return true;
      });
      return docs.map(d => {
        const u = this.users.get(d.userId);
        const f = d.folderId ? this.knowledgeFolders.get(d.folderId) : undefined;
        return {
          ...d,
          creatorName: u?.displayName || d.creatorName,
          folderName: f?.name || d.folderName
        };
      });
    }

    const conditions: string[] = [];
    const params: any[] = [];

    if (filters?.scope === 'shared') {
      conditions.push('d.is_shared = true');
    } else if (filters?.scope === 'personal') {
      params.push(userId);
      conditions.push(`d.is_shared = false AND d.user_id = $${params.length}`);
    } else {
      params.push(userId);
      conditions.push(`(d.is_shared = true OR d.user_id = $${params.length})`);
    }

    if (filters?.folderId !== undefined) {
      if (filters.folderId === null) {
        conditions.push('d.folder_id IS NULL');
      } else {
        params.push(filters.folderId);
        conditions.push(`d.folder_id = $${params.length}`);
      }
    }

    if (filters?.search) {
      params.push(`%${filters.search.trim()}%`);
      const pIdx = params.length;
      conditions.push(`(d.filename ILIKE $${pIdx} OR d.extracted_text ILIKE $${pIdx})`);
    }

    if (filters?.type && filters.type !== 'all') {
      const t = filters.type.toLowerCase();
      if (t === 'pdf') conditions.push("d.filename ILIKE '%.pdf'");
      else if (t === 'word') conditions.push("(d.filename ILIKE '%.doc' OR d.filename ILIKE '%.docx')");
      else if (t === 'excel') conditions.push("(d.filename ILIKE '%.xls' OR d.filename ILIKE '%.xlsx' OR d.filename ILIKE '%.csv')");
      else if (t === 'text') conditions.push("(d.filename ILIKE '%.txt' OR d.filename ILIKE '%.md' OR d.filename ILIKE '%.json')");
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const q = await this.pool.query(
      `SELECT d.*, u.display_name AS creator_name, f.name AS folder_name
       FROM knowledge_documents d
       LEFT JOIN users u ON d.user_id = u.id
       LEFT JOIN knowledge_folders f ON d.folder_id = f.id
       ${whereClause}
       ORDER BY d.created_at DESC`,
      params
    );
    return q.rows.map(documentRow);
  }

  async getDocumentById(id: string): Promise<KnowledgeDocument | undefined> {
    if (!this.pool) {
      const doc = this.knowledgeDocuments.get(id);
      if (!doc) return undefined;
      const u = this.users.get(doc.userId);
      const f = doc.folderId ? this.knowledgeFolders.get(doc.folderId) : undefined;
      return {
        ...doc,
        creatorName: u?.displayName || doc.creatorName,
        folderName: f?.name || doc.folderName
      };
    }
    const q = await this.pool.query(
      `SELECT d.*, u.display_name AS creator_name, f.name AS folder_name
       FROM knowledge_documents d
       LEFT JOIN users u ON d.user_id = u.id
       LEFT JOIN knowledge_folders f ON d.folder_id = f.id
       WHERE d.id = $1`,
      [id]
    );
    return q.rows[0] ? documentRow(q.rows[0]) : undefined;
  }

  async updateDocument(id: string, userId: string, input: { filename?: string; folderId?: string | null; isShared?: boolean }, isPrivileged = false): Promise<KnowledgeDocument | undefined> {
    const existing = await this.getDocumentById(id);
    if (!existing) return undefined;
    if (existing.userId !== userId && !isPrivileged) throw new Error('Unauthorized to modify this document.');

    const filename = input.filename?.trim() || existing.filename;
    const folderId = input.folderId !== undefined ? input.folderId : existing.folderId;
    const isShared = typeof input.isShared === 'boolean' ? input.isShared : existing.isShared;
    const now = new Date().toISOString();

    if (!this.pool) {
      existing.filename = filename;
      existing.folderId = folderId;
      existing.isShared = isShared;
      existing.updatedAt = now;
      this.knowledgeDocuments.set(id, existing);
      return existing;
    }

    const q = await this.pool.query(
      `UPDATE knowledge_documents
       SET filename = $2, folder_id = $3, is_shared = $4, updated_at = $5
       WHERE id = $1
       RETURNING *`,
      [id, filename, folderId, isShared, now]
    );
    return q.rows[0] ? documentRow(q.rows[0]) : undefined;
  }

  async deleteDocument(id: string, userId: string, isPrivileged = false): Promise<KnowledgeDocument | undefined> {
    const existing = await this.getDocumentById(id);
    if (!existing) return undefined;
    if (existing.userId !== userId && !isPrivileged) throw new Error('Unauthorized to delete this document.');

    if (!this.pool) {
      this.knowledgeDocuments.delete(id);
      return existing;
    }
    await this.pool.query('DELETE FROM knowledge_documents WHERE id = $1', [id]);
    return existing;
  }

  async batchDeleteDocuments(ids: string[], userId: string, isPrivileged = false): Promise<KnowledgeDocument[]> {
    const deleted: KnowledgeDocument[] = [];
    for (const id of ids) {
      const doc = await this.deleteDocument(id, userId, isPrivileged).catch(() => undefined);
      if (doc) deleted.push(doc);
    }
    return deleted;
  }

  async batchMoveDocuments(ids: string[], targetFolderId: string | null, userId: string, isPrivileged = false): Promise<string[]> {
    const moved: string[] = [];
    for (const id of ids) {
      const updated = await this.updateDocument(id, userId, { folderId: targetFolderId }, isPrivileged).catch(() => undefined);
      if (updated) moved.push(id);
    }
    return moved;
  }

  async saveGeneratedAsset(asset: GeneratedAsset): Promise<GeneratedAsset> {
    if (!this.pool) {
      this.generatedAssets.set(asset.id, { ...asset });
      return asset;
    }
    const q = await this.pool.query(
      `INSERT INTO generated_assets (
         id, user_id, url, filename, prompt, negative_prompt, style, aspect_ratio,
         seed, steps, cfg_scale, width, height, duration_ms, operation,
         source_asset_id, source_name, strength, render_kind, created_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
       ON CONFLICT (id) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         url = EXCLUDED.url,
         filename = EXCLUDED.filename,
         prompt = EXCLUDED.prompt,
         negative_prompt = EXCLUDED.negative_prompt,
         style = EXCLUDED.style,
         aspect_ratio = EXCLUDED.aspect_ratio,
         seed = EXCLUDED.seed,
         steps = EXCLUDED.steps,
         cfg_scale = EXCLUDED.cfg_scale,
         width = EXCLUDED.width,
         height = EXCLUDED.height,
         duration_ms = EXCLUDED.duration_ms,
         operation = EXCLUDED.operation,
         source_asset_id = EXCLUDED.source_asset_id,
         source_name = EXCLUDED.source_name,
         strength = EXCLUDED.strength,
         render_kind = EXCLUDED.render_kind,
         created_at = EXCLUDED.created_at
       RETURNING *`,
      [
        asset.id, asset.userId, asset.url, asset.filename, asset.prompt,
        asset.negativePrompt || null, asset.style, asset.aspectRatio,
        asset.seed, asset.steps, asset.cfgScale, asset.width, asset.height,
        asset.durationMs, asset.operation || 'generate',
        asset.sourceAssetId || null, asset.sourceName || null,
        asset.strength !== undefined ? asset.strength : null,
        asset.renderKind || 'generated', asset.createdAt
      ]
    );
    return generatedAssetRow(q.rows[0]);
  }

  async getGeneratedAsset(id: string): Promise<GeneratedAsset | undefined> {
    if (!this.pool) {
      return this.generatedAssets.get(id);
    }
    const q = await this.pool.query('SELECT * FROM generated_assets WHERE id = $1', [id]);
    return q.rows[0] ? generatedAssetRow(q.rows[0]) : undefined;
  }

  async getGeneratedAssetByFilename(filename: string): Promise<GeneratedAsset | undefined> {
    if (!this.pool) {
      return [...this.generatedAssets.values()].find(a => a.filename === filename);
    }
    const q = await this.pool.query('SELECT * FROM generated_assets WHERE filename = $1', [filename]);
    return q.rows[0] ? generatedAssetRow(q.rows[0]) : undefined;
  }

  async listGeneratedAssets(userId: string, isPrivileged = false, limit = 50): Promise<GeneratedAsset[]> {
    if (!this.pool) {
      return [...this.generatedAssets.values()]
        .filter(a => isPrivileged || a.userId === userId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, limit);
    }
    const q = isPrivileged
      ? await this.pool.query('SELECT * FROM generated_assets ORDER BY created_at DESC LIMIT $1', [limit])
      : await this.pool.query('SELECT * FROM generated_assets WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2', [userId, limit]);
    return q.rows.map(generatedAssetRow);
  }

  async deleteGeneratedAsset(id: string, userId: string, isPrivileged = false): Promise<GeneratedAsset | undefined> {
    const asset = await this.getGeneratedAsset(id);
    if (!asset) return undefined;
    if (asset.userId !== userId && !isPrivileged) throw new Error('Unauthorized to delete this asset.');
    if (!this.pool) {
      this.generatedAssets.delete(id);
      return asset;
    }
    await this.pool.query('DELETE FROM generated_assets WHERE id = $1', [id]);
    return asset;
  }

  async batchDeleteGeneratedAssets(ids: string[], userId: string, isPrivileged = false): Promise<GeneratedAsset[]> {
    const deleted: GeneratedAsset[] = [];
    for (const id of ids) {
      const asset = await this.deleteGeneratedAsset(id, userId, isPrivileged).catch(() => undefined);
      if (asset) deleted.push(asset);
    }
    return deleted;
  }

  async saveImageJob(job: ImageJob): Promise<ImageJob> {
    if (!this.pool) {
      this.imageJobs.set(job.id, { ...job });
      return job;
    }
    const q = await this.pool.query(
      `INSERT INTO image_jobs (
         id, user_id, prompt, negative_prompt, style, aspect_ratio, seed, steps,
         cfg_scale, width, height, status, operation, source_asset_id, source_name,
         reference_filename, strength, progress, stage_text, error, asset,
         started_at, completed_at, estimated_duration_ms, created_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status,
         progress = EXCLUDED.progress,
         stage_text = EXCLUDED.stage_text,
         error = EXCLUDED.error,
         asset = EXCLUDED.asset,
         started_at = EXCLUDED.started_at,
         completed_at = EXCLUDED.completed_at
       RETURNING *`,
      [
        job.id, job.userId, job.prompt, job.negativePrompt || null, job.style,
        job.aspectRatio, job.seed, job.steps, job.cfgScale, job.width, job.height,
        job.status, job.operation || 'generate', job.sourceAssetId || null,
        job.sourceName || null, job.referenceFilename || null,
        job.strength !== undefined ? job.strength : null,
        job.progress, job.stageText, job.error || null,
        job.asset ? JSON.stringify(job.asset) : null,
        job.startedAt, job.completedAt || null, job.estimatedDurationMs,
        job.createdAt || job.startedAt
      ]
    );
    return imageJobRow(q.rows[0]);
  }

  async updateImageJob(id: string, updates: Partial<ImageJob>): Promise<ImageJob | undefined> {
    if (!this.pool) {
      const existing = this.imageJobs.get(id);
      if (!existing) return undefined;
      Object.assign(existing, updates);
      return existing;
    }
    const setClauses: string[] = [];
    const values: any[] = [id];
    let idx = 2;
    if (updates.status !== undefined) { setClauses.push(`status = $${idx++}`); values.push(updates.status); }
    if (updates.progress !== undefined) { setClauses.push(`progress = $${idx++}`); values.push(updates.progress); }
    if (updates.stageText !== undefined) { setClauses.push(`stage_text = $${idx++}`); values.push(updates.stageText); }
    if (updates.error !== undefined) { setClauses.push(`error = $${idx++}`); values.push(updates.error || null); }
    if (updates.asset !== undefined) { setClauses.push(`asset = $${idx++}`); values.push(updates.asset ? JSON.stringify(updates.asset) : null); }
    if (updates.startedAt !== undefined) { setClauses.push(`started_at = $${idx++}`); values.push(updates.startedAt); }
    if (updates.completedAt !== undefined) { setClauses.push(`completed_at = $${idx++}`); values.push(updates.completedAt || null); }
    if (setClauses.length === 0) return this.getImageJob(id);

    const q = await this.pool.query(
      `UPDATE image_jobs SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
      values
    );
    return q.rows[0] ? imageJobRow(q.rows[0]) : undefined;
  }

  async getImageJob(id: string): Promise<ImageJob | undefined> {
    if (!this.pool) {
      return this.imageJobs.get(id);
    }
    const q = await this.pool.query('SELECT * FROM image_jobs WHERE id = $1', [id]);
    return q.rows[0] ? imageJobRow(q.rows[0]) : undefined;
  }

  async getActiveImageJob(userId: string, isPrivileged = false): Promise<{ activeJob: (ImageJob & { elapsedMs: number }) | null; recentCompleted: ImageJob | null }> {
    if (!this.pool) {
      const jobs = [...this.imageJobs.values()];
      const active = jobs.find(j => (j.status === 'processing' || j.status === 'queued') && (isPrivileged || j.userId === userId));
      const recent = !active ? jobs.find(j => j.status === 'completed' && (isPrivileged || j.userId === userId) && (Date.now() - new Date(j.completedAt || j.startedAt).getTime() < 30000)) : null;
      return {
        activeJob: active ? { ...active, elapsedMs: Date.now() - new Date(active.startedAt).getTime() } : null,
        recentCompleted: recent || null,
      };
    }
    const userClause = isPrivileged ? '' : 'AND user_id = $1';
    const params = isPrivileged ? [] : [userId];
    const activeRes = await this.pool.query(
      `SELECT * FROM image_jobs WHERE status IN ('processing', 'queued') ${userClause} ORDER BY started_at DESC LIMIT 1`,
      params
    );
    if (activeRes.rows.length > 0) {
      const active = imageJobRow(activeRes.rows[0]);
      return {
        activeJob: { ...active, elapsedMs: Date.now() - new Date(active.startedAt).getTime() },
        recentCompleted: null,
      };
    }
    const recentRes = await this.pool.query(
      `SELECT * FROM image_jobs WHERE status = 'completed' AND completed_at >= now() - interval '30 seconds' ${userClause} ORDER BY completed_at DESC LIMIT 1`,
      params
    );
    const recent = recentRes.rows[0] ? imageJobRow(recentRes.rows[0]) : null;
    return {
      activeJob: null,
      recentCompleted: recent,
    };
  }

  async getNextQueuedImageJob(): Promise<ImageJob | undefined> {
    if (!this.pool) {
      return [...this.imageJobs.values()].find(j => j.status === 'queued' || j.status === 'processing');
    }
    const res = await this.pool.query(
      `SELECT * FROM image_jobs WHERE status IN ('queued', 'processing') ORDER BY CASE WHEN status = 'processing' THEN 0 ELSE 1 END, created_at ASC LIMIT 1`
    );
    return res.rows[0] ? imageJobRow(res.rows[0]) : undefined;
  }

  async hasActiveJobForUser(userId: string): Promise<boolean> {
    if (!this.pool) {
      return [...this.imageJobs.values()].some(j => j.userId === userId && (j.status === 'queued' || j.status === 'processing'));
    }
    const res = await this.pool.query(
      `SELECT 1 FROM image_jobs WHERE user_id = $1 AND status IN ('queued', 'processing') LIMIT 1`,
      [userId]
    );
    return res.rows.length > 0;
  }

  async listRecentPrompts(userId: string, isPrivileged = false, limit = 20): Promise<Array<{
    id: string;
    prompt: string;
    style: string;
    aspectRatio: string;
    seed: number;
    url: string;
    createdAt: string;
  }>> {
    const assets = await this.listGeneratedAssets(userId, isPrivileged, 100);
    const seen = new Set<string>();
    const prompts: Array<{
      id: string;
      prompt: string;
      style: string;
      aspectRatio: string;
      seed: number;
      url: string;
      createdAt: string;
    }> = [];
    for (const a of assets) {
      const key = `${a.prompt.toLowerCase()}::${a.style}`;
      if (!seen.has(key)) {
        seen.add(key);
        prompts.push({
          id: a.id,
          prompt: a.prompt,
          style: a.style,
          aspectRatio: a.aspectRatio,
          seed: a.seed,
          url: a.url,
          createdAt: a.createdAt,
        });
        if (prompts.length >= limit) break;
      }
    }
    return prompts;
  }

  async resetStaleImageJobs(): Promise<void> {
    if (!this.pool) {
      for (const j of this.imageJobs.values()) {
        if (j.status === 'processing') {
          j.status = 'failed';
          j.error = 'Server restarted while generation was in progress.';
        }
      }
      return;
    }
    await this.pool.query(
      `UPDATE image_jobs SET status = 'failed', error = 'Server restarted while generation was in progress.' WHERE status = 'processing'`
    );
  }

  async seedImageAssetsAndJobs(assets: GeneratedAsset[], jobs: ImageJob[]): Promise<void> {
    for (const asset of assets) {
      if (!this.pool) {
        if (!this.generatedAssets.has(asset.id)) {
          this.generatedAssets.set(asset.id, { ...asset });
        }
      } else {
        await this.saveGeneratedAsset(asset).catch(() => {});
      }
    }
    for (const job of jobs) {
      if (!this.pool) {
        if (!this.imageJobs.has(job.id)) {
          this.imageJobs.set(job.id, { ...job });
        }
      } else {
        await this.saveImageJob(job).catch(() => {});
      }
    }
  }
}

export const repository = new Repository();
