# RC71 — Storage & Media Isolation Closure

Date: 2026-09-28

## Finding

The live Storage object policies contained a broad `ALL` policy on `mantiqatix-media` for non-anonymous paths. Although the policy attempted to exclude anonymous users, it was broader than the owner/business/provider-specific policies and could weaken object-level isolation.

## Remediation

Removed `mnt_public_media_path_boundary` from `storage.objects`.

The remaining `mantiqatix-media` policies are operation-specific and bound to authenticated users, owner paths, business membership, or the maintenance-provider relationship. The `mantiqatix-profile-media` bucket retains owner-bound insert/update/delete policies and an explicit public-read policy because provider profile media is intended to be public presentation media.

## Status

Broad media object boundary: CLOSED.

Two-user/two-tenant runtime Storage E2E and external signed-URL/media-consumer verification remain required for final certification.

No media rows or files were created or deleted by this checkpoint.
