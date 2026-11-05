// Erzeugt die PNG-Symbole aus public/icon.svg (iPhone braucht PNG). Aufruf: node werkzeuge/icons.mjs
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
// Playwright ist auf dem Rechner global installiert, nicht im Projekt
const { chromium } = createRequire(execSync('npm root -g').toString().trim() + '/')('playwright');
import { readFileSync } from 'node:fs';

const svg = readFileSync(new URL('../public/icon.svg', import.meta.url), 'utf8');
const browser = await chromium.launch();
const seite = await browser.newPage();
for (const [name, groesse] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  await seite.setViewportSize({ width: groesse, height: groesse });
  await seite.setContent(`<body style="margin:0">${svg.replace('<svg ', `<svg width="${groesse}" height="${groesse}" `)}</body>`);
  await seite.screenshot({ path: new URL(`../public/${name}`, import.meta.url).pathname, omitBackground: true });
}
await browser.close();
