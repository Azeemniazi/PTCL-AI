const fs = require('fs');
const path = require('path');

const outDir = path.resolve(__dirname, '../dist/assets/folders');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const folderThemes = {
  server: {
    id: 'server',
    label: 'Datacenter & Servers',
    desc: 'Hardware, infrastructure & DC certifications',
    backGradient: ['#d97706', '#92400e'],
    frontGradient: ['#fbbf24', '#d97706'],
    accent: '#fef3c7',
    badgeBg: 'rgba(146, 64, 14, 0.28)',
    badgeStroke: 'rgba(255, 255, 255, 0.4)',
    badgeIcon: `
      <!-- Server Rack -->
      <rect x="39" y="42" width="18" height="4.5" rx="1.5" fill="#ffffff" opacity="0.95"/>
      <circle cx="42" cy="44.25" r="0.9" fill="#10b981"/>
      <circle cx="45" cy="44.25" r="0.9" fill="#10b981"/>
      <line x1="48" y1="44.25" x2="54" y2="44.25" stroke="#d97706" stroke-width="1" stroke-linecap="round"/>

      <rect x="39" y="48" width="18" height="4.5" rx="1.5" fill="#ffffff" opacity="0.95"/>
      <circle cx="42" cy="50.25" r="0.9" fill="#10b981"/>
      <circle cx="45" cy="50.25" r="0.9" fill="#3b82f6"/>
      <line x1="48" y1="50.25" x2="54" y2="50.25" stroke="#d97706" stroke-width="1" stroke-linecap="round"/>

      <rect x="39" y="54" width="18" height="4.5" rx="1.5" fill="#ffffff" opacity="0.95"/>
      <circle cx="42" cy="56.25" r="0.9" fill="#10b981"/>
      <circle cx="45" cy="56.25" r="0.9" fill="#10b981"/>
      <line x1="48" y1="56.25" x2="54" y2="56.25" stroke="#d97706" stroke-width="1" stroke-linecap="round"/>
    `
  },
  partnership: {
    id: 'partnership',
    label: 'Partnerships & Legal',
    desc: 'Contracts, partner letters & agreements',
    backGradient: ['#2563eb', '#1e40af'],
    frontGradient: ['#60a5fa', '#2563eb'],
    accent: '#dbeafe',
    badgeBg: 'rgba(30, 64, 175, 0.28)',
    badgeStroke: 'rgba(255, 255, 255, 0.4)',
    badgeIcon: `
      <!-- Handshake -->
      <path d="M40 48 l5 -4 c1.5 -1.5 4 -1 5 1 l2 2 c1 1 1 3 0 4 l-4 4 c-1 1 -3 1 -4 0 z" fill="#ffffff" opacity="0.95"/>
      <path d="M56 48 l-5 -4 c-1.5 -1.5 -4 -1 -5 1 l-2 2 c-1 1 -1 3 0 4 l4 4 c1 1 3 1 4 0 z" fill="#ffffff" opacity="0.85"/>
      <circle cx="48" cy="49" r="2.5" fill="#1d4ed8"/>
    `
  },
  documents: {
    id: 'documents',
    label: 'Product Documents',
    desc: 'Specifications, product docs & manuals',
    backGradient: ['#059669', '#065f46'],
    frontGradient: ['#34d399', '#059669'],
    accent: '#d1fae5',
    badgeBg: 'rgba(6, 95, 70, 0.28)',
    badgeStroke: 'rgba(255, 255, 255, 0.4)',
    badgeIcon: `
      <!-- Document Spec -->
      <rect x="41" y="42" width="14" height="18" rx="2" fill="#ffffff" opacity="0.95"/>
      <line x1="44" y1="46" x2="52" y2="46" stroke="#059669" stroke-width="1.3" stroke-linecap="round"/>
      <line x1="44" y1="50" x2="52" y2="50" stroke="#059669" stroke-width="1.3" stroke-linecap="round"/>
      <line x1="44" y1="54" x2="49" y2="54" stroke="#059669" stroke-width="1.3" stroke-linecap="round"/>
    `
  },
  cloud: {
    id: 'cloud',
    label: 'Cloud & Infrastructure',
    desc: 'QCloud, cloud services & architectures',
    backGradient: ['#7c3aed', '#5b21b6'],
    frontGradient: ['#a78bfa', '#7c3aed'],
    accent: '#ede9fe',
    badgeBg: 'rgba(91, 33, 182, 0.28)',
    badgeStroke: 'rgba(255, 255, 255, 0.4)',
    badgeIcon: `
      <!-- Cloud -->
      <path d="M43 54 a4 4 0 0 1 -1 -7.8 a6 6 0 0 1 11 -1 a4.5 4.5 0 0 1 4 4.8 a4 4 0 0 1 -3 4 z" fill="#ffffff" opacity="0.95"/>
    `
  },
  security: {
    id: 'security',
    label: 'Security & Compliance',
    desc: 'ISO, PCI DSS & security policies',
    backGradient: ['#dc2626', '#991b1b'],
    frontGradient: ['#f87171', '#dc2626'],
    accent: '#fee2e2',
    badgeBg: 'rgba(153, 27, 27, 0.28)',
    badgeStroke: 'rgba(255, 255, 255, 0.4)',
    badgeIcon: `
      <!-- Security Shield -->
      <path d="M48 42 l7 3 v5 c0 5 -4 8 -7 9 c-3 -1 -7 -4 -7 -9 v-5 z" fill="#ffffff" opacity="0.95"/>
      <path d="M45.5 49.5 l2 2 l4 -4" stroke="#dc2626" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    `
  },
  analytics: {
    id: 'analytics',
    label: 'Analytics & Financials',
    desc: 'Cost models, SLA metrics & reports',
    backGradient: ['#0d9488', '#115e59'],
    frontGradient: ['#2dd4bf', '#0d9488'],
    accent: '#ccfbf1',
    badgeBg: 'rgba(17, 94, 89, 0.28)',
    badgeStroke: 'rgba(255, 255, 255, 0.4)',
    badgeIcon: `
      <!-- Bar Chart -->
      <rect x="41" y="52" width="3.5" height="7" rx="1" fill="#ffffff" opacity="0.95"/>
      <rect x="46.2" y="47" width="3.5" height="12" rx="1" fill="#ffffff" opacity="0.95"/>
      <rect x="51.5" y="43" width="3.5" height="16" rx="1" fill="#ffffff" opacity="0.95"/>
    `
  },
  tech: {
    id: 'tech',
    label: 'Engineering & Tech',
    desc: 'APIs, software architectures & guides',
    backGradient: ['#4f46e5', '#3730a3'],
    frontGradient: ['#818cf8', '#4f46e5'],
    accent: '#e0e7ff',
    badgeBg: 'rgba(55, 48, 163, 0.28)',
    badgeStroke: 'rgba(255, 255, 255, 0.4)',
    badgeIcon: `
      <!-- Microchip -->
      <rect x="43" y="45" width="10" height="10" rx="2" fill="#ffffff" opacity="0.95"/>
      <rect x="45.5" y="47.5" width="5" height="5" rx="1" fill="#4f46e5"/>
      <line x1="41" y1="47" x2="43" y2="47" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round"/>
      <line x1="41" y1="50" x2="43" y2="50" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round"/>
      <line x1="41" y1="53" x2="43" y2="53" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round"/>
      <line x1="53" y1="47" x2="55" y2="47" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round"/>
      <line x1="53" y1="50" x2="55" y2="50" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round"/>
      <line x1="53" y1="53" x2="55" y2="53" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round"/>
    `
  },
  general: {
    id: 'general',
    label: 'General & Operations',
    desc: 'Operations, workspace shared & uncategorized',
    backGradient: ['#005437', '#003322'],
    frontGradient: ['#10b981', '#005437'],
    accent: '#d1fae5',
    badgeBg: 'rgba(0, 51, 34, 0.28)',
    badgeStroke: 'rgba(255, 255, 255, 0.4)',
    badgeIcon: `
      <!-- Star / Brand -->
      <path d="M48 43 l2 4.5 l4.8 0.5 l-3.6 3.2 l1 4.8 l-4.2 -2.4 l-4.2 2.4 l1 -4.8 l-3.6 -3.2 l4.8 -0.5 z" fill="#ffffff" opacity="0.95"/>
    `
  }
};

