import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Icon } from '../shared/Brand';
import { pipEffect, pipMotionReduced } from './pipEffects';

type PipMode = 'roaming' | 'docked' | 'off';
type Activity = 'searching' | 'idle' | 'happy' | 'concerned' | 'folder' | 'preview' | 'ask' | 'queued' | 'meetings' | 'studio' | 'assistant';
const key = 'cloudcore.mascot';

export function pipActivity(activity: Activity) {
  window.dispatchEvent(new CustomEvent<Activity>('cloudcore:pip-activity', { detail: activity }));
}

export function currentPipMode(): PipMode {
  try {
    const value = localStorage.getItem(key);
    if (value === 'roaming' || value === 'docked' || value === 'off') return value;
  } catch { /* Settings still work without persistent storage. */ }
  return 'roaming';
}

function changeMode(mode: PipMode) {
  try { localStorage.setItem(key, mode); } catch { /* Apply for this page. */ }
  window.dispatchEvent(new CustomEvent<PipMode>('cloudcore:pip-mode', { detail: mode }));
}

export function PipSettings() {
  const [mode, setMode] = useState(currentPipMode);
  useEffect(() => {
    const update = (event: Event) => setMode((event as CustomEvent<PipMode>).detail);
    window.addEventListener('cloudcore:pip-mode', update);
    return () => window.removeEventListener('cloudcore:pip-mode', update);
  }, []);
  return <label className="pip-setting"><span>Pip mascot</span>
    <select value={mode} onChange={event => changeMode(event.target.value as PipMode)}>
      <option value="roaming">Roaming</option><option value="docked">Locked in place</option><option value="off">Off</option>
    </select>
  </label>;
}

const acts = ['wave', 'nap', 'happy', 'cry', 'spin', 'sneeze', 'peek', 'tumble', 'rocket', 'umbrella', 'moonwalk', 'magic', 'hiccup'] as const;
type Act = typeof acts[number];
type Pose = Act | 'idle' | 'concerned' | 'searching' | 'landing' | 'listening' | 'painting';
type Scene = {pose: Pose; line: string; effect?: Parameters<typeof pipEffect>[1]};
const tricks: Record<Act, Scene> = {
  wave: {pose:'wave',line:'Oh hey! Fancy seeing you here.',effect:'curious'},
  nap: {pose:'nap',line:'Just resting my pixels…'},
  happy: {pose:'happy',line:'Behold, my tiny victory dance.',effect:'celebrate'},
  cry: {pose:'cry',line:'I’m fine. Just a passing shower.',effect:'rain'},
  spin: {pose:'spin',line:'360-degree cloud coverage!',effect:'pickup'},
  sneeze: {pose:'sneeze',line:'Ah… ah… a-CLOUD!',effect:'sneeze'},
  peek: {pose:'peek',line:'Did someone say snacks?',effect:'curious'},
  tumble: {pose:'tumble',line:'Nobody saw that. Right?',effect:'land'},
  rocket: {pose:'rocket',line:'Permission to launch? Too late.',effect:'launch'},
  umbrella: {pose:'umbrella',line:'Always carry your own weather.',effect:'shower'},
  moonwalk: {pose:'moonwalk',line:'One small slide for cloudkind.',effect:'dash'},
  magic: {pose:'magic',line:'Alaka… cloud!',effect:'magic'},
  hiccup: {pose:'hiccup',line:'Hic! That was a tiny thunderclap.',effect:'sneeze'},
};
const reactions: Record<Exclude<Activity,'idle'>, Scene> = {
  searching:{pose:'searching',line:'Binoculars out. I’m looking.',effect:'curious'},
  happy:{pose:'happy',line:'Import complete! Tiny victory dance.',effect:'celebrate'},
  concerned:{pose:'concerned',line:'Some files need a closer look.',effect:'rain'},
  folder:{pose:'peek',line:'A new folder to explore!',effect:'curious'},
  preview:{pose:'wave',line:'Ooh, what’s in here?',effect:'curious'},
  ask:{pose:'searching',line:'Point me at a mystery.',effect:'curious'},
  queued:{pose:'happy',line:'Back in the indexing queue!',effect:'celebrate'},
  meetings:{pose:'listening',line:'Headphones on. I’m all ears.',effect:'curious'},
  studio:{pose:'painting',line:'I brought the cloud paint.',effect:'magic'},
  assistant:{pose:'wave',line:'Pull up a cloud. Let’s chat.',effect:'curious'},
};
const travelLines = ['Making my rounds.', 'Wheee! Shortcut.', 'Tiny boots. Big plans.', 'Scenic route today.', 'Cloud on the move!',
  'Pardon my vapor trail.', 'I absolutely meant to land there.', 'Taking the long way. For science.'];
