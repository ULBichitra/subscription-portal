import React, { useState } from 'react';
import Modal from './ui/Modal';
import { changePassword } from '../services/api';
import { Lock, CheckCircle2, AlertCircle, Eye, EyeOff, Check } from 'lucide-react';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const passwordCriteria = [
    { label: '8+ characters', met: newPassword.length >= 8 },
    { label: 'Uppercase letter (A-Z)', met: /[A-Z]/.test(newPassword) },
    { label: 'Lowercase letter (a-z)', met: /[a-z]/.test(newPassword) },
    { label: 'Number (0-9)', met: /[0-9]/.test(newPassword) },
    { label: 'Special character (!@#$%^&*...)', met: /[^A-Za-z0-9]/.test(newPassword) },
  ];
  const isPasswordValid = passwordCriteria.every(c => c.met);

  const resetForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleClose = () => {
    if (!isSubmitting) {
      resetForm();
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!currentPassword) {
      setErrorMessage('Current password is required.');
      return;
    }

    if (!isPasswordValid) {
      setErrorMessage('New password must meet all security requirements.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('New passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await changePassword(currentPassword, newPassword);
      if (res.ack) {
        setSuccessMessage(res.message || 'Password changed successfully.');
        setTimeout(() => {
          handleClose();
        }, 1500);
      } else {
        setErrorMessage(res.message || 'Failed to update password.');
      }
    } catch (err: any) {
      const detail = err.response?.data?.detail || err.response?.data?.message || 'Failed to update password. Please verify your current password.';
      setErrorMessage(detail);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Change Password">
      <form onSubmit={handleSubmit} className="space-y-4">
        {successMessage && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2.5 text-emerald-300 text-sm">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2.5 text-rose-300 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
            Current Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
              <Lock className="w-4 h-4" />
            </div>
            <input
              type={showCurrent ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              placeholder="Enter current password"
              className="w-full pl-10 pr-10 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={() => setShowCurrent(!showCurrent)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white"
            >
              {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
            New Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
              <Lock className="w-4 h-4" />
            </div>
            <input
              type={showNew ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              placeholder="Minimum 8 characters"
              className="w-full pl-10 pr-10 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white"
            >
              {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* Password Requirements Checklist */}
          <div className="mt-2.5 p-3 rounded-xl bg-black/25 border border-white/5 space-y-1.5">
            <span className="text-[11px] font-semibold text-gray-400 block mb-1 uppercase tracking-wider">
              Password Requirements
            </span>
            <div className="space-y-1">
              {passwordCriteria.map((c, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-2 text-xs transition-colors ${
                    c.met ? 'text-emerald-400' : 'text-gray-400'
                  }`}
                >
                  {c.met ? (
                    <Check className="w-3.5 h-3.5 flex-shrink-0 text-emerald-400" />
                  ) : (
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-600 ml-1 mr-1 flex-shrink-0" />
                  )}
                  <span>{c.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
            Confirm New Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
              <Lock className="w-4 h-4" />
            </div>
            <input
              type={showConfirm ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              placeholder="Re-enter new password"
              className="w-full pl-10 pr-10 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white"
            >
              {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="pt-3 flex justify-end gap-3 border-t border-white/10">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !currentPassword || !isPasswordValid || newPassword !== confirmPassword}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm shadow-lg shadow-blue-600/30 transition-all flex items-center gap-2"
          >
            {isSubmitting ? 'Updating...' : 'Update Password'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ChangePasswordModal;
