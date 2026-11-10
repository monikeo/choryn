export type SearchableCommand={title?:string;keywords?:string;group?:string};
const normalize=(text:unknown)=>String(text||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
/** Commands matching every word of the query (accents ignored), best title matches first. */
export function searchCommands<T extends SearchableCommand>(commands:T[],query:string,limit=40):T[]{const words=normalize(query).trim().split(/\s+/).filter(Boolean);return commands.map((c,i)=>{const title=normalize(c.title),text=title+' '+normalize(c.keywords)+' '+normalize(c.group);return {c,i,score:words.every(w=>text.includes(w))?words.reduce((n,w)=>n+(title.startsWith(w)?6:title.includes(w)?3:1),0):-1};}).filter(r=>r.score>=0).sort((a,b)=>b.score-a.score||a.i-b.i).slice(0,limit).map(r=>r.c);}
