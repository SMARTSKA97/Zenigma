// Builds apps/web/public/changelog.json from mobile/release-notes/<version>.md (newest first) for the version history screen.
// Each notes file may start with a comment such as: <!-- date: 2026-10-12 -->
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const dir = new URL('../mobile/release-notes/', import.meta.url);
const out = new URL('../apps/web/public/', import.meta.url);
const semver = (v) => v.split('.').map(Number);
const compare = (a, b) => {
  const [x, y] = [semver(a), semver(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return y[i] - x[i];
  return 0;
};

const entries = readdirSync(dir)
  .filter((f) => /^\d+\.\d+\.\d+\.md$/.test(f))
  .map((f) => {
    const version = f.slice(0, -3);
    const text = readFileSync(new URL(f, dir), 'utf8');
    const date = /<!--\s*date:\s*(\d{4}-\d{2}-\d{2})\s*-->/.exec(text)?.[1] ?? null;
    return { version, date, notes: text.replace(/<!--[\s\S]*?-->/g, '').trim() };
  })
  .sort((a, b) => compare(a.version, b.version));

mkdirSync(out, { recursive: true });
writeFileSync(new URL('changelog.json', out), JSON.stringify(entries));
console.log(`changelog.json: ${entries.length} versions, latest ${entries[0]?.version}`);
