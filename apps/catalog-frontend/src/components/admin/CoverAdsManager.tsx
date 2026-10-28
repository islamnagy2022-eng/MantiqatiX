import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/production";
import type { Business } from "../../types";
import type { CoverAdvertisement, CoverAdvertisementDraft } from "../../types/coverAdvertisements";
import { Image as ImageIcon, Plus, Save, Trash2, X, Megaphone } from "lucide-react";

type Props = { businesses: Business[] };

const today = () => new Date().toISOString().slice(0, 10);
const makeDraft = (): CoverAdvertisementDraft => ({
  title: "",
  targetUrl: "",
  placement: "HOME_ONLY",
  duration: "MONTHLY",
  startDate: today(),
  targetBusinessIds: [],
  locationScope: "ALL",
  locationValue: "",
  price: 0,
  status: "ACTIVE",
});

const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error("تعذر قراءة الصورة المختارة."));
  reader.onload = () => {
    const result = String(reader.result || "");
    const comma = result.indexOf(",");
    if (comma < 0) reject(new Error("صيغة الصورة غير صالحة."));
    else resolve(result.slice(comma + 1));
  };
  reader.readAsDataURL(file);
});

const durationLabel = (duration: CoverAdvertisement["duration"]) => ({
  MONTHLY: "شهري",
  QUARTERLY: "ربع سنوي",
  SEMIANNUAL: "نصف سنوي",
  ANNUAL: "سنوي",
}[duration]);

