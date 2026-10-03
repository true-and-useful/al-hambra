# Gesture inventory appendix

Status: design analysis written 2026-09-21 against 2ea77d8; reconciled with codex/v1 at 25ce69d on 2026-10-03.

Exhaustive, mechanical enumeration generated 2026-09-21 as raw material for [ux-paradigms.md](ux-paradigms.md). Paradigm labels: P1 latent pad, P2 handles, P3 region taps, P4 hybrid. The P4 here is the first draft's hybrid, not the reviewed anchored-drag recommendation in [P4 in detail](ux-paradigms.md#p4-in-detail). These tables are proposal inventory, not a description of shipped gestures, and ux-paradigms.md holds the decisions. θ uses the tile-edge convention of the code and [recipe-vocabulary.md](recipe-vocabulary.md); β = 180° − 2θ as defined in [design-space.md](design-space.md#the-layers).

Some decisions listed below are already settled for the shipped P0, without settling them for P1–P4. Drag, cancellation, pinch, wheel and export behaviour are described under [P0 Contact-angle scrub](ux-paradigms.md#p0-contact-angle-scrub) and in the undo and trackpad notes of ux-paradigms.md. In addition:

- Changed pan and app zoom states enter undo history. A no-op drag or a drag returning to its start does not. Palette and design choices commit immediately; changing design loads its full defaults, and reset is undoable with no confirmation. Redo is absent. Evidence: [src/state.ts](../src/state.ts), `AppStateStore.commitPreview`/`commit`/`reset`/`undo`; [src/main.ts](../src/main.ts), design, palette and zoom handlers.
- The URL schema is still v1 with eight keys: `v`, `design`, `morph`, `material`, `palette`, `cx`, `cy`, `scale`. It has no motif, δ or class-fill tokens; Move view is transient. Committed edits use `replaceState`, and restoration listens to `hashchange`, not a `popstate` handler. Evidence: [src/state.ts](../src/state.ts), `encodeStateHash`/`decodeStateHash`/`replaceUrlState`; [src/main.ts](../src/main.ts).

# 1. Gesture inventory

## P1 — Latent pad

| User intent | Mouse | Touch | Keyboard | Screen-reader |
|---|---|---|---|---|
| Change θ | Press and drag anywhere on artwork horizontally; map horizontal displacement to θ | Single-finger drag anywhere on artwork horizontally; require 8–10 CSS px movement before committing | Focus θ spinbutton/slider; Arrow keys adjust, Page Up/Down make larger steps, Home/End clamp to range | Focus labeled θ slider; announce value and adjust with virtual keyboard or increment/decrement commands |
| Change δ | Press and drag vertically on artwork; map vertical displacement to δ | Single-finger drag vertically on artwork; require 8–10 CSS px movement | Focus δ slider; Arrow keys adjust, Page Up/Down make larger steps, Home/End clamp | Focus labeled δ slider; announce value and adjust with virtual keyboard or increment/decrement commands |
| Change motif type | Click motif chooser in dock and select star, rosette, or plain | Tap motif chooser; tap a 44 px-or-larger option | Tab to motif select; Arrow keys choose; Enter/Space commits | Focus labeled motif select; announce current choice and available options |
| Change color | Click palette swatch or palette select in dock | Tap palette swatch/select | Tab to palette select; Arrow keys choose; Enter/Space commits | Focus labeled palette select; announce color name and selection |
| Change material | Click or drag material slider in dock | Touch-drag material slider; use 8–10 px slop before changing | Focus material slider; Arrow keys adjust; Page Up/Down make larger steps | Focus labeled material slider; announce linework/interlaced-band value |
| Pan | Hold Space and drag artwork, or use a dedicated Move view toggle then drag | Activate Move view toggle, then single-finger drag artwork; native pinch remains available | Activate Move view toggle; Arrow keys pan; Shift+Arrow pans by a larger increment | Focus Move view toggle and pan controls; activate named directional pan buttons |
| Zoom | Mouse wheel or trackpad scroll over artwork; toolbar +/− also available | Native two-finger pinch-zoom; toolbar +/− remains available; single-finger artwork drag does not zoom | `+`/`=` zoom in, `-` zoom out, `0` reset view | Activate labeled Zoom in, Zoom out, and Reset view buttons |
| Undo | Click Undo button or press `Ctrl+Z`/`Cmd+Z` | Tap Undo button | `Ctrl+Z`/`Cmd+Z`; optional toolbar button | Activate labeled Undo button; announce restored state |
| Reset | Click Reset button | Tap Reset button and confirm if configured | Press `R` or activate Reset button | Activate labeled Reset button; confirmation dialog exposes Cancel and Reset |
| Switch design | Click design chooser and select a tiling | Tap design chooser and select a tiling | Tab to design select; Arrow keys choose; Enter/Space commits | Focus labeled design select; announce design name and any reset consequences |
| Share/export | Click Share, Download SVG, or Download PNG | Tap Share or export button; invoke native share sheet when available | Tab to action and press Enter/Space; keyboard shortcut may be `Ctrl/Cmd+Shift+S` | Activate labeled Share, Export SVG, or Export PNG controls; announce completion |
| Cancel a gesture mid-way | Release mouse before movement commits, or press Escape before pointerup; restore pre-gesture state | Lift before the 8–10 px slop threshold, or press/call Cancel during an active gesture | Press Escape during a focused or active adjustment | Activate Cancel gesture control or press Escape; announce that no change was committed |
| Keyboard equivalent | n/a | n/a | Every visual control has a focusable equivalent; arrows adjust sliders, Tab navigates, Enter/Space activates | Every control exposes an accessible name, role, value, and state through the accessibility tree |

## P2 — Handles

| User intent | Mouse | Touch | Keyboard | Screen-reader |
|---|---|---|---|---|
| Change θ | Press a visible θ handle or eligible star tip/rosette point and drag; inverse-solver follows the grabbed point | Single-finger press on a 44 px-or-larger handle hit area, then drag after 8–10 px movement | Focus θ handle; Arrow keys adjust θ; Page Up/Down make larger steps | Focus labeled θ handle; announce θ value and adjust with keyboard increments |
| Change δ | Press a visible δ handle or crossing/contact handle and drag; inverse-solver follows the point | Press the δ handle hit area and drag after 8–10 px movement | Focus δ handle; Arrow keys adjust δ; Page Up/Down make larger steps | Focus labeled δ handle; announce δ value and adjust with keyboard increments |
| Change motif type | Click a motif face, then choose from its contextual menu/popover | Tap a motif face; contextual menu opens after release | Focus motif face control; Enter/Space opens choices; Arrow keys choose | Focus face control with motif label; activate and select from an accessible menu |
| Change color | Click a motif face, then choose a palette option in its contextual menu | Tap a motif face; choose color from the contextual menu | Focus face control; Enter/Space opens color menu; Arrow keys choose | Focus face control; menu announces current color and available colors |
| Change material | Click or drag material slider in dock | Touch-drag material slider; use 8–10 px slop | Focus material slider; Arrow keys adjust | Focus labeled material slider; announce value |
| Pan | Activate Move view toggle, then press-drag artwork; handle drags remain reserved for handles | Activate Move view toggle, then single-finger drag artwork; native pinch remains browser-controlled | Activate Move view toggle; Arrow keys pan | Focus Move view toggle and directional pan controls |
| Zoom | Mouse wheel/trackpad over artwork or toolbar +/− | Native two-finger pinch-zoom or toolbar +/− | `+`/`-` and `0` | Activate labeled zoom controls |
| Undo | Click Undo or press `Ctrl+Z`/`Cmd+Z` | Tap Undo | `Ctrl+Z`/`Cmd+Z` | Activate Undo; announce restored parameter, face, or view state |
| Reset | Click Reset | Tap Reset and confirm if required | `R` or Reset button | Activate Reset; confirmation dialog exposes accessible actions |
| Switch design | Click design chooser and select a tiling | Tap design chooser and select a tiling | Tab to design select; Arrow keys choose | Focus design select; announce design and reset behavior |
| Share/export | Click Share, Export SVG, or Export PNG | Tap an export/share control | Tab and Enter/Space; optional `Ctrl/Cmd+Shift+S` | Activate named share/export controls; announce result |
| Cancel a gesture mid-way | Press Escape or release before 8–10 px movement; snap handle back and do not commit | Lift before movement threshold or press Escape; restore pre-drag parameters | Escape cancels active handle drag or menu | Activate Cancel gesture; announce unchanged state |
| Keyboard equivalent | n/a | n/a | Each handle is a focusable slider-like control; each face is a focusable button/menu trigger | Each handle exposes role, label, current value, range, and adjustment instructions |

## P3 — Region taps

| User intent | Mouse | Touch | Keyboard | Screen-reader |
|---|---|---|---|---|
| Change θ | Click or drag θ slider in dock | Touch-drag θ slider; 8–10 px slop before value change | Focus θ slider; Arrow keys adjust, Page Up/Down make larger steps | Focus labeled θ slider; announce value |
| Change δ | Click or drag δ slider in dock | Touch-drag δ slider; 8–10 px slop | Focus δ slider; Arrow keys adjust | Focus labeled δ slider; announce value |
| Change motif type | Click a pattern face/region; cycle or open a face-class menu | Tap a face/region; cycle or open menu after release | Focus region control; Enter/Space cycles or opens menu; Arrow keys select | Focus region control; announce face class and current motif; activate to change |
| Change color | Click a pattern face/region; cycle or open color menu | Tap a face/region; cycle or open menu after release | Focus region control; Enter/Space cycles or opens menu | Focus region control; announce current color and activate to change |
| Change material | Click or drag material slider in dock | Touch-drag material slider | Focus material slider; Arrow keys adjust | Focus labeled material slider; announce value |
| Pan | Activate Move view toggle, then drag artwork | Activate Move view toggle, then single-finger drag artwork | Activate Move view toggle; Arrow keys pan | Focus Move view toggle and directional pan buttons |
| Zoom | Mouse wheel/trackpad or toolbar +/− | Native two-finger pinch-zoom or toolbar +/− | `+`/`-` and `0` | Activate labeled zoom buttons |
| Undo | Click Undo or press `Ctrl+Z`/`Cmd+Z` | Tap Undo | `Ctrl+Z`/`Cmd+Z` | Activate Undo; announce restored state |
| Reset | Click Reset | Tap Reset | `R` or Reset button | Activate Reset and confirm when needed |
| Switch design | Click design chooser and select a tiling | Tap design chooser and select a tiling | Tab to design select; Arrow keys choose | Focus design select; announce selection |
| Share/export | Click Share, Export SVG, or Export PNG | Tap Share/export control | Tab and Enter/Space; optional shortcut | Activate named share/export control; announce completion |
| Cancel a gesture mid-way | Release before 8–10 px drag threshold; press Escape to close a menu | Lift before threshold; press Escape or tap outside to close menu | Escape closes menu or cancels pending change | Activate Cancel or close control; announce no change |
| Keyboard equivalent | n/a | n/a | Region controls are focusable buttons; sliders use arrows; menus use Arrow/Enter/Escape | Each region exposes an accessible name, current motif/color, and action |

## P4 — Hybrid

| User intent | Mouse | Touch | Keyboard | Screen-reader |
|---|---|---|---|---|
| Change θ | Press visible θ handle and drag; inverse-solver follows the handle | Press θ handle hit area and drag after 8–10 px movement | Focus θ handle; Arrow keys adjust | Focus labeled θ handle; announce θ value |
| Change δ | Press visible δ handle and drag; inverse-solver follows the handle | Press δ handle hit area and drag after 8–10 px movement | Focus δ handle; Arrow keys adjust | Focus labeled δ handle; announce δ value |
| Change motif type | Click a face/region; cycle or open motif menu | Tap face/region; cycle or open menu after release | Focus face control; Enter/Space opens or cycles; Arrow keys choose | Focus face control; announce current motif and choices |
| Change color | Click a face/region; cycle or open color menu | Tap face/region; cycle or open menu after release | Focus face control; Enter/Space opens or cycles | Focus face control; announce current color and choices |
| Change material | Click or drag material slider in dock | Touch-drag material slider | Focus material slider; Arrow keys adjust | Focus labeled material slider; announce value |
| Pan | Activate Move view toggle, then drag artwork | Activate Move view toggle, then single-finger drag artwork; native pinch remains available | Activate Move view toggle; Arrow keys pan | Focus Move view toggle and directional pan buttons |
| Zoom | Mouse wheel/trackpad or toolbar +/− | Native two-finger pinch-zoom or toolbar +/− | `+`/`-` and `0` | Activate labeled zoom buttons |
| Undo | Click Undo or press `Ctrl+Z`/`Cmd+Z` | Tap Undo | `Ctrl+Z`/`Cmd+Z` | Activate Undo; announce restored state |
| Reset | Click Reset | Tap Reset | `R` or Reset button | Activate Reset and confirmation actions |
| Switch design | Click design chooser and select a tiling | Tap design chooser and select a tiling | Tab to design select; Arrow keys choose | Focus design select; announce design and reset behavior |
| Share/export | Click Share, Export SVG, or Export PNG | Tap Share/export control | Tab and Enter/Space; optional shortcut | Activate named share/export control; announce result |
| Cancel a gesture mid-way | Release before 8–10 px movement; press Escape during drag; restore pre-gesture state | Lift before movement threshold; press Escape; restore pre-gesture state | Escape cancels active drag or open menu | Activate Cancel gesture or press Escape; announce unchanged state |
| Keyboard equivalent | n/a | n/a | Handles act as sliders; regions as buttons/menus; dock controls are standard inputs | All handles, regions, sliders, toggles, and actions expose roles, names, values, and states |

# 2. Conflict table

## P1 — Latent pad

| Confusable gesture pair | Why it conflicts | Disambiguation |
|---|---|---|
| Tap artwork vs. start of θ drag | A short press may be interpreted as a parameter change | Do not assign tap behavior to artwork; commit only after 8–10 px movement |
| Horizontal θ drag vs. vertical δ drag | Diagonal movement can affect both parameters | Use dominant-axis lock after 8–10 px; require the secondary axis to exceed the primary by a defined ratio such as 1.25 |
| θ/δ drag vs. pan | The same artwork surface receives both gestures | Reserve pan for Move view/Space modifier; artwork drags change parameters otherwise |
| Artwork drag vs. browser back-swipe | Horizontal edge drags can invoke browser navigation | Keep native browser gestures available at the extreme edge; avoid claiming edge-start drags, or use a non-edge gesture area |
| Single-finger drag vs. browser scrolling | The page may scroll instead of changing the pattern | Put the full-screen instrument in a fixed viewport; use `touch-action: none` only on the instrument surface where needed, while preserving browser pinch through `touch-action: pinch-zoom` or a documented equivalent |
| Single-finger drag vs. native pinch start | The first finger may begin a parameter drag before the second finger arrives | Delay commit for 8–10 px and cancel the parameter gesture when a second pointer appears |
| Mouse wheel zoom vs. page scroll | Wheel input can affect the document instead of the artwork | Zoom only when the pointer is over the artwork; prevent document scrolling there; provide toolbar alternatives |
| Trackpad pinch vs. wheel zoom | Browser/OS may report gesture input differently | Treat both as view zoom; keep a visible zoom control and reset-view action |
| Dock slider drag vs. page scrolling | Vertical slider movement can scroll surrounding UI | Make the dock independently scrollable or fixed; keep slider hit areas at least 44 px high |
| Undo click vs. artwork release | A release after dragging may land on Undo | Require pointerdown on the button and use a separate control layer above artwork |
| Reset click vs. accidental tap | Reset is destructive to current state | Use a 44 px target, visible label, and confirmation when reset discards meaningful edits |
| Share/export click vs. drag ending over control | A drag can end over Share or Export | Do not activate buttons on pointerup unless pointerdown began inside the button |
| Escape cancel vs. browser/OS Escape behavior | Escape may close a browser UI or dialog instead | Handle Escape only while the instrument owns an active gesture or focused control; otherwise allow default behavior |

## P2 — Handles

| Confusable gesture pair | Why it conflicts | Disambiguation |
|---|---|---|
| Handle drag vs. nearby artwork drag | The user may intend to move the view or manipulate a handle | Use a handle hit radius of at least 22 px, preferably a 44 px touch target; prioritize handle hit-testing |
| θ handle vs. δ handle | Handles may overlap or be visually close | Separate hit regions by at least the target radius where possible; use distinct shapes/colors and a 44 px effective target |
| Handle drag vs. tap on the same handle | A tap may select/focus while drag changes a value | Delay value commit until 8–10 px movement; tap selects and reveals value, drag edits |
| Handle drag vs. motif-region tap | A handle may lie inside a face that also cycles motif/color | Handle hit-testing wins within its radius; provide an alternate face target or menu control |
| Star-tip handle vs. adjacent star-tip handle | Repeating geometry creates near-identical candidate points | Use nearest-handle selection only within the active tile; enlarge hit radius but prevent overlapping hit areas |
| Crossing handle vs. strand selection | A crossing can look like a selectable region | Give handle affordance a persistent or hover/focus ring; use a 44 px hit region |
| Inverse-solved θ drag vs. inverse-solved δ drag | One dragged point may be compatible with both parameters | Assign each handle one parameter; show a θ/δ label while dragging |
| Handle drag vs. browser back-swipe | A handle near the left edge can receive a horizontal swipe | Do not place the primary handle inside the browser edge gesture zone; preserve edge navigation |
| Handle drag vs. native pinch | A first finger can grab a handle before a second finger pinches | On second pointer, cancel the handle drag and leave pinch to the browser; commit only after movement threshold |
| Handle drag vs. page scroll | Touch movement may scroll the page | Use `touch-action` on the instrument surface to claim intended direct manipulation; keep native pinch-zoom enabled |
| Handle drag vs. pan mode | Move view may be enabled while a handle is touched | In Move view, handles are disabled or treated as pan surface; show mode state prominently |
| Handle tap vs. contextual menu tap | The same target may both focus and open choices | Use single tap to focus/show value; use a separate face tap or explicit menu button for discrete choices |
| Menu tap vs. drag continuation | Opening a menu can be mistaken for a continuing gesture | Open on pointerup only if movement remains below 8–10 px; close on outside tap or Escape |
| Export button vs. drag release | A handle drag may end over an export control | Activate controls only when pointerdown began inside the control |

## P3 — Region taps

| Confusable gesture pair | Why it conflicts | Disambiguation |
|---|---|---|
| Face tap vs. tap-start of θ/δ slider drag | Both begin with a press and may move | Sliders have 44 px-or-larger tracks/thumbs; artwork faces do not start continuous parameter gestures |
| Face tap vs. artwork pan | A tap may become a pan | Commit face selection on release only if movement stays below 8–10 px; pan requires Move view |
| Face tap vs. browser back-swipe | A face near the edge can receive a horizontal swipe | Preserve browser edge gestures; do not bind edge-start movement to face selection |
| Face tap vs. native pinch start | First finger may select a face before the second starts pinch | Delay selection until pointerup; cancel selection if a second pointer appears |
| Tap-to-cycle motif vs. tap-to-cycle color | One tap cannot unambiguously choose two discrete attributes | Use a contextual menu, separate labeled subcontrols, or a two-step popover; do not overload one tap without visible state |
| Face tap vs. neighboring face tap | Repeating regions may have small boundaries | Use geometric hit-testing with a deterministic tie-breaker; highlight the selected face before committing |
| Region choice vs. handle-like visual detail | Pattern geometry may look like a control | Avoid handle affordances; use hover/focus highlight and an explicit “tap face to edit” cue |
| Region menu vs. page scroll | A vertical gesture beginning on a face can scroll | Require 8–10 px slop before scrolling; keep the instrument viewport fixed or isolate scroll containers |
| Slider drag vs. slider tap | Tap may set a value while drag adjusts it | Support both; a tap jumps to position, a drag continuously updates after 8–10 px |
| Slider vs. browser pinch | Two-finger interaction over dock can zoom browser/page | Keep sliders single-pointer; do not disable native pinch globally; provide a separate zoom control |
| Color menu vs. motif menu | Both menus may appear from the same face | Use separate labeled rows or tabs, with current values visible and distinct controls |
| Face tap vs. Undo/Reset overlay | Dock or action controls may overlap the artwork | Maintain a separate control layer and minimum 44 px action targets |
| Design change vs. accidental select | Switching design can change region topology and values | Use an explicit design chooser and confirmation when the current configuration cannot map cleanly |

## P4 — Hybrid

| Confusable gesture pair | Why it conflicts | Disambiguation |
|---|---|---|
| Handle drag vs. face tap | Handles and editable regions coexist | Handle hit radius wins; require 8–10 px movement for drag; use distinct handle styling and face highlight |
| Handle drag vs. face pan | A user may intend to move the view from any artwork location | Pan requires Move view; normal mode reserves handle regions for handles and leaves other artwork non-panable |
| θ handle vs. δ handle | Both are visible parameter affordances | Give each a distinct shape, label, color, and non-overlapping 44 px target |
| Handle drag vs. browser back-swipe | Horizontal handle movement near browser edge conflicts with navigation | Keep handles away from the edge gesture region; do not suppress browser back navigation |
| Handle drag vs. native pinch | A second pointer can arrive after drag begins | Cancel handle drag on second pointer; let browser pinch-zoom continue |
| Face tap vs. tap-start of handle drag | A face may contain a handle | Handle hit-testing wins only within the handle radius; otherwise a tap opens the face menu |
| Face tap vs. face drag | A user may slide unintentionally after tapping | Open/cycle only on release under 8–10 px movement; never change discrete state during an ambiguous drag |
| Face motif cycle vs. face color cycle | Both are discrete actions on one face | Use separate menu rows or explicit Motif and Color controls; show current values |
| Move-view toggle vs. parameter handle use | The active mode changes the meaning of artwork gestures | Show persistent mode indicator; in Move view, disable handle/face editing and announce the mode |
| Move-view drag vs. page scroll | Single-finger panning can compete with document scrolling | Use a fixed instrument viewport and appropriate `touch-action`; keep pinch-zoom native |
| Slider drag vs. face tap | Dock and artwork may be spatially close | Use 44 px controls, clear dock boundaries, and pointer capture only after the slider receives pointerdown |
| Zoom gesture vs. parameter gesture | A two-finger pinch may begin over a handle or face | Any second pointer cancels pending single-pointer edit; native pinch remains available |
| Undo/reset vs. gesture release | Ending a drag over a destructive control can activate it | Button activation requires pointerdown inside the button; gesture release cannot trigger unrelated controls |
| Share/export vs. gesture release | Export controls may be near the canvas | Use independent controls and pointerdown-origin activation |
| Design switch vs. face edit | Design selection may rebuild the region map | Keep design selection in the dock; require explicit selection and define whether edits are preserved or reset |

# 3. State and undo

| State and undo concern | P1 — Latent pad | P2 — Handles | P3 — Region taps | P4 — Hybrid |
|---|---|---|---|---|
| One undo entry | One completed θ/δ drag is one entry; one completed dock change, view change, motif change, color change, material change, or design change is one entry | One completed handle drag is one entry; one face-menu choice, dock change, view change, or design change is one entry | One completed slider adjustment is one entry; one face motif/color change, view change, or design change is one entry | One completed handle drag is one entry; one face motif/color change, dock change, view change, or design change is one entry |
| Continuous drag coalescing | Pointermoves during one gesture coalesce into one entry on pointerup | All inverse-solver updates during one handle drag coalesce into one entry | All slider pointermoves during one adjustment coalesce into one entry | Same: one handle or slider interaction produces one entry |
| Tap/click commit | No artwork tap commits a parameter; dock activation commits on selection | Handle tap only focuses/selects; face choice commits when an option is chosen | Face tap commits on release or menu option selection; slider tap commits immediately | Handle tap focuses; face menu option commits; slider tap commits immediately |
| Pointerdown snapshot | Save θ, δ, motif map, palette, material, design, pan, and zoom before a potential gesture | Save the same state before handle or face interaction | Save the same state before face, slider, or view interaction | Save the same state before handle, face, slider, or view interaction |
| Pointercancel | Restore the pointerdown snapshot; do not create an undo entry | Restore handle position and all state to pointerdown snapshot; no undo entry | Restore pending face/slider/view state; no undo entry | Restore the complete pointerdown snapshot; no undo entry |
| Second pointer during single-pointer edit | Cancel pending θ/δ edit and allow native pinch-zoom | Cancel handle drag and allow native pinch-zoom | Cancel pending face selection or slider edit if the interaction becomes a pinch | Cancel pending handle/face/slider edit and allow native pinch-zoom |
| Browser or OS interruption | Treat `pointercancel`, loss of capture, visibility interruption, or navigation as an uncommitted gesture; restore snapshot | Same; do not leave a partially solved handle state | Same; restore pending state | Same; restore pending state |
| Keyboard adjustment grouping | Each discrete keypress may be an entry, or repeated keypresses within a short editing session may coalesce; document the rule | Same for focused handles; one continuous key-repeat session should coalesce | Same for sliders and region controls | Same for handles, sliders, and region controls |
| Undo scope | Undo all user-visible edits, including view state if view changes are intended to be undoable; otherwise exclude pan/zoom consistently | Same; handle movement and discrete edits must not be split into solver internals | Same; face edits must be independently reversible | Same; define whether Move view and zoom enter the same history as design edits |
| Redo | Restore the inverse of the most recent undo; clear redo after a new edit | Same | Same | Same |
| Reset | Push the pre-reset complete state as one undo entry, unless Reset is canceled in confirmation | Same | Same | Same |
| Design switch | Store design identifier plus all compatible parameters and per-tile choices; define fallback when topology changes | Store design identifier, parameter values, and face assignments; preserve only mappings that remain valid | Store design identifier and region choice map; define remapping or reset | Store design identifier and all compatible handle, region, and dock state |
| URL state | Encode design, θ, δ, motif assignment or motif default, palette, material, pan, zoom, and any schema/version identifier | Encode design, θ, δ, motif assignment, palette, material, pan, zoom, and schema/version; handles are derived, not coordinates | Encode design, θ, δ, per-region motif/color choices, palette, material, pan, zoom, and schema/version | Encode design, θ, δ, per-region motif/color choices, palette, material, pan, zoom, Move view only if it is persistent, and schema/version |
| URL serialization | Use stable named values or normalized numbers; preserve enough precision for visual reproduction without encoding transient pointer state | Encode solved parameters, never raw grabbed-point coordinates or pointer positions | Encode semantic region identifiers and choices, not pixel coordinates | Encode semantic design/region state and solved continuous parameters |
| Share/export state | Export uses current live SVG and current URL-representable design state; transient hover/drag state is excluded | Same; handle overlays and selection rings are excluded unless explicitly requested | Same; menus, highlights, and focus rings are excluded | Same; Move view overlay and active handles are excluded unless explicitly requested |
| History navigation | `popstate` restores the URL-encoded complete state without creating a new undo entry | Same | Same | Same |
| Canceling a menu | Escape, outside click, or focus loss closes without changing state unless an option was committed | Same | Same | Same |
| Accessibility state | Expose current values, selected motif/color, design, material, and view controls; announce committed changes, not every pointermove | Also expose which handle controls θ or δ and its current value | Expose each editable region’s identity and current motif/color | Expose handle identities, region identities, dock values, mode, and current design |
| Native browser gestures | Do not encode a browser pinch or back-swipe as app history; `pointercancel` restores pending app edits | Same | Same | Same |

# 4. Micro-decision checklist

## P1 — Latent pad

- Define the exact θ range, including whether the endpoints are inclusive.
- Define the exact δ range and whether it is normalized to `0..0.3`.
- Choose whether horizontal and vertical motion use viewport pixels, artwork coordinates, or normalized artwork coordinates.
- Choose the drag gain: parameter change per CSS pixel or per viewport fraction.
- Choose whether the first 8–10 px of movement are ignored as slop.
- Choose whether dominant-axis locking is enabled and the ratio required to lock an axis.
- Decide whether diagonal drags affect both θ and δ or only the dominant axis.
- Decide whether the artwork has any tap action; the default should be no parameter change on tap.
- Decide whether pan requires Move view, Space, or both.
- Decide whether the instrument uses `touch-action` that preserves native pinch-zoom.
- Decide how a second pointer cancels a pending single-finger edit.
- Decide whether parameter values clamp, resist, or rubber-band at range edges.
- Define the resistance distance and return animation at range edges if resistance is used.
- Decide whether the cursor is default, grab, crosshair, or a parameter-specific cursor.
- Decide whether a live θ/δ readout appears during dragging.
- Choose whether the readout follows the pointer or stays in the dock.
- Decide whether the artwork receives a temporary axis guide during a drag.
- Decide whether haptic feedback occurs at parameter endpoints or meaningful increments.
- Decide whether keyboard arrows use fine steps and Page Up/Down use coarse steps.
- Define the screen-reader wording for θ, δ, motif, color, material, design, and view.
- Decide whether undo includes pan and zoom or only design edits.
- Decide whether a drag that returns to its starting value creates an undo entry.
- Decide how reset confirmation works and whether Reset is undoable.
- Define the URL schema version and numeric precision.
- Define whether export excludes focus, hover, cursor, guides, and transient readouts.

## P2 — Handles

- Choose which geometric points are handles: star tips, rosette points, crossings, or a fixed subset.
- Assign each handle unambiguously to θ or δ.
- Define the handle hit radius in artwork coordinates and its minimum CSS hit area.
- Ensure touch targets are at least 44×44 CSS pixels where practical; WCAG 2.2 requires at least 24×24 CSS pixels in applicable cases. ([WCAG 2.2](https://www.w3.org/TR/wcag/), [Apple touch-target guidance](https://developer.apple.com/design/tips/))
- Decide whether handles are visible at rest, visible on hover/focus, or revealed by a mode.
- Choose the visual language for θ and δ handles.
- Decide whether handles scale with zoom or maintain a constant screen-space size.
- Define what happens when two handle hit regions overlap.
- Define the nearest-handle tie-breaker for repeated geometry.
- Decide whether a face tap is suppressed inside a handle hit radius.
- Define the inverse-solver objective: exact point following, least-squares distance, or constrained approximation.
- Choose how solver failure or low sensitivity is communicated.
- Decide whether the solver clamps or resists at θ/δ boundaries.
- Decide whether the handle snaps to meaningful angular/contact increments.
- Choose the movement slop, normally 8–10 CSS px, before drag commitment.
- Decide whether the handle tracks the finger offset or snaps its center beneath the pointer.
- Define the appearance during drag: enlarged target, glow, label, guide, or ghost geometry.
- Decide whether the original point remains visible while the solved point moves.
- Decide whether haptics occur at endpoints, snaps, or topology transitions.
- Choose cursor shapes for idle, hover, active, and unavailable handles.
- Decide whether a handle tap focuses it, reveals its value, or does both.
- Define keyboard step sizes and whether repeated keypresses coalesce into one undo entry.
- Define accessible names such as “θ handle, contact angle, 52 degrees.”
- Decide whether handles remain enabled in Move view.
- Define how handle state is reconstructed from URL parameters; never serialize raw pointer coordinates.

## P3 — Region taps

- Define the selectable face classes: tile, star face, rosette face, crossing region, or another semantic region.
- Decide whether a tap cycles values or opens a menu.
- If cycling, define the exact cycle order for motif types.
- If cycling, define the exact cycle order for colors.
- Decide whether motif and color use separate controls in one popover.
- Define region hit-testing at shared boundaries.
- Choose the deterministic tie-breaker when a point lies on a boundary.
- Decide whether the selected region receives an outline, fill tint, hatch, or other highlight.
- Ensure region controls have an effective touch target of at least 44×44 CSS pixels where possible.
- Decide whether the visual hit area may extend beyond the geometric face.
- Define the 8–10 px movement threshold separating tap from drag or scroll.
- Decide whether selection commits on pointerup, menu-option activation, or both.
- Define outside-tap, Escape, and focus-loss behavior for the menu.
- Decide whether a second pointer cancels a pending face selection.
- Decide whether selecting one face changes all equivalent faces or only the tapped face.
- Define how per-tile choices are identified and serialized.
- Decide whether changing design preserves, remaps, or clears region choices.
- Define whether colors are named, numbered, or described by perceptual labels for assistive technology.
- Choose whether the popover shows current motif and current color simultaneously.
- Decide whether a tapped face displays a temporary tooltip or persistent inspector.
- Define keyboard behavior: Enter/Space opens, Arrow keys select, Escape closes.
- Choose whether touch feedback uses ink ripple, highlight, animation, or haptics.
- Decide whether the cursor changes over selectable faces.
- Define the accessible name and current state for every region control.
- Decide whether undo records each face change separately or groups changes made within one menu session.

## P4 — Hybrid

- Define the complete handle inventory for θ and δ.
- Choose handle shapes and colors that cannot be confused with motif geometry.
- Define handle hit radii and maintain at least 44×44 CSS pixel touch targets where practical.
- Decide whether handles are always visible or appear on hover, focus, or an Edit geometry mode.
- Define face hit regions independently from handle hit regions.
- Establish the priority order: handle hit, face hit, dock control, or Move view.
- Choose whether Move view disables all handles and face taps.
- Define how Move view is entered, exited, announced, and visually indicated.
- Choose the 8–10 px movement threshold for handle, face, and slider interactions.
- Decide whether a second pointer cancels any pending edit before native pinch-zoom begins.
- Preserve browser pinch-zoom and define the instrument’s `touch-action` behavior.
- Decide how browser back-swipe and other edge gestures remain available.
- Define inverse-solver behavior, clamping, resistance, and low-sensitivity feedback for handles.
- Decide whether face taps cycle or open separate Motif and Color menus.
- Define the selected-face highlight and the active-handle appearance.
- Decide whether handle labels remain visible during drag and keyboard focus.
- Choose cursor shapes for handles, faces, Move view, sliders, and unavailable regions.
- Define haptic feedback for handle snaps, range endpoints, face changes, and mode changes.
- Define material slider increments, keyboard steps, and value announcement.
- Decide whether palette and design changes are immediate or require confirmation.
- Define whether changing design preserves per-face choices and how topology remapping works.
- Decide whether pan and zoom are included in undo history.
- Define the URL schema for design, θ, δ, face assignments, palette, material, pan, and zoom.
- Define accessible names and roles for handles, face controls, mode toggle, sliders, and export actions.
- Define export behavior so active handles, selection highlights, menus, focus rings, and gesture guides are excluded from the live SVG unless explicitly requested.
