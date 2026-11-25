import type { KnowledgeDocument, KnowledgeFolder } from './models.js';

export type FilingLocation = { region?: string; site?: string };
export type FilingAction = 'keep' | 'move' | 'review';
export interface FilingEntry extends FilingLocation {
  id: string;
  revision: string;
  filename: string;
  source: string[];
  action: FilingAction;
  customer?: string;
  destinationId?: string;
  destination?: string[];
  documentType: string;
  evidence?: { section: string; excerpt: string };
  reason: string;
  canConsolidate?: boolean;
  canConfirm?: boolean;
  canFileManually?: boolean;
  alias?: string;
  duplicate?: 'identical' | 'possible version';
  recovery?: 'pdf' | 'archive';
}

export const sharedReferences = 'Shared references';
export const customerKey = (value: string) => value.normalize('NFKC').toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const entityKey = (value: string) => customerKey(value).replace(/\s+(?:(?:pvt|private)\s+)?(?:limited|ltd)$/, '');
const generic = /^(?:cloud contracts|contracts?(?: central| north| south)?|central|north|south|inbox|new|old|archive|misc(?:ellaneous)?|documents|others?|shared references|cloud sofs and contracts|karachi customer all possible data)$/i;
const catchAll = /\b(?:all possible data|all customers|templates?|shared references|onboarding tickets|customer audit)\b/i;
const tabular = /\.(?:xls[xm]?|csv|tsv)$/i;
const archive = /\.(?:zip|rar)$/i;
const role = /\b(?:customer(?: name)?|client(?: name)?|bill(?:ed)? to|sold to|issued to|purchaser|buyer|subscriber|signed by|on behalf of|for and on behalf of)\s*[:|–-]?\s*$/i;
const organizationRole = /\b(?:customer(?: name)?|client(?: name)?|bill(?:ed)? to|sold to|issued to|purchaser|buyer|subscriber)\b/i;
const nameOf = (folder: KnowledgeFolder) => folder.name.replace(/\s+(?:sla|contracts?|data center|renewals?)$/i, '');
const includes = (value: string, key: string) => (' ' + value + ' ').includes(' ' + key + ' ');

export function manualFilingName(value: string) {
  const name = value.normalize('NFC').trim().replace(/\s+/g, ' ');
  const key = customerKey(name);
  if (key.length < 2 || name.length > 120 || /[/\\\u0000-\u001f]/.test(value) ||
      (generic.test(key) && key !== customerKey(sharedReferences))) return;
  return name;
}

export function contractsRoot(folders: KnowledgeFolder[]) {
  return folders.find(folder => folder.isShared && !folder.parentId && customerKey(folder.name) === 'cloud contracts');
}

export function filingFolderPath(folders: Map<string, KnowledgeFolder>, id?: string | null) {
  const path: KnowledgeFolder[] = [];
  const seen = new Set<string>();
  while (id && !seen.has(id)) {
    seen.add(id);
    const folder = folders.get(id);
    if (!folder) break;
    path.unshift(folder);
    id = folder.parentId;
  }
  return path;
}

export function filingLocation(path: string[], saved?: FilingLocation): FilingLocation {
  const region = path.map(part => /^(?:contracts? )?(central|north|south)$/i.exec(customerKey(part))?.[1]).find(Boolean);
  const site = path.map(part => /\b(karachi|lahore|islamabad|rawalpindi)\b/i.exec(part)?.[1]).find(Boolean);
  const title = (value?: string) => value && (value[0]!.toUpperCase() + value.slice(1).toLowerCase());
  return { region: saved?.region ?? title(region), site: saved?.site ?? title(site) };
}

