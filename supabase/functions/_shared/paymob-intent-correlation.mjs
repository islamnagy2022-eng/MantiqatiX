/**
 * Correlates Paymob's successful intention response to the ledger request.
 * This is a pure guard: it performs no network or database operations.
 *
 * @param {{ledgerId: string, amount: number, currency: string, provider: unknown}} input
 * @returns {boolean}
 */
export function matchesPaymobIntention(input) {
  const provider = input?.provider && typeof input.provider === "object" && !Array.isArray(input.provider)
    ? input.provider
    : {};
  const detail = provider.intention_detail && typeof provider.intention_detail === "object" && !Array.isArray(provider.intention_detail)
    ? provider.intention_detail
    : {};
  const expectedAmount = Number(input?.amount);
  const actualAmount = Number(detail.amount);
  const expectedCurrency = String(input?.currency ?? "").trim().toUpperCase();
  const actualCurrency = String(detail.currency ?? "").trim().toUpperCase();
  const expectedReference = String(input?.ledgerId ?? "");
  const actualReference = String(provider.special_reference ?? "");

  return expectedReference.length > 0
    && Number.isFinite(expectedAmount)
    && expectedAmount > 0
    && Number.isFinite(actualAmount)
    && actualAmount === expectedAmount
    && expectedCurrency.length > 0
    && actualCurrency === expectedCurrency
    && actualReference === expectedReference;
}
