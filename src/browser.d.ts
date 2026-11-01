/** Optional platform features used behind runtime capability checks. */
interface Navigator {readonly standalone?:boolean}
interface Window {webkitAudioContext?:typeof AudioContext}
declare var webkitAudioContext: typeof AudioContext | undefined;
declare var AudioEncoder: {isConfigSupported(config: {codec:string;numberOfChannels:number;sampleRate:number;bitrate?:number}):Promise<{supported:boolean}>} | undefined;
interface HTMLVideoElement {requestVideoFrameCallback?(callback:(now:number,metadata:{mediaTime:number})=>void):number; cancelVideoFrameCallback?(handle:number):void}
interface Document {webkitFullscreenElement?:Element; webkitExitFullscreen?:()=>Promise<void>}
interface HTMLElement {webkitRequestFullscreen?:()=>Promise<void>}
