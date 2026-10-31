export const sanitizeActivityModuleOverrides = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_ACTIVITY_MODULE_OVERRIDES");
  const entries = Object.entries(value);
  if (entries.length > 50) throw new Error("INVALID_ACTIVITY_MODULE_OVERRIDES");
  const safe = {};
  const cleanText = (input, max) => {
    if (typeof input !== "string") throw new Error("INVALID_ACTIVITY_MODULE_OVERRIDES");
    const text = input.trim();
    if (!text || text.length > max) throw new Error("INVALID_ACTIVITY_MODULE_OVERRIDES");
    return text;
  };
  const cleanList = (input) => {
    if (!Array.isArray(input) || input.length > 10) throw new Error("INVALID_ACTIVITY_MODULE_OVERRIDES");
    return input.map((item) => cleanText(item, 180));
  };
  for (const [activityId, raw] of entries) {
    if (!/^cat_[a-z0-9_]{3,120}$/.test(activityId) || !raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error("INVALID_ACTIVITY_MODULE_OVERRIDES");
    }
    const normalized = {};
    if (raw.marketing !== undefined) {
      if (!raw.marketing || typeof raw.marketing !== "object" || Array.isArray(raw.marketing)) throw new Error("INVALID_ACTIVITY_MODULE_OVERRIDES");
      const marketing = raw.marketing;
      const cleanMarketing = {};
      for (const field of ["objective", "audience", "positioning"]) {
        if (marketing[field] !== undefined) cleanMarketing[field] = cleanText(marketing[field], 500);
      }
      for (const field of ["contentPillars", "campaignIdeas", "requiredAssets"]) {
        if (marketing[field] !== undefined) cleanMarketing[field] = cleanList(marketing[field]);
      }
      if (!Object.keys(cleanMarketing).length) throw new Error("INVALID_ACTIVITY_MODULE_OVERRIDES");
      normalized.marketing = cleanMarketing;
    }
    if (raw.capabilities !== undefined) {
      if (!Array.isArray(raw.capabilities) || raw.capabilities.length !== 3) throw new Error("INVALID_ACTIVITY_MODULE_OVERRIDES");
      const seen = new Set();
      normalized.capabilities = raw.capabilities.map((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("INVALID_ACTIVITY_MODULE_OVERRIDES");
        const id = cleanText(item.id, 120);
        if (!/^[a-z0-9][a-z0-9_-]{1,119}$/.test(id) || seen.has(id)) throw new Error("INVALID_ACTIVITY_MODULE_OVERRIDES");
        seen.add(id);
        return { id, title: cleanText(item.title, 120), description: cleanText(item.description, 300) };
      });
    }
    if (!Object.keys(normalized).length) throw new Error("INVALID_ACTIVITY_MODULE_OVERRIDES");
    safe[activityId] = normalized;
  }
  if (new TextEncoder().encode(JSON.stringify(safe)).length > 120000) throw new Error("INVALID_ACTIVITY_MODULE_OVERRIDES");
  return safe;
};