function render3dFolderSvg(t) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 84" width="100%" height="100%" fill="none" class="ref-3d-folder-svg">
  <defs>
    <!-- Soft Ambient Floor Shadow -->
    <filter id="shadow-${t.id}" x="-20%" y="-20%" width="140%" height="150%">
      <feDropShadow dx="0" dy="8" stdDeviation="6" flood-color="#000000" flood-opacity="0.18" />
    </filter>

    <!-- Flap Depth Shadow -->
    <filter id="flap-shadow-${t.id}" x="-10%" y="-10%" width="120%" height="130%">
      <feDropShadow dx="0" dy="4" stdDeviation="3.5" flood-color="#000000" flood-opacity="0.22" />
    </filter>

    <!-- Gradients -->
    <linearGradient id="back-${t.id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${t.backGradient[0]}" />
      <stop offset="100%" stop-color="${t.backGradient[1]}" />
    </linearGradient>

    <linearGradient id="front-${t.id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${t.frontGradient[0]}" />
      <stop offset="100%" stop-color="${t.frontGradient[1]}" />
    </linearGradient>

    <linearGradient id="paper-spec" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#e6edf5" />
    </linearGradient>

    <linearGradient id="highlight-${t.id}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="rgba(255,255,255,0.6)" />
      <stop offset="50%" stop-color="rgba(255,255,255,0.2)" />
      <stop offset="100%" stop-color="rgba(255,255,255,0.4)" />
    </linearGradient>
  </defs>

  <!-- 1. Ambient Drop Shadow -->
  <ellipse cx="48" cy="74" rx="38" ry="6" fill="#000000" opacity="0.16" filter="blur(3px)" />

  <!-- 2. Back Flap & Tab -->
  <g filter="url(#shadow-${t.id})">
    <!-- Tab -->
    <path d="M14 26 C14 21 17 17 22 17 L38 17 C42 17 45 20 47 23 L51 27 L80 27 C85 27 88 30 88 35 L88 64 C88 69 84 72 79 72 L17 72 C12 72 10 69 10 64 L10 30 C10 26 12 26 14 26 Z" fill="url(#back-${t.id})" />
  </g>

  <!-- 3. Documents inside pocket (White paper sheets with 3D angle) -->
  <!-- Sheet 2 (Back) -->
  <rect x="23" y="16" width="48" height="34" rx="3" fill="#cbd5e1" transform="rotate(-3 23 16)" opacity="0.75" />
  <!-- Sheet 1 (Front crisp white) -->
  <g filter="drop-shadow(0 2px 3px rgba(0,0,0,0.12))">
    <rect x="25" y="14" width="46" height="36" rx="3.5" fill="url(#paper-spec)" />
    <!-- Text lines on sheet -->
    <line x1="30" y1="20" x2="48" y2="20" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round" />
    <line x1="30" y1="24" x2="62" y2="24" stroke="#cbd5e1" stroke-width="1.3" stroke-linecap="round" />
    <line x1="30" y1="28" x2="56" y2="28" stroke="#cbd5e1" stroke-width="1.3" stroke-linecap="round" />
  </g>

  <!-- 4. Front Flap (Isometric glossy 3D front) -->
  <g filter="url(#flap-shadow-${t.id})">
    <path d="M10 33 C10 29.5 13 27 17 27 L79 27 C83 27 86 29.5 86 33 L84 66 C84 71 80 74 75 74 L21 74 C16 74 12 71 12 66 Z" fill="url(#front-${t.id})" />
    <!-- Top specular edge highlight -->
    <path d="M12 29.5 L84 29.5" stroke="url(#highlight-${t.id})" stroke-width="1.6" stroke-linecap="round" />
  </g>

  <!-- 5. 3D Embossed Feature Badge -->
  <rect x="35" y="38" width="26" height="24" rx="7" fill="${t.badgeBg}" stroke="${t.badgeStroke}" stroke-width="1.2" />
  <!-- Gloss on Badge -->
  <path d="M36 44 C36 40 38 39 42 39 L54 39 C58 39 60 40 60 44" stroke="rgba(255,255,255,0.45)" stroke-width="0.8" fill="none" />
  ${t.badgeIcon}
</svg>`;
}

// Generate all SVGs
for (const [key, t] of Object.entries(folderThemes)) {
  const svg = render3dFolderSvg(t);
  const outPath = path.join(outDir, `folder-${key}.svg`);
  fs.writeFileSync(outPath, svg, 'utf8');
  console.log(`Generated: ${outPath}`);
}

// Also write a helper module for the frontend to easily embed or reference them
const themeManifest = Object.entries(folderThemes).map(([k, v]) => ({
  id: v.id,
  label: v.label,
  desc: v.desc,
  file: `folder-${v.id}.svg`
}));
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(themeManifest, null, 2));

console.log('Successfully generated all 8 3D folder icons!');
