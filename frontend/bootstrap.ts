import { currentPipMode, pipActivity } from './workspace/Pip';
import { answerPipHelp, getPipHelp } from './workspace/pipHelp';
import type { PipChatProps } from './workspace/PipChat';
import type { Notification as WorkspaceNotification } from './workspace/SharedDialogs';
import { publicPages } from './public';
import { workspacePages } from './workspace';
import { imageStudioPages } from './studio';
import { createStudioController } from './studio/controller';
import { createSessionClient } from './shared/session';
import { streamChatReply } from './shared/chatStream';
import { createHashRouter } from './workspace/router';
import { indexAssistantDocument } from './workspace/documentIndex';
import { createMeetingsController } from './workspace/meetingsController';
import { createKnowledgeController } from './workspace/knowledgeController';
import { createAssistantController } from './workspace/assistantController';
import { backgroundMarkup, createWorkspaceTheme, formatBytes, getFolderIconKey } from './workspace/theme';

type AppSettings = import('./workspace/Settings').SettingsProps;
type AppUser = AppSettings['user'];
type AppMessage = import('./workspace/Assistant').AssistantMessage;
type AppMeetingTab = import('./workspace/MeetingDetail').MeetingTab;
type AppMeetingDestination = import('./workspace/MeetingsList').MeetingDestination;
type AppSharedDialog = import('./workspace/SharedDialogs').SharedDialogProps;
type DialogContent<T = AppSharedDialog> = T extends AppSharedDialog ? Omit<T, 'onClose'> : never;

const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector);
function errorMessage(error: unknown) { return error instanceof Error ? error.message : String(error); }
let toastTimer: ReturnType<typeof setTimeout> | undefined;
function toast(text: string) {
  const element = $('#toast');
  if (!element) return;
  element.textContent = text;
  const success = /\b(saved|copied|indexed|ready|created|uploaded|complete|completed|success|successfully|updated|renamed|moved|deleted|exported|cleared)\b/i.test(text);
  element.classList.remove('cc-toast-success');
  if (success) {
    void element.offsetWidth;
    element.classList.add('cc-toast-success');
  }
  element.classList.add('show');
  const hide = () => element.classList.remove('show', 'cc-toast-success');
  element.onclick = hide;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hide, 2800);
}

function closeDialogSmooth(dialog: HTMLDialogElement | null) {
  if (!dialog?.open) return;
  if (document.documentElement.classList.contains('cc-reduced-motion')) { dialog.close(); return; }
  if (dialog.classList.contains('cc-closing')) return;
  dialog.classList.add('cc-closing');
  const finish = () => {
    if (!dialog.classList.contains('cc-closing')) return;
    dialog.removeEventListener('animationend', finish);
    dialog.classList.remove('cc-closing');
    if (dialog.open) dialog.close();
  };
  dialog.addEventListener('animationend', finish, { once: true });
  setTimeout(finish, 175);
}

