import React, { useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { calculateCartTotals, calculatePaymobFee } from '../../utils/rules';
import { PaymobChannel } from '../../types';
import { supabase } from '../../lib/production';
import {
  X,
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  Send,
  Sparkles,
  MapPin,
  User,
  Phone,
  FileText,
  AlertCircle,
  CheckCircle,
  CreditCard,
  Wallet,
  Banknote,
  ShieldCheck,
  Lock,
  ArrowRight,
  Smartphone,
  Building,
  CheckCircle2,
  QrCode,
} from 'lucide-react';

export const CartDrawer: React.FC = () => {
  const {
    isCartOpen,
    setIsCartOpen,
    cartItems,
    currentBusiness,
    authSession,
    adminSettings,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    submitOrderViaWhatsApp,
  } = useApp();

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [orderSentSuccess, setOrderSentSuccess] = useState(false);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const orderAttemptRef = useRef<{ fingerprint: string; orderId: string; idempotencyKey: string } | null>(null);
  const [completedOrderDetails, setCompletedOrderDetails] = useState<{
    whatsappUrl?: string;
    method: 'cod' | 'paymob';
    channel?: PaymobChannel;
    fee: number;
    total: number;
    ref?: string;
    orderId?: string;
    tracked?: boolean;
  } | null>(null);

  // Paymob Payment Method State
  const paymobConfig = currentBusiness?.paymobConfig;
  // Electronic payment is intentionally disabled platform-wide until the real gateway is approved and verified.
  const isPaymobAllowed = false;

  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'paymob'>('cod');
  const [paymobChannel, setPaymobChannel] = useState<PaymobChannel>('card');

  // Paymob Modal & Processing State
  const [isPaymobModalOpen, setIsPaymobModalOpen] = useState(false);
  const [isProcessingPaymob, setIsProcessingPaymob] = useState(false);
  const [paymobError, setPaymobError] = useState('');

  // Paymob Mock Form Fields
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [walletPhone, setWalletPhone] = useState('');
  const [walletOtp, setWalletOtp] = useState('');

  if (!isCartOpen) return null;

  const { subtotal, totalCount, originalSubtotal } = calculateCartTotals(cartItems);
  const totalSavings = Math.max(0, originalSubtotal - subtotal);

  // Calculate Paymob fee dynamically if Paymob is chosen
  const paymobCalc = paymentMethod === 'paymob' && isPaymobAllowed
    ? calculatePaymobFee(subtotal, paymobConfig)
    : { fee: 0, totalWithFee: subtotal, percentage: 0, fixed: 0 };
  const paymobFee = paymobCalc.fee;
  const finalTotal = paymobCalc.totalWithFee;

  // Handle Initial Form Submission
  const handleProceedToPayment = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!customerName.trim()) {
      setErrorMessage('يرجى إدخال اسم العميل.');
      return;
    }
    if (!customerPhone.trim()) {
      setErrorMessage('يرجى إدخال رقم الجوال لتأكيد استلام الطلب.');
      return;
    }

    if (paymentMethod === 'paymob' && isPaymobAllowed) {
      // Set default holder name and wallet phone if empty
      if (!cardHolder) setCardHolder(customerName);
      if (!walletPhone) setWalletPhone(customerPhone);
      setPaymobError('');
      setIsPaymobModalOpen(true);
    } else {
      // Standard Cash on Delivery
      void executeOrderSubmission({
        method: 'cod',
        fee: 0,
        total: subtotal,
      });
    }
  };

  // Persist authenticated orders through the existing JWT-protected, server-priced Edge Function.
  const executeOrderSubmission = async (details: {
    method: 'cod' | 'paymob';
    channel?: PaymobChannel;
    fee: number;
    total: number;
    ref?: string;
  }) => {
    if (isCreatingOrder) return;
    setIsCreatingOrder(true);
    setErrorMessage('');
    const whatsappWindow = window.open('about:blank', '_blank');

    try {
      if (!currentBusiness) throw new Error('النشاط الحالي غير محدد.');
      const ownerPhoneDigits = String(currentBusiness.ownerWhatsApp || '').replace(/\D/g, '');
      if (ownerPhoneDigits.length < 10 || ownerPhoneDigits.length > 15) {
        throw new Error('رقم واتساب صاحب النشاط غير متوفر أو غير صالح.');
      }
      if (cartItems.some(({ product }) =>
        product.businessId !== currentBusiness.id || !product.isAvailable || product.requiresQuote
      )) {
        throw new Error('يوجد منتج غير متاح أو لا ينتمي إلى النشاط الحالي. حدّث السلة ثم حاول مرة أخرى.');
      }

      let orderId: string | undefined;
      let tracked = false;
      let whatsappNotes = deliveryNotes;

      if (authSession.isAuthenticated) {
        if (!authSession.userId) throw new Error('تعذر التحقق من هوية حسابك. أعد تسجيل الدخول قبل إرسال الطلب.');
        if (!currentBusiness.tenantId) throw new Error('تعذر تحديد نطاق النشاط التجاري؛ لم يتم إرسال الطلب.');
        const items = cartItems.map(({ product, quantity }) => {
          if (!/^[0-9a-f-]{36}$/i.test(product.id)) {
            throw new Error('أحد المنتجات لا يحمل معرف كتالوج معتمدًا. لم يتم إرسال الطلب.');
          }
          if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) {
            throw new Error('كمية أحد المنتجات غير صالحة.');
          }
          return { catalogItemId: product.id, quantity, selectedOptionIds: [] as string[] };
        });
        const fingerprint = JSON.stringify({
          businessId: currentBusiness.id,
          tenantId: currentBusiness.tenantId,
          branchId: currentBusiness.branchId || null,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          customerAddress: customerAddress.trim(),
          deliveryNotes: deliveryNotes.trim(),
          items,
        });
        if (!orderAttemptRef.current || orderAttemptRef.current.fingerprint !== fingerprint) {
          orderAttemptRef.current = {
            fingerprint,
            orderId: crypto.randomUUID(),
            idempotencyKey: crypto.randomUUID(),
          };
        }
        const attempt = orderAttemptRef.current;
        const { data, error } = await supabase.functions.invoke('order-create', {
          body: {
            orderId: attempt.orderId,
            tenantId: currentBusiness.tenantId,
            businessId: currentBusiness.id,
            branchId: currentBusiness.branchId || null,
            clientIdempotencyKey: attempt.idempotencyKey,
            currency: 'EGP',
            customerName: customerName.trim(),
            customerPhone: customerPhone.trim(),
            deliveryAddress: customerAddress.trim(),
            items,
            notes: deliveryNotes.trim() || null,
            metadata: { source: 'li2lak_catalog', catalog_authoritative: true },
          },
        });
        if (error) {
          let detail = error.message || 'تعذر تسجيل الطلب';
          try {
            const payload = await (error as any).context?.json?.();
            detail = String(payload?.error || payload?.message || detail);
          } catch { /* Network errors may not contain a JSON response. */ }
          throw new Error(detail);
        }
        if (!data || typeof data.id !== 'string' || !data.id) {
          throw new Error('لم يصل تأكيد تسجيل الطلب من الخادم. لم يتم فتح واتساب.');
        }
        orderId = data.id;
        tracked = true;
        whatsappNotes = [deliveryNotes.trim(), 'رقم الطلب المسجل: ' + orderId].filter(Boolean).join('\n');
      }

      const result = submitOrderViaWhatsApp({
        customerName,
        customerPhone,
        customerAddress,
        deliveryNotes: whatsappNotes,
        paymentMethod: details.method,
        paymobChannel: details.channel,
        paymobFee: details.fee,
        paymobTotalPaid: details.total,
        paymobTransactionRef: details.ref,
      });

      if (!result.success) {
        if (orderId) {
          setCompletedOrderDetails({ orderId, tracked, ...details });
          setOrderSentSuccess(true);
          setErrorMessage(result.error || 'تم تسجيل الطلب، لكن تعذر إنشاء رابط واتساب.');
          return;
        }
        throw new Error(result.error || 'حدث خطأ أثناء إنشاء رابط الطلب.');
      }

      setCompletedOrderDetails({
        whatsappUrl: result.url,
        orderId,
        tracked,
        ...details,
      });
      setOrderSentSuccess(true);
      if (result.url && whatsappWindow) whatsappWindow.location.href = result.url;
      if (orderAttemptRef.current) orderAttemptRef.current = null;
    } catch (cause) {
      if (whatsappWindow && !whatsappWindow.closed) whatsappWindow.close();
      setErrorMessage(cause instanceof Error ? cause.message : 'تعذر إنشاء الطلب. حاول مرة أخرى.');
    } finally {
      setIsCreatingOrder(false);
    }
  };

  // Simulate Paymob Electronic Transaction Confirmation
  const handleConfirmPaymobPayment = () => {
    setPaymobError('');

    if (paymobChannel === 'card') {
      const sanitizedCard = cardNumber.replace(/\s+/g, '');
      if (sanitizedCard.length < 15) {
        setPaymobError('يرجى إدخال رقم بطاقة صالح (16 رقماً).');
        return;
      }
      if (!cardExpiry.includes('/') || cardExpiry.length < 5) {
        setPaymobError('يرجى إدخال تاريخ انتهاء صالح (شهر/سنة MM/YY).');
        return;
      }
      if (cardCvv.length < 3) {
        setPaymobError('يرجى إدخال رمز الأمان CVV (3 أرقام).');
        return;
      }
    } else if (paymobChannel === 'wallet') {
      if (!walletPhone.trim() || walletPhone.length < 10) {
        setPaymobError('يرجى إدخال رقم محفظة هاتف كاش صالح (مثل: 01012345678).');
        return;
      }
    }

    setIsProcessingPaymob(true);

    // Simulate Paymob gateway authorization handshake
    setTimeout(() => {
      setIsProcessingPaymob(false);
      setIsPaymobModalOpen(false);

      const generatedRef = `PMB-EG-${Math.floor(100000 + Math.random() * 900000)}`;

      executeOrderSubmission({
        method: 'paymob',
        channel: paymobChannel,
        fee: paymobFee,
        total: finalTotal,
        ref: generatedRef,
      });
    }, 1800);
  };

  // Helper formatters
  const formatCardNumberInput = (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 16);
    const groups = clean.match(/.{1,4}/g);
    return groups ? groups.join(' ') : clean;
  };

  const formatExpiryInput = (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 4);
    if (clean.length >= 3) {
      return `${clean.slice(0, 2)}/${clean.slice(2)}`;
    }
    return clean;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="cart-title">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={() => {
          if (!isProcessingPaymob) setIsCartOpen(false);
        }}
      />

      <div className="fixed inset-y-0 left-0 max-w-full flex pl-0 sm:pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col justify-between">
          {/* Header */}
          <div className="p-5 border-b border-slate-200/80 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <h2 id="cart-title" className="font-black text-base text-slate-900">
                  سلة المشتريات
                </h2>
                <p className="text-xs text-slate-500 font-medium truncate max-w-[200px]">
                  خاصة بـ: {currentBusiness?.name}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {cartItems.length > 0 && !orderSentSuccess && (
                <button
                  onClick={clearCart}
                  className="text-xs text-rose-600 hover:text-rose-700 font-semibold px-2 py-1 rounded-lg hover:bg-rose-50 transition-colors"
                >
                  تفريغ السلة
                </button>
              )}
              <button
                onClick={() => setIsCartOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
                aria-label="إغلاق السلة"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Cart Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {orderSentSuccess && completedOrderDetails ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-6 text-center space-y-4">
                <div className="w-14 h-14 bg-emerald-600 text-white rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-emerald-600/30">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <h3 className="font-black text-lg text-emerald-950">
                  {completedOrderDetails.method === 'paymob'
                    ? 'تم سداد الطلب بنجاح عبر Paymob وإرسال التفاصيل!'
                    : completedOrderDetails.tracked ? 'تم تسجيل الطلب وإرسال التفاصيل عبر واتساب!' : 'تم إرسال طلبك عبر واتساب فقط!'}
                </h3>

                {completedOrderDetails.tracked && completedOrderDetails.orderId && (
                  <p className="rounded-xl border border-emerald-200 bg-white p-3 text-sm font-bold text-emerald-900">
                    رقم الطلب المسجل: <span dir="ltr" className="font-mono">{completedOrderDetails.orderId}</span>
                  </p>
                )}
                {completedOrderDetails.method === 'paymob' && (
                  <div className="bg-white p-3.5 rounded-2xl border border-emerald-300 text-right space-y-1.5 text-xs shadow-xs">
                    <div className="flex items-center justify-between text-slate-500 font-semibold">
                      <span>بوابة الدفع الإلكتروني:</span>
                      <span className="font-black text-blue-700">PAYMOB EGYPT</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-700">
                      <span>رقم مرجع المعاملة:</span>
                      <span className="font-mono font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                        {completedOrderDetails.ref}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-700">
                      <span>تكلفة الدفع الإلكتروني (Paymob):</span>
                      <span className="font-bold text-amber-700">
                        +{completedOrderDetails.fee.toFixed(2)} {adminSettings.currency}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-emerald-800 font-black pt-1 border-t border-slate-100">
                      <span>المبلغ المسدد بالكامل:</span>
                      <span className="text-sm font-black text-emerald-700">
                        {completedOrderDetails.total.toFixed(2)} {adminSettings.currency}
                      </span>
                    </div>
                  </div>
                )}

                <p className="text-xs text-emerald-800 leading-relaxed">
                  تم إرسال كافة تفاصيل الفاتورة وحالة السداد إلى واتساب صاحب النشاط (
                  <span dir="ltr" className="font-bold">{currentBusiness?.ownerWhatsApp}</span>
                  ).
                </p>

                {completedOrderDetails.whatsappUrl && (
                  <a
                    href={completedOrderDetails.whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    <span>فتح محادثة الواتساب مجدداً</span>
                  </a>
                )}

                <button
                  onClick={() => {
                    clearCart();
                    setOrderSentSuccess(false);
                    setCompletedOrderDetails(null);
                    setIsCartOpen(false);
                  }}
                  className="w-full bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
                >
                  بدء طلب جديد
                </button>
              </div>
            ) : cartItems.length === 0 ? (
              <div className="py-16 text-center">
                <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <h3 className="font-bold text-slate-800 text-base">سلتك فارغة حالياً</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                  تصفح كتالوج {currentBusiness?.name} وأضف المنتجات أو الخدمات التي ترغب بطلبها.
                </p>
              </div>
            ) : (
              <>
                {/* List of Cart Items */}
                <div className="space-y-3">
                  {cartItems.map(({ product, quantity }) => (
                    <div
                      key={product.id}
                      className="flex items-center gap-3 bg-slate-50/80 p-3 rounded-2xl border border-slate-200/80"
                    >
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-16 h-16 rounded-xl object-cover bg-slate-200 flex-shrink-0"
                      />

                      <div className="flex-1 min-w-0">
                        <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 truncate">
                          {product.name}
                        </h4>
                        <div className="text-xs font-bold text-emerald-700 mt-0.5">
                          {product.price} {adminSettings.currency}
                          {product.unit ? ` / ${product.unit}` : ''}
                        </div>

                        {/* Quantity Stepper */}
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            onClick={() => updateCartQuantity(product.id, quantity - 1)}
                            className="w-6 h-6 rounded-lg bg-white border border-slate-300 text-slate-700 flex items-center justify-center hover:bg-slate-100 transition-colors cursor-pointer"
                            aria-label="إنقاص الكمية"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-extrabold text-slate-900 w-6 text-center">
                            {quantity}
                          </span>
                          <button
                            onClick={() => updateCartQuantity(product.id, quantity + 1)}
                            className="w-6 h-6 rounded-lg bg-white border border-slate-300 text-slate-700 flex items-center justify-center hover:bg-slate-100 transition-colors cursor-pointer"
                            aria-label="زيادة الكمية"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <button
                        onClick={() => removeFromCart(product.id)}
                        className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg transition-colors cursor-pointer"
                        title="حذف من السلة"
                        aria-label={`حذف ${product.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Customer Checkout Form */}
                <form id="order-form" onSubmit={handleProceedToPayment} className="space-y-4 pt-2">
                  <div className="flex items-center gap-1.5 text-xs font-black text-slate-800 pb-1 border-b border-slate-100">
                    <User className="w-3.5 h-3.5 text-emerald-600" />
                    <span>بيانات العميل لتأكيد الطلب:</span>
                  </div>

                  {errorMessage && (
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      الاسم الكامل <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <User className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        placeholder="مثال: محمد عبدالله"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      رقم الجوال (واتساب) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        required
                        dir="ltr"
                        placeholder="010xxxxxxxx أو 011xxxxxxxx"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-xs text-right focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      العنوان / الحي ومكان الاستلام
                    </label>
                    <div className="relative">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="المدينة، الحي، الشارع"
                        value={customerAddress}
                        onChange={(e) => setCustomerAddress(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      ملاحظات خاصة بالطلب (اختياري)
                    </label>
                    <div className="relative">
                      <FileText className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
                      <textarea
                        rows={2}
                        placeholder="أوقات التوصيل المفضلة، تعليمات التجهيز..."
                        value={deliveryNotes}
                        onChange={(e) => setDeliveryNotes(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden resize-none"
                      />
                    </div>
                  </div>

                  {/* Payment Method Selector (COD vs PAYMOB) */}
                  <div className="space-y-2 pt-2 border-t border-slate-200">
                    <div className="flex items-center justify-between">
                      <label className="block text-[11px] font-black text-slate-800">
                        طريقة السداد المعتمدة لهذا النشاط:
                      </label>
                      <span className="text-[10px] text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded-full">
                        محددة من الإدارة
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      {/* Cash on delivery option */}
                      <label
                        className={`flex items-start gap-3 p-3 rounded-2xl border transition-all cursor-pointer ${
                          paymentMethod === 'cod'
                            ? 'bg-emerald-50/70 border-emerald-500 shadow-xs'
                            : 'bg-slate-50/60 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="cod"
                          checked={paymentMethod === 'cod'}
                          onChange={() => setPaymentMethod('cod')}
                          className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                              <Banknote className="w-4 h-4 text-emerald-600" />
                              الدفع عند الاستلام (كاش)
                            </span>
                            <span className="text-[10px] text-slate-500 font-bold">بدون رسوم إضافية</span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            تواصل مع صاحب النشاط عبر واتساب واتفق معه على الدفع النقدي عند الاستلام.
                          </p>
                        </div>
                      </label>

                      {/* Paymob Electronic Payment Option */}
                      {isPaymobAllowed ? (
                        <label
                          className={`flex items-start gap-3 p-3 rounded-2xl border transition-all cursor-pointer ${
                            paymentMethod === 'paymob'
                              ? 'bg-blue-50/70 border-blue-600 shadow-xs ring-1 ring-blue-600/20'
                              : 'bg-slate-50/60 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="paymentMethod"
                            value="paymob"
                            checked={paymentMethod === 'paymob'}
                            onChange={() => setPaymentMethod('paymob')}
                            className="mt-0.5 text-blue-600 focus:ring-blue-500"
                          />
                          <div className="flex-1">
                            <div className="flex items-center justify-between flex-wrap gap-1">
                              <span className="font-extrabold text-xs text-blue-950 flex items-center gap-1.5">
                                <CreditCard className="w-4 h-4 text-blue-600" />
                                سداد إلكتروني فوري (PAYMOB مصر)
                              </span>
                              <span className="text-[10px] bg-blue-100 text-blue-800 font-extrabold px-1.5 py-0.5 rounded">
                                ميزة • فيزا • محافظ كاش
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                              دفع إلكتروني فوري ومؤكد عبر بوابة Paymob المعتمدة للنشاط.
                            </p>

                            {/* Added Fee Disclaimer Required by User */}
                            <div className="mt-2 p-2 rounded-xl bg-amber-50/90 border border-amber-200/80 text-[10.5px] text-amber-900 font-medium space-y-0.5">
                              <div className="flex items-center gap-1 font-bold text-amber-950">
                                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                                <span>يضاف تكلفة الدفع الإلكتروني (Paymob):</span>
                              </div>
                              <div className="text-amber-800">
                                {paymobConfig?.feeType === 'percentage' &&
                                  `+ ${paymobConfig.feePercentage}% من قيمة المشتريات`}
                                {paymobConfig?.feeType === 'fixed' &&
                                  `+ ${paymobConfig.feeFixed} ج.م مبلغ ثابت للعملية`}
                                {paymobConfig?.feeType === 'percentage_plus_fixed' &&
                                  `+ ${paymobConfig.feePercentage}% + ${paymobConfig.feeFixed} ج.م`}
                                <span className="font-black text-slate-900 mr-1.5">
                                  (محسوبة حالياً: +{paymobFee.toFixed(2)} {adminSettings.currency})
                                </span>
                              </div>
                            </div>
                          </div>
                        </label>
                      ) : (
                        <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
                          <div className="flex items-center gap-2 font-black">
                            <Lock className="w-4 h-4" />
                            <span>طرق الدفع الإلكتروني غير متاحة مؤقتًا</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div aria-disabled="true" className="rounded-xl border border-slate-200 bg-white/70 p-2 text-center text-slate-400">
                              <CreditCard className="w-5 h-5 mx-auto mb-1" />
                              <span className="block text-[10px] font-bold">بطاقة بنكية</span>
                              <span className="block text-[9px]">قريبًا</span>
                            </div>
                            <div aria-disabled="true" className="rounded-xl border border-slate-200 bg-white/70 p-2 text-center text-slate-400">
                              <Smartphone className="w-5 h-5 mx-auto mb-1" />
                              <span className="block text-[10px] font-bold">محفظة إلكترونية</span>
                              <span className="block text-[9px]">قريبًا</span>
                            </div>
                            <div aria-disabled="true" className="rounded-xl border border-slate-200 bg-white/70 p-2 text-center text-slate-400">
                              <QrCode className="w-5 h-5 mx-auto mb-1" />
                              <span className="block text-[10px] font-bold">أمان / مصاري</span>
                              <span className="block text-[9px]">قريبًا</span>
                            </div>
                          </div>
                          <p className="leading-relaxed">يمكنك إتمام الطلب بالتواصل مع صاحب النشاط عبر واتساب والاتفاق معه على الدفع النقدي عند الاستلام. لن يتم تحصيل أي مبلغ إلكتروني من هذه الواجهة حاليًا.</p>
                        </div>
                      )}
                    </div>

                    {/* Paymob Channel Choice when Paymob is selected */}
                    {paymentMethod === 'paymob' && isPaymobAllowed && (
                      <div className="pt-2 pl-2 space-y-2">
                        <span className="text-[11px] font-bold text-slate-700 block">
                          اختر وسيلة الدفع عبر Paymob:
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          {paymobConfig?.acceptedChannels.includes('card') && (
                            <button
                              type="button"
                              onClick={() => setPaymobChannel('card')}
                              className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                paymobChannel === 'card'
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                              <span>بطاقة بنكية / ميزة</span>
                            </button>
                          )}

                          {paymobConfig?.acceptedChannels.includes('wallet') && (
                            <button
                              type="button"
                              onClick={() => setPaymobChannel('wallet')}
                              className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                paymobChannel === 'wallet'
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <Smartphone className="w-3.5 h-3.5" />
                              <span>محفظة كاش (فودافون/غيرها)</span>
                            </button>
                          )}

                          {paymobConfig?.acceptedChannels.includes('kiosk') && (
                            <button
                              type="button"
                              onClick={() => setPaymobChannel('kiosk')}
                              className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                paymobChannel === 'kiosk'
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <QrCode className="w-3.5 h-3.5" />
                              <span>أمان ومصاري</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </form>
              </>
            )}
          </div>

          {/* Footer & Checkout Action Button */}
          {cartItems.length > 0 && !orderSentSuccess && (
            <div className="p-5 border-t border-slate-200 bg-slate-50/90 space-y-4">
              {/* Financial Summary */}
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span>عدد العناصر ({totalCount})</span>
                  <span>{subtotal.toFixed(2)} {adminSettings.currency}</span>
                </div>

                {totalSavings > 0 && (
                  <div className="flex items-center justify-between text-emerald-700 font-bold">
                    <span>مجموع الخصومات والتوفير</span>
                    <span>-{totalSavings.toFixed(2)} {adminSettings.currency}</span>
                  </div>
                )}

                {/* Paymob Added Cost Row */}
                {paymentMethod === 'paymob' && isPaymobAllowed && (
                  <div className="flex items-center justify-between text-blue-900 bg-blue-50/80 px-2.5 py-1.5 rounded-lg border border-blue-200/70 font-bold">
                    <span className="flex items-center gap-1">
                      <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                      <span>تكلفة الدفع الإلكتروني (Paymob):</span>
                    </span>
                    <span className="font-black">+{paymobFee.toFixed(2)} {adminSettings.currency}</span>
                  </div>
                )}

                <div className="flex items-center justify-between text-slate-900 font-black text-base pt-2 border-t border-slate-200">
                  <span>المجموع الإجمالي النهائي</span>
                  <span className={paymentMethod === 'paymob' ? 'text-blue-700' : 'text-emerald-700'}>
                    {finalTotal.toFixed(2)} {adminSettings.currency}
                  </span>
                </div>
              </div>

              {/* Notice regarding merchant WhatsApp dispatch */}
              <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 text-[11px] text-slate-700 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>
                  {paymentMethod === 'paymob'
                    ? 'سيتم دفع المبلغ بأمان عبر Paymob ثم إرسال الفاتورة والرقم المرجعي لواتساب النشاط.'
                    : authSession.isAuthenticated ? `سيتم تسجيل الطلب في حسابك بالأسعار المعتمدة من الكتالوج ثم تحويل التفاصيل إلى واتساب النشاط (${currentBusiness?.ownerWhatsApp}).` : `سيتم تحويل الطلب إلى واتساب النشاط (${currentBusiness?.ownerWhatsApp}) فقط. سجّل الدخول لتسجيل الطلب في حسابك وإتاحة تقييمه بعد التسليم.`}
                </span>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                form="order-form"
                disabled={isCreatingOrder}
                className={`w-full py-3.5 px-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer text-white disabled:cursor-not-allowed disabled:opacity-50 ${
                  paymentMethod === 'paymob'
                    ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/25'
                    : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/25'
                }`}
              >
                {paymentMethod === 'paymob' ? (
                  <>
                    <CreditCard className="w-4 h-4" />
                    <span>المتابعة للدفع عبر Paymob ({finalTotal.toFixed(2)} {adminSettings.currency})</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>{isCreatingOrder ? (authSession.isAuthenticated ? 'جارٍ تسجيل الطلب ثم فتح واتساب…' : 'جارٍ تجهيز واتساب…') : 'إرسال الطلب لواتساب صاحب النشاط'}</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Paymob Egyptian Gateway Secure Modal */}
      {isPaymobModalOpen && (
        <div className="fixed inset-0 z-60 overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden transform transition-all animate-in fade-in zoom-in-95">
            {/* Paymob Top Branding Bar */}
            <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 p-5 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="bg-white text-blue-800 font-black text-xs px-2 py-0.5 rounded tracking-wider shadow-xs">
                    PAYMOB
                  </div>
                  <span className="text-xs font-bold text-blue-100">بوابة الدفع الإلكتروني المعتمدة</span>
                </div>
                <button
                  type="button"
                  disabled={isProcessingPaymob}
                  onClick={() => setIsPaymobModalOpen(false)}
                  className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xs cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-blue-200">الطلب لصالح النشاط:</div>
                  <div className="font-extrabold text-sm">{currentBusiness?.name}</div>
                </div>
                <div className="text-left">
                  <div className="text-[11px] text-blue-200">المبلغ الإجمالي للدفع:</div>
                  <div className="text-xl font-black text-amber-300">
                    {finalTotal.toFixed(2)} {adminSettings.currency}
                  </div>
                  <div className="text-[10px] text-blue-200 font-medium">
                    (شامل رسوم Paymob: {paymobFee.toFixed(2)} {adminSettings.currency})
                  </div>
                </div>
              </div>
            </div>

            {/* Paymob Form Body */}
            <div className="p-6 space-y-4">
              {paymobError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{paymobError}</span>
                </div>
              )}

              {/* Channel: Bank Card */}
              {paymobChannel === 'card' && (
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                    <span className="text-xs font-black text-slate-800">بيانات البطاقة البنكية:</span>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded text-blue-800">Meeza ميزة</span>
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded text-indigo-700">Visa</span>
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded text-amber-600">Mastercard</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      اسم حامل البطاقة (كما يظهر على الكارت)
                    </label>
                    <input
                      type="text"
                      placeholder="Mohamed Abdallah"
                      value={cardHolder}
                      onChange={(e) => setCardHolder(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:outline-hidden uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      رقم البطاقة (16 رقم)
                    </label>
                    <div className="relative">
                      <CreditCard className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        dir="ltr"
                        maxLength={19}
                        placeholder="XXXX XXXX XXXX XXXX"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(formatCardNumberInput(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl pr-9 pl-3 py-2 text-xs font-mono font-bold text-slate-900 text-right tracking-wider focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        تاريخ الصلاحية (MM/YY)
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        maxLength={5}
                        placeholder="MM/YY"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(formatExpiryInput(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 text-center focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        رمز الأمان (CVV)
                      </label>
                      <div className="relative">
                        <Lock className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="password"
                          dir="ltr"
                          maxLength={4}
                          placeholder="***"
                          value={cardCvv}
                          onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ''))}
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl pr-9 pl-3 py-2 text-xs font-mono font-bold text-slate-900 text-center tracking-widest focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:outline-hidden"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Channel: Mobile Cash Wallet */}
              {paymobChannel === 'wallet' && (
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                    <span className="text-xs font-black text-slate-800">محافظ الهواتف الذكية (E-Wallets):</span>
                    <span className="text-[10px] text-emerald-700 font-extrabold bg-emerald-50 px-2 py-0.5 rounded">
                      فودافون • أورنج • اتصالات • WE
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      رقم محفظة الكاش المسجلة في مصر
                    </label>
                    <div className="relative">
                      <Smartphone className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        dir="ltr"
                        placeholder="010xxxxxxxx"
                        value={walletPhone}
                        onChange={(e) => setWalletPhone(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl pr-9 pl-3 py-2 text-xs font-mono font-bold text-slate-900 text-right focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:outline-hidden"
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      سيصلك إشعار أو طلب دفع فوري على تطبيق المحفظة لتأكيد الخصم.
                    </p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      الرقم السري للمحفظة / OTP (تجريبي)
                    </label>
                    <input
                      type="password"
                      maxLength={6}
                      placeholder="••••••"
                      value={walletOtp}
                      onChange={(e) => setWalletOtp(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-center tracking-widest focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:outline-hidden"
                    />
                  </div>
                </div>
              )}

              {/* Channel: Kiosk / Aman */}
              {paymobChannel === 'kiosk' && (
                <div className="space-y-3 p-3 bg-amber-50/70 border border-amber-200 rounded-2xl text-xs">
                  <div className="font-bold text-amber-950 flex items-center gap-1.5">
                    <QrCode className="w-4 h-4 text-amber-700" />
                    <span>الدفع عبر منافذ أمان ومصاري</span>
                  </div>
                  <p className="text-[11px] text-amber-900 leading-relaxed">
                    سيتم إنشاء كود دفع فوري بصلاحية 48 ساعة للسداد في أقرب فرع أمان أو مصاري بمصر، وسيتم ربط العملية مباشرة بالطلب.
                  </p>
                </div>
              )}

              {/* Paymob Security Badges */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                  معتمد من البنك المركزي المصري
                </span>
                <span className="flex items-center gap-1">
                  <Lock className="w-3 h-3 text-slate-400" />
                  تشفير 256-bit بنكي آمن
                </span>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  disabled={isProcessingPaymob}
                  onClick={handleConfirmPaymobPayment}
                  className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isProcessingPaymob ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>جاري المعالجة والتحقق عبر Paymob...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>تأكيد وسداد {finalTotal.toFixed(2)} {adminSettings.currency} الآن</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={isProcessingPaymob}
                  onClick={() => setIsPaymobModalOpen(false)}
                  className="w-full py-2 text-slate-500 hover:text-slate-700 font-bold text-xs cursor-pointer"
                >
                  إلغاء والعودة للسلة
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
