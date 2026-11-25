interface IndexingJob {
  job_id?: string;
  filename?: string;
  status?: string;
  error?: string;
}

function waitToPoll(signal: AbortSignal) {
  signal.throwIfAborted();
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', stop);
      resolve();
    }, 1200);
    function stop() {
      clearTimeout(timer);
      reject(signal.reason);
    }
    signal.addEventListener('abort', stop, { once: true });
  });
}

export async function indexAssistantDocument(file: File, signal: AbortSignal): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const response = await fetch('/api/documents/upload', {
    method: 'POST', headers: { 'x-requested-with': 'CloudCoreAI' }, body: form, signal,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.error?.message || error?.detail || `Upload failed (${response.status})`);
  }
  let result: IndexingJob = await response.json();
  const jobId = result.job_id;
  while (result.status !== 'finished' && result.status !== 'failed') {
    if (!jobId) throw new Error('The server did not return an indexing job.');
    await waitToPoll(signal);
    const status = await fetch(`/api/jobs/${encodeURIComponent(jobId)}`, { signal });
    if (!status.ok) throw new Error(`Status check failed (${status.status}).`);
    result = await status.json();
  }
  signal.throwIfAborted();
  if (result.status === 'failed') throw new Error(result.error || 'Unknown error');
  return result.filename || file.name;
}
