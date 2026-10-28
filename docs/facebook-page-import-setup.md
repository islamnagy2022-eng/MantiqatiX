# Facebook Page Profile Import — Production Setup

The catalog provides a review-before-save import flow for the **activity owner's own Facebook Pages**. The page owner signs in using Meta's Login SDK, selects a Page they manage, and reviews the available profile photo, cover, biography/description, address, and opening hours. The imported values are copied into the merchant form only after the owner presses **Use data**; the owner's normal **Save changes** button persists the profile.

## Required Meta app configuration

1. Create or choose a Meta developer app and enable Facebook Login for the Web.
2. Configure the JavaScript SDK site/domain for `https://islamnagy2022-eng.github.io` and the catalog URL `https://islamnagy2022-eng.github.io/MantiqatiX/`.
3. Request the minimum Page permissions used by this flow: `pages_show_list` and `pages_read_engagement`. Meta may require app review/Advanced Access before real users outside app roles can use the permissions.
4. Put the **public** Meta App ID in `apps/catalog-frontend/public/config.js` as `facebookAppId`. This is an identifier, not a secret.
5. Add the **secret** values to the Supabase project Edge Function secrets, never to source code or browser config:
   - `META_APP_ID`: the same Meta App ID used by the browser.
   - `META_APP_SECRET`: the Meta App Secret.
6. Deploy `facebook-page-import` with JWT verification enabled, then validate login from an account that manages a Facebook Page.

The function verifies the Supabase session, active activity membership, Facebook token's Meta app ID and scopes, and that the selected Page is returned by `/me/accounts`. Page access tokens stay on the server and are not returned to the browser. The access token held by the UI is transient and is cleared after applying the preview.

## Important limits

The feature reads only Page data returned by Meta to the connected manager. Missing page fields remain unchanged in the catalog; no address, hours, or description is invented. The profile is not saved until the owner reviews and saves the catalog form. Meta may not provide every field for every Page, and production permissions depend on the app's Meta review/configuration.
