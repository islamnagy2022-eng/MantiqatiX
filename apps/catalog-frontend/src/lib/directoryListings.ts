import { productionRuntime, supabase } from "./production";
import { resolveCanonicalDirectoryCategoryId, resolveCanonicalGroupId } from "../data/productionDefaults";

export type PublicDirectoryListing = {
  id: string;
  slug: string;
  display_name: string;
  listing_type: string;
  functional_group_id: string;
  taxonomy_category_id: string;
  taxonomy_specialty: string | null;
  specialty: string | null;
  phone: string | null;
  secondary_phone: string | null;
  address: string | null;
  governorate: string;
  district: string;
  village: string | null;
  source_name: string;
  source_url: string | null;
  source_checked_at: string;
  listing_status: string;
  claim_status: string;
  can_edit?: boolean;
  owned_business_id?: string | null;
  outreach_status?: string;
  outreach_notes?: string | null;
  last_contacted_at?: string | null;
  subscription_offer_at?: string | null;
  next_follow_up_at?: string | null;
  completeness?: Record<string, boolean>;
  metadata?: Record<string, unknown>;
  created_at?: string;
};

function normalizeDirectoryListingTaxonomy(listing: PublicDirectoryListing): PublicDirectoryListing {
  const functionalGroupId = resolveCanonicalGroupId(
    [listing.taxonomy_category_id, listing.taxonomy_specialty, listing.specialty, listing.display_name].filter(Boolean).join(" "),
    listing.functional_group_id,
  );
  const canonicalCategoryId = resolveCanonicalDirectoryCategoryId(
    listing.taxonomy_category_id,
    listing.functional_group_id,
  );
  return {
    ...listing,
    functional_group_id: functionalGroupId,
    // Keep an unknown legacy ID visible at group level rather than dropping the record.
    // All currently inventoried production IDs are covered by the explicit alias map.
    taxonomy_category_id: canonicalCategoryId || listing.taxonomy_category_id,
  };
}

export type DirectoryClaimRequest = {
  id: string;
  listing_id: string;
  user_id: string;
  contact_name: string;
  contact_phone: string;
  contact_email?: string | null;
  evidence_note?: string | null;
  status: string;
  review_note?: string | null;
  created_at: string;
  linked_business_id?: string | null;
};

export type DirectoryAdminBundle = {
  listings: PublicDirectoryListing[];
  claims: DirectoryClaimRequest[];
  businesses: any[];
};

async function readBody(response: Response): Promise<any> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.error) {
    const message = body?.message || body?.error || "تعذر الاتصال بدليل الأنشطة";
    throw new Error(String(message));
  }
  return body;
}

export type PublicDirectoryListingPage = {
  listings: PublicDirectoryListing[];
  nextCursor: string | null;
  hasMore: boolean;
  pageSize: number;
};

export type PublicDirectoryListingFilters = {
  limit?: number;
  cursor?: string | null;
  type?: string;
  governorate?: string;
  district?: string;
  village?: string;
  address?: string;
  specialty?: string;
  functionalGroupId?: string;
  taxonomyCategoryId?: string;
  taxonomySpecialty?: string;
  q?: string;
};

export async function fetchPublicDirectoryListingPage(
  filters: PublicDirectoryListingFilters = {},
): Promise<PublicDirectoryListingPage> {
  const url = new URL(String(productionRuntime.supabaseUrl) + "/functions/v1/directory-listings");
  const params: Record<string, string | number | null | undefined> = {
    limit: filters.limit ?? 100,
    cursor: filters.cursor,
    type: filters.type,
    governorate: filters.governorate,
    district: filters.district,
    village: filters.village,
    address: filters.address,
    specialty: filters.specialty,
    functionalGroupId: filters.functionalGroupId,
    taxonomyCategoryId: filters.taxonomyCategoryId,
    taxonomySpecialty: filters.taxonomySpecialty,
    q: filters.q,
  };
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && String(value).trim()) url.searchParams.set(key, String(value));
  }
  const { data: authData } = await supabase.auth.getSession();
  const requestHeaders: Record<string, string> = { apikey: String(productionRuntime.supabaseKey) };
  if (authData.session?.access_token) requestHeaders.Authorization = "Bearer " + authData.session.access_token;
  const response = await fetch(url.toString(), { headers: requestHeaders, cache: "no-store" });
  const body = await readBody(response);
  return {
    listings: (Array.isArray(body.listings) ? body.listings : []).map((row: PublicDirectoryListing) => normalizeDirectoryListingTaxonomy(row)),
    nextCursor: typeof body.nextCursor === "string" ? body.nextCursor : null,
    hasMore: body.hasMore === true,
    pageSize: Number(body.pageSize) || Number(filters.limit) || 100,
  };
}

