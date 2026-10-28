import React, { useState } from "react";
import { useApp } from "../../context/AppContext";
import { supabase } from "../../lib/production";
import { normalizeWhatsAppPhone } from "../../utils/socialLinks";
import { Calendar, MapPin, MessageCircle, Send } from "lucide-react";

type Duration = "MONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL";
type Placement = "BUSINESS_COVER" | "HOME_ONLY" | "BOTH";
type LocationScope = "CITY" | "GOVERNORATE" | "ALL";

const durationLabels: Record<Duration, string> = {
  MONTHLY: "شهري",
  QUARTERLY: "ربع سنوي — 3 أشهر",
  SEMIANNUAL: "نصف سنوي — 6 أشهر",
  ANNUAL: "سنوي — 12 شهرًا",
};
const placementLabels: Record<Placement, string> = {
  BUSINESS_COVER: "غلاف نشاطي",
  HOME_ONLY: "الغلاف الرئيسي للموقع",
  BOTH: "الغلاف الرئيسي وغلاف نشاطي",
};

const CoverAdBookingRequest: React.FC = () => {
  const { currentBusiness, authSession, adminSettings } = useApp();
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState<Duration>("MONTHLY");
  const [placement, setPlacement] = useState<Placement>("BUSINESS_COVER");
  const [locationScope, setLocationScope] = useState<LocationScope>("CITY");
  const [locationValue, setLocationValue] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [whatsAppUrl, setWhatsAppUrl] = useState("");

  if (!currentBusiness || authSession.role !== "subscriber" || authSession.businessId !== currentBusiness.id) return null;

  const adminPhone = normalizeWhatsAppPhone(adminSettings.adminWhatsApp);
  const defaultLocation = locationScope === "GOVERNORATE"
    ? currentBusiness.governorate
    : [currentBusiness.markaz, currentBusiness.village].filter(Boolean).join(" — ");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (title.trim().length < 3) {
      setFeedback({ type: "error", text: "اكتب عنوان الإعلان المطلوب." });
      return;
    }
    if (locationScope !== "ALL" && !locationValue.trim() && !defaultLocation.trim()) {
      setFeedback({ type: "error", text: "حدد البلدة أو المحافظة التي تريد استهدافها." });
      return;
    }
    if (targetUrl.trim() && !/^https:\/\//i.test(targetUrl.trim())) {
      setFeedback({ type: "error", text: "رابط الإعلان يجب أن يبدأ بـ https://." });
      return;
    }

    const selectedLocation = locationScope === "ALL"
      ? "كل الأماكن"
      : locationValue.trim() || defaultLocation;
    const areaLabel = locationScope === "ALL" ? "كل الأماكن" : locationScope === "GOVERNORATE" ? "محافظة" : "بلدة / مركز / حي";
    const description = [
      "طلب حجز مساحة إعلانية على MantiqatiX",
      "النشاط: " + currentBusiness.name,
      "عنوان الإعلان: " + title.trim(),
      "مدة الحجز المطلوبة: " + durationLabels[duration],
      "مكان النشر: " + placementLabels[placement],
      "الاستهداف الجغرافي: " + areaLabel + " — " + selectedLocation,
      "رابط الوجهة: " + (targetUrl.trim() || "لم يحدد"),
      "ملاحظات: " + (notes.trim() || "لا توجد"),
      "الطلب للمراجعة والتسعير والاعتماد من الإدارة. لا يعني هذا الطلب تفعيل إعلان أو تحصيل أي رسوم.",
    ].join("\n");
    const whatsAppMessage = "طلب حجز إعلان جديد على MantiqatiX\n" + description;

    // Open a blank tab during the user's click so popup blockers do not prevent the
    // post-save WhatsApp handoff; the request is saved before the tab navigates.
    const whatsAppWindow = adminPhone ? window.open("about:blank", "_blank") : null;
    if (whatsAppWindow) whatsAppWindow.opener = null;
    setBusy(true);
    setFeedback(null);
    setWhatsAppUrl("");
    try {
      const { data, error } = await supabase.functions.invoke("cover-ad-booking-request", {
        body: {
          businessId: currentBusiness.id,
          title: title.trim(),
          duration,
          placement,
          locationScope,
          locationValue: locationScope === "ALL" ? "" : selectedLocation,
          targetUrl: targetUrl.trim(),
          notes: notes.trim(),
        },
      });
      if (error || data?.error || data?.ok === false) {
        if (whatsAppWindow) whatsAppWindow.close();
        throw new Error(data?.message || data?.error || error?.message || "تعذر إرسال الطلب إلى الإدارة.");
      }
      setFeedback({ type: "success", text: "تم تسجيل طلبك لدى الإدارة. لن يتم عرض الإعلان قبل المراجعة والاتفاق." });
      const url = adminPhone ? "https://wa.me/" + adminPhone + "?text=" + encodeURIComponent(whatsAppMessage) : "";
      setWhatsAppUrl(url);
      if (whatsAppWindow && url) {
        whatsAppWindow.location.href = url;
      } else if (whatsAppWindow) {
        whatsAppWindow.close();
      }
      setTitle("");
      setTargetUrl("");
      setNotes("");
      setLocationValue("");
    } catch (error) {
      setFeedback({ type: "error", text: error instanceof Error ? error.message : "تعذر إرسال الطلب إلى الإدارة." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-4 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-red-200 bg-gradient-to-l from-red-50 via-white to-amber-50 p-4 shadow-sm">
        <button
          type="button"
          onClick={() => { setExpanded((value) => !value); setFeedback(null); }}
          className="flex w-full items-center justify-between gap-3 text-right"
        >
          <span className="flex items-center gap-3">
            <span className="rounded-xl bg-red-600 p-2.5 text-white"><Calendar className="h-5 w-5" /></span>
            <span>
              <span className="block text-sm font-black text-slate-900">اطلب حجز إعلان على غلاف نشاطك</span>
              <span className="mt-1 block text-[11px] leading-5 text-slate-600">اختَر مدة الحجز ومكان العرض، وسيصل طلبك إلى الإدارة للمراجعة.</span>
            </span>
          </span>
          <span className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-black text-red-700">{expanded ? "إغلاق" : "تقديم طلب"}</span>
        </button>

        {expanded && (
          <form onSubmit={submit} className="mt-4 space-y-4 border-t border-red-100 pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs font-bold text-slate-700">عنوان الإعلان أو العرض</span>
                <input required minLength={3} maxLength={180} value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs" placeholder="مثال: خصم خاص على منتجات قدم السعد" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-slate-700">مدة الحجز</span>
                <select value={duration} onChange={(e) => setDuration(e.target.value as Duration)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs">
                  <option value="MONTHLY">شهري</option>
                  <option value="QUARTERLY">ربع سنوي — 3 أشهر</option>
                  <option value="SEMIANNUAL">نصف سنوي — 6 أشهر</option>
                  <option value="ANNUAL">سنوي — 12 شهرًا</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-slate-700">مكان النشر المطلوب</span>
                <select value={placement} onChange={(e) => setPlacement(e.target.value as Placement)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs">
                  <option value="BUSINESS_COVER">غلاف نشاطي</option>
                  <option value="HOME_ONLY">الغلاف الرئيسي للموقع</option>
                  <option value="BOTH">الغلاف الرئيسي وغلاف نشاطي</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-slate-700">نطاق العرض الجغرافي</span>
                <select value={locationScope} onChange={(e) => { setLocationScope(e.target.value as LocationScope); setLocationValue(""); }} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs">
                  <option value="CITY">بلدة / مركز / حي</option>
                  <option value="GOVERNORATE">محافظة</option>
                  <option value="ALL">كل الأماكن</option>
                </select>
              </label>
              {locationScope !== "ALL" && (
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-slate-700">الموقع المستهدف</span>
                  <input value={locationValue} onChange={(e) => setLocationValue(e.target.value)} placeholder={defaultLocation || "اكتب الموقع المستهدف"} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs" />
                  <span className="mt-1 block text-[10px] text-slate-500">الافتراضي من عنوان النشاط: {defaultLocation || "غير مسجل"}</span>
                </label>
              )}
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs font-bold text-slate-700">رابط الصفحة أو المنتج المراد الترويج له (اختياري)</span>
                <input type="url" value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} placeholder="https://..." dir="ltr" className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs" />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs font-bold text-slate-700">ملاحظات للإدارة (اختياري)</span>
                <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs" placeholder="الرسالة الإعلانية أو أي متطلبات خاصة" />
              </label>
            </div>

            {feedback && (
              <div role="status" className={"rounded-xl border px-3 py-2.5 text-xs font-bold " + (feedback.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800")}>
                {feedback.text}
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[10px] leading-5 text-slate-500">تقديم الطلب مجاني ولا ينشئ إعلانًا منشورًا أو رسومًا. يتم اعتماد العرض وسعره من الإدارة.</p>
              <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-xs font-black text-white shadow-md hover:bg-red-700 disabled:opacity-50">
                <Send className="h-4 w-4" />{busy ? "جارٍ إرسال الطلب..." : "إرسال الطلب للإدارة"}
              </button>
            </div>
            {whatsAppUrl && (
              <a href={whatsAppUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-black text-emerald-800">
                <MessageCircle className="h-4 w-4" /> متابعة الطلب عبر واتساب الإدارة
              </a>
            )}
          </form>
        )}
      </div>
    </section>
  );
};

export default CoverAdBookingRequest;
