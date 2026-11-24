import React, { useRef } from 'react';
import { 
  X, 
  Printer, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  ShieldCheck, 
  Building2, 
  FileText,
  Copy
} from 'lucide-react';
import type { Invoice } from '../services/api';

interface InvoicePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  onRecordPayment?: (invoice: Invoice) => void;
  onApprove?: (invoice: Invoice) => void;
}

// Convert numbers to Indian Rupees in words
const numberToWords = (num: number): string => {
  const rounded = Math.round(num);
  if (rounded === 0) return 'Zero Rupees Only';

  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convertLessThanOneThousand = (n: number): string => {
    let str = '';
    if (n >= 100) {
      str += a[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n >= 20) {
      str += b[Math.floor(n / 10)] + ' ';
      n %= 10;
    }
    if (n > 0) {
      str += a[n] + ' ';
    }
    return str.trim();
  };

  let str = '';
  let n = rounded;

  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const remainder = n;

  if (crore > 0) {
    str += convertLessThanOneThousand(crore) + ' Crore ';
  }
  if (lakh > 0) {
    str += convertLessThanOneThousand(lakh) + ' Lakh ';
  }
  if (thousand > 0) {
    str += convertLessThanOneThousand(thousand) + ' Thousand ';
  }
  if (remainder > 0) {
    str += convertLessThanOneThousand(remainder) + ' ';
  }

  return str.trim() + ' Rupees Only';
};

export const InvoicePrintModal: React.FC<InvoicePrintModalProps> = ({
  isOpen,
  onClose,
  invoice,
  onRecordPayment,
  onApprove,
}) => {
  const printContentRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !invoice) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleCopySeal = () => {
    navigator.clipboard.writeText(invoice.sha256Seal);
    alert('Cryptographic SHA-256 seal copied to clipboard.');
  };

  const isZeroAmount = Number(invoice.totalPayable ?? 0) <= 0 || Boolean(invoice.noPaymentRequired);

  const getStatusBadge = (status: string) => {
    if (status === 'APPROVED' && isZeroAmount) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
          <CheckCircle className="w-3.5 h-3.5" /> NO PAYMENT REQUIRED
        </span>
      );
    }
    switch (status) {
      case 'PENDING_APPROVAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <Clock className="w-3.5 h-3.5" /> PENDING REVIEW
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
            <CheckCircle className="w-3.5 h-3.5" /> APPROVED
          </span>
        );
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <CheckCircle className="w-3.5 h-3.5" /> PAID
          </span>
        );
      case 'OVERDUE':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
            <AlertCircle className="w-3.5 h-3.5" /> OVERDUE
          </span>
        );
      case 'ISSUED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
            <Clock className="w-3.5 h-3.5" /> ISSUED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <FileText className="w-3.5 h-3.5" /> DRAFT
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/80 backdrop-blur-md">
      {/* Modal Container */}
      <div className="relative w-full max-w-4xl bg-zinc-950 border border-white/20 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Modal Action Header (Excluded in print) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-zinc-900/90 no-print">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">GST Tax Invoice</h3>
                <span className="text-xs text-gray-400 font-mono">({invoice.invoiceNumber})</span>
              </div>
              <p className="text-xs text-gray-400">HSN/SAC: {invoice.hsnSacCode} • Verified Pay-Per-Minute Commercial Document</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {invoice.status === 'PENDING_APPROVAL' && onApprove && (
              <button
                onClick={() => onApprove(invoice)}
                className="px-3.5 py-1.5 rounded-xl bg-green-600 hover:bg-green-500 text-white text-xs font-semibold shadow-lg shadow-green-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                Approve Invoice
              </button>
            )}

            {invoice.status !== 'PAID' && invoice.status !== 'PENDING_APPROVAL' && !isZeroAmount && onRecordPayment && (
              <button
                onClick={() => onRecordPayment(invoice)}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-1.5"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                Record Payment
              </button>
            )}

            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Print / Save PDF
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Document Area */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-10 bg-white text-zinc-900" ref={printContentRef} id="printable-invoice">
          
          {/* Header Banner */}
          <div className="flex flex-col sm:flex-row justify-between items-start pb-6 border-b-2 border-zinc-900 gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-blue-600 text-white font-bold text-xl flex items-center justify-center shadow-md">
                  U
                </div>
                <div>
                  <h1 className="text-2xl font-black tracking-tight text-zinc-950 uppercase">UnivLabs Technologies</h1>
                  <p className="text-[11px] font-semibold text-zinc-600 tracking-wider">UNIVLABS TECHNOLOGIES PRIVATE LIMITED</p>
                </div>
              </div>
              <div className="mt-3 text-xs text-zinc-600 leading-relaxed max-w-sm">
                <p className="font-semibold text-zinc-800">Corporate & Registered Office:</p>
                <p>Plot No. 42, Sector 4, IMT Manesar, Gurugram, Haryana 122052, India</p>
                <p><span className="font-medium text-zinc-700">GSTIN:</span> 06AABCU9876Q1ZT | <span className="font-medium text-zinc-700">PAN:</span> AABCU9876Q</p>
                <p><span className="font-medium text-zinc-700">CIN:</span> U33110DL2015PTC284910 | <span className="font-medium text-zinc-700">State Code:</span> 06 (Haryana)</p>
                <p><span className="font-medium text-zinc-700">Email:</span> accounts@univlabs.in | <span className="font-medium text-zinc-700">Web:</span> www.univlabs.in</p>
              </div>
            </div>

            <div className="text-right sm:self-start">
              <div className="inline-block bg-zinc-900 text-white text-xs font-black px-3 py-1 rounded mb-2 tracking-wider uppercase">
                Tax Invoice
              </div>
              <div className="space-y-1 text-xs">
                <p className="font-bold text-zinc-900 text-sm">{invoice.invoiceNumber}</p>
                <p><span className="text-zinc-500">Invoice Date:</span> <span className="font-semibold text-zinc-800">{invoice.issueDate}</span></p>
                <p><span className="text-zinc-500">Payment Due:</span> <span className={`font-semibold ${isZeroAmount ? 'text-emerald-700' : 'text-rose-700'}`}>{isZeroAmount ? 'N/A (Nil Balance)' : invoice.dueDate}</span></p>
                <p><span className="text-zinc-500">Billing Period:</span> <span className="font-semibold text-zinc-800">{invoice.billingMonth}</span></p>
                <p><span className="text-zinc-500">Place of Supply:</span> <span className="font-semibold text-zinc-800">{invoice.customerAddress.includes('Haryana') ? '06-Haryana' : '07-Delhi'}</span></p>
                <div className="pt-1 flex justify-end">
                  {getStatusBadge(invoice.status)}
                </div>
              </div>
            </div>
          </div>

          {/* Billed To / Tower Allocation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 my-6 py-4 bg-zinc-50 rounded-xl p-4 border border-zinc-200 text-xs">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Billed To (Customer / Institution)</p>
              <h4 className="text-sm font-bold text-zinc-950">{invoice.customerName}</h4>
              <p className="text-zinc-600 mt-1 leading-relaxed">{invoice.customerAddress}</p>
              <div className="mt-2 space-y-0.5 text-zinc-700">
                <p><span className="font-semibold text-zinc-800">Customer GSTIN:</span> <span className="font-mono">{invoice.customerGstin}</span></p>
                {invoice.customerContactPerson && (
                  <p><span className="font-semibold text-zinc-800">Attn:</span> {invoice.customerContactPerson}</p>
                )}
                {invoice.customerPhone && (
                  <p><span className="font-semibold text-zinc-800">Phone:</span> {invoice.customerPhone}</p>
                )}
              </div>
            </div>

            <div className="border-t sm:border-t-0 sm:border-l sm:pl-6 border-zinc-200">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Deployed Surgical System</p>
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Tower Model:</span>
                  <span className="font-bold text-zinc-900">{invoice.towerModel === 'SPECTRA' ? 'SPECTRA ICG 4K Fluorescence' : 'LUMINA 4K Ultra HD'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Tower Serial Number:</span>
                  <span className="font-mono font-bold text-zinc-900">{invoice.towerSerial || invoice.towerId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Surgeries Logged:</span>
                  <span className="font-semibold text-zinc-900">{Number(invoice.surgeriesCount ?? (invoice as any).surgeries_count ?? 0)} Procedures</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Total Optical Runtime:</span>
                  <span className="font-semibold text-zinc-900">{Number(invoice.totalMinutesUsed ?? (invoice as any).total_minutes ?? 0).toLocaleString()} Minutes ({(Number(invoice.totalMinutesUsed ?? (invoice as any).total_minutes ?? 0) / 60).toFixed(1)} hrs)</span>
                </div>
                <div className="flex justify-between text-zinc-500 text-[11px] pt-1 border-t border-zinc-200">
                  <span>Usage Model:</span>
                  <span className="font-medium text-blue-700">Pay-Per-Minute Freedom Lease</span>
                </div>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="overflow-x-auto my-6">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-y-2 border-zinc-900 bg-zinc-100 text-zinc-900">
                  <th className="py-2.5 px-3 font-bold w-12 text-center">#</th>
                  <th className="py-2.5 px-3 font-bold">Description of Services</th>
                  <th className="py-2.5 px-3 font-bold text-center">HSN / SAC</th>
                  <th className="py-2.5 px-3 font-bold text-right">Quantity</th>
                  <th className="py-2.5 px-3 font-bold text-right">Unit Rate (₹)</th>
                  <th className="py-2.5 px-3 font-bold text-right">Taxable Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {(invoice.lineItems || (invoice as any).line_items || []).map((item: any, idx: number) => (
                  <tr key={item.id || idx} className="hover:bg-zinc-50/50">
                    <td className="py-3 px-3 text-center text-zinc-500 font-mono">{idx + 1}</td>
                    <td className="py-3 px-3">
                      <p className="font-semibold text-zinc-900">{item.description}</p>
                      <p className="text-[11px] text-zinc-500">Service Category: Leasing or rental services concerning medical equipment without operator</p>
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-medium text-zinc-700">{item.hsnSac || item.hsn_sac || '997312'}</td>
                    <td className="py-3 px-3 text-right font-mono text-zinc-800">{Number(item.quantity ?? item.quantity_min ?? 0).toLocaleString()} {item.unit || 'Min'}</td>
                    <td className="py-3 px-3 text-right font-mono text-zinc-800">₹{Number(item.unitRate ?? item.rate_per_min ?? 0).toFixed(2)}</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-zinc-950">₹{Number(item.taxableAmount ?? item.amount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tax Calculation & Totals Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 my-6 pt-4 border-t-2 border-zinc-900">
            
            {/* Left Column: Bank Details & Verification */}
            <div className="sm:col-span-7 space-y-4 text-xs">
              
              {/* Amount in words */}
              <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200">
                <p className="text-[10px] font-bold uppercase text-zinc-400 tracking-wider">Total Invoice Amount (in words)</p>
                <p className="font-bold text-zinc-900 mt-0.5">{numberToWords(invoice.totalPayable)}</p>
              </div>

              {/* Bank Details or Nil Balance Notice */}
              {isZeroAmount ? (
                <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-950">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-1 flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    Settled / Nil Balance - No Payment Required
                  </p>
                  <p className="text-[11px] text-emerald-800 leading-relaxed font-sans">
                    Zero optical and SaaS usage recorded for this billing period. No remittance or wire transfer is required from the institution.
                  </p>
                </div>
              ) : (
                <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-200/80 text-blue-950">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700 mb-1.5 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" />
                    Beneficiary Bank Account Details (NEFT / RTGS)
                  </p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11px]">
                    <div><span className="text-zinc-500 font-sans">Account Name:</span> <span className="font-bold">UnivLabs Technologies Pvt Ltd</span></div>
                    <div><span className="text-zinc-500 font-sans">Bank Name:</span> <span className="font-bold">HDFC Bank Ltd</span></div>
                    <div><span className="text-zinc-500 font-sans">Account No:</span> <span className="font-bold text-blue-900">50200028194821</span></div>
                    <div><span className="text-zinc-500 font-sans">IFSC Code:</span> <span className="font-bold text-blue-900">HDFC0000240</span></div>
                    <div><span className="text-zinc-500 font-sans">Branch:</span> <span>Green Park, New Delhi 110016</span></div>
                    <div><span className="text-zinc-500 font-sans">Account Type:</span> <span>Current Account</span></div>
                  </div>
                </div>
              )}

              {/* Cryptographic Verification Seal */}
              <div className="flex items-center gap-3 p-3 bg-zinc-50 rounded-xl border border-zinc-200">
                <div className="w-14 h-14 bg-white p-1 rounded-lg border border-zinc-300 flex items-center justify-center flex-shrink-0 shadow-sm">
                  {/* Visual QR Code Pattern */}
                  <div className="w-12 h-12 bg-zinc-900 rounded p-1 grid grid-cols-4 gap-0.5">
                    {Array.from({ length: 16 }).map((_, i) => (
                      <div 
                        key={i} 
                        className={`${(i % 2 === 0 || i === 3 || i === 12 || i === 15) ? 'bg-white' : 'bg-transparent'} rounded-[1px]`} 
                      />
                    ))}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 text-[11px] font-bold text-zinc-900">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>SHA-256 Digital Verification Seal</span>
                  </div>
                  <p className="font-mono text-[10px] text-zinc-500 break-all truncate mt-0.5">
                    {invoice.sha256Seal}
                  </p>
                  <p className="text-[10px] text-zinc-400 mt-0.5">
                    Immutable e-Invoice hash verified under 21 CFR Part 11 and Indian GST E-Way system.
                  </p>
                </div>
                <button
                  onClick={handleCopySeal}
                  className="p-1.5 text-zinc-400 hover:text-zinc-800 rounded hover:bg-zinc-200 transition-colors no-print"
                  title="Copy SHA-256 Seal"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>

            </div>

            {/* Right Column: Financial Totals */}
            <div className="sm:col-span-5 space-y-2 text-xs">
              <div className="space-y-2 p-4 bg-zinc-50 rounded-xl border border-zinc-200">
                
                <div className="flex justify-between py-1 text-zinc-700">
                  <span>Taxable Subtotal:</span>
                  <span className="font-mono font-semibold text-zinc-900">
                    ₹{invoice.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                {invoice.cgstAmount > 0 && (
                  <div className="flex justify-between py-1 text-zinc-600">
                    <span>CGST ({invoice.cgstRatePct}%):</span>
                    <span className="font-mono text-zinc-800">
                      ₹{invoice.cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}

                {invoice.sgstAmount > 0 && (
                  <div className="flex justify-between py-1 text-zinc-600">
                    <span>SGST ({invoice.sgstRatePct}%):</span>
                    <span className="font-mono text-zinc-800">
                      ₹{invoice.sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}

                {invoice.igstAmount > 0 && (
                  <div className="flex justify-between py-1 text-zinc-600">
                    <span>IGST ({invoice.igstRatePct}%):</span>
                    <span className="font-mono text-zinc-800">
                      ₹{invoice.igstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}

                <div className="flex justify-between py-1.5 border-t border-zinc-200 text-zinc-700">
                  <span className="font-semibold">Total GST (18%):</span>
                  <span className="font-mono font-semibold text-zinc-900">
                    ₹{invoice.totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex justify-between py-2 border-t-2 border-zinc-900 text-sm font-black text-zinc-950">
                  <span>Total Amount Payable:</span>
                  <span className="font-mono text-blue-700">
                    ₹{invoice.totalPayable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                {invoice.amountPaid > 0 && (
                  <>
                    <div className="flex justify-between py-1 text-emerald-700 font-semibold border-t border-zinc-200 pt-2">
                      <span>Amount Received:</span>
                      <span className="font-mono">
                        - ₹{invoice.amountPaid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="flex justify-between py-1.5 text-sm font-bold text-zinc-900 border-t border-zinc-300">
                      <span>Balance Due:</span>
                      <span className="font-mono text-rose-600">
                        ₹{invoice.balanceDue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </>
                )}

              </div>

              {/* Payment Confirmation Details if Paid */}
              {invoice.paymentDetails && (
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-[11px] text-emerald-900 space-y-0.5">
                  <p className="font-bold flex items-center gap-1 text-emerald-800">
                    <CheckCircle className="w-3.5 h-3.5" /> Payment Settled & Reconciled
                  </p>
                  <p><span className="text-emerald-700">UTR / Ref:</span> <span className="font-mono font-bold">{invoice.paymentDetails.utrReference}</span></p>
                  <p><span className="text-emerald-700">Mode:</span> {invoice.paymentDetails.method} • <span className="text-emerald-700">Date:</span> {invoice.paymentDetails.paidAt.slice(0, 10)}</p>
                </div>
              )}

              {/* Authorized Signatory */}
              <div className="pt-6 text-right">
                <div className="h-10 flex items-end justify-end">
                  <span className="font-serif italic text-sm text-zinc-700 font-bold tracking-wide">UnivLabs Authorized Signature</span>
                </div>
                <div className="border-t border-zinc-400 pt-1 mt-1">
                  <p className="font-bold text-zinc-900 text-xs">For UNIVLABS TECHNOLOGIES PVT. LTD.</p>
                  <p className="text-[10px] text-zinc-500">Authorized Signatory / Finance Controller</p>
                </div>
              </div>

            </div>

          </div>

          {/* Footer Terms */}
          <div className="mt-8 pt-4 border-t border-zinc-200 text-[10px] text-zinc-500 leading-normal flex flex-col sm:flex-row justify-between gap-2">
            <div>
              <p className="font-semibold text-zinc-700">Terms & Conditions:</p>
              <p>1. Payment is strictly due within 15 days of invoice date via RTGS/NEFT/UPI.</p>
              <p>2. Subject to Gurugram / Delhi jurisdiction. Equipment remains the property of UnivLabs Technologies Pvt Ltd.</p>
              <p>3. This is a computer-generated tax invoice verified with SHA-256 cryptographic seal under IT Act 2000.</p>
            </div>
            <div className="text-right text-zinc-400 font-mono self-end">
              Page 1 of 1 • System Generated
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

export default InvoicePrintModal;
