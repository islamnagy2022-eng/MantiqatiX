const normalize = (value) => String(value ?? "").trim();

const permissionFingerprint = (value) => {
  const safe = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const canonicalize = (item) => {
    if (Array.isArray(item)) return item.map(canonicalize);
    if (!item || typeof item !== "object") return item;
    return Object.fromEntries(
      Object.keys(item).sort().map((key) => [key, canonicalize(item[key])]),
    );
  };
  return JSON.stringify(canonicalize(safe));
};

const statusPriority = (value) => {
  const status = normalize(value).toUpperCase();
  if (status === "ACTIVE") return 2;
  if (status === "PENDING" || status === "INACTIVE") return 1;
  return 0;
};

const createdAtValue = (value) => {
  const timestamp = Date.parse(normalize(value));
  return Number.isFinite(timestamp) ? timestamp : 0;
};

/**
 * Remove repeated rows for the exact same authenticated account, tenant,
 * organization, business, branch, role, and permission set.
 *
 * Branch and permission scopes are part of the identity key so legitimate
 * branch-specific or differently permissioned memberships are never merged.
 * For true duplicates, ACTIVE wins; ties prefer the newest created_at value.
 *
 * @param {unknown} input
 * @returns {{ rows: any[], duplicatesRemoved: number }}
 */
export const deduplicateSubscriberMemberships = (input) => {
  if (!Array.isArray(input)) return { rows: [], duplicatesRemoved: 0 };

  const byScope = new Map();
  const passthrough = [];
  let duplicatesRemoved = 0;

  input.forEach((row, index) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      passthrough.push({ row, index });
      return;
    }

    const userId = normalize(row.user_id);
    if (!userId) {
      passthrough.push({ row, index });
      return;
    }

    const key = JSON.stringify([
      userId,
      normalize(row.tenant_id),
      normalize(row.organization_id),
      normalize(row.business_id),
      normalize(row.branch_id),
      normalize(row.role).toUpperCase(),
      permissionFingerprint(row.permissions),
    ]);
    const existing = byScope.get(key);
    if (!existing) {
      byScope.set(key, { row, index });
      return;
    }

    duplicatesRemoved += 1;
    const candidateStatus = statusPriority(row.status);
    const currentStatus = statusPriority(existing.row.status);
    const candidateCreatedAt = createdAtValue(row.created_at);
    const currentCreatedAt = createdAtValue(existing.row.created_at);
    if (
      candidateStatus > currentStatus ||
      (candidateStatus === currentStatus && candidateCreatedAt > currentCreatedAt)
    ) {
      byScope.set(key, { row, index: existing.index });
    }
  });

  const retained = [...byScope.values(), ...passthrough]
    .sort((left, right) => left.index - right.index)
    .map((entry) => entry.row);

  return { rows: retained, duplicatesRemoved };
};
