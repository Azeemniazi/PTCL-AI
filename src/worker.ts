import { Worker, type Job } from 'bullmq';
import { generateMom, transcribeAudio } from './ai.js';
import { artifacts } from './artifacts.js';
import { purgeMeetingContent } from './cleanup.js';
import { redisConnection } from './jobs.js';
import { repository } from './repository.js';

if(!redisConnection)throw new Error('REDIS_URL is required for the Meetings AI worker.');
await repository.init();

async function processJob(job:Job){
  const meetingId=String(job.data.meetingId??'');
  if(job.name==='transcribe-chunk'){
    const buffer=await artifacts.getBuffer('audio',String(job.data.objectKey));const result=await transcribeAudio(buffer);
    await repository.addTranscript({meetingId,speakerName:job.data.speakerName?String(job.data.speakerName):undefined,startMs:Number(job.data.startMs),endMs:Number(job.data.endMs),text:result.text,confidence:result.confidence});return;
  }
  if(job.name==='finalize-meeting'){
    await repository.updateMeeting(meetingId,{status:'processing'});const detail=await repository.getMeetingDetail(meetingId);if(!detail)throw new Error('Meeting no longer exists.');
    try{const attendees=[...new Set((detail.participants??[]).map(p=>p.displayName))];const mom=await generateMom(detail.transcript??[],attendees);await repository.saveMom(meetingId,mom);await repository.updateMeeting(meetingId,{status:'completed',endedAt:detail.endedAt??new Date().toISOString()})}
    catch(error){await repository.updateMeeting(meetingId,{status:'failed',failureCode:'ai_generation_failed',failureMessage:error instanceof Error?error.message:'MOM generation failed.'});throw error}return;
  }
  if(job.name==='purge-meeting'){await purgeMeetingContent(meetingId);return}
  if(job.name==='retention-sweep'){for(const meeting of await repository.expiredMeetings())await purgeMeetingContent(meeting.id);await repository.purgeOldUrls()}
}

const worker=new Worker('cloudcore-meetings',processJob,{connection:redisConnection,concurrency:2});
worker.on('failed',(job,error)=>console.error(JSON.stringify({level:'error',message:'meeting job failed',jobId:job?.id,jobName:job?.name,error:error.message})));
const sweep=async()=>processJob({name:'retention-sweep',data:{}} as Job);
await sweep();const timer=setInterval(()=>void sweep(),24*60*60*1000);timer.unref();
for(const signal of ['SIGTERM','SIGINT'] as const)process.on(signal,async()=>{clearInterval(timer);await worker.close();await repository.close();process.exit(0)});
