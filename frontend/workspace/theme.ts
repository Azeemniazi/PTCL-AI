import type { KnowledgeFolder } from '../../src/models';

export function getFolderIconKey(folder?: KnowledgeFolder) {
  if (!folder) return 'general';
  const groups = [
    ['server', ['datacenter', 'server', 'facility', 'hardware']],
    ['partnership', ['partner', 'letter', 'legal', 'agreement', 'contract']],
    ['documents', ['product', 'doc', 'manual', 'spec']],
    ['cloud', ['qcloud', 'cloud', 'iaas', 'draas', 'baas']],
    ['security', ['iso', 'security', 'pci', 'policy', 'compliance']],
    ['analytics', ['analytic', 'report', 'metric', 'finance']],
    ['tech', ['tech', 'dev', 'code', 'api']],
  ] as const;
  const color = (folder.color || '').toLowerCase().trim();
  if (color === 'general' || groups.some(([key]) => key === color)) return color;
  const name = (folder.name || '').toLowerCase();
  return groups.find(([, terms]) => terms.some(term => name.includes(term)))?.[0] ?? 'general';
}

export function formatBytes(bytes: number) {
  if (!bytes || bytes <= 0) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${Number((bytes / 1024 ** index).toFixed(1))} ${sizes[index]}`;
}

export function backgroundMarkup(kind: 'sidebar' | 'assistant') {
  const file = kind === 'sidebar' ? 'sidebar-motion-slim' : 'assistant-motion';
  return `<video class="ref-background-video ref-${kind}-video" data-motion-background data-video-src="assets/${file}.mp4" poster="assets/${file}-poster.jpg" autoplay muted loop playsinline preload="none" disablepictureinpicture disableremoteplayback aria-hidden="true" tabindex="-1"></video>`;
}

function playVideo(video: HTMLVideoElement) {
  void video.play()?.catch(() => {});
}

function stagger(elements: NodeListOf<HTMLElement>, className: string, limit: number) {
  Array.from(elements).slice(0, limit).forEach((element, index) => {
    element.style.setProperty('--cc-stagger-i', String(index));
    element.classList.remove(className);
    void element.offsetWidth;
    element.classList.add(className);
  });
}

export function createWorkspaceTheme(getMotionMode: () => 'auto' | 'on' | 'off') {
  let motionQuery: MediaQueryList | undefined;
  let observer: IntersectionObserver | undefined;
  let listenersReady = false;
  let videos: HTMLVideoElement[] = [];
  const cache = new Map<string, HTMLVideoElement>();
  const animations = { route: '', knowledgeKey: '', assistantCount: 0, knowledgeCount: 0 };

  function reducedMotion() {
    const mode = getMotionMode();
    return mode === 'off' || (mode !== 'on' && Boolean(motionQuery?.matches));
  }

  const canPlay = (video: HTMLVideoElement) => !reducedMotion() && !document.hidden && video.dataset.motionVisible !== 'false';

  function syncMotion() {
    if (!listenersReady) {
      listenersReady = true;
      motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
      if (motionQuery?.addEventListener) motionQuery.addEventListener('change', syncMotion);
      else motionQuery?.addListener(syncMotion);
      document.addEventListener('visibilitychange', syncMotion);
      if (typeof IntersectionObserver !== 'undefined') {
        observer = new IntersectionObserver(entries => {
          for (const { target, isIntersecting, intersectionRatio } of entries) {
            if (target instanceof HTMLElement) target.dataset.motionVisible = String(isIntersecting && intersectionRatio > 0);
          }
          syncMotion();
        }, { threshold: 0.01 });
      }
    }
    document.documentElement?.classList.toggle('cc-reduced-motion', reducedMotion());
    const nextVideos = Array.from(document.querySelectorAll<HTMLVideoElement>('video[data-motion-background]'), video => {
      const source = video.dataset.videoSrc;
      if (!source) return video;
      const cached = cache.get(source);
      if (cached && cached !== video && cached.getAttribute('src')) {
        cached.className = video.className;
        video.replaceWith(cached);
        return cached;
      }
      cache.set(source, video);
      return video;
    });
    for (const video of videos) {
      if (nextVideos.includes(video)) continue;
      video.pause();
      observer?.unobserve(video);
    }
    for (const video of nextVideos) {
      if (!videos.includes(video)) observer?.observe(video);
      if (!video.dataset.motionLoopBound) {
        video.dataset.motionLoopBound = 'true';
        video.loop = true;
        video.addEventListener('ended', () => {
          video.currentTime = 0;
          if (videos.includes(video) && canPlay(video)) playVideo(video);
        });
      }
      if (!canPlay(video)) { video.pause(); continue; }
      video.muted = true;
      if (!video.getAttribute('src') && video.dataset.videoSrc) video.setAttribute('src', video.dataset.videoSrc);
      if (video.paused) playVideo(video);
    }
    videos = nextVideos;
  }

  function decorate(assistantCount: number, knowledgeCount: number, knowledgeKey: string) {
    const route = location.hash.slice(1).split(/[?/]/)[0] || 'landing';
    if (route !== animations.route) {
      animations.route = route;
      const main = document.querySelector<HTMLElement>('.workspace-main');
      if (main) {
        main.classList.remove('cc-route-enter');
        void main.offsetWidth;
        main.classList.add('cc-route-enter');
      }
    }
    const knowledgeRoute = route === 'documents' || route === 'knowledge';
    if (knowledgeRoute && knowledgeKey !== animations.knowledgeKey) {
      animations.knowledgeKey = knowledgeKey;
      stagger(document.querySelectorAll('.ref-knowledge-table-modern tbody tr'), 'cc-stagger-enter', 10);
      stagger(document.querySelectorAll('.ref-folder-card-modern'), 'cc-stagger-enter', 8);
    } else if (!knowledgeRoute) animations.knowledgeKey = '';

    function animateMessages(selector: string, count: number, previousCount: number) {
      if (count <= previousCount) return;
      const nodes = Array.from(document.querySelectorAll(selector));
      for (const node of nodes.slice(-Math.min(2, count - previousCount))) {
        node.classList.add('cc-msg-enter');
        stagger(node.querySelectorAll('.citation-chip'), 'cc-citation-settle', 8);
      }
    }
    if (route === 'assistant') animateMessages('.messages .message', assistantCount, animations.assistantCount);
    if (knowledgeRoute) animateMessages('.ref-knowledge-message', knowledgeCount, animations.knowledgeCount);
    animations.assistantCount = assistantCount;
    animations.knowledgeCount = knowledgeCount;
  }

  return { syncMotion, decorate };
}
