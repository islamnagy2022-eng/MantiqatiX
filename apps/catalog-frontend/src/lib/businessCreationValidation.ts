export type BusinessCreationIdentityInput = {
  name?: unknown;
  governorate?: unknown;
  markaz?: unknown;
};

export type BusinessCreationIdentityResult =
  | { ok: true; name: string; governorate: string; markaz: string }
  | { ok: false; message: string };

/**
 * Validate and normalize the minimum identity/location required to publish a
 * business record. Village and street remain optional because some activities
 * are identified at governorate + city/district level only.
 */
export function validateBusinessCreationIdentity(
  input: BusinessCreationIdentityInput,
): BusinessCreationIdentityResult {
  const name = String(input.name ?? '').trim();
  const governorate = String(input.governorate ?? '').trim();
  const markaz = String(input.markaz ?? '').trim();

  if (Array.from(name).length < 2) {
    return { ok: false, message: 'اكتب اسم النشاط الحقيقي (حرفان على الأقل).' };
  }
  if (!governorate) {
    return { ok: false, message: 'حدد المحافظة الفعلية للنشاط.' };
  }
  if (!markaz) {
    return { ok: false, message: 'حدد المركز أو القسم الفعلي للنشاط.' };
  }

  return { ok: true, name, governorate, markaz };
}
