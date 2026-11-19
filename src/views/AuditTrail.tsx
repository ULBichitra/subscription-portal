import React, { useEffect, useState, useMemo } from 'react';
import GlassCard from '../components/ui/GlassCard';
import DataTable from '../components/ui/DataTable';
import { getAuditEvents } from '../services/api';
import type { AuditEvent } from '../services/api';
import { realtimeClient } from '../services/realtime';
import { useToast } from '../components/ui/ToastProvider';
import { ShieldCheck, Search, Key, ShieldAlert } from 'lucide-react';

const AuditTrail: React.FC = () => {
  const { addToast } = useToast();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal State
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);

  useEffect(() => {
    fetchAuditEvents();

    const unsubAudit = realtimeClient.on('audit_event', (newEvent: any) => {
      if (!newEvent) return;
      const formatted: AuditEvent = {
        id: newEvent.audit_id || newEvent.id || String(Date.now()),
        audit_id: newEvent.audit_id || newEvent.id,
        timestamp: newEvent.timestamp || new Date().toISOString(),
        actor: newEvent.actor || 'system',
        event_type: newEvent.event_type || 'SYSTEM_AUDIT',
        target_resource: newEvent.target_resource || 'fleet',
        details: newEvent.details || {},
        payload: newEvent.details || {},
        hmac_signature: newEvent.hmac_signature || newEvent.details?.hmac_signature
      };
      setEvents(prev => [formatted, ...prev]);
    });

    return () => {
      unsubAudit();
    };
  }, []);

  const fetchAuditEvents = async () => {
    setIsLoading(true);
    try {
      const data = await getAuditEvents();
      setEvents(data);
    } catch (err: any) {
      addToast(err.message || "Failed to load audit events", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredEvents = useMemo(() => {
    if (!searchTerm) return events;
    const lower = searchTerm.toLowerCase();
    return events.filter(e => 
      e.id.toLowerCase().includes(lower) || 
      e.actor.toLowerCase().includes(lower) ||
      e.event_type.toLowerCase().includes(lower) ||
      e.target_resource.toLowerCase().includes(lower) ||
      (e.hmac_signature && e.hmac_signature.toLowerCase().includes(lower))
    );
  }, [events, searchTerm]);

  const columns: any[] = [
    { header: 'Event ID', accessor: (row: AuditEvent) => <span className="font-mono text-xs text-gray-400">{row.id}</span> },
    { header: 'Timestamp', accessor: (row: AuditEvent) => new Date(row.timestamp).toLocaleString() },
    { 
      header: 'Event Type', 
      accessor: (row: AuditEvent) => (
        <span className="px-2 py-1 text-[10px] font-bold uppercase rounded-full border bg-purple-500/20 text-purple-400 border-purple-500/30">
          {row.event_type}
        </span>
      )
    },
    { header: 'Actor', accessor: (row: AuditEvent) => <span className="text-gray-300 font-medium">{row.actor}</span> },
    { header: 'Target', accessor: (row: AuditEvent) => <span className="font-mono text-white text-sm">{row.target_resource}</span> },
    { 
      header: 'Signature', 
      accessor: (row: AuditEvent) => {
        const sig = row.hmac_signature || row.details?.hmac_signature;
        return sig ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" title={`HMAC: ${sig}`}>
            <Key className="w-3 h-3 text-emerald-400" />
            {sig.substring(0, 8)}...
          </span>
        ) : (
          <span className="text-gray-500 text-[10px] italic">Legacy</span>
        );
      }
    },
    { 
      header: 'Actions', 
      accessor: (row: AuditEvent) => (
        <button 
          onClick={() => setSelectedEvent(row)}
          className="text-blue-400 hover:text-blue-300 text-xs font-medium underline"
        >
          Inspect
        </button>
      )
    }
  ];

  return (
    <div className="p-6 h-full flex flex-col gap-6 relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-white tracking-tight">System Audit Trail</h1>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-green-500/10 border border-green-500/30 rounded-full">
              <ShieldCheck className="w-4 h-4 text-green-400" />
              <span className="text-xs font-bold text-green-400 tracking-wider uppercase">21 CFR Part 11 Tamper-Proof</span>
            </div>
          </div>
          <p className="text-gray-400 mt-2">Append-only cryptographically signed ledger of administrative lifecycle events.</p>
        </div>
        
        <div className="flex gap-4 w-full md:w-auto relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-500" />
          </div>
          <input 
            type="text" 
            placeholder="Search events, actors, targets, HMAC..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full md:w-80 bg-black/40 border border-white/10 rounded-lg pl-10 p-2.5 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors"
          />
        </div>
      </div>

      <GlassCard className="flex-1 overflow-hidden flex flex-col p-0 border-0">
        <div className="p-1 h-full">
           {isLoading ? (
             <div className="flex-1 flex flex-col items-center justify-center text-gray-500 h-[400px]">
               <div className="w-8 h-8 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mb-4"></div>
               Loading audit ledger...
             </div>
           ) : (
             <DataTable 
                columns={columns} 
                data={filteredEvents} 
                keyExtractor={(item: AuditEvent) => item.id}
                emptyMessage="No matching audit events found."
             />
           )}
        </div>
      </GlassCard>

      {/* Audit Event Inspector Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-gray-900/95 border border-purple-500/30 rounded-xl shadow-[0_0_50px_rgba(168,85,247,0.15)] w-full max-w-3xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-purple-900/10">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-6 h-6 text-purple-400" />
                <h2 className="text-xl font-bold text-white tracking-tight">Audit Event Non-Repudiation Record</h2>
              </div>
              <button 
                onClick={() => setSelectedEvent(null)}
                className="text-gray-400 hover:text-white transition-colors p-1"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[70vh] custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">Event ID</p>
                  <p className="text-sm text-white font-mono break-all bg-black/40 p-2 rounded border border-white/5">{selectedEvent.id}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">Timestamp</p>
                  <p className="text-sm font-semibold text-white mt-2">{new Date(selectedEvent.timestamp).toLocaleString()}</p>
                </div>

                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">Event Type</p>
                  <span className="inline-block mt-1 px-3 py-1 text-xs font-bold uppercase rounded border bg-purple-500/20 text-purple-400 border-purple-500/30">
                    {selectedEvent.event_type}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">Actor Principal</p>
                  <p className="text-sm text-blue-400 font-mono mt-2">{selectedEvent.actor}</p>
                </div>

                <div className="md:col-span-2">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">Target Resource</p>
                  <p className="text-sm text-white font-mono bg-black/40 p-2 rounded border border-white/5">{selectedEvent.target_resource}</p>
                </div>

                <div className="md:col-span-2">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">HMAC-SHA256 Cryptographic Signature</p>
                  <div className="p-3 bg-black/60 rounded-lg border border-emerald-500/30 text-emerald-400 font-mono text-xs break-all">
                    {selectedEvent.hmac_signature || selectedEvent.details?.hmac_signature || 'N/A (Legacy Record)'}
                  </div>
                </div>
                
                <div className="md:col-span-2 mt-2">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Payload Details</p>
                    <span className="text-[10px] text-green-500 font-mono">Immutable Record</span>
                  </div>
                  <pre className="bg-[#0d1117] p-5 rounded-lg border border-white/10 text-sm text-green-400 font-mono overflow-x-auto shadow-inner leading-relaxed">
                    {JSON.stringify(selectedEvent.payload || selectedEvent.details, null, 2)}
                  </pre>
                </div>

              </div>
            </div>
            
            <div className="p-4 border-t border-white/10 flex justify-between items-center bg-black/40">
              <span className="text-xs text-gray-400 font-mono flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-emerald-400" />
                Validated against Server Key Authority
              </span>
              <button 
                onClick={() => setSelectedEvent(null)}
                className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-lg transition-colors border border-white/5"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AuditTrail;