const CoverAdsManager: React.FC<Props> = ({ businesses }) => {
  const [ads, setAds] = useState<CoverAdvertisement[]>([]);
  const [draft, setDraft] = useState<CoverAdvertisementDraft>(makeDraft);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [template, setTemplate] = useState("");
  const [externalImageUrl, setExternalImageUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const loadAds = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("catalog-cover-ads", { body: { action: "LIST_ADMIN" } });
      if (error || data?.error) throw new Error(data?.message || data?.error || error?.message || "تعذر تحميل الإعلانات.");
      setAds(Array.isArray(data?.ads) ? data.ads as CoverAdvertisement[] : []);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "تعذر تحميل الإعلانات." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadAds(); }, []);

  const reset = () => {
    setDraft(makeDraft());
    setSelectedFile(null);
    setTemplate("");
    setExternalImageUrl("");
  };

  const edit = (ad: CoverAdvertisement) => {
    setDraft({
      id: ad.id,
      title: ad.title,
      imageUrl: ad.imageUrl,
      storagePath: ad.storagePath,
      targetUrl: ad.targetUrl || "",
      placement: ad.placement,
      duration: ad.duration,
      startDate: ad.startDate,
      endDate: ad.endDate,
      targetBusinessIds: [...(ad.targetBusinessIds || [])],
      locationScope: ad.locationScope,
      locationValue: ad.locationValue || "",
      price: Number(ad.price || 0),
      status: ad.status,
    });
    setSelectedFile(null);
    setTemplate("");
    setExternalImageUrl(ad.imageUrl.startsWith("https://") ? ad.imageUrl : "");
    setMessage(null);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (!selectedFile && !draft.imageUrl?.trim()) {
      setMessage({ type: "error", text: "ارفع صورة أو اختر أحد تصميمات MantiqatiX الافتراضية." });
      return;
    }
    if (selectedFile && (selectedFile.size > 3 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(selectedFile.type))) {
      setMessage({ type: "error", text: "الصورة يجب أن تكون JPG أو PNG أو WebP وبحجم أقصى 3 ميجابايت." });
      return;
    }
    if (["BUSINESS_COVER", "BOTH"].includes(draft.placement) && draft.targetBusinessIds.length === 0) {
      setMessage({ type: "error", text: "حدد نشاطًا واحدًا على الأقل لنشر الإعلان على أغلفته." });
      return;
    }
    if (draft.locationScope !== "ALL" && !draft.locationValue.trim()) {
      setMessage({ type: "error", text: "حدد البلدة أو المحافظة المستهدفة." });
      return;
    }
    if (draft.targetUrl.trim() && !/^https:\/\//i.test(draft.targetUrl.trim())) {
      setMessage({ type: "error", text: "رابط الوجهة يجب أن يبدأ بـ https://." });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const imageBase64 = selectedFile ? await fileToBase64(selectedFile) : "";
      const { data, error } = await supabase.functions.invoke("catalog-cover-ads", {
        body: {
          action: "SAVE_AD",
          ad: {
            ...draft,
            targetBusinessIds: [...new Set(draft.targetBusinessIds)],
            price: Number(draft.price || 0),
          },
          imageBase64,
          imageMimeType: selectedFile?.type || "",
        },
      });
      if (error || data?.error) {
        if (data?.error === "COVER_AD_LIMIT_REACHED") throw new Error("وصلت إلى الحد الأقصى: 10 إعلانات.");
        throw new Error(data?.message || data?.error || error?.message || "تعذر حفظ الإعلان.");
      }
      setAds(Array.isArray(data?.ads) ? data.ads as CoverAdvertisement[] : []);
      setMessage({ type: "success", text: "تم حفظ الإعلان وجدول عرضه ونطاق استهدافه." });
      reset();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "تعذر حفظ الإعلان." });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (ad: CoverAdvertisement) => {
    if (!window.confirm("حذف الإعلان «" + ad.title + "» وصورته المرفوعة؟")) return;
    setSaving(true);
    setMessage(null);
    try {
      const { data, error } = await supabase.functions.invoke("catalog-cover-ads", { body: { action: "DELETE_AD", id: ad.id } });
      if (error || data?.error) throw new Error(data?.message || data?.error || error?.message || "تعذر حذف الإعلان.");
      setAds(Array.isArray(data?.ads) ? data.ads as CoverAdvertisement[] : []);
      if (draft.id === ad.id) reset();
      setMessage({ type: "success", text: "تم حذف الإعلان." });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "تعذر حذف الإعلان." });
    } finally {
      setSaving(false);
    }
  };

  const chooseTemplate = (value: string) => {
    setTemplate(value);
    setSelectedFile(null);
    setExternalImageUrl("");
    setDraft((prev) => ({
      ...prev,
      imageUrl: value ? (import.meta.env.BASE_URL || "/") + "legacy/mnty-cover-ad-" + value + ".svg" : (prev.storagePath ? prev.imageUrl : ""),
      storagePath: value ? "" : prev.storagePath,
    }));
  };

  const locations = [...new Set(businesses.flatMap((business) => [
    business.markaz,
    business.village,
  ]).filter((value): value is string => Boolean(value?.trim())))].sort((a, b) => a.localeCompare(b, "ar"));

  return (
    <div className="space-y-6" dir="rtl">
      <section className="rounded-3xl bg-gradient-to-l from-red-950 via-slate-900 to-slate-800 p-5 sm:p-7 text-white shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-[10px] font-black tracking-[0.2em] text-red-200">MantiqatiX • COVER ADS</p>
            <h2 className="mt-2 text-xl sm:text-2xl font-black">إدارة الغلاف الإعلاني الرئيسي</h2>
            <p className="mt-2 max-w-3xl text-xs sm:text-sm leading-6 text-white/75">أضف حتى 10 إعلانات، وحدد مدتها ومكانها والأنشطة والمناطق التي تستهدفها. عند عدم وجود إعلان مناسب، تظهر تصميمات MantiqatiX الرسمية.</p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-center">
            <span className="block text-2xl font-black">{ads.length}/10</span>
            <span className="text-[10px] font-bold text-white/70">إعلانات محفوظة</span>
          </div>
        </div>
      </section>

      {message && (
        <div role="status" className={"rounded-xl border px-4 py-3 text-xs font-bold " + (message.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800")}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)] gap-6 items-start">
        <form onSubmit={save} className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-black text-slate-900">{draft.id ? "تعديل إعلان محفوظ" : "إضافة إعلان جديد"}</h3>
            {draft.id && <button type="button" onClick={reset} className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-900"><X className="w-3.5 h-3.5" /> إلغاء التعديل</button>}
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-bold text-slate-700">عنوان الإعلان</span>
            <input required maxLength={180} value={draft.title} onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" placeholder="اسم النشاط أو العرض" />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-slate-700">رفع صورة الإعلان — حتى 3 ميجابايت</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { setSelectedFile(e.target.files?.[0] || null); if (e.target.files?.[0]) setTemplate(""); }} className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs file:ml-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:font-bold" />
              {selectedFile && <span className="mt-1 block text-[10px] text-emerald-700">{selectedFile.name}</span>}
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-slate-700">أو اختر تصميم MantiqatiX</span>
              <select value={template} onChange={(e) => chooseTemplate(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs">
                <option value="">بدون قالب افتراضي</option>
                <option value="1">القالب الأول — حضور رقمي</option>
                <option value="2">القالب الثاني — سجّل نشاطك</option>
                <option value="3">القالب الثالث — فرصتك تبدأ هنا</option>
              </select>
            </label>
          </div>

          {draft.imageUrl && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
              <img src={draft.imageUrl} alt="معاينة الإعلان" className="max-h-56 w-full object-contain" onError={(event) => { event.currentTarget.style.visibility = "hidden"; }} />
            </div>
          )}

          <label className="block">
            <span className="mb-1 block text-xs font-bold text-slate-700">رابط صورة خارجي آمن (HTTPS) — اختياري</span>
            <input type="url" value={externalImageUrl} onChange={(e) => { setExternalImageUrl(e.target.value); setSelectedFile(null); setTemplate(""); setDraft((prev) => ({ ...prev, imageUrl: e.target.value, storagePath: "" })); }} placeholder="https://..." className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-xs" dir="ltr" />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-bold text-slate-700">رابط الوجهة عند الضغط (اختياري)</span>
            <input type="url" value={draft.targetUrl} onChange={(e) => setDraft((prev) => ({ ...prev, targetUrl: e.target.value }))} placeholder="https://..." className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-xs" dir="ltr" />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-slate-700">مكان النشر</span>
              <select value={draft.placement} onChange={(e) => setDraft((prev) => ({ ...prev, placement: e.target.value as CoverAdvertisementDraft["placement"] }))} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs">
                <option value="HOME_ONLY">الغلاف الرئيسي للموقع</option>
                <option value="BUSINESS_COVER">أغلفة أنشطة محددة</option>
                <option value="BOTH">الرئيسي وأغلفة الأنشطة المحددة</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-slate-700">مدة الحجز</span>
              <select value={draft.duration} onChange={(e) => setDraft((prev) => ({ ...prev, duration: e.target.value as CoverAdvertisementDraft["duration"] }))} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs">
                <option value="MONTHLY">شهري</option>
                <option value="QUARTERLY">ربع سنوي — 3 أشهر</option>
                <option value="SEMIANNUAL">نصف سنوي — 6 أشهر</option>
                <option value="ANNUAL">سنوي — 12 شهرًا</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-slate-700">تاريخ بدء العرض</span>
              <input type="date" required value={draft.startDate} onChange={(e) => setDraft((prev) => ({ ...prev, startDate: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-xs" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-slate-700">قيمة الحجز بالجنيه (تسجيل إداري فقط)</span>
              <input type="number" min={0} max={100000000} step="0.01" value={draft.price} onChange={(e) => setDraft((prev) => ({ ...prev, price: Number(e.target.value) }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-xs" />
            </label>
          </div>

          <section className="rounded-2xl border border-slate-200 p-4 space-y-3">
            <h4 className="text-sm font-black text-slate-900">استهداف المواقع والأنشطة</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label>
                <span className="mb-1 block text-xs font-bold text-slate-700">نطاق العرض الجغرافي</span>
                <select value={draft.locationScope} onChange={(e) => setDraft((prev) => ({ ...prev, locationScope: e.target.value as CoverAdvertisementDraft["locationScope"], locationValue: e.target.value === "ALL" ? "" : prev.locationValue }))} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs">
                  <option value="ALL">كل الأماكن</option>
                  <option value="GOVERNORATE">محافظة محددة</option>
                  <option value="CITY">بلدة / مركز / حي محدد</option>
                </select>
              </label>
              {draft.locationScope !== "ALL" && (
                <label>
                  <span className="mb-1 block text-xs font-bold text-slate-700">{draft.locationScope === "GOVERNORATE" ? "المحافظة" : "البلدة / المركز / الحي"}</span>
                  <select required value={draft.locationValue} onChange={(e) => setDraft((prev) => ({ ...prev, locationValue: e.target.value }))} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs">
                    <option value="">اختر الموقع</option>
                    {(draft.locationScope === "GOVERNORATE"
                      ? [...new Set(businesses.map((business) => business.governorate).filter(Boolean))]
                      : locations).sort((a, b) => a.localeCompare(b, "ar")).map((location) => <option key={location} value={location}>{location}</option>)}
                  </select>
                </label>
              )}
            </div>

            {["BUSINESS_COVER", "BOTH"].includes(draft.placement) && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-700">اختر نشاطًا واحدًا أو أكثر</span>
                  <button type="button" onClick={() => setDraft((prev) => ({ ...prev, targetBusinessIds: businesses.map((business) => business.id) }))} className="text-[10px] font-black text-emerald-700 hover:underline">تحديد الكل</button>
                </div>
                <div className="grid max-h-56 grid-cols-1 sm:grid-cols-2 gap-1 overflow-y-auto rounded-xl border border-slate-200 p-2">
                  {businesses.map((business) => (
                    <label key={business.id} className="flex cursor-pointer items-center gap-2 rounded-lg p-2 hover:bg-slate-50">
                      <input type="checkbox" checked={draft.targetBusinessIds.includes(business.id)} onChange={(e) => setDraft((prev) => ({ ...prev, targetBusinessIds: e.target.checked ? [...new Set([...prev.targetBusinessIds, business.id])] : prev.targetBusinessIds.filter((id) => id !== business.id) }))} className="accent-emerald-600" />
                      <span className="truncate text-xs font-semibold text-slate-700">{business.name}</span>
                      <span className="shrink-0 text-[10px] text-slate-400">{business.governorate}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </section>

          <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <input type="checkbox" checked={draft.status === "ACTIVE"} onChange={(e) => setDraft((prev) => ({ ...prev, status: e.target.checked ? "ACTIVE" : "INACTIVE" }))} className="accent-emerald-600" />
            <span className="text-xs font-bold text-slate-800">الإعلان نشط خلال مدة الحجز</span>
          </label>
          <p className="text-[10px] leading-5 text-slate-500">السعر يُسجّل للإدارة فقط ولا يتم تحصيل أي مبلغ أو إصدار فاتورة من هذه الشاشة. ينتهي الحجز تلقائيًا حسب المدة وتاريخ البدء.</p>

          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" onClick={reset} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50">مسح الحقول</button>
            <button type="submit" disabled={saving || (ads.length >= 10 && !draft.id)} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-xs font-black text-white shadow-md hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">
              {saving ? "جارٍ الحفظ..." : draft.id ? "حفظ تعديلات الإعلان" : "إضافة الإعلان"}
              <Save className="w-4 h-4" />
            </button>
          </div>
        </form>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs">
          <h3 className="text-sm font-black text-slate-900">الإعلانات المحفوظة</h3>
          <p className="mt-1 text-[11px] leading-5 text-slate-500">يظهر الإعلان النشط الموافق لتاريخه وموقعه فقط. عند عدم وجود إعلانات مناسبة تظهر التصميمات الرسمية.</p>
          {loading ? (
            <div className="py-8 text-center text-xs text-slate-400">جارٍ تحميل الإعلانات…</div>
          ) : ads.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 p-5 text-center text-xs leading-6 text-slate-500">لا توجد إعلانات مضافة بعد؛ التصميمات الافتراضية ستظل ظاهرة.</div>
          ) : (
            <div className="mt-4 space-y-3">
              {ads.map((ad) => (
                <article key={ad.id} className="overflow-hidden rounded-2xl border border-slate-200">
                  <img src={ad.imageUrl} alt={ad.title} className="h-28 w-full bg-slate-50 object-cover" />
                  <div className="space-y-2 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-black text-slate-900">{ad.title}</h4>
                      <span className={"shrink-0 rounded-lg px-2 py-1 text-[9px] font-black " + (ad.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500")}>{ad.status === "ACTIVE" ? "نشط" : "متوقف"}</span>
                    </div>
                    <p className="text-[10px] leading-5 text-slate-600">النشر: {ad.placement === "HOME_ONLY" ? "الغلاف الرئيسي" : ad.placement === "BUSINESS_COVER" ? "أغلفة أنشطة محددة" : "الرئيسي وأغلفة الأنشطة"}<br />المدة: {durationLabel(ad.duration)}<br />من {ad.startDate} إلى {ad.endDate}<br />النطاق: {ad.locationScope === "ALL" ? "كل الأماكن" : ad.locationValue}<br />السعر المسجل: {Number(ad.price || 0).toLocaleString("ar-EG")} ج.م</p>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => edit(ad)} className="flex-1 rounded-lg border border-slate-200 px-2 py-2 text-[10px] font-black text-slate-700 hover:bg-slate-50">تعديل</button>
                      <button type="button" disabled={saving} onClick={() => void remove(ad)} className="rounded-lg border border-rose-200 px-3 py-2 text-[10px] font-black text-rose-700 hover:bg-rose-50 disabled:opacity-50"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default CoverAdsManager;
