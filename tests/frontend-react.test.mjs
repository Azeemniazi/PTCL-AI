import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setTimeout as wait } from 'node:timers/promises';
import { test } from 'node:test';
import { runInContext } from 'node:vm';
import { JSDOM } from 'jsdom';
import { fireEvent, getQueriesForElement } from '@testing-library/dom';

let fixtureSource;
function loadFixtures() {
  return fixtureSource ??= readFile(new URL('../build/frontend-test/fixtures.js', import.meta.url), 'utf8');
}
const now = '2026-11-18T09:00:00Z';

test('React landing keeps its public links and switches calls to action for signed-in users', async t => {
  const { window } = new JSDOM('<main id="app"></main>', { runScripts: 'outside-only', pretendToBeVisual: true });
  window.eval(await loadFixtures());
  const pages = window.CloudCoreFixtures.publicPages;
  const host = window.document.getElementById('app');
  const ui = getQueriesForElement(host);
  t.after(() => { pages.unmount(); window.close(); });
  pages.mount(host, 'landing', false, () => {});
  const cta = await until(() => ui.queryByRole('link', { name: 'Explore AI Workspace' }));
  assert.equal(cta.getAttribute('href'), '#login');
  assert.equal(ui.getByRole('link', { name: 'Search resources' }).getAttribute('href'), '#site-resources');
  pages.mount(host, 'landing', true, () => {});
  await until(() => cta.getAttribute('href') === '#home');
});

test('React login preserves the authentication request, shows rejection, and forwards successful identity', async t => {
  const { window } = new JSDOM('<main id="app"></main>', { runScripts: 'outside-only', pretendToBeVisual: true });
  window.eval(await loadFixtures());
  const calls = [];
  const user = { id: 'dev-fixture', role: 'dev', displayName: 'Fixture', mustChangePassword: true };
  window.fetch = async (path, options) => {
    calls.push({ path, options });
    return calls.length === 1
      ? { ok: false, json: async () => ({ error: { message: 'Authentication rejected.' } }) }
      : { ok: true, json: async () => ({ user }) };
  };
  const pages = window.CloudCoreFixtures.publicPages;
  const host = window.document.getElementById('app');
  const ui = getQueriesForElement(host);
  let signedIn;
  t.after(() => { pages.unmount(); window.close(); });
  pages.mount(host, 'login', false, value => { signedIn = value; });
  const button = await until(() => ui.queryByRole('button', { name: 'Sign In' }));
  ui.getByLabelText('Username').value = '  fixture  ';
  ui.getByLabelText('Password').value = 'fixture-password';
  fireEvent.click(button);
  await until(() => ui.queryByRole('alert'));
  assert.equal(ui.getByRole('alert').textContent, 'Authentication rejected.');
  assert.equal(calls[0].path, '/api/auth/login');
  assert.deepEqual(JSON.parse(calls[0].options.body), { username: 'fixture', password: 'fixture-password' });
  fireEvent.click(ui.getByRole('button', { name: 'Sign In' }));
  await until(() => signedIn);
  assert.equal(signedIn, user);
});

test('React renders each marketing route and filters resources without changing routes', async t => {
  const { window } = new JSDOM('<main id="app"></main>', { runScripts: 'outside-only', pretendToBeVisual: true });
  window.eval(await loadFixtures());
  const pages = window.CloudCoreFixtures.publicPages;
  const host = window.document.getElementById('app');
  const ui = getQueriesForElement(host);
  t.after(() => { pages.unmount(); window.close(); });
  const expected = [
    ['site-solutions', /One AI workspace/],
    ['site-ai', /Answers grounded/],
    ['site-industries', /The same AI foundation/],
    ['site-about', /Business AI should be/],
    ['site-resources', /Clear guidance for/],
  ];
  for (const [page, name] of expected) {
    pages.mount(host, page, false, () => {});
    await until(() => ui.queryByRole('heading', { level: 1, name }));
    assert.equal(host.querySelector('nav .active').getAttribute('href'), '#' + page);
    assert.equal(ui.getByRole('link', { name: 'Sign In' }).getAttribute('href'), '#login');
  }
  fireEvent.input(ui.getByRole('searchbox'), { target: { value: 'vision' } });
  await until(() => ui.queryByRole('heading', { name: 'Evaluating grounded answers' }) === null);
  assert.ok(ui.getByRole('heading', { name: 'Planning a vision AI pilot' }));
});

async function productionWindow(t, hash, fetch) {
  const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
  const dom = new JSDOM(html, {
    url: `http://localhost/${hash}`, runScripts: 'outside-only', pretendToBeVisual: true,
  });
  const { window } = dom;
  window.scrollTo = () => {};
  window.TextDecoder = TextDecoder;
  window.HTMLMediaElement.prototype.play = () => Promise.resolve();
  window.HTMLMediaElement.prototype.pause = () => {};
  window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  window.fetch = fetch;
  t.after(async () => { await wait(50); window.close(); });
  async function boot() {
    for (const script of window.document.querySelectorAll('script[src]')) {
      const path = script.getAttribute('src').split('?')[0];
      const contents = await readFile(new URL('../dist/' + path, import.meta.url), 'utf8');
      runInContext(contents, dom.getInternalVMContext(), { filename: path });
    }
  }
  return { window, ui: getQueriesForElement(window.document.body), boot };
}

function holdTimers(window, delays) {
  const timers = new Map();
  let timerId = -1;
  const schedule = window.setTimeout.bind(window);
  const cancel = window.clearTimeout.bind(window);
  window.setTimeout = (callback, delay, ...args) => {
    if (!delays.includes(delay)) return schedule(callback, delay, ...args);
    const id = timerId--;
    timers.set(id, () => { timers.delete(id); callback(...args); });
    return id;
  };
  window.clearTimeout = id => { if (!timers.delete(id)) cancel(id); };
  return timers;
}

test('Pip roams, distinguishes dragging from chat, and shares the assistant while streaming', async t => {
  let stream;
  const { window, ui, boot } = await productionWindow(t, '#home', async path => {
    if(path==='/api/chat?stream=true')return {ok:true,body:new ReadableStream({start(value){stream=value;}})};
    const data = path === '/api/me' ? {user:{id:'pip-fixture',role:'member',displayName:'Fixture'}} : {};
    return {status:200,ok:true,json:async()=>data};
  });
  window.Math.random=()=>0;
  const atRest=window.HTMLElement.prototype.getBoundingClientRect;
  window.HTMLElement.prototype.getBoundingClientRect=function(){
    return this.classList.contains('workspace-main') ? new window.DOMRect(64,80,900,640) : atRest.call(this);
  };
  const timers=holdTimers(window,[2300,3100,2800,13100]);
  await boot();
  const pip=await until(()=>ui.queryByRole('button',{name:'Chat with Pip'}));
  assert.equal(pip.closest('#workspace-sidebar'),null);
  const stage=pip.closest('.pip-stage');
  assert.equal(stage.dataset.placed,'true');
  const first=stage.style.cssText;
  await until(()=>timers.size===1);
  timers.values().next().value();
  await until(()=>stage.dataset.moving==='true');
  assert.notEqual(stage.style.cssText,first);
  assert.equal(ui.getByText('Making my rounds.').closest('.pip-stage'),stage);
  timers.values().next().value();
  await until(()=>pip.dataset.pose==='wave');
  assert.ok(ui.getByText('Oh hey! Fancy seeing you here.'));
  const pointer=(type,x,y)=>{
    const event=new window.MouseEvent(type,{clientX:x,clientY:y,button:0,bubbles:true});
    Object.defineProperty(event,'pointerId',{value:17});
    fireEvent(pip,event);
  };
  pointer('pointerdown',125,150);
  pointer('pointermove',280,260);
  await until(()=>stage.dataset.held==='true');
  pointer('pointerup',280,260);
  fireEvent.click(pip,{detail:1});
  assert.equal(ui.queryByRole('dialog',{name:'Pip'}),null);
  assert.ok(window.localStorage.getItem('cloudcore.pip-position'));
  const move=ui.getByRole('button',{name:'Move Pip'});
  fireEvent.click(move);
  await until(()=>ui.queryByRole('button',{name:'Drop Pip'}));
  const beforeMove=stage.style.cssText;
  fireEvent.keyDown(move,{key:'ArrowUp'});
  await until(()=>stage.style.cssText!==beforeMove);
  fireEvent.click(move);
  fireEvent.click(ui.getByRole('button',{name:'Lock Pip here'}));
  await until(()=>stage.dataset.locked==='true');
  const lockedPosition=stage.style.cssText;
  pointer('pointerdown',125,150);
  pointer('pointermove',280,260);
  pointer('pointerup',280,260);
  fireEvent.click(pip,{detail:1});
  assert.equal(stage.style.cssText,lockedPosition);
  assert.equal(window.localStorage.getItem('cloudcore.mascot'),'docked');
  assert.equal(ui.queryByRole('dialog',{name:'Pip'}),null);
  fireEvent.click(pip);
  const input=await until(()=>ui.queryByRole('textbox',{name:'Message Pip'}));
  fireEvent.input(input,{target:{value:'Check the status'}});
  fireEvent.click(ui.getByRole('button',{name:'Close Pip chat'}));
  await until(()=>!ui.queryByRole('dialog',{name:'Pip'}));
  assert.equal(window.document.activeElement,pip);
  fireEvent.click(ui.getByRole('button',{name:'Unlock Pip'}));
  await until(()=>stage.dataset.locked==='false');
  fireEvent.click(pip);
  const reopened=await until(()=>ui.queryByRole('textbox',{name:'Message Pip'}));
  assert.equal(reopened.value,'Check the status');
  fireEvent.submit(reopened.form);
  await until(()=>stream);
  assert.equal(window.location.hash,'#home');
  stream.enqueue(new TextEncoder().encode('data: {"delta":"Looking into it"}\n\n'));
  await until(()=>ui.queryByText('Looking into it'));
  fireEvent.click(ui.getByRole('button',{name:'Open full Assistant'}));
  await until(()=>window.location.hash==='#assistant'&&ui.queryByText('Looking into it'));
  stream.enqueue(new TextEncoder().encode('data: {"delta":" now."}\n\n'));
  stream.close();
  await until(()=>ui.queryByText('Looking into it now.'));
});

test('Assistant answers standalone greetings instantly and sends real questions to the model', async t => {
  const sent = [];
  let stream;
  const { ui, boot } = await productionWindow(t, '#assistant', async (path, options) => {
    if (path === '/api/chat?stream=true') {
      sent.push(JSON.parse(options.body));
      return { ok: true, body: new ReadableStream({ start(controller) { stream = controller; } }) };
    }
    const data = path === '/api/me' ? {user:{id:'quick-reply-fixture',role:'member',displayName:'Fixture'}} : {};
    return {status:200,ok:true,json:async()=>data};
  });
  await boot();
  const composer = await until(() => ui.queryByRole('textbox', { name: 'Message CloudCore AI' }));
  fireEvent.input(composer, { target: { value: 'Hello!' } });
  fireEvent.submit(composer.form);
  await until(() => ui.queryByText('Hey! What can I help you with?'));
  assert.equal(sent.length, 0);
  const next = ui.getByRole('textbox', { name: 'Message CloudCore AI' });
  fireEvent.input(next, { target: { value: 'Hello, what is 3 + 4?' } });
  fireEvent.submit(next.form);
  await until(() => ui.queryByText('Waiting for CloudCore AI…'));
  await until(() => stream);
  assert.equal(sent[0].message, 'Hello, what is 3 + 4?');
  assert.deepEqual(sent[0].history.map(message => message.content), ['Hello!', 'Hey! What can I help you with?']);
  stream.enqueue(new TextEncoder().encode('data: {"delta":"Seven."}\n\n'));
  stream.close();
  await until(() => ui.queryByText('Seven.'));
});

