/** WCAG relative luminance of a #rrggbb colour. */
export function luminance(hex:string){const channels=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;}
/** WCAG contrast ratio between two #rrggbb colours (1 to 21). */
export function contrast(a:string,b:string){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
/** White or black text, whichever reaches WCAG AA (4.5:1) on the background. */
export function contrastText(background:string){return contrast(background,'#ffffff')>=4.5?'#ffffff':'#000000';}
