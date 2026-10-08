import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';
import { config } from './config.js';
export type JobName='transcribe-chunk'|'finalize-meeting'|'purge-meeting'|'retention-sweep';
export const redisConnection=config.redisUrl?new Redis(config.redisUrl,{maxRetriesPerRequest:null}):undefined;
export const meetingQueue=redisConnection?new Queue('cloudcore-meetings',{connection:redisConnection}):undefined;
export function meetingJobId(name:JobName,meetingId:string|undefined){if(!meetingId)return undefined;return name==='finalize-meeting'?`${name}-${meetingId}-${randomUUID()}`:`${name}-${meetingId}`}
export async function enqueue(name:JobName,data:Record<string,unknown>){if(!meetingQueue)return false;const meetingId=typeof data.meetingId==='string'?data.meetingId:undefined;await meetingQueue.add(name,data,{jobId:meetingJobId(name,meetingId),attempts:3,backoff:{type:'exponential',delay:3000},removeOnComplete:100,removeOnFail:200});return true}
