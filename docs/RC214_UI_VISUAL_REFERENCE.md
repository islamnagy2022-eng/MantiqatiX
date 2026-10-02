# RC214 UI Visual Reference — MantiqatiX

## Scope
Visual implementation of the supplied MantiqatiX homepage reference on the existing RC214 web continuation branch.

## Implemented
- Local MantiqatiX marketplace cover artwork at `web/assets/mantiqatix-cover.svg`.
- Red/gold MantiqatiX visual system aligned to the supplied reference.
- Full-width marketplace cover/hero with existing live search and CTA controls preserved.
- Existing MantiqatiX mark reused as the primary brand mark.
- Horizontal sector/category strip using existing local activity assets.
- Sponsored placement: featured advertisement on the left + sponsored provider/listing cards on the right.
- Provider/service card styling and verification chips aligned with the new visual system.
- Header/navigation and footer restyled for the reference direction.
- Responsive behavior for desktop/tablet/mobile.
- Asset cache version bumped from `mnty106` to `mnty107`.

## Data / security boundary
This change is presentation-layer only. It does not add synthetic business data, does not change RLS, payment authority, authentication, or marketing-lead authorization, and does not move secrets to the browser.

## Verification
- GitHub branch head updated successfully.
- PR remains draft and is not Production Certified.
- External browser/device visual smoke test remains required before merge/release.
