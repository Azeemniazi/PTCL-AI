import test from 'node:test';
import assert from 'node:assert/strict';
import { encryptMeetingUrl, decryptMeetingUrl } from '../build/crypto.js';
import { Repository, isHallucination } from '../build/repository.js';
import { momSchema, validateTeamsUrl } from '../build/validation.js';
import { reconcileMeetingStatus, TEAMS_BOT_NAME, vexaSegmentTimeMs, isAuthorizedAudioHost } from '../build/engine.js';
import { validateProductionConfig, config } from '../build/config.js';
import { meetingJobId } from '../build/jobs.js';

test('accepts supported Microsoft Teams meeting URLs',()=>{assert.equal(validateTeamsUrl('https://teams.microsoft.com/l/meetup-join/19%3ameeting_test?context=x'),'https://teams.microsoft.com/l/meetup-join/19%3ameeting_test?context=x');assert.equal(validateTeamsUrl('https://teams.microsoft.com/meet/1234567890123?p=abc'),'https://teams.microsoft.com/meet/1234567890123?p=abc');assert.equal(validateTeamsUrl('https://teams.live.com/meet/123456789'),'https://teams.live.com/meet/123456789')});
test('extracts Teams URLs from invitation and Markdown text',()=>{assert.equal(validateTeamsUrl('Join: https://teams.microsoft.com/meet/1234567890123?p=abc'),'https://teams.microsoft.com/meet/1234567890123?p=abc');assert.equal(validateTeamsUrl('[https://teams.microsoft.com/meet/1234567890123?p=abc](https://teams.microsoft.com/meet/1234567890123?p=abc "Meeting join")'),'https://teams.microsoft.com/meet/1234567890123?p=abc');assert.equal(validateTeamsUrl('Join:&#x20;https://teams.microsoft.com/meet/1234567890123?p=abc'),'https://teams.microsoft.com/meet/1234567890123?p=abc')});
test('rejects non-Teams and credentialed URLs',()=>{for(const value of ['https://example.com/l/meetup-join/x','http://teams.microsoft.com/l/meetup-join/x','https://user:pass@teams.microsoft.com/l/meetup-join/x','https://teams.microsoft.com/not-a-meeting'])assert.throws(()=>validateTeamsUrl(value))});
test('encrypts meeting links with authenticated encryption',()=>{const value='https://teams.microsoft.com/l/meetup-join/test';const encrypted=encryptMeetingUrl(value);assert.notEqual(encrypted,value);assert.equal(decryptMeetingUrl(encrypted),value)});
test('validates the structured MOM contract',()=>{const mom={summary:'Weekly review',attendees:['Ali'],topics:[{title:'Launch',notes:'Ready',timestampMs:1000}],decisions:[{decision:'Ship',timestampMs:1200}],actionItems:[{task:'Deploy',owner:'Ali'}],risks:[],openQuestions:[]};assert.deepEqual(momSchema.parse(mom),mom);assert.throws(()=>momSchema.parse({summary:'Incomplete'}))});
test('normalizes Vexa absolute transcript timestamps to meeting-relative milliseconds',()=>{const meetingStart='2026-09-23T06:51:30.275Z';assert.equal(vexaSegmentTimeMs(1790146303.104,'2026-09-23T06:51:43.104Z',meetingStart),12829);assert.equal(vexaSegmentTimeMs(1790146306.176,'2026-09-23T06:51:46.176Z',meetingStart),15901);assert.equal(vexaSegmentTimeMs(12.5,undefined,undefined),12500)});
test('does not downgrade a completed meeting back to processing',()=>{assert.equal(reconcileMeetingStatus('completed','processing'),undefined);assert.equal(reconcileMeetingStatus('recording','processing'),'processing')});
test('uses the Teams-safe PTCL bot identity',()=>{assert.equal(TEAMS_BOT_NAME,'PTCL AI NOTETAKER')});
test('creates a fresh MOM job id for every regeneration',()=>{const first=meetingJobId('finalize-meeting','meeting-1'),second=meetingJobId('finalize-meeting','meeting-1');assert.notEqual(first,second);assert.equal(meetingJobId('purge-meeting','meeting-1'),'purge-meeting-meeting-1')});
test('enforces meeting ownership and active capacity in the repository',async()=>{const repository=new Repository();const owner=await repository.upsertUser({tenantId:'t',objectId:'one',email:'one@example.com',displayName:'One',role:'member'}),other=await repository.upsertUser({tenantId:'t',objectId:'two',email:'two@example.com',displayName:'Two',role:'member'});const meeting=await repository.createMeeting({ownerId:owner.id,encryptedUrl:'encrypted',botName:'Bot',consentedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString()});assert.equal(await repository.activeCount(),1);assert.equal((await repository.getMeeting(meeting.id,owner))?.id,meeting.id);assert.equal(await repository.getMeeting(meeting.id,other),undefined);await repository.updateMeeting(meeting.id,{status:'completed'});assert.equal(await repository.activeCount(),0)});
test('rejects dev auth mode in production environment',()=>{const origEnv=config.nodeEnv,origAuth=config.authMode;try{config.nodeEnv='production';config.authMode='dev';assert.throws(()=>validateProductionConfig(),/AUTH_MODE cannot be 'dev' in production environment/)}finally{config.nodeEnv=origEnv;config.authMode=origAuth}});
test('validates audio proxy destination host and blocks unauthorized and metadata hosts',()=>{assert.equal(isAuthorizedAudioHost('169.254.169.254'),false);assert.equal(isAuthorizedAudioHost('attacker-host.com'),false);if(config.vexa.baseUrl){const host=new URL(config.vexa.baseUrl).host;assert.equal(isAuthorizedAudioHost(host),true)}});
test('identifies and filters silence hallucinations',()=>{
  assert.equal(isHallucination('Thank you very much.'),true);
  assert.equal(isHallucination('thank you.'),true);
  assert.equal(isHallucination('Obrigado.'),true);
  assert.equal(isHallucination('Subtitles by the Amara.org community'),true);
  assert.equal(isHallucination('Thanks for watching!'),true);
  assert.equal(isHallucination('We have discussed the deployment schedule for Monday.'),false);
});
test('deduplicates progressive transcript windows and repetition loops in repository',async()=>{
  const repository=new Repository();
  const owner=await repository.upsertUser({tenantId:'t',objectId:'u1',email:'u1@example.com',displayName:'U1',role:'admin'});
  const meeting=await repository.createMeeting({ownerId:owner.id,encryptedUrl:'encrypted',botName:'Bot',consentedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString()});
  const meetingId=meeting.id;
  // Hallucination should be ignored
  const h=await repository.addTranscript({meetingId,startMs:0,endMs:2000,text:'Thank you very much.'});
  assert.equal(h,undefined);
  // Initial partial window
  await repository.addTranscript({meetingId,startMs:1000,endMs:3000,text:'I think'});
  // Extended completed window starting at same time
  await repository.addTranscript({meetingId,startMs:1000,endMs:5000,text:'I think we should proceed with the deployment'});
  // Duplicate repetition within 15 seconds
  const dup=await repository.addTranscript({meetingId,startMs:6000,endMs:9000,text:'I think we should proceed with the deployment'});
  assert.equal(dup,undefined);
  // Valid subsequent segment
  await repository.addTranscript({meetingId,startMs:20000,endMs:24000,text:'Agreed, lets move forward.'});

  const detail=await repository.getMeetingDetail(meetingId);
  assert.equal(detail.transcript.length,2);
  assert.equal(detail.transcript[0].text,'I think we should proceed with the deployment');
  assert.equal(detail.transcript[0].endMs,5000);
  assert.equal(detail.transcript[1].text,'Agreed, lets move forward.');
});

