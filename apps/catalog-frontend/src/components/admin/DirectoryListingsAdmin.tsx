import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardList, Edit, ExternalLink, Plus, RefreshCw, Save, Search, UserRoundCheck } from "lucide-react";
import type { ActivityCategory, Business, FunctionalGroup } from "../../types";
import { resolveCanonicalSpecialty } from "../../data/productionDefaults";
import {
  fetchDirectoryAdminBundle,
  importDoctorDirectoryBatch,
  reviewDirectoryClaim,
  saveDirectoryListing,
  type DirectoryAdminBundle,
  type PublicDirectoryListing,
  type DirectoryClaimRequest,
} from "../../lib/directoryListings";

type Props = { businesses: Business[]; categories: ActivityCategory[]; functionalGroups: FunctionalGroup[] };
type FormState = {
  id: string; displayName: string; slug: string; listingType: string; specialty: string;
  functionalGroupId: string; taxonomyCategoryId: string; taxonomySpecialty: string;
  phone: string; secondaryPhone: string; address: string; governorate: string; district: string;
  village: string; sourceName: string; sourceUrl: string; listingStatus: string;
  outreachStatus: string; outreachNotes: string; lastContactedAt: string; subscriptionOfferAt: string; nextFollowUpAt: string;
};
const outreachStatusLabels: Record<string, string> = { NEW: "لم يتم التواصل", CONTACTED: "تم التواصل", INTERESTED: "مهتم", OFFER_SENT: "تم عرض الاشتراك", FOLLOW_UP: "متابعة مطلوبة", SUBSCRIPTION_PENDING: "في انتظار الاشتراك", SUBSCRIBED: "مشترك", NOT_INTERESTED: "غير مهتم", CORRECTION_REQUESTED: "طلب تصحيح البيانات" };
const dateField = (value: string | null | undefined) => value ? value.slice(0, 10) : "";
const canonicalSpecialtyLabel = (value: string | null | undefined, categoryId: string, categories: ActivityCategory[]) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const category = categories.find((item) => item.id === categoryId);
  return category?.specialties?.find((candidate) =>
    resolveCanonicalSpecialty(candidate, categoryId) === resolveCanonicalSpecialty(raw, categoryId)
  ) || raw;
};

const emptyForm: FormState = {
  id: "", displayName: "", slug: "", listingType: "doctor", specialty: "",
  functionalGroupId: "medical_health", taxonomyCategoryId: "cat_medical_health_medical_practices", taxonomySpecialty: "", phone: "",
  secondaryPhone: "", address: "", governorate: "المنوفية", district: "بركة السبع",
  village: "", sourceName: "إدخال إدارة المنصة", sourceUrl: "", listingStatus: "DRAFT",
  outreachStatus: "NEW", outreachNotes: "", lastContactedAt: "", subscriptionOfferAt: "", nextFollowUpAt: "",
};

