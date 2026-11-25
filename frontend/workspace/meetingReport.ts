import type { Meeting, Mom } from '../../src/models';
import { readMeetingMom } from './meetingMomModel';

type ReportMinutes = Partial<Omit<Mom, 'topics' | 'decisions'>> & {
  topics?: (Mom['topics'][number] | string)[];
  decisions?: (Mom['decisions'][number] | string)[];
};
type MeetingReport = Pick<Meeting, 'title' | 'createdAt'> & { mom?: ReportMinutes };

const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (value: unknown) => String(value).replace(/[&<>"']/g, character => entities[character] ?? character);

function meetingReportHtml(meeting: MeetingReport, showTopBar = false) {
  const mom = meeting.mom ?? {};
  const title = meeting.title && meeting.title !== 'Untitled meeting' ? meeting.title : 'Meeting Minutes';
  const reportDate=meeting.createdAt?new Date(meeting.createdAt).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):'Not specified';
  const summary=(mom.summary||'').trim()||'Not specified';
  const attendees=Array.isArray(mom.attendees)?mom.attendees.filter(Boolean):[];
  const attendeesHtml=attendees.length?attendees.map(a=>`<div class="mom-attendee-item">${esc(a)}</div>`).join(''):'<div class="mom-empty-text">Not specified</div>';
  const rawTopics=Array.isArray(mom.topics)?mom.topics:[];
  const topicsHtml=rawTopics.length?rawTopics.map((t,idx)=>{
    const tTitle=typeof t==='string'?t:(t.title||`Topic ${idx+1}`);
    const tNotes=typeof t==='string'?'':(t.notes||'');
    return `<div class="mom-topic-item"><div class="mom-topic-num">${idx+1}</div><div class="mom-topic-content"><div class="mom-topic-title">${esc(tTitle)}</div>${tNotes?`<div class="mom-topic-notes">${esc(tNotes)}</div>`:''}</div></div>`;
  }).join(''):'<div class="mom-empty-text">Not specified</div>';
  const rawDecisions=Array.isArray(mom.decisions)?mom.decisions:[];
  const decisionsHtml=rawDecisions.length?`<ul class="mom-bullets">${rawDecisions.map(d=>{const text=typeof d==='string'?d:(d.decision||'');return text?`<li>${esc(text)}</li>`:''}).join('')}</ul>`:'<div class="mom-empty-text">Not specified</div>';
  const rawActions=Array.isArray(mom.actionItems)?mom.actionItems:[];
  const actionItemsHtml=rawActions.length?rawActions.map(a=>{
    const task=a.task||'';
    const owner=a.owner||'Not specified';
    const dueDate=a.dueDate||'Not specified';
    return `<tr><td style="font-weight:500;">${esc(task)}</td><td>${esc(owner)}</td><td>${esc(dueDate)}</td></tr>`;
  }).join(''):'<tr><td colspan="3" class="mom-empty-text" style="padding:12px 14px;">Not specified</td></tr>';
  const rawRisks=Array.isArray(mom.risks)?mom.risks.filter(Boolean):[];
  const risksHtml=rawRisks.length?`<ul class="mom-bullets">${rawRisks.map(r=>`<li>${esc(r)}</li>`).join('')}</ul>`:'<div class="mom-empty-text">Not specified</div>';
  const rawQuestions=Array.isArray(mom.openQuestions)?mom.openQuestions.filter(Boolean):[];
  const questionsHtml=rawQuestions.length?`<ul class="mom-bullets">${rawQuestions.map(q=>`<li>${esc(q)}</li>`).join('')}</ul>`:'<div class="mom-empty-text">Not specified</div>';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Meeting Minutes - ${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
@page{size:A4 portrait;margin:14mm 14mm 14mm 14mm}
*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;box-sizing:border-box;margin:0;padding:0}
body{font-family:'Roboto',-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;background:${showTopBar?'#f1f5f9':'#ffffff'};color:#0f172a;font-size:13px;line-height:1.55;-webkit-font-smoothing:antialiased}
.mom-pdf-page{width:100%;max-width:780px;margin:${showTopBar?'24px auto 40px':'0 auto'};padding:24px;background:#ffffff;${showTopBar?'box-shadow:0 4px 20px rgba(0,0,0,0.08);border-radius:8px;':''}}
@media print{
body{background:#ffffff!important;margin:0!important}
.mom-pdf-page{max-width:100%!important;width:100%!important;margin:0!important;padding:0!important;box-shadow:none!important;border-radius:0!important}
.no-print{display:none!important}
.mom-card,.mom-two-col-unequal,.mom-two-col-equal,tr,.mom-topic-item{page-break-inside:avoid!important;break-inside:avoid!important}
}
.top-bar{position:sticky;top:0;background:#0f172a;color:#ffffff;padding:12px 24px;display:flex;justify-content:space-between;align-items:center;z-index:1000;box-shadow:0 2px 8px rgba(0,0,0,0.15);font-family:'Roboto',sans-serif}
.top-bar-left{display:flex;align-items:center;gap:10px;font-size:13px;font-weight:500}
.top-bar-left b{color:#22c55e;font-weight:700}
.top-bar-actions{display:flex;gap:10px}
.btn-print{background:#0a8740;color:#ffffff;border:none;padding:8px 16px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px}
.btn-print:hover{background:#087337}
.btn-close{background:transparent;color:#cbd5e1;border:1px solid #475569;padding:8px 14px;border-radius:6px;font-size:12px;cursor:pointer}
.btn-close:hover{background:#1e293b;color:#ffffff}
.mom-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:22px}
.mom-eyebrow{font-size:10.5px;font-weight:700;color:#486558;letter-spacing:1.6px;text-transform:uppercase;margin-bottom:6px}
.mom-accent-bar{width:44px;height:4.5px;background:#0a8740;border-radius:3px;margin-bottom:12px}
.mom-title{font-size:28px;font-weight:800;color:#0f172a;letter-spacing:-0.5px;line-height:1.15}
.mom-header-right{display:flex;align-items:center;gap:10px;padding-top:4px}
.mom-calendar-icon{display:flex;align-items:center}
.mom-report-meta{text-align:left}
.mom-meta-label{font-size:11.5px;color:#64748b;font-weight:500}
.mom-meta-val{font-size:11.5px;color:#64748b;font-weight:500}
.mom-card{border-radius:8px;padding:16px 20px;margin-bottom:16px}
.mom-card-head{display:flex;align-items:center;gap:12px;margin-bottom:12px}
.mom-badge{width:28px;height:28px;border-radius:50%;background:#0a8740;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#ffffff}
.mom-badge svg{width:15px;height:15px}
.mom-section-title{font-size:13px;font-weight:800;color:#0b3d1f;letter-spacing:0.8px;text-transform:uppercase}
.mom-summary-card{background:#f3f8f5;border:1px solid #dce8e0}
.mom-summary-text{font-size:12.5px;line-height:1.6;color:#334155}
.mom-two-col-unequal{display:grid;grid-template-columns:31% calc(69% - 16px);gap:16px;margin-bottom:16px}
.mom-white-card{background:#ffffff;border:1px solid #e2e8f0}
.mom-attendees-list{font-size:12.5px;color:#334155;line-height:1.6}
.mom-attendee-item{margin-bottom:4px}
.mom-empty-text{color:#64748b;font-size:12.5px}
.mom-topics-list{display:flex;flex-direction:column}
.mom-topic-item{display:flex;gap:14px;align-items:flex-start;padding:4px 0}
.mom-topic-item:not(:first-child){border-top:1px solid #f1f5f9;padding-top:14px;margin-top:10px}
.mom-topic-num{width:26px;height:26px;border-radius:50%;background:#e0f0e6;color:#0a8740;font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}
.mom-topic-content{flex:1}
.mom-topic-title{font-size:13.5px;font-weight:700;color:#0f172a;margin-bottom:4px}
.mom-topic-notes{font-size:12.5px;line-height:1.55;color:#475569}
.mom-bullets{padding-left:20px;margin:0}
.mom-bullets li{font-size:12.5px;line-height:1.6;color:#334155;margin-bottom:5px}
.mom-table{width:100%;border-collapse:collapse;margin-top:10px}
.mom-table th{background:#edf6f1;color:#0d4722;font-size:11px;font-weight:700;letter-spacing:0.6px;padding:9px 14px;text-align:left}
.mom-table td{padding:10px 14px;font-size:12.5px;color:#334155;border-top:1px solid #f1f5f9}
.mom-table tr:first-child td{border-top:none}
.mom-two-col-equal{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px}
.mom-footer{margin-top:24px;padding-top:14px;border-top:1.5px solid #0a8740;page-break-inside:avoid;break-inside:avoid}
.mom-footer-text{text-align:center;font-size:11.5px;font-weight:700;color:#0f172a}
</style>
</head>
<body>
${showTopBar?`
<div class="top-bar no-print">
  <div class="top-bar-left">
    <b>CloudCore AI</b> &nbsp;|&nbsp; Minutes of Meeting &mdash; ${esc(title)}
  </div>
  <div class="top-bar-actions">
    <button class="btn-print" onclick="window.print()">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
      Print / Save as PDF
    </button>
    <button class="btn-close" onclick="window.close()">Close</button>
  </div>
</div>`:''}
<div class="mom-pdf-page">
  <header class="mom-header">
    <div class="mom-header-left">
      <div class="mom-eyebrow">MINUTES OF MEETING</div>
      <div class="mom-accent-bar"></div>
      <h1 class="mom-title">Meeting Minutes</h1>
    </div>
    <div class="mom-header-right">
      <div class="mom-calendar-icon">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0a8740" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
      </div>
      <div class="mom-report-meta">
        <div class="mom-meta-label">Generated report</div>
        <div class="mom-meta-val">${esc(reportDate)}</div>
      </div>
    </div>
  </header>

  <section class="mom-card mom-summary-card">
    <div class="mom-card-head">
      <div class="mom-badge">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
        </svg>
      </div>
      <h2 class="mom-section-title">EXECUTIVE SUMMARY</h2>
    </div>
    <p class="mom-summary-text">${esc(summary)}</p>
  </section>

  <div class="mom-two-col-unequal">
    <section class="mom-card mom-white-card">
      <div class="mom-card-head">
        <div class="mom-badge">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
          </svg>
        </div>
        <h2 class="mom-section-title">ATTENDEES</h2>
      </div>
      <div class="mom-attendees-list">
        ${attendeesHtml}
      </div>
    </section>

    <section class="mom-card mom-white-card">
      <div class="mom-card-head">
        <div class="mom-badge">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z"/>
          </svg>
        </div>
        <h2 class="mom-section-title">TOPICS</h2>
      </div>
      <div class="mom-topics-list">
        ${topicsHtml}
      </div>
    </section>
  </div>

  <section class="mom-card mom-white-card">
    <div class="mom-card-head">
      <div class="mom-badge">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
      <h2 class="mom-section-title">DECISIONS</h2>
    </div>
    ${decisionsHtml}
  </section>

  <section class="mom-card mom-white-card">
    <div class="mom-card-head">
      <div class="mom-badge">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm-2 14l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
        </svg>
      </div>
      <h2 class="mom-section-title">ACTION ITEMS</h2>
    </div>
    <table class="mom-table">
      <thead>
        <tr>
          <th style="width:54%;">TASK</th>
          <th style="width:24%;">OWNER</th>
          <th style="width:22%;">DUE DATE</th>
        </tr>
      </thead>
      <tbody>
        ${actionItemsHtml}
      </tbody>
    </table>
  </section>

  <div class="mom-two-col-equal">
    <section class="mom-card mom-white-card">
      <div class="mom-card-head">
        <div class="mom-badge">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L1 21h22L12 2zm0 3.8L20.2 19H3.8L12 5.8zM11 10h2v4h-2v-4zm0 6h2v2h-2v-2z"/>
          </svg>
        </div>
        <h2 class="mom-section-title">RISKS</h2>
      </div>
      ${risksHtml}
    </section>

    <section class="mom-card mom-white-card">
      <div class="mom-card-head">
        <div class="mom-badge" style="font-weight:800;font-size:15px;font-family:sans-serif;">
          ?
        </div>
        <h2 class="mom-section-title">OPEN QUESTIONS</h2>
      </div>
      ${questionsHtml}
    </section>
  </div>

  <footer class="mom-footer">
    <div class="mom-footer-text">Report generated by PTCL Cloudcore AI</div>
  </footer>
</div>
</body>
</html>`;
}

function reportFromEditor(meeting: Meeting, form: HTMLFormElement | null): MeetingReport {
  return { ...meeting, mom: form ? readMeetingMom(form, meeting.mom) : meeting.mom };
}

function reportMarkdown({ title, mom }: MeetingReport) {
  if (!mom) return '';
  const bullets = (items: string[] = []) => items.map(item => `- ${item}`).join('\n');
  const topics = (mom.topics ?? []).map(topic => typeof topic === 'string' ? `**${topic}**`
    : `**${topic.title}**${topic.notes ? `: ${topic.notes}` : ''}`);
  const decisions = (mom.decisions ?? []).map(decision => typeof decision === 'string' ? decision : decision.decision);
  const actions = (mom.actionItems ?? []).map(({ task, owner, dueDate }) => `${task}${owner ? ` — ${owner}` : ''}${dueDate ? ` (${dueDate})` : ''}`);
  return [
    `# ${title || 'Meeting Minutes'}`,
    `## Summary\n${mom.summary ?? ''}`,
    `## Attendees\n${bullets(mom.attendees)}`,
    `## Topics\n${bullets(topics)}`,
    `## Decisions\n${bullets(decisions)}`,
    `## Action items\n${bullets(actions)}`,
    `## Risks\n${bullets(mom.risks)}`,
    `## Open questions\n${bullets(mom.openQuestions)}`,
  ].join('\n\n');
}

function writeReport(target: Window, html: string) {
  target.document.open();
  target.document.write(html);
  target.document.close();
}

function openPrintWindow(html: string) {
  const tab = window.open('', '_blank');
  if (!tab) return;
  writeReport(tab, html);
  setTimeout(() => { try { tab.focus(); tab.print(); } catch { /* The preview remains available for manual printing. */ } }, 300);
}

function printReport(report: MeetingReport) {
  const html = meetingReportHtml(report);
  let frame = document.querySelector<HTMLIFrameElement>('#mom-print-frame');
  if (!frame) {
    frame = document.createElement('iframe');
    frame.id = 'mom-print-frame';
    frame.title = 'Print meeting minutes';
    Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
    document.body.appendChild(frame);
  }
  const target = frame.contentWindow;
  if (!target) { openPrintWindow(html); return; }
  writeReport(target, html);
  setTimeout(() => {
    try { target.focus(); target.print(); }
    catch { openPrintWindow(html); }
  }, 250);
}

export async function copyMeetingReport(meeting: Meeting, form: HTMLFormElement | null) {
  await navigator.clipboard.writeText(reportMarkdown(reportFromEditor(meeting, form)));
}

export function downloadMeetingReport(meeting: Meeting, form: HTMLFormElement | null) {
  const blob = new Blob([reportMarkdown(reportFromEditor(meeting, form))], { type: 'text/markdown' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'meeting-mom.md';
  link.click();
  URL.revokeObjectURL(link.href);
}

export function openMeetingReport(meeting: Meeting, form: HTMLFormElement | null, preview = false) {
  const report = reportFromEditor(meeting, form);
  if (preview) {
    const tab = window.open('', '_blank');
    if (tab) { writeReport(tab, meetingReportHtml(report, true)); return; }
  }
  printReport(report);
}