test('caps ordinary replies to 350 tokens and allows longer replies when requested', async () => {
  const { resolveReplyMaxTokens } = await import('../build/ai.js');
  assert.equal(resolveReplyMaxTokens('What is the deadline?'), 350);
  assert.equal(resolveReplyMaxTokens('Summarize what he said'), 350);
  assert.equal(resolveReplyMaxTokens('Give me a detailed step-by-step architecture breakdown'), 750);
  assert.equal(resolveReplyMaxTokens('Provide a comprehensive report', 900), 900);
});

test('consolidates adjacent speaker turns and compresses long transcripts for MOM', async () => {
  const { consolidateTranscript, buildCompactMomInput } = await import('../build/ai.js');
  const raw = [
    { id: '1', meetingId: 'm1', speakerName: 'Ali', startMs: 1000, endMs: 3000, text: 'Assalam o Alaikum team.', createdAt: '' },
    { id: '2', meetingId: 'm1', speakerName: 'Ali', startMs: 4000, endMs: 7000, text: 'We decided to launch CloudCore on Friday.', createdAt: '' },
    { id: '3', meetingId: 'm1', speakerName: 'Fatima', startMs: 8000, endMs: 11000, text: 'Agreed, I will follow up on firewall rules by Thursday.', createdAt: '' }
  ];
  const merged = consolidateTranscript(raw);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].text, 'Assalam o Alaikum team. We decided to launch CloudCore on Friday.');

  const longSegments = Array.from({ length: 80 }, (_, i) => ({
    id: String(i),
    meetingId: 'm1',
    speakerName: i % 2 === 0 ? 'Ali' : 'Fatima',
    startMs: i * 12000,
    endMs: i * 12000 + 5000,
    text: i === 10 ? 'We agreed and decided to finalize the SLA by Monday.' : `Discussion segment number ${i} regarding server metrics and network routing.`,
    createdAt: ''
  }));
  const fullJsonLen = JSON.stringify({ attendees: ['Ali', 'Fatima'], transcript: longSegments }).length;
  const compactStr = buildCompactMomInput(longSegments, ['Ali', 'Fatima']);
  assert.ok(compactStr.length < fullJsonLen * 0.55, `Expected compact input (${compactStr.length}) to be < 55% of full JSON (${fullJsonLen})`);
  assert.ok(compactStr.includes('120000ms'), 'Expected earlier decision timestamp to be preserved');
});

test('tracks in-flight MOM jobs to prevent duplicate background finalization', async () => {
  const { isMomInFlight, markMomInFlight, clearMomInFlight } = await import('../build/jobs.js');
  clearMomInFlight('m-test');
  assert.equal(isMomInFlight('m-test'), false);
  assert.equal(markMomInFlight('m-test'), true);
  assert.equal(isMomInFlight('m-test'), true);
  assert.equal(markMomInFlight('m-test'), false);
  clearMomInFlight('m-test');
  assert.equal(isMomInFlight('m-test'), false);
});

