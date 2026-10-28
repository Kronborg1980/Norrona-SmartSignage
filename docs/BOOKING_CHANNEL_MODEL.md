# Booking and channel model

Confirmed by the user: a direct screen booking may schedule **either a whole layout or individual content fullscreen**. A layout defines composition, not the booking itself.

- Layouts contain positioned areas/layers. A layer may host static content or a reusable channel.
- Channels contain scheduled content bookings and may be reused by multiple layouts/screens.
- A booking identifies its destination (screen, screen group or channel), content, dates, UTC weekday/time windows, duration/order and priority.
- Screen bookings select either an entire layout or fullscreen media/widget content.
- Channel bookings select media/widgets within the channel's layout area.
- Bookable content includes images, videos, text and reusable widgets. Multi-file widget packages require their own media-library source-file management.

Implemented in this update: **Channels**, **Content** and **Bookings** are separate main-menu sections; Layout Studio can place a channel in a positioned/resizable area. The same channel and reusable content may appear in multiple layouts. Existing inline layout widgets, default assignments and the original layout schedules remain supported.

## Setup

`migrations/0003_channels_bookings.sql` adds `channels`, `content`, `bookings` and their indexes. It does not rewrite original tables or schedule records. Fresh installations use normal D1 migrations. Existing deployments may select **Channels → Enable channels and bookings**, an authenticated, explicit action which executes the same idempotent schema statements as one D1 batch. A test verifies the two schema definitions match. Reads and player sync never implicitly create tables. Repeating activation preserves data; later applying the tracked migration is safe.

If activation has not happened, the new sections display the activation action, their create buttons are disabled, and existing administration/playback continue. No Cloudflare token is passed to the browser. Activation uses the Worker's existing D1 binding.

## Workflow

1. **Channels → New channel** creates a named reusable stream.
2. **Content → New content** creates text, image, video, clock, ticker, HTML/CSS/JavaScript or hosted HTTPS content. Images/videos can use uploaded R2 media or HTTPS links. Typography and sandbox/network settings are preserved. An existing inline layer can be copied using **Save as reusable content**.
3. **Channels → + Booking** schedules content into that channel. **Bookings** lists and edits channel, screen, zone and fleet bookings.
4. **Layout Studio → Channel** places the chosen channel in an area. Position, width, height, opacity and layer order belong to the area. Content styling belongs to reusable content. The editor shows a current snapshot; channel/screen **Preview** uses the actual timed player.
5. Assign the layout using Screens. Alternatively, **Screens → + Booking** schedules either a whole layout or individual content fullscreen on that display.

An empty channel area is transparent except for its configured background. Deletion of referenced content, channels or layouts is rejected with instructions to remove their bookings/areas first. Channels cannot contain channels or booked layouts, so recursive layouts are not introduced.

## Deterministic playback

- Dates, weekday selections and times use **UTC**, explicitly labelled in the UI. Start/end dates are optional and inclusive. Time windows include the complete end minute. Overnight windows belong to their starting date and weekday, including the early-morning spillover after the final selected date.
- At each destination, only the highest active priority plays. Equal-priority direct bookings prefer a specific screen over its zone, then fleet scope. Ties within that specificity form a playlist, sorted by order then stable booking ID.
- Each booking has a positive integer duration in seconds. Rotation is anchored to the earliest currently eligible window start and evaluated from UTC time. Reloading does not start the playlist over. The browser checks changes once per second. This is deterministic selection, **not a hardware frame-synchronization guarantee**.
- Active direct bookings override original layout schedules/default assignment. When they expire, resolution returns to the original schedule/default rules. Channel bookings affect their own area. Static widgets and other areas are retained when one channel switches content.
- To preserve the existing Tizen video constraint, a layout may have one potentially active video area, counting inline video and enabled channel bookings. Content/booking/layout changes are checked so they cannot bypass this restriction. The check is conservative across date windows; it does not allow two potential video areas merely because their current bookings have different times.

## Offline and compatibility

Authenticated manifests include only channels reachable from that screen's default, legacy scheduled or directly booked layouts, relevant direct/channel bookings, their reusable content and every referenced R2 asset (including future bookings). IDs use JSON SQL parameters to support fleets beyond D1's bind-count limit. Missing references or invalid media metadata reject the whole update. The existing download/hash verification and atomic activation then keep the previous playable state on failure.

New players advertise `X-Player-Capabilities: channels-v1`. A player without this capability receives 409 if its manifest needs channels/bookings, preserving its previous cached state instead of accepting unsupported layers. Refresh hosted players or rebuild existing Tizen packages before assigning this content. This update does not install anything on physical screens.

Cached inline widgets and uploaded media can rotate after an offline reload. Hosted web pages, external media and live API feeds still require network; the sandbox and weather cache limitations continue to apply. There is no per-booking fallback media, transition editor, video-end duration mode, physical multi-display synchronization, independent overlapping screen groups or widget ZIP package editor yet. Zones remain the existing group mechanism.

## Verification

54 Node tests and 24 Chromium tests pass. New coverage includes explicit setup against an older schema, preservation of old layouts, rule validation, deterministic rotation/date/overnight/priority behavior, direct-layout/fullscreen bookings, guarded deletions, incomplete-manifest rejection, media integrity and the video-area constraint. Browser tests create content/channel/bookings through the UI, preview a screen, retain a static HTML iframe across channel changes, and rotate text/images across an offline reload. A local Wrangler D1/R2 test serves 100 simultaneous channel clients; it complements the existing 100-player fleet waves. Production D1 migration/activation, real network quotas and physical Tizen playback remain unverified here.
