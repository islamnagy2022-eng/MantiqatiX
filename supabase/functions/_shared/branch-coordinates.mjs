export function parseOptionalCoordinate(value) {
  if (value == null || (typeof value === "string" && value.trim() === "")) return null;
  if (typeof value !== "number" && typeof value !== "string") return Number.NaN;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function parseBranchCoordinates(latitudeInput, longitudeInput) {
  const latitude = parseOptionalCoordinate(latitudeInput);
  const longitude = parseOptionalCoordinate(longitudeInput);
  const invalid =
    (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) ||
    (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) ||
    ((latitude === null) !== (longitude === null));
  return { latitude, longitude, error: invalid ? "INVALID_COORDINATES" : null };
}