export async function fetchPublicDirectoryListings(slug?: string): Promise<PublicDirectoryListing[] | PublicDirectoryListing | null> {
  const url = new URL(String(productionRuntime.supabaseUrl) + "/functions/v1/directory-listings");
  if (slug) url.searchParams.set("slug", slug);
  const { data: authData } = await supabase.auth.getSession();
  const requestHeaders: Record<string, string> = { apikey: String(productionRuntime.supabaseKey) };
  if (authData.session?.access_token) requestHeaders.Authorization = "Bearer " + authData.session.access_token;
  const response = await fetch(url.toString(), {
    headers: requestHeaders,
    cache: "no-store",
  });
  const body = await readBody(response);
  if (slug) return body.listing ? normalizeDirectoryListingTaxonomy(body.listing as PublicDirectoryListing) : null;
  return (Array.isArray(body.listings) ? body.listings : []).map((row: PublicDirectoryListing) => normalizeDirectoryListingTaxonomy(row));
}

async function callDirectoryAdmin(body: Record<string, unknown>): Promise<any> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new Error(sessionError.message || "تعذر قراءة جلسة الدخول");
  const session = sessionData.session;
  if (!session?.access_token) throw new Error("سجّل الدخول أولًا بحساب إدارة المنصة.");
  const response = await fetch(String(productionRuntime.supabaseUrl) + "/functions/v1/directory-listings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: String(productionRuntime.supabaseKey),
      Authorization: "Bearer " + session.access_token,
    },
    body: JSON.stringify(body),
  });
  return readBody(response);
}

export async function submitDirectoryListingClaim(input: {
  listingId: string;
  contactName: string;
  contactPhone: string;
  evidenceNote?: string;
}): Promise<{ success: boolean; requestId: string; status: string }> {
  const response = await callDirectoryAdmin({
    action: "CLAIM_LISTING",
    listingId: input.listingId,
    contactName: input.contactName,
    contactPhone: input.contactPhone,
    evidenceNote: input.evidenceNote || "",
  });
  return response;
}

export async function fetchDirectoryAdminBundle(): Promise<DirectoryAdminBundle> {
  const body = await callDirectoryAdmin({ action: "ADMIN_LIST" }) as DirectoryAdminBundle;
  return {
    ...body,
    listings: (Array.isArray(body.listings) ? body.listings : []).map(normalizeDirectoryListingTaxonomy),
  };
}

export type DoctorDirectoryImportRow = {
  displayName: string;
  specialty: string;
  governorate: string;
  district: string;
  taxonomyCategoryId: string;
  phone?: string;
  secondaryPhone?: string;
  address?: string;
  village?: string;
  taxonomySpecialty?: string;
  sourceName: string;
  sourceUrl: string;
  sourcePermissionEvidenceId: string;
  sourceCheckedAt?: string;
  listingStatus?: "PUBLISHED" | "DRAFT" | "HIDDEN";
  metadata?: Record<string, unknown>;
};

export type DirectorySourcePermissionEvidence = {
  id: string;
  source_name: string;
  source_host: string;
  permission_basis: "LICENSED" | "OWNER_PROVIDED" | "PUBLIC_PERMISSION_CONFIRMED";
  evidence_reference: string;
  evidence_sha256: string | null;
  allows_doctor_profile_republication: boolean;
  allows_commercial_republication: boolean;
  valid_from: string;
  expires_at: string | null;
  status: "PENDING" | "APPROVED" | "REVOKED";
  created_by: string;
  approved_by: string | null;
  approved_at: string | null;
  revoked_by: string | null;
  revoked_at: string | null;
  revocation_reason: string | null;
  reviewer_note: string | null;
  created_at: string;
};

