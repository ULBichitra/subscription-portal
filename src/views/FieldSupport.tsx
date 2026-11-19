import React, { useEffect, useState } from 'react';
import GlassCard from '../components/ui/GlassCard';
import DataTable from '../components/ui/DataTable';
import EntitySelector from '../components/EntitySelector';
import {
  getFieldSupportCodes,
  generateFieldSupportCode,
  revokeFieldSupportCode,
  computeMaintenanceChallengeOtp,
  listComplaints,
  addComplaintComment,
  type FieldSupportCode,
  type Complaint,
} from '../services/api';
import { useToast } from '../components/ui/ToastProvider';
import {
  Wrench,
  ShieldAlert,
  Plus,
  CheckCircle,
  XCircle,
  RefreshCw,
  Key,
  Clock,
  Copy,
  Check,
  FileText,
  Upload,
  Lock,
  ShieldCheck
} from 'lucide-react';

type ActiveView = 'challenge_studio' | 'assigned_tickets' | 'token_registry';

const FieldSupport: React.FC = () => {
  const { addToast } = useToast();
  const [activeView, setActiveView] = useState<ActiveView>('challenge_studio');

  // Token Registry State
  const [codes, setCodes] = useState<FieldSupportCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [targetTower, setTargetTower] = useState('');

  // Challenge-Response Studio State
  const [studioTowerId, setStudioTowerId] = useState('TOWER-001');
  const [challengeNonce, setChallengeNonce] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);
  const [otpExpiration, setOtpExpiration] = useState<Date | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(3600);
  const [copied, setCopied] = useState(false);

  // Assigned Field Tickets State
  const [tickets, setTickets] = useState<Complaint[]>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Complaint | null>(null);
  const [diagnosticNote, setDiagnosticNote] = useState('');
  const [evidenceFileName, setEvidenceFileName] = useState('');
  const [isSubmittingEvidence, setIsSubmittingEvidence] = useState(false);

  useEffect(() => {
    fetchCodes();
    fetchTickets();
  }, []);

  // Timer effect for OTP countdown
  useEffect(() => {
    if (!generatedOtp || !otpExpiration) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((otpExpiration.getTime() - now) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        setGeneratedOtp(null);
        setOtpExpiration(null);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [generatedOtp, otpExpiration]);

  const fetchCodes = async () => {
    setIsLoading(true);
    try {
      const data = await getFieldSupportCodes();
      setCodes(data);
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Failed to load support codes', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTickets = async () => {
    setIsLoadingTickets(true);
    try {
      const data = await listComplaints({ limit: 50 });
      setTickets(data.items || []);
    } catch (err: any) {
      console.warn('Failed to load tickets', err);
    } finally {
      setIsLoadingTickets(false);
    }
  };

  const handleComputeOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!challengeNonce.trim()) {
      addToast('Please enter the 8-character device challenge nonce.', 'error');
      return;
    }
    if (challengeNonce.trim().length !== 8) {
      addToast('Challenge nonce must be exactly 8 alphanumeric characters.', 'error');
      return;
    }

    const res = computeMaintenanceChallengeOtp(studioTowerId, challengeNonce);
    setGeneratedOtp(res.otp);
    setOtpExpiration(res.expiresAt);
    setSecondsLeft(res.secondsRemaining);
    addToast(`Computed 6-digit maintenance OTP for ${studioTowerId}`, 'success');
  };

  const handleCopyOtp = () => {
    if (generatedOtp) {
      navigator.clipboard.writeText(generatedOtp);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      addToast('Maintenance OTP copied to clipboard', 'info');
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    try {
      const newCode = await generateFieldSupportCode(targetTower.trim() || undefined);
      addToast(`Generated emergency code: ${newCode.code}`, 'success');
      setTargetTower('');
      await fetchCodes();
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Failed to generate code', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRevoke = async (code: string) => {
    if (!window.confirm(`Are you sure you want to revoke code ${code}?`)) return;
    try {
      await revokeFieldSupportCode(code);
      addToast(`Code ${code} successfully revoked`, 'success');
      await fetchCodes();
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Failed to revoke code', 'error');
    }
  };

  const handleUploadDiagnosticEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;
    if (!diagnosticNote.trim() && !evidenceFileName) {
      addToast('Please enter diagnostic notes or attach a file reference.', 'error');
      return;
    }

    setIsSubmittingEvidence(true);
    try {
      const commentPayload = `[Field Support Diagnostic Report]\nArtifact: ${evidenceFileName || 'Diagnostic Log'}\nNotes: ${diagnosticNote.trim()}`;
      await addComplaintComment(selectedTicket.id, { notes: commentPayload });
      addToast('Diagnostic evidence and field notes attached to ticket.', 'success');
      setDiagnosticNote('');
      setEvidenceFileName('');
      await fetchTickets();
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Failed to upload diagnostic report', 'error');
    } finally {
      setIsSubmittingEvidence(false);
    }
  };

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const tokenColumns: any[] = [
    {
      header: 'Support Code',
      accessor: (row: FieldSupportCode) => (
        <span className={`font-mono text-lg font-bold tracking-[0.2em] ${row.is_revoked ? 'text-gray-500 line-through' : 'text-blue-400'}`}>
          {row.code}
        </span>
      ),
    },
    {
      header: 'Assigned Tower',
      accessor: (row: FieldSupportCode) =>
        row.tower_id ? (
          <span className="font-semibold text-white">{row.tower_id}</span>
        ) : (
          <span className="text-gray-500 italic text-sm">Global Scope</span>
        ),
    },
    { header: 'Created At', accessor: (row: FieldSupportCode) => new Date(row.created_at).toLocaleString() },
    { header: 'Generated By', accessor: (row: FieldSupportCode) => <span className="text-gray-300 text-sm">{row.created_by}</span> },
    {
      header: 'Status',
      accessor: (row: FieldSupportCode) => (
        <span
          className={`px-2 py-1 text-[10px] font-bold uppercase rounded-full border flex items-center w-fit gap-1 ${
            row.is_revoked ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-green-500/20 text-green-400 border-green-500/30'
          }`}
        >
          {row.is_revoked ? <XCircle className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
          {row.is_revoked ? 'Revoked' : 'Active'}
        </span>
      ),
    },
    {
      header: 'Actions',
      accessor: (row: FieldSupportCode) =>
        !row.is_revoked ? (
          <button
            onClick={() => handleRevoke(row.code)}
            className="px-3 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold rounded transition-colors border border-red-500/20 flex items-center gap-1"
          >
            <ShieldAlert className="w-3 h-3" />
            Revoke
          </button>
        ) : (
          <span className="text-gray-600 text-xs italic">N/A</span>
        ),
    },
  ];

  return (
    <div className="p-6 h-full flex flex-col gap-6 relative overflow-y-auto custom-scrollbar">
      {/* View Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-white tracking-tight">Field Support & Maintenance Studio</h1>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full">
              <Wrench className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-amber-400 tracking-wider uppercase">Field Diagnostics</span>
            </div>
          </div>
          <p className="text-gray-400 mt-2">
            Compute offline challenge-response maintenance OTPs, upload diagnostic artifacts, and issue emergency tokens.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex p-1 bg-black/40 border border-white/10 rounded-xl">
          <button
            onClick={() => setActiveView('challenge_studio')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
              activeView === 'challenge_studio'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Key className="w-3.5 h-3.5" /> Challenge OTP Studio
          </button>
          <button
            onClick={() => setActiveView('assigned_tickets')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
              activeView === 'assigned_tickets'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" /> Assigned Tickets ({tickets.length})
          </button>
          <button
            onClick={() => setActiveView('token_registry')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
              activeView === 'token_registry'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" /> Token Registry
          </button>
        </div>
      </div>

      {/* VIEW 1: Challenge-Response Maintenance Code Generator Studio */}
      {activeView === 'challenge_studio' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <GlassCard className="lg:col-span-6 border-blue-500/30 shadow-[0_0_30px_rgba(59,130,246,0.1)] relative">
            <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Key className="w-5 h-5 text-blue-400" /> Challenge-Response OTP Generator
            </h2>
            <p className="text-xs text-gray-400 mb-5">
              Enter the target Tower ID and the 8-character challenge nonce displayed on the offline tower's touchscreen to derive a 60-minute time-locked 6-digit maintenance OTP.
            </p>

            <form onSubmit={handleComputeOtp} className="space-y-4">
              <div>
                <EntitySelector
                  selectedTowerId={studioTowerId}
                  requiredTower={true}
                  showDistributor={false}
                  showCustomer={false}
                  onTowerChange={(id) => setStudioTowerId(id)}
                  labels={{ tower: 'Target Tower ID' }}
                  size="md"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                  8-Character Challenge Nonce *
                </label>
                <input
                  type="text"
                  maxLength={8}
                  placeholder="e.g. A9F37C21"
                  value={challengeNonce}
                  onChange={(e) => setChallengeNonce(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white font-mono text-lg tracking-widest uppercase focus:outline-none focus:border-blue-500 transition-colors"
                  required
                />
                <span className="text-[11px] text-gray-500 mt-1 block">
                  {challengeNonce.length}/8 characters entered
                </span>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Key className="w-4 h-4" /> Compute Maintenance OTP
              </button>
            </form>
          </GlassCard>

          {/* OTP Result Card */}
          <GlassCard className="lg:col-span-6 flex flex-col justify-between p-6 border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.1)]">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" /> Authenticated 6-Digit Maintenance Code
                </span>
                {generatedOtp && (
                  <span className="flex items-center gap-1 text-xs font-mono text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                    <Clock className="w-3.5 h-3.5 animate-pulse" />
                    <span>Expires: {formatCountdown(secondsLeft)}</span>
                  </span>
                )}
              </div>

              {generatedOtp ? (
                <div className="py-8 text-center space-y-4">
                  <div className="text-xs text-gray-400 uppercase tracking-widest">Single-Use Maintenance OTP</div>
                  <div className="text-5xl sm:text-6xl font-extrabold text-emerald-400 font-mono tracking-[0.3em] select-all bg-emerald-950/30 py-4 px-6 rounded-2xl border border-emerald-500/40 inline-block shadow-inner">
                    {generatedOtp}
                  </div>
                  <div className="text-xs text-gray-400">
                    Tower: <span className="font-mono text-white font-semibold">{studioTowerId}</span> &bull; Nonce: <span className="font-mono text-white">{challengeNonce}</span>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-gray-500 space-y-2">
                  <Key className="w-12 h-12 mx-auto text-gray-600 opacity-40 mb-2" />
                  <p className="text-sm font-medium text-gray-400">No OTP Computed Yet</p>
                  <p className="text-xs text-gray-500 max-w-sm mx-auto">
                    Enter the Tower ID and the 8-character challenge code from the clinical tower to calculate the cryptographic maintenance token.
                  </p>
                </div>
              )}
            </div>

            {generatedOtp && (
              <div className="pt-4 border-t border-white/10 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCopyOtp}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors shadow-md shadow-emerald-600/20"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Copied!' : 'Copy Code'}</span>
                </button>
              </div>
            )}
          </GlassCard>
        </div>
      )}

      {/* VIEW 2: Assigned Field Support Tickets & Evidence Uploader */}
      {activeView === 'assigned_tickets' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <GlassCard className="lg:col-span-7 flex flex-col p-0 overflow-hidden">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/20">
              <div>
                <h3 className="font-bold text-white">Assigned Technical Complaints</h3>
                <p className="text-xs text-gray-400">View customer hardware tickets and diagnostic issues.</p>
              </div>
              <button
                onClick={fetchTickets}
                className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/10"
                title="Refresh Tickets"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingTickets ? 'animate-spin text-blue-400' : ''}`} />
              </button>
            </div>

            <div className="p-2 flex-1 overflow-y-auto max-h-[500px]">
              {tickets.length === 0 ? (
                <div className="py-12 text-center text-gray-500 text-xs">No technical complaints assigned.</div>
              ) : (
                <div className="space-y-2">
                  {tickets.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTicket(t)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        selectedTicket?.id === t.id
                          ? 'bg-blue-600/20 border-blue-500/60 shadow-lg'
                          : 'bg-white/5 border-white/5 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-xs font-bold text-blue-300">{t.id}</span>
                        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-white/10 text-gray-300">
                          {t.status}
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold text-white truncate">{t.title}</h4>
                      <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">{t.description}</p>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5 text-[11px] text-gray-500">
                        <span>Tower: {t.tower_id || 'N/A'}</span>
                        <span>{new Date(t.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </GlassCard>

          {/* Ticket Diagnostic Inspector & Evidence Upload */}
          <GlassCard className="lg:col-span-5 flex flex-col justify-between">
            {selectedTicket ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div>
                    <span className="text-xs font-mono font-bold text-blue-400">{selectedTicket.id}</span>
                    <h4 className="text-sm font-bold text-white mt-0.5">{selectedTicket.title}</h4>
                  </div>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Status Locked (QA/RA Only)
                  </span>
                </div>

                <div className="p-3 bg-black/40 border border-white/10 rounded-xl space-y-2 text-xs">
                  <div>
                    <span className="text-gray-400 block text-[11px]">Category</span>
                    <span className="text-white font-medium">{selectedTicket.category}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[11px]">Facility & Device</span>
                    <span className="text-white font-medium">Customer: {selectedTicket.customer_id} &bull; Tower: {selectedTicket.tower_id || 'Global'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[11px]">Description</span>
                    <p className="text-gray-300 mt-0.5 leading-relaxed">{selectedTicket.description}</p>
                  </div>
                </div>

                {/* Diagnostic Evidence Form */}
                <form onSubmit={handleUploadDiagnosticEvidence} className="space-y-3 pt-2 border-t border-white/10">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <Upload className="w-4 h-4" /> Upload Diagnostic Evidence & Notes
                  </h5>

                  <div>
                    <label className="block text-[11px] font-medium text-gray-400 mb-1">Evidence Artifact File Name / Reference</label>
                    <input
                      type="text"
                      placeholder="e.g. diag_dump_20261004.bin"
                      value={evidenceFileName}
                      onChange={(e) => setEvidenceFileName(e.target.value)}
                      className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-gray-400 mb-1">Field Diagnostic Findings</label>
                    <textarea
                      rows={3}
                      placeholder="Describe inspected hardware, test sequences, voltages, or corrective replacement executed..."
                      value={diagnosticNote}
                      onChange={(e) => setDiagnosticNote(e.target.value)}
                      className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-300 flex items-start gap-2">
                    <Lock className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" />
                    <span>
                      Formal 21 CFR Part 11 closure and regulatory status triage are reserved for QA/RA Managers. Field reports will be permanently appended to the ticket audit trail.
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingEvidence}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {isSubmittingEvidence ? 'Attaching Report...' : 'Attach Diagnostic Report'}
                  </button>
                </form>
              </div>
            ) : (
              <div className="py-16 text-center text-gray-500 space-y-2">
                <FileText className="w-10 h-10 mx-auto opacity-30" />
                <p className="text-xs">Select a complaint from the left to inspect details and attach diagnostic reports.</p>
              </div>
            )}
          </GlassCard>
        </div>
      )}

      {/* VIEW 3: Token Registry */}
      {activeView === 'token_registry' && (
        <>
          {/* Action Panel */}
          <GlassCard className="border-blue-500/30 shadow-[0_0_30px_rgba(59,130,246,0.1)] relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <ShieldAlert className="w-32 h-32" />
            </div>
            <h2 className="text-lg font-bold text-white mb-4">Generate Emergency Token</h2>
            <form onSubmit={handleGenerate} className="flex flex-col md:flex-row gap-4 items-end relative z-10">
              <div className="flex-1 w-full max-w-md">
                <EntitySelector
                  selectedTowerId={targetTower}
                  showDistributor={false}
                  showCustomer={false}
                  onTowerChange={(id) => setTargetTower(id)}
                  labels={{ tower: 'Target Tower ID (Optional)' }}
                  size="md"
                />
              </div>
              <button
                type="submit"
                disabled={isGenerating}
                className="whitespace-nowrap px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium rounded-lg transition-all shadow-lg flex items-center gap-2"
              >
                {isGenerating ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                {isGenerating ? 'Generating...' : 'Generate Code'}
              </button>
            </form>
            <p className="text-xs text-gray-500 mt-4">
              Tokens generated without a Target Tower ID are "Global" and can be used on any registered CCP device. Use with extreme caution.
            </p>
          </GlassCard>

          {/* Token Registry Table */}
          <GlassCard className="flex-1 overflow-hidden flex flex-col p-0 border-0 mt-2">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/20">
              <h3 className="font-bold text-white">Active & Historical Tokens</h3>
              <button
                onClick={fetchCodes}
                className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/10"
                title="Refresh Ledger"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
              </button>
            </div>
            <div className="p-1 h-full overflow-hidden">
              {isLoading && codes.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-500 h-[300px]">
                  <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-4"></div>
                  Loading token registry...
                </div>
              ) : (
                <DataTable
                  columns={tokenColumns}
                  data={codes}
                  keyExtractor={(item: FieldSupportCode) => item.code}
                  emptyMessage="No support tokens have been generated."
                />
              )}
            </div>
          </GlassCard>
        </>
      )}
    </div>
  );
};

export default FieldSupport;
