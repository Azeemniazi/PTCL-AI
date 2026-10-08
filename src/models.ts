export type Role = 'member' | 'admin';
export type MeetingStatus = 'launching'|'lobby'|'joined'|'recording'|'stopping'|'processing'|'completed'|'failed'|'deleted';
export const activeStatuses: MeetingStatus[] = ['launching','lobby','joined','recording','stopping','processing'];

export interface User {id:string; tenantId:string; objectId:string; email:string; displayName:string; role:Role}
export interface Participant {id:string; meetingId:string; externalId?:string; displayName:string; joinedAt:string; leftAt?:string}
export interface TranscriptSegment {id:string; meetingId:string; speakerName?:string; startMs:number; endMs:number; text:string; confidence?:number}
export interface Snapshot {id:string; meetingId:string; objectKey:string; capturedAtMs:number; perceptualHash?:string}
export interface Mom {
  summary:string; attendees:string[]; topics:Array<{title:string; notes:string; timestampMs?:number}>;
  decisions:Array<{decision:string; timestampMs?:number}>;
  actionItems:Array<{task:string; owner?:string; dueDate?:string; timestampMs?:number}>;
  risks:string[]; openQuestions:string[];
}
export interface Meeting {
  id:string; ownerId:string; engineId?:string; encryptedUrl?:string; title:string; botName:string;
  status:MeetingStatus; failureCode?:string; failureMessage?:string; recordingObjectKey?:string;
  consentedAt:string; startedAt?:string; endedAt?:string; expiresAt:string; createdAt:string; updatedAt:string;
  participants?:Participant[]; transcript?:TranscriptSegment[]; snapshots?:Snapshot[]; mom?:Mom;
}
