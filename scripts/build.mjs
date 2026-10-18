import { cp, mkdir, rm } from 'node:fs/promises';
await rm(new URL('../dist', import.meta.url), { recursive: true, force: true });
await mkdir(new URL('../dist', import.meta.url));
for (const file of ['index.html', 'favicon.svg', 'src']) {
  await cp(new URL(`../${file}`, import.meta.url), new URL(`../dist/${file}`, import.meta.url), { recursive: true });
}
console.log('CHORYN Studio built → dist/');
