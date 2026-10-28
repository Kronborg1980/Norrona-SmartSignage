# Confirmed booking and channel model

Confirmed by the user: a direct screen booking may schedule **either a whole layout or individual content fullscreen**. A layout defines composition, not the booking itself.

- Layouts contain positioned areas/layers. A layer may host static content or a reusable channel.
- Channels contain scheduled content bookings and may be reused by multiple layouts/screens.
- A booking identifies its destination (screen, screen group or channel), content, dates, UTC weekday/time windows, duration/order and priority.
- Screen bookings select either an entire layout or fullscreen media/widget content.
- Channel bookings select media/widgets within the channel's layout area.
- Bookable content includes images, videos, text and reusable widgets. Multi-file widget packages require their own media-library source-file management.

This is the accepted target model, **not implemented by the large-HTML fix**. Existing default layouts and schedules keep working. The redesign requires additive D1 migrations, separate booking/channel management, a shared deterministic resolver, preview and offline manifests, then rollout testing for 100 players. Existing schedule data must be preserved during migration. A direct screen booking should override the normal layout only during its active time window, then return to fallback; channel bookings affect only their own area.

Open implementation decisions include equal-priority tie breaking, playlist rotation/durations and recovery when a scheduled content download fails. These should be resolved with explicit deterministic defaults and tests, preserving the last verified playable content.
