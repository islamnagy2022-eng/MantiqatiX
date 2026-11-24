# Pass 2241–2250 — RC452–RC453 CRM tenant scope and internal campaigns live recheck

**Checkpoint:** 2026-11-24  
**Production:** `MANTIQATIX FINAL` / `moyhiluyhjsujhwlyeuu`  
**Mode:** Source review and read-only PostgreSQL policy/catalog/ACL queries. No Production writes.

## RC452 — CRM tenant/business scope

Source `20261010210000_rc452_marketing_crm_tenant_scope.sql` replaces the older broad CRM manager policies on `marketing_leads` and `marketing_provider_profiles`. Source scope permits own-lead access, matching business membership, or an explicit active `MNTY-PLATFORM` SUPER_ADMIN with `PLATFORM` scope and `full_control=true`.

**Live Production result:** both CRM manager SELECT policies still use broad active role membership for SUPER_ADMIN/ADMIN/OWNER/MANAGER/BUSINESS_OWNER without the source's business-row correlation and explicit platform full-control check. The current `marketing_leads` policy can therefore match an active role in the table without proving that the role's business matches the requested lead. The current provider-profile CRM policy has the same broad role-only structure.

Additional separate provider-profile state:
- `marketing_provider_profiles` still has direct anon SELECT privilege.
- `Public can view active marketing providers` remains an anon/authenticated ACTIVE policy.
- Owner profile management and public active-profile access are distinct from RC452's CRM manager read scope; preserve the curated public read capability while separately resolving the raw whole-row base-table exposure documented by RC479/#928.

**Disposition:** **POLICY DRIFT / BLOCKED**. No CRM policy or table privilege was changed.

## RC453 — Internal marketing campaign workflow

Source `20261010220000_rc453_marketing_campaign_backend.sql` introduces an internal campaign-planning and partner-collaboration workflow. It is not an external Ads API connector and does not publish campaigns automatically to Meta, TikTok or Google.

Expected source objects:
- Tables: `public.marketing_campaigns` and `public.marketing_campaign_participants`.
- Indexes: `marketing_campaigns_business_status_idx`, `marketing_campaigns_tenant_created_idx`, `marketing_campaign_participants_provider_status_idx`, `marketing_campaign_participants_business_campaign_idx`.
- RPCs: `mnty_can_manage_marketing_business(uuid)`, `create_marketing_campaign_backend(uuid,uuid,text,text,text[],numeric,text,character varying,timestamp with time zone,timestamp with time zone,jsonb,text)`, `invite_marketing_campaign_partner_backend(uuid,uuid,uuid,character varying,numeric,numeric)`, `respond_marketing_campaign_invitation_backend(uuid,uuid,character varying)`, `update_marketing_campaign_status_backend(uuid,uuid,character varying)`.
- RLS read policies: `marketing_campaigns_scoped_read` and `marketing_campaign_participants_scoped_read`.

**Live Production result:** both tables are absent; all four indexes are absent; all five exact RPC signatures are absent. The source's internal workflow is therefore not deployed.

**Disposition:** **BLOCKED / NOT APPLIED**. Do not expose a campaign creation UI or claim external platform publishing is implemented from this migration alone.

## Related release context

- RC444's source read-policy scope was not replaced by RC452 in live Production; the source-to-live mismatch remains.
- The 82-version source release remains unapplied to Production.
- Live migration ledger remains 310 rows through `20261110150618`.
- No policy, grant, table, index, RPC, Auth, Edge, business data or Ads integration was written or deployed.

**Production mutation:** NONE.
