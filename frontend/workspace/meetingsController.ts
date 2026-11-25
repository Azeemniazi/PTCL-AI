import { activeStatuses, type Meeting } from '../../src/models';
import type { ApiClient } from '../shared/types';
import { readMeetingMom } from './meetingMomModel';

interface MeetingList {
  meetings: Meeting[];
  capacity: { active: number; maximum: number };
}

interface MeetingState extends MeetingList {
  detail: Meeting | null;
  preview: Meeting | null;
  listLoaded: boolean;
  loading: boolean;
  error: string;
  launching: boolean;
}

interface MeetingRoute {
  userId: string;
  hash: string;
  meetingId: string | null;
}

interface MeetingCallbacks {
  request: ApiClient;
  getUserId: () => string | undefined;
  getMeetingId: () => string | null;
  onChange: () => void;
  onLaunchChange: (url: string, consent: boolean) => void;
  onLaunched: (id: string) => void;
  onDeleted: () => void;
  notify: (message: string) => void;
}

function createMeetingsState(): MeetingState {
  return { meetings: [], capacity: { active: 0, maximum: 2 }, detail: null, preview: null, listLoaded: false, loading: false, error: '', launching: false };
}

function sameRoute(left: MeetingRoute, right: MeetingRoute | undefined) {
  return left.userId === right?.userId && left.hash === right.hash && left.meetingId === right.meetingId;
}

