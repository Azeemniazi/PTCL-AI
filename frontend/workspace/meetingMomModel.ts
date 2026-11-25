import type { Mom } from '../../src/models';

export function readMeetingMom(form: HTMLFormElement, previous?: Mom): Mom {
  const data = new FormData(form);
  const field = (name: string) => String(data.get(name) ?? '');
  const lines = (name: string) => field(name).split('\n').map(value => value.trim()).filter(Boolean);
  return {
    summary: field('summary'),
    attendees: lines('attendees'),
    topics: lines('topics').map((value, index) => {
      const [title = '', ...notes] = value.split('|');
      return { title: title.trim(), notes: notes.join('|').trim(), timestampMs: previous?.topics?.[index]?.timestampMs };
    }),
    decisions: lines('decisions').map((decision, index) => ({ decision, timestampMs: previous?.decisions?.[index]?.timestampMs })),
    actionItems: lines('actionItems').map((value, index) => {
      const [task = '', owner, dueDate] = value.split('|').map(item => item.trim());
      return { task, owner: owner || undefined, dueDate: dueDate || undefined, timestampMs: previous?.actionItems?.[index]?.timestampMs };
    }),
    risks: lines('risks'),
    openQuestions: lines('openQuestions'),
  };
}
