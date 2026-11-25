import { z } from 'zod';

const allowedTeamsHosts = new Set(['teams.microsoft.com','teams.live.com']);

function extractTeamsUrl(input: string) {
  const normalized = input.trim().replace(/&amp;/gi, '&').replace(/&#x26;/gi, '&').replace(/&#38;/gi, '&');
  const match = normalized.match(/https:\/\/(?:teams\.microsoft\.com|teams\.live\.com)\/[^\s<>"'\])]+/i);
  return (match?.[0] ?? normalized).replace(/[.,;:!?]+$/, '');
}

export function validateTeamsUrl(input: string) {
  let url: URL;
  try { url = new URL(extractTeamsUrl(input)); } catch { throw new Error('Enter a valid Microsoft Teams meeting link.'); }
  if (url.protocol !== 'https:' || url.username || url.password || !allowedTeamsHosts.has(url.hostname.toLowerCase()))
    throw new Error('Only HTTPS Microsoft Teams meeting links are supported.');
  const validPath = url.hostname === 'teams.microsoft.com' ? (url.pathname.startsWith('/l/meetup-join/')||url.pathname.startsWith('/meet/')) : url.pathname.startsWith('/meet/');
  if (!validPath) throw new Error('This is not a supported Microsoft Teams meeting link.');
  if (url.href.length > 4096) throw new Error('The meeting link is too long.');
  return url.href;
}

export const createMeetingSchema = z.object({meetingUrl:z.string().min(1), consent:z.literal(true)}).strict();
export const momSchema = z.object({
  summary:z.string(), attendees:z.array(z.string()),
  topics:z.array(z.object({title:z.string(),notes:z.string(),timestampMs:z.number().int().nonnegative().optional()})),
  decisions:z.array(z.object({decision:z.string(),timestampMs:z.number().int().nonnegative().optional()})),
  actionItems:z.array(z.object({task:z.string(),owner:z.string().optional(),dueDate:z.string().optional(),timestampMs:z.number().int().nonnegative().optional()})),
  risks:z.array(z.string()), openQuestions:z.array(z.string())
});
export type MomPayload = z.infer<typeof momSchema>;