export function createMeetingsController({ request, getUserId, getMeetingId, onChange, onLaunchChange, onLaunched, onDeleted, notify }: MeetingCallbacks) {
  const state = createMeetingsState();
  let pollTimer: ReturnType<typeof setTimeout> | undefined;
  let pending: { route: MeetingRoute; controller: AbortController } | undefined;
  let revision = 0;

  function sessionIsCurrent() {
    const owner = getUserId();
    const startedAt = revision;
    return () => Boolean(owner && owner === getUserId() && startedAt === revision);
  }

  const meetingPath = (id: string) => `/api/meetings/${encodeURIComponent(id)}`;
  const failureMessage = (error: unknown, fallback: string) => error instanceof Error && error.message ? error.message : fallback;

  function route(): MeetingRoute | undefined {
    const userId = getUserId();
    const hash = location.hash;
    if (userId && (hash === '#meetings' || hash.startsWith('#meetings/'))) {
      return { userId, hash, meetingId: getMeetingId() };
    }
  }

  function stopPoll() {
    clearTimeout(pollTimer);
    pollTimer = undefined;
  }

  function stopRefresh() {
    pending?.controller.abort();
    pending = undefined;
    state.loading = false;
  }

  function schedule() {
    stopPoll();
    const selected = route();
    if (!selected || pending) return;
    const active = state.detail?.id === selected.meetingId && activeStatuses.includes(state.detail.status);
    pollTimer = setTimeout(() => {
      if (sameRoute(selected, route())) void refresh();
    }, active ? 5000 : 8000);
  }

  async function refresh(force = false) {
    const selected = route();
    if (!selected || (pending && !force && sameRoute(pending.route, selected))) return;
    stopPoll();
    stopRefresh();
    const controller = new AbortController();
    const attempt = { route: selected, controller };
    const options = { signal: controller.signal };
    const current = () => pending === attempt && sameRoute(selected, route());
    const loadDetail = (id: string) => request<Meeting>(meetingPath(id), options);
    pending = attempt;
    state.loading = true;

    try {
      if (selected.meetingId) {
        const detail = await loadDetail(selected.meetingId);
        if (!current()) return;
        state.detail = detail;
      } else {
        const list = await request<MeetingList>('/api/meetings', options);
        if (!current()) return;
        const first = list.meetings?.[0];
        const preview = first ? await loadDetail(first.id).catch(() => first) : null;
        if (!current()) return;
        state.meetings = list.meetings ?? [];
        state.capacity = list.capacity ?? state.capacity;
        state.preview = preview;
        state.listLoaded = true;
      }
      state.error = '';
    } catch (error) {
      if (current()) state.error = error instanceof Error ? error.message : String(error);
    } finally {
      const notify = current();
      if (pending === attempt) {
        pending = undefined;
        state.loading = false;
      }
      if (notify) {
        onChange();
        schedule();
      }
    }
  }

  async function launch(form: HTMLFormElement) {
    if (state.launching || !getUserId()) return;
    const data = new FormData(form);
    const meetingUrl = String(data.get('meetingUrl') ?? '');
    const consent = data.get('consent') === 'on';
    const current = sessionIsCurrent();
    state.launching = true;
    state.error = '';
    onLaunchChange(meetingUrl, consent);
    try {
      const meeting = await request<Meeting>('/api/meetings', { method: 'POST', body: JSON.stringify({ meetingUrl, consent }) });
      if (!current()) return;
      state.listLoaded = false;
      if (location.hash === '#meetings') onLaunched(meeting.id);
    } catch (error) {
      if (!current()) return;
      state.error = failureMessage(error, 'Could not start the meeting.');
      notify(state.error);
    } finally {
      if (current()) {
        state.launching = false;
        if (location.hash === '#meetings') onLaunchChange(meetingUrl, consent);
      }
    }
  }

  async function command(id: string, action: 'stop' | 'regenerate' | 'delete') {
    const current = sessionIsCurrent();
    if (!current()) return;
    const commands = {
      stop: ['/stop', 'POST', 'The bot is leaving the meeting.'],
      regenerate: ['/regenerate-mom', 'POST', 'MOM generation started.'],
      delete: ['', 'DELETE', 'Meeting deleted.'],
    } as const;
    const [suffix, method, message] = commands[action];
    try {
      await request(`${meetingPath(id)}${suffix}`, { method });
      if (!current()) return;
      notify(message);
      if (action === 'delete') {
        state.listLoaded = false;
        state.meetings = state.meetings.filter(meeting => meeting.id !== id);
        if (state.preview?.id === id) state.preview = null;
        if (state.detail?.id === id) state.detail = null;
        if (getMeetingId() === id && location.hash.startsWith('#meetings/')) {
          onDeleted();
          return;
        }
      }
    } catch (error) {
      if (current()) notify(failureMessage(error, 'Could not update the meeting.'));
    }
    if (current() && (location.hash === '#meetings' || getMeetingId() === id)) await refresh(true);
  }

  async function updateDetail(id: string, path: string, options: RequestInit, success: string, failure: string) {
    const current = sessionIsCurrent();
    if (!current()) return;
    try {
      await request(`${meetingPath(id)}${path}`, options);
      if (!current()) return;
      notify(success);
      if (getMeetingId() === id) await refresh(true);
    } catch (error) {
      if (current()) notify(failureMessage(error, failure));
    }
  }

  return {
    state, schedule, refresh, launch, command,
    saveMom(meeting: Meeting, form: HTMLFormElement) {
      const body = JSON.stringify(readMeetingMom(form, meeting.mom));
      return updateDetail(meeting.id, '/mom', { method: 'PUT', body }, 'MOM changes saved.', 'Could not save meeting minutes.');
    },
    captureSnapshot(id: string) {
      notify('Capturing screen snapshot from live bot display…');
      return updateDetail(id, '/capture-snapshot', { method: 'POST' }, 'Screen snapshot captured successfully.', 'Failed to capture snapshot.');
    },
    navigate() {
      stopPoll();
      const selected = route();
      if (pending && !sameRoute(pending.route, selected)) stopRefresh();
      if (!selected || pending) return;
      if (selected.meetingId ? state.detail?.id !== selected.meetingId : !state.listLoaded) void refresh();
      else schedule();
    },
    reset() {
      revision++;
      stopPoll();
      stopRefresh();
      Object.assign(state, createMeetingsState());
    },
  };
}
