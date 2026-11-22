import React, { useEffect, useMemo, useState } from 'react';
import { Copy, Facebook, Link2, MessageCircle, Send, Share2 } from 'lucide-react';
import { supabase, isReferralSharingEnabled } from '../../lib/production';
import { buildReferralInviteUrl } from '../../utils/referrals';

type ReferralProfile = { code?: string; referralsCount?: number };

export const ReferralInviteCard: React.FC<{ userId?: string }> = ({ userId }) => {
  const [profile, setProfile] = useState<ReferralProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);

  const inviteUrl = useMemo(() => {
    if (!profile?.code) return '';
    return buildReferralInviteUrl(profile.code, window.location.origin, import.meta.env.BASE_URL || '/') || '';
  }, [profile?.code]);

  useEffect(() => {
    let active = true;
    if (!isReferralSharingEnabled || !userId) {
      setLoading(false);
      return () => { active = false; };
    }

    void (async () => {
      try {
        const { data, error } = await supabase.rpc('get_or_create_my_referral_profile');
        if (!active) return;
        if (error || !data || typeof data.code !== 'string') {
          setLoadFailed(true);
          setProfile(null);
          return;
        }
        setProfile({
          code: data.code,
          referralsCount: Number.isFinite(Number(data.referralsCount)) ? Number(data.referralsCount) : 0,
        });
      } catch {
        if (active) setLoadFailed(true);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => { active = false; };
  }, [userId]);

  if (!isReferralSharingEnabled || !userId) return null;

  const message = 'صديقك يدعوك لتجربة MantiqatiX — اكتشف الخدمات والأنشطة ومقدمي الخدمة من مكان واحد.';
  const encodedUrl = encodeURIComponent(inviteUrl);
  const encodedMessage = encodeURIComponent(message + ' ' + inviteUrl);

  const copyInvite = async (): Promise<void> => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setStatus('تم نسخ رابط الدعوة.');
    } catch {
      setStatus('تعذر النسخ التلقائي. حدد الرابط وانسخه يدوياً.');
    }
  };

  const shareInvite = async (): Promise<void> => {
    if (!inviteUrl) return;
    const shareApi = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
    if (shareApi.share) {
      try {
        await shareApi.share({ title: 'دعوة إلى MantiqatiX', text: message, url: inviteUrl });
        setStatus('تم فتح قائمة المشاركة.');
        return;
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
      }
    }
    await copyInvite();
  };

  return (
    <section dir="rtl" aria-labelledby="referral-invite-title" className="mt-5 rounded-2xl border border-blue-100 bg-gradient-to-br from-white to-blue-50 p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700"><Share2 className="h-5 w-5" /></span>
        <div className="min-w-0">
          <p className="text-[11px] font-black tracking-wide text-blue-700">INVITE FRIENDS</p>
          <h3 id="referral-invite-title" className="mt-1 text-lg font-black text-slate-900">ادعُ أصدقاءك إلى MantiqatiX</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">شارك رابطك الشخصي. تُسجّل الإحالة بعد إنشاء الحساب وتسجيل الدخول بنجاح.</p>
        </div>
      </div>

      {loading ? (
        <p role="status" className="mt-5 text-sm text-slate-500">جارٍ تجهيز رابط الدعوة…</p>
      ) : loadFailed ? (
        <p role="status" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">خدمة الدعوات غير متاحة حالياً. لم يتم إنشاء رابط غير مؤكد.</p>
      ) : profile && inviteUrl ? (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <strong className="block text-2xl font-black text-blue-700">{profile.referralsCount ?? 0}</strong>
              <span className="text-xs text-slate-500">إحالات مسجلة</span>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <strong dir="ltr" className="block break-all text-lg font-black tracking-wider text-slate-900">{profile.code}</strong>
              <span className="text-xs text-slate-500">كود الدعوة الشخصي</span>
            </div>
          </div>

          <label htmlFor="mnty-referral-link" className="mt-4 block text-xs font-bold text-slate-600">رابط الدعوة</label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input id="mnty-referral-link" readOnly value={inviteUrl} dir="ltr" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-3 text-left text-xs text-slate-700" />
            <button type="button" onClick={() => void copyInvite()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-sm font-black text-white hover:bg-blue-800"><Copy className="h-4 w-4" /> نسخ الرابط</button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => void shareInvite()} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white"><Share2 className="h-4 w-4" /> مشاركة</button>
            <a href={`https://wa.me/?text=${encodedMessage}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700"><MessageCircle className="h-4 w-4" /> WhatsApp</a>
            <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700"><Facebook className="h-4 w-4" /> Facebook</a>
            <a href={`https://t.me/share/url?url=${encodedUrl}&text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700"><Send className="h-4 w-4" /> Telegram</a>
            <a href={`sms:?body=${encodedMessage}`} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700"><Link2 className="h-4 w-4" /> SMS</a>
          </div>
          <p className="mt-3 text-xs leading-6 text-slate-500">للمشاركة على Instagram، انسخ الرابط وأرسله أو أضفه إلى قصتك. لا نطلب الوصول إلى جهات اتصالك أو حسابات التواصل.</p>
          <p aria-live="polite" className="mt-2 min-h-5 text-xs font-bold text-emerald-700">{status}</p>
        </>
      ) : null}
    </section>
  );
};
