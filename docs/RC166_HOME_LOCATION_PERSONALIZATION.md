# RC166 — Home Location Personalization

The public home now requests browser geolocation when the home data loads, using low-power/coarse browser positioning (`enableHighAccuracy:false`).

Behavior:
- location is held in page memory only;
- no continuous watch is created;
- no precise coordinates are persisted by this change;
- provider results are ranked by distance when branch latitude/longitude are available and visible under existing RLS;
- sponsored/featured provider results inherit the same nearest-first ordering;
- if permission is denied, unavailable, timed out, or branch coordinates are unavailable, the home falls back to the live public catalog without inventing proximity;
- distance is calculated client-side using branch coordinates and the user's current position.

Open: production browser permission test, mobile accuracy/UX test, and verification that public branch RLS exposes only the intended coordinate data.
