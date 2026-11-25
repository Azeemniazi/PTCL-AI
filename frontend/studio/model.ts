import type { Asset, Draft, Job, RestoreSettings, StudioState } from './types';

export const styles = [
  ['natural', 'Natural', 'Let your prompt lead'], ['photoreal', 'Photographic', 'Light, texture, and detail'],
  ['corporate', 'Corporate Cloud', 'Emerald and teal'], ['diagram', 'Technical diagram', 'Clear systems and structures'],
  ['isometric', '3D isometric', 'A different perspective'], ['cyber', 'Cyber tech', 'Neon and future worlds'],
  ['minimalist', 'Minimalist', 'Simple shapes, considered space']
] as const;
export const formats = [['1:1', 'Square', 1080, 1080], ['16:9', 'Landscape', 1920, 1080], ['9:16', 'Portrait', 1080, 1920], ['4:3', 'Classic', 1440, 1080]] as const;
export const starters = [
  ['Architecture', 'A serene modern building in Islamabad, warm limestone, soft morning light, architectural photography'],
  ['Technology', 'An elegant optical fiber network, fine emerald light trails against a warm neutral background'],
  ['Product', 'A sculptural glass object on a pale stone plinth, natural window light, editorial product photography']
] as const;
const draft = (): Draft => ({prompt: '', negativePrompt: '', style: 'natural', aspectRatio: '1:1', seed: '', advanced: false, originalPrompt: null});
export function createState(): StudioState {
  return {tab: 'create', create: draft(), remix: {...draft(), source: null, strength: 0.65, result: null, compare: 'result'},
    analyze: {source: null, result: '', kind: '', loading: false, error: '', example: false, sourceVersion: 0},
    assets: [], activeId: null, selected: new Set(), selectionMode: false, query: '', filter: 'all',
    historyStatus: 'idle', historyError: '', capabilities: null, capabilityError: '',
    job: null, submitting: false, error: '', lastOperation: 'generate', pollFailures: 0, enhancing: false, submitFailed: false};
}
export function mergeAssets(existing: Asset[], incoming: Asset[]): Asset[] {
  const byId = new Map<string, Asset>();
  for (const asset of [...incoming, ...existing]) if (asset?.id && !byId.has(asset.id)) byId.set(asset.id, asset);
  return [...byId.values()].sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
}
export function filterAssets(assets: Asset[], query: string, style: string): Asset[] {
  const q = query.trim().toLowerCase();
  return assets.filter(a => (style === 'all' || a.style === style) && (!q || `${a.prompt} ${a.style}`.toLowerCase().includes(q)));
}
export function restoreDraft(target: Draft, asset: RestoreSettings): Draft {
  return {...target, prompt: (asset.prompt || '').slice(0, 500), negativePrompt: asset.negativePrompt || '',
    style: styles.some(s => s[0] === asset.style) ? asset.style ?? 'natural' : 'natural',
    aspectRatio: formats.some(f => f[0] === asset.aspectRatio) ? asset.aspectRatio ?? '1:1' : '1:1', seed: asset.seed == null ? '' : String(asset.seed), originalPrompt: null};
}
export function validateFile(file: Pick<File, 'type' | 'size'> | null): string {
  if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'Choose a JPG, PNG, or WEBP image.';
  if (!file.size || file.size > 20 * 1048576) return 'Choose an image between 1 byte and 20 MB.';
  return '';
}
export function filename(asset: Pick<Asset, 'filename'>): string {
  const raw = String(asset.filename || 'image.png').split(/[\\/]/).pop();
  return raw || 'image.png';
}
export function requestBody(d: Draft) {
  return {prompt: d.prompt.trim(), negativePrompt: d.negativePrompt.trim() || undefined,
    style: d.style, aspectRatio: d.aspectRatio, seed: d.seed === '' ? undefined : Number(d.seed), steps: 8, cfgScale: 1};
}
export function validateDraft(d: Draft): string {
  if (!d.prompt.trim()) return 'Describe the image you want to create.';
  if (d.prompt.length > 500) return 'Keep your prompt within 500 characters.';
  if (d.seed !== '' && (!Number.isSafeInteger(Number(d.seed)) || Number(d.seed) < 1 || Number(d.seed) > 2147483647)) return 'Use a whole-number seed between 1 and 2147483647, or leave it empty.';
  return '';
}
export const terminal = (job: Job | null | undefined) => Boolean(job && ['completed', 'failed', 'cancelled'].includes(job.status));
