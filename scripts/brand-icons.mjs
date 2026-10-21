// Optional asset-generation tool: pass the installed sharp package directory.
// Keeps Figma's exported SVGs unchanged and embeds them in the app-icon layout.
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const sharp=createRequire(import.meta.url)(process.argv[2]||'sharp');
const root=new URL('../',import.meta.url),at=name=>new URL(name,root);
const source=await Promise.all(['light','dark'].map(async theme=>`data:image/svg+xml;base64,${(await readFile(at(`icons/choryn-app-mark-${theme}.svg`))).toString('base64')}`));
const icon=(theme,maskable=false)=>`<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150"><rect width="150" height="150" rx="${maskable?0:32}" fill="${theme==='dark'?'#20162f':'#f1e8ff'}"/><image href="${source[theme==='dark'?1:0]}" x="26" y="52.12" width="98" height="47.04"/></svg>`;
const variants=[...([96,128,192,256,512,1024].map(size=>[`icon-${size}.png`,size,'light',size===1024])),...([120,152,167,180].map(size=>[`apple-touch-icon-${size}.png`,size,'light',true])),['apple-touch-icon.png',180,'light',true],['icon-dark-192.png',192,'dark',false],...([192,512].map(size=>[`icon-maskable-${size}.png`,size,'light',true])),...([16,32,48].map(size=>[`favicon-${size}.png`,size,'light',false]))];
for(const [name,size,theme,maskable] of variants)await sharp(Buffer.from(icon(theme,maskable))).resize(size,size).png().toFile(fileURLToPath(at('icons/'+name)));
await writeFile(at('apple-touch-icon.png'),await readFile(at('icons/apple-touch-icon.png')));
// ICO directory entries contain unchanged PNG payloads, preserving alpha.
const sizes=[16,32,48,256],buffers=await Promise.all(sizes.map(size=>sharp(Buffer.from(icon('light'))).resize(size,size).png().toBuffer()));
const header=Buffer.alloc(6+16*sizes.length);header.writeUInt16LE(1,2);header.writeUInt16LE(sizes.length,4);let offset=header.length;
buffers.forEach((buffer,i)=>{const pos=6+16*i;header[pos]=sizes[i]===256?0:sizes[i];header[pos+1]=header[pos];header.writeUInt16LE(1,pos+4);header.writeUInt16LE(32,pos+6);header.writeUInt32LE(buffer.length,pos+8);header.writeUInt32LE(offset,pos+12);offset+=buffer.length;});
await writeFile(at('favicon.ico'),Buffer.concat([header,...buffers]));
const favicon=`<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150"><style>.dark{display:none}@media(prefers-color-scheme:dark){.light{display:none}.dark{display:block}}</style><g class="light"><rect width="150" height="150" rx="32" fill="#f1e8ff"/><image href="${source[0]}" x="26" y="52.12" width="98" height="47.04"/></g><g class="dark"><rect width="150" height="150" rx="32" fill="#20162f"/><image href="${source[1]}" x="26" y="52.12" width="98" height="47.04"/></g></svg>`;
await writeFile(at('favicon.svg'),favicon+'\n');
console.log('Generated CHORYN PNG/ICO/SVG favicons, Apple touch, maskable and desktop icons from unchanged Figma SVGs.');
