import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, BadgeCheck, Building2, CalendarClock, CheckCircle2, ClipboardList, ExternalLink, MapPin, Phone, Search, ShieldAlert, UserRoundCheck } from "lucide-react";
import { useApp } from "../context/AppContext";
import { fetchPublicDirectoryListings, submitDirectoryListingClaim, updateOwnedDirectoryListing, type PublicDirectoryListing } from "../lib/directoryListings";

function specialtyLabel(value: string | null | undefined) {
  const specialty = String(value || "").trim();
  return !specialty || specialty.includes("غير مؤكد") ? "التخصص يحتاج إلى تأكيد" : specialty;
}
function phoneHref(value: string | null | undefined) {
  const raw = String(value || "").trim();
  const dial = raw.replace(/[^0-9+]/g, "");
  return dial.length >= 7 ? "tel:" + dial : "";
}

export const DirectoryListingsView: React.FC<{
  detailSlug?: string;
  listingTypeFilter?: string | null;
  taxonomyCategoryId?: string | null;
  taxonomySpecialty?: string | null;
  onOpen: (slug: string) => void;
  onBack: () => void;
}> = ({ detailSlug, listingTypeFilter, taxonomyCategoryId, taxonomySpecialty, onOpen, onBack }) => {
  const { authSession, setIsLoginModalOpen, setSelectedBusinessId, setCurrentView } = useApp();
  const [listings, setListings] = useState<PublicDirectoryListing[]>([]);
  const [detail, setDetail] = useState<PublicDirectoryListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState("all");
  const [claimOpen, setClaimOpen] = useState(false);
  const [claimName, setClaimName] = useState(authSession.subscriberName || "");
  const [claimPhone, setClaimPhone] = useState("");
  const [claimNote, setClaimNote] = useState("");
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimMessage, setClaimMessage] = useState("");
  const [claimError, setClaimError] = useState("");
  const [ownerEditOpen, setOwnerEditOpen] = useState(false);
  const [ownerBusy, setOwnerBusy] = useState(false);
  const [ownerForm, setOwnerForm] = useState({
    displayName: "", specialty: "", phone: "", secondaryPhone: "", address: "",
    governorate: "المنوفية", district: "بركة السبع", village: "",
    bio: "", workingHours: "", websiteUrl: "", bookingUrl: "", services: "", socialLinks: "",
  });

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setLoadError("");
    const load = detailSlug
      ? fetchPublicDirectoryListings(detailSlug).then((record) => {
          if (alive) setDetail(record && !Array.isArray(record) ? record : null);
        })
      : fetchPublicDirectoryListings().then((records) => {
          if (alive) setListings(Array.isArray(records) ? records : []);
        });
    load.catch((error) => {
      if (alive) setLoadError(error instanceof Error ? error.message : "تعذر تحميل الدليل الطبي.");
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [detailSlug]);

  useEffect(() => {
    setClaimName(authSession.subscriberName || authSession.email || "");
  }, [authSession.subscriberName, authSession.email]);

  useEffect(() => { setSpecialtyFilter("all"); }, [listingTypeFilter, taxonomyCategoryId, taxonomySpecialty]);

  const taxonomyMatches = (listing: PublicDirectoryListing) => {
    const raw = String(listing.specialty || "").toLocaleLowerCase();
    const dental = /أسنان|اسنان|dentist|dental/.test(raw);
    const physio = /علاج طبيع|physio/.test(raw);
    if (listingTypeFilter && listing.listing_type !== listingTypeFilter) return false;
    if (taxonomyCategoryId === "doctor" && (dental || physio)) return false;
    if (taxonomyCategoryId === "dentist" && !dental) return false;
    if (taxonomyCategoryId === "radiology" && !/أشعة|اشعة|radiolog/.test(raw)) return false;
    if (taxonomyCategoryId === "physio_centers" && !physio) return false;
    if (taxonomySpecialty) {
      const aliases: Record<string, RegExp> = {
        "طبيب عيون": /عيون|رمد|ophthalm/,
        "طبيب قلب": /قلب|cardio/,
        "طبيب أطفال": /أطفال|اطفال|طفل|pediatr/,
        "طبيب باطنة": /باطن|داخلي|internal/,
        "طبيب عظام": /عظام|عظمي|orthop/,
        "طبيب جلدية": /جلد|dermat/,
        "طبيب مخ وأعصاب": /مخ|أعصاب|اعصاب|neuro/,
        "طبيب نفسي": /نفسي|psychiatr/,
        "طبيب أنف وأذن وحنجرة": /أنف|انف|أذن|اذن|حنجرة|حنجره|ent/,
        "طبيب نساء وتوليد": /نساء|توليد|obstet|gynae|gyn/,
        "طبيب مسالك بولية": /مسالك|بولية|urolog/,
        "طبيب صدر": /صدر|حساسية|مناعة|pulmon/,
        "طبيب جهاز هضمي": /هضمي|جهاز هضمي|gastro/,
        "طبيب كلى": /كلى|كلوي|nephro/,
        "طبيب أورام": /أورام|اورام|oncolo/,
        "طبيب جراحة عامة": /جراحة($|[^ تجميل])|surgeon/,
        "طبيب جراحة تجميل": /تجميل|plastic/,
        "طبيب روماتيزم": /روماتيزم|rheumat/,
        "طبيب غدد صماء": /غدد|صماء|endocrin/,
        "أسنان عام": /أسنان|اسنان|dentist|dental/,
        "تقويم الأسنان": /أسنان|اسنان|تقويم|dental/,
        "زراعة الأسنان": /أسنان|اسنان|زراعة|dental/,
        "علاج الجذور": /أسنان|اسنان|جذور|dental/,
        "جراحة الفم": /أسنان|اسنان|فم|dental/,
        "أسنان أطفال": /أسنان|اسنان|أطفال|اطفال|dental/,
        "تركيبات الأسنان": /أسنان|اسنان|تركيبات|dental/,
        "تجميل الأسنان": /أسنان|اسنان|تجميل|dental/,
        "علاج اللثة": /أسنان|اسنان|لثة|dental/,
      };
      const alias = aliases[taxonomySpecialty];
      if (alias) return alias.test(raw);
      const normalize = (value: string) => value.toLocaleLowerCase().replace(/[أإآ]/g, "ا").replace(/\s+/g, " ").trim();
      return normalize(raw).includes(normalize(taxonomySpecialty)) || normalize(taxonomySpecialty).includes(normalize(raw));
    }
    return true;
  };
  const inTaxonomyScope = useMemo(() => listings.filter(taxonomyMatches), [listings, listingTypeFilter, taxonomyCategoryId, taxonomySpecialty]);
  useEffect(() => {
    if (!detail) return;
    const meta = detail.metadata || {};
    const asText = (value: unknown) => typeof value === "string" ? value : "";
    const asList = (value: unknown) => Array.isArray(value) ? value.map((item) => String(item || "")).join("\n") : "";
    setOwnerForm({
      displayName: detail.display_name || "", specialty: detail.specialty || "",
      phone: detail.phone || "", secondaryPhone: detail.secondary_phone || "", address: detail.address || "",
      governorate: detail.governorate || "المنوفية", district: detail.district || "بركة السبع", village: detail.village || "",
      bio: asText(meta.bio), workingHours: asText(meta.workingHours), websiteUrl: asText(meta.websiteUrl),
      bookingUrl: asText(meta.bookingUrl), services: asList(meta.services), socialLinks: asList(meta.socialLinks),
    });
  }, [detail?.id, detail?.display_name, detail?.specialty, detail?.phone, detail?.secondary_phone, detail?.address, detail?.governorate, detail?.district, detail?.village, detail?.metadata]);

  const specialties = useMemo(() => Array.from(new Set(inTaxonomyScope.map((x) => specialtyLabel(x.specialty)))).sort((a, b) => a.localeCompare(b, "ar")), [inTaxonomyScope]);
  const filtered = useMemo(() => inTaxonomyScope.filter((x) => {
    const matchesSearch = [x.display_name, x.specialty, x.address, x.village].some((v) => String(v || "").toLocaleLowerCase().includes(search.toLocaleLowerCase()));
    const matchesSpecialty = specialtyFilter === "all" || specialtyLabel(x.specialty) === specialtyFilter;
    return matchesSearch && matchesSpecialty;
  }), [inTaxonomyScope, search, specialtyFilter]);

  const handleClaim = async (event: React.FormEvent) => {
    event.preventDefault();
    setClaimError("");
    setClaimMessage("");
    if (!authSession.isAuthenticated) {
      setClaimOpen(false);
      setIsLoginModalOpen(true);
      setClaimError("سجّل الدخول أولًا، ثم افتح الصفحة واطلب استلامها.");
      return;
    }
    if (!detail || claimName.trim().length < 2 || claimPhone.replace(/\D/g, "").length < 7) {
      setClaimError("اكتب الاسم ورقم هاتف صحيحًا.");
      return;
    }
    setClaimBusy(true);
    try {
      await submitDirectoryListingClaim({ listingId: detail.id, contactName: claimName.trim(), contactPhone: claimPhone.trim(), evidenceNote: claimNote.trim() });
      setClaimMessage("تم إرسال طلب استلام الصفحة. ستراجع إدارة المنصة الهوية والملكية والاشتراك قبل نقل الصلاحيات.");
      setClaimOpen(false);
      setDetail((previous) => previous ? { ...previous, claim_status: "CLAIM_PENDING" } : previous);
    } catch (error) {
      setClaimError(error instanceof Error ? error.message : "تعذر إرسال الطلب.");
    } finally {
      setClaimBusy(false);
    }
  };

  const handleOwnerUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!detail || !detail.can_edit) return;
    setOwnerBusy(true); setClaimError(""); setClaimMessage("");
    try {
      const saved = await updateOwnedDirectoryListing({ listingId: detail.id, ...ownerForm });
      setDetail(saved);
      setOwnerEditOpen(false);
      setClaimMessage("تم حفظ بيانات الصفحة. يمكنك العودة واستكمالها لاحقًا من حسابك.");
    } catch (error) {
      setClaimError(error instanceof Error ? error.message : "تعذر حفظ بيانات الصفحة.");
    } finally {
      setOwnerBusy(false);
    }
  };

  if (detailSlug) {
    if (loading) return <div className="mx-auto max-w-4xl p-8 text-center text-sm font-bold text-slate-600">جارٍ تحميل صفحة مقدم الخدمة…</div>;
    if (loadError || !detail) return <div className="mx-auto max-w-4xl p-5 sm:p-8" dir="rtl"><button type="button" onClick={onBack} className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-emerald-800"><ArrowRight className="h-4 w-4" /> العودة إلى الدليل</button><div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-bold text-amber-900">{loadError || "لم يتم العثور على الصفحة أو تم إخفاؤها."}</div></div>;

    const primaryHref = phoneHref(detail.phone);
    const secondaryHref = phoneHref(detail.secondary_phone);
    const claimed = detail.claim_status === "CLAIMED";
    const pending = detail.claim_status === "CLAIM_PENDING";
    return (
      <section className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10" dir="rtl">
        <button type="button" onClick={onBack} className="mb-5 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"><ArrowRight className="h-4 w-4" /> العودة إلى دليل مقدمي الخدمة</button>
        <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-l from-slate-950 via-emerald-950 to-slate-900 px-5 py-8 text-white sm:px-8">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10"><Building2 className="h-7 w-7 text-emerald-300" /></div>
            <div className={`mb-2 inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-black ${claimed ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200" : pending ? "border-sky-300/30 bg-sky-400/10 text-sky-200" : "border-amber-300/30 bg-amber-400/10 text-amber-200"}`}>{claimed ? <BadgeCheck className="h-3.5 w-3.5" /> : pending ? <CalendarClock className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />} {claimed ? "صفحة مستلمة بعد المراجعة" : pending ? "طلب الاستلام قيد المراجعة" : "صفحة دليل أولية — غير مستلمة"}</div>
            <h1 className="text-2xl font-black sm:text-3xl">{detail.display_name}</h1>
            <p className="mt-2 text-sm font-semibold text-emerald-100">{specialtyLabel(detail.specialty)}</p>
            <p className="mt-1 text-xs text-slate-300">{detail.district}، {detail.governorate}</p>
          </div>
          <div className="space-y-5 p-5 sm:p-8">
            {!claimed && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-950">
              هذه الصفحة أُنشئت اعتمادًا على بيانات اتصال منشورة في دليل عام. لم نتحقق حتى الآن من حداثة الرقم أو موافقة الطبيب على امتلاك الصفحة. يمكنك طلب استلامها، أو طلب تصحيح بياناتها.
            </div>}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {detail.phone && <div className="rounded-xl border border-slate-200 p-4"><div className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-500"><Phone className="h-4 w-4" /> رقم الهاتف المنشور</div>{primaryHref ? <a href={primaryHref} dir="ltr" className="inline-block text-lg font-black text-emerald-800 underline underline-offset-4">{detail.phone}</a> : <span dir="ltr" className="font-black">{detail.phone}</span>}</div>}
              {detail.secondary_phone && <div className="rounded-xl border border-slate-200 p-4"><div className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-500"><Phone className="h-4 w-4" /> رقم إضافي في المصدر</div>{secondaryHref ? <a href={secondaryHref} dir="ltr" className="inline-block text-lg font-black text-emerald-800 underline underline-offset-4">{detail.secondary_phone}</a> : <span dir="ltr" className="font-black">{detail.secondary_phone}</span>}</div>}
              <div className="rounded-xl border border-slate-200 p-4 sm:col-span-2"><div className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-500"><MapPin className="h-4 w-4" /> العنوان المسجل بالمصدر</div><p className="text-sm font-bold text-slate-800">{detail.address || "لم يُسجّل عنوان تفصيلي بعد"}</p></div>
            </div>
            {typeof detail.metadata?.bio === "string" && detail.metadata.bio.trim() && <div className="rounded-xl bg-slate-50 p-4"><h2 className="mb-2 text-sm font-black text-slate-900">نبذة</h2><p className="whitespace-pre-line text-sm leading-7 text-slate-700">{detail.metadata.bio}</p></div>}
            {typeof detail.metadata?.workingHours === "string" && detail.metadata.workingHours.trim() && <div className="rounded-xl border border-slate-200 p-4"><h2 className="mb-1 text-xs font-black text-slate-700">مواعيد العمل</h2><p className="whitespace-pre-line text-sm text-slate-800">{detail.metadata.workingHours}</p></div>}
            {Array.isArray(detail.metadata?.services) && detail.metadata.services.length > 0 && <div className="rounded-xl border border-slate-200 p-4"><h2 className="mb-2 text-xs font-black text-slate-700">الخدمات</h2><div className="flex flex-wrap gap-2">{detail.metadata.services.map((value, i) => <span key={i} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-900">{String(value)}</span>)}</div></div>}
            {typeof detail.metadata?.websiteUrl === "string" && /^https?:\/\//i.test(detail.metadata.websiteUrl) && <a href={detail.metadata.websiteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-bold text-emerald-800 underline">الموقع الإلكتروني <ExternalLink className="h-4 w-4" /></a>}
            {detail.can_edit && detail.owned_business_id && <button type="button" onClick={() => { setSelectedBusinessId(detail.owned_business_id as string); setCurrentView("merchant_admin"); }} className="mb-3 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-black text-white hover:bg-slate-800"><Building2 className="h-4 w-4" /> فتح لوحة النشاط والكتالوج</button>}
            {detail.can_edit && <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-black text-emerald-950">إدارة صفحتك</h2><p className="mt-1 text-xs text-emerald-900">يمكنك الآن استكمال بيانات الصفحة بنفسك. ستظل صلاحياتك محصورة في هذه الصفحة والنشاط المرتبط بها.</p></div><button type="button" onClick={() => setOwnerEditOpen((value) => !value)} className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-black text-white">{ownerEditOpen ? "إغلاق التعديل" : "تعديل واستكمال البيانات"}</button></div>
              {ownerEditOpen && <form onSubmit={handleOwnerUpdate} className="space-y-3">
                <label className="block text-xs font-bold text-slate-700">الاسم المعروض<input required minLength={2} value={ownerForm.displayName} onChange={(e) => setOwnerForm({ ...ownerForm, displayName: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" /></label>
                <label className="block text-xs font-bold text-slate-700">التخصص<input value={ownerForm.specialty} onChange={(e) => setOwnerForm({ ...ownerForm, specialty: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" /></label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="block text-xs font-bold text-slate-700">رقم التواصل الأساسي<input type="tel" value={ownerForm.phone} onChange={(e) => setOwnerForm({ ...ownerForm, phone: e.target.value })} dir="ltr" className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-left" /></label><label className="block text-xs font-bold text-slate-700">رقم إضافي<input type="tel" value={ownerForm.secondaryPhone} onChange={(e) => setOwnerForm({ ...ownerForm, secondaryPhone: e.target.value })} dir="ltr" className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-left" /></label></div>
                <label className="block text-xs font-bold text-slate-700">العنوان<input value={ownerForm.address} onChange={(e) => setOwnerForm({ ...ownerForm, address: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" /></label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><label className="block text-xs font-bold text-slate-700">المحافظة<input value={ownerForm.governorate} onChange={(e) => setOwnerForm({ ...ownerForm, governorate: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" /></label><label className="block text-xs font-bold text-slate-700">المركز<input value={ownerForm.district} onChange={(e) => setOwnerForm({ ...ownerForm, district: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" /></label><label className="block text-xs font-bold text-slate-700">القرية / الحي<input value={ownerForm.village} onChange={(e) => setOwnerForm({ ...ownerForm, village: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" /></label></div>
                <label className="block text-xs font-bold text-slate-700">نبذة عن العيادة / الخدمات<textarea rows={3} value={ownerForm.bio} onChange={(e) => setOwnerForm({ ...ownerForm, bio: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" /></label>
                <label className="block text-xs font-bold text-slate-700">مواعيد العمل<textarea rows={2} value={ownerForm.workingHours} onChange={(e) => setOwnerForm({ ...ownerForm, workingHours: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" /></label>
                <label className="block text-xs font-bold text-slate-700">الخدمات (كل خدمة في سطر)<textarea rows={3} value={ownerForm.services} onChange={(e) => setOwnerForm({ ...ownerForm, services: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" /></label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="block text-xs font-bold text-slate-700">الموقع الإلكتروني<input type="url" value={ownerForm.websiteUrl} onChange={(e) => setOwnerForm({ ...ownerForm, websiteUrl: e.target.value })} dir="ltr" className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-left" /></label><label className="block text-xs font-bold text-slate-700">رابط الحجز<input type="url" value={ownerForm.bookingUrl} onChange={(e) => setOwnerForm({ ...ownerForm, bookingUrl: e.target.value })} dir="ltr" className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-left" /></label></div>
                <label className="block text-xs font-bold text-slate-700">روابط التواصل (كل رابط في سطر)<textarea rows={3} value={ownerForm.socialLinks} onChange={(e) => setOwnerForm({ ...ownerForm, socialLinks: e.target.value })} placeholder="https://..." dir="ltr" className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-left" /></label>
                <button disabled={ownerBusy} className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white disabled:opacity-50">{ownerBusy ? "جارٍ الحفظ…" : "حفظ التعديلات"}</button>
              </form>}
            </div>}
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500"><CalendarClock className="h-3.5 w-3.5" /> آخر مراجعة للمصدر: {new Date(detail.source_checked_at).toLocaleDateString("ar-EG")} <span>•</span><span>المصدر: {detail.source_name}</span>{detail.source_url && <a href={detail.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-bold text-emerald-800 underline">فتح المصدر <ExternalLink className="h-3 w-3" /></a>}</div>
            {claimMessage && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold leading-6 text-emerald-900">{claimMessage}</div>}
            {claimError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-800">{claimError}</div>}
            {claimed ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-900"><BadgeCheck className="ml-2 inline h-4 w-4" /> تم استلام الصفحة والتحقق منها. {detail.can_edit ? "يمكنك استكمال بياناتك من قسم إدارة الصفحة أعلاه." : "حالة الاستلام مسجلة، وإذا كنت المالك الجديد ولم يظهر لك التعديل تواصل مع إدارة المنصة."}</div>
            ) : pending ? (
              <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm font-bold text-sky-900"><CalendarClock className="ml-2 inline h-4 w-4" /> يوجد طلب استلام قيد المراجعة لهذه الصفحة.</div>
            ) : !claimOpen ? (
              <button type="button" onClick={() => { if (!authSession.isAuthenticated) { setIsLoginModalOpen(true); setClaimError("سجّل الدخول بحسابك أولًا، ثم ارجع إلى هذه الصفحة."); return; } setClaimOpen(true); }} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3.5 text-sm font-black text-white hover:bg-emerald-800 sm:w-auto"><UserRoundCheck className="h-4 w-4" /> أنا صاحب النشاط — اطلب استلام الصفحة</button>
            ) : (
              <form onSubmit={handleClaim} className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
                <h2 className="font-black text-slate-900">طلب استلام صفحة النشاط</h2>
                <p className="text-xs leading-6 text-slate-600">إرسال الطلب لا ينقل الملكية تلقائيًا. سيُطلب من الإدارة التحقق من أنك صاحب النشاط، ثم ربط الصفحة بحساب النشاط بعد تأكيد الاشتراك المدفوع.</p>
                <label className="block text-xs font-bold text-slate-700">الاسم الكامل<input required minLength={2} value={claimName} onChange={(e) => setClaimName(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" /></label>
                <label className="block text-xs font-bold text-slate-700">رقم للتواصل معك<input required type="tel" value={claimPhone} onChange={(e) => setClaimPhone(e.target.value)} dir="ltr" placeholder="01xxxxxxxxx" className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-left" /></label>
                <label className="block text-xs font-bold text-slate-700">معلومة تساعد في إثبات ملكية العيادة (اختياري)<textarea value={claimNote} onChange={(e) => setClaimNote(e.target.value)} maxLength={1200} rows={3} placeholder="مثال: الاسم المسجل على اللافتة أو موعد مناسب للاتصال" className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" /></label>
                <div className="flex flex-wrap gap-2"><button disabled={claimBusy} className="rounded-xl bg-emerald-700 px-5 py-2.5 text-xs font-black text-white disabled:opacity-50">{claimBusy ? "جارٍ الإرسال…" : "إرسال طلب الاستلام"}</button><button type="button" onClick={() => setClaimOpen(false)} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700">إلغاء</button></div>
              </form>
            )}
          </div>
        </article>
      </section>
    );
  }

  const allReady = listings.length > 0;
  return (
    <section aria-label="دليل الأطباء في بركة السبع" className="space-y-5 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black text-slate-900"><Building2 className="h-5 w-5 text-emerald-700" /> {taxonomyCategoryId === "pharmacies" ? "دليل الصيدليات" : taxonomyCategoryId === "clinics" ? "دليل العيادات الطبية" : taxonomyCategoryId === "hospitals" ? "دليل المستشفيات" : taxonomyCategoryId === "labs" ? "دليل معامل التحاليل" : taxonomyCategoryId === "dentist" ? "دليل أطباء الأسنان" : taxonomyCategoryId === "doctor" ? "دليل الأطباء" : "الدليل الطبي في بركة السبع"}</h2>
          <p className="mt-1 text-xs leading-6 text-slate-500">الصفحات معروضة داخل التصنيف الطبي المختار. بيانات المصدر أولية وقابلة للاستكمال والتصحيح والمطالبة بالملكية بعد التحقق.</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-800">{inTaxonomyScope.length} صفحة في التصنيف</span>
      </div>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-6 text-amber-950">ملاحظة: الأسماء والأرقام مأخوذة من أدلة عامة وليست تأكيدًا من الأطباء. قبل التواصل أو الاعتماد، يُرجى التأكد من أن الرقم ما زال صحيحًا وأنه يخص العيادة.</div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="relative block"><Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث باسم الطبيب أو العنوان" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pr-10 pl-3 text-sm" /></label>
        {!taxonomySpecialty && <select value={specialtyFilter} onChange={(e) => setSpecialtyFilter(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-bold"><option value="all">كل التخصصات</option>{specialties.map((specialty) => <option key={specialty} value={specialty}>{specialty}</option>)}</select>}
      </div>
      {loading ? <div className="py-6 text-center text-sm font-bold text-slate-600">جارٍ تحميل صفحات الأطباء…</div> :
        loadError ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800">{loadError}</div> :
        !allReady ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">لم تتم إضافة صفحات بعد.</div> :
        inTaxonomyScope.length === 0 ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm leading-6 text-slate-700">لا توجد صفحات مسجلة في هذا التصنيف حتى الآن. يمكن لإدارة المنصة إضافتها من لوحة «دليل الأنشطة والمطالبات» قبل عرض الاشتراك على أصحابها.</div> :
        filtered.length ? <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((listing) => (
            <article key={listing.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-emerald-300 hover:shadow-sm">
              <div className="flex items-start justify-between gap-2"><div><h3 className="font-black text-slate-900">{listing.display_name}</h3><p className="mt-1 text-xs font-semibold text-emerald-800">{specialtyLabel(listing.specialty)}</p></div><span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-900">غير معتمدة</span></div>
              <p className="mt-3 line-clamp-2 text-xs leading-6 text-slate-600"><MapPin className="ml-1 inline h-3.5 w-3.5 text-slate-400" />{listing.address || listing.district}</p>
              {listing.phone && <p className="mt-2 text-sm font-bold text-slate-800" dir="ltr">{listing.phone}</p>}
              <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
                <button type="button" onClick={() => onOpen(listing.slug)} className="flex-1 rounded-xl bg-slate-900 px-3 py-2.5 text-xs font-black text-white hover:bg-slate-800">عرض صفحة الطبيب</button>
                {phoneHref(listing.phone) && <a href={phoneHref(listing.phone)} aria-label={"اتصال بـ "+listing.display_name} className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-black text-emerald-900"><Phone className="h-3.5 w-3.5" /> اتصال</a>}
              </div>
            </article>
          ))}
        </div> : <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">لا توجد نتائج مطابقة للبحث.</div>}
      <div className="flex items-start gap-2 border-t border-slate-100 pt-4 text-xs leading-6 text-slate-500"><ClipboardList className="mt-0.5 h-4 w-4 shrink-0" /><p>كل صفحة يمكن استكمالها لاحقًا بالصور والمواعيد والخدمات ووسائل التواصل. لا يتم نقل ملكية الصفحة أو تفعيل صلاحيات المالك بمجرد إنشاء القائمة.</p></div>
    </section>
  );
};
