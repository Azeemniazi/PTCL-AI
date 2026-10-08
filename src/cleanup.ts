import { artifacts } from './artifacts.js';
import { repository } from './repository.js';
export async function purgeMeetingContent(meetingId:string){const detail=await repository.getMeetingDetail(meetingId);if(!detail)return;await Promise.allSettled([artifacts.delete('audio',detail.recordingObjectKey),...(detail.snapshots??[]).map(s=>artifacts.delete('snapshot',s.objectKey))]);await repository.purgeMeeting(meetingId)}