export const DirectoryListingsAdmin: React.FC<Props> = ({ businesses, categories, functionalGroups }) => {
  const [bundle, setBundle] = useState<DirectoryAdminBundle>({ listings: [], claims: [], businesses: [] });
  const [form, setForm] = useState<FormState>(emptyForm);
  const [search, setSearch] = useState("");
  const [activePane, setActivePane] = useState<"listings" | "claims">("listings");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ownershipVerified, setOwnershipVerified] = useState(false);
  const [claimBusinessIds, setClaimBusinessIds] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [batchJson, setBatchJson] = useState("");
  const [batchSummary, setBatchSummary] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setBundle(await fetchDirectoryAdminBundle());
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل دليل الصفحات وطلبات الاستلام.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const visibleListings = useMemo(() => bundle.listings.filter((x) =>
    [x.display_name, x.specialty, x.phone, x.address, x.district].some((v) => String(v || "").toLocaleLowerCase().includes(search.toLocaleLowerCase()))
  ), [bundle.listings, search]);
  const openRequests = bundle.claims.filter((x) => ["PENDING", "REVIEWING"].includes(x.status));
  const listingTypeOptions = form.functionalGroupId === "medical_health"
    ? [
        { value: "doctor", label: "ممارس طبي" },
        { value: "clinic", label: "عيادة / منشأة طبية" },
        { value: "pharmacy", label: "صيدلية" },
        { value: "medical_center", label: "مركز طبي" },
        { value: "hospital", label: "مستشفى" },
        { value: "laboratory", label: "معمل تحاليل" },
        { value: "health_provider", label: "مقدم خدمة صحية" },
        { value: "business", label: "نشاط صحي آخر" },
      ]
    : form.functionalGroupId === "agriculture_animals"
      ? [
          { value: "business", label: "نشاط / منشأة" },
          { value: "clinic", label: "عيادة بيطرية" },
        ]
      : [{ value: "business", label: "نشاط / منشأة" }];


  const editListing = (listing: PublicDirectoryListing) => {
    setForm({
      id: listing.id, displayName: listing.display_name, slug: listing.slug, listingType: listing.listing_type,
      functionalGroupId: listing.functional_group_id || "medical_health", taxonomyCategoryId: listing.taxonomy_category_id || "cat_medical_health_medical_practices", taxonomySpecialty: canonicalSpecialtyLabel(listing.taxonomy_specialty || listing.specialty, listing.taxonomy_category_id || "cat_medical_health_medical_practices", categories),
      specialty: listing.specialty || "", phone: listing.phone || "", secondaryPhone: listing.secondary_phone || "",
      address: listing.address || "", governorate: listing.governorate || "المنوفية", district: listing.district || "بركة السبع",
      village: listing.village || "", sourceName: listing.source_name || "", sourceUrl: listing.source_url || "",
      listingStatus: listing.listing_status || "DRAFT",
      outreachStatus: listing.outreach_status || "NEW", outreachNotes: listing.outreach_notes || "",
      lastContactedAt: dateField(listing.last_contacted_at), subscriptionOfferAt: dateField(listing.subscription_offer_at),
      nextFollowUpAt: dateField(listing.next_follow_up_at),
    });
    setActivePane("listings");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      await saveDirectoryListing({
        id: form.id || undefined, displayName: form.displayName, slug: form.slug || undefined,
        listingType: form.listingType, specialty: form.specialty, phone: form.phone,
        secondaryPhone: form.secondaryPhone, address: form.address, governorate: form.governorate,
        district: form.district, village: form.village, sourceName: form.sourceName,
        sourceUrl: form.sourceUrl, listingStatus: form.listingStatus,
        functionalGroupId: form.functionalGroupId, taxonomyCategoryId: form.taxonomyCategoryId, taxonomySpecialty: form.taxonomySpecialty,
        outreachStatus: form.outreachStatus, outreachNotes: form.outreachNotes,
        lastContactedAt: form.lastContactedAt, subscriptionOfferAt: form.subscriptionOfferAt, nextFollowUpAt: form.nextFollowUpAt,
        completeness: { name: Boolean(form.displayName.trim()), phone: Boolean(form.phone.trim() || form.secondaryPhone.trim()), specialty: Boolean(form.specialty.trim()), address: Boolean(form.address.trim()) },
      });
      setMessage(form.id ? "تم تحديث الصفحة." : "تم إنشاء الصفحة.");
      setForm(emptyForm);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر حفظ الصفحة.");
    } finally { setBusy(false); }
  };
  const handleDoctorBatchImport = async () => {
    setBusy(true); setError(""); setMessage(""); setBatchSummary("");
    try {
      const parsed = JSON.parse(batchJson);
      const rows = Array.isArray(parsed) ? parsed : parsed?.rows;
      if (!Array.isArray(rows)) throw new Error("أدخل مصفوفة JSON أو كائنًا يحتوي على rows.");
      const result = await importDoctorDirectoryBatch(rows);
      setBatchSummary(`تمت معالجة ${result.processed} طبيبًا: ${result.inserted} جديد، ${result.updated} تحديث، ${result.drafted} مسودة، ${result.failed} فشل.`);
      setMessage(result.failed ? "اكتمل الاستيراد مع وجود سجلات تحتاج مراجعة." : "تم حفظ دفعة الأطباء بنجاح.");
      setBatchJson("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر استيراد دفعة الأطباء.");
    } finally { setBusy(false); }
  };

  const handleReview = async (claim: DirectoryClaimRequest, decision: "REVIEWING" | "REJECTED" | "APPROVED") => {
    setBusy(true); setError(""); setMessage("");
    try {
      const linkedBusinessId = claimBusinessIds[claim.id] || "";
      const linkedBusiness = businesses.find((b) => b.id === linkedBusinessId);
      if (decision === "APPROVED") {
        if (!ownershipVerified) throw new Error("فعّل تأكيد التحقق من الهوية والملكية قبل الموافقة.");
        if (!linkedBusinessId) throw new Error("اختر النشاط المسجل الذي ستُنقل إليه الملكية.");
        if (!linkedBusiness || linkedBusiness.paymentStatus !== "paid" || !linkedBusiness.paymentConfirmedByAdmin) {
          throw new Error("لا يمكن التسليم قبل اختيار نشاط تم تأكيد اشتراكه المدفوع.");
        }
        if (linkedBusiness.isFrozen || linkedBusiness.operationalStatus !== "ACTIVE") throw new Error("النشاط المختار غير نشط تشغيليًا.");
      }
      await reviewDirectoryClaim({
        claimId: claim.id, decision, reviewNote: decision === "REJECTED" ? (window.prompt("سبب رفض طلب الاستلام (اختياري):") || "") : "",
        businessId: linkedBusinessId || undefined, ownershipVerified: decision === "APPROVED" && ownershipVerified,
        subscriptionPaid: decision === "APPROVED" && Boolean(linkedBusiness && linkedBusiness.paymentStatus === "paid" && linkedBusiness.paymentConfirmedByAdmin),
      });
      setMessage(decision === "APPROVED" ? "تم اعتماد المطالبة ونقل ملكية النشاط للحساب بعد التحقق من السداد." : decision === "REJECTED" ? "تم رفض الطلب وإعادة الصفحة لحالة غير مستلمة." : "تم تحويل الطلب إلى قيد المراجعة.");
      setOwnershipVerified(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحديث طلب الاستلام.");
    } finally { setBusy(false); }
  };

  return (
    <section className="space-y-5" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black text-slate-900"><ClipboardList className="h-6 w-6 text-emerald-700" /> دليل الأنشطة والمهن العامة</h2>
          <p className="mt-1 text-xs leading-6 text-slate-500">إضافة الصفحات الأولية واستكمال بياناتها ومراجعة طلبات استلام الملكية. لا يتم تفعيل مالك جديد إلا بعد إثبات الملكية والاشتراك المدفوع.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading || busy} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> تحديث البيانات</button>
      </div>
      {message && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-900">{message}</div>}
      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-900">{error}</div>}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setActivePane("listings")} className={`rounded-xl px-4 py-2 text-xs font-black ${activePane === "listings" ? "bg-emerald-700 text-white" : "border border-slate-200 bg-white text-slate-700"}`}>الصفحات ({bundle.listings.length})</button>
        <button type="button" onClick={() => setActivePane("claims")} className={`rounded-xl px-4 py-2 text-xs font-black ${activePane === "claims" ? "bg-emerald-700 text-white" : "border border-slate-200 bg-white text-slate-700"}`}>طلبات الاستلام ({openRequests.length} قيد المراجعة)</button>
      </div>

      {activePane === "listings" ? (
        <>
        <details className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4">
          <summary className="cursor-pointer text-sm font-black text-indigo-950">استيراد دفعة أطباء — حتى 20 طبيبًا</summary>
          <p className="mt-2 text-xs leading-6 text-indigo-900">الصق بيانات موثقة بصيغة JSON. كل سجل يُحفظ فور معالجته؛ التكرارات تُحدّث بدل إنشاء سجل جديد. الطبيب الذي لا يتوفر له رقم هاتف صحيح يُحفظ كمسودة للمراجعة.</p>
          <textarea value={batchJson} onChange={(e) => setBatchJson(e.target.value)} rows={8} dir="ltr" placeholder={'[{"displayName":"اسم الطبيب","specialty":"التخصص","governorate":"المحافظة","district":"المركز","taxonomyCategoryId":"cat_medical_health_doctor","phone":"01000000000","sourceName":"المصدر","sourceUrl":"https://...","sourcePermissionStatus":"LICENSED"}]'} className="mt-3 w-full rounded-xl border border-indigo-200 bg-white p-3 font-mono text-xs" />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" disabled={busy || !batchJson.trim()} onClick={() => void handleDoctorBatchImport()} className="rounded-xl bg-indigo-700 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50">{busy ? "جارٍ الاستيراد…" : "استيراد وحفظ الدفعة"}</button>
            {batchSummary && <span role="status" className="text-xs font-bold text-indigo-950">{batchSummary}</span>}
          </div>
        </details>
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,.8fr)]">
          <div className="space-y-3">
            <label className="relative block"><Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث باسم أو تخصص أو رقم" className="w-full rounded-xl border border-slate-200 bg-white py-3 pr-10 pl-3 text-sm" /></label>
            {loading ? <p className="p-6 text-center text-sm font-bold text-slate-500">جارٍ تحميل الصفحات…</p> : visibleListings.map((listing) => (
              <article key={listing.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="min-w-0"><h3 className="font-black text-slate-900">{listing.display_name}</h3><p className="mt-1 text-xs text-slate-600">{listing.specialty || "بدون تخصص مسجل"} • {listing.phone || "بدون هاتف"}</p><p className="mt-1 text-[11px] text-slate-500">{functionalGroups.find((group) => group.id === listing.functional_group_id)?.name || listing.functional_group_id} • {categories.find((category) => category.id === listing.taxonomy_category_id)?.name || listing.taxonomy_category_id}</p><p className="mt-1 text-[11px] text-slate-500">{listing.district} • النشر: {listing.listing_status} • الملكية: {listing.claim_status}</p><p className="mt-1 text-[11px] font-bold text-indigo-700">التواصل: {outreachStatusLabels[listing.outreach_status || "NEW"] || listing.outreach_status}</p>{listing.source_url && <a href={listing.source_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 underline">المصدر <ExternalLink className="h-3 w-3" /></a>}</div>
                <button type="button" onClick={() => editListing(listing)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"><Edit className="h-3.5 w-3.5" /> استكمال / تعديل</button>
              </article>
            ))}
          </div>
          <form onSubmit={handleSave} className="h-fit space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2"><h3 className="font-black text-slate-900">{form.id ? "استكمال بيانات الصفحة" : "إضافة صفحة جديدة"}</h3>{form.id && <button type="button" onClick={() => setForm(emptyForm)} className="text-xs font-bold text-slate-600 underline">جديد</button>}</div>
            <label className="block text-xs font-bold text-slate-700">اسم النشاط أو الجهة *<input required minLength={2} value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" /></label>
            <label className="block text-xs font-bold text-slate-700">الرابط المختصر (اختياري)<input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="يُنشأ تلقائيًا عند تركه فارغًا" dir="ltr" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-left" /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-bold text-slate-700">نوع الجهة<select value={form.listingType} onChange={(e) => setForm({ ...form, listingType: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-2 py-2.5 text-xs">{listingTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              <label className="block text-xs font-bold text-slate-700">حالة الظهور<select value={form.listingStatus} onChange={(e) => setForm({ ...form, listingStatus: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-2 py-2.5 text-xs"><option value="DRAFT">مسودة مخفية</option><option value="PUBLISHED">منشورة للزوار</option><option value="HIDDEN">إخفاء الصفحة</option></select></label>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-xs font-bold text-slate-700">المجموعة الوظيفية *<select required value={form.functionalGroupId} onChange={(e) => { const groupId = e.target.value; const firstCategory = categories.find((item) => item.functionalGroupId === groupId); setForm({ ...form, functionalGroupId: groupId, listingType: groupId === "medical_health" ? "doctor" : "business", taxonomyCategoryId: firstCategory?.id || "", taxonomySpecialty: "", specialty: "" }); }} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs">{functionalGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
              <label className="block text-xs font-bold text-slate-700">النشاط الرئيسي داخل المجموعة *<select required value={form.taxonomyCategoryId} onChange={(e) => setForm({ ...form, taxonomyCategoryId: e.target.value, taxonomySpecialty: "", specialty: "" })} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs">{categories.filter((item) => item.functionalGroupId === form.functionalGroupId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            </div>
            {Boolean(categories.find((item) => item.id === form.taxonomyCategoryId)?.specialties?.length) && <label className="block text-xs font-bold text-slate-700">التخصص / النوع الدقيق داخل التصنيف<select value={form.taxonomySpecialty} onChange={(e) => setForm({ ...form, taxonomySpecialty: e.target.value, specialty: e.target.value || form.specialty })} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs"><option value="">غير محدد — استكماله لاحقًا</option>{(categories.find((item) => item.id === form.taxonomyCategoryId)?.specialties || []).map((specialty) => <option key={specialty} value={specialty}>{specialty}</option>)}</select></label>}

            <label className="block text-xs font-bold text-slate-700">التخصص<input value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" /></label>
            <div className="grid grid-cols-2 gap-3"><label className="block text-xs font-bold text-slate-700">رقم الهاتف<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} dir="ltr" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-left" /></label><label className="block text-xs font-bold text-slate-700">رقم إضافي<input value={form.secondaryPhone} onChange={(e) => setForm({ ...form, secondaryPhone: e.target.value })} dir="ltr" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-left" /></label></div>
            <label className="block text-xs font-bold text-slate-700">العنوان<textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" /></label>
            <div className="grid grid-cols-2 gap-3"><label className="block text-xs font-bold text-slate-700">المحافظة<input value={form.governorate} onChange={(e) => setForm({ ...form, governorate: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" /></label><label className="block text-xs font-bold text-slate-700">المركز / المدينة<input value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" /></label></div>
            <label className="block text-xs font-bold text-slate-700">القرية / الحي<input value={form.village} onChange={(e) => setForm({ ...form, village: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" /></label>
            <label className="block text-xs font-bold text-slate-700">اسم مصدر البيانات<input value={form.sourceName} onChange={(e) => setForm({ ...form, sourceName: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" /></label>
            <label className="block text-xs font-bold text-slate-700">رابط المصدر<input type="url" value={form.sourceUrl} onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })} dir="ltr" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-left" /></label>
            <div className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/50 p-3">
              <div><h4 className="text-xs font-black text-indigo-950">متابعة التواصل وعرض الاشتراك</h4><p className="mt-1 text-[11px] leading-5 text-indigo-900">هذه متابعة داخلية لإدارة المنصة؛ لا ترسل رسالة تلقائيًا. افتح اتصال الهاتف للتواصل ثم سجّل النتيجة وتاريخ المتابعة.</p></div>
              <label className="block text-xs font-bold text-slate-700">حالة التواصل<select value={form.outreachStatus} onChange={(e) => setForm({ ...form, outreachStatus: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs">
                <option value="NEW">لم يتم التواصل</option><option value="CONTACTED">تم التواصل</option><option value="INTERESTED">مهتم</option><option value="OFFER_SENT">تم عرض الاشتراك</option><option value="FOLLOW_UP">متابعة مطلوبة</option><option value="SUBSCRIPTION_PENDING">في انتظار الاشتراك</option><option value="SUBSCRIBED">مشترك</option><option value="NOT_INTERESTED">غير مهتم</option><option value="CORRECTION_REQUESTED">طلب تصحيح البيانات</option>
              </select></label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="block text-xs font-bold text-slate-700">تاريخ التواصل<input type="date" value={form.lastContactedAt} onChange={(e) => setForm({ ...form, lastContactedAt: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-2 py-2.5 text-xs" /></label>
                <label className="block text-xs font-bold text-slate-700">تاريخ عرض الاشتراك<input type="date" value={form.subscriptionOfferAt} onChange={(e) => setForm({ ...form, subscriptionOfferAt: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-2 py-2.5 text-xs" /></label>
                <label className="block text-xs font-bold text-slate-700">موعد المتابعة<input type="date" value={form.nextFollowUpAt} onChange={(e) => setForm({ ...form, nextFollowUpAt: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-2 py-2.5 text-xs" /></label>
              </div>
              <label className="block text-xs font-bold text-slate-700">ملاحظات التواصل أو العرض<textarea value={form.outreachNotes} onChange={(e) => setForm({ ...form, outreachNotes: e.target.value })} rows={3} maxLength={3000} placeholder="النتيجة، السعر المعروض، من تواصل، وما المطلوب في المتابعة..." className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" /></label>
              {form.phone && <a href={`tel:${form.phone.replace(/[^0-9+]/g, "")}`} dir="ltr" className="inline-flex rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-black text-emerald-800">اتصال بـ {form.displayName || "النشاط"}</a>}
            </div>
            <button disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-black text-white disabled:opacity-50"><Save className="h-4 w-4" /> {busy ? "جارٍ الحفظ…" : "حفظ البيانات"}</button>
          </form>
        </div>
        </>
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-950"><AlertTriangle className="ml-1 inline h-4 w-4" /> قبل الاعتماد، تواصل مباشرة مع الطبيب أو العيادة وتحقق من الهوية والملكية. الموافقة لا تتم إلا بعد اختيار نشاط نشط تم تأكيد اشتراكه المدفوع.</div>
          {loading ? <p className="p-6 text-center text-sm font-bold text-slate-500">جارٍ تحميل طلبات الاستلام…</p> : openRequests.length === 0 ? <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">لا توجد طلبات استلام معلقة.</p> : openRequests.map((claim) => {
            const listing = bundle.listings.find((x) => x.id === claim.listing_id);
            const selectedBiz = businesses.find((b) => b.id === (claimBusinessIds[claim.id] || ""));
            const paid = Boolean(selectedBiz && selectedBiz.paymentStatus === "paid" && selectedBiz.paymentConfirmedByAdmin && !selectedBiz.isFrozen && selectedBiz.operationalStatus === "ACTIVE");
            return (
              <article key={claim.id} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-black text-slate-900">{listing?.display_name || "صفحة دليل"}</h3><p className="mt-1 text-xs text-slate-600">{claim.contact_name} • {claim.contact_phone} • {claim.contact_email || "بدون بريد"}</p><p className="mt-1 text-[11px] text-slate-500">الحالة: {claim.status} • الطلب: {new Date(claim.created_at).toLocaleDateString("ar-EG")}</p>{claim.evidence_note && <p className="mt-2 rounded-lg bg-slate-50 p-2 text-xs leading-5 text-slate-700">ملاحظات مقدم الطلب: {claim.evidence_note}</p>}</div><span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black text-amber-900">الملكية غير منقولة</span></div>
                <label className="block text-xs font-bold text-slate-700">النشاط المسجل الذي ستُنقل إليه الصفحة<select value={claimBusinessIds[claim.id] || ""} onChange={(e) => setClaimBusinessIds((previous) => ({ ...previous, [claim.id]: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-xs"><option value="">اختر النشاط</option>{businesses.map((business) => <option key={business.id} value={business.id}>{business.name} — {business.paymentStatus === "paid" && business.paymentConfirmedByAdmin ? "سداد مؤكد" : "لم يؤكد السداد"}</option>)}</select></label>
                <label className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-bold leading-5 text-slate-700"><input type="checkbox" checked={ownershipVerified} onChange={(e) => setOwnershipVerified(e.target.checked)} className="mt-0.5 accent-emerald-700" /><span>تحققت بنفسي من هوية مقدم الطلب وملكيته للنشاط عبر تواصل مباشر، وليس بمجرد امتلاكه رقم الهاتف فقط.</span></label>
                <p className={`text-xs font-bold ${paid ? "text-emerald-800" : "text-rose-700"}`}>{paid ? "السداد المسجل لهذا النشاط مؤكد." : "لا يمكن التسليم: اختر نشاطًا نشطًا وسداد اشتراكه المدفوع مؤكد."}</p>
                <div className="flex flex-wrap gap-2"><button type="button" disabled={busy || claim.status === "REVIEWING"} onClick={() => void handleReview(claim, "REVIEWING")} className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-black text-sky-900 disabled:opacity-50">بدء المراجعة</button><button type="button" disabled={busy} onClick={() => void handleReview(claim, "REJECTED")} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-900 disabled:opacity-50">رفض الطلب</button><button type="button" disabled={busy || !ownershipVerified || !paid} onClick={() => void handleReview(claim, "APPROVED")} className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-black text-white disabled:opacity-40"><UserRoundCheck className="h-3.5 w-3.5" /> اعتماد ونقل الملكية</button></div>
              </article>
            );
          })}
        </div>
      )}
      <p className="text-[11px] leading-6 text-slate-500"><CheckCircle2 className="ml-1 inline h-3.5 w-3.5 text-emerald-700" /> نقل الملكية يربط حساب صاحب الطلب بالنشاط المسجل ويعطّل تعيين المالك الافتراضي الآلي فقط. لا تُحذف صفحة الدليل أو تاريخ طلب المطالبة.</p>
    </section>
  );
};
