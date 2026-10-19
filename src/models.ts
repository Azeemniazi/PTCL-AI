export type Role = 'dev' | 'admin' | 'user' | 'member';
export type MeetingStatus = 'launching'|'lobby'|'joined'|'recording'|'stopping'|'processing'|'completed'|'failed'|'deleted';
export const activeStatuses: MeetingStatus[] = ['launching','lobby','joined','recording','stopping','processing'];

export interface User {
  id: string;
  username: string;
  tenantId?: string;
  objectId?: string;
  email?: string;
  displayName: string;
  role: Role;
  mustChangePassword?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserWithSecret extends User {
  passwordHash: string;
  salt: string;
}

export interface Participant {id:string; meetingId:string; externalId?:string; displayName:string; joinedAt:string; leftAt?:string}
export interface TranscriptSegment {id:string; meetingId:string; speakerName?:string; startMs:number; endMs:number; text:string; confidence?:number}
export interface Snapshot {id:string; meetingId:string; objectKey:string; capturedAtMs:number; perceptualHash?:string}
export interface Mom {
  summary:string; attendees:string[]; topics:Array<{title:string; notes:string; timestampMs?:number}>;
  decisions:Array<{decision:string; timestampMs?:number}>;
  actionItems:Array<{task:string; owner?:string; dueDate?:string; timestampMs?:number}>;
  risks:string[]; openQuestions:string[];
}
export interface Meeting {
  id:string; ownerId:string; engineId?:string; encryptedUrl?:string; title:string; botName:string;
  status:MeetingStatus; failureCode?:string; failureMessage?:string; recordingObjectKey?:string;
  consentedAt:string; startedAt?:string; endedAt?:string; expiresAt:string; createdAt:string; updatedAt:string;
  participants?:Participant[]; transcript?:TranscriptSegment[]; snapshots?:Snapshot[]; mom?:Mom;
}

export interface KnowledgeFolder {
  id: string;
  userId: string;
  parentId?: string | null;
  name: string;
  isShared: boolean;
  color?: string;
  createdAt: string;
  updatedAt: string;
  creatorName?: string;
  fileCount?: number;
  totalSizeBytes?: number;
}

export interface KnowledgeDocument {
  id: string;
  userId: string;
  folderId?: string | null;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  isShared: boolean;
  status: 'ready' | 'indexing' | 'failed';
  extractedText?: string;
  tokenCount?: number;
  createdAt: string;
  updatedAt: string;
  creatorName?: string;
  folderName?: string;
}

export interface KnowledgeChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  embedding?: number[];
  createdAt: string;
}

export interface RetrievedChunk {
  id: string;
  documentId: string;
  filename: string;
  folderName?: string;
  chunkIndex: number;
  content: string;
  score: number;
  retrievalType: 'vector' | 'keyword' | 'hybrid';
}

export interface GeneratedAsset {
  id: string;
  userId: string;
  url: string;
  filename: string;
  prompt: string;
  negativePrompt?: string;
  style: string;
  aspectRatio: string;
  seed: number;
  steps: number;
  cfgScale: number;
  width: number;
  height: number;
  durationMs: number;
  createdAt: string;
  operation?: 'generate' | 'remix';
  sourceAssetId?: string;
  sourceName?: string;
  strength?: number;
  renderKind?: 'generated' | 'vector-preview';
}

export interface ImageJob {
  id: string;
  userId: string;
  prompt: string;
  negativePrompt?: string;
  style: string;
  aspectRatio: string;
  seed: number;
  steps: number;
  cfgScale: number;
  width: number;
  height: number;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  operation?: 'generate' | 'remix';
  sourceAssetId?: string;
  sourceName?: string;
  referenceFilename?: string;
  strength?: number;
  progress: number;
  stageText: string;
  error?: string;
  asset?: GeneratedAsset;
  startedAt: string;
  completedAt?: string;
  estimatedDurationMs: number;
  createdAt?: string;
}

