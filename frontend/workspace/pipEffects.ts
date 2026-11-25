type Effect = 'dash' | 'land' | 'celebrate' | 'curious' | 'sneeze' | 'rain' | 'pickup' | 'launch' | 'shower' | 'magic';

type Sakuga = {
  puff(x: number, y: number, options: { n: number; size: number; vx?: number; life: number }): void;
  ring(x: number, y: number, options: { rx: number; ry: number; life: number; w: number }): void;
  burst(x: number, y: number, options: { r: number; spikes: number; life: number }): void;
  lines(x: number, y: number, options: { dir: number; n: number; len: number; spread: number; life: number }): void;
  kira(x: number, y: number, options: { r: number; life: number; col: string }): void;
  wob(x: number, y: number, options: { r: number; life: number; dir: number }): void;
  splash(x: number, y: number, options: { w: number; h: number; life: number }): void;
  slash(x: number, y: number, options: { len: number; ang: number; thick: number; life: number; col: string }): void;
};

export function pipMotionReduced() {
  return document.documentElement.classList.contains('cc-reduced-motion') ||
    (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false);
}

export async function pipEffect(element: HTMLElement | null, effect: Effect, direction = 1) {
  if (!element?.isConnected || pipMotionReduced() || document.hidden || !('CanvasRenderingContext2D' in window)) return;
  await import('../vendor/sakuga/core.js');
  if (!element.isConnected || pipMotionReduced() || document.hidden || !element.getClientRects().length) return;
  const fx = (window as Window & { SakugaFX?: Sakuga }).SakugaFX;
  if (!fx) return;
  const rect = element.getBoundingClientRect();
  const x = rect.left + rect.width / 2 + window.scrollX;
  const y = rect.top + rect.height / 2 + window.scrollY;
  const sparkle = (dx: number, dy: number, r: number) => fx.kira(x + dx, y + dy, {r, life:.85, col:'#a4f7d4'});
  switch (effect) {
    case 'dash':
      fx.lines(x - direction * 17, y + 8, {dir: direction > 0 ? Math.PI : 0, n:6, len:56, spread:30, life:.46});
      fx.puff(x - direction * 20, y + 15, {n:5, size:12, vx:-direction * 90, life:.65});
      break;
    case 'land':
      fx.ring(x, y + 24, {rx:38, ry:9, life:.47, w:3});
      fx.puff(x, y + 23, {n:6, size:12, life:.59});
      break;
    case 'celebrate':
      fx.burst(x, y, {r:46, spikes:11, life:.45});
      sparkle(-33,-20,11); sparkle(32,-26,10); sparkle(15,-39,7);
      break;
    case 'curious':
      sparkle(-25,-24,7); sparkle(32,-13,11);
      break;
    case 'sneeze':
      fx.puff(x + direction * 22, y + 6, {n:6,size:15,vx:direction * 140,life:.72});
      fx.lines(x + direction * 12, y + 7, {dir:direction > 0 ? 0 : Math.PI,n:4,len:34,spread:18,life:.34});
      break;
    case 'rain':
      fx.wob(x - 25, y + 6, {r:14,life:.52,dir:-1});
      fx.wob(x + 25, y + 6, {r:14,life:.52,dir:1});
      break;
    case 'pickup':
      fx.ring(x, y + 18, {rx:33,ry:11,life:.43,w:3});
      sparkle(-24,-23,10); sparkle(26,-18,8);
      break;
    case 'launch':
      fx.lines(x,y+16,{dir:Math.PI/2,n:8,len:58,spread:26,life:.73});
      fx.puff(x,y+23,{n:7,size:16,life:.85});
      break;
    case 'shower':
      fx.splash(x,y+24,{w:41,h:23,life:.8});
      sparkle(31,-21,7);
      break;
    case 'magic':
      fx.slash(x+18,y-12,{len:58,ang:-.48,thick:8,life:.52,col:'#8af2c4'});
      sparkle(34,-32,12); sparkle(-29,-12,8); sparkle(1,-39,6);
      break;
  }
}
