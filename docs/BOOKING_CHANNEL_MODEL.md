# Booking and channel model

Confirmed by the user: a direct screen booking may schedule **either a whole layout or individual content fullscreen**. A layout defines composition, not the booking itself.

- Layouts contain positioned areas/layers. A layer may host static content or a reusable channel.
- Channels contain scheduled content bookings and may be reused by multiple layouts/screens.
- A booking identifies its destination (screen, screen group or channel), content, dates, UTC weekday/time windows, duration/order and priority.
- Screen bookings select either an entire layout or fullscreen media/widget content.
- Channel bookings select media/widgets or full multi-layer designs within the channel's layout area.
- Bookable content includes images, videos, text and reusable widgets. Multi-file widget packages require their own media-library source-file management.

The primary **Screen content** workspace groups playback by destination. Channels are labelled **Playlists** in everyday use. Advanced bookings and saved widgets remain available under **More tools**; Layout Studio can place a channel in a positioned/resizable area. The same channel and reusable content may appear in multiple layouts. Existing inline layout widgets, default assignments and the original layout schedules remain supported.

## Setup

`migrations/0003_channels_bookings.sql` adds `channels`, `content`, `bookings` and their indexes. It does not rewrite original tables or schedule records. Fresh installations use normal D1 migrations. Existing deployments may select **Channels → Enable channels and bookings**, an authenticated, explicit action which executes the same idempotent schema statements as one D1 batch. A test verifies the two schema definitions match. Reads and player sync never implicitly create tables. Repeating activation preserves data; later applying the tracked migration is safe.

If activation has not happened, the new sections display the activation action, their create buttons are disabled, and existing administration/playback continue. No Cloudflare token is passed to the browser. Activation uses the Worker's existing D1 binding.

## Workflow

1. The app opens on **Screen content**. Choose a screen (search by name for a large fleet), then **Add content**. The destination is preselected, so ordinary use has only Content and When left to complete. A guide launched from Studio or **Use on a screen** first asks Where.
2. Content offers one combined saved-content picker, a deferred image/MP4 upload, a quick text message, and **Create a design**. Content type and booking names are inferred. Final confirmation uploads/persists quick content, then creates the normal booking. Retrying a failed booking reuses successfully created content/media; cancellation before confirmation creates neither. Studio designs are explicitly saved separately and remain reusable when scheduling is cancelled.
3. Timing defaults to **Every day, all day**. Custom days, optional dates and UTC time windows are revealed only when requested. Duration is labelled **Seconds before the next item**. Priority, order, naming and pause controls are under **More options**. Editing preserves existing priority/order/paused/custom schedule values. New items append to their destination's existing positions. No player selection or priority semantics change.
4. A review shows content, destination, days/times and paused/enabled state before confirmation. Final save makes changes available to players; it does not confirm reception or display on an offline screen. The existing timed player drives Preview. Destination plans still include inherited group/fleet bookings and older layout rules.
5. For shared rotating content, create a **Playlist**, add items with the same guide, then **Use on a screen**. This persists a normal fullscreen layout with a channel widget and books that layout, preserving existing graph/video/reference validation. Single-screen layouts use that screen's orientation. Group/fleet wrappers use landscape; Studio remains available for custom areas and mixed-format compositions. Reusing a playlist preserves sharing, so later item edits affect all its uses.
6. Studio's **Save & schedule** opens the guide with that layout selected. **Create a design** in the guide returns to the same guide after save/cancel and restores previous unrelated Studio work. The channel/playlist layer Inspector edits its items through the guide without leaving the unsaved design. The old full booking editor remains reachable under **More editing tools** for saved content/designs; it is not used for unsaved quick uploads/messages or the automatic playlist wrapper.
7. Everyday navigation shows Screen content, Playlists, Design Studio, Images & videos, and Manage screens. **More tools** contains the overview, saved widgets, advanced bookings and older layout rules. Names in stored data and the API remain `channels`, `content`, `layouts` and `bookings`. No migration is required.

