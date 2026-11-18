# Pass 341–350 — Production parity and Supabase security-advisor triage

Date: 2026-11-18

## Production parity snapshot (read-only)
- Migration ledger: 310 entries; latest applied version 20261110150618.
- RC472 and RC473 migrations are not applied in the live project.
- Edge Function versions: directory-listings v16; public-catalog v8; public-catalog-directory v18.
- RC473 is source-merged but not deployed to Production. Current live directory-listings v16 does not contain the new consent registry enforcement.

## Security advisor
- 65 authenticated-executable SECURITY DEFINER functions.
- One anon-executable SECURITY DEFINER function.
- Leaked-password protection disabled.
- 9 RLS-enabled/no-policy INFO findings.
- 28 multiple-permissive-policy warnings.

### Anonymous targeted-ad RPC review
Function: public.get_mnty_targeted_advertisements(...).
- ACL explicitly includes anon and authenticated execution.
- SECURITY DEFINER with an empty search_path.
- Reads active/approved advertisement and active geo-targeting rows only.
- Returns ad identity/title/creative/target URLs, placement, match level and distance; result count is clamped to 1–50.
- No user-specific profile, membership, order, wallet or payment data is selected.
- Assessment: appears to be an intentional public-ad delivery API; retain as an explicit exception only with a dedicated output/limit/ACL regression test. This is not a blanket clearance of other functions.

### Authenticated SECURITY DEFINER wrappers without direct auth.uid()
The live catalog contained six such functions. Reviewed the wrapper bodies and immediate delegates:
- mnty_can and mnty_can_platform_admin delegate to mnty_active_membership, which filters membership rows by auth.uid().
- mnty_business_employee_list delegates to mnty_business_employee_list_scoped, which checks auth.uid(), anonymous-session status, business/tenant/branch consistency and employee-view/manage permission.
- preview_commission_backend delegates to assert_financial_membership, which requires auth.uid() and a finance-capable membership.
- upsert_catalog_item_and_price_backend delegates to item/price backend functions that check auth.uid(), tenant/business membership, branch scope and write permissions.
No ACL/grant change was made. This limited wrapper review does not replace a complete per-function audit of all 65 functions.

## Performance and health advisor
- 132 unindexed foreign keys.
- 375 RLS initialization-plan notices.
- 71 unused-index notices.
- 28 multiple-permissive-policy warnings.
- Health advisor: zero lints.
These are triage baselines, not instructions to apply broad schema/index changes. Every proposed optimization must be reviewed against query plans, table size, write load and the actual authorization model.

## Next security actions
1. Enable and verify leaked-password protection using the supported Supabase Auth project settings UI/API.
2. Review each SECURITY DEFINER function for caller identity, role/tenant/branch scope, search_path, object qualification, grants, and output exposure.
3. Add regression coverage for the public targeted-ad RPC, including anonymous access, approved-only output and maximum result count.
4. Review RLS policies for anonymous-role semantics and overlapping permissive policies; do not assume a WARN is automatically exploitable.

## Release boundary
No Production migration, schema/data/Auth/RLS/GRANT/Edge/payment/settlement mutation was performed. Full Production release remains BLOCKED / NOT CERTIFIED due to missing verified off-site backup/restore, unresolved source-specific republication permissions, and unapplied RC472/RC473 migrations and Edge release.