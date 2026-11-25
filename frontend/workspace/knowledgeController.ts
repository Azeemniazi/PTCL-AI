import type { KnowledgeDocument, KnowledgeFolder } from '../../src/models';
import type { ApiClient } from '../shared/types';

type Scope = 'shared' | 'personal' | 'all';
export type KnowledgeRange = 'folder' | 'branch' | 'scope';
export const knowledgePageSize = 10;

function initialState() {
  return {
    scope: 'shared' as Scope, folders: [] as KnowledgeFolder[], documents: [] as KnowledgeDocument[],
    folderId: null as string | null, page: 1, search: '', filter: 'all', selected: new Set<string>(),
    busy: false, loaded: false, error: '',
    range: 'folder' as KnowledgeRange, sort: 'name' as 'name' | 'modified',
  };
}

interface KnowledgeCallbacks {
  request: ApiClient;
  getUserId: () => string | undefined;
  isVisible: () => boolean;
  onChange: () => void;
  notify: (message: string) => void;
}

export function createKnowledgeController({ request, getUserId, isVisible, onChange, notify }: KnowledgeCallbacks) {
  const state = initialState();
  let pending: AbortController | undefined;
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  let statusTimer: ReturnType<typeof setTimeout> | undefined;

  function stop() {
    clearTimeout(searchTimer);
    clearTimeout(statusTimer);
    searchTimer = undefined;
    statusTimer = undefined;
    pending?.abort();
    pending = undefined;
    state.busy = false;
  }

  function clampPage(page: number) {
    return Math.max(1, Math.min(page, Math.ceil(state.documents.length / knowledgePageSize)));
  }

  const indexing = () => state.documents.some(document => document.status === 'indexing');

  async function load(showToast = false) {
    const owner = getUserId();
    if (!owner) return;
    stop();
    const controller = new AbortController();
    pending = controller;
    const current = () => pending === controller && getUserId() === owner;
    state.busy = true;
    state.error = '';
    onChange();
    const query = new URLSearchParams({ scope: state.scope, namesOnly: 'true', metadataOnly: 'true' });
    if (state.range === 'folder') query.set('folderId', state.folderId ?? 'null');
    if (state.range === 'branch' && state.folderId) {
      query.set('folderId', state.folderId);
      query.set('descendants', 'true');
    }
    if (state.search.trim()) query.set('search', state.search.trim());
    if (state.filter !== 'all') query.set('type', state.filter);
    try {
      const options = { signal: controller.signal };
      const [folderResult, documentResult] = await Promise.all([
        request<{ folders: KnowledgeFolder[] }>(`/api/knowledge/folders?scope=${encodeURIComponent(state.scope)}`, options),
        request<{ documents: KnowledgeDocument[] }>(`/api/knowledge/documents?${query}`, options),
      ]);
      if (!current()) return;
      state.folders = folderResult.folders ?? [];
      if (state.folderId && !state.folders.some(folder => folder.id === state.folderId)) {
        selectFolder(null);
        return;
      }
      state.documents = documentResult.documents ?? [];
      sortDocuments();
      state.page = clampPage(state.page);
      state.loaded = true;
      if (showToast) notify('Knowledge Hub updated.');
    } catch (error) {
      if (current()) {
        controller.abort();
        state.error = error instanceof Error ? error.message : String(error);
      }
    } finally {
      if (current()) {
        pending = undefined;
        state.busy = false;
        onChange();
        if (indexing() && isVisible()) statusTimer = setTimeout(() => { if (isVisible()) void load(); }, 5000);
      }
    }
  }

  function sortDocuments() {
    state.documents.sort((a, b) => (state.sort === 'modified'
      ? String(b.updatedAt ?? b.createdAt ?? '').localeCompare(String(a.updatedAt ?? a.createdAt ?? '')) : 0)
      || a.filename.localeCompare(b.filename, undefined, { numeric: true }) || a.id.localeCompare(b.id));
  }

  function selectFolder(id: string | null) {
    state.folderId = id || null;
    state.range = 'folder';
    state.search = '';
    state.selected.clear();
    state.documents = [];
    state.page = 1;
    state.loaded = false;
    void load();
  }

  return {
    state, load, selectFolder,
    restoreLocation(scope: Scope, folderId: string | null) {
      if (scope === state.scope && folderId === state.folderId) return;
      if (scope !== state.scope) state.folders = [];
      state.scope = scope;
      selectFolder(folderId);
    },
    switchScope(scope: Scope) {
      if (!['shared', 'personal', 'all'].includes(scope)) return;
      state.scope = scope;
      state.folders = [];
      selectFolder(null);
    },
    search(value: string, immediate = false) {
      if (!immediate && value === state.search) return;
      stop();
      state.search = value;
      state.page = 1;
      state.loaded = false;
      if (immediate) void load();
      else {
        onChange();
        searchTimer = setTimeout(() => {
          searchTimer = undefined;
          if (isVisible()) void load();
        }, 300);
      }
    },
    setFilter(type: string) { state.filter = type; state.page = 1; state.loaded = false; void load(); },
    setRange(range: KnowledgeRange) {
      state.range = range;
      state.page = 1;
      state.documents = [];
      state.selected.clear();
      void load();
    },
    setSort(sort: 'name' | 'modified') { state.sort = sort; state.page = 1; sortDocuments(); onChange(); },
    setPage(page: number) { state.page = clampPage(page); onChange(); },
    toggleDocument(id: string) {
      if (state.selected.has(id)) state.selected.delete(id);
      else state.selected.add(id);
      onChange();
    },
    togglePage() {
      const start = (state.page - 1) * knowledgePageSize;
      const documents = state.documents.slice(start, start + knowledgePageSize);
      const all = documents.every(document => state.selected.has(document.id));
      for (const { id } of documents) {
        if (all) state.selected.delete(id);
        else state.selected.add(id);
      }
      onChange();
    },
    navigate() {
      if (!isVisible()) {
        if (pending) state.loaded = false;
        stop();
      } else if (!pending && searchTimer === undefined && (!state.loaded || indexing())) void load();
    },
    reset() { stop(); Object.assign(state, initialState()); },
  };
}