export async function fetchDirectorySourcePermissionEvidence(): Promise<DirectorySourcePermissionEvidence[]> {
  const body = await callDirectoryAdmin({ action: "ADMIN_LIST_SOURCE_PERMISSION_EVIDENCE" });
  return Array.isArray(body.evidence) ? body.evidence as DirectorySourcePermissionEvidence[] : [];
}

export async function registerDirectorySourcePermissionEvidence(input: {
  sourceName: string;
  sourceHost: string;
  permissionBasis: DirectorySourcePermissionEvidence["permission_basis"];
  evidenceReference: string;
  evidenceSha256?: string;
  expiresAt?: string;
  allowsDoctorProfileRepublication: boolean;
  allowsCommercialRepublication: boolean;
}): Promise<DirectorySourcePermissionEvidence> {
  const body = await callDirectoryAdmin({ action: "ADMIN_REGISTER_SOURCE_PERMISSION_EVIDENCE", ...input });
  return body.evidence as DirectorySourcePermissionEvidence;
}

export async function approveDirectorySourcePermissionEvidence(input: {
  evidenceId: string;
  reviewConfirmed: true;
  reviewerNote?: string;
}): Promise<void> {
  await callDirectoryAdmin({ action: "ADMIN_APPROVE_SOURCE_PERMISSION_EVIDENCE", ...input });
}

export async function revokeDirectorySourcePermissionEvidence(input: {
  evidenceId: string;
  reason: string;
}): Promise<void> {
  await callDirectoryAdmin({ action: "ADMIN_REVOKE_SOURCE_PERMISSION_EVIDENCE", ...input });
}

export type DoctorDirectoryImportResult = {
  success: boolean;
  processed: number;
  inserted: number;
  updated: number;
  drafted: number;
  failed: number;
  results: Array<{ index: number; status: string; id?: string; reason?: string }>;
};

export async function importDoctorDirectoryBatch(
  rows: DoctorDirectoryImportRow[],
): Promise<DoctorDirectoryImportResult> {
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > 20) {
    throw new Error("استيراد الأطباء يقبل من طبيب واحد إلى 20 طبيبًا في الدفعة.");
  }
  return callDirectoryAdmin({ action: "IMPORT_DOCTOR_BATCH", rows }) as Promise<DoctorDirectoryImportResult>;
}

export async function saveDirectoryListing(input: Record<string, unknown>): Promise<PublicDirectoryListing> {
  const body = await callDirectoryAdmin({ action: "UPSERT_LISTING", ...input });
  return normalizeDirectoryListingTaxonomy(body.listing as PublicDirectoryListing);
}

export async function reviewDirectoryClaim(input: {
  claimId: string;
  decision: "REVIEWING" | "REJECTED" | "APPROVED";
  reviewNote?: string;
  businessId?: string;
  ownershipVerified?: boolean;
  subscriptionPaid?: boolean;
}): Promise<any> {
  return callDirectoryAdmin({ action: "REVIEW_CLAIM", ...input });
}


export async function updateOwnedDirectoryListing(input: {
  listingId: string; displayName: string; specialty: string; phone: string; secondaryPhone: string;
  address: string; governorate: string; district: string; village: string;
  bio: string; workingHours: string; websiteUrl: string; bookingUrl: string; services: string; socialLinks: string; profileImageUrl: string;
}): Promise<PublicDirectoryListing> {
  const response = await callDirectoryAdmin({
    action: "UPDATE_OWNED_LISTING", listingId: input.listingId, displayName: input.displayName,
    specialty: input.specialty, phone: input.phone, secondaryPhone: input.secondaryPhone, address: input.address,
    governorate: input.governorate, district: input.district, village: input.village,
    metadata: {
      bio: input.bio, workingHours: input.workingHours, websiteUrl: input.websiteUrl, bookingUrl: input.bookingUrl,
      services: input.services.split("\\n").map((value) => value.trim()).filter(Boolean),
      socialLinks: input.socialLinks.split("\\n").map((value) => value.trim()).filter(Boolean),
      profileImageUrl: input.profileImageUrl.trim(),
    },
  });
  return response.listing as PublicDirectoryListing;
}
