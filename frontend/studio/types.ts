import type { ApiClient } from '../shared/types';

export type Tab = 'create' | 'remix' | 'gallery' | 'analyze';
export type DraftMode = 'create' | 'remix';
export type DraftField = 'prompt' | 'negativePrompt' | 'style' | 'aspectRatio' | 'seed' | 'strength';

export interface Draft {
  prompt: string; negativePrompt: string; style: string; aspectRatio: string; seed: string;
  advanced: boolean; originalPrompt: string | null;
}
export interface Asset {
  id: string; url: string; filename?: string; prompt: string; style: string; aspectRatio: string;
  height?: number; width?: number; createdAt: string; seed?: number; operation?: string; renderKind?: string; negativePrompt?: string;
}
export type Source = { url: string; name?: string; file?: File; assetId?: string };
export interface Job {
  id: string; status: string; startedAt?: string; createdAt?: string; error?: string;
  asset?: Asset; resultAsset?: Asset; operation?: string;
}
export interface Capabilities {
  model?: string; message?: string; remix?: boolean; remixMessage?: string; controls?: { strength?: boolean };
}
export type RestoreSettings = Partial<Pick<Asset, 'prompt' | 'negativePrompt' | 'style' | 'aspectRatio'> & { seed: number | string }>;
export interface StudioState {
  tab: Tab;
  create: Draft;
  remix: Draft & { source: Source | null; strength: number; result: Asset | null; compare: 'original' | 'result' };
  analyze: { source: Source | null; example: boolean; loading: boolean; result: string; error: string; kind: string; sourceVersion: number };
  assets: Asset[]; activeId: string | null; selected: Set<string>; selectionMode: boolean;
  query: string; filter: string; historyStatus: string; historyError: string;
  capabilities: Capabilities | null;
  capabilityError: string;
  job: Job | null; submitting: boolean; enhancing: boolean; error: string; pollFailures: number; submitFailed: boolean;
  lastOperation: 'generate' | 'remix';
}

export interface StudioProps {
  state: StudioState;
  announcement: string;
  onDraft: (mode: DraftMode, field: DraftField, value: string) => void;
  onAdvanced: (mode: DraftMode, open: boolean) => void;
  onQuery: (value: string) => void;
  onFilter: (value: string) => void;
  onSelect: (id: string, selected: boolean) => void;
  dialog: StudioDialog | null;
  request: ApiClient;
  onClose: () => void;
  onImport: (value: string, signal: AbortSignal) => Promise<void>;
  onAssetOperation: (ids: string[], mode: 'save' | 'delete', options: SaveOptions | undefined, signal: AbortSignal) => Promise<AssetOperationResult>;
}
export type StudioDialogContent = { kind: 'view'; asset: Asset } | { kind: 'reference' | 'history' | 'url' }
  | { kind: 'save' | 'delete'; ids: string[] };
export type StudioDialog = { key: number } & StudioDialogContent;
export interface SaveOptions { folderId: string | null; filename?: string; isShared: boolean }
export interface AssetOperationResult { succeeded: string[]; failed: Array<{ id: string; message: string }> }
