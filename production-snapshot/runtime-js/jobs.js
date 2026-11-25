import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';
import { config } from './config.js';
export const redisConnection = config.redisUrl ? new Redis(config.redisUrl, { maxRetriesPerRequest: null }) : undefined;
export const meetingQueue = redisConnection ? new Queue('cloudcore-meetings', { connection: redisConnection }) : undefined;
export function meetingJobId(name, meetingId) { if (!meetingId)
    return undefined; return name === 'finalize-meeting' ? `${name}-${meetingId}-${randomUUID()}` : `${name}-${meetingId}`; }
const inFlightMomMeetings = new Set();
export function isMomInFlight(meetingId) { return inFlightMomMeetings.has(meetingId); }
export function markMomInFlight(meetingId) { if (inFlightMomMeetings.has(meetingId))
    return false; inFlightMomMeetings.add(meetingId); return true; }
export function clearMomInFlight(meetingId) { inFlightMomMeetings.delete(meetingId); }
export async function enqueue(name, data) { if (!meetingQueue)
    return false; const meetingId = typeof data.meetingId === 'string' ? data.meetingId : undefined; const isRegen = Boolean(data.regenerate); if (name === 'finalize-meeting' && meetingId && !isRegen && inFlightMomMeetings.has(meetingId))
    return true; const jobId = name === 'finalize-meeting' && !isRegen && meetingId ? `finalize-meeting-${meetingId}` : meetingJobId(name, meetingId); if (name === 'finalize-meeting' && meetingId)
    inFlightMomMeetings.add(meetingId); await meetingQueue.add(name, data, { jobId, attempts: 3, backoff: { type: 'exponential', delay: 3000 }, removeOnComplete: 100, removeOnFail: 200 }); return true; }