function prepareWorkspaceRoute(meetingId: string | null){
  pipTrigger=null;
  pipKnowledgeDocument=undefined;
  notificationView++;
  selectedMeetingId=meetingId;
  publicPages.unmountPasswordChange();
  workspacePages.unmount();
  imageStudioPages.unmount();
  workspacePages.unmountShell();
}
function renderPublicRoute(page: Parameters<typeof publicPages.mount>[1]){
  knowledgeController.navigate();
  meetingController.navigate();
  ImageStudio.pause();
  const host = $('#app');
  if (host) publicPages.mount(host,page,Boolean(appUser),completeLogin,workspaceTheme.syncMotion);
}
function renderWorkspaceRoute(page: string, {url,consent}: {url?: string; consent?: boolean}){
  const host = $('#app');
  const user = appUser;
  if (!host || !user) return;
  publicPages.unmount();
  workspacePages.mountShell(host,{
    route:page,hasMessages:Boolean(assistantState.messages.length),hasMeetingSelection:Boolean(selectedMeetingId),
    onDocumentSelected:selectDocument,onImageSelected:selectImage,onCloseDialog:closeDialogSmooth,
    onOpenPipChat:openPipChat,
  });
  // The motion controller can move cached videos between routes to keep playback continuous.
  $('#workspace-sidebar')?.insertAdjacentHTML('afterbegin',backgroundMarkup('sidebar'));
  $('.ref-assistant-empty .workspace-body')?.insertAdjacentHTML('afterbegin',backgroundMarkup('assistant'));
  bind();
  renderMeetingsList(url,consent);
  renderMeetingDetail();
  renderAssistant();
  if(page==='settings'){
    const section=new URLSearchParams(location.hash.split('?')[1]).get('tab');
    if(section==='account'||section==='preferences'||section==='security'||section==='integrations')settingsTab=section;
  }
  renderSettings();
  renderKnowledge();
  restoreKnowledgeLocation();
  startNotificationFeed(user.id);
  renderWorkspaceHeader();
  renderWorkspaceSidebar();
  const reactPage=$('#workspace-react-page');
  if(reactPage){
    workspacePages.mount(reactPage,{
      chats:assistantState.chats,
      name:user.displayName,
      document:docFile?{name:docFile.name,indexed:docIngested}:undefined,
      query:historySearch,
      onQuery:value=>{historySearch=value;},
      onOpen:openConversation,
      onDelete:confirmDeleteConversation,
    });
  }
  knowledgeController.navigate();
  if(page==='images'){
    ImageStudio.mount();
    void reviewNotifiedImageJob();
  }
  else ImageStudio.pause();
}
function bind(){
  meetingController.navigate();
  workspaceTheme.syncMotion();
  const { scope, folderId, page, filter, documents } = knowledgeState;
  workspaceTheme.decorate(assistantState.messages.length, knowledgeChatMessages.length, `${scope}|${folderId ?? ''}|${page}|${filter}|${documents.length}`);
}
function searchWorkspace(query: string){
  const normalized=query.toLowerCase();
  const match=navs.find(([id,,name])=>id===normalized||name.toLowerCase()===normalized);
  if(match)location.hash=match[0];
  else sendMessage(query);
}
function renderWorkspaceHeader(){
  const header=$('#workspace-react-header');
  if(!header)return;
  workspacePages.mountHeader(header,{
    unread:appNotifications.some(entry=>entry.unread),onImportStatus:workspacePages.hasKnowledgeImport()?workspacePages.reopenKnowledgeImport:undefined,showNewChat:header.dataset.page==='assistant',
    onToggleMenu:()=>$('#workspace-sidebar')?.classList.toggle('mobile-open') ?? false,
    onSearch:searchWorkspace,onNotifications:()=>void openNotificationsModal(),onNewChat:newConversation,
  });
}
function renderWorkspaceSidebar(){
  const sidebar=$('#workspace-react-sidebar');
  if(!sidebar)return;
  const page=sidebar.dataset.page ?? 'home';
  const shell=sidebar.closest<HTMLElement>('.ref-workspace');
  let saved: string | null = null;
  try { saved=localStorage.getItem('cloudcore.sidebar'); } catch { /* Use the route default. */ }
  const compact=saved ? saved==='compact' : page==='documents'||page==='knowledge';
  if(shell)shell.dataset.compactSidebar=String(compact);
  workspacePages.mountSidebar(sidebar,{
    compact,onToggleCompact:()=>{
      try { localStorage.setItem('cloudcore.sidebar',compact?'expanded':'compact'); } catch { return; }
      renderWorkspaceSidebar();
    },
    page:sidebar.dataset.page ?? 'home',displayName:appUser?.displayName,role:appUser?.role,
    onProfile:openProfileModal,
  });
}
let docFile: File | null = null, imageFile: File | null = null, imageURL = '', historySearch = '';
let selectedMeetingId: string | null = null, meetingTab: AppMeetingTab = 'overview';
let meetingChats: Record<string, AppMessage[]> = {}, meetingChatLoading = false;
let docIngesting=false,docIngested=false,activeDocUploadPromise: Promise<void> | null = null,attachContext='',chatImageAttached=false,pendingDocAutoPrompt='',pendingImageAutoPrompt='';
let settingsTab: AppSettings['tab']='account',settingsScrollToUsers=false;
let userPrefs: AppSettings['prefs']={motionMode:'auto',responseStyle:'balanced',autoRag:'on',notifications:'on'};
try{const savedPrefs=JSON.parse(localStorage.getItem('cloudcore-prefs')||'null');if(savedPrefs&&typeof savedPrefs==='object')userPrefs={...userPrefs,...savedPrefs}}catch{}
function saveUserPrefs(){try{localStorage.setItem('cloudcore-prefs',JSON.stringify(userPrefs))}catch{}}
function switchSettingsTab(tab: AppSettings['tab'], scrollToUsers=false){
  settingsTab=tab||'account';
  settingsScrollToUsers=scrollToUsers;
  if(location.hash!=='#settings')location.hash='settings';
  else renderSettings();
}
function updatePreference<K extends keyof AppSettings['prefs']>(key: K, value: AppSettings['prefs'][K]){
  if(!Object.hasOwn(userPrefs,key))return;
  userPrefs[key]=value;
  saveUserPrefs();
  workspaceTheme.syncMotion();
  renderSettings();
  toast('Preference saved.');
}
function renderSettings(){
  const host=$('#workspace-react-settings');
  if(!host||!appUser)return;
  workspacePages.mountSettings(host,{
    user:appUser,tab:settingsTab,scrollToUsers:settingsScrollToUsers,prefs:{...userPrefs},capacity:meetingsState.capacity,
    document:docFile?{name:docFile.name,indexed:docIngested}:undefined,
    conversationCount:assistantState.chats.length,messageCount:assistantState.chats.reduce((sum,chat)=>sum+(chat.messages?.length||0),0),
    request:api,onTab:switchSettingsTab,onPreference:updatePreference,onSignOut:handleSignOut,
    notify:message=>toast(message),
    onProfile:user=>{appUser=user;renderWorkspaceSidebar();renderSettings();},
    onCapacity:capacity=>{meetingsState.capacity=capacity;renderSettings();},
    onExport:exportConversations,onClear:confirmClearConversations,
  });
  renderPipChat();
}

// ==========================================
// KNOWLEDGE HUB CLIENT STATE & METHODS
// ==========================================
let knowledgeChatMessages: AppMessage[] = [], knowledgeChatLoading = false;
let knowledgeChatRequest: AbortController | null = null, knowledgeUserId: string | undefined;
let pipKnowledgeDocument: { id: string; filename: string } | undefined;
let knowledgeImportReview: string[] | undefined;

function setPipKnowledgeDocument(document?: typeof pipKnowledgeDocument){
  pipKnowledgeDocument=document;
  renderPipChat();
}

