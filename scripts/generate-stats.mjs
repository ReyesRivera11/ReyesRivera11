#!/usr/bin/env node
// Genera assets/stats.svg con datos reales de la API de GitHub.
// Sin dependencias externas: requiere Node 18+ (fetch global).

const USER = process.env.GH_USER || 'ReyesRivera11';
const TOKEN = process.env.GITHUB_TOKEN || '';

const LANG_COLORS = {
  JavaScript: '#F1E05A', TypeScript: '#3178C6', Dart: '#00B4AB', Kotlin: '#A97BFF',
  HTML: '#E34C26', CSS: '#563D7C', Python: '#3572A5', 'C++': '#F34B7D', C: '#555555',
  Java: '#B07219', Go: '#00ADD8', Rust: '#DEA584', PHP: '#4F5D95', Ruby: '#701516',
  Shell: '#89E051', Vue: '#41B883', Svelte: '#FF3E00', Swift: '#F05138', SCSS: '#C6538C',
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

async function api(path) {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': USER };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

async function collect() {
  const user = await api(`/users/${USER}`);
  const repos = await api(`/users/${USER}/repos?per_page=100&sort=pushed`);
  const own = repos.filter((r) => !r.fork);

  const bytes = {};
  for (const r of own) {
    try {
      const langs = await api(`/repos/${USER}/${r.name}/languages`);
      for (const [k, v] of Object.entries(langs)) bytes[k] = (bytes[k] || 0) + v;
    } catch {
      /* un repo sin lenguajes no debe tumbar la generación */
    }
  }

  const total = Object.values(bytes).reduce((a, b) => a + b, 0) || 1;
  const langs = Object.entries(bytes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, v]) => ({ name, pct: (v * 100) / total }));

  return {
    repos: own.length,
    stars: own.reduce((a, r) => a + r.stargazers_count, 0),
    followers: user.followers,
    since: new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }),
    langs,
  };
}

function render(d) {
  const W = 880, H = 258;
  const stats = [
    ['Public repositories', d.repos],
    ['Total stars earned', d.stars],
    ['Followers', d.followers],
    ['On GitHub since', d.since],
  ];

  const statRows = stats.map(([label, value], i) => {
    const y = 86 + i * 36;
    return `  <text x="36" y="${y}" fill="#9FB0C3" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="14">${esc(label)}</text>
  <text x="372" y="${y}" fill="#FFFFFF" text-anchor="end" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="14" font-weight="600">${esc(value)}</text>`;
  }).join('\n');

  const barX = 560, barW = 232;
  const langRows = d.langs.map((l, i) => {
    const y = 74 + i * 29;
    const color = LANG_COLORS[l.name] || '#00D4FF';
    const w = Math.max(3, Math.round((barW * l.pct) / 100));
    return `  <text x="440" y="${y + 4}" fill="#9FB0C3" font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="13">${esc(l.name)}</text>
  <rect x="${barX}" y="${y - 7}" width="${barW}" height="9" rx="4.5" fill="#1B2836"/>
  <rect x="${barX}" y="${y - 7}" width="${w}" height="9" rx="4.5" fill="${color}"/>
  <text x="844" y="${y + 4}" fill="#FFFFFF" text-anchor="end" font-family="Consolas, Menlo, Monaco, monospace" font-size="12">${l.pct.toFixed(1)}%</text>`;
  }).join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="GitHub stats for ${esc(USER)}">
  <defs>
    <linearGradient id="edge" x1="0" y1="0" x2="0" y2="${H}" gradientUnits="userSpaceOnUse">
      <stop stop-color="#00D4FF"/>
      <stop offset="1" stop-color="#0B3D91"/>
    </linearGradient>
  </defs>

  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="12" fill="#0D1117" stroke="#1B2836"/>
  <rect x="0" y="12" width="4" height="${H - 24}" rx="2" fill="url(#edge)"/>

  <text x="36" y="44" fill="#00D4FF" font-family="Consolas, Menlo, Monaco, monospace" font-size="13" letter-spacing="3">OVERVIEW</text>
  <text x="440" y="44" fill="#00D4FF" font-family="Consolas, Menlo, Monaco, monospace" font-size="13" letter-spacing="3">MOST USED LANGUAGES</text>

  <line x1="408" y1="30" x2="408" y2="${H - 30}" stroke="#1B2836" stroke-width="1"/>

${statRows}
${langRows}
</svg>
`;
}

async function main() {
  const fs = await import('node:fs/promises');
  const data = await collect();
  await fs.mkdir('assets', { recursive: true });
  await fs.writeFile('assets/stats.svg', render(data));
  console.log('assets/stats.svg actualizado', JSON.stringify(data));
}

export { render, collect };

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