test('Pip scopes Knowledge Hub questions to the active folder or open file and hands citations to Ask Knowledge', async t => {
  const folder = { id: '13dd1399-67d4-4dcb-a900-fcb083dbd321', name: 'Operations', isShared: true };
  const file = { id: 'a84d1dce-0cca-4574-997c-61c66d4d27c1', filename: 'Recovery plan.pdf', folderId: folder.id, isShared: true,
    status: 'ready', sizeBytes: 123, createdAt: now };
  const calls = [];
  const { window, ui, boot } = await productionWindow(t, '#documents?folder=' + folder.id, async (path, options) => {
    if (path === '/api/chat?stream=true') {
      const body = JSON.parse(options.body);
      calls.push(body);
      return { ok: true, body: new ReadableStream({ start(controller) {
        const answer = body.rag_scope?.mode === 'document' ? 'Verify the backup checksum.' : 'Review the recovery procedures.';
        const citations = [{ documentId: file.id, filename: file.filename }];
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({delta:answer,citations})}\n\ndata: [DONE]\n\n`));
        controller.close();
      } }) };
    }
    const data = path === '/api/me' ? {user:{id:'pip-knowledge-fixture',role:'member',displayName:'Fixture'}}
      : path.startsWith('/api/knowledge/folders') ? {folders:[folder]}
      : path.startsWith('/api/knowledge/documents?') ? {documents:[file]}
      : path === '/api/knowledge/documents/' + file.id ? {document:file} : {};
    return {status:200,ok:true,json:async()=>data};
  });
  const pip = () => getQueriesForElement(ui.getByRole('dialog', {name:'Pip'}));
  async function open(label) {
    fireEvent.click(await until(() => ui.queryByRole('button', {name:'Chat with Pip'})));
    await until(() => ui.queryByText(label));
  }
  await boot();
  await until(() => ui.queryByRole('link', {name:file.filename}));
  await open('Knowledge Hub · Operations');
  fireEvent.click(pip().getByRole('button', {name:'Summarize this collection'}));
  await until(() => pip().queryByText('Review the recovery procedures.'));
  assert.deepEqual(calls[0].rag_scope,{mode:'folder',id:folder.id});
  assert.equal(calls[0].use_rag,true);
  fireEvent.click(pip().getByRole('button', {name:'Close Pip chat'}));
  fireEvent.click(ui.getByRole('link', {name:file.filename}));
  await until(() => ui.queryByRole('button', {name:'Close preview'}));
  await open('Knowledge Hub · Recovery plan.pdf');
  assert.equal(pip().queryByText('Review the recovery procedures.'),null);
  fireEvent.click(pip().getByRole('button', {name:'Summarize this file'}));
  await until(() => pip().queryByText('Verify the backup checksum.'));
  assert.deepEqual(calls[1].rag_scope,{mode:'document',id:file.id});
  assert.deepEqual(calls[1].history,[]);
  const follow = pip().getByRole('textbox', {name:'Message Pip'});
  fireEvent.input(follow,{target:{value:'What should I check first?'}});
  fireEvent.submit(follow.form);
  await until(() => calls.length===3);
  assert.equal(calls[2].history[0].content,'Summarize this file');
  assert.ok(pip().getAllByRole('link', {name:/Recovery plan.pdf/}).every(link => link.getAttribute('href')==='/api/knowledge/documents/'+file.id+'/view'));
  fireEvent.click(pip().getByRole('button', {name:'Open Ask Knowledge'}));
  const panel=await until(() => ui.queryByRole('complementary', {name:'Ask Knowledge'}));
  assert.match(panel.textContent,/Verify the backup checksum/);
  assert.match(panel.textContent,/What should I check first/);
  assert.equal(window.location.hash,'#documents?folder='+folder.id);
});

test('Pip in Settings knows the current tab, saved preferences and role, and follows up without calling chat', async t => {
  const requests = [];
  const { window, ui, boot } = await productionWindow(t, '#settings?tab=preferences', async path => {
    requests.push(path);
    return {status:200,ok:true,json:async()=>path==='/api/me'?{user:{id:'pip-settings-fixture',role:'member',displayName:'Fixture'}}:{}};
  });
  window.localStorage.setItem('cloudcore-prefs',JSON.stringify({responseStyle:'detailed'}));
  const pip=()=>getQueriesForElement(ui.getByRole('dialog',{name:'Pip'}));
  async function send(value) {
    const input=pip().getByRole('textbox',{name:'Message Pip'});
    fireEvent.input(input,{target:{value}});
    fireEvent.submit(input.form);
    await until(()=>pip().queryByText(value));
  }
  await boot();
  fireEvent.click(await until(()=>ui.queryByRole('button',{name:'Chat with Pip'})));
  await until(()=>ui.queryByText('Settings · Preferences'));
  fireEvent.click(pip().getByRole('button',{name:'How do I get shorter replies?'}));
  await until(()=>pip().queryAllByText('Executive Detail',{selector:'strong'}).length>0);
  await send('Where is that?');
  assert.equal(pip().getAllByText(/Default Response Style/,{selector:'strong'}).length,2);
  await send('Can I add a user?');
  assert.match(pip().getByText(/Ask a workspace admin to create/).textContent,/available to admins and dev accounts/);
  assert.equal(pip().queryByRole('link',{name:'Open Security'}),null);
  await send('How can I change my password?');
  const security=pip().getByRole('link',{name:'Open Security'});
  assert.equal(security.getAttribute('href'),'#settings?tab=security');
  window.location.hash=security.getAttribute('href');
  await until(()=>ui.queryByRole('tab',{name:'Security',selected:true}));
  fireEvent.click(ui.getByRole('button',{name:'Chat with Pip'}));
  await until(()=>ui.queryByText('Settings · Security'));
  assert.equal(requests.some(path => path.startsWith('/api/chat')),false);
});

test('Pip uses the open meeting for Q&A and expands into the same meeting conversation', async t => {
  const id = 'pip-meeting';
  const endpoint = '/api/meetings/' + id;
  const meeting = {id,title:'Planning review',status:'completed',createdAt:now,expiresAt:now,transcript:[],participants:[],snapshots:[]};
  const calls = [];
  const { window, ui, boot } = await productionWindow(t, '#meetings/' + id, async (path, options) => {
    if (path.endsWith('/chat?stream=true')) {
      calls.push({path,body:JSON.parse(options.body)});
      return {ok:true,body:new ReadableStream({start(controller){
        controller.enqueue(new TextEncoder().encode('data: {"delta":"The follow-up is due Thursday."}\n\ndata: [DONE]\n\n'));
        controller.close();
      }})};
    }
    const data=path==='/api/me'?{user:{id:'pip-meeting-member',role:'member',displayName:'Fixture'}}:path===endpoint?meeting:{};
    return {ok:true,status:200,json:async()=>data};
  });
  await boot();
  await until(()=>ui.queryByRole('heading',{name:meeting.title}));
  fireEvent.click(ui.getByRole('button',{name:'Chat with Pip'}));
  await until(()=>ui.queryByText('Meetings AI · Planning review'));
  fireEvent.click(ui.getByRole('button',{name:'What did we decide?'}));
  await until(()=>ui.queryByText('The follow-up is due Thursday.'));
  assert.deepEqual(calls,[{path:endpoint+'/chat?stream=true',body:{message:'What did we decide?',history:[]}}]);
  fireEvent.click(ui.getByRole('button',{name:'Open meeting Q&A'}));
  await until(()=>!ui.queryByRole('dialog',{name:'Pip'})&&ui.queryByText('The follow-up is due Thursday.'));
  assert.equal(window.location.hash,'#meetings/'+id);
});

test('A delayed workspace restore cannot replace a newer sign-in', async t => {
  const user = { id: 'current', role: 'member', displayName: 'Current User' };
  const previous = { id: 'previous', role: 'member', displayName: 'Previous User' };
  let finishRestore;
  const { window, ui, boot } = await productionWindow(t, '#login', async path => {
    if (path === '/api/me') return new Promise(resolve => { finishRestore = resolve; });
    return { status: 200, ok: true, json: async () => ({ user }) };
  });
  await boot();
  const submit = await until(() => ui.queryByRole('button', { name: 'Sign In' }));
  ui.getByLabelText('Username').value = 'current';
  ui.getByLabelText('Password').value = 'fixture-password';
  fireEvent.click(submit);
  await until(() => ui.queryByRole('heading', { name: 'Good morning, Current' }));
  let restoreRead = false;
  finishRestore({ status: 200, ok: true, json: async () => { restoreRead = true; return { user: previous }; } });
  await until(() => restoreRead);
  assert.ok(ui.getByRole('heading', { name: 'Good morning, Current' }));
  assert.equal(ui.queryByRole('heading', { name: 'Good morning, Previous' }), null);
  assert.equal(window.location.hash, '#home');
});

test('An expired workspace session returns to sign-in and failed logout reports its status', async t => {
  const user = { id: 'member', role: 'member', displayName: 'Fixture User' };
  const unauthorized = { status: 401, ok: false, json: async () => ({}) };
  let logouts = 0;
  const { window, ui, boot } = await productionWindow(t, '#home', async (path, options) => {
    if (path === '/api/ai/health') return unauthorized;
    if (path === '/api/auth/logout') {
      logouts++;
      assert.equal(options.method, 'POST');
      assert.equal(options.headers['x-requested-with'], 'CloudCoreAI');
      return { status: 503, ok: false, json: async () => ({}) };
    }
    return { status: 200, ok: true, json: async () => ({ user }) };
  });
  await boot();
  await until(() => ui.queryByRole('heading', { name: 'Good morning, Fixture' }));
  window.location.hash = 'settings';
  fireEvent.click(await until(() => ui.queryByRole('tab', { name: 'Integrations' })));
  const signIn = await until(() => ui.queryByRole('button', { name: 'Sign In' }));
  ui.getByLabelText('Username').value = 'member';
  ui.getByLabelText('Password').value = 'fixture-password';
  fireEvent.click(signIn);
  await until(() => ui.queryByRole('heading', { name: 'Good morning, Fixture' }));

  assert.equal(window.location.hash, '#home');
  fireEvent.click(ui.getByRole('button', { name: /Fixture User/ }));
  fireEvent.click(await until(() => ui.queryByRole('button', { name: 'Sign out' })));
  await until(() => ui.queryByText('Signed out locally. Server sign-out could not be confirmed.'));
  assert.equal(logouts, 1);
  assert.equal(window.location.hash, '#landing');
  assert.equal(ui.queryByRole('navigation', { name: 'Product navigation' }), null);
});

test('A late 401 from a previous session cannot expire a newer login', async t => {
  const { window } = new JSDOM('', { runScripts: 'outside-only' });
  t.after(() => window.close());
  window.eval(await loadFixtures());
  let finish;
  let expired = 0;
  window.fetch = () => new Promise(resolve => { finish = resolve; });
  const session = window.CloudCoreFixtures.createSessionClient({ onExpired: () => { expired++; } });
  const pending = session.request('/api/fixture').catch(error => error);
  session.acceptSignIn();
  finish({ status: 401, ok: false, json: async () => ({}) });
  assert.equal((await pending).name, 'AbortError');
  assert.equal(expired, 0);
});

test('Production workspace shell preserves route aliases, background playback, and member access', async t => {
  const user = { id: 'member-fixture', role: 'member', displayName: 'Fixture User' };
  const requests = [];
  const { window, ui, boot } = await productionWindow(t, '#assistant', async path => {
    requests.push(path);
    const data = path === '/api/me' ? { user } : { folders: [], documents: [] };
    return { status: 200, ok: true, json: async () => data };
  });
  const { document } = window;
  await boot();
  const sidebarVideo = await until(() => document.querySelector('.ref-sidebar-video[src]'));
  const assistantVideo = document.querySelector('.ref-assistant-video[src]');
  assert.ok(assistantVideo);
  assert.equal(document.getElementById('document-input').type, 'file');
  assert.equal(document.getElementById('image-input').accept, 'image/png,image/jpeg,image/webp');

  for (const route of ['knowledge', 'documents']) {
    window.location.hash = route;
    await until(() => document.querySelector(`.${route}-workspace #workspace-react-knowledge`));
    assert.equal(document.querySelector('.ref-sidebar-video'), sidebarVideo);
    assert.equal(document.querySelector('.ref-assistant-video'), null);
  }

  window.location.hash = 'assistant';
  await until(() => document.querySelector('.ref-assistant-video') === assistantVideo);
  window.location.hash = 'pentesting';
  await until(() => ui.queryByRole('heading', { name: 'Good morning, Fixture' }));
  assert.equal(document.getElementById('pentest-panel'), null);
  assert.equal(ui.queryByRole('link', { name: 'Pentesting' }), null);
  assert.equal(requests.some(path => path.startsWith('/api/pentesting')), false);

  window.location.hash = 'site-about';
  await until(() => ui.queryByRole('heading', { level: 1, name: /Business AI should be/ }));
  assert.equal(document.querySelector('.workspace'), null);
  assert.equal(document.getElementById('document-input'), null);
  window.location.hash = 'unknown-module';
  await until(() => ui.queryByRole('heading', { name: 'Good morning, Fixture' }));
  assert.equal(document.querySelector('.ref-sidebar-video'), sidebarVideo);
});

test('Production workspace rejects unsupported attachments and registers navigation without submitting work', async t => {
  const user = { id: 'navigation-fixture', role: 'member', displayName: 'Fixture Member' };
  const requests = [];
  const { window, ui, boot } = await productionWindow(t, '#assistant', async (path, options) => {
    requests.push({ path, method: options?.method });
    return { status: 200, ok: true, json: async () => path === '/api/me' ? { user } : {} };
  });
  const tools = [];
  window.document.modelContext = { registerTool: tool => tools.push(tool) };
  await boot();
  await until(() => ui.queryByRole('textbox', { name: 'Message CloudCore AI' }));
  function attach(id, name, type, size) {
    const file = new window.File(['fixture'], name, { type });
    if (size) Object.defineProperty(file, 'size', { value: size });
    fireEvent.change(window.document.getElementById(id), { target: { files: [file] } });
    return window.document.getElementById('toast').textContent;
  }
  assert.match(attach('document-input', 'invalid.exe', 'application/octet-stream'), /Please choose a PDF/);
  assert.match(attach('document-input', 'large.pdf', 'application/pdf', 51 * 1024 ** 2), /smaller than 50 MB/);
  assert.match(attach('image-input', 'invalid.txt', 'text/plain'), /Please choose a JPG/);
  assert.match(attach('image-input', 'large.png', 'image/png', 21 * 1024 ** 2), /smaller than 20 MB/);
  assert.deepEqual(requests.filter(({ path }) => path !== '/api/notifications').map(({ path }) => path), ['/api/me']);

  assert.equal(tools.length, 1);
  assert.equal(tools[0].name, 'navigate_cloudcore');
  assert.throws(() => tools[0].execute({ screen: 'invalid' }), /supported CloudCore AI screen/);
  assert.equal(window.location.hash, '#assistant');
  assert.equal(tools[0].execute({ screen: 'images' }).status, 'opened');
  await until(() => window.document.getElementById('premium-studio'));
  assert.ok(window.location.hash.startsWith('#images'));
  assert.equal(requests.some(({ method }) => method === 'POST'), false);
});

test('The bundled workspace replaces its loading message without installing cross-script globals', async t => {
  const { window, ui, boot } = await productionWindow(t, '#landing', async () => ({ ok: true, json: async () => ({ user: null }) }));
  assert.ok(ui.getByText('CloudCore AI is loading. If this screen stays open, refresh the page.'));
  await boot();
  await until(() => ui.queryByRole('link', { name: 'Explore AI Workspace' }));
  assert.equal(ui.queryByText(/CloudCore AI is loading/), null);
  for (const name of ['api', 'route', 'Pentesting', 'refreshMeetings']) assert.equal(window[name], undefined, name);
});

test('Production routes connect sign-in, required password change, Home and History to the workspace', async t => {
  const notificationState = {read:false,cleared:false};
  const user = { id: 'member-fixture', role: 'member', displayName: 'Fixture User', mustChangePassword: true };
  const passwordRequests = [];
  const { window, ui, boot } = await productionWindow(t, '#landing', async (path, options) => {
    if (path === '/api/auth/change-password') {
      passwordRequests.push(options);
      if (passwordRequests.length === 1) {
        return { status: 400, ok: false, json: async () => ({ error: { message: 'Temporary password was incorrect.' } }) };
      }
    }
    if (path === '/api/notifications') {
      const entries = notificationState.cleared ? [] : [{id:'image:fixture:completed',title:'Image ready',text:'Image job completed.',
        href:'#images?job=fixture',time:now,unread:!notificationState.read}];
      return {status:200,ok:true,json:async()=>({entries})};
    }
    if (path === '/api/notifications/read') notificationState.read = true;
    if (path === '/api/notifications/clear') notificationState.cleared = true;
    const data = path === '/api/auth/login' ? { user } : path === '/api/me' ? { user: null } : {};
    return { status: 200, ok: true, json: async () => data };
  });
  window.localStorage.setItem('cloudcore-chats', JSON.stringify([
    { id: 'keep-chat', title: 'Quarterly planning', updated: now, messages: [{ role: 'user', content: 'Planning question' }] },
    { id: 'remove-chat', title: 'Archive this draft', updated: now, messages: [] },
  ]));
  await boot();
  await until(() => ui.queryByRole('link', { name: 'Explore AI Workspace' }));
  window.location.hash = 'site-resources';
  await until(() => ui.queryByRole('searchbox', { name: 'Search the resource library' }));
  window.location.hash = 'login';
  const submit = await until(() => ui.queryByRole('button', { name: 'Sign In' }));
  ui.getByLabelText('Username').value = 'fixture';
  ui.getByLabelText('Password').value = 'fixture-password';
  fireEvent.click(submit);
  const change = await until(() => ui.queryByRole('button', { name: 'Set Password & Continue' }));
  const dialog = change.closest('dialog');
  assert.ok(dialog.open && dialog.classList.contains('uncloseable'));
  assert.equal(dialog.querySelector('.dialog-close').style.display, 'none');
  assert.equal(dialog.dispatchEvent(new window.Event('cancel', { cancelable: true })), false);
  fireEvent.click(dialog);
  assert.ok(dialog.open && !dialog.classList.contains('cc-closing'));
  ui.getByLabelText('Current Temporary Password').value = 'wrong-fixture-password';
  ui.getByLabelText('New Password').value = 'new-fixture-password';
  ui.getByLabelText('Confirm New Password').value = 'different-fixture-password';
  fireEvent.click(change);
  await until(() => ui.queryByText('New password and confirmation do not match.'));
  assert.equal(passwordRequests.length, 0);
  window.location.hash = 'history';
  window.dispatchEvent(new window.HashChangeEvent('hashchange'));
  assert.equal(ui.getByRole('button', { name: 'Set Password & Continue' }), change);
  assert.equal(ui.getByLabelText('New Password').value, 'new-fixture-password');
  window.location.hash = 'home';
  ui.getByLabelText('Confirm New Password').value = 'new-fixture-password';
  fireEvent.click(change);
  await until(() => ui.queryByText('Temporary password was incorrect.'));
  ui.getByLabelText('Current Temporary Password').value = 'fixture-password';
  fireEvent.click(change);
  await until(() => !window.document.querySelector('#dialog[open]'));
  assert.equal(passwordRequests.length, 2);
  assert.equal(passwordRequests[1].headers['x-requested-with'], 'CloudCoreAI');
  assert.deepEqual(JSON.parse(passwordRequests[1].body), {
    currentPassword: 'fixture-password', newPassword: 'new-fixture-password',
  });
  await until(() => window.document.querySelector('.home-cards'));
  assert.equal(window.location.hash, '#home');
  assert.equal(ui.queryByRole('button', { name: 'Sign In' }), null);
  const navigation = await until(() => ui.queryByRole('navigation', { name: 'Product navigation' }));
  const nav = getQueriesForElement(navigation);
  assert.equal(nav.getByRole('link', { name: 'Home' }).getAttribute('aria-current'), 'page');
  assert.equal(nav.queryByRole('link', { name: 'Pentesting' }), null);
  const menu = ui.getByRole('button', { name: 'Toggle navigation' });
  fireEvent.click(menu);
  assert.ok(navigation.closest('.sidebar').classList.contains('mobile-open'));
  await until(() => menu.getAttribute('aria-expanded') === 'true');
  fireEvent.click(menu);
  await until(() => menu.getAttribute('aria-expanded') === 'false');
  const bell = ui.getByRole('button', { name: 'Notifications' });
  await until(() => bell.classList.contains('has-unread'));
  fireEvent.click(bell);
  await until(() => !bell.classList.contains('has-unread'));
  await until(() => ui.queryByText('Image ready', {selector:'b'}));
  fireEvent.click(ui.getByRole('button', { name: 'Clear all' }));
  await until(() => ui.queryByText('You’re all caught up. No new notifications.'));
  fireEvent.click(ui.getByRole('button', { name: 'Close', exact: true }));
  fireEvent.click(ui.getByRole('button', { name: /Fixture User/ }));
  const profile = getQueriesForElement(await until(() => ui.queryByRole('dialog', { name: 'Fixture User' })));
  fireEvent.click(profile.getByRole('button', { name: 'Settings' }));
  await until(() => ui.queryByRole('heading', { name: 'Settings' }));
  fireEvent.click(await until(() => ui.queryByRole('link', { name: 'Home', exact: true })));
  await until(() => ui.queryByRole('heading', { name: 'Good morning, Fixture' }));
  assert.ok(ui.getByRole('heading', { name: 'Good morning, Fixture' }));
  fireEvent.click(ui.getByRole('button', { name: /Quarterly planning/ }));
  await until(() => ui.queryByText('Planning question'));
  assert.equal(window.location.hash, '#assistant');
  fireEvent.click(await until(() => window.document.querySelector('#workspace-react-header .ref-new-chat')));
  await until(() => !ui.queryByText('Planning question'));
  const globalSearch = await until(() => ui.queryByRole('textbox', { name: 'Search products, guides, solutions' }));
  globalSearch.value = '  CHAT HISTORY  ';
  fireEvent.submit(globalSearch.form);
  const search = await until(() => ui.queryByRole('searchbox', { name: 'Search conversations' }));
  fireEvent.input(search, { target: { value: 'archive' } });
  await until(() => !ui.queryByRole('button', { name: /Quarterly planning/ }));
  assert.ok(ui.getByRole('button', { name: /Archive this draft/ }));
  fireEvent.click(ui.getByRole('button', { name: 'Delete conversation' }));
  const confirm = getQueriesForElement(await until(() => ui.queryByRole('dialog', { name: 'Delete this conversation?' })));
  fireEvent.click(confirm.getByRole('button', { name: 'Delete conversation' }));
  await until(() => ui.queryByRole('heading', { name: 'No matching conversations' }));
  assert.deepEqual(JSON.parse(window.localStorage.getItem('cloudcore-chats')).map(chat => chat.id), ['keep-chat']);
  assert.equal(ui.getByRole('searchbox', { name: 'Search conversations' }).value, 'archive');
  fireEvent.click(await until(() => ui.queryByRole('button', { name: /Fixture User/ })));
  fireEvent.click(await until(() => ui.queryByRole('button', { name: 'Sign out' })));
  await until(() => ui.queryByRole('link', { name: 'Explore AI Workspace' }));
  assert.equal(window.location.hash, '#landing');
  assert.equal(ui.queryByRole('navigation', { name: 'Product navigation' }), null);
});

test('The production router restores an encoded meeting deep link and recovers from a malformed link', async t => {
  const user = { id: 'meeting-member', role: 'member', displayName: 'Fixture Member' };
  const capacity = { active: 0, maximum: 2 };
  const meeting = { id: 'budget/week', title: 'Budget review', status: 'completed', createdAt: now };
  let finishRestore;
  const requests = [];
  const { window, ui, boot } = await productionWindow(t, '#meetings/budget%2Fweek', async path => {
    requests.push(path);
    if (path === '/api/me') return new Promise(resolve => { finishRestore = resolve; });
    const data = path === '/api/meetings' ? { meetings: [], capacity } : meeting;
    return { status: 200, ok: true, json: async () => data };
  });
  await boot();
  await until(() => ui.queryByRole('button', { name: 'Sign In' }));
  assert.equal(window.location.hash, '#meetings/budget%2Fweek');
  assert.deepEqual(requests, ['/api/me']);
  finishRestore({ status: 200, ok: true, json: async () => ({ user, capacity }) });
  await until(() => ui.queryByRole('heading', { name: 'Budget review' }));
  assert.ok(requests.includes('/api/meetings/budget%2Fweek'));

  window.location.hash = 'meetings/%ZZ';
  await until(() => ui.queryByRole('heading', { name: 'Meeting Intelligence' }));
  assert.ok(requests.includes('/api/meetings'));
  assert.equal(requests.some(path => path.includes('%ZZ')), false);
});

test('Navigating between meetings aborts the previous refresh and keeps the current detail', async t => {
  const user = { id: 'poll-member', role: 'member', displayName: 'Fixture Member' };
  const pending = new Map();
  const { window, ui, boot } = await productionWindow(t, '#meetings/first-meeting', async (path, options) => {
    if (path.startsWith('/api/meetings/')) {
      return new Promise(resolve => pending.set(path, { resolve, signal: options.signal }));
    }
    return { status: 200, ok: true, json: async () => ({ user }) };
  });
  function complete(id, title, status) {
    pending.get(`/api/meetings/${id}`).resolve({ status: 200, ok: true, json: async () => ({ id, title, status, createdAt: now }) });
  }
  const delays = [];
  const schedule = window.setTimeout.bind(window);
  window.setTimeout = (callback, delay, ...args) => { delays.push(delay); return schedule(callback, delay, ...args); };
  await boot();
  const first = await until(() => pending.get('/api/meetings/first-meeting'));
  window.location.hash = '#meetings/second-meeting';
  await until(() => pending.has('/api/meetings/second-meeting'));
  assert.equal(first.signal.aborted, true);
  complete('second-meeting', 'Current meeting', 'recording');
  await until(() => ui.queryByRole('heading', { name: 'Current meeting' }));
  assert.ok(delays.includes(5000));
  complete('first-meeting', 'Stale meeting', 'completed');
  await wait(15);
  assert.ok(ui.getByRole('heading', { name: 'Current meeting' }));
  assert.equal(ui.queryByRole('heading', { name: 'Stale meeting' }), null);
  assert.equal(delays.includes(8000), false);
});

test('Production Meetings recovers its saved list, keeps search during refresh, and launches through the existing API', async t => {
  const capacity = { active: 0, maximum: 2 };
  const archived = { id: 'saved-meeting', title: 'Saved planning call', status: 'completed', createdAt: now,
    mom: { topics: [{ title: 'Budget approvals', notes: 'Finance will review the estimates.' }] },
    transcript: [{ text: 'Saved transcript segment.', startMs: 4000 }] };
  const older = { id: 'older-meeting', title: 'Older review', status: 'completed', createdAt: now };
  const live = { id: 'new-meeting', title: 'New fixture meeting', status: 'recording', createdAt: now };
  const requests = [];
  let listRequests = 0;
  let rejectLaunch;
  const { window, ui, boot } = await productionWindow(t, '#meetings', async (path, options) => {
    let data = {};
    requests.push({ path, options });
    if (path === '/api/me') data = { user: { id: 'member-fixture', role: 'member', displayName: 'Fixture' }, capacity };
    if (path === '/api/meetings') {
      if (options?.method === 'POST') {
        if (!rejectLaunch) return new Promise(resolve => { rejectLaunch = resolve; });
        data = live;
      }
      else if (++listRequests === 1) {
        return { status: 503, ok: false, json: async () => ({ error: { message: 'Meeting service temporarily unavailable.' } }) };
      } else data = { meetings: [archived, older], capacity: { ...capacity, active: listRequests > 2 ? 1 : 0 } };
    }
    if (path === '/api/meetings/saved-meeting') data = archived;
    if (path === '/api/meetings/new-meeting') data = live;
    return { status: 200, ok: true, json: async () => data };
  });
  await boot();
  await until(() => ui.queryByRole('alert')?.textContent.includes('Meeting service temporarily unavailable.'));
  fireEvent.click(ui.getByRole('button', { name: 'Refresh meetings' }));
  await until(() => ui.queryByRole('button', { name: /Saved planning call/ }));
  assert.ok(ui.getByText('Budget approvals'));
  const search = ui.getByRole('textbox', { name: 'Search meetings' });
  fireEvent.input(search, { target: { value: 'planning' } });
  await until(() => !ui.queryByRole('button', { name: /Older review/ }));
  fireEvent.click(ui.getByRole('button', { name: 'Refresh meetings' }));
  await until(() => listRequests === 3);
  fireEvent.click(ui.getByRole('button', { name: 'New Meeting' }));
  const dialog = await until(() => window.document.querySelector('#dialog[open]'));
  fireEvent.click(dialog.querySelector('.dialog-close'));
  await until(() => !dialog.open);
  fireEvent.click(ui.getByRole('button', { name: 'New Meeting' }));
  await until(() => dialog.open);
  fireEvent.click(dialog);
  await until(() => !dialog.open);
  fireEvent.click(ui.getByRole('button', { name: 'New Meeting' }));
  const modal = getQueriesForElement(dialog);
  const join = await until(() => modal.queryByRole('button', { name: 'Join meeting now' }));
  assert.equal(ui.getByRole('textbox', { name: 'Search meetings' }), search);
  assert.equal(search.value, 'planning');
  await until(() => ui.queryByText('1 of 2 meeting slots active'));
  const url = 'https://teams.microsoft.com/meet/123456';
  modal.getByLabelText('Microsoft Teams link').value = url;
  fireEvent.click(join);
  assert.ok(!requests.some(({ options }) => options?.method === 'POST'));
  fireEvent.click(modal.getByRole('checkbox'));
  fireEvent.click(join);
  await until(() => rejectLaunch);
  const starting = await until(() => modal.queryByRole('button', { name: 'Starting bot…' }));
  assert.equal(starting.disabled, true);
  fireEvent.submit(starting.form);
  assert.equal(requests.filter(({ options }) => options?.method === 'POST').length, 1);
  rejectLaunch({ status: 503, ok: false, json: async () => ({ error: { message: 'Meeting bot temporarily unavailable.' } }) });
  await until(() => modal.queryByRole('alert')?.textContent === 'Meeting bot temporarily unavailable.');
  assert.equal(modal.getByLabelText('Microsoft Teams link').value, url);
  assert.equal(modal.getByRole('checkbox').checked, true);
  fireEvent.click(modal.getByRole('button', { name: 'Join meeting now' }));
  await until(() => ui.queryByRole('heading', { name: 'New fixture meeting' }));
  assert.equal(window.location.hash, '#meetings/new-meeting');
  const launched = requests.filter(({ options }) => options?.method === 'POST');
  assert.equal(launched.length, 2);
  for (const request of launched) assert.deepEqual(JSON.parse(request.options.body), { meetingUrl: url, consent: true });
  assert.ok(ui.getByRole('button', { name: 'Stop bot' }));
  fireEvent.click(ui.getByRole('link', { name: 'Meetings AI' }));
  fireEvent.click(await until(() => ui.queryByRole('button', { name: 'Transcript' })));
  await until(() => ui.queryByText('Saved transcript segment.'));
  assert.equal(window.location.hash, '#meetings/saved-meeting');
});

test('Production meeting detail updates the active tab and uses the existing meeting actions', async t => {
  const id = 'detail-fixture';
  const endpoint = `/api/meetings/${id}`;
  const transcript = [{ id: 'segment-1', speakerName: 'Mina', text: 'Planning the quarterly review.', startMs: 4000 }];
  const meeting = {
    id, title: 'Quarterly review', status: 'recording', createdAt: now, expiresAt: now, transcript,
    participants: [{ id: 'participant-1', displayName: 'Mina' }], snapshots: [],
    mom: { summary: 'Original minutes', topics: [{ title: 'Budget', notes: 'Under review', timestampMs: 4000 }] },
  };
  const calls = [];
  let stream;
  let deleted = false;
  const { window, ui, boot } = await productionWindow(t, '#meetings/' + id, async (path, options) => {
    calls.push({ path, options });
    let data = {};
    if (path === '/api/me') data = { user: { id: 'member-fixture', role: 'member', displayName: 'Fixture' } };
    if (path === '/api/meetings') data = { meetings: deleted ? [] : [meeting], capacity: { active: 0, maximum: 2 } };
    if (path === endpoint && options?.method === 'DELETE') deleted = true;
    else if (path === endpoint) data = structuredClone(meeting);
    if (path === `${endpoint}/chat?stream=true`) {
      return { ok: true, body: new ReadableStream({ start(controller) { stream = controller; } }) };
    }
    if (path === `${endpoint}/mom`) meeting.mom = JSON.parse(options.body);
    if (path === `${endpoint}/regenerate-mom`) meeting.mom = { summary: 'Regenerated meeting minutes.' };
    if (path === `${endpoint}/capture-snapshot`) meeting.snapshots.push({ id: 'snapshot-1', capturedAtMs: 4000 });
    if (path === `${endpoint}/stop`) {
      meeting.status = 'completed';
      meeting.recordingObjectKey = 'private-backend-object';
    }
    return { status: 200, ok: true, json: async () => data };
  });
  let report = '';
  const polls = holdTimers(window, [5000, 8000]);
  async function refreshThroughPoll() {
    const next = await until(() => polls.values().next().value);
    next();
    await until(() => polls.size === 1);
  }
  window.open = () => ({ document: { open() {}, write(value) { report = value; }, close() {} } });
  let markdownDownload;
  let markdownBlob;
  let copied = '';
  window.Blob = Blob;
  Object.defineProperty(window.navigator, 'clipboard', { value: { async writeText(value) { copied = value; } } });
  window.URL.createObjectURL = blob => { markdownBlob = blob; return 'blob:meeting-markdown-fixture'; };
  window.URL.revokeObjectURL = () => {};
  window.HTMLAnchorElement.prototype.click = function () { markdownDownload = this.download; };
  await boot();
  await until(() => ui.queryByRole('heading', { name: meeting.title }));
  assert.ok(ui.getByText('Mina'));
  function select(name) {
    const buttons = getQueriesForElement(ui.getByRole('group', { name: 'Meeting detail sections' }));
    fireEvent.click(buttons.getByRole('button', { name }));
  }
  select(/^Transcript/);
  const search = await until(() => ui.queryByRole('searchbox', { name: 'Search transcript' }));
  fireEvent.input(search, { target: { value: 'mina' } });
  search.focus();
  await until(() => ui.queryByText('1 of 1 segments'));
  meeting.transcript.push(
    { id: 'segment-2', speakerName: 'Ravi', text: 'An unrelated update.', startMs: 8000 },
    { id: 'segment-3', speakerName: 'Mina', text: '<img src=x> Approved the review.', startMs: 9000 },
  );
  await refreshThroughPoll();
  await until(() => ui.queryByText('2 of 3 segments'));
  assert.equal(window.document.activeElement, search);
  assert.equal(search.value, 'mina');
  assert.equal(ui.queryByText('An unrelated update.'), null);
  assert.ok(ui.getByText('<img src=x> Approved the review.'));
  assert.equal(window.document.querySelector('.transcript-list img'), null);

  select('MOM');
  const summary = await until(() => ui.queryByRole('textbox', { name: 'Executive summary' }));
  summary.value = 'Updated minutes for the review <img src=x>';
  await refreshThroughPoll();
  assert.equal(summary.value, 'Updated minutes for the review <img src=x>');
  fireEvent.click(ui.getByRole('button', { name: 'Preview Report' }));
  assert.ok(report.includes('Updated minutes for the review &lt;img src=x&gt;'));
  assert.ok(!report.includes('<img src=x>'));
  fireEvent.click(ui.getByRole('button', { name: 'Copy' }));
  await until(() => copied.includes(summary.value));
  fireEvent.click(ui.getByRole('button', { name: 'Markdown' }));
  assert.equal(markdownDownload, 'meeting-mom.md');
  assert.equal(await markdownBlob.text(), copied);
  fireEvent.click(ui.getByRole('button', { name: 'Download PDF / Print' }));
  const printFrame = window.document.getElementById('mom-print-frame');
  assert.equal(printFrame.contentDocument.querySelector('.mom-summary-text').textContent, summary.value);
  assert.equal(printFrame.contentDocument.querySelector('img[src="x"]'), null);
  let printCalls = 0;
  printFrame.contentWindow.focus = () => {};
  printFrame.contentWindow.print = () => { printCalls++; };
  await until(() => printCalls === 1);
  fireEvent.click(ui.getByRole('button', { name: 'Save changes' }));
  await until(() => meeting.mom.summary === summary.value);
  assert.equal(meeting.mom.topics[0].timestampMs, 4000);

  select(/^AI Assistant Q&A/);
  const question = await until(() => ui.queryByRole('textbox', { name: 'Ask about this meeting' }));
  question.value = 'What was approved?';
  fireEvent.click(ui.getByRole('button', { name: 'Ask', exact: true }));
  await until(() => ui.queryByText('Analyzing meeting transcript...'));
  const encode = value => new TextEncoder().encode(value);
  stream.enqueue(encode('data: {"delta":"The review "}\n\n'));
  await until(() => ui.queryByText('The review'));
  assert.deepEqual(JSON.parse(calls.find(call => call.path.endsWith('/chat?stream=true')).options.body), {
    message: 'What was approved?', history: [],
  });
  select(/^Transcript/);
  await until(() => ui.queryByRole('searchbox', { name: 'Search transcript' }));
  assert.equal(ui.getByRole('searchbox', { name: 'Search transcript' }).value, 'mina');
  stream.enqueue(encode('data: {"delta":"was approved."}\n\ndata: [DONE]\n\n'));
  stream.close();
  select(/^AI Assistant Q&A/);
  await until(() => ui.queryByText('The review was approved.'));

  select(/^Snapshots/);
  const liveImage = await until(() => ui.queryByAltText('Live bot screen view'));
  assert.ok(ui.getByText(/Vexa Screen Stream/));
  assert.ok(liveImage.getAttribute('src').startsWith(`${endpoint}/live-screenshot?t=`));
  fireEvent.error(liveImage);
  await until(() => !ui.queryByAltText('Live bot screen view'));
  fireEvent.click(ui.getByRole('button', { name: 'Refresh Live Screen' }));
  await until(() => ui.queryByAltText('Live bot screen view'));
  fireEvent.click(ui.getByRole('button', { name: 'Capture Snapshot' }));
  const snapshot = await until(() => ui.queryByAltText('Screen snapshot at 00:04'));
  assert.equal(snapshot.getAttribute('src'), `${endpoint}/snapshots/snapshot-1`);
  assert.equal(calls.filter(({ path, options }) => path === `${endpoint}/capture-snapshot` && options?.method === 'POST').length, 1);

  select('Audio');
  await until(() => ui.queryByText('Live Audio Recording In Progress'));
  fireEvent.click(ui.getByRole('button', { name: 'Stop bot' }));
  const download = await until(() => ui.queryByRole('link', { name: 'Download Audio' }));
  assert.equal(download.getAttribute('href'), `${endpoint}/audio`);
  assert.equal(download.getAttribute('download'), 'Quarterly review-audio.webm');
  const audio = window.document.querySelector('audio');
  await refreshThroughPoll();
  assert.equal(window.document.querySelector('audio'), audio);
  assert.equal(ui.queryByRole('button', { name: 'Stop bot' }), null);
  meeting.mom = undefined;
  await refreshThroughPoll();
  select('MOM');
  fireEvent.click(await until(() => ui.queryByRole('button', { name: 'Generate MOM' })));
  await until(() => ui.queryByRole('textbox', { name: 'Executive summary' })?.value === 'Regenerated meeting minutes.');
  assert.equal(calls.filter(({ path, options }) => path === `${endpoint}/regenerate-mom` && options?.method === 'POST').length, 1);
  window.confirm = () => false;
  fireEvent.click(ui.getByRole('button', { name: 'Delete meeting' }));
  assert.equal(deleted, false);
  window.confirm = () => true;
  fireEvent.click(ui.getByRole('button', { name: 'Delete meeting' }));
  await until(() => ui.queryByRole('heading', { name: 'No meetings yet' }));
  assert.equal(window.location.hash, '#meetings');
  assert.equal(calls.filter(({ path, options }) => path === endpoint && options?.method === 'DELETE').length, 1);
});

test('Production Assistant keeps streamed replies, citations, and drafts in the right conversation', async t => {
  const streams = new Map();
  const requests = [];
  const { window, ui, boot } = await productionWindow(t, '#assistant', async (path, options) => {
    if (path === '/api/chat?stream=true') {
      const request = JSON.parse(options.body);
      requests.push(request);
      return { ok: true, body: new ReadableStream({ start(controller) { streams.set(request.message, controller); } }) };
    }
    return { ok: true, status: 200, json: async () => ({ user: { id: 'member-fixture', role: 'member', displayName: 'Fixture' } }) };
  });
  const getInput = () => ui.queryByRole('textbox', { name: 'Message CloudCore AI' });
  const encode = value => new TextEncoder().encode(value);
  const finish = (stream, result) => {
    stream.enqueue(encode(`data: ${JSON.stringify(result)}\n\ndata: [DONE]\n\n`));
    stream.close();
  };
  await boot();
  const first = await until(getInput);
  fireEvent.input(first, { target: { value: 'First request' } });
  fireEvent.submit(first.form);
  const firstStream = await until(() => streams.get('First request'));
  const chunk = encode(': keepalive\r\ndata: invalid-json\r\ndata:{"choices":[{"delta":{"content":"Working on it ✓"}}]}\r\n\r\n');
  const insideCheckmark = chunk.indexOf(encode('✓')[0]) + 1;
  firstStream.enqueue(chunk.slice(0, insideCheckmark));
  firstStream.enqueue(chunk.slice(insideCheckmark));
  await until(() => ui.queryByText('Working on it ✓'));

  fireEvent.click(window.document.querySelector('#workspace-react-header .ref-new-chat'));
  const next = await until(() => ui.queryByRole('heading', { name: 'CloudCore AI', level: 1 }) && getInput());
  fireEvent.input(next, { target: { value: 'Second request' } });
  fireEvent.submit(next.form);
  const secondStream = await until(() => streams.get('Second request'));
  const nextDraft = await until(() => ui.queryByText('Second request') && getInput());
  fireEvent.input(nextDraft, { target: { value: 'Keep my draft' } });
  finish(firstStream, { replace: '**First answer** <img src=x>', citations: [
    { documentId: 'a b/c', filename: 'Policy notes', sourceId: 2 },
    { documentId: 'chat-upload', filename: 'Uploaded policy' },
  ] });
  secondStream.enqueue(encode('data: {"delta":"Second answer"}'));
  secondStream.close();
  await until(() => ui.queryByText('Second answer'));
  assert.equal(getInput(), nextDraft);
  assert.equal(getInput().value, 'Keep my draft');
  assert.equal(ui.queryByText(/First answer/), null);
  assert.deepEqual(requests.map(({ message, history, use_rag }) => ({ message, history, use_rag })), [
    { message: 'First request', history: [], use_rag: false },
    { message: 'Second request', history: [], use_rag: false },
  ]);

  window.location.hash = 'history';
  fireEvent.click(await until(() => ui.queryByRole('button', { name: /First request/ })));
  const policy = await until(() => ui.queryByRole('link', { name: /Policy notes/ }));
  assert.equal(policy.getAttribute('href'), '/api/knowledge/documents/a%20b%2Fc/view');
  assert.equal(ui.getByRole('link', { name: /Uploaded policy/ }).getAttribute('href'), '/api/chat/document');
  assert.equal(ui.getByText('First answer').tagName, 'STRONG');
  assert.equal(window.document.querySelector('.messages img[src="x"]'), null);
  assert.equal(ui.queryByText('Second answer'), null);
});

test('Assistant restores local conversations and never recreates one deleted while a reply is streaming', async t => {
  const user = { id: 'history-fixture', role: 'member', displayName: 'Fixture Member' };
  let stream;
  const { window, ui, boot } = await productionWindow(t, '#assistant', async path => {
    if (path === '/api/chat?stream=true') return { ok: true, body: new ReadableStream({ start(controller) { stream = controller; } }) };
    return { status: 200, ok: true, json: async () => ({ user }) };
  });
  const history = () => JSON.parse(window.localStorage.getItem('cloudcore-chats'));
  const input = () => ui.getByRole('textbox', { name: 'Message CloudCore AI' });
  function ask(text) {
    fireEvent.input(input(), { target: { value: text } });
    fireEvent.submit(input().form);
  }
  window.localStorage.setItem('cloudcore-chats', JSON.stringify([null, { invalid: true }]));
  await boot();
  await until(() => ui.queryByRole('textbox', { name: 'Message CloudCore AI' }));
  const fetch = window.fetch;
  window.fetch = undefined;
  ask('How can I analyze a document?');
  await until(() => ui.queryByText(/once an AI service is connected/));
  assert.equal(history().length, 1);
  fireEvent.click(window.document.querySelector('#workspace-react-header .ref-new-chat'));
  await until(() => ui.queryByRole('heading', { name: 'CloudCore AI', level: 1 }));
  window.fetch = fetch;
  ask('Delete this pending chat');
  await until(() => stream);
  assert.equal(history().length, 2);
  assert.equal('streaming' in history()[0].messages[1], false);

  window.location.hash = 'history';
  const row = (await until(() => ui.queryByRole('button', { name: /Delete this pending chat/ }))).closest('article');
  fireEvent.click(getQueriesForElement(row).getByRole('button', { name: 'Delete conversation' }));
  const confirmation = await until(() => ui.queryByRole('dialog', { name: 'Delete this conversation?' }));
  fireEvent.click(getQueriesForElement(confirmation).getByRole('button', { name: 'Delete conversation' }));
  await until(() => history().length === 1);
  stream.enqueue(new TextEncoder().encode('data: {"delta":"Late reply"}\n\ndata: [DONE]\n\n'));
  stream.close();
  fireEvent.click(await until(() => ui.queryByRole('button', { name: /How can I analyze a document/ })));
  await until(() => ui.queryByText(/once an AI service is connected/));
  assert.equal(history().length, 1);
  assert.equal(ui.queryByText('Late reply'), null);
});

test('Production Assistant reads a JSON fallback response even when the body is a readable stream', async t => {
  const user = { id: 'json-chat-member', role: 'member', displayName: 'Fixture Member' };
  const answer = [
    '## Answer returned in JSON.', '> Reviewed against the source.', '- Use **the `report_id` field**.',
    '| Control | State |', '| --- | --- |', '| Review | *Complete* |',
    '```html', '  <img src=x onerror=alert(1)>', '  *literal asterisks*', '```', '<script>alert(1)</script>',
  ].join('\r\n');
  const reply = Response.json({ answer, citations: [{ documentId: 'json-doc', filename: 'Source.pdf' }] });
  const { window, ui, boot } = await productionWindow(t, '#assistant', async (path, options) => {
    if (path === '/api/chat?stream=true') {
      assert.equal(options.headers['x-requested-with'], 'CloudCoreAI');
      return reply;
    }
    return { status: 200, ok: true, json: async () => ({ user }) };
  });
  await boot();
  const prompt = await until(() => ui.queryByRole('textbox', { name: 'Message CloudCore AI' }));
  fireEvent.input(prompt, { target: { value: 'What is the answer?' } });
  fireEvent.submit(prompt.form);
  await until(() => ui.queryByRole('heading', { name: 'Answer returned in JSON.', level: 3 }));
  assert.equal(ui.getByRole('link', { name: /Source.pdf/ }).getAttribute('href'), '/api/knowledge/documents/json-doc/view');
  const messages = window.document.querySelector('.messages');
  assert.equal(messages.querySelector('blockquote').textContent, 'Reviewed against the source.');
  assert.equal(messages.querySelector('li strong code').textContent, 'report_id');
  assert.equal(ui.getByRole('columnheader', { name: 'Control' }).textContent, 'Control');
  assert.equal(ui.getByRole('cell', { name: 'Complete' }).querySelector('em').textContent, 'Complete');
  assert.equal(messages.querySelector('pre code').textContent, '  <img src=x onerror=alert(1)>\n  *literal asterisks*');
  assert.ok(ui.getByText('<script>alert(1)</script>'));
  assert.equal(messages.querySelector('script, img[src="x"]'), null);
});

test('Production Assistant preserves attachment drafts and uses document indexing and Vision APIs', async t => {
  const calls = [];
  const { window, ui, boot } = await productionWindow(t, '#assistant', async (path, options) => {
    calls.push({ path, options });
    const data = {
      '/api/me': { user: { id: 'member-fixture', role: 'member', displayName: 'Fixture' } },
      '/api/documents/upload': { job_id: 'fixture-job', filename: 'agenda.txt', status: 'queued' },
      '/api/jobs/fixture-job': { filename: 'agenda.txt', status: 'finished' },
      '/api/chat?stream=true': { answer: 'Agenda summary.' },
      '/api/vision': { answer: 'The image shows a status board.', imageUrl: '/api/fake-vision-image' },
    }[path];
    return { status: 200, ok: true, json: async () => data };
  });
  window.URL.createObjectURL = () => 'blob:fixture-image';
  window.URL.revokeObjectURL = () => {};
  await boot();
  const input = await until(() => ui.queryByRole('textbox', { name: 'Message CloudCore AI' }));
  const bell = await until(() => ui.queryByRole('button', { name: 'Notifications' }));
  fireEvent.click(bell);
  const notifications = getQueriesForElement(await until(() => ui.queryByRole('dialog', { name: 'Notifications' })));
  fireEvent.click(notifications.getByRole('button', { name: 'Close' }));
  await until(() => !bell.classList.contains('has-unread'));
  const documentInput = window.document.getElementById('document-input');
  fireEvent.input(input, { target: { value: 'Summarize the agenda' } });
  fireEvent.click(ui.getByRole('button', { name: 'Attach a document', exact: true }));
  fireEvent.change(documentInput, { target: { files: [new window.File(['Agenda'], 'agenda.txt', { type: 'text/plain' })] } });
  await until(() => ui.queryByText('Indexing…', { exact: true }));
  assert.equal(input.value, 'Summarize the agenda');
  fireEvent.submit(input.form);
  assert.equal(calls.filter(({ path }) => path === '/api/chat?stream=true').length, 0);
  await until(() => ui.queryByText('Agenda summary.'));
  assert.ok(ui.getByText('Ready for Q&A'));
  assert.equal(ui.getByRole('button', { name: 'Notifications' }).classList.contains('has-unread'), false);
  const upload = calls.find(({ path }) => path === '/api/documents/upload');
  assert.equal(upload.options.body.get('file').name, 'agenda.txt');
  const draft = ui.getByRole('textbox', { name: 'Message CloudCore AI' });
  fireEvent.input(draft, { target: { value: 'Describe the dashboard' } });
  fireEvent.click(ui.getByRole('button', { name: 'Remove attached document' }));
  await until(() => !ui.queryByText('Ready for Q&A'));
  assert.equal(draft.value, 'Describe the dashboard');
  fireEvent.click(ui.getByRole('button', { name: 'Upload an image' }));
  fireEvent.change(window.document.getElementById('image-input'), {
    target: { files: [new window.File(['fixture'], 'dashboard.png', { type: 'image/png' })] },
  });
  await until(() => ui.queryByText('Ready for Vision AI'));
  assert.equal(draft.value, 'Describe the dashboard');
  fireEvent.submit(draft.form);
  await until(() => ui.queryByText('The image shows a status board.'));
  const vision = calls.find(({ path }) => path === '/api/vision');
  assert.equal(vision.options.body.get('question'), 'Describe the dashboard');
  assert.equal(vision.options.body.get('image').name, 'dashboard.png');
  const image = ui.getByAltText('dashboard.png');
  assert.equal(image.getAttribute('src'), '/api/fake-vision-image');
  fireEvent.click(image.closest('button'));
  const lightbox = getQueriesForElement(await until(() => ui.queryByRole('dialog', { name: 'Visual Inspection Lightbox' })));
  fireEvent.click(lightbox.getByRole('button', { name: '200% Zoom' }));
  await until(() => lightbox.queryByRole('button', { name: '200% Zoom', pressed: true }));
  fireEvent.click(lightbox.getByRole('button', { name: 'Use This Prompt' }));
  const studioPrompt = await until(() => ui.queryByRole('textbox', { name: 'Your prompt' }));
  assert.equal(studioPrompt.value, 'dashboard.png');
});

test('Replacing an indexing attachment stops its poll and blocks the question queued for it', async t => {
  const user = { id: 'index-fixture', role: 'member', displayName: 'Fixture Member' };
  const chatRequests = [];
  let oldPoll;
  let finishOldPoll;
  const { window, ui, boot } = await productionWindow(t, '#assistant', async (path, options) => {
    let data;
    if (path === '/api/me') data = { user };
    if (path === '/api/documents/upload') {
      const filename = options.body.get('file').name;
      data = filename === 'old.txt' ? { job_id: 'old/id', status: 'queued' } : { status: 'finished', filename };
    }
    if (path === '/api/jobs/old%2Fid') {
      oldPoll = options.signal;
      return new Promise(resolve => { finishOldPoll = resolve; });
    }
    if (path === '/api/chat?stream=true') {
      chatRequests.push(JSON.parse(options.body));
      data = { answer: 'The replacement is ready.' };
    }
    return { status: 200, ok: true, json: async () => data };
  });
  const prompt = () => ui.getByRole('textbox', { name: 'Message CloudCore AI' });
  function attach(name) {
    fireEvent.change(window.document.getElementById('document-input'), {
      target: { files: [new window.File(['document'], name, { type: 'text/plain' })] },
    });
  }
  function ask(text) {
    fireEvent.input(prompt(), { target: { value: text } });
    fireEvent.submit(prompt().form);
  }
  await boot();
  await until(() => ui.queryByRole('textbox', { name: 'Message CloudCore AI' }));
  attach('old.txt');
  await until(() => ui.queryByText('Indexing…', { exact: true }));
  ask('Summarize the old document');
  await until(() => oldPoll);
  assert.deepEqual(chatRequests, []);

  attach('replacement.txt');
  assert.equal(oldPoll.aborted, true);
  await until(() => ui.queryByText('Ready for Q&A'));
  finishOldPoll({ status: 200, ok: true, json: async () => ({ status: 'finished', filename: 'old.txt' }) });
  await until(() => ui.queryByText(/The document attachment changed/));
  assert.deepEqual(chatRequests, []);
  assert.ok(ui.getByText('replacement.txt'));

  ask('Summarize the replacement');
  await until(() => ui.queryByText('The replacement is ready.'));
  assert.deepEqual(chatRequests.map(request => request.message), ['Summarize the replacement']);
});

test('Production Assistant attaches clipboard images only while on the Assistant route', async t => {
  const user = { id: 'paste-member', role: 'member', displayName: 'Fixture User' };
  const { window, ui, boot } = await productionWindow(t, '#assistant', async path => ({
    status: 200, ok: true, json: async () => path === '/api/me' ? { user } : {},
  }));
  const urls = [];
  window.URL.createObjectURL = file => { urls.push(file.name); return `blob:fixture-${urls.length}`; };
  window.URL.revokeObjectURL = () => {};
  function paste(...items) {
    const event = new window.Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', { value: { items } });
    window.document.activeElement.dispatchEvent(event);
    return event.defaultPrevented;
  }
  const text = { type: 'text/plain', getAsFile: () => null };
  const image = name => ({ type: 'image/png', getAsFile: () => new window.File(['photo'], name, { type: 'image/png' }) });
  await boot();
  const prompt = await until(() => ui.queryByRole('textbox', { name: 'Message CloudCore AI' }));
  fireEvent.input(prompt, { target: { value: 'Explain this chart' } });
  assert.equal(paste(text), false);
  assert.equal(paste(text, image('clipboard.png')), true);
  await until(() => ui.queryByText('clipboard.png'));
  assert.equal(prompt.value, 'Explain this chart');

  window.location.hash = 'home';
  await until(() => ui.queryByRole('heading', { name: 'Good morning, Fixture' }));
  assert.equal(paste(image('ignored.png')), false);
  window.location.hash = 'assistant';
  await until(() => ui.queryByRole('textbox', { name: 'Message CloudCore AI' }));
  assert.equal(paste(image('replacement.png')), true);
  await until(() => ui.queryByText('replacement.png'));
  assert.deepEqual(urls, ['clipboard.png', 'replacement.png']);
});

test('Production Settings saves profile and preferences, validates password changes, and refreshes service status', async t => {
  const calls = [];
  const identity = { id: 'settings-member', role: 'member', username: 'member-fixture', displayName: 'Original Name' };
  let capacity = { active: 0, maximum: 2 };
  let connected = true;
  let failProfile = true;
  const { window, ui, boot } = await productionWindow(t, '#settings', async (path, options) => {
    calls.push({ path, options });
    if (path === '/api/me/profile' && failProfile) {
      failProfile = false;
      return { status: 400, ok: false, json: async () => ({ error: { message: 'The email could not be saved.' } }) };
    }
    if (path === '/api/me/profile') Object.assign(identity, JSON.parse(options.body));
    const data = path === '/api/ai/health' ? { connected, model: 'Fixture-Qwen' } : { user: { ...identity }, capacity };
    return { status: 200, ok: true, json: async () => data };
  });
  window.localStorage.setItem('cloudcore-chats', JSON.stringify([
    { id: 'settings-chat', title: 'Local conversation', updated: now, messages: [{ role: 'user', content: 'Saved message' }] },
  ]));
  let exported;
  window.URL.createObjectURL = () => 'blob:settings-fixture';
  window.URL.revokeObjectURL = () => {};
  window.HTMLAnchorElement.prototype.click = function () { exported = this.download; };
  await boot();
  const save = await until(() => ui.queryByRole('button', { name: 'Save Profile Changes' }));
  ui.getByRole('textbox', { name: 'Name', exact: true }).value = 'Updated Name';
  ui.getByRole('textbox', { name: 'Email', exact: true }).value = 'sample@example.test';
  fireEvent.click(save);
  await until(() => ui.queryByText('The email could not be saved.'));
  fireEvent.click(save);
  await until(() => ui.queryByRole('heading', { name: 'Updated Name' }));
  const profileButton = await until(() => ui.queryByRole('button', { name: 'Profile for Updated Name' }));
  assert.match(profileButton.textContent, /member/);
  assert.equal(calls.find(({ path }) => path === '/api/me/profile').options.method, 'PATCH');

  const account = ui.getByRole('tab', { name: 'Account' });
  fireEvent.keyDown(account, { key: 'ArrowRight' });
  await until(() => ui.queryByRole('tab', { name: 'Preferences', selected: true }));
  const motion = ui.getByRole('button', { name: 'Off (Static)' });
  fireEvent.click(motion);
  fireEvent.click(ui.getByRole('button', { name: 'Concise' }));
  await until(() => motion.getAttribute('aria-pressed') === 'true');
  const prefs = JSON.parse(window.localStorage.getItem('cloudcore-prefs'));
  assert.equal(prefs.motionMode, 'off');
  assert.equal(prefs.responseStyle, 'concise');
  assert.ok(window.document.documentElement.classList.contains('cc-reduced-motion'));
  fireEvent.click(ui.getByRole('button', { name: /Export Chat History/ }));
  assert.match(exported, /\.json$/);
  fireEvent.click(ui.getByRole('button', { name: 'Clear All Local Conversations' }));
  fireEvent.click(await until(() => ui.queryByRole('button', { name: 'Clear all history' })));
  await until(() => ui.queryByText(/0 conversations \(0 messages\)/));
  assert.deepEqual(JSON.parse(window.localStorage.getItem('cloudcore-chats')), []);

  fireEvent.click(ui.getByRole('tab', { name: 'Security', exact: true }));
  const update = await until(() => ui.queryByRole('button', { name: 'Update Password' }));
  ui.getByLabelText('Current Password').value = 'old-fixture-password';
  ui.getByLabelText('New Password', { exact: true }).value = 'new-fixture-password';
  ui.getByLabelText('Confirm Password').value = 'different-password';
  fireEvent.click(update);
  await until(() => ui.queryByText('New passwords do not match.'));
  assert.ok(!calls.some(({ path }) => path.startsWith('/api/admin/')));
  assert.ok(!calls.some(({ path }) => path === '/api/auth/change-password'));
  ui.getByLabelText('Confirm Password').value = 'new-fixture-password';
  fireEvent.click(update);
  await until(() => ui.getByLabelText('Current Password').value === '');
  assert.deepEqual(JSON.parse(calls.find(({ path }) => path === '/api/auth/change-password').options.body), {
    currentPassword: 'old-fixture-password', newPassword: 'new-fixture-password',
  });

  fireEvent.click(ui.getByRole('tab', { name: 'Integrations' }));
  await until(() => ui.queryByText('Model: Fixture-Qwen'));
  assert.ok(ui.getByText('Connected'));
  connected = false;
  capacity = { active: 1, maximum: 3 };
  fireEvent.click(ui.getByRole('button', { name: 'Refresh Status' }));
  await until(() => ui.queryByText('1 / 3 Active'));
  assert.ok(ui.getByText('Offline'));
});

test('Production Settings preserves admin scope and requires confirmation before account removal', async t => {
  const admin = { id: 'settings-admin', role: 'admin', username: 'admin-fixture', displayName: 'Fixture Admin' };
  const requests = [];
  let accounts = [admin, { id: 'dev-fixture', role: 'dev', username: 'dev-only' }];
  const { ui, boot } = await productionWindow(t, '#settings', async (path, options) => {
    requests.push({ path, options });
    if (path === '/api/admin/users' && options?.method === 'POST') {
      const user = JSON.parse(options.body);
      accounts = [...accounts, { ...user, id: 'new-user', password: undefined }];
    }
    if (path === '/api/admin/users/new-user' && options.method === 'DELETE') accounts = accounts.filter(user => user.id !== 'new-user');
    return { status: 200, ok: true, json: async () => ({ user: admin, users: [...accounts] }) };
  });
  await boot();
  fireEvent.click(await until(() => ui.queryByRole('button', { name: 'Manage workspace users' })));
  const create = await until(() => ui.queryByRole('button', { name: 'Create Account' }));
  const users = getQueriesForElement(create.closest('section'));
  assert.equal(users.queryByText('dev-only'), null);
  assert.equal(users.queryByRole('combobox', { name: 'Role' }), null);
  const requireReset = users.getByRole('checkbox', { name: /Require password change/ });
  assert.ok(requireReset.checked && requireReset.disabled);
  users.getByLabelText('Username').value = 'employee-fixture';
  users.getByLabelText('Display Name').value = 'Employee Fixture';
  users.getByLabelText('Initial Password').value = 'initial-fixture-password';
  fireEvent.click(create);
  const reset = await until(() => users.queryByRole('button', { name: 'Reset password for employee-fixture' }));
  const creation = requests.find(({ path, options }) => path === '/api/admin/users' && options?.method === 'POST');
  assert.deepEqual(JSON.parse(creation.options.body), {
    username: 'employee-fixture', displayName: 'Employee Fixture', password: 'initial-fixture-password', role: 'user', mustChangePassword: true,
  });
  fireEvent.click(reset);
  const dialog = getQueriesForElement(await until(() => ui.queryByRole('dialog', { name: /Reset Password for/ })));
  dialog.getByLabelText('New Password').value = 'reset-fixture-password';
  fireEvent.click(dialog.getByRole('button', { name: 'Update Password' }));
  await until(() => !ui.queryByRole('dialog'));
  const resetRequest = requests.find(({ path }) => path.endsWith('/new-user/reset-password'));
  assert.deepEqual(JSON.parse(resetRequest.options.body), { newPassword: 'reset-fixture-password' });
  const deleteButton = users.getByRole('button', { name: 'Delete employee-fixture' });
  fireEvent.click(deleteButton);
  const confirmation = await until(() => ui.queryByRole('dialog', { name: /Delete user/ }));
  fireEvent.click(getQueriesForElement(confirmation).getByRole('button', { name: 'Cancel' }));
  await until(() => !ui.queryByRole('dialog'));
  assert.ok(!requests.some(({ options }) => options?.method === 'DELETE'));
  fireEvent.click(deleteButton);
  const again = await until(() => ui.queryByRole('dialog', { name: /Delete user/ }));
  fireEvent.click(getQueriesForElement(again).getByRole('button', { name: 'Delete User' }));
  await until(() => !users.queryByText('employee-fixture'));
  assert.equal(requests.filter(({ options }) => options?.method === 'DELETE').length, 1);
});

test('Dev Settings can provision admins and leaves protected accounts outside delete controls', async t => {
  const dev = { id: 'settings-dev', username: 'dev-owner', displayName: 'Fixture Dev', role: 'dev' };
  const accounts = [dev];
  let created;
  const { ui, boot } = await productionWindow(t, '#settings', async (path, options) => {
    if (path === '/api/admin/users' && options?.method === 'POST') {
      created = JSON.parse(options.body);
      accounts.push({ id: 'admin-account', username: created.username, displayName: created.displayName, role: created.role });
    }
    return { status: 200, ok: true, json: async () => ({ user: dev, users: [...accounts] }) };
  });
  await boot();
  fireEvent.click(await until(() => ui.queryByRole('tab', { name: 'Security & Users' })));
  await until(() => ui.queryByRole('button', { name: 'Reset password for dev-owner' }));
  assert.equal(ui.queryByRole('button', { name: 'Delete dev-owner' }), null);
  const create = ui.getByRole('button', { name: 'Create Account' });
  const form = getQueriesForElement(create.form);
  form.getByLabelText('Username').value = 'admin-new';
  form.getByLabelText('Display Name').value = 'Admin New';
  form.getByLabelText('Initial Password').value = 'fixture-admin-password';
  fireEvent.change(form.getByRole('combobox', { name: 'Role' }), { target: { value: 'admin' } });
  fireEvent.click(form.getByRole('checkbox', { name: /Require password change/ }));
  fireEvent.click(create);
  await until(() => ui.queryByRole('button', { name: 'Delete admin-new' }));
  assert.equal(created.role, 'admin');
  assert.equal(created.mustChangePassword, false);
});

test('Customer filing previews evidence and submits only explicitly approved files', async t => {
  const root = { id: 'contracts', name: 'Cloud Contracts', isShared: true };
  const source = ['Cloud Contracts', 'Contracts South'];
  const destination = ['Cloud Contracts', 'Hilton Pharma'];
  const entries = [
    { id: 'invoice', filename: 'Invoice.pdf', action: 'move', documentType: 'Invoice', revision: now,
      source, destination, customer: 'Hilton Pharma', region: 'South', reason: 'Billing field identifies Hilton Pharma.',
      evidence: { section: 'Page 2', excerpt: 'Bill to: Hilton Pharma' } },
    { id: 'agreement', filename: 'Agreement.pdf', action: 'review', documentType: 'Contract', revision: now,
      source, customer: 'Al-Ghazi', reason: 'The contract contains conflicting names.' },
  ];
  let requestBody;
  const { ui, boot } = await productionWindow(t, '#documents', async (path, options) => {
    const route = new URL(path, 'http://localhost').pathname;
    const response = data => ({ status: 200, ok: true, json: async () => data });
    if (route === '/api/me') return response({ user: { id: 'reviewer', role: 'dev', displayName: 'Reviewer' } });
    if (route === '/api/knowledge/folders') return response({ folders: [root] });
    if (route === '/api/knowledge/documents') return response({ documents: [] });
    if (route === '/api/knowledge/filing') {
      if (options?.method === 'POST') {
        requestBody = JSON.parse(options.body);
        return response({ movedIds: ['invoice'], staleIds: [] });
      }
      return response({ entries, customers: [] });
    }
    return response({});
  });
  await boot();
  fireEvent.click(await until(() => ui.queryByRole('button', { name: 'Review customer filing' })));
  const dialog = await until(() => ui.queryByRole('dialog', { name: 'Customer filing review' }));
  const filing = getQueriesForElement(dialog);
  await until(() => filing.queryByText(/Bill to: Hilton Pharma/));
  assert.equal(filing.getByRole('button', { name: 'Approve and move' }).disabled, true);
  fireEvent.click(filing.getByRole('button', { name: 'Needs review 1' }));
  await until(() => filing.queryByRole('link', { name: 'Agreement.pdf' }));
  assert.equal(filing.queryByRole('checkbox', { name: 'Approve Agreement.pdf' }), null);
  fireEvent.click(filing.getByRole('button', { name: 'Suggested moves 1' }));
  fireEvent.click(await until(() => filing.queryByRole('checkbox', { name: 'Approve Invoice.pdf' })));
  fireEvent.click(await until(() => filing.queryByRole('button', { name: 'Approve and move 1' })));
  await until(() => requestBody);
  assert.deepEqual(requestBody, { approvals: [{ id: 'invoice', destination: 'Hilton Pharma', revision: now }] });
});

test('Production Knowledge Hub filters, paginates and selects documents without applying stale results', async t => {
  const folder = { id: 'workspace-folder', name: 'Operations', isShared: true, fileCount: 25 };
  const documents = Array.from({ length: 25 }, (_, index) => ({
    id: `document-${index + 1}`, filename: `Runbook ${index + 1}.pdf`, createdAt: now, status: 'ready', sizeBytes: 2000,
    folderId: folder.id, folderName: folder.name, creatorName: 'Fixture Owner', isShared: true,
  }));
  const privateDoc = { ...documents[0], id: 'private-notes', filename: 'Private Notes.txt', isShared: false, folderId: null };
  const calls = [];
  let finishOldSearch;
  let failOnce = false;
  const response = (data, status = 200) => ({ status, ok: status < 400, json: async () => data });
  const { window, ui, boot } = await productionWindow(t, '#documents', async (path, options) => {
    const url = new URL(path, 'http://localhost');
    calls.push({ url, options });
    if (url.pathname === '/api/me') return response({ user: { id: 'knowledge-fixture', role: 'member', displayName: 'Fixture' } });
    if (url.pathname === '/api/knowledge/folders') return response({ folders: url.searchParams.get('scope') === 'personal' ? [] : [folder] });
    if (url.pathname === '/api/knowledge/documents') {
      const query = url.searchParams.get('search');
      if (query === 'slow') return new Promise(resolve => { finishOldSearch = () => resolve(response({ documents: [documents[0]] })); });
      if (failOnce) { failOnce = false; return response({ error: { message: 'Library temporarily unavailable.' } }, 503); }
      if (url.searchParams.get('scope') === 'personal') return response({ documents: [privateDoc] });
      return response({ documents: query === 'latest' ? [documents[11]] : documents });
    }
    if (url.pathname === '/api/knowledge/documents/document-12') return response({ document: documents[11] });
    return response({});
  });
  await boot();
  await until(() => ui.queryByRole('link', { name: 'Runbook 1.pdf' }));
  assert.equal(ui.getByRole('button', { name: 'Previous page' }).disabled, true);
  assert.ok(ui.getByRole('link', { name: 'Runbook 10.pdf' }));
  assert.equal(ui.queryByRole('link', { name: 'Runbook 11.pdf' }), null);
  fireEvent.click(ui.getByRole('button', { name: 'Next page' }));
  await until(() => ui.queryByRole('link', { name: 'Runbook 12.pdf' }));
  assert.equal(ui.queryByRole('link', { name: 'Runbook 1.pdf' }), null);
  assert.ok(ui.getByRole('link', { name: 'Runbook 20.pdf' }));
  fireEvent.click(ui.getByRole('button', { name: 'Next page' }));
  await until(() => ui.queryByRole('link', { name: 'Runbook 25.pdf' }));
  assert.equal(ui.queryByRole('link', { name: 'Runbook 20.pdf' }), null);
  assert.ok(ui.getByRole('link', { name: 'Runbook 21.pdf' }));
  assert.equal(ui.getByRole('button', { name: 'Next page' }).disabled, true);
  fireEvent.click(ui.getByRole('button', { name: 'Previous page' }));
  await until(() => ui.queryByRole('link', { name: 'Runbook 12.pdf' }));
  const checked = ui.getByRole('checkbox', { name: 'Select all documents on this page' });
  fireEvent.click(checked);
  await until(() => checked.checked);
  assert.ok(ui.getByRole('checkbox', { name: 'Select Runbook 11.pdf' }).checked);
  assert.ok(ui.getByRole('checkbox', { name: 'Select Runbook 12.pdf' }).checked);
  fireEvent.click(ui.getByRole('button', { name: 'Delete Selected' }));
  const confirm = await until(() => ui.queryByRole('dialog', { name: 'Delete 10 Documents?' }));
  fireEvent.click(getQueriesForElement(confirm).getByRole('button', { name: 'Cancel' }));
  await until(() => !ui.queryByRole('dialog'));
  fireEvent.click(ui.getByRole('button', { name: 'Deselect' }));
  await until(() => !checked.checked);
  const previewLink = ui.getByRole('link', { name: 'Runbook 12.pdf' });
  fireEvent.click(ui.getByRole('button', { name: 'Actions for Runbook 12.pdf' }));
  assert.equal(ui.getByRole('link', { name: 'Download Runbook 12.pdf' }).getAttribute('href'), '/api/knowledge/documents/document-12/download');
  fireEvent.click(previewLink);
  const preview = await until(() => window.document.querySelector('iframe[title="Runbook 12.pdf"]'));
  assert.match(preview.getAttribute('src'), /\/api\/knowledge\/documents\/document-12\/view/);
  fireEvent.click(ui.getByRole('button', { name: 'Expand Document preview' }));
  await until(() => ui.queryByRole('dialog', {name:'Document preview'}));
  assert.equal(window.document.querySelector('iframe[title="Runbook 12.pdf"]'), preview);
  fireEvent.click(ui.getByRole('button', { name: 'Dock Document preview' }));
  await until(() => ui.queryByRole('complementary', {name:'Document preview'}));
  assert.equal(window.document.querySelector('iframe[title="Runbook 12.pdf"]'), preview);
  fireEvent.click(ui.getByRole('button', { name: 'Close preview' }));
  await until(() => !ui.queryByRole('dialog'));

  const search = ui.getByRole('searchbox', { name: 'Search filenames' });
  search.focus();
  fireEvent.input(search, { target: { value: 'slow' } });
  await until(() => search.value === 'slow');
  await until(() => finishOldSearch);
  fireEvent.input(search, { target: { value: 'latest' } });
  await until(() => search.value === 'latest');
  await until(() => ui.queryByRole('link', { name: 'Runbook 12.pdf' }) && !ui.queryByRole('link', { name: 'Runbook 1.pdf' }));
  assert.ok(calls.find(({ url }) => url.searchParams.get('search') === 'slow').options.signal.aborted);
  finishOldSearch();
  await wait(25);
  assert.equal(ui.queryByRole('link', { name: 'Runbook 1.pdf' }), null);
  assert.equal(window.document.activeElement, search);
  assert.equal(search.value, 'latest');

  failOnce = true;
  fireEvent.click(ui.getByRole('button', { name: 'Personal' }));
  await until(() => ui.queryByRole('alert'));
  assert.equal(ui.queryByRole('link', { name: 'Runbook 12.pdf' }), null);
  fireEvent.click(ui.getByRole('button', { name: 'Retry' }));
  await until(() => ui.queryByRole('link', { name: 'Private Notes.txt' }));
  const textFilter = ui.getByRole('combobox', { name: 'File type' });
  fireEvent.change(textFilter, { target: { value: 'text' } });
  await until(() => textFilter.value === 'text');
  assert.ok(calls.some(({ url }) => url.searchParams.get('type') === 'text' && url.searchParams.get('scope') === 'personal'));
});

test('Production Knowledge Hub pauses indexing refreshes outside the library and resumes on return', async t => {
  const user = { id: 'indexing-library', role: 'member', displayName: 'Fixture Member' };
  let reads = 0;
  const { window, ui, boot } = await productionWindow(t, '#documents', async path => {
    let data = { user };
    if (path.startsWith('/api/knowledge/folders?')) data = { folders: [] };
    if (path.startsWith('/api/knowledge/documents?')) {
      data = { documents: [{ id: 'indexed-pdf', filename: 'Guide.pdf', createdAt: now, status: ++reads < 3 ? 'indexing' : 'ready' }] };
    }
    return { status: 200, ok: true, json: async () => data };
  });
  const timers = holdTimers(window, [5000]);

  await boot();
  await until(() => ui.queryByRole('link', { name: 'Guide.pdf' }) && timers.size === 1);
  timers.values().next().value();
  await until(() => reads === 2 && timers.size === 1);
  window.location.hash = 'home';
  await until(() => ui.queryByRole('heading', { name: 'Good morning, Fixture' }));
  assert.equal(timers.size, 0);
  assert.equal(reads, 2);
  window.location.hash = 'knowledge';
  await until(() => reads === 3 && ui.queryByRole('link', { name: 'Guide.pdf' }) && !ui.queryByText('Processing', { exact: true }));
  assert.equal(reads, 3);
  assert.equal(timers.size, 0);
});

test('Production Knowledge Hub sends the chosen folder to grounded chat and renders streamed sources', async t => {
  const folder = { id: 'knowledge-folder', name: 'Approved procedures', isShared: true };
  const prompts = [];
  let stream;
  const { window, ui, boot } = await productionWindow(t, '#knowledge', async (path, options) => {
    let data = {};
    if (path === '/api/me') data = { user: { id: 'knowledge-member', role: 'member', displayName: 'Fixture' } };
    if (path.startsWith('/api/knowledge/folders')) data = { folders: [folder] };
    if (path.startsWith('/api/knowledge/documents?')) data = { documents: [] };
    if (path === '/api/chat?stream=true') {
      prompts.push(JSON.parse(options.body));
      return { ok: true, body: new ReadableStream({ start(controller) { stream = controller; } }) };
    }
    return { ok: true, status: 200, json: async () => data };
  });
  await boot();
  fireEvent.click(await until(() => ui.queryByRole('button', { name: 'Open folder Approved procedures' })));
  await until(() => window.document.querySelector('[aria-current="location"][title="Approved procedures"]'));
  const folderHash = window.location.hash;
  fireEvent.click(ui.getByRole('button', { name: 'Ask Knowledge' }));
  await until(() => ui.queryByRole('complementary', { name: 'Ask Knowledge' }));
  const question = ui.getByRole('textbox', { name: 'Ask about your documents' });
  assert.match(ui.getByRole('complementary', { name: 'Ask Knowledge' }).textContent, /Approved procedures and subfolders/);
  fireEvent.input(question,{target:{value:'What should we do first?'}});
  fireEvent.click(ui.getByRole('button',{name:'Expand Ask Knowledge'}));
  await until(()=>ui.queryByRole('dialog',{name:'Ask Knowledge'}));
  assert.equal(ui.getByRole('textbox',{name:'Ask about your documents'}), question);
  assert.equal(question.value, 'What should we do first?');
  fireEvent.submit(question.form);
  await until(() => stream);
  await until(()=>window.document.querySelector('.pip[data-pose="searching"]'));
  fireEvent.click(ui.getByRole('button',{name:'Dock Ask Knowledge'}));
  assert.deepEqual(prompts[0], { message: 'What should we do first?', history: [], use_rag: true, rag_scope: { mode: 'folder', id: folder.id }, stream: true });
  const event = data => new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
  stream.enqueue(event({ delta: 'Check the procedure' }));
  await until(() => ui.queryByText('Check the procedure'));
  stream.enqueue(event({ replace: 'Check the **approved procedure** first.', citations: [{ documentId: 'approved-doc', filename: 'Procedure.pdf' }] }));
  stream.close();
  assert.equal(window.location.hash, folderHash);
  const source = await until(() => ui.queryByRole('link', { name: /Procedure.pdf/ }));
  assert.equal(source.getAttribute('href'), '/api/knowledge/documents/approved-doc/view');
  assert.equal(ui.getByText('approved procedure').tagName, 'STRONG');
  fireEvent.click(ui.getByRole('button', { name: 'Clear chat' }));
  await until(() => !ui.queryByText('What should we do first?'));
  fireEvent.click(ui.getByRole('button', { name: 'Knowledge Hub' }));
  await until(() => !ui.queryByRole('heading', { name: 'Approved procedures' }));
});

test('Production Knowledge Hub creates, edits, and deletes folders through the existing endpoints', async t => {
  let folder;
  let rejectEdit = true;
  const writes = [];
  const { window, ui, boot } = await productionWindow(t, '#knowledge', async (path, options) => {
    const url = new URL(path, 'http://localhost');
    if (options?.method) writes.push({ path, ...options });
    if (options?.method === 'POST' && url.pathname === '/api/knowledge/folders') {
      folder = { ...JSON.parse(options.body), id: 'fixture-folder', fileCount: 2 };
    }
    if (options?.method === 'PATCH' && url.pathname === '/api/knowledge/folders/fixture-folder') {
      if (rejectEdit) {
        rejectEdit = false;
        return { ok: false, status: 403, json: async () => ({ error: { message: 'Folder update was denied.' } }) };
      }
      Object.assign(folder, JSON.parse(options.body));
    }
    if (options?.method === 'DELETE') folder = undefined;
    const data = url.pathname === '/api/me' ? { user: { id: 'folder-member', role: 'member', displayName: 'Fixture' } }
      : url.pathname === '/api/knowledge/folders' ? { folders: folder ? [{ ...folder }] : [] } : { documents: [] };
    return { ok: true, status: 200, json: async () => data };
  });
  const dialog = () => getQueriesForElement(ui.getByRole('dialog'));
  await boot();
  fireEvent.click(await until(() => ui.queryByRole('button', { name: 'New folder' })));
  await until(() => ui.queryByRole('dialog'));
  dialog().getByRole('textbox', { name: 'Folder Name' }).value = 'Fixture Operations';
  fireEvent.click(dialog().getByRole('radio', { name: 'Engineering' }));
  fireEvent.click(dialog().getByRole('button', { name: 'Create Folder' }));
  fireEvent.click(await until(() => ui.queryByRole('button', { name: 'Edit Fixture Operations' })));
  await until(() => ui.queryByRole('dialog'));
  assert.ok(dialog().getByRole('radio', { name: 'Engineering' }).checked);
  dialog().getByRole('textbox', { name: 'Folder Name' }).value = 'Updated Operations';
  fireEvent.click(dialog().getByRole('button', { name: 'Save Changes' }));
  await until(() => ui.queryByText('Folder update was denied.'));
  assert.equal(dialog().getByRole('textbox', { name: 'Folder Name' }).value, 'Updated Operations');
  fireEvent.click(dialog().getByRole('button', { name: 'Save Changes' }));
  fireEvent.click(await until(() => ui.queryByRole('button', { name: 'Open folder Updated Operations' })));
  fireEvent.click(await until(() => ui.queryByRole('button', { name: 'Folder actions' })));
  fireEvent.click(ui.getByRole('button', { name: 'Delete folder' }));
  await until(() => ui.queryByRole('dialog'));
  assert.ok(dialog().getByRole('radio', { name: /Keep files/ }).checked);
  fireEvent.click(dialog().getByRole('button', { name: 'Confirm Delete' }));
  await until(() => !ui.queryByRole('heading', { name: 'Updated Operations' }) && !ui.queryByRole('dialog'));
  assert.equal(writes.find(({ method }) => method === 'DELETE').path, '/api/knowledge/folders/fixture-folder?cascade=false');
  assert.deepEqual(JSON.parse(writes.find(({ method }) => method === 'POST').body), { name: 'Fixture Operations', isShared: true, color: 'tech' });
  assert.equal(window.location.hash, '#knowledge');
});

test('Production Knowledge Hub supports subfolder creation, nested navigation, and breadcrumbs', async t => {
  const folders = [
    { id: 'parent-folder', name: 'Engineering', isShared: true, fileCount: 1, color: 'tech' },
    { id: 'child-folder', name: 'Frontend Specs', parentId: 'parent-folder', isShared: true, fileCount: 0, color: 'documents' }
  ];
  const writes = [];
  const { window, ui, boot } = await productionWindow(t, '#knowledge', async (path, options) => {
    const url = new URL(path, 'http://localhost');
    if (options?.method) writes.push({ path, ...options });
    if (options?.method === 'POST' && url.pathname === '/api/knowledge/folders') {
      const created = { ...JSON.parse(options.body), id: 'new-subfolder', fileCount: 0 };
      folders.push(created);
      return { ok: true, status: 201, json: async () => ({ folder: created }) };
    }
    const data = url.pathname === '/api/me' ? { user: { id: 'folder-member', role: 'member', displayName: 'Fixture' } }
      : url.pathname === '/api/knowledge/folders' ? { folders: [...folders] } : { documents: [] };
    return { ok: true, status: 200, json: async () => data };
  });
  const dialog = () => getQueriesForElement(ui.getByRole('dialog'));
  await boot();

  // Root level: only Engineering is shown, not child-folder
  assert.ok(await until(() => ui.queryByRole('button', { name: 'Open folder Engineering' })));
  assert.equal(ui.queryByRole('button', { name: 'Open folder Frontend Specs' }), null);

  // Navigate into Engineering
  fireEvent.click(ui.getByRole('button', { name: 'Open folder Engineering' }));
  await until(() => window.document.querySelector('[aria-current="location"][title="Engineering"]'));

  // Inside Engineering: child subfolder card is visible in subfolders shelf
  assert.ok(await until(() => ui.queryByRole('button', { name: 'Open folder Frontend Specs' })));

  // Breadcrumbs: Knowledge Hub -> Engineering
  const breadcrumb = () => window.document.querySelector('.ref-knowledge-breadcrumb');
  assert.ok(breadcrumb());
  assert.ok(getQueriesForElement(breadcrumb()).getByRole('button', { name: 'Knowledge Hub' }));
  assert.ok(getQueriesForElement(breadcrumb()).getByText('Engineering'));

  // Create a new subfolder inside Engineering
  fireEvent.click(ui.getAllByRole('button', { name: 'New subfolder' })[0]);
  await until(() => ui.queryByRole('dialog'));
  assert.ok(ui.queryByText('Parent Folder:'));
  dialog().getByRole('textbox', { name: 'Folder Name' }).value = 'Backend Specs';
  fireEvent.click(dialog().getByRole('button', { name: 'Create Subfolder' }));
  await until(() => !ui.queryByRole('dialog'));

  // Verify POST body included parentId: 'parent-folder'
  const post = writes.find(w => w.method === 'POST');
  assert.ok(post);
  assert.deepEqual(JSON.parse(post.body), { name: 'Backend Specs', isShared: true, color: 'tech', parentId: 'parent-folder' });

  // Navigate down into Frontend Specs
  fireEvent.click(ui.getByRole('button', { name: 'Open folder Frontend Specs' }));
  await until(() => window.document.querySelector('[aria-current="location"][title="Frontend Specs"]'));

  // Breadcrumbs now include clickable Engineering ancestor
  assert.ok(getQueriesForElement(breadcrumb()).getByRole('button', { name: 'Engineering' }));
  assert.ok(getQueriesForElement(breadcrumb()).getByRole('button', { name: 'Knowledge Hub' }));
  assert.ok(getQueriesForElement(breadcrumb()).getByText('Frontend Specs'));

  // Click Engineering in breadcrumbs to navigate back up to parent
  fireEvent.click(getQueriesForElement(breadcrumb()).getByRole('button', { name: 'Engineering' }));
  await until(() => window.document.querySelector('[aria-current="location"][title="Engineering"]'));

  // Click Knowledge Hub in breadcrumbs to return to root
  fireEvent.click(getQueriesForElement(breadcrumb()).getByRole('button', { name: 'Knowledge Hub' }));
  await until(() => ui.queryByRole('button', { name: 'Open folder Engineering' }));
  const category = ui.getByRole('treeitem', { name: 'Engineering' });
  category.focus();
  if (category.getAttribute('aria-expanded') === 'false') fireEvent.keyDown(category, { key: 'ArrowRight' });
  const supports = await until(() => ui.queryByRole('treeitem', { name: 'Backend Specs' }));
  fireEvent.keyDown(category, { key: 'ArrowRight' });
  assert.equal(window.document.activeElement, supports);
  window.history.back();
  await until(() => window.document.querySelector('[aria-current="location"][title="Engineering"]'));
});

test('Production Knowledge Hub uploads selected and dropped folders with their multipart paths', async t => {
  const folder = { id: 'upload-folder', name: 'My Reference', isShared: false };
  const attempts = [];
  const { window, ui, boot } = await productionWindow(t, '#knowledge', async (path, options) => {
    if (path === '/api/knowledge/upload') {
      attempts.push(options);
      if (attempts.length === 1) return { ok: false, status: 503, json: async () => ({ error: { message: 'Upload temporarily unavailable.' } }) };
    }
    const data = path === '/api/me' ? { user: { id: 'upload-fixture', role: 'member', displayName: 'Fixture' } }
      : path === '/api/knowledge/upload' ? { successCount: 3, total: 4, failedCount: 1 }
        : path.startsWith('/api/knowledge/folders') ? { folders: path.includes('scope=personal') ? [folder] : [] } : { documents: [] };
    return { ok: true, status: 200, json: async () => data };
  });
  await boot();
  fireEvent.click(await until(() => ui.queryByRole('button', { name: 'Personal' })));
  fireEvent.click(await until(() => ui.queryByRole('button', { name: 'Open folder My Reference' })));
  await until(() => window.document.querySelector('[aria-current="location"][title="My Reference"]'));
  fireEvent.click(ui.getAllByRole('button', { name: 'Upload', exact: true })[0]);
  fireEvent.click(await until(() => ui.queryByRole('button', { name: 'Upload files', exact: true })));
  const element = await until(() => ui.queryByRole('dialog', { name: 'Upload Documents & Folders' }));
  const form = getQueriesForElement(element);
  assert.equal(form.getByRole('combobox', { name: 'Visibility Scope' }).value, 'false');
  assert.equal(form.getByRole('combobox', { name: 'Target Folder' }).value, folder.id);
  assert.ok(form.getByRole('button', { name: 'Upload Documents' }).disabled);
  const picker = element.querySelector('#batch-folder-input');
  assert.ok(picker.hasAttribute('webkitdirectory'));
  const file = name => new window.File(['Fixture content'], name, { type: 'text/plain' });
  const selected = file('picked.txt');
  Object.defineProperty(selected, 'webkitRelativePath', { value: 'Picked/Sub/picked.txt' });
  fireEvent.change(picker, { target: { files: [selected] } });
  const discard = file('discard.txt');
  fireEvent.change(element.querySelector('#batch-file-input'), { target: { files: [discard, file('unfiled.txt')] } });
  fireEvent.click(await until(() => form.queryByRole('button', { name: 'Remove discard.txt' })));
  const leaf = name => ({ name, isFile: true, file: resolve => resolve(file(name)) });
  const directory = (name, chunks) => ({ name, isDirectory: true, createReader() {
    let cursor = 0;
    return { readEntries: resolve => resolve(chunks[cursor++] ?? []) };
  } });
  const dropped = directory('Drop', [[directory('Nested', [[leaf('one.txt')]])], [leaf('two.txt')]]);
  fireEvent.drop(element.querySelector('.ref-upload-dropzone'), { dataTransfer: { files: [], items: [
    { getAsFile: () => null, webkitGetAsEntry: () => dropped },
  ] } });
  const submit = await until(() => form.queryByRole('button', { name: 'Upload 4 files (2 folders)' }));
  fireEvent.click(submit);
  await until(() => form.queryByRole('alert'));
  assert.ok(form.getByRole('button', { name: 'Remove Drop/Nested/one.txt' }));
  fireEvent.click(submit);
  await until(() => !ui.queryByRole('dialog'));
  assert.equal(attempts.length, 2);
  const { headers, body } = attempts[1];
  assert.equal(headers.get('x-requested-with'), 'CloudCoreAI');
  assert.equal(headers.get('content-type'), null);
  assert.deepEqual(body.getAll('paths'), ['Picked/Sub/picked.txt', 'unfiled.txt', 'Drop/Nested/one.txt', 'Drop/two.txt']);
  assert.deepEqual(body.getAll('files').map(entry => entry.name), ['picked.txt', 'unfiled.txt', 'one.txt', 'two.txt']);
  assert.equal(body.get('folderId'), folder.id);
  assert.equal(body.get('isShared'), 'false');
  assert.ok(ui.getByText('3 of 4 files uploaded. 1 had issues.'));
});

test('Folder-card drops preserve multiple directory batches and keep uploading while minimized on another page', async t => {
  const destination = { id: 'contracts-folder', name: 'Contracts Central', isShared: true };
  let manifest;
  let report;
  let writes = 0;
  const transfers = [];
  let release;
  const gated = new Promise(resolve => { release = resolve; });
  const { window, ui, boot } = await productionWindow(t, '#knowledge', async (path, options) => {
    const url = new URL(path, 'http://localhost');
    let data = {};
    if (url.pathname === '/api/me') data = {user: {id: 'fixture-user', role: 'member', displayName: 'Fixture'}};
    else if (url.pathname === '/api/knowledge/folders') data = {folders: [destination]};
    else if (url.pathname === '/api/knowledge/documents') data = {documents: []};
    else if (url.pathname === '/api/knowledge/imports' && options?.method === 'POST') {
      manifest = JSON.parse(options.body);
      data = report = {id: manifest.id, destinationId: manifest.destinationId, isShared: true, cancelled: false, items: manifest.files.map((file, index) => ({
        ...file, id: String(index), status: 'pending'
      }))};
    } else if (url.pathname === '/api/knowledge/imports') data = {imports: []};
    else if (options?.method === 'PUT') {
      assert.equal(options.headers.get('content-type'), 'application/octet-stream');
      transfers.push(options.signal);
      await gated;
      report.items[Number(url.pathname.split('/').at(-1))].status = 'uploaded';
      writes++;
      data = {status: 'uploaded'};
    } else if (url.pathname.startsWith('/api/knowledge/imports/')) data = structuredClone(report);
    return {ok: true, status: 200, json: async () => structuredClone(data)};
  });
  await boot();
  const file = name => ({ name, isFile: true, file: done => {
    const picked = new window.File(['contract'], name, {type: 'text/plain'});
    if (name === 'last.txt') Object.defineProperty(picked, 'size', {value: 300 * 1024 ** 2});
    done(picked);
  } });
  const dir = (name, batches) => ({ name, isDirectory: true, createReader() {
    let index = 0;
    return { readEntries: done => done(batches[index++] ?? []) };
  }});
  const source = dir('Contract Central', [[dir('FY2026', [Array.from({length: 100}, (_, i) => file(`${i}.txt`)), [file('last.txt')]])],
    [dir('Empty', [])]]);
  const card = (await until(() => ui.queryByRole('button', {name: 'Open folder Contracts Central'}))).closest('tr');
  fireEvent.drop(card, {dataTransfer: {types: ['Files'], files: [], items: [{kind: 'file', webkitGetAsEntry: () => source}]}});
  const dialog = getQueriesForElement(await until(() => ui.queryByRole('dialog', {name: 'Import files and folders'})));
  const keepFolder = await until(() => dialog.queryByRole('radio', {name: /Keep folder/}));
  assert.equal(dialog.getByRole('combobox', {name: 'Destination'}).value, destination.id);
  assert.equal(keepFolder.checked, true);
  assert.match(dialog.getByRole('list', {name: 'Final destination'}).textContent, /Contract Central$/);
  assert.ok(dialog.getByText('1 file is over 250 MiB and will be stored for download.'));
  fireEvent.click(dialog.getByRole('radio', {name: /Import contents only/}));
  assert.equal(dialog.getByRole('list', {name: 'Final destination'}).textContent, 'Contracts Central');
  fireEvent.click(dialog.getByRole('button', {name: 'Start import'}));
  await until(() => transfers.length === 2);
  const expanded = getQueriesForElement(await until(() => ui.queryByRole('dialog', {name: 'Import results'})));
  fireEvent.click(expanded.getByRole('button', {name: 'Minimize', exact: true}));
  await until(() => ui.queryByRole('button', {name: 'Expand import details'}));
  window.location.hash = 'home';
  await until(() => !window.document.querySelector('#workspace-react-knowledge'));
  assert.ok(ui.getByText('Uploading to Knowledge Hub'));
  assert.ok(transfers.every(signal => !signal.aborted));
  fireEvent.click(window.document.querySelector('.import-tray-move summary'));
  fireEvent.click(ui.getByRole('button', {name:'Top left'}));
  await until(() => window.document.querySelector('.knowledge-import-tray[data-corner="Top left"]'));
  fireEvent.click(ui.getByRole('button', {name:'Hide import status'}));
  await until(() => !ui.queryByRole('button', {name:'Expand import details'}));
  release();
  await until(() => writes === 101);
  assert.equal(manifest.files.length, 101);
  assert.ok(manifest.directories.includes('Empty'));
  assert.ok(manifest.files.some(file => file.path === 'FY2026/last.txt' &&
    file.sourcePath === 'Contract Central/FY2026/last.txt'));
  fireEvent.click(ui.getByRole('button', {name: 'Import status'}));
  const openFolder = await until(() => ui.queryByRole('button', {name: 'Open imported folder'}));
  fireEvent.click(openFolder);
  assert.ok(await until(() => window.document.querySelector('[aria-current="location"][title="Contracts Central"]')));
});

test('Production Knowledge Hub previews sheets and only clears successful batch selections', async t => {
  const folder = { id: 'docs-folder', name: 'Documents', isShared: true };
  const spreadsheet = { id: 'sheet', filename: 'Budget.xlsx', sizeBytes: 160, status: 'ready', isShared: true };
  const text = { ...spreadsheet, id: 'notes', filename: 'Notes.txt', extractedText: '<img src=x> Plain text' };
  let documents = [spreadsheet, text];
  const changes = [];
  const { ui, boot } = await productionWindow(t, '#documents', async (path, options) => {
    const url = new URL(path, 'http://localhost');
    if (options?.method) changes.push({ path, method: options.method, payload: options.body ? JSON.parse(options.body) : null });
    let data = {};
    if (path === '/api/me') data = { user: { id: 'preview-fixture', role: 'member', displayName: 'Fixture' } };
    if (url.pathname === '/api/knowledge/folders') data = { folders: [folder] };
    if (url.pathname === '/api/knowledge/documents') data = { documents: [...documents] };
    if (path === '/api/knowledge/documents/sheet') data = { document: spreadsheet };
    if (path === '/api/knowledge/documents/notes') data = { document: text };
    if (path.endsWith('/sheet-data')) data = { sheets: [
      { name: 'First', totalRows: 2, rows: [[0, ...Array.from({ length: 25 }, () => ''), 'Seven'], ['Nine']] },
      { name: 'Second', totalRows: 1, rows: [['Seven on second']] },
    ] };
    if (options?.method === 'DELETE') documents = documents.filter(document => document.id !== 'notes');
    if (path === '/api/knowledge/batch-move') data = { movedIds: ['sheet'] };
    return { ok: true, status: 200, json: async () => data };
  });
  await boot();
  fireEvent.click(await until(() => ui.queryByRole('link', { name: 'Budget.xlsx' })));
  await until(() => ui.queryByRole('columnheader', { name: 'AA', exact: true }));
  assert.ok(ui.getByRole('cell', { name: '0', exact: true }));
  fireEvent.input(ui.getByRole('searchbox', { name: 'Search rows' }), { target: { value: 'Seven' } });
  await until(() => !ui.queryByRole('cell', { name: 'Nine' }));
  fireEvent.click(ui.getByRole('button', { name: /Second/ }));
  await until(() => ui.queryByRole('cell', { name: 'Seven on second' }));
  fireEvent.click(ui.getByRole('button', { name: 'Close preview' }));
  await until(() => !ui.queryByRole('dialog'));
  fireEvent.click(ui.getByRole('link', { name: 'Notes.txt' }));
  await until(() => ui.queryByText('<img src=x> Plain text'));
  const detail = ui.getByRole('complementary', { name: 'Document preview' });
  assert.equal(detail.querySelector('img'), null);
  fireEvent.click(ui.getByRole('button', { name: 'Close preview' }));
  await until(() => !ui.queryByRole('dialog'));

  fireEvent.click(ui.getByRole('button', { name: 'Actions for Budget.xlsx' }));
  fireEvent.click(ui.getByRole('button', { name: 'Move Budget.xlsx' }));
  let dialog = getQueriesForElement(await until(() => ui.queryByRole('dialog', { name: 'Move Document' })));
  fireEvent.change(dialog.getByRole('combobox', { name: 'Destination Folder' }), { target: { value: folder.id } });
  fireEvent.click(dialog.getByRole('button', { name: 'Move Document' }));
  await until(() => !ui.queryByRole('dialog'));
  assert.deepEqual(changes[0], { path: '/api/knowledge/documents/sheet', method: 'PATCH', payload: { folderId: folder.id } });
  fireEvent.click(ui.getByRole('checkbox', { name: 'Select all documents on this page' }));
  fireEvent.click(await until(() => ui.queryByRole('button', { name: 'Move to Folder' })));
  dialog = getQueriesForElement(await until(() => ui.queryByRole('dialog', { name: 'Move 2 Documents' })));
  fireEvent.click(dialog.getByRole('button', { name: 'Move 2 Documents' }));
  await until(() => !ui.getByRole('checkbox', { name: 'Select Budget.xlsx' }).checked);
  assert.ok(ui.getByRole('checkbox', { name: 'Select Notes.txt' }).checked);
  assert.deepEqual(changes[1].payload, { documentIds: ['sheet', 'notes'], targetFolderId: null });
  fireEvent.click(ui.getByRole('button', { name: 'Delete Selected' }));
  dialog = getQueriesForElement(await until(() => ui.queryByRole('dialog', { name: 'Delete 1 Document?' })));
  fireEvent.click(dialog.getByRole('button', { name: 'Delete 1 Document' }));
  await until(() => !ui.queryByRole('dialog'));
  assert.ok(ui.getByRole('checkbox', { name: 'Select Notes.txt' }).checked);
  assert.deepEqual(changes[2], { path: '/api/knowledge/batch-delete', method: 'POST', payload: { documentIds: ['notes'] } });
  fireEvent.click(ui.getByRole('button', { name: 'Actions for Notes.txt' }));
  fireEvent.click(ui.getByRole('button', { name: 'Delete Notes.txt' }));
  dialog = getQueriesForElement(await until(() => ui.queryByRole('dialog', { name: 'Delete Document?' })));
  fireEvent.click(dialog.getByRole('button', { name: 'Delete Document' }));
  await until(() => !ui.queryByRole('link', { name: 'Notes.txt' }));
  assert.deepEqual(changes[3], { path: '/api/knowledge/documents/notes', method: 'DELETE', payload: null });
});

test('Production Image Studio keeps the Create draft across tabs and cancels a queued job', async t => {
  const calls = [];
  const { window, ui, boot } = await productionWindow(t, '#images/create', async (path, options) => {
    calls.push({ path, options });
    const data = {
      '/api/me': { user: { id: 'studio-fixture', role: 'member', displayName: 'Fixture' } },
      '/api/images/history': { assets: [] },
      '/api/images/capabilities': { generation: true, remix: false, remixMessage: 'Remix is unavailable in this fixture.' },
      '/api/images/jobs/active': { activeJob: null },
      '/api/images/generate': { job: { id: 'queued-fixture', status: 'queued', createdAt: now } },
      '/api/images/jobs/queued-fixture': { job: { id: 'queued-fixture', status: 'processing', createdAt: now } },
      '/api/images/jobs/queued-fixture/cancel': { success: true },
    }[path];
    return { ok: true, status: 200, json: async () => data ?? {} };
  });
  await boot();
  const prompt = await until(() => ui.queryByRole('textbox', { name: 'Your prompt' }));
  fireEvent.input(prompt, { target: { value: 'An architectural study' } });
  await until(() => ui.queryByText('22/500'));
  const createTab = ui.getByRole('tab', { name: 'Create' });
  fireEvent.keyDown(createTab, { key: 'ArrowRight' });
  await until(() => ui.queryByRole('tab', { name: 'Remix', selected: true }));
  assert.equal(window.location.hash, '#images/remix');
  assert.ok(ui.getByRole('button', { name: 'Remix image' }).disabled);
  fireEvent.click(createTab);
  const currentPrompt = await until(() => ui.queryByRole('textbox', { name: 'Your prompt' }));
  assert.equal(currentPrompt.value, 'An architectural study');
  const generate = ui.getByRole('button', { name: 'Generate image' });
  fireEvent.keyDown(currentPrompt, { key: 'Enter', ctrlKey: true });
  fireEvent.click(generate);
  assert.equal(calls.filter(call => call.path === '/api/images/generate').length, 1);
  await until(() => ui.queryByText('Waiting in the queue'));
  assert.ok(ui.getByText(/elapsed/));
  assert.equal(window.document.querySelector('#premium-studio [role="progressbar"]'), null);
  assert.equal(ui.getByRole('textbox', { name: 'Your prompt' }), currentPrompt);
  assert.equal(JSON.parse(calls.find(call => call.path === '/api/images/generate').options.body).prompt, 'An architectural study');
  fireEvent.click(ui.getByRole('button', { name: 'Cancel' }));
  await until(() => ui.queryByText('Generation cancelled'));
  assert.equal(ui.getByRole('textbox', { name: 'Your prompt' }).value, 'An architectural study');
  assert.ok(!ui.getByRole('button', { name: 'Generate image' }).disabled);
  fireEvent.input(currentPrompt, { target: { value: '<img src=x onerror=alert(1)>' } });
  assert.equal(currentPrompt.value, '<img src=x onerror=alert(1)>');
  assert.equal(window.document.querySelector('#premium-studio img[src=x]'), null);
});

test('Production Image Studio filters the gallery and remixes a saved reference', async t => {
  const asset = { id: 'studio-a', url: '/assets/example-tower.png', filename: 'tower.png', prompt: 'Telecom scene', style: 'natural', aspectRatio: '1:1', width: 1080, height: 1080, createdAt: now };
  const second = { ...asset, id: 'studio-b', prompt: 'Budget report' };
  const result = { ...asset, id: 'studio-remix', url: '/assets/example-map.png', filename: 'output.png', prompt: 'Make it golden', operation: 'remix' };
  let submitted;
  const { window, ui, boot } = await productionWindow(t, '#images/gallery', async (path, options) => {
    if (path === '/api/images/remix') submitted = options;
    const data = {
      '/api/me': { user: { id: 'studio-remix-fixture', role: 'member', displayName: 'Fixture' } },
      '/api/images/history': { assets: [asset, second] },
      '/api/images/capabilities': { generation: true, remix: true, controls: { strength: true } },
      '/api/images/jobs/active': { activeJob: null },
      '/api/images/remix': { job: { id: 'remix-job' }, asset: result },
    }[path];
    return { ok: true, status: 200, json: async () => data ?? {} };
  });
  await boot();
  await until(() => ui.queryByRole('button', { name: 'View image: Telecom scene' }));
  const search = ui.getByRole('searchbox', { name: 'Search your images' });
  search.focus();
  fireEvent.input(search, { target: { value: 'Telecom' } });
  await until(() => !ui.queryByRole('button', { name: 'View image: Budget report' }));
  assert.equal(window.document.activeElement, search);
  fireEvent.click(ui.getByRole('button', { name: 'View image: Telecom scene' }));
  const viewer = await until(() => ui.queryByRole('dialog', { name: 'A closer look' }));
  const viewerUi = getQueriesForElement(viewer);
  fireEvent.click(viewerUi.getByRole('button', { name: '200%' }));
  await until(() => viewerUi.queryByRole('button', { name: '200%', pressed: true }));
  assert.equal(viewerUi.getByRole('link', { name: 'Download' }).getAttribute('download'), asset.filename);
  fireEvent.click(viewerUi.getByRole('button', { name: 'Remix this image' }));
  const prompt = await until(() => ui.queryByRole('textbox', { name: 'Describe what to change' }));
  assert.ok(ui.getByAltText('Reference for your remix'));
  fireEvent.input(prompt, { target: { value: 'Make it golden' } });
  fireEvent.change(ui.getByRole('slider', { name: 'Change strength' }), { target: { value: '0.75' } });
  await until(() => ui.queryByText('75%'));
  fireEvent.click(ui.getByRole('button', { name: 'Remix image' }));
  await until(() => ui.queryByAltText('Make it golden'));
  assert.equal(submitted.body.get('sourceAssetId'), asset.id);
  assert.equal(submitted.body.get('prompt'), 'Make it golden');
  assert.equal(submitted.body.get('strength'), '0.75');
  assert.equal(submitted.body.get('image'), null);
  fireEvent.click(ui.getByRole('button', { name: 'Original' }));
  const original = await until(() => ui.queryByAltText('Original reference image'));
  assert.equal(original.getAttribute('src'), asset.url);
  fireEvent.click(ui.getByRole('button', { name: 'Result' }));
  assert.equal((await until(() => ui.queryByAltText('Make it golden'))).getAttribute('src'), result.url);
  fireEvent.click(ui.getByRole('button', { name: 'Remove', exact: true }));
  fireEvent.click(await until(() => ui.queryByRole('button', { name: 'Or choose from your gallery' })));
  const refs = getQueriesForElement(await until(() => ui.queryByRole('dialog', { name: 'Choose a reference' })));
  fireEvent.click(refs.getByRole('button', { name: 'Use as reference: Budget report' }));
  await until(() => !ui.queryByRole('dialog') && ui.queryByAltText('Reference for your remix'));
  fireEvent.click(ui.getByRole('tab', { name: 'Create' }));
  const tools = await until(() => window.document.querySelector('summary[aria-label="Prompt tools"]'));
  tools.parentElement.open = true;
  fireEvent.click(ui.getByRole('button', { name: 'Prompt history' }));
  const history = await until(() => ui.queryByRole('dialog', { name: 'Prompt history' }));
  const savedPrompt = [...history.querySelectorAll('article')].find(item => item.textContent.includes('Budget report'));
  fireEvent.click(getQueriesForElement(savedPrompt).getByRole('button', { name: 'Reuse settings' }));
  await until(() => !ui.queryByRole('dialog') && ui.queryByRole('textbox', { name: 'Your prompt' })?.value === 'Budget report');
});

test('Production Image Studio labels metadata-only analysis and preserves the report controls', async t => {
  let submitted;
  const { window, ui, boot } = await productionWindow(t, '#images/analyze', async (path, options) => {
    if (path === 'assets/example-tower.png') return { ok: true, blob: async () => new window.Blob(['test image'], { type: 'image/png' }) };
    if (path === '/api/vision') submitted = options;
    const data = {
      '/api/me': { user: { id: 'studio-vision-fixture', role: 'member', displayName: 'Fixture' } },
      '/api/images/history': { assets: [] },
      '/api/images/capabilities': { generation: true },
      '/api/images/jobs/active': { activeJob: null },
      '/api/vision': { answer: '**Fixture metadata**', analysisKind: 'metadata' },
    }[path];
    return { ok: true, status: 200, json: async () => data ?? {} };
  });
  await boot();
  fireEvent.click(await until(() => ui.queryByRole('button', { name: 'Telecom tower' })));
  fireEvent.click(await until(() => ui.queryByRole('button', { name: 'Analyze image' })));
  await until(() => ui.queryByText('Fixture metadata'));
  assert.equal(ui.getByText('Fixture metadata').tagName, 'STRONG');
  assert.ok(ui.getByText(/File and metadata inspection/));
  assert.match(submitted.body.get('question'), /Distinguish observation from uncertainty/);
  fireEvent.click(ui.getByRole('button', { name: 'Clear report' }));
  await until(() => !ui.queryByText('Fixture metadata'));
});

test('Production Image Studio retries only unsuccessful saves and deletes', async t => {
  const asset = { id: 'one', url: '/assets/example-tower.png', filename: 'one.png', prompt: 'First asset', style: 'natural', aspectRatio: '1:1', width: 100, height: 100, createdAt: now };
  const other = { ...asset, id: 'two', filename: 'two.png', prompt: 'Second asset' };
  const saveCalls = [], deleteCalls = [];
  let saveDenied = true, deleteDenied = true;
  const { ui, boot } = await productionWindow(t, '#images/gallery', async (path, options) => {
    if (path.endsWith('/save-to-knowledge')) {
      saveCalls.push({ path, ...JSON.parse(options.body) });
      if (saveDenied && path.includes('/two/')) { saveDenied = false; return { ok: false, status: 403, json: async () => ({ error: { message: 'Could not save this image.' } }) }; }
    }
    if (options?.method === 'DELETE') {
      deleteCalls.push(path);
      if (deleteDenied && path.endsWith('/two')) { deleteDenied = false; return { ok: false, status: 403, json: async () => ({ error: { message: 'Could not delete this image.' } }) }; }
    }
    const payload = {
      '/api/me': { user: { id: 'studio-operations-fixture', role: 'member', displayName: 'Fixture' } },
      '/api/images/history': { assets: [asset, other] }, '/api/images/capabilities': {}, '/api/images/jobs/active': {},
      '/api/knowledge/folders?scope=all': { folders: [{ id: 'personal', name: 'Designs', isShared: false }] },
    }[path];
    return { ok: true, status: 200, json: async () => payload ?? {} };
  });
  await boot();
  const first = await until(() => ui.queryByRole('checkbox', { name: 'Select image: First asset' }));
  fireEvent.click(first);
  fireEvent.click(ui.getByRole('checkbox', { name: 'Select image: Second asset' }));
  fireEvent.click(await until(() => ui.queryByRole('button', { name: 'Save to Hub' })));
  const save = getQueriesForElement(await until(() => ui.queryByRole('dialog', { name: 'Save to Knowledge Hub' })));
  const destination = await until(() => save.queryByRole('combobox', { name: 'Destination folder' }));
  fireEvent.change(destination, { target: { value: 'personal' } });
  await until(() => !save.getByRole('checkbox').checked);
  fireEvent.click(save.getByRole('button', { name: 'Save images' }));
  await until(() => save.queryByRole('alert'));
  assert.match(save.getByRole('alert').textContent, /1 saved; 1 could not be saved/);
  assert.equal(destination.value, 'personal');
  fireEvent.click(await until(() => save.queryByRole('button', { name: 'Save image' })));
  await until(() => !ui.queryByRole('dialog'));
  assert.deepEqual(saveCalls.map(item => item.path), ['/api/images/one/save-to-knowledge', '/api/images/two/save-to-knowledge', '/api/images/two/save-to-knowledge']);
  assert.ok(saveCalls.every(item => item.folderId === 'personal' && item.isShared === false && !('filename' in item)));
  assert.ok(!first.checked);
  fireEvent.click(first);
  fireEvent.click(ui.getByRole('checkbox', { name: 'Select image: Second asset' }));
  fireEvent.click(await until(() => ui.queryByRole('button', { name: 'Delete', exact: true })));
  let deletion = getQueriesForElement(await until(() => ui.queryByRole('dialog', { name: 'Delete 2 images?' })));
  fireEvent.click(deletion.getByRole('button', { name: 'Keep images' }));
  await until(() => !ui.queryByRole('dialog'));
  assert.equal(deleteCalls.length, 0);
  fireEvent.click(ui.getByRole('button', { name: 'Delete', exact: true }));
  deletion = getQueriesForElement(await until(() => ui.queryByRole('dialog', { name: 'Delete 2 images?' })));
  fireEvent.click(deletion.getByRole('button', { name: 'Delete permanently' }));
  await until(() => deletion.queryByRole('alert'));
  assert.match(deletion.getByRole('alert').textContent, /1 deleted; 1 could not be deleted/);
  assert.equal(ui.queryByRole('checkbox', { name: 'Select image: First asset' }), null);
  assert.ok(ui.getByRole('checkbox', { name: 'Select image: Second asset' }).checked);
  fireEvent.click(deletion.getByRole('button', { name: 'Delete permanently' }));
  await until(() => !ui.queryByRole('dialog') && ui.queryByText('No saved images yet.'));
  assert.deepEqual(deleteCalls, ['/api/images/one', '/api/images/two', '/api/images/two']);
});

test('Production Image Studio imports an image through the existing validated URL endpoint', async t => {
  const calls = [];
  const { window, ui, boot } = await productionWindow(t, '#images/analyze', async (path, options) => {
    if (path === '/api/images/import-url') {
      calls.push(JSON.parse(options.body));
      return { ok: true, status: 200, blob: async () => new window.Blob(['fixture image'], { type: 'image/png' }) };
    }
    const payload = path === '/api/me' ? { user: { id: 'studio-import-fixture', role: 'member', displayName: 'Fixture' } } : {};
    return { ok: true, status: 200, json: async () => payload };
  });
  window.Image = class { naturalWidth = 64; naturalHeight = 64; async decode() {} };
  window.URL.createObjectURL = () => 'blob:linked-preview';
  window.URL.revokeObjectURL = () => {};
  await boot();
  fireEvent.click(await until(() => ui.queryByRole('button', { name: 'Use an image URL' })));
  const dialog = getQueriesForElement(await until(() => ui.queryByRole('dialog', { name: 'Analyze an image from a URL' })));
  const input = dialog.getByRole('textbox', { name: 'Image URL' });
  input.value = 'http://example.test/image.png';
  fireEvent.click(dialog.getByRole('button', { name: 'Load image' }));
  await until(() => dialog.queryByRole('alert'));
  assert.equal(calls.length, 0);
  input.value = 'https://example.test/image.png';
  fireEvent.click(dialog.getByRole('button', { name: 'Load image' }));
  await until(() => !ui.queryByRole('dialog'));
  assert.deepEqual(calls, [{ url: 'https://example.test/image.png' }]);
  assert.equal((await until(() => ui.queryByAltText('Selected image for analysis'))).getAttribute('src'), 'blob:linked-preview');
});

async function until(condition) {
  for (let i = 0; i < 200; i++) {
    const value = condition();
    if (value) return value;
    await wait(10);
  }
  throw new Error('React UI did not reach the expected state.');
}