An empty channel area is transparent except for its configured background. Deletion of referenced content, channels or layouts is rejected with instructions to remove their bookings/areas first. Channels may book complete layouts, including layouts containing other channels. Cyclic references are rejected, including disabled/future booking links and edits to previously booked layouts. Valid acyclic nesting has no arbitrary depth limit.

## Deterministic playback

- Dates, weekday selections and times use **UTC**, explicitly labelled in the UI. Start/end dates are optional and inclusive. Time windows include the complete end minute. Overnight windows belong to their starting date and weekday, including the early-morning spillover after the final selected date.
- At each destination, only the highest active priority plays. Equal-priority direct bookings prefer a specific screen over its zone, then fleet scope. Ties within that specificity form a playlist, sorted by order then stable booking ID.
- Each booking has a positive integer duration in seconds. Rotation is anchored to the earliest currently eligible window start and evaluated from UTC time. Reloading does not start the playlist over. The browser checks changes once per second. This is deterministic selection, **not a hardware frame-synchronization guarantee**.
- Active direct bookings override original layout schedules/default assignment. When they expire, resolution returns to the original schedule/default rules. Channel bookings affect their own area. Static widgets and other areas are retained when one channel switches content.
- To preserve the existing Tizen video constraint, a layout may have one potentially active video area, counting inline video and enabled channel bookings. Content/booking/layout changes are checked so they cannot bypass this restriction. Nested layouts sum their video areas, while alternative bookings within a channel use the maximum video count. The check is conservative across date windows; it does not allow two potential video areas merely because their current bookings have different times.

## Offline and compatibility

Authenticated manifests include only channels reachable from that screen's default, legacy scheduled or directly booked layouts, relevant direct/channel bookings, their reusable content and every referenced R2 asset (including future bookings). IDs use JSON SQL parameters to support fleets beyond D1's bind-count limit. Missing references or invalid media metadata reject the whole update. The existing download/hash verification and atomic activation then keep the previous playable state on failure.

New players advertise `X-Player-Capabilities: channels-v1,channel-layouts-v1`. Layered channel manifests carry `channel_layouts:1`; players missing that capability receive 409 and retain their cached version. A player without this capability receives 409 if its manifest needs channels/bookings, preserving its previous cached state instead of accepting unsupported layers. Refresh hosted players or rebuild existing Tizen packages before assigning this content. This update does not install anything on physical screens.

Cached inline widgets and uploaded media can rotate after an offline reload. Hosted web pages, external media and live API feeds still require network; the sandbox and weather cache limitations continue to apply. There is no per-booking fallback media, transition editor, video-end duration mode, physical multi-display synchronization, independent overlapping screen groups or widget ZIP package editor yet. Zones remain the existing group mechanism.

## Verification

54 Node tests and 24 Chromium tests pass. New coverage includes explicit setup against an older schema, preservation of old layouts, rule validation, deterministic rotation/date/overnight/priority behavior, direct-layout/fullscreen bookings, guarded deletions, incomplete-manifest rejection, media integrity and the video-area constraint. Browser tests create content/channel/bookings through the UI, preview a screen, retain a static HTML iframe across channel changes, and rotate text/images across an offline reload. A local Wrangler D1/R2 test serves 100 simultaneous channel clients; it complements the existing 100-player fleet waves. Production D1 migration/activation, real network quotas and physical Tizen playback remain unverified here.

## Booking authoring and layered channel playback · 29 October 2026

The booking form now directly creates media/widgets or opens the actual Studio with all existing tools: layers, resizing, rich text, uploaded/linked images and video, HTML, hosted pages, clocks, tickers and channels. Studio uses the same save/validation path as normal layouts. The previous unsaved layout and selection are restored when returning. Nested modal and delayed Studio saves are guarded against replacing a newer booking dialog. Designs are saved before the booking is scheduled; new copies do not alter their source template.

Full channel designs render in clipped native-size stages with uniform, centred scaling. This preserves font sizes, coordinates, HTML iframe viewports, portrait dimensions and local layer stacking. Each level updates only changed entries, keeping static widgets/video alive while nested channels rotate. Manifests include all reachable future layouts, channels, content and verified media; missing references and cycles reject activation. No database migration is needed for layout bookings in channels.
