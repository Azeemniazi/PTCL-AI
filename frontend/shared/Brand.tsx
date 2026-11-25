const paths = {
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  user: 'M20 21v-2a7 7 0 0 0-14 0v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  shield: 'm12 2 9 4v6c0 6-9 10-9 10S3 18 3 12V6Zm-4 9 3 3 5-6',
  lock: 'M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2Zm-7 4v3M7 11V7a5 5 0 0 1 10 0v4',
  search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  play: 'm8 4 12 8-12 8Z',
  chat: 'M21 11a9 9 0 0 1-9 9 10 10 0 0 1-4-.8L3 21l1.7-5A9 9 0 1 1 21 11ZM8 11h.01M12 11h.01M16 11h.01',
  file: 'M14 2H5v20h14V7Zm0 0v6h5M8 12h8M8 16h8',
  chart: 'M5 21v-6M12 21V9M19 21V3',
  image: 'M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM3 17l6-6 5 5 3-3 4 4M8 7h.01',
  sliders: 'M6 3v18M12 3v18M18 3v18M3 8h6M9 16h6M15 7h6',
  paperclip: 'm8 13 7-7a3 3 0 0 1 4 4l-9 9a5 5 0 0 1-7-7L13 2M7 14l9-9',
  video: 'M15 10l5-3v10l-5-3ZM3 6h12v12H3Z',
  clock: 'M12 7v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  folder: 'M3 6V3h6l3 3h9v14H3Z',
  trash: 'M3 6h18M8 6V3h8v3M5 6l1 16h12l1-16M10 10v8M14 10v8',
  check: 'm5 12 4 4L19 6',
  home: 'm3 11 9-8 9 8M5 10v11h5v-6h4v6h5V10',
  settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM9 3h6l.5 2.4 2 .9 2.1-1 3 5.2-1.7 1.5v2l1.7 1.5-3 5.2-2.1-1-2 .9L15 23H9l-.5-2.4-2-.9-2.1 1-3-5.2L3.1 14v-2l-1.7-1.5 3-5.2 2.1 1 2-.9Z',
  history: 'M3 12a9 9 0 1 1 2.6 6.4M3 12V6m0 6h6m3-4v5l3 2',
  menu: 'M3 6h18M3 12h18M3 18h18',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 8-3 9h18c0-1-3-2-3-9Zm-8 12h4',
  spark: 'M12 2l2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6Z',
  plus: 'M12 5v14M5 12h14',
  chevron: 'm9 6 6 6-6 6',
  chip: 'M7 7h10v10H7ZM10 10h4v4h-4ZM9 3v4m6-4v4M9 17v4m6-4v4M3 9h4m-4 6h4m10-6h4m-4 6h4',
  bulb: 'M9 18h6m-5 3h4m-5-6c0-2-3-2-3-6a6 6 0 0 1 12 0c0 4-3 4-3 6Z',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-4M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm4-4a4 4 0 0 1 0 8',
  signal: 'M3 14v6m6-11v11m6-15v15m6-18v18',
  download: 'M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4',
  logout: 'M11 4H4v16h7m-2-8h12m-4-4 4 4-4 4',
  building: 'M3 21h18M6 21V3h12v18M9 7h1m4 0h1M9 11h1m4 0h1m-6 4h1m4 0h1',
  link: 'M10 13a4 4 0 0 0 6 0l4-4a4 4 0 0 0-6-6l-2 2m2 6a4 4 0 0 0-6 0l-4 4a4 4 0 0 0 6 6l2-2',
  upload: 'M12 16V3M7 8l5-5 5 5M4 16v5h16v-5',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  globe: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM2 12h20m-10-10a18 18 0 0 1 0 20m0-20a18 18 0 0 0 0 20',
  more: 'M4 12h.01m8 0h.01m8 0h.01',
  close: 'm6 6 12 12M18 6 6 18',
  grid: 'M3 3h7v7H3Zm11 0h7v7h-7ZM3 14h7v7H3Zm11 0h7v7h-7Z',
  expand: 'M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5',
  help: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Zm-13-3a3 3 0 1 1 3 3v2m0 3h.01',
};

export function Icon({ name }: { name: keyof typeof paths }) {
  return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={paths[name]} />
  </svg>;
}

export function Mark({ className = '' }: { className?: string }) {
  return <img className={`brand-mark ${className}`} src="assets/cloudcore-mark.png" alt="" aria-hidden="true" />;
}

export function Brand() {
  return <a className="brand" href="#landing" aria-label="CloudCore AI landing page"><Mark />
    <span><strong>CloudCore <b>AI</b></strong><small>A product of PTCL Smart Cloud</small></span>
  </a>;
}