type Point = { x: number; y: number };
const size = 76;
const roamRestMs = 10_000;
const roamTravelSettleMs = 3_100;
const positionKey = 'cloudcore.pip-position';
const blocked = 'a,button,input,textarea,select,summary,[role="button"],[contenteditable],.kh-inspector,.workspace-header,.knowledge-import-tray,.pip-chat';

function paused() {
  return document.hidden || Boolean(document.querySelector(
    'dialog[open]:not(.kh-inspector[data-expanded="false"])'));
}

function pickPoint(previous: Point | undefined, docked: boolean, preferred?: Point): Point | undefined {
  const workspace = document.querySelector('.workspace-main')?.getBoundingClientRect();
  if (!workspace) return;
  const left = Math.max(12, workspace.left + 12);
  const right = Math.min(document.documentElement.clientWidth || innerWidth, workspace.right) - size - 12;
  const top = Math.max(76, workspace.top + 12);
  const bottom = Math.min(innerHeight, workspace.bottom) - size - 12;
  if (right < left || bottom < top) return;
  const obstacles = [...document.querySelectorAll(blocked)].filter(element => !element.closest('.pip-stage'))
    .map(element => element.getBoundingClientRect()).filter(rect => rect.width > 0 && rect.height > 0);
  const available = ({ x, y }: Point) => x >= left && x <= right && y >= top && y <= bottom &&
    !obstacles.some(rect => x < rect.right + 4 && x + size > rect.left - 4 && y < rect.bottom + 4 && y + size > rect.top - 4);
  const choices = [{ x: right, y: bottom }, { x: left, y: bottom }, { x: right, y: top }, { x: left, y: top }];
  if (preferred) {
    const clamped = {x:Math.max(left,Math.min(right,preferred.x)),y:Math.max(top,Math.min(bottom,preferred.y))};
    if (available(clamped)) return clamped;
    for (let y=top;y<=bottom;y+=14) {
      for (let x=left;x<=right;x+=14) choices.push({x,y});
    }
    return choices.filter(available).sort((a,b) =>
      Math.hypot(a.x-clamped.x,a.y-clamped.y)-Math.hypot(b.x-clamped.x,b.y-clamped.y))[0];
  }
  if (docked && choices.some(available)) return choices.find(available);
  if (!docked) {
    const fileCells = [...document.querySelectorAll('.kh-table tbody tr td:nth-child(2)')]
      .map(cell => cell.getBoundingClientRect()).filter(rect => rect.bottom >= top && rect.top <= bottom);
    for (const cell of fileCells) {
      const x = Math.min(right, cell.right - size - 8);
      const y = Math.max(top, Math.min(bottom, cell.top + (cell.height - size) / 2));
      choices.unshift({ x, y }, { x: Math.max(left, x - size - 8), y });
    }
  }
  for (let i = 0; i < 18; i++) choices.push({ x: left + Math.random() * (right - left), y: top + Math.random() * (bottom - top) });
  const safe = choices.filter(point => available(point) && (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) > 65));
  if (docked) return safe[0] ?? {x:right,y:bottom};
  if (!previous) return safe[0] ?? {x:right,y:bottom};
  const distance = (point: Point) => Math.hypot(point.x - previous.x, point.y - previous.y);
  const varied = safe.sort((a,b)=>distance(b)-distance(a)).slice(0,Math.max(2,Math.ceil(safe.length / 3)));
  return varied[Math.floor(Math.random() * varied.length)];
}

function restorePoint(): Point | undefined {
  try {
    const saved = JSON.parse(localStorage.getItem(positionKey) || 'null');
    if (Number.isFinite(saved?.x) && Number.isFinite(saved?.y)) return {x:saved.x*innerWidth,y:saved.y*innerHeight};
  } catch { /* Use the default resting place. */ }
}

