import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, ExternalLink, HelpCircle, Mail, MessageCircle, Phone, Send, ShieldCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';

type ContactKind = 'inquiry' | 'request' | 'complaint' | 'suggestion';

const CONTACT_KINDS: Array<{ id: ContactKind; label: string }> = [
  { id: 'inquiry', label: 'استفسار' },
  { id: 'request', label: 'طلب خدمة' },
  { id: 'complaint', label: 'شكوى' },
  { id: 'suggestion', label: 'مقترح' },
];

export const ContactUsView: React.FC = () => {
  const { adminSettings, authSession, setCurrentView } = useApp();
  const [senderName, setSenderName] = useState(authSession.subscriberName || '');
  const [senderPhone, setSenderPhone] = useState(authSession.userPhone || '');
  const [senderEmail, setSenderEmail] = useState(authSession.email || '');
  const [kind, setKind] = useState<ContactKind>('inquiry');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [whatsappUrl, setWhatsappUrl] = useState('');
  const adminDigits = String(adminSettings.adminWhatsApp || '').replace(/\\D/g, '');
  const adminPhone = adminDigits.startsWith('0') ? '20' + adminDigits.slice(1) : adminDigits;
  const directAdminWhatsAppUrl = adminPhone.length >= 10 ? 'https://wa.me/' + adminPhone : '';

  const buildWhatsAppUrl = () => {
    const digits = String(adminSettings.adminWhatsApp || '').replace(/\D/g, '');
    const phone = digits.startsWith('0') ? '20' + digits.slice(1) : digits;
    if (phone.length < 10) return '';
    const kindLabel = CONTACT_KINDS.find((item) => item.id === kind)?.label || 'رسالة';
    const body = [
      'رسالة جديدة عبر صفحة تواصل معنا — MantiqatiX',
      'نوع الرسالة: ' + kindLabel,
      'الاسم: ' + senderName.trim(),
      'الهاتف: ' + senderPhone.trim(),
      senderEmail.trim() ? 'البريد: ' + senderEmail.trim() : '',
      'الموضوع: ' + subject.trim(),
      'التفاصيل:',
      message.trim(),
    ].filter(Boolean).join('\n');
    return 'https://wa.me/' + phone + '?text=' + encodeURIComponent(body);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setWhatsappUrl('');
    if (!senderName.trim() || !senderPhone.trim() || !subject.trim() || !message.trim()) {
      setError('اكتب الاسم ورقم الهاتف والموضوع وتفاصيل الرسالة.');
      return;
    }
    const nextUrl = buildWhatsAppUrl();
    if (!nextUrl) {
      setError('رقم واتساب إدارة المنصة غير مضبوط حاليًا. استخدم وسيلة التواصل المباشرة المعروضة أسفل الصفحة.');
      return;
    }
    setWhatsappUrl(nextUrl);
  };

  return (
    <div dir="rtl" className="mx-auto w-full max-w-7xl space-y-7 px-4 py-7 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-3xl border border-emerald-900/20 bg-gradient-to-l from-emerald-950 via-teal-950 to-slate-950 p-6 text-white shadow-xl sm:p-10">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-xs font-black text-emerald-200">
              <MessageCircle className="h-4 w-4" /> بوابة التواصل والدعم
            </span>
            <h1 className="mt-3 text-2xl font-black leading-snug sm:text-3xl">تواصل مع إدارة MantiqatiX</h1>
            <p className="mt-2 text-sm leading-7 text-emerald-100">
              أرسل استفسارك أو طلبك أو مقترحك مباشرة إلى واتساب إدارة المنصة.
            </p>
          </div>
          <button type="button" onClick={() => setCurrentView('directory')} className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-xs font-black text-white hover:bg-white/15">
            <ArrowRight className="h-4 w-4" /> العودة للدليل
          </button>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-5 border-b border-slate-100 pb-4">
            <h2 className="text-lg font-black text-slate-900">نموذج التواصل</h2>
            <p className="mt-1 text-xs leading-6 text-slate-500">بعد تجهيز الرسالة ستفتح واتساب بنفسك لإرسالها.</p>
          </div>

          {error && <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-800">{error}</p>}

          {whatsappUrl ? (
            <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-700" />
              <h3 className="font-black text-emerald-950">الرسالة جاهزة للإرسال</h3>
              <p className="text-xs leading-6 text-emerald-900">اضغط الزر لفتح واتساب ومراجعة الرسالة ثم إرسالها. لم يتم حفظ الرسالة داخل الموقع.</p>
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-xs font-black text-white hover:bg-emerald-800">
                <MessageCircle className="h-4 w-4" /> فتح واتساب وإرسال الرسالة <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <button type="button" onClick={() => setWhatsappUrl('')} className="block mx-auto text-xs font-bold text-slate-600 underline">تعديل الرسالة</button>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <fieldset>
                <legend className="mb-2 text-xs font-black text-slate-700">نوع الرسالة</legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {CONTACT_KINDS.map((item) => (
                    <button key={item.id} type="button" aria-pressed={kind === item.id} onClick={() => setKind(item.id)} className={`min-h-10 rounded-xl border px-3 py-2 text-xs font-black transition ${kind === item.id ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
                      {item.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-bold text-slate-700">الاسم الكامل *
                  <input required value={senderName} onChange={(event) => setSenderName(event.target.value)} autoComplete="name" className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium outline-none focus:border-emerald-600" />
                </label>
                <label className="block text-xs font-bold text-slate-700">رقم الهاتف أو واتساب *
                  <input required type="tel" value={senderPhone} onChange={(event) => setSenderPhone(event.target.value)} dir="ltr" autoComplete="tel" className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-right outline-none focus:border-emerald-600" />
                </label>
              </div>
              <label className="block text-xs font-bold text-slate-700">البريد الإلكتروني (اختياري)
                <input type="email" value={senderEmail} onChange={(event) => setSenderEmail(event.target.value)} dir="ltr" autoComplete="email" className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-right outline-none focus:border-emerald-600" />
              </label>
              <label className="block text-xs font-bold text-slate-700">الموضوع *
                <input required value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={140} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium outline-none focus:border-emerald-600" />
              </label>
              <label className="block text-xs font-bold text-slate-700">تفاصيل الرسالة *
                <textarea required rows={6} value={message} onChange={(event) => setMessage(event.target.value)} maxLength={3000} className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium outline-none focus:border-emerald-600" />
              </label>
              <button type="submit" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-6 py-3 text-xs font-black text-white shadow-md hover:bg-emerald-800">
                <Send className="h-4 w-4" /> تجهيز الرسالة على واتساب
              </button>
            </form>
          )}
        </section>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-slate-900"><ShieldCheck className="h-5 w-5 text-emerald-700" /><h2 className="font-black">التواصل المباشر</h2></div>
            {directAdminWhatsAppUrl ? (
              <a href={directAdminWhatsAppUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800 hover:bg-emerald-100">
                <Phone className="h-4 w-4" /> واتساب الإدارة
              </a>
            ) : <p className="mt-3 text-xs text-slate-500">بيانات التواصل غير متاحة حاليًا.</p>}
            <p className="mt-3 text-[11px] leading-5 text-slate-500">لن يتم تخزين الرسالة داخل الموقع في هذه الصفحة. الإرسال يتم من خلال حساب واتساب الخاص بك.</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center gap-2 font-black text-slate-900"><HelpCircle className="h-5 w-5 text-indigo-600" /> قبل الإرسال</div>
            <p className="mt-2 text-xs leading-6 text-slate-600">راجع الاسم ورقم الهاتف والموضوع حتى تستطيع الإدارة الرجوع إليك.</p>
          </div>
        </aside>
      </div>
    </div>
  );
};