export function getFolderBreadcrumbs(activeFolder: KnowledgeFolder | undefined, folders: KnowledgeFolder[]): KnowledgeFolder[] {
  if (!activeFolder) return [];
  const map = new Map(folders.map(f => [f.id, f]));
  const chain: KnowledgeFolder[] = [activeFolder];
  let cur = activeFolder;
  const seen = new Set<string>([cur.id]);
  while (cur.parentId && map.has(cur.parentId)) {
    const parent = map.get(cur.parentId)!;
    if (seen.has(parent.id)) break;
    seen.add(parent.id);
    chain.unshift(parent);
    cur = parent;
  }
  return chain;
}

export interface FolderTreeOption {
  id: string;
  name: string;
  depth: number;
  label: string;
  isShared: boolean;
}

export function buildFolderTree(folders: KnowledgeFolder[]): FolderTreeOption[] {
  const byParent = new Map<string | null, KnowledgeFolder[]>();
  for (const f of folders) {
    const p = f.parentId || null;
    const list = byParent.get(p) ?? [];
    list.push(f);
    byParent.set(p, list);
  }
  const result: FolderTreeOption[] = [];
  function walk(parentId: string | null, depth: number) {
    const children = byParent.get(parentId) ?? [];
    children.sort((a, b) => a.name.localeCompare(b.name));
    for (const child of children) {
      const indent = depth > 0 ? '\u00A0\u00A0'.repeat(depth) + '↳ ' : '';
      result.push({
        id: child.id,
        name: child.name,
        depth,
        label: `${indent}${child.name} (${child.isShared ? 'Shared' : 'Private'})`,
        isShared: child.isShared,
      });
      walk(child.id, depth + 1);
    }
  }
  walk(null, 0);
  const allIds = new Set(result.map(r => r.id));
  for (const f of folders) {
    if (!allIds.has(f.id)) {
      result.push({
        id: f.id,
        name: f.name,
        depth: 0,
        label: `${f.name} (${f.isShared ? 'Shared' : 'Private'})`,
        isShared: f.isShared,
      });
    }
  }
  return result;
}
