import React, { FormEvent, useState } from 'react';
import { Bot, LockKeyhole, MessageCircle, Send, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/production';

type SupportMessage = {
  id: number;
  role: 'user' | 'assistant';
  text: string;
};

const MAX_QUESTION_LENGTH = 1200;

export const SupportAssistant: React.FC = () => {
  const { authSession, setIsLoginModalOpen } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState<SupportMessage[]>([
    {
      id: 1,
      role: 'assistant',
      text: 'أهلاً بك في دعم MantiqatiX الذكي. اشرح المشكلة باختصار وسأساعدك في خطوات التشخيص والاستخدام.',
    },
  ]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const prompt = question.trim();
    if (!prompt || busy) return;
    if (prompt.length > MAX_QUESTION_LENGTH) {
      setError('اختصر سؤالك إلى 1200 حرف كحد أقصى.');
      return;
    }
    if (!authSession.isAuthenticated) {
      setError('يلزم تسجيل الدخول لاستخدام المساعد الذكي.');
      return;
    }

    setError('');
    setQuestion('');
    setMessages((previous) => [...previous, { id: Date.now(), role: 'user', text: prompt }]);
    setBusy(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('ai-gemini-proxy', {
        body: {
          action: 'technical_support',
          query: prompt,
          userRegion: 'Egypt',
          currentModule: 'technical_support',
          intent: 'technical_support',
          sector: 'MantiqatiX platform',
        },
      });
      if (invokeError) throw new Error(invokeError.message || 'تعذر الاتصال بمساعد الدعم.');
      if (data?.error) throw new Error(String(data.message || data.error));
      const answer = typeof data?.text === 'string' ? data.text.trim() : '';
      if (!answer) throw new Error('لم يصل رد صالح من المساعد. حاول مرة أخرى.');
      setMessages((previous) => [...previous, { id: Date.now() + 1, role: 'assistant', text: answer }]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'حدث خطأ أثناء تشغيل المساعد.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed bottom-4 left-4 z-[80] flex flex-col items-start gap-3" dir="rtl">
      {isOpen && (
        <section
          aria-label="مساعد الدعم الفني الذكي"
          className="flex h-[min(70vh,34rem)] w-[min(92vw,23rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        >
          <header className="flex items-center justify-between gap-3 bg-slate-950 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/15 text-emerald-300"><Bot className="h-5 w-5" /></span>
              <div>
                <h2 className="text-sm font-black">دعم MantiqatiX الذكي</h2>
                <p className="text-[10px] text-slate-300">مساعد الاستخدام والتشخيص</p>
              </div>
            </div>
            <button type="button" onClick={() => setIsOpen(false)} aria-label="إغلاق مساعد الدعم" className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-3" aria-live="polite">
            {messages.map((message) => (
              <article key={message.id} className={message.role === 'user' ? 'mr-5 rounded-2xl rounded-tr-sm bg-emerald-100 p-3 text-sm text-slate-800' : 'ml-5 rounded-2xl rounded-tl-sm border border-slate-200 bg-white p-3 text-sm leading-7 text-slate-700'}>
                <p className="mb-1 text-[10px] font-black text-slate-500">{message.role === 'user' ? 'أنت' : 'مساعد MantiqatiX'}</p>
                <p className="whitespace-pre-wrap break-words">{message.text}</p>
              </article>
            ))}
            {busy && <p role="status" className="rounded-xl bg-white px-3 py-2 text-xs text-slate-500">جارٍ تحليل سؤالك…</p>}
          </div>

          <div className="border-t border-slate-200 bg-white p-3">
            {!authSession.isAuthenticated ? (
              <div className="space-y-2 text-center">
                <p className="flex items-center justify-center gap-2 text-xs text-slate-600"><LockKeyhole className="h-4 w-4" /> سجّل الدخول لتشغيل المساعد الذكي.</p>
                <button type="button" onClick={() => setIsLoginModalOpen(true)} className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white hover:bg-emerald-700">تسجيل الدخول</button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-2">
                <label htmlFor="mantiqatix-support-question" className="sr-only">اكتب سؤالك للدعم الفني</label>
                <div className="flex items-end gap-2">
                  <textarea
                    id="mantiqatix-support-question"
                    value={question}
                    onChange={(event) => setQuestion(event.target.value.slice(0, MAX_QUESTION_LENGTH))}
                    maxLength={MAX_QUESTION_LENGTH}
                    rows={2}
                    placeholder="اكتب سؤالك أو المشكلة التي تواجهك…"
                    className="min-h-11 flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                    disabled={busy}
                  />
                  <button type="submit" disabled={busy || !question.trim()} aria-label="إرسال السؤال" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-600 text-white disabled:cursor-not-allowed disabled:opacity-50"><Send className="h-4 w-4" /></button>
                </div>
                <p className="text-[10px] leading-5 text-slate-500">لا ترسل كلمة المرور أو رمز التحقق أو بيانات البطاقة أو مفاتيح API. لا يستطيع المساعد تنفيذ عمليات مالية أو تعديل صلاحيات الحساب، والمحادثة الحالية لا تُحفظ كتذكرة متابعة بعد إغلاق النافذة.</p>
              </form>
            )}
            {error && <p role="alert" className="mt-2 text-xs font-semibold text-rose-600">{error}</p>}
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-label={isOpen ? 'إغلاق مساعد الدعم الفني' : 'فتح مساعد الدعم الفني الذكي'}
        className="flex min-h-12 items-center gap-2 rounded-full bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-emerald-900/20 transition hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
      >
        <MessageCircle className="h-5 w-5" />
        <span>الدعم الذكي</span>
      </button>
    </div>
  );
};
