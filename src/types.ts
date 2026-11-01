/** Portable score data. Coordinates are metres, times are seconds. */
export interface Point {x:number; z:number}
export interface Pose extends Point {performerId:string; facing:number; visible:boolean}
export interface Performer {id:string; name:string; number:number; group:string; tags:string[]; color:string; role:string; costume?:string}
export interface Transition {duration:number; easing:string; pathType:string}
export interface Formation {id:string; name:string; time:number; status:string; notes:string; positions:Pose[]; transition?:Transition}
export interface Cue {id:string; time:number; label:string}
export interface Stage {width:number; depth:number; grid:number}
export interface Music {mode:string; trimStart:number; trimEnd:number|null; start:number; beatOffset:number}
export interface Route {id:string; fromId:string; toId:string; performerId:string; delay:number; duration:number; easing:string; timingCurve?:number[]; curve?:string; locked:boolean; waypoints:Point[]}
export interface PropPose extends Point {width:number; depth:number; height:number; rotation:number; color:string; shape:string}
export interface PropKeyframe extends PropPose {id:string; time:number; easing:string}
export interface Attachment extends Point {id:string; time:number; performerId:string|null; rotate:boolean; rotation:number}
export interface StageProp extends PropPose {id:string; name:string; kind:string; locked:boolean; keyframes:PropKeyframe[]; attachments:Attachment[]; carrierId?:string; unavailableCarrierId?:string}
export interface Attendance {id:string; absentId:string; coverId:string|null; fromId:string; toId:string; enabled:boolean}
export interface Constraint {id:string; formationId:string; type:string; members:string[]; value:number}
export interface Traffic {id:string; performerId:string; zoneId:string; kind:string; start:number; end:number}
export interface Ensemble {assignmentLocks:string[]; attendance:Attendance[]; constraints:Constraint[]; traffic:Traffic[]; seat:Point&{height:number}}
export interface Zone extends Point {id:string; name:string; kind:string; width:number; depth:number; height:number; color:string}
export interface StageImage extends Point {data:string; width:number; depth:number; rotation:number; opacity:number}
export interface Light extends Point {id:string; name:string; time:number; fixture:string; radius:number; intensity:number; color:string; fade:boolean}
export interface Appearance {id:string; performerId:string; time:number; color:string; costume:string}
export interface CameraKey extends Point {id:string; time:number; zoom:number; yaw:number; pitch:number}
export interface TrackLayer {hidden:boolean; locked:boolean; collapsed:boolean}
export type TrackName='music'|'formations'|'movement'|'cues'|'props'|'lighting'|'appearance'|'camera';
export interface Production {stage:{outline:Point[]; lines:{a:Point;b:Point}[]; image:StageImage|null}; zones:Zone[]; lights:Light[]; appearances:Appearance[]; cameras:CameraKey[]; links:{id:string;name:string;items:string[]}[]; layers:Record<TrackName,TrackLayer>; ripple:boolean; cameraEnabled:boolean}
export interface ReferenceVideo {id:string; name:string; duration:number; trimStart:number; trimEnd:number; start:number; fps:number; visible:boolean}
export interface Action {id:string; name:string; start:number; end:number; category:string; performerIds:string[]; notes:string; status:string; reference:string}
export interface Rehearsal {id:string; name:string; location:string; start:string; minutes:number; notes:string; performerIds:string[]; status:string}
export interface ReviewComment {id:string; author:string; text:string; time:number; createdAt:number; resolved:boolean}
export interface Project {schemaVersion:number; extensionVersion:number; id:string; name:string; discipline:string; description:string; updatedAt:number; stage:Stage; bpm:number; duration:number; transitionDuration:number; easing:string; pathType:string; notes:string; performers:Performer[]; formations:Formation[]; cues:Cue[]; audioName:string|null; music:Music; routes:Route[]; props:StageProp[]; ensemble:Ensemble; production:Production; referenceVideo:ReferenceVideo|null; checkpoints:Cue[]; actions:Action[]; rehearsals:Rehearsal[]; comments:ReviewComment[]; cueLog:{id:string;cueId:string;at:number;time:number}[]; safetyDistance:number; favorite:boolean; archived:boolean; eventDate:string; venue:string}
export interface Camera {yaw:number; pitch:number; zoom:number; target:number[]}
export interface RehearsalAids {previous?:boolean; next?:boolean; checkpoints?:boolean; countStep?:number; selectedOnly?:boolean; follow?:string; followZoom?:number}
export interface Ghost {time:number; label:string; positions:Pose[]}
export interface AnalysisIssue {type:string; ids:string[]; message:string; time?:number}
export type AnalysisFrame=ReturnType<typeof import('./analysis-model.js').transitionAnalysis>;
export interface StageOptions {interactive?:boolean; camera?:Partial<Camera>; eye?:number[]; labels?:boolean; showGrid?:boolean; selected?:()=>Set<string>; ghosts?:Ghost[]; analysis?:AnalysisFrame; pixelRatio?:number; following?:()=>boolean; navigationMode?:string; onCameraChange?:(camera:Camera)=>void; onFocus?:()=>void; onManualPan?:()=>void; onNavigationMode?:(mode:string)=>void; onRenderCost?:(ms:number)=>void; onSelect?:(id:string,add?:boolean)=>void}
export interface VideoSettings {width:number; height:number; fps:number; bitrate:number; start:number; end:number; labels?:boolean}
export interface Revision {id:string; projectId:string; createdAt:number; label:string; data:Project}
export interface TransformOptions {angle?:number; scale?:number; mirrorX?:boolean; mirrorZ?:boolean; align?:string; distribute?:string}
export interface CameraMetrics {width?:number; height?:number; distance?:number}
export interface CameraControlsOptions {camera?:Camera; metrics?:()=>CameraMetrics; changed?:(camera:Camera)=>void; mode?:()=>string; manualPan?:()=>void; following?:()=>boolean; reset?:()=>void; environment?:typeof globalThis; signal?:AbortSignal}
export interface ViewSnapshot {theme?:string; kind?:string; time?:number; zoom?:number; pan?:{x:number;y:number}; mirror?:boolean; flip?:boolean; rotation?:number; labels?:boolean; showGrid?:boolean; showPaths?:boolean; camera?:Partial<Camera>; aids?:RehearsalAids; selected?:Set<string>|string[]; viewport?:{width:number;height:number}; colors?:Record<string,string>; font?:string; ghosts?:Ghost[]; analysis?:AnalysisFrame; analysisSettings?:Parameters<typeof import('./analysis-model.js').transitionAnalysis>[2]}
export interface NavigationOptions {kind?:string; getMode?:()=>string; mode?:(mode:string)=>void; pan?:(x:number,y:number)=>void; orbit?:(x:number,y:number)=>void; zoom?:(factor:number)=>void; fit?:()=>void; focus?:()=>void; signal?:AbortSignal}
export interface FrameRenderer {draw:(context:CanvasRenderingContext2D,time:number)=>void|Promise<void>; dispose?:()=>void}
export interface MediaOptions {media?:typeof import('./mediabunny.js'); environment?:typeof globalThis; frameRenderer?:FrameRenderer; canvas?:HTMLCanvasElement; audioBuffer?:AudioBuffer; signal?:AbortSignal; mime?:string; onProgress?:(fraction:number,canvas:HTMLCanvasElement)=>void; yieldTask?:()=>Promise<unknown>}
export interface VideoInput {resolution?:number|string; fps?:number|string; quality?:string; start?:number|string; end?:number|string; aspect?:number; labels?:boolean}
export interface CacheStatus {ok?:boolean; complete?:boolean; cached?:number; total?:number; version?:string; error?:string}
export interface Project {sceneLights?:ReturnType<typeof import('./production-next-model.js').sampleLights>; sceneSafety?:ReturnType<typeof import('./production-next-model.js').safetyIssues>}
export interface PlaybackUpdate {positions?:Pose[]; geometryPositions?:Pose[]; geometryIssues?:AnalysisIssue[]; state?:ViewSnapshot; playing?:boolean; active?:string; focused?:Element; hud?:boolean}
export interface ImageCaptureOptions {format?:string; scale?:number; quality?:number; signal?:AbortSignal; start?:number}
export interface ZipOptions {signal?:AbortSignal; onProgress?:(fraction:number)=>void; maxBytes?:number}
export interface MagneticOptions {snap?:string; playhead?:number; pixelsPerSecond?:number; exclude?:string|Set<string>; targets?:ReturnType<typeof import('./timeline-tools.js').magneticTargets>; previous?:{key?:string;time:number;label?:string}}