function rememberPoint(point: Point) {
  try { localStorage.setItem(positionKey,JSON.stringify({x:point.x/innerWidth,y:point.y/innerHeight})); }
  catch { /* The position still applies on this page. */ }
}

export function Pip({onOpenChat}: {onOpenChat?: (trigger: HTMLButtonElement)=>void}) {
  const [mode, setMode] = useState(currentPipMode);
  const [point, setPoint] = useState<Point>();
  const [pose, setPose] = useState<Pose>('idle');
  const [line, setLine] = useState('');
  const [direction, setDirection] = useState(1);
  const [moving, setMoving] = useState(false);
  const [held, setHeld] = useState(false);
  const [keyboardMoving, setKeyboardMoving] = useState(false);
  const current = useRef<Point | undefined>(undefined);
  const searching = useRef(false);
  const lastAct = useRef<Act | undefined>(undefined);
  const actionTimer = useRef<number | undefined>(undefined);
  const effectTimer = useRef<number | undefined>(undefined);
  const travelTimer = useRef<number | undefined>(undefined);
  const trailTimer = useRef<number | undefined>(undefined);
  const touchTapTimer = useRef<number | undefined>(undefined);
  const button = useRef<HTMLButtonElement>(null);
  const lastTravelLine = useRef('');
  const localInteractionUntil = useRef(0);
  const restUntil = useRef(0);
  const gesture = useRef<{id:number; origin:Point; pointer:Point; moved:boolean} | undefined>(undefined);
  const suppressClick = useRef(false);
  const beforeKeyboard = useRef<Point | undefined>(undefined);

  function setPosition(next: Point | undefined) {
    current.current=next;
    setPoint(next);
  }

  function interruptTravel() {
    if (!moving || !button.current?.parentElement) return;
    const { left, top } = button.current.parentElement.getBoundingClientRect();
    window.clearTimeout(travelTimer.current);
    window.clearTimeout(trailTimer.current);
    setMoving(false);
    setPosition({ x: left, y: top });
    setLine('');
  }

  function toggleLock() {
    if (mode === 'docked') {
      changeMode('roaming');
      return;
    }
    interruptTravel();
    if (current.current) rememberPoint(current.current);
    setKeyboardMoving(false);
    changeMode('docked');
  }

  function playEffect(effect: Parameters<typeof pipEffect>[1], facing = direction) {
    if (!paused()) void pipEffect(button.current,effect,facing).catch(console.error);
  }

  function showScene(scene: Scene) {
    window.clearTimeout(actionTimer.current);
    window.clearTimeout(effectTimer.current);
    setPose(scene.pose);
    setLine(scene.line);
    if (scene.effect) {
      const effect = scene.effect;
      if (scene.pose === 'sneeze') effectTimer.current = window.setTimeout(()=>playEffect(effect),490);
      else playEffect(effect);
    }
    actionTimer.current = window.setTimeout(()=>{
      setPose(searching.current ? 'searching' : 'idle');
      setLine('');
    },2800);
  }

  function land(preferred: Point) {
    const next=pickPoint(undefined,true,preferred) ?? pickPoint(undefined,true);
    setPosition(next);
    restUntil.current=Date.now()+roamRestMs;
    if(next) rememberPoint(next);
    window.clearTimeout(actionTimer.current);
    showScene({pose:'landing',line:'Textbook landing. Mostly.'});
    requestAnimationFrame(()=>playEffect('land'));
  }

  function startDrag(event: PointerEvent<HTMLButtonElement>) {
    if(!current.current||event.button!==0)return;
    interruptTravel();
    window.clearTimeout(touchTapTimer.current);
    suppressClick.current=false;
    gesture.current={id:event.pointerId,origin:current.current,pointer:{x:event.clientX,y:event.clientY},moved:false};
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function drag(event: PointerEvent<HTMLButtonElement>) {
    const session=gesture.current;
    if(session?.id!==event.pointerId)return;
    const dx=event.clientX-session.pointer.x,dy=event.clientY-session.pointer.y;
    if(!session.moved&&Math.hypot(dx,dy)<6)return;
    if (mode === 'docked') {
      session.moved=true;
      return;
    }
    if(!session.moved) {
      session.moved=true;
      window.clearTimeout(actionTimer.current);
      window.clearTimeout(effectTimer.current);
      window.clearTimeout(travelTimer.current);
      window.clearTimeout(trailTimer.current);
      setMoving(false);
      setHeld(true);
      setPose('idle');
      setLine('Whoa! I’m airborne!');
      playEffect('pickup');
    }
    setPosition({x:Math.max(0,Math.min(innerWidth-size,session.origin.x+dx)),
      y:Math.max(0,Math.min(innerHeight-size,session.origin.y+dy))});
  }

  function stopDrag(event: PointerEvent<HTMLButtonElement>, cancelled=false) {
    const session=gesture.current;
    if(session?.id!==event.pointerId)return;
    gesture.current=undefined;
    if(!session.moved) {
      if(!cancelled&&event.pointerType==='touch') {
        const trigger=event.currentTarget;
        // Edge can omit the click after a touch drag. Let a native click go first.
        touchTapTimer.current=window.setTimeout(()=>{
          if(trigger.isConnected)onOpenChat?.(trigger);
        },350);
      }
      return;
    }
    suppressClick.current=true;
    if (mode === 'docked') return;
    setHeld(false);
    if(cancelled) {
      setPosition(session.origin);
      setPose(searching.current?'searching':'idle');
      setLine('');
    } else land(current.current ?? session.origin);
  }

  function moveWithKeys(event: KeyboardEvent<HTMLButtonElement>) {
    if(!keyboardMoving||!current.current)return;
    const offsets: Record<string,[number,number]>={ArrowUp:[0,-36],ArrowDown:[0,36],ArrowLeft:[-36,0],ArrowRight:[36,0]};
    const offset=offsets[event.key];
    if(offset) {
      event.preventDefault();
      setPosition(pickPoint(undefined,true,{x:current.current.x+offset[0],y:current.current.y+offset[1]}) ?? current.current);
    } else if(event.key==='Escape') {
      event.preventDefault();
      setPosition(beforeKeyboard.current);
      setKeyboardMoving(false);
    }
  }

  function perform() {
    const choices = acts.filter(act => act !== lastAct.current);
    const act = choices[Math.floor(Math.random() * choices.length)]!;
    lastAct.current = act;
    showScene(tricks[act]);
  }

  useEffect(() => {
    const onActivity = (event: Event) => {
      const next = (event as CustomEvent<Activity>).detail;
      if (next === 'searching' || next === 'idle') searching.current = next === 'searching';
      if (next === 'idle') {
        if (button.current?.dataset.pose === 'searching') {
          window.clearTimeout(actionTimer.current);
          setPose('idle');
          setLine('');
        }
      } else if (button.current && !gesture.current && !paused()) {
        localInteractionUntil.current = Date.now() + 2800;
        showScene(reactions[next]);
      }
    };
    const onMode = (event: Event) => setMode((event as CustomEvent<PipMode>).detail);
    window.addEventListener('cloudcore:pip-activity', onActivity);
    window.addEventListener('cloudcore:pip-mode', onMode);
    return () => {
      window.clearTimeout(actionTimer.current);
      window.clearTimeout(effectTimer.current);
      window.clearTimeout(touchTapTimer.current);
      window.removeEventListener('cloudcore:pip-activity', onActivity);
      window.removeEventListener('cloudcore:pip-mode', onMode);
    };
  }, []);

  useEffect(() => {
    if (mode === 'off') return;
    let next: number;
    let viewportTimer: number;
    const place = () => {
      window.clearTimeout(travelTimer.current);
      window.clearTimeout(trailTimer.current);
      setMoving(false);
      if(gesture.current)return;
      setPosition(pickPoint(undefined,true,restorePoint()));
    };
    const viewportChanged = () => {
      if(gesture.current)return;
      window.clearTimeout(viewportTimer);
      viewportTimer = window.setTimeout(place, 130);
    };
    const schedule = (delay: number) => {
      next = window.setTimeout(() => {
        if (!paused() && !pipMotionReduced() && !searching.current && !gesture.current &&
            Date.now()>=Math.max(restUntil.current,localInteractionUntil.current) &&
            !document.activeElement?.closest('.pip-stage :focus-visible')) {
          const destination = pickPoint(current.current, false);
          if (destination) {
            const facing = !current.current || destination.x >= current.current.x ? 1 : -1;
            setDirection(facing);
            playEffect('dash',facing);
            window.clearTimeout(actionTimer.current);
            setPose('idle');
            const comments = travelLines.filter(comment => comment !== lastTravelLine.current);
            lastTravelLine.current = comments[Math.floor(Math.random() * comments.length)]!;
            setLine(lastTravelLine.current);
            setMoving(Boolean(current.current));
            setPosition(destination);
            trailTimer.current = window.setTimeout(()=>playEffect('dash',facing),1350);
            travelTimer.current = window.setTimeout(() => {
              setMoving(false);
              if (!paused() && !searching.current && Date.now() >= localInteractionUntil.current) perform();
            }, roamTravelSettleMs);
          } else perform();
        }
        schedule(roamTravelSettleMs + roamRestMs);
      }, delay);
    };
    const visibility = () => {
      if (document.hidden) {
        setPoint(undefined);
        window.clearTimeout(travelTimer.current);
        window.clearTimeout(trailTimer.current);
      } else place();
    };
    place();
    if (mode === 'roaming') schedule(2300 + Math.random() * 2000);
    window.addEventListener('resize', viewportChanged);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.clearTimeout(next);
      window.clearTimeout(travelTimer.current);
      window.clearTimeout(trailTimer.current);
      window.clearTimeout(viewportTimer);
      window.removeEventListener('resize', viewportChanged);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [mode]);

  if (mode === 'off') return null;
  return <div className="pip-stage" data-moving={moving} data-held={held} data-keyboard-moving={keyboardMoving} data-placed={Boolean(point)} data-facing={direction} data-locked={mode === 'docked'}
    data-bubble-side={point && point.x + size / 2 > innerWidth / 2 ? 'left' : 'right'}
    data-bubble-below={point && point.y < 125}
    style={point ? { left: point.x, top: point.y } : undefined}>
    {line && <span key={line} className="pip-speech">{line}</span>}
    <button ref={button} type="button" className="pip" title={mode === 'docked' ? 'Chat with Pip' : 'Chat with Pip or drag to move'} aria-label="Chat with Pip"
      tabIndex={point ? 0 : -1} data-pose={pose} onClick={event=>{
        window.clearTimeout(touchTapTimer.current);
        if(suppressClick.current&&event.detail!==0){suppressClick.current=false;return;}
        suppressClick.current=false;
        onOpenChat?.(event.currentTarget);
      }}
      onPointerDown={startDrag} onPointerMove={drag} onPointerUp={event=>stopDrag(event)}
      onPointerCancel={event=>stopDrag(event,true)} onLostPointerCapture={event=>stopDrag(event,true)}
      >
      <PipFace />
    </button>
    <button type="button" className="pip-lock" aria-label={mode === 'docked' ? 'Unlock Pip' : 'Lock Pip here'}
      title={mode === 'docked' ? 'Unlock Pip' : 'Lock Pip here'} aria-pressed={mode === 'docked'} tabIndex={point ? 0 : -1}
      onPointerDown={interruptTravel} onClick={toggleLock}><Icon name="lock" /></button>
    {mode !== 'docked' && <button type="button" className="pip-move" aria-label={keyboardMoving?'Drop Pip':'Move Pip'}
      aria-describedby={keyboardMoving?'pip-move-instructions':undefined} tabIndex={point ? 0 : -1}
      onKeyDown={moveWithKeys} onClick={()=>{
        interruptTravel();
        if(keyboardMoving&&current.current)land(current.current);
        else beforeKeyboard.current=current.current;
        setKeyboardMoving(value=>!value);
      }}><Icon name={keyboardMoving?'check':'expand'} /></button>}
    {keyboardMoving&&<span id="pip-move-instructions" className="kh-sr-only">Use the arrow keys to move Pip, Enter to drop, or Escape to cancel.</span>}
  </div>;
}

export function PipFace() {
  return <span className="pip-cloud" aria-hidden="true">
    <i className="pip-eye pip-eye-left" /><i className="pip-eye pip-eye-right" />
    <i className="pip-mouth" /><i className="pip-binoculars" /><i className="pip-arm" />
    <i className="pip-boot pip-boot-left" /><i className="pip-boot pip-boot-right" />
    <i className="pip-tear pip-tear-left" /><i className="pip-tear pip-tear-right" /><i className="pip-puff" />
    <i className="pip-prop pip-umbrella" /><i className="pip-prop pip-headphones" />
    <i className="pip-prop pip-wand" /><i className="pip-prop pip-flame" />
  </span>;
}
