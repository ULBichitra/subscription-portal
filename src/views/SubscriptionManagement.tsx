import React, { useEffect, useState, useMemo } from 'react';
import GlassCard from '../components/ui/GlassCard';
import Modal from '../components/ui/Modal';
import Drawer from '../components/ui/Drawer';
import DataTable from '../components/ui/DataTable';
import StatusDonutChart from '../components/ui/StatusDonutChart';
import { getSubscriptions, approveSubscription, suspendSubscription, extendLease } from '../services/api';
import type { Subscription } from '../services/api';

const SubscriptionManagement: React.FC = () => {
  const currentUser = JSON.parse(localStorage.getItem("portal_user") || "{}");
  const userRole = currentUser.role || "";
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [selectedSub, setSelectedSub] = useState<Subscription | null>(null);
  const [actionModal, setActionModal] = useState<{ isOpen: boolean; sub: Subscription | null; action: 'APPROVE' | 'SUSPEND' }>({
    isOpen: false,
    sub: null,
    action: 'APPROVE'
  });
  const [actionError, setActionError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Extend Lease states
  const [isExtendModalOpen, setIsExtendModalOpen] = useState(false);
  const [extendSub, setExtendSub] = useState<Subscription | null>(null);
  const [extendYears, setExtendYears] = useState(0);
  const [extendMonths, setExtendMonths] = useState(0);
  const [extendDays, setExtendDays] = useState(0);
  const [extendError, setExtendError] = useState('');
  const [isExtending, setIsExtending] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const data = await getSubscriptions();
      setSubscriptions(data);
    } catch (err) {
      console.error("Error fetching subscriptions", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = async () => {
    if (!actionModal.sub) return;
    setIsProcessing(true);
    setActionError('');
    try {
      if (actionModal.action === 'APPROVE') {
        await approveSubscription(actionModal.sub.subscription_id);
      } else {
        await suspendSubscription(actionModal.sub.subscription_id);
      }
      setActionModal({ isOpen: false, sub: null, action: 'APPROVE' });
      fetchData(); // Refresh list
    } catch (err: any) {
      setActionError(err.response?.data?.detail || `Failed to ${actionModal.action.toLowerCase()} subscription`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExtendLease = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extendSub) return;
    if (extendYears === 0 && extendMonths === 0 && extendDays === 0) {
      setExtendError('Extension duration must be greater than zero');
      return;
    }

    setIsExtending(true);
    setExtendError('');
    try {
      await extendLease(extendSub.tower_id, extendYears, extendMonths, extendDays);
      setIsExtendModalOpen(false);
      setExtendYears(0);
      setExtendMonths(0);
      setExtendDays(0);
      setExtendSub(null);
      await fetchData();
    } catch (err: any) {
      setExtendError(err.response?.data?.detail || 'Failed to extend lease');
    } finally {
      setIsExtending(false);
    }
  };

  const chartData = useMemo(() => {
    let active = 0;
    let expired = 0;
    let blocked = 0;
    let pending = 0; // Assuming pending exists or using blocked as a proxy if we don't have pending
    
    subscriptions.forEach(s => {
      if (s.status === 'ACTIVE') active++;
      else if (s.status === 'EXPIRED') expired++;
      else if (s.status === 'BLOCKED') blocked++;
      else pending++; // fallback
    });

    return [
      { label: 'Active', value: active, color: '#4ade80' }, // green-400
      { label: 'Blocked', value: blocked, color: '#ef4444' }, // red-500
      { label: 'Expired', value: expired, color: '#facc15' }, // yellow-400
      ...(pending > 0 ? [{ label: 'Other', value: pending, color: '#9ca3af' }] : [])
    ];
  }, [subscriptions]);

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'ACTIVE': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'BLOCKED': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'EXPIRED': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default: return 'bg-white/10 text-white border-white/20';
    }
  };

  // Define columns for DataTable
  const columns: any[] = [
    { 
      header: 'Sub ID', 
      accessor: (row: Subscription) => (
        <span className="font-mono text-xs cursor-pointer text-blue-400 hover:underline" onClick={() => setSelectedSub(row)}>
          {(row.subscription_id || (row as any).subscriptionId || String((row as any)._id || "") || "SUB-0000").substring(0, 8)}...
        </span>
      )
    },
    { header: 'Tower', accessor: 'tower_id' },
    { header: 'Type', accessor: 'sub_type' },
    { 
      header: 'Balance', 
      accessor: (row: Subscription) => row.balance_min === null ? 'Unlimited' : `${Math.max(0, (row.balance_min ?? 0) - (row.used_min ?? 0))} min` 
    },
    { 
      header: 'Grace Reserve', 
      accessor: (row: Subscription) => `${row.grace_min ?? 960} min` 
    },
    { 
      header: 'Status', 
      accessor: (row: Subscription) => (
        <span className={`px-2 py-1 text-[10px] uppercase font-bold rounded-full border ${getStatusColor(row.status)}`}>
          {row.status}
        </span>
      )
    },
    {
      header: 'Actions',
      accessor: (row: Subscription) => (
        <div className="flex gap-2">
          {['superadmin', 'subscription_manager'].includes(userRole) && row.status !== 'ACTIVE' && (
            <button 
              onClick={(e) => { e.stopPropagation(); setActionModal({ isOpen: true, sub: row, action: 'APPROVE' }); }}
              className="px-3 py-1 bg-green-500/10 hover:bg-green-500/20 text-green-400 text-xs font-medium rounded transition-colors border border-green-500/20"
            >
              Approve
            </button>
          )}
          {['superadmin', 'subscription_manager'].includes(userRole) && row.status === 'ACTIVE' && (
            <button 
              onClick={(e) => { e.stopPropagation(); setActionModal({ isOpen: true, sub: row, action: 'SUSPEND' }); }}
              className="px-3 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium rounded transition-colors border border-red-500/20"
            >
              Suspend
            </button>
          )}
          {row.sub_type === 'LEASE' && row.status === 'ACTIVE' && (
            <button 
              onClick={(e) => { 
                e.stopPropagation(); 
                setExtendSub(row);
                setIsExtendModalOpen(true);
              }}
              className="px-3 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs font-medium rounded transition-colors border border-blue-500/20"
            >
              Extend
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight">Subscription Management</h1>
        <p className="text-gray-400 mt-1">Review and manage endoscope tower subscriptions.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 mb-8">
        {/* Analytics Card */}
        <div className="lg:w-1/3">
          <GlassCard className="h-full flex flex-col justify-center" title="Status Distribution">
            {isLoading ? (
              <div className="h-[200px] flex items-center justify-center text-gray-500">Loading...</div>
            ) : subscriptions.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-gray-500">No subscriptions found</div>
            ) : (
              <StatusDonutChart data={chartData} size={200} strokeWidth={24} />
            )}
          </GlassCard>
        </div>

        {/* Quick Stats or Actions could go here if needed in future */}
        <div className="lg:w-2/3 grid grid-cols-1 md:grid-cols-2 gap-6">
           <GlassCard className="flex flex-col justify-center items-center h-full">
             <div className="text-gray-400 font-medium mb-2">Total Subscriptions</div>
             <div className="text-4xl font-bold text-white">{subscriptions.length}</div>
           </GlassCard>
           <GlassCard className="flex flex-col justify-center items-center h-full">
             <div className="text-gray-400 font-medium mb-2">Active Subscriptions</div>
             <div className="text-4xl font-bold text-green-400">
               {subscriptions.filter(s => s.status === 'ACTIVE').length}
             </div>
           </GlassCard>
        </div>
      </div>

      {/* Main Table */}
      <div className="flex-1 min-h-[400px]">
        <GlassCard className="h-full flex flex-col" title="All Subscriptions">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 py-12">Loading subscriptions...</div>
          ) : (
            <div className="overflow-x-auto">
              <DataTable 
                columns={columns} 
                data={subscriptions} 
                keyExtractor={(item: Subscription) => item.subscription_id}
              />
            </div>
          )}
        </GlassCard>
      </div>

      {/* Action Modal */}
      <Modal 
        isOpen={actionModal.isOpen} 
        onClose={() => setActionModal({ ...actionModal, isOpen: false })} 
        title={actionModal.action === 'APPROVE' ? "Approve Subscription" : "Suspend Subscription"}
      >
        <div className="mb-4 text-gray-300">
          Are you sure you want to {actionModal.action.toLowerCase()} the subscription for tower <strong>{actionModal.sub?.tower_id}</strong>?
        </div>
        
        {actionError && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {actionError}
          </div>
        )}
        
        <div className="flex justify-end gap-3 mt-6">
          <button 
            type="button" 
            onClick={() => setActionModal({ ...actionModal, isOpen: false })}
            className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleAction}
            disabled={isProcessing}
            className={`px-4 py-2 rounded-lg font-medium transition-colors text-white disabled:opacity-50 ${
              actionModal.action === 'APPROVE' ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500'
            }`}
          >
            {isProcessing ? 'Processing...' : `Confirm ${actionModal.action}`}
          </button>
        </div>
      </Modal>

      {/* Details Drawer */}
      <Drawer isOpen={!!selectedSub} onClose={() => setSelectedSub(null)} title="Subscription Details">
        {selectedSub && (
          <div className="space-y-6">
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <h4 className="text-sm font-medium text-gray-400 mb-4">General Information</h4>
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Subscription ID</p>
                  <p className="text-sm font-mono text-white mt-1 break-all">{selectedSub.subscription_id}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Status</p>
                    <span className={`inline-block px-2 py-0.5 mt-1 text-xs font-semibold rounded-full border ${getStatusColor(selectedSub.status)}`}>
                      {selectedSub.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Type</p>
                    <p className="text-sm font-medium text-white mt-1">{selectedSub.sub_type}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Tower ID</p>
                    <p className="text-sm font-medium text-blue-400 mt-1 cursor-pointer hover:underline">{selectedSub.tower_id}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Customer ID</p>
                    <p className="text-sm font-medium text-white mt-1">{selectedSub.customer_id}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <h4 className="text-sm font-medium text-gray-400 mb-4">Balance Utilization</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Remaining Balance</p>
                  <p className="text-xl font-bold text-white mt-1">
                    {selectedSub.balance_min === null ? 'Unlimited' : `${Math.max(0, (selectedSub.balance_min ?? 0) - (selectedSub.used_min ?? 0))} min`}
                  </p>
                  {selectedSub.balance_min !== null && (
                    <p className="text-xs text-zinc-400 mt-0.5">Total: {selectedSub.balance_min} min</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Grace Reserve</p>
                  <p className="text-xl font-bold text-amber-400 mt-1">{selectedSub.grace_min ?? 960} min</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Used Time</p>
                  <p className="text-xl font-bold text-gray-300 mt-1">{selectedSub.used_min} min</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {/* Extend Lease Modal */}
      <Modal isOpen={isExtendModalOpen} onClose={() => setIsExtendModalOpen(false)} title="Extend Lease">
        <form onSubmit={handleExtendLease}>
          <div className="mb-4 text-sm text-gray-400">
            Extend lease for tower <span className="font-bold text-white">{extendSub?.tower_id}</span>.
          </div>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Years</label>
              <input 
                type="number" min="0" max="10" 
                value={extendYears} 
                onChange={e => setExtendYears(parseInt(e.target.value) || 0)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Months</label>
              <input 
                type="number" min="0" max="11" 
                value={extendMonths} 
                onChange={e => setExtendMonths(parseInt(e.target.value) || 0)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Days</label>
              <input 
                type="number" min="0" max="365" 
                value={extendDays} 
                onChange={e => setExtendDays(parseInt(e.target.value) || 0)}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          
          {extendError && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {extendError}
            </div>
          )}
          
          <div className="flex justify-end gap-3 mt-6">
            <button 
              type="button" 
              onClick={() => setIsExtendModalOpen(false)}
              disabled={isExtending}
              className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={isExtending}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              {isExtending ? 'Extending...' : 'Extend Lease'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default SubscriptionManagement;
