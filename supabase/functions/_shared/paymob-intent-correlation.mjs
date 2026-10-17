/**
 * Validates the major-unit ledger fare and its converted Paymob minor-unit amount.
 * Rejects overflow, unsafe integers, and fares that cannot be represented in cents.
 *
 * @param {number} amountMajorUnits
 * @param {number} amountCents
 * @returns {boolean}
 */
export function isValidPaymobAmountCents(amountMajorUnits, amountCents) {
  return Number.isFinite(amountMajorUnits)
    && amountMajorUnits > 0
    && Number.isSafeInteger(amountCents)
    && amountCents > 0
    && Math.abs(amountMajorUnits * 100 - amountCents) <= 1e-7;
}

/**
 * Correlates Paymob's successful intention response to the ledger request.
 * Paymob represents both request amount and intention_detail.amount in the
 * currency's smallest unit (cents for EGP). This is a pure guard.
 *
 * @param {{ledgerId: string, amountCents: number, currency: string, provider: unknown}} input
 * @returns {boolean}
 */
export function matchesPaymobIntention(input) {
  const provider = input?.provider && typeof input.provider === "object" && !Array.isArray(input.provider)
    ? input.provider
    : {};
  const detail = provider.intention_detail && typeof provider.intention_detail === "object" && !Array.isArray(provider.intention_detail)
    ? provider.intention_detail
    : {};
  const expectedAmountCents = Number(input?.amountCents);
  const actualAmountCents = Number(detail.amount);
  const expectedCurrency = String(input?.currency ?? "").trim().toUpperCase();
  const actualCurrency = String(detail.currency ?? "").trim().toUpperCase();
  const expectedReference = String(input?.ledgerId ?? "");
  const actualReference = String(provider.special_reference ?? "");

  return expectedReference.length > 0
    && Number.isSafeInteger(expectedAmountCents)
    && expectedAmountCents > 0
    && Number.isSafeInteger(actualAmountCents)
    && actualAmountCents === expectedAmountCents
    && expectedCurrency.length > 0
    && actualCurrency === expectedCurrency
    && actualReference === expectedReference;
}
