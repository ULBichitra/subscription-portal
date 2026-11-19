import React, { useState } from 'react';
import Modal from './ui/Modal';
import { useToast } from './ui/ToastProvider';
import { createComplaint } from '../services/api';
import { LifeBuoy } from 'lucide-react';
import EntitySelector from './EntitySelector';

interface CreateComplaintModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentUserCustomerId?: string;
  isHospitalAdmin: boolean;
}

export const CreateComplaintModal: React.FC<CreateComplaintModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  currentUserCustomerId,
  isHospitalAdmin,
}) => {
  const { addToast } = useToast();
  const [customerId, setCustomerId] = useState(currentUserCustomerId || '');
  const [towerId, setTowerId] = useState('');
  const [category, setCategory] = useState('HARDWARE_MALFUNCTION');
  const [severity, setSeverity] = useState('MEDIUM');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !customerId.trim()) {
      addToast('Please fill in all mandatory fields.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await createComplaint({
        customer_id: customerId.trim(),
        tower_id: towerId.trim() || undefined,
        category,
        severity,
        title: title.trim(),
        description: description.trim(),
      });
      addToast('Customer complaint successfully registered (21 CFR Part 820.198).', 'success');
      setTitle('');
      setDescription('');
      setTowerId('');
      onSuccess();
      onClose();
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Failed to submit complaint.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Log Customer Complaint">
      <form onSubmit={handleSubmit} className="space-y-4 text-white">
        <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-300 text-xs">
          <LifeBuoy className="w-5 h-5 flex-shrink-0" />
          <span>Filing a formal complaint under 21 CFR Part 820.198. All entries are cryptographically recorded in the audit trail.</span>
        </div>

        <EntitySelector
          selectedCustomerId={customerId}
          selectedTowerId={towerId}
          disabledCustomer={isHospitalAdmin}
          requiredCustomer={true}
          showDistributor={!isHospitalAdmin}
          onCustomerChange={(id) => setCustomerId(id)}
          onTowerChange={(id) => setTowerId(id)}
          onChange={({ customerId: cid, towerId: tid }) => {
            if (cid) setCustomerId(cid);
            setTowerId(tid);
          }}
          layout="grid"
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Complaint Category *</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="CLINICAL_SAFETY_ADVERSE_EVENT">Clinical Safety / Adverse Event</option>
              <option value="HARDWARE_MALFUNCTION">Hardware Malfunction</option>
              <option value="SOFTWARE_SYSTEM_ERROR">Software / System Error</option>
              <option value="SUBSCRIPTION_BILLING">Subscription / Billing Dispute</option>
              <option value="MAINTENANCE_INQUIRY">Maintenance / Field Inquiry</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Severity *</label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical (Immediate SLA)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Problem Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-blue-500"
            placeholder="Brief description of the failure"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Detailed Description *</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-blue-500"
            placeholder="Provide context, clinical procedure, symptoms, or error codes observed..."
            required
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-sm text-gray-300 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl text-sm font-medium text-white transition-colors"
          >
            {isSubmitting ? 'Registering...' : 'Submit Complaint'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateComplaintModal;
