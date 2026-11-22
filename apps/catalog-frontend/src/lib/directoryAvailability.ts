export function getDirectoryDisabledMessage(body: unknown): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  if ((body as Record<string, unknown>).directoryDisabled !== true) return null;
  return "دليل الأنشطة متوقف مؤقتًا لحماية بيانات التواصل إلى حين استكمال التحقق من موافقات أصحاب الصفحات. باقي خدمات المنصة متاحة بشكل طبيعي.";
}
