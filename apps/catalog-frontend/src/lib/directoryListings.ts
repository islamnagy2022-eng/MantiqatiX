import { productionRuntime, supabase } from "./production";

export type PublicDirectoryListing = {
  id: string;
  slug: string;
  display_name: string;
  listing_type: string;
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
  outreach_status?: string;
  outreach_notes?: string | null;
  last_contacted_at?: string | null;
  subscription_offer_at?: string | null;
  next_follow_up_at?: string | null;
  completeness?: Record<string, boolean>;
  metadata?: Record<string, unknown>;
  created_at?: string;
};

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

export async function fetchPublicDirectoryListings(slug?: string): Promise<PublicDirectoryListing[] | PublicDirectoryListing | null> {
  const url = new URL(String(productionRuntime.supabaseUrl) + "/functions/v1/directory-listings");
  if (slug) url.searchParams.set("slug", slug);
  const response = await fetch(url.toString(), {
    headers: { apikey: String(productionRuntime.supabaseKey) },
    cache: "no-store",
  });
  const body = await readBody(response);
  if (slug) return (body.listing || null) as PublicDirectoryListing | null;
  return (Array.isArray(body.listings) ? body.listings : []) as PublicDirectoryListing[];
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
  return callDirectoryAdmin({ action: "ADMIN_LIST" }) as Promise<DirectoryAdminBundle>;
}

export async function saveDirectoryListing(input: Record<string, unknown>): Promise<PublicDirectoryListing> {
  const body = await callDirectoryAdmin({ action: "UPSERT_LISTING", ...input });
  return body.listing as PublicDirectoryListing;
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
  bio: string; workingHours: string; websiteUrl: string; bookingUrl: string; services: string; socialLinks: string;
}): Promise<PublicDirectoryListing> {
  const response = await callDirectoryAdmin({
    action: "UPDATE_OWNED_LISTING", listingId: input.listingId, displayName: input.displayName,
    specialty: input.specialty, phone: input.phone, secondaryPhone: input.secondaryPhone, address: input.address,
    governorate: input.governorate, district: input.district, village: input.village,
    metadata: {
      bio: input.bio, workingHours: input.workingHours, websiteUrl: input.websiteUrl, bookingUrl: input.bookingUrl,
      services: input.services.split("\\n").map((value) => value.trim()).filter(Boolean),
      socialLinks: input.socialLinks.split("\\n").map((value) => value.trim()).filter(Boolean),
    },
  });
  return response.listing as PublicDirectoryListing;
}
