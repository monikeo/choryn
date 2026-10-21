// Optional asset-generation tool: pass the installed sharp package directory.
// Keeps Figma's exported SVGs unchanged and embeds them in the app-icon layout.
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const sharp=createRequire(import.meta.url)(process.argv[2]||'sharp');
const root=new URL('../',import.meta.url),at=name=>new URL(name,root);
const source=await Promise.all(['light','dark'].map(async theme=>`data:image/svg+xml;base64,${(await readFile(at(`icons/choryn-app-mark-${theme}.svg`))).toString('base64')}`));
const icon=(theme,maskable=false)=>`<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150"><rect width="150" height="150" rx="${maskable?0:32}" fill="${theme==='dark'?'#20162f':'#f1e8ff'}"/><image href="${source[theme==='dark'?1:0]}" x="26" y="52.12" width="98" height="47.04"/></svg>`;
for(const [name,size,theme,maskable] of [['icon-192.png',192,'light',false],['icon-512.png',512,'light',false],['apple-touch-icon.png',180,'light',true],['icon-dark-192.png',192,'dark',false],['icon-maskable-512.png',512,'light',true],['favicon-32.png',32,'light',false]])await sharp(Buffer.from(icon(theme,maskable))).resize(size,size).png().toFile(fileURLToPath(at('icons/'+name)));
const favicon=`<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150"><style>.dark{display:none}@media(prefers-color-scheme:dark){.light{display:none}.dark{display:block}}</style><g class="light"><rect width="150" height="150" rx="32" fill="#f1e8ff"/><image href="${source[0]}" x="26" y="52.12" width="98" height="47.04"/></g><g class="dark"><rect width="150" height="150" rx="32" fill="#20162f"/><image href="${source[1]}" x="26" y="52.12" width="98" height="47.04"/></g></svg>`;
await writeFile(at('favicon.svg'),favicon+'\n');
console.log('Generated CHORYN favicon and six app-icon sizes/variants from unchanged Figma SVGs.');
