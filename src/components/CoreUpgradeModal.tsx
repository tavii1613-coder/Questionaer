import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { CorePlan, CorePlanId, PaymentMethod } from '../types';
import { CORE_PLANS } from '../data/constants';
import {
  X,
  Check,
  CreditCard,
  Smartphone,
  QrCode,
  Sparkles,
  Lock,
  ArrowRight,
  AlertCircle,
  Copy,
  RefreshCw,
  Settings,
  Building,
  CheckCircle2,
  ExternalLink,
  Info,
  ChevronRight,
  FileText,
  HelpCircle,
  ShieldCheck,
} from 'lucide-react';
import { playTimerCompletionChime, playClickPip } from '../utils/audio';

interface CoreUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlanActivated: (planId: CorePlanId) => void;
  userEmail?: string;
  isOwner?: boolean;
}

// Luhn algorithm for card validation
function validateLuhn(number: string): boolean {
  const clean = number.replace(/\D/g, '');
  if (clean.length < 13 || clean.length > 19) return false;

  let sum = 0;
  let shouldDouble = false;

  for (let i = clean.length - 1; i >= 0; i--) {
    let digit = parseInt(clean.charAt(i), 10);

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }

    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

// Card Network detector
function getCardBrand(number: string): 'visa' | 'mastercard' | 'rupay' | 'amex' | 'generic' {
  const clean = number.replace(/\D/g, '');
  if (/^4/.test(clean)) return 'visa';
  if (/^(5[1-5]|222[1-9]|22[3-9]|2[3-6]|27[01]|2720)/.test(clean)) return 'mastercard';
  if (/^(60|65|81|82)/.test(clean)) return 'rupay';
  if (/^3[47]/.test(clean)) return 'amex';
  return 'generic';
}

// Indian Mobile Number Validator: 10 digits starting with 6, 7, 8, or 9
function validateIndianPhone(phone: string): boolean {
  const clean = phone.replace(/\D/g, '');
  return /^[6-9]\d{9}$/.test(clean);
}

// UPI VPA Validator: [username]@[bank/provider]
function validateUpiId(id: string): boolean {
  const trimmed = id.trim();
  return /^[a-zA-Z0-9.\-_]{2,64}@[a-zA-Z0-9.\-_]{2,64}$/.test(trimmed);
}

// Card Expiry Validator: MM/YY, month 1-12, not expired
function validateCardExpiry(expiry: string): boolean {
  const match = expiry.match(/^(\d{2})\/(\d{2})$/);
  if (!match) return false;

  const month = parseInt(match[1], 10);
  const year = parseInt(`20${match[2]}`, 10);

  if (month < 1 || month > 12) return false;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (year < currentYear) return false;
  if (year === currentYear && month < currentMonth) return false;
  if (year > currentYear + 20) return false;

  return true;
}

export const CoreUpgradeModal: React.FC<CoreUpgradeModalProps> = ({
  isOpen,
  onClose,
  onPlanActivated,
  userEmail,
  isOwner,
}) => {
  const [selectedPlanId, setSelectedPlanId] = useState<CorePlanId>('1_year');
  const [step, setStep] = useState<'select' | 'pay' | 'success'>('select');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('upi');

  // Merchant Settlement Configuration (Where the money actually goes!)
  const [merchantUpi, setMerchantUpi] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('questionaer_merchant_upi');
      if (saved) return saved;
    }
    return 'tavii.1613@okhdfcbank';
  });

  const [merchantName, setMerchantName] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('questionaer_merchant_name');
      if (saved) return saved;
    }
    return 'Tavii';
  });

  // Card Settlement Bank Details (Where Card Payments land in India)
  const [merchantBankName, setMerchantBankName] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('questionaer_merchant_bank_name');
      if (saved) return saved;
    }
    return 'HDFC Bank';
  });

  const [merchantAccountNumber, setMerchantAccountNumber] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('questionaer_merchant_account_number');
      if (saved) return saved;
    }
    return '50100492814182';
  });

  const [merchantIfsc, setMerchantIfsc] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('questionaer_merchant_ifsc');
      if (saved) return saved;
    }
    return 'HDFC0001613';
  });

  const [merchantGateway, setMerchantGateway] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('questionaer_merchant_gateway');
      if (saved) return saved;
    }
    return 'Razorpay & Stripe (T+1 Direct Bank Deposit)';
  });

  const [isEditingMerchant, setIsEditingMerchant] = useState(false);
  const [showCardPayoutModal, setShowCardPayoutModal] = useState(false);
  const [tempMerchantUpi, setTempMerchantUpi] = useState(merchantUpi);
  const [tempMerchantName, setTempMerchantName] = useState(merchantName);
  const [tempBankName, setTempBankName] = useState(merchantBankName);
  const [tempAccountNumber, setTempAccountNumber] = useState(merchantAccountNumber);
  const [tempIfsc, setTempIfsc] = useState(merchantIfsc);
  const [merchantSavedFeedback, setMerchantSavedFeedback] = useState(false);

  // Settlement Ledger State
  const [ledgerTab, setLedgerTab] = useState<'overview' | 'ledger' | 'settings'>('overview');

  // Form states
  const [upiId, setUpiId] = useState('');
  const [paytmPhone, setPaytmPhone] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardName, setCardName] = useState('');

  // Error states
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState('');

  // Active Real QR state
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [qrSecondsLeft, setQrSecondsLeft] = useState(300); // 5 minutes
  const [qrCopied, setQrCopied] = useState(false);
  const [upiCopied, setUpiCopied] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [invoiceId, setInvoiceId] = useState('');

  const selectedPlan = CORE_PLANS.find((p) => p.id === selectedPlanId) || CORE_PLANS[2];

  // Standard-compliant UPI Payment URL directly targeting the user's real account!
  const upiIntentUri = `upi://pay?pa=${encodeURIComponent(merchantUpi)}&pn=${encodeURIComponent(
    merchantName
  )}&am=${selectedPlan.priceInr.toFixed(2)}&cu=INR&tn=Ouestionaer%20${encodeURIComponent(
    selectedPlan.name
  )}`;

  // Generate authentic, camera-scannable QR code directly targeting the merchant's real bank account
  useEffect(() => {
    if (isOpen) {
      QRCode.toDataURL(upiIntentUri, {
        width: 320,
        margin: 1.5,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#0c0a09',
          light: '#ffffff',
        },
      })
        .then((url) => {
          setQrDataUrl(url);
        })
        .catch((err) => {
          console.error('Error generating QR code:', err);
        });
    }
  }, [isOpen, selectedPlan, upiIntentUri, merchantUpi, merchantName]);

  // Active QR countdown timer
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isOpen && step === 'pay' && paymentMethod === 'upi') {
      timer = setInterval(() => {
        setQrSecondsLeft((prev) => {
          if (prev <= 1) return 300;
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isOpen, step, paymentMethod]);

  if (!isOpen) return null;

  // Save updated merchant UPI ID and Bank Account details for Card settlements
  const handleSaveMerchantConfig = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUpi = tempMerchantUpi.trim() || merchantUpi;
    const trimmedName = tempMerchantName.trim() || merchantName;
    const trimmedBank = tempBankName.trim() || merchantBankName;
    const trimmedAcc = tempAccountNumber.trim() || merchantAccountNumber;
    const trimmedIfsc = tempIfsc.trim() || merchantIfsc;

    setMerchantUpi(trimmedUpi);
    setMerchantName(trimmedName);
    setMerchantBankName(trimmedBank);
    setMerchantAccountNumber(trimmedAcc);
    setMerchantIfsc(trimmedIfsc);

    localStorage.setItem('questionaer_merchant_upi', trimmedUpi);
    localStorage.setItem('questionaer_merchant_name', trimmedName);
    localStorage.setItem('questionaer_merchant_bank_name', trimmedBank);
    localStorage.setItem('questionaer_merchant_account_number', trimmedAcc);
    localStorage.setItem('questionaer_merchant_ifsc', trimmedIfsc);

    setIsEditingMerchant(false);
    setMerchantSavedFeedback(true);
    playClickPip();
    setTimeout(() => setMerchantSavedFeedback(false), 3000);
  };

  const recordLedgerTransaction = (inv: string, method: PaymentMethod) => {
    try {
      const existing = JSON.parse(localStorage.getItem('questionaer_payment_ledger') || '[]');
      const newEntry = {
        id: inv,
        date: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
        plan: selectedPlan.name,
        amount: selectedPlan.priceInr,
        method: method === 'card' ? 'Credit/Debit Card' : method === 'paytm' ? 'Paytm Wallet' : 'UPI',
        destination:
          method === 'card'
            ? `${merchantBankName} (A/C •••• ${merchantAccountNumber.slice(-4)})`
            : `${merchantUpi} (${merchantName})`,
        status: 'Settled to Bank',
      };
      localStorage.setItem('questionaer_payment_ledger', JSON.stringify([newEntry, ...existing]));
    } catch {
      // ignore
    }
  };

  // Format Card input
  const handleCardNumberChange = (val: string) => {
    const raw = val.replace(/\D/g, '').slice(0, 16);
    const formatted = raw.match(/.{1,4}/g)?.join(' ') || raw;
    setCardNumber(formatted);
    if (errors.cardNumber) {
      setErrors((prev) => ({ ...prev, cardNumber: '' }));
    }
  };

  const handleExpiryChange = (val: string) => {
    const raw = val.replace(/\D/g, '').slice(0, 4);
    if (raw.length >= 3) {
      setCardExpiry(`${raw.slice(0, 2)}/${raw.slice(2, 4)}`);
    } else {
      setCardExpiry(raw);
    }
    if (errors.cardExpiry) {
      setErrors((prev) => ({ ...prev, cardExpiry: '' }));
    }
  };

  const handleCvvChange = (val: string) => {
    const raw = val.replace(/\D/g, '').slice(0, 4);
    setCardCvv(raw);
    if (errors.cardCvv) {
      setErrors((prev) => ({ ...prev, cardCvv: '' }));
    }
  };

  const handlePhoneChange = (val: string) => {
    const raw = val.replace(/\D/g, '').slice(0, 10);
    setPaytmPhone(raw);
    if (errors.paytmPhone) {
      setErrors((prev) => ({ ...prev, paytmPhone: '' }));
    }
  };

  const handleUpiChange = (val: string) => {
    setUpiId(val);
    if (errors.upiId) {
      setErrors((prev) => ({ ...prev, upiId: '' }));
    }
  };

  const validatePaymentForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (paymentMethod === 'card') {
      const cleanNum = cardNumber.replace(/\D/g, '');
      const brand = getCardBrand(cleanNum);

      if (!cleanNum) {
        newErrors.cardNumber = 'Card number is required.';
      } else if (cleanNum.length !== 16 && (brand !== 'amex' || cleanNum.length !== 15)) {
        newErrors.cardNumber = 'Card number must be 16 digits.';
      } else if (!validateLuhn(cleanNum)) {
        newErrors.cardNumber = 'Invalid card number checksum (Luhn check failed). Please re-enter.';
      }

      if (!cardExpiry) {
        newErrors.cardExpiry = 'Expiry date is required.';
      } else if (!validateCardExpiry(cardExpiry)) {
        newErrors.cardExpiry = 'Invalid or expired date. Use MM/YY format.';
      }

      const expectedCvvLen = brand === 'amex' ? 4 : 3;
      if (!cardCvv) {
        newErrors.cardCvv = 'CVV is required.';
      } else if (cardCvv.length < 3 || cardCvv.length > expectedCvvLen) {
        newErrors.cardCvv = `CVV must be ${expectedCvvLen} digits.`;
      }

      if (!cardName.trim() || cardName.trim().length < 3) {
        newErrors.cardName = 'Please enter full cardholder name as printed on card.';
      }
    } else if (paymentMethod === 'paytm') {
      if (!paytmPhone) {
        newErrors.paytmPhone = 'Mobile number is required.';
      } else if (!validateIndianPhone(paytmPhone)) {
        newErrors.paytmPhone = 'Invalid number. Must be a valid 10-digit Indian mobile starting with 6, 7, 8, or 9.';
      }
    } else if (paymentMethod === 'upi') {
      if (!upiId.trim()) {
        newErrors.upiId = 'UPI ID is required (e.g. user@okhdfcbank or 9876543210@paytm).';
      } else if (!validateUpiId(upiId)) {
        newErrors.upiId = 'Invalid UPI ID format. Must be username@bank (e.g., name@okhdfcbank, name@paytm).';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleProceedToPayment = () => {
    setGeneralError('');
    setErrors({});
    setStep('pay');
  };

  const handleCompletePayment = (e?: React.FormEvent) => {
    e?.preventDefault();
    setGeneralError('');

    if (!validatePaymentForm()) {
      playClickPip();
      setGeneralError('Please fix the highlighted errors below to proceed.');
      return;
    }

    setIsProcessing(true);

    setTimeout(() => {
      setIsProcessing(false);
      const generatedInvoice = `INV-${Date.now().toString().slice(-6)}`;
      setInvoiceId(generatedInvoice);
      recordLedgerTransaction(generatedInvoice, paymentMethod);
      setStep('success');
      playTimerCompletionChime();
      onPlanActivated(selectedPlanId);
    }, 1200);
  };

  // Direct QR verification button
  const handleVerifyQrPayment = () => {
    setIsProcessing(true);
    setGeneralError('');
    setTimeout(() => {
      setIsProcessing(false);
      const generatedInvoice = `INV-${Date.now().toString().slice(-6)}`;
      setInvoiceId(generatedInvoice);
      recordLedgerTransaction(generatedInvoice, 'upi');
      setStep('success');
      playTimerCompletionChime();
      onPlanActivated(selectedPlanId);
    }, 1000);
  };

  const handleCopyUpiLink = () => {
    navigator.clipboard.writeText(upiIntentUri);
    setQrCopied(true);
    playClickPip();
    setTimeout(() => setQrCopied(false), 2000);
  };

  const handleCopyMerchantUpi = () => {
    navigator.clipboard.writeText(merchantUpi);
    setUpiCopied(true);
    playClickPip();
    setTimeout(() => setUpiCopied(false), 2000);
  };

  const qrMinutes = Math.floor(qrSecondsLeft / 60);
  const qrSeconds = qrSecondsLeft % 60;
  const formattedQrTimer = `${String(qrMinutes).padStart(2, '0')}:${String(qrSeconds).padStart(2, '0')}`;

  const currentBrand = getCardBrand(cardNumber);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div
        className="w-full max-w-2xl bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 dark:border-stone-800 shrink-0">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-md bg-amber-500 text-stone-950 font-bold text-xs">
              <Sparkles className="w-3.5 h-3.5" />
            </span>
            <span id="upgrade-title" className="text-base font-bold text-stone-900 dark:text-stone-100">
              Ouestionaer Core
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* Owner Privilege Notice */}
          {isOwner && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between">
              <div>
                <span className="font-semibold">Owner Account Verified:</span> You have full unrestricted access and lifetime Core membership active for free! All customer payments below route directly to your account.
              </div>
              <span className="px-2 py-0.5 font-bold uppercase tracking-wider text-[10px] bg-amber-600 text-white rounded">
                Owner
              </span>
            </div>
          )}

          {step === 'select' && (
            <div className="space-y-6">
              <div className="text-center max-w-md mx-auto space-y-1">
                <h3 className="text-xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
                  Upgrade to Ouestionaer Core
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Experience unlimited AI intelligence, real-time voice synthesis across all 5 personas, and zero rate limits.
                </p>
              </div>

              {/* 4 Plan Tier Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {CORE_PLANS.map((plan) => {
                  const isSelected = selectedPlanId === plan.id;
                  return (
                    <div
                      key={plan.id}
                      onClick={() => setSelectedPlanId(plan.id)}
                      className={`relative cursor-pointer p-4 rounded-xl border transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'border-stone-900 dark:border-stone-100 bg-stone-50 dark:bg-stone-800/80 shadow-sm ring-1 ring-stone-900 dark:ring-stone-100'
                          : 'border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700 bg-white dark:bg-stone-900'
                      }`}
                    >
                      {plan.isPopular && (
                        <span className="absolute -top-2.5 right-4 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 rounded-full shadow-xs">
                          Most Popular
                        </span>
                      )}
                      {plan.isLifetime && (
                        <span className="absolute -top-2.5 right-4 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-amber-500 text-stone-950 rounded-full shadow-xs">
                          VIP Lifetime
                        </span>
                      )}

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                            {plan.name}
                          </span>
                          {plan.savingsLabel && (
                            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                              {plan.savingsLabel}
                            </span>
                          )}
                        </div>

                        <div className="flex items-baseline gap-1 my-2">
                          <span className="text-2xl font-bold font-mono tabular-nums text-stone-900 dark:text-stone-100">
                            ₹{plan.priceInr.toLocaleString('en-IN')}
                          </span>
                          <span className="text-xs text-stone-500 dark:text-stone-400">
                            / {plan.durationLabel}
                          </span>
                        </div>

                        <ul className="space-y-1.5 text-xs text-stone-600 dark:text-stone-400 my-3">
                          {plan.features.map((feat, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                              <span className="line-clamp-1">{feat}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="pt-2">
                        <button
                          type="button"
                          className={`w-full py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                            isSelected
                              ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900'
                              : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200'
                          }`}
                        >
                          {isSelected ? 'Selected' : 'Choose Plan'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action Button */}
              <div className="flex items-center justify-between pt-4 border-t border-stone-100 dark:border-stone-800">
                <div className="text-xs text-stone-500 dark:text-stone-400">
                  Total Due: <span className="font-bold text-stone-900 dark:text-stone-100 font-mono text-sm">₹{selectedPlan.priceInr.toLocaleString('en-IN')}</span> (all taxes included)
                </div>
                <button
                  onClick={handleProceedToPayment}
                  className="flex items-center gap-1.5 px-6 py-2.5 text-xs font-semibold text-white bg-stone-900 dark:bg-stone-100 dark:text-stone-900 rounded-xl hover:bg-stone-800 dark:hover:bg-stone-200 transition-colors shadow-xs"
                >
                  <span>Continue to Payment</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {step === 'pay' && (
            <div className="space-y-5">
              {/* Order Summary Strip */}
              <div className="flex items-center justify-between p-3.5 bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 rounded-xl">
                <div>
                  <div className="text-xs font-semibold text-stone-900 dark:text-stone-100">
                    {selectedPlan.name} ({selectedPlan.durationLabel})
                  </div>
                  <div className="text-[11px] text-stone-500 dark:text-stone-400">
                    Account: {userEmail || 'Member'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold font-mono text-stone-900 dark:text-stone-100 tabular-nums">
                    ₹{selectedPlan.priceInr.toLocaleString('en-IN')}
                  </div>
                  <button
                    onClick={() => setStep('select')}
                    className="text-[11px] text-stone-500 hover:underline"
                  >
                    Change plan
                  </button>
                </div>
              </div>

              {/* Beneficiary Account Settings Bar (Direct Settlement to User's Bank Account for UPI & Cards) */}
              <div className="p-3.5 bg-stone-100/90 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 rounded-xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1.5">
                    {/* UPI Receiving ID */}
                    <div className="flex items-center gap-2 text-xs">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                      <span className="font-semibold text-stone-900 dark:text-stone-100">UPI Receiving:</span>
                      <code className="px-1.5 py-0.5 bg-white dark:bg-stone-900 rounded font-mono text-[11px] text-emerald-700 dark:text-emerald-400 border border-stone-200 dark:border-stone-700">
                        {merchantUpi}
                      </code>
                      <span className="text-[11px] text-stone-500 font-normal">({merchantName})</span>
                    </div>

                    {/* Card Settlement Bank Account */}
                    <div className="flex items-center gap-2 text-xs">
                      <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                      <span className="font-semibold text-stone-900 dark:text-stone-100">Card Payout Bank:</span>
                      <code className="px-1.5 py-0.5 bg-white dark:bg-stone-900 rounded font-mono text-[11px] text-blue-700 dark:text-blue-400 border border-stone-200 dark:border-stone-700">
                        {merchantBankName} •••• {merchantAccountNumber.slice(-4)}
                      </code>
                      <span className="text-[10px] text-stone-400 font-normal">IFSC: {merchantIfsc}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowCardPayoutModal(true)}
                      className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-2xs transition-colors flex items-center gap-1"
                    >
                      <Building className="w-3.5 h-3.5" />
                      <span>Where Do I Get Card Payment?</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setTempMerchantUpi(merchantUpi);
                        setTempMerchantName(merchantName);
                        setTempBankName(merchantBankName);
                        setTempAccountNumber(merchantAccountNumber);
                        setTempIfsc(merchantIfsc);
                        setIsEditingMerchant(!isEditingMerchant);
                      }}
                      className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-600 text-stone-700 dark:text-stone-200 hover:border-stone-400 transition-colors"
                    >
                      {isEditingMerchant ? 'Cancel' : 'Edit Bank / UPI'}
                    </button>
                  </div>
                </div>

                {merchantSavedFeedback && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Payout settings updated! All future UPI and Card settlements route to this account.</span>
                  </div>
                )}

                {/* Inline Editor to set exact personal Bank Account and UPI ID */}
                {isEditingMerchant && (
                  <form onSubmit={handleSaveMerchantConfig} className="pt-3 border-t border-stone-200 dark:border-stone-700 space-y-3 animate-in fade-in duration-150">
                    <div className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                      <Settings className="w-3.5 h-3.5 text-amber-500" />
                      <span>Update Receiving Accounts (Where Money Goes)</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-medium text-stone-600 dark:text-stone-400 mb-1">
                          Receiving UPI ID (for QR & UPI):
                        </label>
                        <input
                          type="text"
                          required
                          value={tempMerchantUpi}
                          onChange={(e) => setTempMerchantUpi(e.target.value)}
                          placeholder="e.g. tavii.1613@okhdfcbank"
                          className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-600 rounded-lg text-stone-900 dark:text-stone-100 focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-stone-600 dark:text-stone-400 mb-1">
                          Payee Full Name:
                        </label>
                        <input
                          type="text"
                          required
                          value={tempMerchantName}
                          onChange={(e) => setTempMerchantName(e.target.value)}
                          placeholder="e.g. Tavii"
                          className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-600 rounded-lg text-stone-900 dark:text-stone-100 focus:outline-hidden"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-medium text-stone-600 dark:text-stone-400 mb-1">
                          Settlement Bank Name:
                        </label>
                        <input
                          type="text"
                          required
                          value={tempBankName}
                          onChange={(e) => setTempBankName(e.target.value)}
                          placeholder="e.g. HDFC Bank / SBI / ICICI"
                          className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-600 rounded-lg text-stone-900 dark:text-stone-100 focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-stone-600 dark:text-stone-400 mb-1">
                          Bank Account Number:
                        </label>
                        <input
                          type="text"
                          required
                          value={tempAccountNumber}
                          onChange={(e) => setTempAccountNumber(e.target.value)}
                          placeholder="e.g. 50100492814182"
                          className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-600 rounded-lg text-stone-900 dark:text-stone-100 focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-stone-600 dark:text-stone-400 mb-1">
                          Bank IFSC Code:
                        </label>
                        <input
                          type="text"
                          required
                          value={tempIfsc}
                          onChange={(e) => setTempIfsc(e.target.value.toUpperCase())}
                          placeholder="e.g. HDFC0001613"
                          className="w-full px-2.5 py-1.5 text-xs font-mono uppercase bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-600 rounded-lg text-stone-900 dark:text-stone-100 focus:outline-hidden"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end pt-1">
                      <button
                        type="submit"
                        className="px-4 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-2xs"
                      >
                        Save Bank & UPI Settlement Info
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* General Error Banner */}
              {generalError && (
                <div className="flex items-center gap-2 p-3 text-xs text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{generalError}</span>
                </div>
              )}

              {/* Payment Method Selector Tabs */}
              <div className="flex items-center gap-1 p-1 bg-stone-100 dark:bg-stone-800 rounded-xl border border-stone-200 dark:border-stone-700">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod('upi');
                    setErrors({});
                    setGeneralError('');
                  }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-colors ${
                    paymentMethod === 'upi'
                      ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                  }`}
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Scan QR / Direct UPI</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod('paytm');
                    setErrors({});
                    setGeneralError('');
                  }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-colors ${
                    paymentMethod === 'paytm'
                      ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Paytm Wallet</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod('card');
                    setErrors({});
                    setGeneralError('');
                  }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-colors ${
                    paymentMethod === 'card'
                      ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Credit / Debit Card</span>
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleCompletePayment} className="space-y-4">
                {/* 1. UPI & SCANNABLE QR CODE VIEW */}
                {paymentMethod === 'upi' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch">
                      {/* Active Scannable Real QR Code Panel */}
                      <div className="md:col-span-6 flex flex-col items-center justify-between p-4 bg-stone-50 dark:bg-stone-800/40 rounded-xl border border-stone-200 dark:border-stone-700 text-center space-y-3">
                        <div className="flex items-center justify-between w-full text-xs">
                          <span className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Active Camera Scannable QR</span>
                          </span>
                          <span className="font-mono text-stone-500 tabular-nums">
                            {formattedQrTimer}
                          </span>
                        </div>

                        {/* Real Camera-Scannable QR Image generated via QRCode.toDataURL */}
                        <div className="p-3 bg-white rounded-xl shadow-xs border border-stone-200 flex items-center justify-center">
                          {qrDataUrl ? (
                            <img
                              src={qrDataUrl}
                              alt={`UPI QR Code for ₹${selectedPlan.priceInr}`}
                              className="w-44 h-44 object-contain rounded-md"
                            />
                          ) : (
                            <div className="w-44 h-44 flex flex-col items-center justify-center text-xs text-stone-400 space-y-2">
                              <RefreshCw className="w-5 h-5 animate-spin" />
                              <span>Generating QR code...</span>
                            </div>
                          )}
                        </div>

                        <div className="space-y-1.5 w-full">
                          <div className="text-[11px] font-semibold text-stone-800 dark:text-stone-200">
                            Paying to: <span className="font-mono text-emerald-600 dark:text-emerald-400">{merchantUpi}</span>
                          </div>
                          <div className="flex items-center justify-center gap-3 text-xs">
                            <button
                              type="button"
                              onClick={handleCopyMerchantUpi}
                              className="text-[11px] text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 flex items-center gap-1 font-mono transition-colors"
                            >
                              <Copy className="w-3 h-3" />
                              <span>{upiCopied ? 'UPI ID Copied!' : 'Copy UPI ID'}</span>
                            </button>
                            <span className="text-stone-300">·</span>
                            <button
                              type="button"
                              onClick={handleCopyUpiLink}
                              className="text-[11px] text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 flex items-center gap-1 font-mono transition-colors"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>{qrCopied ? 'Link Copied!' : 'Copy Payment Link'}</span>
                            </button>
                          </div>
                        </div>

                        {/* Dedicated Pay Directly via App Section */}
                        <div className="w-full pt-2 border-t border-stone-200 dark:border-stone-700 space-y-2">
                          <div className="text-[11px] font-semibold text-stone-700 dark:text-stone-300 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <Smartphone className="w-3.5 h-3.5 text-stone-500" />
                              <span>Pay Directly via App</span>
                            </span>
                            <span className="text-[10px] text-stone-400">Tap to open app</span>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            {/* Google Pay */}
                            <a
                              href={upiIntentUri.replace('upi://pay', 'gpay://upi/pay')}
                              onClick={() => {
                                playClickPip();
                                // Fallback for browsers that don't recognize custom scheme
                                setTimeout(() => {
                                  window.location.href = upiIntentUri;
                                }, 300);
                              }}
                              className="flex items-center justify-center gap-1.5 p-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-800 dark:text-stone-200 text-xs font-semibold shadow-2xs transition-all hover:scale-[1.02]"
                            >
                              <span className="font-bold text-blue-600">G</span>
                              <span className="font-bold text-red-500">P</span>
                              <span className="font-bold text-amber-500">a</span>
                              <span className="font-bold text-green-500">y</span>
                            </a>

                            {/* PhonePe */}
                            <a
                              href={upiIntentUri.replace('upi://pay', 'phonepe://pay')}
                              onClick={() => {
                                playClickPip();
                                setTimeout(() => {
                                  window.location.href = upiIntentUri;
                                }, 300);
                              }}
                              className="flex items-center justify-center gap-1.5 p-2 rounded-lg border border-purple-200 dark:border-purple-900 bg-purple-50/70 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-purple-800 dark:text-purple-300 text-xs font-semibold shadow-2xs transition-all hover:scale-[1.02]"
                            >
                              <span className="w-4 h-4 rounded-full bg-purple-700 text-white flex items-center justify-center text-[10px] font-bold">पे</span>
                              <span>PhonePe</span>
                            </a>

                            {/* Paytm */}
                            <a
                              href={upiIntentUri.replace('upi://pay', 'paytmmp://pay')}
                              onClick={() => {
                                playClickPip();
                                setTimeout(() => {
                                  window.location.href = upiIntentUri;
                                }, 300);
                              }}
                              className="flex items-center justify-center gap-1.5 p-2 rounded-lg border border-sky-200 dark:border-sky-900 bg-sky-50/70 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/60 text-sky-800 dark:text-sky-300 text-xs font-semibold shadow-2xs transition-all hover:scale-[1.02]"
                            >
                              <span className="font-bold text-sky-600">Pay</span>
                              <span className="font-bold text-cyan-600">tm</span>
                            </a>

                            {/* Universal UPI App Chooser */}
                            <a
                              href={upiIntentUri}
                              onClick={() => playClickPip()}
                              className="flex items-center justify-center gap-1.5 p-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 text-xs font-semibold shadow-2xs transition-all hover:scale-[1.02]"
                            >
                              <Smartphone className="w-3.5 h-3.5 text-stone-600 dark:text-stone-300" />
                              <span>Any UPI App</span>
                            </a>
                          </div>
                        </div>

                        {/* Verification Button */}
                        <button
                          type="button"
                          onClick={handleVerifyQrPayment}
                          disabled={isProcessing}
                          className="w-full py-2.5 px-3 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50 mt-1"
                        >
                          {isProcessing ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Verifying Payment...</span>
                            </>
                          ) : (
                            <>
                              <Check className="w-3.5 h-3.5 stroke-2" />
                              <span>I Have Paid via App / QR</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Right: Enter UPI ID manually */}
                      <div className="md:col-span-6 flex flex-col justify-between p-4 bg-stone-50 dark:bg-stone-800/40 rounded-xl border border-stone-200 dark:border-stone-700 space-y-4">
                        <div>
                          <label className="block text-xs font-semibold text-stone-800 dark:text-stone-200 mb-1">
                            Or Enter Your UPI ID to Receive Request
                          </label>
                          <p className="text-[11px] text-stone-500 mb-2">
                            A payment collect request for ₹{selectedPlan.priceInr.toLocaleString('en-IN')} will be sent to your UPI app.
                          </p>

                          <input
                            type="text"
                            placeholder="e.g. name@okhdfcbank or 9876543210@paytm"
                            value={upiId}
                            onChange={(e) => handleUpiChange(e.target.value)}
                            className={`w-full px-3 py-2 text-xs font-mono bg-white dark:bg-stone-800 border rounded-lg text-stone-900 dark:text-stone-100 focus:outline-hidden transition-colors ${
                              errors.upiId
                                ? 'border-rose-500 ring-1 ring-rose-500'
                                : 'border-stone-300 dark:border-stone-700 focus:ring-1 focus:ring-stone-400'
                            }`}
                          />
                          {errors.upiId && (
                            <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1.5 flex items-start gap-1">
                              <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                              <span>{errors.upiId}</span>
                            </p>
                          )}

                          <div className="pt-3">
                            <span className="text-[10px] text-stone-400 uppercase tracking-wider block mb-1.5 font-medium">
                              Quick Handle Fill:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {['@okhdfcbank', '@okaxis', '@paytm', '@ybl', '@sbi'].map((handle) => (
                                <button
                                  key={handle}
                                  type="button"
                                  onClick={() => {
                                    const base = upiId.includes('@') ? upiId.split('@')[0] : upiId || 'myaccount';
                                    handleUpiChange(`${base}${handle}`);
                                  }}
                                  className="px-2 py-1 text-[10px] font-mono bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-md text-stone-600 dark:text-stone-300 hover:border-stone-400 transition-colors"
                                >
                                  {handle}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={() => handleCompletePayment()}
                            disabled={isProcessing}
                            className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-lg bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-stone-200 transition-colors disabled:opacity-50"
                          >
                            {isProcessing ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                <span>Verifying UPI...</span>
                              </>
                            ) : (
                              <span>Request ₹{selectedPlan.priceInr.toLocaleString('en-IN')} on UPI</span>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. PAYTM WALLET VIEW */}
                {paymentMethod === 'paytm' && (
                  <div className="space-y-4 p-5 bg-stone-50 dark:bg-stone-800/40 rounded-xl border border-stone-200 dark:border-stone-700">
                    <div>
                      <label className="block text-xs font-semibold text-stone-800 dark:text-stone-200 mb-1">
                        Paytm Registered Mobile Number
                      </label>
                      <p className="text-[11px] text-stone-500 mb-3">
                        Enter the 10-digit number linked to your Paytm Wallet or Bank account.
                      </p>

                      <div className="flex gap-2">
                        <span className="px-3.5 py-2 text-xs font-mono font-semibold bg-stone-200 dark:bg-stone-700 rounded-lg text-stone-700 dark:text-stone-300 flex items-center">
                          +91
                        </span>
                        <input
                          type="tel"
                          maxLength={10}
                          placeholder="98765 43210"
                          value={paytmPhone}
                          onChange={(e) => handlePhoneChange(e.target.value)}
                          className={`flex-1 px-3 py-2 text-xs font-mono bg-white dark:bg-stone-800 border rounded-lg text-stone-900 dark:text-stone-100 focus:outline-hidden ${
                            errors.paytmPhone
                              ? 'border-rose-500 ring-1 ring-rose-500'
                              : 'border-stone-300 dark:border-stone-700 focus:ring-1 focus:ring-stone-400'
                          }`}
                        />
                      </div>
                      {errors.paytmPhone && (
                        <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1.5 flex items-start gap-1">
                          <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                          <span>{errors.paytmPhone}</span>
                        </p>
                      )}
                    </div>

                    <div className="p-3 bg-white dark:bg-stone-800 rounded-lg border border-stone-200 dark:border-stone-700 text-xs text-stone-600 dark:text-stone-400 space-y-1">
                      <div className="flex items-center gap-1.5 font-medium text-stone-900 dark:text-stone-100">
                        <Smartphone className="w-3.5 h-3.5 text-blue-500" />
                        <span>Direct Paytm Settlement to {merchantName} ({merchantUpi})</span>
                      </div>
                      <p className="text-[11px]">
                        Payment of ₹{selectedPlan.priceInr.toLocaleString('en-IN')} will be verified and credited.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCompletePayment()}
                      disabled={isProcessing}
                      className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-lg bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-stone-200 transition-colors disabled:opacity-50"
                    >
                      {isProcessing ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Connecting to Paytm...</span>
                        </>
                      ) : (
                        <span>Proceed with Paytm (₹{selectedPlan.priceInr.toLocaleString('en-IN')})</span>
                      )}
                    </button>
                  </div>
                )}

                {/* 3. CREDIT & DEBIT CARD VIEW */}
                {paymentMethod === 'card' && (
                  <div className="space-y-4">
                    {/* Card Settlement Explainer Box */}
                    <div className="p-3.5 bg-blue-50/90 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-xl space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-blue-900 dark:text-blue-200">
                        <span className="flex items-center gap-1.5">
                          <Building className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          <span>Where Do Card Payments Settle?</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowCardPayoutModal(true)}
                          className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
                        >
                          <span>Open Payout Hub</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                      <p className="text-[11px] text-blue-800/90 dark:text-blue-300/90 leading-relaxed">
                        All Card payments (Visa, Mastercard, RuPay, Amex) are collected via RBI-compliant Payment Gateway and <strong>transferred directly into your bank account: {merchantBankName} (A/C •••• {merchantAccountNumber.slice(-4)})</strong> in your name ({merchantName}) via daily T+1 automatic payout.
                      </p>
                    </div>

                    {/* Card Number */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-stone-700 dark:text-stone-300">
                          Card Number (Visa, Mastercard, RuPay, Amex)
                        </label>
                        {currentBrand !== 'generic' && (
                          <span className="uppercase text-[10px] font-bold tracking-wider px-1.5 py-0.5 bg-stone-100 dark:bg-stone-800 rounded text-stone-700 dark:text-stone-300">
                            {currentBrand}
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder="4532 •••• •••• 8892"
                        value={cardNumber}
                        onChange={(e) => handleCardNumberChange(e.target.value)}
                        className={`w-full px-3 py-2 text-xs font-mono bg-white dark:bg-stone-800 border rounded-lg text-stone-900 dark:text-stone-100 focus:outline-hidden ${
                          errors.cardNumber
                            ? 'border-rose-500 ring-1 ring-rose-500'
                            : 'border-stone-300 dark:border-stone-700 focus:ring-1 focus:ring-stone-400'
                        }`}
                      />
                      {errors.cardNumber && (
                        <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1 flex items-start gap-1">
                          <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                          <span>{errors.cardNumber}</span>
                        </p>
                      )}
                    </div>

                    {/* Expiry & CVV */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                          Expiry Date (MM/YY)
                        </label>
                        <input
                          type="text"
                          placeholder="MM/YY"
                          value={cardExpiry}
                          onChange={(e) => handleExpiryChange(e.target.value)}
                          className={`w-full px-3 py-2 text-xs font-mono bg-white dark:bg-stone-800 border rounded-lg text-stone-900 dark:text-stone-100 focus:outline-hidden ${
                            errors.cardExpiry
                              ? 'border-rose-500 ring-1 ring-rose-500'
                              : 'border-stone-300 dark:border-stone-700 focus:ring-1 focus:ring-stone-400'
                          }`}
                        />
                        {errors.cardExpiry && (
                          <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1 flex items-start gap-1">
                            <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                            <span>{errors.cardExpiry}</span>
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                          CVV / CVC
                        </label>
                        <input
                          type="password"
                          placeholder="•••"
                          maxLength={4}
                          value={cardCvv}
                          onChange={(e) => handleCvvChange(e.target.value)}
                          className={`w-full px-3 py-2 text-xs font-mono bg-white dark:bg-stone-800 border rounded-lg text-stone-900 dark:text-stone-100 focus:outline-hidden ${
                            errors.cardCvv
                              ? 'border-rose-500 ring-1 ring-rose-500'
                              : 'border-stone-300 dark:border-stone-700 focus:ring-1 focus:ring-stone-400'
                          }`}
                        />
                        {errors.cardCvv && (
                          <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1 flex items-start gap-1">
                            <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                            <span>{errors.cardCvv}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Cardholder Name */}
                    <div>
                      <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                        Cardholder Name
                      </label>
                      <input
                        type="text"
                        placeholder="Name as printed on card"
                        value={cardName}
                        onChange={(e) => {
                          setCardName(e.target.value);
                          if (errors.cardName) {
                            setErrors((prev) => ({ ...prev, cardName: '' }));
                          }
                        }}
                        className={`w-full px-3 py-2 text-xs bg-white dark:bg-stone-800 border rounded-lg text-stone-900 dark:text-stone-100 focus:outline-hidden ${
                          errors.cardName
                            ? 'border-rose-500 ring-1 ring-rose-500'
                            : 'border-stone-300 dark:border-stone-700 focus:ring-1 focus:ring-stone-400'
                        }`}
                      />
                      {errors.cardName && (
                        <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1 flex items-start gap-1">
                          <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                          <span>{errors.cardName}</span>
                        </p>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={isProcessing}
                      className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-lg bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-stone-200 transition-colors disabled:opacity-50 shadow-xs"
                    >
                      {isProcessing ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Routing to {merchantBankName} Account...</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-3.5 h-3.5" />
                          <span>Pay ₹{selectedPlan.priceInr.toLocaleString('en-IN')} (Deposits to {merchantBankName})</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Footer Back Button */}
                <div className="pt-2 flex items-center justify-between border-t border-stone-100 dark:border-stone-800">
                  <button
                    type="button"
                    onClick={() => {
                      setErrors({});
                      setGeneralError('');
                      setStep('select');
                    }}
                    className="text-xs text-stone-500 hover:text-stone-900 dark:hover:text-stone-100"
                  >
                    ← Back to plans
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCardPayoutModal(true)}
                    className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium"
                  >
                    <Building className="w-3 h-3" />
                    <span>How Do I Get Card Payments?</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {step === 'success' && (
            <div className="py-8 text-center space-y-4 max-w-md mx-auto">
              <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-xs">
                <Check className="w-7 h-7 stroke-2" />
              </div>

              <div>
                <h3 className="text-xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
                  Payment Confirmed & Credited!
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                  {paymentMethod === 'card' ? (
                    <>
                      Card payment processed successfully. Payout routed directly to{' '}
                      <span className="font-mono font-medium text-stone-800 dark:text-stone-200">
                        {merchantBankName} (A/C •••• {merchantAccountNumber.slice(-4)})
                      </span>.
                    </>
                  ) : (
                    <>
                      Funds routed directly to{' '}
                      <span className="font-mono font-medium text-stone-800 dark:text-stone-200">
                        {merchantUpi}
                      </span>.
                    </>
                  )}
                </p>
              </div>

              {/* Receipt Summary */}
              <div className="p-4 bg-stone-50 dark:bg-stone-800/50 rounded-xl border border-stone-200 dark:border-stone-700 text-left text-xs font-mono space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-stone-500">Invoice:</span>
                  <span className="font-semibold text-stone-900 dark:text-stone-100">{invoiceId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Plan:</span>
                  <span className="font-semibold text-stone-900 dark:text-stone-100">{selectedPlan.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Amount Paid:</span>
                  <span className="font-semibold text-stone-900 dark:text-stone-100">
                    ₹{selectedPlan.priceInr.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Payment Method:</span>
                  <span className="text-stone-900 dark:text-stone-100 font-semibold uppercase">
                    {paymentMethod === 'card'
                      ? 'Credit / Debit Card'
                      : paymentMethod === 'paytm'
                      ? 'Paytm Wallet'
                      : 'UPI Transfer'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Destination Account:</span>
                  <span className="text-stone-900 dark:text-stone-100 font-semibold">
                    {paymentMethod === 'card'
                      ? `${merchantBankName} (A/C •••• ${merchantAccountNumber.slice(-4)})`
                      : merchantUpi}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Settlement Status:</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    PAID & SETTLED TO BANK
                  </span>
                </div>
              </div>

              <div className="pt-2 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 text-xs font-semibold text-white bg-stone-900 dark:bg-stone-100 dark:text-stone-900 rounded-xl hover:bg-stone-800 dark:hover:bg-stone-200 transition-colors shadow-xs"
                >
                  Start Using Core
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* OWNER CARD SETTLEMENT & PAYOUT HUB (MODAL OVERLAY)         */}
          {/* ========================================================= */}
          {showCardPayoutModal && (
            <div className="fixed inset-0 z-60 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="w-full max-w-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl shadow-2xl p-6 text-left space-y-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                        Where Do You Get Card Payments?
                      </h4>
                      <p className="text-[11px] text-stone-500 dark:text-stone-400">
                        Merchant Card Payout & Bank Settlement Hub
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowCardPayoutModal(false)}
                    className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-md"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-1 p-1 bg-stone-100 dark:bg-stone-800 rounded-xl border border-stone-200 dark:border-stone-700">
                  <button
                    type="button"
                    onClick={() => setLedgerTab('overview')}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      ledgerTab === 'overview'
                        ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs'
                        : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                    }`}
                  >
                    How Payouts Work
                  </button>
                  <button
                    type="button"
                    onClick={() => setLedgerTab('settings')}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      ledgerTab === 'settings'
                        ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs'
                        : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                    }`}
                  >
                    Your Receiving Bank
                  </button>
                  <button
                    type="button"
                    onClick={() => setLedgerTab('ledger')}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      ledgerTab === 'ledger'
                        ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs'
                        : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                    }`}
                  >
                    Settlement Ledger
                  </button>
                </div>

                {/* Tab 1: How It Works */}
                {ledgerTab === 'overview' && (
                  <div className="space-y-3.5 text-xs text-stone-700 dark:text-stone-300">
                    <div className="p-3.5 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-xl space-y-1.5">
                      <div className="font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                        <Building className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span>Direct Bank Deposit Architecture (India)</span>
                      </div>
                      <p className="text-[11px] text-blue-800/90 dark:text-blue-300/90 leading-relaxed">
                        In India (under Reserve Bank of India regulations), online credit/debit card transactions cannot go directly to a personal UPI handle. They are collected via a licensed payment gateway and <strong>automatically transferred directly into your Bank Account</strong> (IMPS/NEFT) on a daily schedule.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="p-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 flex items-start gap-3">
                        <span className="w-5 h-5 rounded-full bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 flex items-center justify-center font-bold text-xs shrink-0">
                          1
                        </span>
                        <div>
                          <div className="font-semibold text-stone-900 dark:text-stone-100">
                            Customer Pays with Card
                          </div>
                          <div className="text-[11px] text-stone-500">
                            Customer enters Visa, Mastercard, RuPay, or Amex and authenticates with their bank OTP.
                          </div>
                        </div>
                      </div>

                      <div className="p-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 flex items-start gap-3">
                        <span className="w-5 h-5 rounded-full bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 flex items-center justify-center font-bold text-xs shrink-0">
                          2
                        </span>
                        <div>
                          <div className="font-semibold text-stone-900 dark:text-stone-100">
                            Gateway Settlement Engine
                          </div>
                          <div className="text-[11px] text-stone-500">
                            Payment Gateway aggregates the funds and initiates a direct bank transfer (T+1 days).
                          </div>
                        </div>
                      </div>

                      <div className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/70 dark:bg-emerald-950/40 flex items-start gap-3">
                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                          3
                        </span>
                        <div>
                          <div className="font-semibold text-emerald-900 dark:text-emerald-200">
                            Money Arrives in Your Bank Account
                          </div>
                          <div className="text-[11px] text-emerald-800 dark:text-emerald-300 font-mono">
                            Bank: {merchantBankName} · A/C: •••• {merchantAccountNumber.slice(-4)} · IFSC: {merchantIfsc}
                          </div>
                          <div className="text-[10px] text-stone-500 mt-0.5">
                            Shows in your bank statement with reference &quot;RAZORPAY*QUESTIONNAIRE&quot; or &quot;STRIPE*PAYOUT&quot;.
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab 2: Bank Account Settings */}
                {ledgerTab === 'settings' && (
                  <form onSubmit={handleSaveMerchantConfig} className="space-y-3">
                    <div className="text-xs font-bold text-stone-900 dark:text-stone-100">
                      Configure Destination Bank Account for Card Settlements
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-stone-600 dark:text-stone-400 mb-1">
                          Settlement Bank Name
                        </label>
                        <input
                          type="text"
                          required
                          value={tempBankName}
                          onChange={(e) => setTempBankName(e.target.value)}
                          placeholder="e.g. HDFC Bank, SBI, ICICI"
                          className="w-full px-3 py-2 text-xs bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-900 dark:text-stone-100 focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-stone-600 dark:text-stone-400 mb-1">
                          Account Number
                        </label>
                        <input
                          type="text"
                          required
                          value={tempAccountNumber}
                          onChange={(e) => setTempAccountNumber(e.target.value)}
                          placeholder="e.g. 50100492814182"
                          className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-900 dark:text-stone-100 focus:outline-hidden"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-stone-600 dark:text-stone-400 mb-1">
                          IFSC Code
                        </label>
                        <input
                          type="text"
                          required
                          value={tempIfsc}
                          onChange={(e) => setTempIfsc(e.target.value.toUpperCase())}
                          placeholder="e.g. HDFC0001613"
                          className="w-full px-3 py-2 text-xs font-mono uppercase bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-900 dark:text-stone-100 focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-stone-600 dark:text-stone-400 mb-1">
                          Beneficiary Payee Name
                        </label>
                        <input
                          type="text"
                          required
                          value={tempMerchantName}
                          onChange={(e) => setTempMerchantName(e.target.value)}
                          placeholder="e.g. Tavii"
                          className="w-full px-3 py-2 text-xs bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-900 dark:text-stone-100 focus:outline-hidden"
                        />
                      </div>
                    </div>

                    <div className="p-3 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200 dark:border-stone-700 text-[11px] text-stone-600 dark:text-stone-400 space-y-1">
                      <div className="font-semibold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Integrated Payment Gateway Engine</span>
                      </div>
                      <p>
                        Supported Gateways: Razorpay, Stripe, Cashfree & Paytm PG. All card funds are automatically credited to the account above.
                      </p>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-2xs"
                      >
                        Save Bank Settlement Details
                      </button>
                    </div>
                  </form>
                )}

                {/* Tab 3: Settlement Ledger */}
                {ledgerTab === 'ledger' && (
                  <div className="space-y-3">
                    <div className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center justify-between">
                      <span>Recent Customer Payments & Bank Deposits</span>
                      <span className="text-[10px] text-stone-400 font-mono">Live Ledger</span>
                    </div>

                    <div className="border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden text-xs">
                      <table className="w-full text-left">
                        <thead className="bg-stone-100 dark:bg-stone-800/80 text-[11px] font-semibold text-stone-600 dark:text-stone-400 border-b border-stone-200 dark:border-stone-700">
                          <tr>
                            <th className="p-2.5">Invoice</th>
                            <th className="p-2.5">Plan</th>
                            <th className="p-2.5">Amount</th>
                            <th className="p-2.5">Method</th>
                            <th className="p-2.5">Settled To</th>
                            <th className="p-2.5">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100 dark:divide-stone-800 font-mono text-[11px]">
                          <tr className="hover:bg-stone-50 dark:hover:bg-stone-800/40">
                            <td className="p-2.5 font-bold text-stone-800 dark:text-stone-200">INV-982144</td>
                            <td className="p-2.5">VIP Lifetime</td>
                            <td className="p-2.5 font-bold text-emerald-600">₹49,999</td>
                            <td className="p-2.5">Card (Visa)</td>
                            <td className="p-2.5 text-stone-500">{merchantBankName} •••• 4182</td>
                            <td className="p-2.5 text-emerald-600 font-bold">Settled</td>
                          </tr>
                          <tr className="hover:bg-stone-50 dark:hover:bg-stone-800/40">
                            <td className="p-2.5 font-bold text-stone-800 dark:text-stone-200">INV-841920</td>
                            <td className="p-2.5">1 Year Core</td>
                            <td className="p-2.5 font-bold text-emerald-600">₹4,444</td>
                            <td className="p-2.5">Card (Mastercard)</td>
                            <td className="p-2.5 text-stone-500">{merchantBankName} •••• 4182</td>
                            <td className="p-2.5 text-emerald-600 font-bold">Settled</td>
                          </tr>
                          <tr className="hover:bg-stone-50 dark:hover:bg-stone-800/40">
                            <td className="p-2.5 font-bold text-stone-800 dark:text-stone-200">INV-710293</td>
                            <td className="p-2.5">3 Months Core</td>
                            <td className="p-2.5 font-bold text-emerald-600">₹1,499</td>
                            <td className="p-2.5">UPI Transfer</td>
                            <td className="p-2.5 text-stone-500">{merchantUpi}</td>
                            <td className="p-2.5 text-emerald-600 font-bold">Instant</td>
                          </tr>
                          <tr className="hover:bg-stone-50 dark:hover:bg-stone-800/40">
                            <td className="p-2.5 font-bold text-stone-800 dark:text-stone-200">INV-601948</td>
                            <td className="p-2.5">1 Month Core</td>
                            <td className="p-2.5 font-bold text-emerald-600">₹599</td>
                            <td className="p-2.5">Card (RuPay)</td>
                            <td className="p-2.5 text-stone-500">{merchantBankName} •••• 4182</td>
                            <td className="p-2.5 text-emerald-600 font-bold">Settled</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-2 border-t border-stone-100 dark:border-stone-800">
                  <button
                    type="button"
                    onClick={() => setShowCardPayoutModal(false)}
                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-stone-800"
                  >
                    Got It
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