export function customerFolders(root: KnowledgeFolder, folders: KnowledgeFolder[]) {
  const byId = new Map(folders.map(folder => [folder.id, folder]));
  const customers = new Map<string, { name: string; folder: KnowledgeFolder; path: KnowledgeFolder[]; aliases: Set<string> }>();
  for (const folder of folders) {
    const path = filingFolderPath(byId, folder.id);
    if (!folder.isShared || path[0]?.id !== root.id || path.length < 2 ||
        path.some(part => !part.isShared || customerKey(part.name) === 'shared references')) continue;
    const index = path.findIndex((part, i) => i > 0 && !generic.test(customerKey(part.name)) && !catchAll.test(part.name));
    const name = nameOf(folder);
    const key = entityKey(name);
    if (key.length < 3) continue;
    if (index !== path.length - 1) {
      const parent = index >= 0 ? path[index] : undefined;
      const parentKey = parent ? entityKey(nameOf(parent)) : '';
      // A distinct legal entity can be nested inside its parent brand.
      if (!parentKey || key === parentKey || !key.startsWith(parentKey + ' ') ||
        !/\b(?:islamic|bank|insurance|finance|pharma|telecom|energy)$/.test(key)) continue;
    }
    const previous = customers.get(key);
    const candidate = { name, folder, path, aliases: previous?.aliases ?? new Set<string>() };
    candidate.aliases.add(folder.name);
    if (!previous || path.length < previous.path.length ||
      (path.length === previous.path.length && (folder.fileCount ?? 0) > (previous.folder.fileCount ?? 0))) {
      customers.set(key, candidate);
    }
  }
  // Retain inferred customer spelling and placement without conflating different brands.
  return customers;
}

function documentType(name: string) {
  if (archive.test(name)) return 'Archive';
  if (tabular.test(name)) return 'Spreadsheet';
  if (/\binvoice\b/i.test(name)) return 'Invoice';
  if (/\b(?:po|purchase order)\b/i.test(name)) return 'Purchase order';
  if (/\b(?:sof|service order)\b/i.test(name)) return 'Service order';
  if (/\b(?:addend\w*|amend\w*)\b/i.test(name)) return 'Amendment';
  if (/\brenewal\b/i.test(name)) return 'Renewal';
  if (/\b(?:sla|agreement|contract)\b/i.test(name)) return 'Contract';
  return 'Document';
}

type CustomerCatalog = ReturnType<typeof customerFolders>;

/** The strongest match per line wins. A shorter name inside a longer entity is never separate evidence. */
function candidates(value: string, customers: CustomerCatalog, party = false) {
  const units = customerKey(value);
  const matches = [...customers.keys()].filter(key => includes(units, key));
  return matches.filter(key => !matches.some(other => key !== other && includes(other, key)) &&
    (!party || new RegExp('^' + key + '(?:$| )', 'u').test(units)));
}