function resetKnowledgeSession(){
  pipKnowledgeDocument=undefined;
  knowledgeImportReview=undefined;
  workspacePages.closeKnowledgeImport();
  knowledgeController.reset();
  knowledgeChatRequest?.abort();
  knowledgeChatRequest=null;
  knowledgeChatMessages=[];
  knowledgeChatLoading=false;
}
function renderKnowledge(){
  const host=$('#workspace-react-knowledge');
  if(!host||!appUser||!knowledgeController)return;
  if(knowledgeUserId!==appUser.id){
    resetKnowledgeSession();
    knowledgeUserId=appUser.id;
    restoreKnowledgeLocation();
  }
  const {documents,folders,selected,page,search,filter,busy,error,folderId,scope}=knowledgeState;
  workspacePages.updateKnowledgeImportFolders(scope, folders);
  workspacePages.mountKnowledge(host,{
    documents,folders,selected:new Set(selected),page,search,filter,busy,error,
    range:knowledgeState.range,sort:knowledgeState.sort,onRange:knowledgeController.setRange,onSort:knowledgeController.setSort,
    userId:appUser.id,canManage:appUser.role==='admin'||appUser.role==='dev',
    filingImportIds:knowledgeImportReview,
  activeFolder:folders.find(folder=>folder.id===folderId),
    folderIcon:getFolderIconKey,formatBytes:formatBytes,scope,name:appUser.displayName,request:api,onFolderChanged:knowledgeFolderChanged,
    onDocumentsChanged:(message,ids)=>{for(const id of ids)selected.delete(id);toast(message);loadKnowledge();},
    chatBusy:knowledgeChatLoading,messages:knowledgeChatMessages.map(message=>({...message})),
    onRefresh:()=>loadKnowledge(true),onSearch:knowledgeController.search,onFilter:knowledgeController.setFilter,
    onPage:knowledgeController.setPage,onSelect:knowledgeController.toggleDocument,onSelectPage:knowledgeController.togglePage,
    onScope:switchKnowledgeScope,onFolder:selectKnowledgeFolder,
    onImport:(initialFolder,initialSource)=>workspacePages.openKnowledgeImport({
      folders,scope,initialFolder,initialSource,request:api,formatBytes,
      onReview:appUser?.role==='dev'||appUser?.role==='admin' ? ids=>{
        workspacePages.closeKnowledgeImport();
        knowledgeImportReview=ids;
        if(onKnowledgeRoute())renderKnowledge();
        else location.hash='documents?scope=shared';
      } : undefined,
      onChanged:message=>{
        toast(message);
        void refreshNotifications();
        if(onKnowledgeRoute())void loadKnowledge();
        else knowledgeState.loaded=false;
      },
      onOpenFolder:(id,isShared)=>{
        const targetScope=scope==='all'?'all':isShared?'shared':'personal';
        if(onKnowledgeRoute())setKnowledgeLocation(targetScope,id);
        else location.hash='documents?'+new URLSearchParams({scope:targetScope,folder:id});
      },
    }),
    onDeselect:()=>{selected.clear();renderKnowledge();},
    onAsk:sendKnowledgeChatMessage,onClear:clearKnowledgeChat,onPipDocument:setPipKnowledgeDocument,
  });
  renderPipChat();
}
function onKnowledgeRoute(){return /^#(?:documents|knowledge)(?:[?/]|$)/.test(location.hash);}
function restoreKnowledgeLocation(){
  if(!onKnowledgeRoute())return;
  const params=new URLSearchParams(location.hash.split('?')[1]);
  const scope=params.get('scope');
  const folderId=params.get('folder');
  const nextScope=scope==='personal'||scope==='all'?scope:'shared';
  if(nextScope!==knowledgeState.scope||folderId!==knowledgeState.folderId){
    pipKnowledgeDocument=undefined;
    if(knowledgeChatMessages.length)clearKnowledgeChat(false);
    knowledgeController.restoreLocation(nextScope,folderId);
  }
}
function knowledgeFolderChanged(message: string, removedId?: string){
  toast(message);
  if(removedId&&knowledgeState.folderId===removedId)selectKnowledgeFolder(null);
  else loadKnowledge();
}

function loadKnowledge(showToast=false){return knowledgeController.load(showToast);}

let knowledgeQuestionScope = '';
function knowledgeChatScope(documentId?: string){
  return documentId?{mode:'document' as const,id:documentId}:
    knowledgeState.folderId?{mode:'folder' as const,id:knowledgeState.folderId}:undefined;
}
function knowledgeChatKey(scope: ReturnType<typeof knowledgeChatScope>){
  return scope ? scope.mode + '/' + scope.id : 'all';
}
async function sendKnowledgeChatMessage(text: string, documentId?: string){
  text=(text||'').trim();
  if(!text||knowledgeChatRequest||!appUser)return;
  const controller=new AbortController(),owner=appUser.id;
  knowledgeChatRequest=controller;
  const current=()=>knowledgeChatRequest===controller&&!controller.signal.aborted&&appUser?.id===owner;
  const scope=knowledgeChatScope(documentId);
  const key=knowledgeChatKey(scope);
  if(key!==knowledgeQuestionScope){knowledgeChatMessages=[];knowledgeQuestionScope=key;}
  const history=knowledgeChatMessages.filter(message=>typeof message.content==='string'&&message.content.trim()).slice(-6)
    .map(({role,content})=>({role,content:content.trim()}));
  const answer: AppMessage={role:'assistant',content:'',streaming:true,citations:[]};
  knowledgeChatMessages.push({role:'user',content:text},answer);
  knowledgeChatLoading=true;
  pipActivity('searching');
  renderKnowledge();

  try{
    await streamChatReply('/api/chat?stream=true',{
      message:text,history,use_rag:true,rag_scope:scope,stream:true,
    },answer,()=>{if(current())renderKnowledge();},{signal:controller.signal});
  }catch(error){
    if(current())answer.content=`Knowledge search error: ${errorMessage(error)}`;
  }finally{
    if(current()){
      delete answer.streaming;
      knowledgeChatLoading=false;
      pipActivity('idle');
      knowledgeChatRequest=null;
      renderKnowledge();
    }
  }
}
function clearKnowledgeChat(announce=true){
  pipActivity('idle');
  knowledgeChatRequest?.abort();
  knowledgeChatRequest=null;
  knowledgeChatMessages=[];
  knowledgeChatLoading=false;
  renderKnowledge();
  if(announce)toast('Knowledge chat cleared.');
}
function switchKnowledgeScope(scope: 'shared' | 'personal' | 'all'){
  setKnowledgeLocation(scope,null);
}
function selectKnowledgeFolder(id: string | null){setKnowledgeLocation(knowledgeState.scope,id);}
function setKnowledgeLocation(scope: 'shared' | 'personal' | 'all', folderId: string | null){
  const params=new URLSearchParams();
  if(scope!=='shared')params.set('scope',scope);
  if(folderId)params.set('folder',folderId);
  const route=location.hash.split('?')[0] || '#documents';
  const hash=route+(params.size?'?'+params:'');
  if(hash!==location.hash)history.pushState(null,'',hash);
  restoreKnowledgeLocation();
}

let appNotifications: WorkspaceNotification[]=[];
let notificationOwner: string | undefined;
let notificationRead: AbortController | undefined;
let notificationTimer: number | undefined;
let notificationView = 0;

async function refreshNotifications(){
  if(!appUser||notificationOwner!==appUser.id)return;
  notificationRead?.abort();
  const controller=new AbortController();
  notificationRead=controller;
  try {
    const result=await api<{entries?: WorkspaceNotification[]}>('/api/notifications',{signal:controller.signal});
    if(controller.signal.aborted)return;
    appNotifications=Array.isArray(result.entries)?result.entries:[];
    renderWorkspaceHeader();
  } finally {
    if(notificationRead===controller)notificationRead=undefined;
  }
}
function startNotificationFeed(userId: string){
  if(notificationOwner===userId)return;
  stopNotificationFeed();
  notificationOwner=userId;
  void refreshNotifications().catch(()=>{});
  notificationTimer=window.setInterval(()=>{
    if(!document.hidden)void refreshNotifications().catch(()=>{});
  },30000);
}
function stopNotificationFeed(){
  notificationRead?.abort();
  window.clearInterval(notificationTimer);
  notificationOwner=undefined;
  notificationView++;
  appNotifications=[];
}
async function updateNotifications(action: 'read' | 'clear', entries: WorkspaceNotification[]){
  const owner=appUser?.id;
  const ids=entries.map(entry=>entry.id);
  if(ids.length)await api('/api/notifications/'+action,{method:'POST',body:JSON.stringify({ids})});
  if(!owner||appUser?.id!==owner)return;
  if(action==='clear')appNotifications=[];
  else appNotifications=appNotifications.map(entry=>ids.includes(entry.id)?{...entry,unread:false}:entry);
  renderWorkspaceHeader();
}
async function openNotificationsModal(){
  const view=++notificationView;
  const current=()=>view===notificationView&&Boolean(appUser);
  const display=(error?: string)=>showWorkspaceDialog({kind:'notifications',entries:appNotifications,error,onClear:()=>{
    void updateNotifications('clear',appNotifications).then(()=>{if(current())display();})
      .catch(()=>{if(current())display('Notifications could not be cleared. Try again.');});
  }});
  display();
  try {
    await refreshNotifications();
    if(!current())return;
    display();
    await updateNotifications('read',appNotifications.filter(entry=>entry.unread));
    if(current())display();
  } catch {
    if(current())display('Notifications could not be refreshed. Try again.');
  }
}
let appUser: AppUser | null = null;
async function reviewNotifiedImageJob(){
  const hash=location.hash;
  const id=new URLSearchParams(hash.split('?')[1]).get('job');
  const owner=appUser?.id;
  if(!id||!owner)return;
  const current=()=>location.hash===hash&&appUser?.id===owner;
  try{
    const {job}=await api<{job:{status:string;asset?:{url:string;prompt:string};error?:string}}>('/api/images/jobs/'+encodeURIComponent(id));
    if(!current())return;
    if(job.asset?.url)openImageLightbox(job.asset.url,job.asset.prompt);
    else toast(job.error||'Image job status: '+job.status);
  }catch(error){if(current())toast(errorMessage(error));}
}
const navs=[['home','home','Home'],['assistant','chat','AI Assistant'],['meetings','video','Meetings AI'],['documents','folder','Knowledge Hub'],['images','image','Image Studio'],['history','history','Chat History']] as const;
function openImageLightbox(url: string, prompt: string){
  if(!url)return;
  const found=ImageStudio.findAsset(url,prompt);
  showWorkspaceDialog({
    kind:'image',url,description:prompt||'',
    onUsePrompt:prompt?()=>{
      closeWorkspaceDialog();
      ImageStudio.usePrompt(prompt, {style:found?.style||'corporate',aspectRatio:found?.aspectRatio||'1:1',seed:found?.seed});
      toast('Prompt loaded into studio.');
    }:undefined,
  });
}
const activeMeetingStatuses=['launching','lobby','joined','recording','stopping','processing'];
function statusText(status: string){return({launching:'Starting bot',lobby:'Waiting in lobby',joined:'Joined',recording:'Recording',stopping:'Stopping',processing:'Preparing MOM',completed:'Completed',failed:'Needs attention',deleted:'Deleted'})[status]||status}
function formatMeetingTime(ms: number){const total=Math.max(0,Math.floor(ms/1000)),minutes=Math.floor(total/60);return `${String(minutes).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`}
async function sendMeetingChat(meetingId: string, prompt: string){
  prompt=(prompt||'').trim();
  if(!prompt||meetingChatLoading)return;
  const history=meetingChats[meetingId]??(meetingChats[meetingId]=[]);
  const prior=history.filter(message=>message?.content).slice(-8).map(({role,content})=>({role,content}));
  const answer: AppMessage={role:'assistant',content:'',streaming:true};
  history.push({role:'user',content:prompt},answer);
  meetingChatLoading=true;
  const current=()=>meetingChats[meetingId]===history;
  const visible=()=>current()&&selectedMeetingId===meetingId&&location.hash.startsWith('#meetings/');
  const renderChat=()=>{
    if(!visible())return;
    renderMeetingDetail();
  };
  renderChat();
  try{
    await streamChatReply(`/api/meetings/${encodeURIComponent(meetingId)}/chat?stream=true`,{
      message:prompt,history:prior,
    },answer,renderChat,{emptyReply:'No answer returned from AI.'});
  }catch(error){
    answer.content=`Error: ${errorMessage(error)}`;
  }finally{
    delete answer.streaming;
    if(current()){
      meetingChatLoading=false;
      renderChat();
      meetingController.schedule();
    }
  }
}
async function api<T>(path: string, options: RequestInit = {}): Promise<T>{
  return workspaceSession.request<T>(path,options);
}
function refreshMeetings(force=false){return meetingController.refresh(force);}
function closeWorkspaceDialog(){
  notificationView++;
  workspacePages.closeSharedDialog();
}
function showWorkspaceDialog(data: DialogContent){
  const host=$('#workspace-shared-dialog');
  if(!host)return;
  const dialog = $<HTMLDialogElement>('#dialog');
  if (dialog?.open) dialog.close();
  workspacePages.mountSharedDialog(host,{...data,onClose:closeWorkspaceDialog});
}
function modal(content: string, {uncloseable=false}={}){
  closeWorkspaceDialog();
  workspacePages?.unmountMeetingLaunch();
  const dialog = $<HTMLDialogElement>('#dialog');
  const target = $('#dialog-content');
  if (!dialog || !target) return;
  target.innerHTML = content;
  const closeButton = $('.dialog-close');
  if (closeButton) closeButton.style.display = uncloseable ? 'none' : 'block';
  dialog.classList.remove('cc-closing');
  dialog.classList.toggle('uncloseable', uncloseable);
  dialog.oncancel = uncloseable ? event => event.preventDefault() : null;
  dialog.showModal();
}

function meetingLaunchProps(){
  return {capacity:meetingsState.capacity,loading:meetingsState.launching,error:meetingsState.error,onSubmit:(form: HTMLFormElement)=>meetingController.launch(form)};
}
function renderMeetingDetail(){
  const host=$('#workspace-react-meeting-detail');
  if(!host)return false;
  const id=selectedMeetingId;
  if (!id) return false;
  const controller = meetingController;
  const meeting=meetingsState.detail?.id===id?meetingsState.detail:null;
  workspacePages.mountMeetingDetail(host,{
    meeting,tab:meetingTab,error:meetingsState.error,status:meeting?statusText(meeting.status):'',
    active:Boolean(meeting && activeMeetingStatuses.includes(meeting.status)),chat:(meetingChats[id]||[]).map(message=>({...message})),
    chatBusy:meetingChatLoading,formatTime:formatMeetingTime,
    onTab:tab=>{meetingTab=tab;renderMeetingDetail();},
    onStop:()=>controller.command(id,'stop'),
    onDelete:()=>{if(window.confirm('Permanently delete this meeting and all of its audio, transcript, snapshots and MOM?'))controller.command(id,'delete');},
    onCapture:()=>controller.captureSnapshot(id),onChat:prompt=>sendMeetingChat(id,prompt),
    momActions:{
      onGenerate:()=>controller.command(id,'regenerate'),
      onSave:form=>{if (meeting) void controller.saveMom(meeting,form);},
      notify:toast,
    },
  });
  renderPipChat();
  return true;
}
function openMeetingLaunch(){
  modal('<div id="workspace-react-meeting-launch"></div>');
  renderMeetingLaunch();
}
function renderMeetingLaunch(draftUrl?: string, draftConsent?: boolean){
  const host=$('#dialog[open] #workspace-react-meeting-launch');
  if(host)workspacePages.mountMeetingLaunch(host,{...meetingLaunchProps(),draftUrl,draftConsent});
}
function goToMeeting(id: string, destination: AppMeetingDestination = 'overview'){
  meetingTab=destination;
  meetingsState.detail=null;
  const hash=`#meetings/${encodeURIComponent(id)}`;
  if(location.hash===hash)route();
  else location.hash=hash;
}
function renderMeetingsList(draftUrl?: string, draftConsent?: boolean){
  const host=$('#workspace-react-meetings');
  if(!host)return false;
  workspacePages.mountMeetings(host,{
    ...meetingLaunchProps(),draftUrl,draftConsent,loadingList:meetingsState.loading,
    meetings:meetingsState.meetings||[],preview:meetingsState.preview,
    statusText,isActive:status=>activeMeetingStatuses.includes(status),
    onOpen:goToMeeting,onNew:openMeetingLaunch,onRefresh:()=>refreshMeetings(true),
  });
  renderMeetingLaunch();
  return true;
}

function completeLogin(user: import('./shared/session').SignedInUser){
  workspaceSession.acceptSignIn();
  appUser=user;
  toast(`Welcome back, ${user.displayName}!`);
  location.hash='home';
  route();
}

function checkMustChangePassword(){
  if(!appUser?.mustChangePassword)return;
  modal('<div id="react-required-password"></div>',{uncloseable:true});
  const host = $('#react-required-password');
  if (!host) return;
  publicPages.mountPasswordChange(host,()=>{
    if (!appUser) return;
    appUser.mustChangePassword=false;
    $<HTMLDialogElement>('#dialog')?.close();
    toast('Password updated successfully! Welcome to CloudCore AI.');
    route();
  });
}

function openProfileModal(){
  if(!appUser)return;
  showWorkspaceDialog({
    kind:'profile',name:appUser.displayName||'CloudCore user',role:appUser.role||'user',
    username:appUser.username,email:appUser.email,onSignOut:handleSignOut,
    onSettings:()=>{closeWorkspaceDialog();location.hash='settings';},
  });
}

async function handleSignOut(){
  await workspaceSession.signOut();
}
function clearWorkspaceSession(){
  stopNotificationFeed();
  appUser=null;
  clearAssistantDocument();
  ImageStudio.reset();
  resetKnowledgeSession();
  knowledgeUserId=undefined;
  settingsTab='account';
  settingsScrollToUsers=false;
  meetingController.reset();
  meetingChatLoading=false;
  meetingChats={};
  meetingTab='overview';
  pipHelpChats.clear();
  pipContextDrafts.clear();
}
function renderAssistant(){
  const host=$('#workspace-react-assistant');
  if(!host)return false;
  workspacePages.mountAssistant(host,{
    messages:assistantState.messages.map(message=>({...message})),name:appUser?.displayName,draft:assistantState.draft,
    document:docFile?{name:docFile.name,status:docIngesting?'Indexing…':docIngested?'Ready for Q&A':'Attached'}:undefined,
    image:chatImageAttached&&imageFile?{name:imageFile.name,url:imageURL}:undefined,
    formatBytes:formatBytes,onDraft:value=>{assistantState.draft=value;renderPipChat();},onSend:sendMessage,
    onNew:newConversation,onPreviewImage:openImageLightbox,
    onAttachDocument:()=>pickAssistantAttachment('document'),onAttachImage:()=>pickAssistantAttachment('image'),
    onRemoveDocument:removeAssistantDocument,onRemoveImage:removeAssistantImage,
    onSummarizeDocument:summarizeAssistantDocument,onAnalyzeImage:analyzeAssistantImage,
  });
  return true;
}
function refreshAttachmentView(){
  renderPipChat();
  if(pipTrigger&&location.hash!=='#assistant')return;
  if(location.hash!=='#assistant'||!renderAssistant())route({preserveScroll:true});
}
let pipTrigger: HTMLButtonElement | null=null;
const pipContextDrafts = new Map<string, string>();
const pipHelpChats = new Map<string, { messages: AppMessage[]; topic?: string; action?: PipChatProps['action'] }>();
function openPipChat(trigger: HTMLButtonElement){
  pipTrigger=trigger;
  renderPipChat();
}
function closePipChat(restoreFocus=true){
  const trigger=pipTrigger;
  pipTrigger=null;
  workspacePages.closePipChat();
  if(restoreFocus&&trigger?.isConnected)trigger.focus();
}
function renderPipChat(){
  const host=$('#workspace-pip-chat');
  if(!pipTrigger||!host||!appUser)return;
  const page=$('#workspace-react-sidebar')?.dataset.page;
  const onClose=()=>closePipChat();
  function mountScoped(key: string, view: Omit<PipChatProps,'draft'|'onDraft'|'onClose'|'attachments'>){
    workspacePages.mountPipChat(host!,{
      ...view,onClose,attachments:[],draft:pipContextDrafts.get(key) ?? '',
      onDraft:value=>{pipContextDrafts.set(key,value);renderPipChat();},
    });
  }
  if(onKnowledgeRoute()){
    const document=pipKnowledgeDocument;
    const scope=knowledgeChatScope(document?.id);
    const key=knowledgeChatKey(scope);
    const draftKey='knowledge/'+key;
    const folder=knowledgeState.folders.find(item=>item.id===knowledgeState.folderId);
    const label=document?.filename ?? (scope?.mode==='folder' ? folder?.name ?? 'Current folder' : 'All accessible documents');
    mountScoped(draftKey,{
      context:{
        label:'Knowledge Hub · '+label,
        intro:document ? 'Ask about this file. I’ll cite the evidence I find.' : scope?.mode==='folder'
          ? 'Ask about this folder and its subfolders. I’ll cite the documents I use.'
          : 'Ask across the Knowledge Hub documents you have access to. I’ll cite the evidence I find.',
        waiting:'Searching Knowledge Hub…',
        suggestions:document?['Summarize this file','Find key dates']:['Summarize this collection','Find key dates'],
      },
      messages:knowledgeQuestionScope===key?knowledgeChatMessages.map(message=>({...message})):[],
      busy:knowledgeChatLoading,
      onSend:value=>{
        if(knowledgeChatLoading)return;
        pipContextDrafts.delete(draftKey);
        void sendKnowledgeChatMessage(value,document?.id);
      },
      expand:{label:'Open Ask Knowledge',open:()=>{
        closePipChat(false);
        window.dispatchEvent(new CustomEvent('cloudcore:pip-open-knowledge',{detail:document?.id}));
      }},
    });
    return;
  }
  if(page==='meetings'&&selectedMeetingId){
    const id=selectedMeetingId;
    const meeting=meetingsState.detail?.id===id?meetingsState.detail:null;
    const key='meeting/'+id;
    mountScoped(key,{
      context:{label:'Meetings AI · '+(meeting?.title || 'Current meeting'),
        intro:'Ask about this meeting’s transcript, decisions, and action items.',waiting:'Reviewing the meeting…',
        suggestions:['Summarize this meeting','What did we decide?']},
      messages:(meetingChats[id]??[]).map(message=>({...message})),busy:meetingChatLoading,
      onSend:value=>{
        if(meetingChatLoading)return;
        pipContextDrafts.delete(key);
        void sendMeetingChat(id,value);
      },
      expand:{label:'Open meeting Q&A',open:()=>{
        closePipChat(false);
        meetingTab='chat';
        renderMeetingDetail();
      }},
    });
    return;
  }
  if(page==='settings'||page==='meetings'||page==='images'||page==='history'){
    const key='help/'+page;
    const guide=getPipHelp(page,{role:appUser.role,tab:settingsTab,prefs:userPrefs,pipMode:currentPipMode()});
    const chat=pipHelpChats.get(key)??{messages:[]};
    mountScoped(key,{
      context:{label:guide.label,intro:guide.intro,suggestions:guide.suggested.map(topic=>topic.prompt)},
      messages:chat.messages,action:chat.action,
      onSend:value=>{
        const question=value.trim();
        if(!question)return;
        const answer=answerPipHelp(guide,question,chat.topic);
        pipHelpChats.set(key,{messages:[...chat.messages,{role:'user',content:question},{role:'assistant',content:answer.text}],
          topic:answer.topic??chat.topic,action:answer.action});
        pipContextDrafts.delete(key);
        renderPipChat();
      },
    });
    return;
  }
  workspacePages.mountPipChat(host,{
    context:{label:page==='home'?'Home · CloudCore AI Assistant':'CloudCore AI Assistant',
      intro:page==='home'?'Ask a general question, or open Knowledge Hub to search your files.':'What can I help you with?'},
    messages:assistantState.messages.map(message=>({...message})),draft:assistantState.draft,
    attachments:[
      ...(docFile?[{name:docFile.name,status:docIngesting?'Indexing…':docIngested?'Ready':'Attached'}]:[]),
      ...(chatImageAttached&&imageFile?[{name:imageFile.name}]:[]),
    ],
    onDraft:value=>{assistantState.draft=value;renderPipChat();if(location.hash==='#assistant')renderAssistant();},
    onSend:value=>{
      if(assistantState.messages.some(message=>message.streaming))return;
      void assistantController.send(value,'floating');
    },
    onClose,
    expand:{label:'Open full Assistant',open:()=>{
      closePipChat(false);
      if(location.hash==='#assistant')renderAssistant();
      else location.hash='assistant';
    }},
  });
}
function focusAssistantPrompt(){
  const input=$<HTMLInputElement>('#assistant-composer input[name="prompt"]');
  if(typeof input?.value==='string'){input.focus();input.setSelectionRange(input.value.length,input.value.length);}
}
let documentUploadAttempt: AbortController | null = null;
function clearAssistantDocument(){
  documentUploadAttempt?.abort();
  documentUploadAttempt=null;
  docFile=null;
  docIngested=false;
  docIngesting=false;
  pendingDocAutoPrompt='';
  activeDocUploadPromise=null;
}
function ingestDocumentNow(file: File){
  if(!file||typeof fetch!=='function')return Promise.resolve();
  documentUploadAttempt?.abort();
  const attempt=new AbortController();
  documentUploadAttempt=attempt;
  docIngesting=true;
  docIngested=false;
  refreshAttachmentView();

  const current=()=>documentUploadAttempt===attempt&&docFile===file;
  activeDocUploadPromise=(async()=>{
    try{
      const name=await indexAssistantDocument(file,attempt.signal);
      if(!current())return;
      docIngested=true;
      if(userPrefs?.notifications!=='off')toast(`"${name}" indexed & ready for questions.`);
    }catch(error){
      if(!current())return;
      pendingDocAutoPrompt='';
      toast(`Ingestion failed: ${errorMessage(error)}`);
    }finally{
      if(current()){
        docIngesting=false;
        refreshAttachmentView();
        if(pendingDocAutoPrompt&&docIngested){
          const prompt=pendingDocAutoPrompt;
          pendingDocAutoPrompt='';
          void sendMessage(prompt);
        }
      }
    }
  })();
  return activeDocUploadPromise;
}
function sendMessage(prompt: string){return assistantController.send(prompt||'');}
function assistantAttachments(){
  const upload=activeDocUploadPromise;
  return {
    image:chatImageAttached&&imageFile?{file:imageFile,url:imageURL}:undefined,
    document:docFile?{name:docFile.name,waitUntilReady:async()=>{
      if(!upload)return;
      await upload;
      if(upload!==activeDocUploadPromise)throw Error('The document attachment changed. Attach the intended file and send your question again.');
      if(!docIngested)throw Error('The attached document could not be indexed. Reattach it and try again.');
    }}:undefined,
  };
}
function showAssistantTurn(text: string, firstMessage: boolean, usingImage: boolean, presentation: 'full' | 'floating'){
  if(usingImage)chatImageAttached=false;
  if(presentation==='floating'){
    if(assistantState.draft.trim()===text)assistantState.draft='';
    renderPipChat();
    if(location.hash==='#assistant')renderAssistant();
    return;
  }
  const input=$<HTMLInputElement>('#assistant-composer input[name="prompt"]');
  if(input?.value?.trim()===text){input.value='';assistantState.draft='';}
  if(location.hash!=='#assistant')location.hash='assistant';
  else if(firstMessage)route();
  else renderAssistant();
}
function selectDocument(file?: File){
  if(!file)return;
  if(!/\.(pdf|docx|pptx|xlsx|txt|md|csv|json)$/i.test(file.name))return toast('Please choose a PDF, DOCX, PPTX, XLSX, CSV or text file.');
  if(file.size>50*1048576)return toast('Please choose a document smaller than 50 MB.');
  docFile=file;docIngesting=false;docIngested=false;
  const cur=location.hash.replace(/^#/,'').split('/')[0];
  const stayInAssistant=cur==='assistant'||attachContext==='assistant';
  attachContext='';
  if(stayInAssistant){
    if(cur!=='assistant')location.hash='assistant';
  }else if(cur!=='documents'){
    location.hash='documents';
  }
  refreshAttachmentView();
  if(stayInAssistant&&!pendingDocAutoPrompt)focusAssistantPrompt();
  if(typeof fetch==='function'){
    ingestDocumentNow(file);
  }else{
    toast(`"${file.name}" attached.`);
  }
}
function selectImage(file?: File){
  if(!file)return;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))return toast('Please choose a JPG, PNG or WEBP image.');
  if(file.size>20*1048576)return toast('Please choose an image smaller than 20 MB.');
  if(imageURL.startsWith('blob:') && !assistantState.messages.some(m=>m.image===imageURL))URL.revokeObjectURL(imageURL);
  imageFile=file;imageURL=URL.createObjectURL(file);
  const cur=location.hash.replace(/^#/,'').split('/')[0];
  const stayInAssistant=cur==='assistant'||attachContext==='assistant';
  attachContext='';
  if(stayInAssistant){
    chatImageAttached=true;
    if(cur!=='assistant')location.hash='assistant';
    refreshAttachmentView();
    if(!pendingImageAutoPrompt)focusAssistantPrompt();
    toast(`"${file.name}" attached for Vision AI.`);
    if(pendingImageAutoPrompt){const p=pendingImageAutoPrompt;pendingImageAutoPrompt='';sendMessage(p)}
  }else{
    chatImageAttached=false;
    location.hash='images';
    route({preserveScroll:true});
    toast(`"${file.name}" loaded. Click Analyze Image to inspect.`);
  }
}
function newConversation(){
  assistantController.startNew();
  const input=$<HTMLInputElement>('#assistant-composer input[name="prompt"]');
  if(input)input.value='';
  location.hash='assistant';
  route();
}
function openConversation(id: string){
  if(!assistantController.open(id))return;
  if(location.hash==='#assistant')route();
  else location.hash='assistant';
}
function confirmDeleteConversation(id: string){
  showWorkspaceDialog({kind:'confirm',title:'Delete this conversation?',message:'This removes the conversation from this device.',
    label:'Delete conversation',onConfirm:()=>{
      assistantController.remove(id);
      closeWorkspaceDialog();
      route();
      toast('Conversation deleted.');
    }});
}
function exportConversations(){
  const {chats}=assistantState;
  if(!chats.length)return toast('No conversations to export yet.');
  const blob=new Blob([JSON.stringify(chats,null,2)],{type:'application/json'});
  const link=document.createElement('a');
  link.href=URL.createObjectURL(blob);
  link.download=`cloudcore-chats-${new Date().toISOString().slice(0,10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  toast('Chat history exported.');
}
function confirmClearConversations(){
  const count=assistantState.chats.length;
  if(!count)return toast('Your chat history is already empty.');
  showWorkspaceDialog({kind:'confirm',title:'Clear all local conversations?',
    message:`This will permanently remove ${count} saved conversation${count===1?'':'s'} from this browser.`,
    label:'Clear all history',onConfirm:()=>{
      assistantController.clear();
      closeWorkspaceDialog();
      renderSettings();
      toast('All local conversations cleared.');
    }});
}
function pickAssistantAttachment(kind: 'document' | 'image', prompt=''){
  attachContext='assistant';
  if(kind==='document')pendingDocAutoPrompt=prompt;
  else pendingImageAutoPrompt=prompt;
  $(`#${kind}-input`)?.click();
}
function removeAssistantDocument(){
  clearAssistantDocument();
  refreshAttachmentView();
  focusAssistantPrompt();
  toast('Document attachment removed.');
}
function removeAssistantImage(){
  chatImageAttached=false;
  imageFile=null;
  refreshAttachmentView();
  focusAssistantPrompt();
  toast('Image attachment removed.');
}
function summarizeAssistantDocument(){
  if(docFile)return sendMessage(`Please summarize "${docFile.name}" with key points and action items.`);
  pickAssistantAttachment('document','Please summarize this document with key points and action items.');
}
function analyzeAssistantImage(){
  if(imageFile){
    chatImageAttached=true;
    return sendMessage(`Please analyze "${imageFile.name}" and extract key observations.`);
  }
  pickAssistantAttachment('image','Please analyze this image thoroughly and highlight key observations.');
}
const ImageStudio=createStudioController({
  getUserId:()=>appUser?.id,
  notify:toast,
  onUnauthorized:()=>workspaceSession.expire(),
  onSavedToKnowledge:()=>{knowledgeState.loaded=false;},
  renderView:(container,props)=>imageStudioPages.mount(container,props),
});
const workspaceSession=createSessionClient({
  onRestored:({user,capacity})=>{
    appUser=user;
    if(capacity)meetingsState.capacity=capacity;
    route({preserveScroll:true});
  },
  onExpired:()=>{
    clearWorkspaceSession();
    location.hash='login';
    route();
  },
  onSignedOut:confirmed=>{
    clearWorkspaceSession();
    location.hash='landing';
    route();
    toast(confirmed?'You have signed out successfully.':'Signed out locally. Server sign-out could not be confirmed.');
  },
});
const meetingController=createMeetingsController({
  request:api,getUserId:()=>appUser?.id,getMeetingId:()=>selectedMeetingId,
  onChange:()=>{renderMeetingsList();renderMeetingDetail();},
  onLaunchChange:(url,consent)=>{
    renderMeetingsList(url,consent);
    renderMeetingLaunch(url,consent);
  },
  onLaunched:goToMeeting,onDeleted:()=>{location.hash='meetings';},notify:toast,
});
const meetingsState = meetingController.state;
const knowledgeController=createKnowledgeController({
  request:api,getUserId:()=>appUser?.id,isVisible:()=>Boolean(appUser)&&onKnowledgeRoute(),
  onChange:renderKnowledge,notify:toast,
});
const knowledgeState = knowledgeController.state;
const assistantController=createAssistantController({
  getAttachments:assistantAttachments,getResponseStyle:()=>userPrefs.responseStyle,
  onTurn:showAssistantTurn,onReply:()=>{renderPipChat();if(location.hash==='#assistant')renderAssistant();},
  onImageResult:name=>{
    if(userPrefs.notifications==='on')toast(`Completed Vision AI analysis for "${name}".`);
  },
  notify:toast,
});
const assistantState = assistantController.state;
const workspaceTheme = createWorkspaceTheme(() => userPrefs.motionMode);
const route = createHashRouter({
  getUser:()=>appUser,
  prepare:prepareWorkspaceRoute,
  renderPublic:renderPublicRoute,
  renderWorkspace:renderWorkspaceRoute,
  requirePasswordChange:checkMustChangePassword,
});
window.addEventListener('cloudcore:import-status',renderWorkspaceHeader);
window.addEventListener('hashchange', () => {
  const screen=location.hash.slice(1).split(/[?/]/)[0];
  if(onKnowledgeRoute()&&document.querySelector('.'+screen+'-workspace #workspace-react-knowledge')&&appUser)restoreKnowledgeLocation();
  else route();
});
route();
if(typeof fetch==='function')void workspaceSession.restore();
const navigationScreens = ['landing', 'home', 'assistant', 'meetings', 'documents', 'images', 'history'] as const;
type NavigationTool = {
  name: string; title: string; description: string;
  inputSchema: object; annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: { screen?: string } | null) => { screen: string; status: 'opened' };
};
const modelContext = (document as Document & { modelContext?: { registerTool: (tool: NavigationTool) => unknown } }).modelContext;
if (modelContext?.registerTool) {
  try {
    void Promise.resolve(modelContext.registerTool({
      name: 'navigate_cloudcore', title: 'Open a CloudCore AI screen',
      description: 'Navigate to a CloudCore AI frontend screen. Does not send messages, join meetings, or upload files.',
      inputSchema: { type: 'object', properties: { screen: { type: 'string', enum: navigationScreens } }, required: ['screen'], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        const screen = input?.screen;
        if (!screen || !navigationScreens.some(route => route === screen)) throw new Error('Choose a supported CloudCore AI screen.');
        location.hash = screen;
        route();
        return { screen, status: 'opened' };
      },
    })).catch(() => {});
  } catch { /* Browsers can decline to register optional navigation tools. */ }
}
