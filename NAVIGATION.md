# Stage navigation

Open **View controls** in the upper-right corner of the 2D or 3D stage. It stays available in fullscreen and offers a scrollable, touch-sized panel. The panel does not appear in image or video exports.

| Input | 2D | 3D |
| --- | --- | --- |
| Primary drag | Select, box-select or edit; Pan mode moves the camera | Orbit; Pan mode moves the camera |
| Middle drag | Pan | Pan |
| Right drag | Existing stage context tools | Pan |
| Wheel | Zoom at pointer | Zoom at focus-plane pointer |
| Trackpad pinch (Ctrl-wheel) | Zoom | Zoom |
| Pan mode + scrolling | Pan | Pan |
| Two touch contacts | Pan and pinch | Pan and pinch |
| One touch contact | Select/drag; Pan mode moves view | Orbit; Pan mode moves view |
| Visible buttons | Pan, zoom, fit, focus selected | Pan, rotate/tilt, zoom, fit, focus selected |

Manual panning pauses Follow camera at its current framing. Orbit and zoom can retain Follow. Fit resets manual pan/zoom; 3D Fit restores the default viewing angle. Focus selected works in both views. 2D path and measure tools open the editable 2D stage.

Camera motion never edits choreography coordinates. 2D retains its existing rotation/mirror/flip transforms and selection behavior. 3D uses 50–300% zoom with bounded elevation and pan, coalesced draw requests, and retained geometry. Touch, pen, mouse and trackpad controls share pointer handlers; cancellation and app-background/recovery events clear capture state. Physical gesture feel remains to be confirmed on actual devices.
