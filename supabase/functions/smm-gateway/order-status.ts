const TERMINAL_ORDER_STATES = new Set(["COMPLETED", "CANCELLED", "FAILED", "PARTIAL"]);

export function normalizeProviderOrderStatus(currentStatus: unknown, providerStatus: unknown): string {
  const current = String(currentStatus ?? "");
  if (TERMINAL_ORDER_STATES.has(current.toUpperCase())) return current;

  const incoming = typeof providerStatus === "string" ? providerStatus.trim().toLowerCase() : "";
  if (incoming === "completed" || incoming === "complete") return "COMPLETED";
  if (incoming === "partial") return "PARTIAL";
  if (incoming === "canceled" || incoming === "cancelled") return "CANCELLED";
  if (incoming === "failed" || incoming === "error") return "FAILED";
  if (incoming === "processing" || incoming === "in progress" || incoming === "inprogress") return "PROCESSING";
  return current;
}