function inspect(text: string, customers: CustomerCatalog) {
  const matches = new Map<string, { strong: boolean; section: string; excerpt: string }>();
  const observed = new Map<string, { name: string; section: string; excerpt: string }>();
  let section = 'Document text';
  let opening = 0;
  let pendingRole = '';
  let tracker = false;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    opening += line.length;
    const heading = /^(?:---\s*)?(?:#{1,6}\s*)?page\s+(\d+)\b/i.exec(line);
    if (heading) section = 'Page ' + heading[1];
    else if (/^#{1,6}\s/.test(line)) section = line.replace(/^#+\s*/, '').slice(0, 100);
    if (/^\|.*\b(?:customer|client|tenant)(?: name)?\s*\|/i.test(line)) tracker = true;
    const label = /^(?:\|\s*)?(?:customer(?: name)?|client(?: name)?|bill(?:ed)? to|sold to|issued to|purchaser|buyer|subscriber|signed by|(?:for and )?on behalf of)\s*[:|–-]\s*([^|]*)/i.exec(line);
    const signatory = label?.[1]?.trim() || (pendingRole ? line : '');
    const party = signatory || (/\b(?:agreement|contract)\b.*\b(?:between|with)\b/i.test(line) ? line : '');
    const partyKeys = party ? candidates(party, customers, Boolean(signatory)) : [];
    const excerpt = (pendingRole ? pendingRole + ' ' : '') + line.slice(0, 350);
    const keys = new Set([...partyKeys, ...(opening <= 2400 ? candidates(line, customers) : [])]);
    if (signatory && organizationRole.test(excerpt) && /^[\p{L}][\p{L}\p{N} &().,-]{2,79}$/u.test(signatory) &&
        /\b(?:limited|ltd|llc|plc|inc|bank|pharma|hospital|university|authority|corporation|company)\b/i.test(signatory) &&
        !/^(?:name|details?|address|signature|date|ptcl\b.*|pakistan telecommunication company\b.*|n a)$/i.test(customerKey(signatory))) {
      const key = entityKey(signatory);
      if (!customers.has(key) && !partyKeys.length && key) observed.set(key, { name: signatory, section, excerpt });
    }
    for (const key of keys) {
      const strong = partyKeys.includes(key);
      if (!matches.has(key) || (strong && !matches.get(key)!.strong)) {
        matches.set(key, { strong, section, excerpt });
      }
    }
    pendingRole = role.test(line.replace(/^\|\s*/, '')) ? line.slice(0, 80) : '';
  }
  return { matches, observed, tracker };
}

export function buildFilingAudit(root: KnowledgeFolder, folders: KnowledgeFolder[], documents: KnowledgeDocument[]) {
  const byId = new Map(folders.map(folder => [folder.id, folder]));
  const catalog = customerFolders(root, folders);
  const shared = folders.find(folder => folder.parentId === root.id && folder.isShared && customerKey(folder.name) === 'shared references');
  const entries: FilingEntry[] = [];
  const confirmedAliases = new Map<string, Set<string>>();
  const originals = new Map<string, KnowledgeDocument>();
  const hashes = new Map<string, number>();
  for (const doc of documents) {
    const path = filingFolderPath(byId, doc.folderId);
    if (!doc.isShared || path.some(folder => !folder.isShared) ||
      (path[0]?.id !== root.id && doc.folderId)) continue;
    const text = doc.status === 'ready' ? doc.extractedText?.trim() ?? '' : '';
    const body = inspect(text, catalog);
    const strong = [...body.matches].filter(([, evidence]) => evidence.strong).map(([key]) => key);
    const named = candidates(customerKey(doc.filename), catalog);
    const located = path.map(folder => entityKey(nameOf(folder))).reverse().find(key => catalog.has(key));
    const clues = new Set([...body.matches.keys(), ...named, ...(located ? [located] : [])]);
    if (!doc.folderId && !clues.size && !strong.length && !body.observed.size) continue;
    originals.set(doc.id, doc);
    if (doc.contentHash) hashes.set(doc.contentHash, (hashes.get(doc.contentHash) ?? 0) + 1);
    const source = path.map(folder => folder.name);
    const entry: FilingEntry = { id: doc.id, revision: doc.updatedAt, filename: doc.filename, source, action: 'review',
      documentType: documentType(doc.filename), ...filingLocation(source, doc.filingLocation),
      reason: 'No clear customer evidence was found.' };
    if (clues.size === 1) entry.customer = catalog.get([...clues][0]!)?.name;
    if (doc.filingLocation?.verifiedFolderId && path[1]?.id === doc.filingLocation.verifiedFolderId && !archive.test(doc.filename)) {
      entry.customer = path[1].name;
      entry.destinationId = path[1].id;
      entry.destination = source;
      entry.action = 'keep';
      entry.reason = 'A reviewer approved this placement.';
      const aliases = confirmedAliases.get(path[1].id) ?? new Set<string>();
      for (const alias of doc.filingLocation.aliases ?? []) aliases.add(alias);
      confirmedAliases.set(path[1].id, aliases);
      const evidence = located ? body.matches.get(located) : undefined;
      if (evidence) entry.evidence = { section: evidence.section, excerpt: evidence.excerpt };
    } else if (archive.test(doc.filename)) {
      entry.recovery = 'archive';
      entry.reason = 'Review the archive contents before filing individual documents.';
    } else if (!text) {
      if (/\.pdf$/i.test(doc.filename) && doc.status === 'failed') entry.recovery = 'pdf';
      entry.reason = doc.status === 'indexing' ? 'Indexing is in progress.' : 'No searchable text is available. Open the original to verify the customer.';
    } else if ((tabular.test(doc.filename) && ((body.tracker && clues.size !== 1) || catchAll.test(doc.filename))) ||
        /\b(?:blank template|contract template|blank form)\b/i.test(doc.filename)) {
      entry.customer = sharedReferences;
      entry.destinationId = shared?.id;
      entry.destination = [root.name, sharedReferences];
      entry.action = shared && path.some(folder => folder.id === shared.id) ? 'keep' : 'move';
      entry.reason = 'Shared tracker or template. Keep it available to multiple customers.';
    } else {
      const key = strong.length === 1 ? strong[0] : clues.size === 1 ? [...clues][0] : undefined;
      const candidate = key ? catalog.get(key) : undefined;
      const evidence = key ? body.matches.get(key) : undefined;
      if (candidate && key) {
        entry.customer = candidate.name;
        entry.destinationId = candidate.folder.parentId === root.id ? candidate.folder.id : undefined;
        entry.destination = [root.name, entry.destinationId ? candidate.folder.name : candidate.name];
        if (evidence) entry.evidence = { section: evidence.section, excerpt: evidence.excerpt };
        if (strong.length > 1 || clues.size > 1 || body.observed.size) {
          entry.reason = 'The content, filename, or current folder point to different customers.';
        } else if (!evidence || (!evidence.strong && !named.includes(key) && located !== key)) {
          entry.reason = 'Verify the customer in the original. A mention or filename alone is insufficient.';
        } else {
          entry.action = path.some(folder => folder.id === candidate.folder.id) ? 'keep' : 'move';
          entry.canConsolidate = entry.action === 'keep' && !entry.destinationId;
          if (entry.action === 'keep' && !entry.canConsolidate) entry.destination = source;
          entry.reason = evidence.strong ? 'The text identifies the customer in a party or billing field.' :
            'The opening text agrees with the filename or current customer folder. Confirm the customer’s role before moving.';
        }
      } else if (clues.size > 1 || body.observed.size > 1) {
        entry.reason = 'More than one customer is suggested by the evidence.';
      } else if (body.observed.size === 1) {
        const observed = [...body.observed.values()][0]!;
        entry.customer = observed.name;
        entry.evidence = { section: observed.section, excerpt: observed.excerpt };
        entry.reason = 'The text names a possible new customer. Verify the legal entity before creating a folder.';
      }
    }
    if (entry.action === 'review' && entry.customer && !entry.recovery && doc.status !== 'indexing') {
      const candidate = catalog.get(entityKey(entry.customer));
      if (!candidate || !path.some(folder => folder.id === candidate.folder.id) || candidate.folder.parentId !== root.id) {
        entry.destination ??= [root.name, candidate?.folder.parentId === root.id ? candidate.folder.name : entry.customer];
        entry.canConfirm = true;
      }
    }
    entry.canFileManually = entry.action === 'review' && doc.status !== 'indexing' && entry.recovery !== 'archive';
    const sourceAlias = path.find(folder => entityKey(nameOf(folder)) === (entry.customer && entityKey(entry.customer)))?.name;
    if (sourceAlias && sourceAlias !== entry.destination?.[1]) entry.alias = sourceAlias;
    entries.push(entry);
  }
  const names = new Map<string, number>();
  for (const entry of entries) {
    if (!entry.customer) continue;
    const key = customerKey(entry.customer) + '/' + customerKey(entry.filename.replace(/\.[^.]+$/, '').replace(/\s*\(\d+\)\s*$/, ''));
    names.set(key, (names.get(key) ?? 0) + 1);
  }
  for (const entry of entries) {
    const doc = originals.get(entry.id)!;
    const key = customerKey(entry.customer ?? '') + '/' + customerKey(entry.filename.replace(/\.[^.]+$/, '').replace(/\s*\(\d+\)\s*$/, ''));
    if (doc.contentHash && (hashes.get(doc.contentHash) ?? 0) > 1) entry.duplicate = 'identical';
    else if ((names.get(key) ?? 0) > 1) entry.duplicate = 'possible version';
  }
  return { entries, customers: [...catalog.values()].map(({ name, folder, path, aliases }) => ({
    name, id: folder.id, path: path.map(part => part.name), aliases: [...aliases],
    confirmedAliases: [...confirmedAliases.get(folder.id) ?? []],
  })) };
}

export function namedCustomerLookup(query: string, folders: KnowledgeFolder[]) {
  const root = contractsRoot(folders);
  if (!root) return;
  const catalog = customerFolders(root, folders);
  const hits = candidates(query, catalog);
  if (hits.length !== 1) return;
  return hits[0];
}
