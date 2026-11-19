import React, { useEffect, useState, useMemo } from 'react';
import GlassCard from '../components/ui/GlassCard';
import Modal from '../components/ui/Modal';
import { DeploymentWizardModal } from '../components/DeploymentWizardModal';
import { 
  getCustomers, 
  createCustomer, 
  updateCustomer, 
  deleteCustomer,
  getTowers, 
  updateTower, 
  getUsers, 
  createUser, 
  resendUserInvitation 
} from '../services/api';
import type { Customer, Tower, UserRecord } from '../services/api';
import { useToast } from '../components/ui/ToastProvider';
import { Eye, CheckCircle2, Copy, Check, Users, UserPlus, Radio, AlertCircle, Send, Building, RefreshCw, Trash2, ShieldAlert, Lock } from 'lucide-react';

export const generateCustomerId = (orgType: string): string => {
  const prefix = orgType === 'DISTRIBUTOR' ? 'DIST' : 'HOSP';
  const year = new Date().getFullYear().toString();
  const rand = Array.from({ length: 4 }, () => '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 36)]).join('');
  return `${prefix}-${year}-${rand}`;
};

const CustomerManagement: React.FC = () => {
  const { addToast } = useToast();
  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('portal_user') || '{}');
    } catch {
      return {};
    }
  }, []);
  const userRole = currentUser.role || 'hospital_admin';
  const isHospitalAdmin = userRole === 'hospital_admin';
  const isSuperAdmin = userRole === 'superadmin';

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [towers, setTowers] = useState<Tower[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [isDeletingCustomer, setIsDeletingCustomer] = useState(false);
  
  const [isManageTowersOpen, setIsManageTowersOpen] = useState(false);
  const [selectedCustomerForTowers, setSelectedCustomerForTowers] = useState<Customer | null>(null);
  const [assignTowerId, setAssignTowerId] = useState('');
  const [isUpdatingTowers, setIsUpdatingTowers] = useState(false);

  // Unified Admin Onboarding state
  const [inviteAdmin, setInviteAdmin] = useState(true);
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [createdCustomerResult, setCreatedCustomerResult] = useState<{
    customerId: string;
    customerName: string;
    activationToken?: string;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Customer Details Modal state
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedCustomerForDetails, setSelectedCustomerForDetails] = useState<Customer | null>(null);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUserData, setNewUserData] = useState({ username: '', email: '', role: 'hospital_admin' });
  const [addUserError, setAddUserError] = useState('');
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);
  const [newUserActivationLink, setNewUserActivationLink] = useState<string | null>(null);
  const [copiedUserLink, setCopiedUserLink] = useState(false);

  // Resend invite in Details Modal state
  const [resendingUserId, setResendingUserId] = useState<number | null>(null);
  const [resendInviteModal, setResendInviteModal] = useState<{
    isOpen: boolean;
    username: string;
    email?: string;
    activationLink: string;
  } | null>(null);
  const [copiedResendLink, setCopiedResendLink] = useState(false);
  
  const [formData, setFormData] = useState<Partial<Customer>>({
    customer_id: '',
    name: '',
    organization_type: 'HOSPITAL',
    distributor_id: '',
    agreement_type: 'POSTPAID',
    contact_person: '',
    phone: '',
    email: '',
    billing_cycle: 'MONTHLY'
  });
  
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [customersData, towersData, usersData] = await Promise.all([
        getCustomers(),
        getTowers(),
        getUsers().catch(() => [])
      ]);
      setCustomers(customersData);
      setTowers(towersData);
      setUsers(usersData);
    } catch (err) {
      console.error("Error fetching data", err);
    }
  };

  const handleResendUserInvite = async (user: UserRecord) => {
    setResendingUserId(user.id);
    try {
      const res = await resendUserInvitation(user.id);
      if (res.ack && res.activation_token) {
        const link = `${window.location.origin}/activate?token=${res.activation_token}`;
        setResendInviteModal({
          isOpen: true,
          username: user.username,
          email: res.email || user.email || undefined,
          activationLink: link,
        });
        setCopiedResendLink(false);
      } else {
        alert(res.message || 'Failed to resend invitation');
      }
    } catch (err: any) {
      alert(err.response?.data?.message || err.response?.data?.detail || 'Failed to resend invitation');
    } finally {
      setResendingUserId(null);
    }
  };

  const handleOpenManageTowers = (customer: Customer) => {
    setSelectedCustomerForTowers(customer);
    setAssignTowerId('');
    setIsManageTowersOpen(true);
  };

  const handleAssignTower = async () => {
    if (!assignTowerId || !selectedCustomerForTowers) return;
    setIsUpdatingTowers(true);
    try {
      await updateTower(assignTowerId, { customer_id: selectedCustomerForTowers.customer_id });
      await fetchData();
      setAssignTowerId('');
    } catch (err) {
      console.error("Failed to assign tower", err);
    } finally {
      setIsUpdatingTowers(false);
    }
  };

  const handleUnassignTower = async (towerId: string) => {
    setIsUpdatingTowers(true);
    try {
      await updateTower(towerId, { customer_id: '' });
      await fetchData();
    } catch (err) {
      console.error("Failed to unassign tower", err);
    } finally {
      setIsUpdatingTowers(false);
    }
  };

  const handleOpenDetails = (customer: Customer) => {
    setSelectedCustomerForDetails(customer);
    setIsAddingUser(false);
    setNewUserData({
      username: '',
      email: '',
      role: customer.organization_type === 'DISTRIBUTOR' ? 'distributor_admin' : 'hospital_admin'
    });
    setAddUserError('');
    setNewUserActivationLink(null);
    setCopiedUserLink(false);
    setIsDetailsOpen(true);
  };

  const handleAddCustomerUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerForDetails) return;
    setIsSubmittingUser(true);
    setAddUserError('');
    setNewUserActivationLink(null);
    try {
      const res = await createUser({
        username: newUserData.username.trim(),
        email: newUserData.email.trim() || undefined,
        role: newUserData.role,
        customer_id: selectedCustomerForDetails.customer_id,
      });
      const token = res.activation_token || res.invitation_token;
      if (token) {
        setNewUserActivationLink(`${window.location.origin}/activate?token=${token}`);
      }
      const updatedUsers = await getUsers().catch(() => []);
      setUsers(updatedUsers);
    } catch (err: any) {
      setAddUserError(err.response?.data?.detail || err.response?.data?.message || 'Failed to create user');
    } finally {
      setIsSubmittingUser(false);
    }
  };

  const handleOrgTypeChange = (newType: string) => {
    setFormData(prev => {
      let currentId = prev.customer_id || '';
      const newPrefix = newType === 'DISTRIBUTOR' ? 'DIST' : 'HOSP';
      const oldPrefix = newType === 'DISTRIBUTOR' ? 'HOSP' : 'DIST';

      let updatedId = currentId;
      if (!currentId) {
        updatedId = generateCustomerId(newType);
      } else if (currentId.startsWith(oldPrefix + '-')) {
        updatedId = newPrefix + currentId.slice(oldPrefix.length);
      } else if (/^(HOSP|DIST)-\d{4}-[A-Z0-9]{4}$/i.test(currentId)) {
        updatedId = newPrefix + currentId.slice(4);
      }

      return {
        ...prev,
        organization_type: newType,
        customer_id: updatedId,
      };
    });
  };

  const handleOpenEdit = (customer: Customer) => {
    setIsEditing(true);
    setSelectedCustomerId(customer.customer_id);
    setFormData({
      name: customer.name,
      organization_type: customer.organization_type,
      distributor_id: customer.distributor_id || '',
      agreement_type: 'POSTPAID',
      contact_person: customer.contact_person || '',
      phone: customer.phone || '',
      email: customer.email || '',
      address: typeof customer.address === 'string' ? customer.address : (customer.address ? JSON.stringify(customer.address) : ''),
      notes: customer.notes || '',
      billing_cycle: customer.billing_cycle || 'MONTHLY'
    });
    setError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      setError("Name is required");
      return;
    }
    if (!isEditing && !formData.customer_id?.trim()) {
      setError("Customer ID is required");
      return;
    }
    
    setIsSubmitting(true);
    setError('');
    try {
      const payload = {
        ...formData,
        agreement_type: 'POSTPAID',
        billing_cycle: formData.billing_cycle || 'MONTHLY'
      };
      if (isEditing) {
        await updateCustomer(selectedCustomerId, payload);
        setIsModalOpen(false);
        fetchData();
      } else {
        const created = await createCustomer(payload);
        const assignedCustId = created?.customer_id || formData.customer_id;
        let activationToken: string | undefined;
        if (inviteAdmin) {
          const adminUsername = adminName.trim() || formData.contact_person?.trim() || `admin_${assignedCustId?.trim()}`;
          const role = formData.organization_type === 'DISTRIBUTOR' ? 'distributor_admin' : 'hospital_admin';
          const userRes = await createUser({
            username: adminUsername,
            email: adminEmail.trim() || formData.email?.trim() || undefined,
            role,
            customer_id: assignedCustId?.trim(),
          });
          activationToken = userRes.activation_token || userRes.invitation_token;
        }

        await fetchData();

        if (inviteAdmin && activationToken) {
          setCreatedCustomerResult({
            customerId: (assignedCustId || '').trim(),
            customerName: formData.name!.trim(),
            activationToken,
          });
        } else {
          setIsModalOpen(false);
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || err.response?.data?.message || `Failed to ${isEditing ? 'update' : 'create'} customer`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.customer_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-white tracking-tight">Customer Management</h1>
            {isHospitalAdmin && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-semibold">
                <Building className="w-3.5 h-3.5 text-blue-400" />
                <span>{customers[0]?.name || currentUser.customer_id || 'Hospital Facility'}</span>
              </span>
            )}
          </div>
          <p className="text-gray-400 mt-1">
            {isHospitalAdmin ? 'Manage facility personnel and view clinical deployment records.' : 'Manage hospitals, clinics, and their agreements.'}
          </p>
        </div>
        {!isHospitalAdmin && (
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsWizardOpen(true)}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-5 py-2.5 rounded-lg font-semibold transition-all shadow-lg shadow-blue-500/25 flex items-center gap-2"
            >
              <UserPlus className="w-5 h-5" />
              <span>+ Onboarding Customer</span>
            </button>
          </div>
        )}
      </div>

      <div className="flex mb-6">
        <div className="relative w-full max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-white/10 rounded-lg bg-black/20 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            placeholder="Search customers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <GlassCard className="flex-1 overflow-hidden flex flex-col p-0">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 border-b border-white/10">
                <th className="px-6 py-4 text-sm font-semibold text-gray-300 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-300 uppercase tracking-wider">Type / Agreement</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-300 uppercase tracking-wider">Contact</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-300 uppercase tracking-wider text-center">Deployment Assets</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-300 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    No customers found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map(customer => (
                  <tr key={customer.customer_id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-white">{customer.name}</div>
                      <div className="text-xs text-gray-500 mt-1">{customer.customer_id}</div>
                      {customer.distributor_id && (
                        <div className="text-xs text-amber-400/90 mt-1 flex items-center gap-1 font-medium">
                          <Building className="w-3 h-3 text-amber-400" />
                          <span>Distributor: {customers.find(c => c.customer_id === customer.distributor_id)?.name || customer.distributor_id}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30 mb-1">
                        {customer.organization_type}
                      </span>
                      <br/>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
                        {customer.agreement_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      <div>{customer.contact_person || 'No contact'}</div>
                      <div className="text-xs text-gray-500 mt-1">{customer.email || customer.phone || ''}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => handleOpenManageTowers(customer)}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 transition-all hover:scale-105"
                          title="View and manage customer towers"
                        >
                          <Radio className="w-3.5 h-3.5 text-blue-400" />
                          <span>{customer.tower_count ?? towers.filter(t => t.customer_id === customer.customer_id).length} Towers</span>
                        </button>
                        <button 
                          onClick={() => handleOpenDetails(customer)}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 transition-all hover:scale-105"
                          title="View customer personnel and users"
                        >
                          <Users className="w-3.5 h-3.5 text-purple-400" />
                          <span>{users.filter(u => u.customer_id === customer.customer_id).length} Users</span>
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button 
                        onClick={() => handleOpenDetails(customer)}
                        className="text-emerald-400 hover:text-emerald-300 transition-colors p-2 rounded-lg hover:bg-emerald-500/10 mr-2 inline-flex items-center gap-1.5 text-sm font-medium"
                        title="View customer towers and users"
                      >
                        <Eye className="w-4 h-4" />
                        <span>Details</span>
                      </button>
                      <button 
                        onClick={() => handleOpenManageTowers(customer)}
                        className="text-purple-400 hover:text-purple-300 transition-colors p-2 rounded-lg hover:bg-purple-500/10 mr-2"
                      >
                        Manage Towers
                      </button>
                      <button 
                        onClick={() => handleOpenEdit(customer)}
                        className="text-blue-400 hover:text-blue-300 transition-colors p-2 rounded-lg hover:bg-blue-500/10"
                      >
                        Edit
                      </button>
                      {isSuperAdmin && (
                        <button 
                          onClick={() => setCustomerToDelete(customer)}
                          className="text-rose-400 hover:text-rose-300 transition-colors p-2 rounded-lg hover:bg-rose-500/10 ml-2 inline-flex items-center gap-1 text-sm font-medium"
                          title="Purge customer facility"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>Delete</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          if (!isSubmitting) {
            setIsModalOpen(false);
            setCreatedCustomerResult(null);
          }
        }}
        title={createdCustomerResult ? 'Customer Registered Successfully' : isEditing ? 'Edit Customer' : 'Register New Customer'}
      >
        {createdCustomerResult ? (
          <div className="space-y-5 mt-4">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3 text-emerald-300">
              <CheckCircle2 className="w-6 h-6 flex-shrink-0 mt-0.5 text-emerald-400" />
              <div>
                <h4 className="font-semibold text-white">Customer &amp; Admin Created!</h4>
                <p className="text-xs text-emerald-300/90 mt-1">
                  Customer <span className="font-mono font-semibold">{createdCustomerResult.customerId}</span> ({createdCustomerResult.customerName}) has been onboarded and the primary administrator invitation is generated.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                Primary Administrator Activation Link
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/activate?token=${createdCustomerResult.activationToken}`}
                  className="w-full px-3 py-2 text-xs font-mono bg-black/40 border border-white/10 rounded-xl text-blue-300 select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (createdCustomerResult.activationToken) {
                      navigator.clipboard.writeText(`${window.location.origin}/activate?token=${createdCustomerResult.activationToken}`);
                      setCopiedLink(true);
                      setTimeout(() => setCopiedLink(false), 2500);
                    }
                  }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                    copiedLink
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white/10 hover:bg-white/20 text-gray-200'
                  }`}
                >
                  {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                This activation link is single-use and valid for 24 hours.
              </p>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setCreatedCustomerResult(null);
                }}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors shadow-lg shadow-blue-900/20"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            {!isEditing && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5 flex justify-between items-center">
                  <span>Customer ID (Auto-Generated) *</span>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, customer_id: generateCustomerId(prev.organization_type || 'HOSPITAL') }))}
                    className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 normal-case font-normal"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Regenerate</span>
                  </button>
                </label>
                <input
                  type="text"
                  required
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.customer_id || ''}
                  onChange={e => setFormData({...formData, customer_id: e.target.value})}
                />
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Organization Name</label>
              <input
                type="text"
                required
                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Organization Type</label>
                <select
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.organization_type}
                  onChange={e => handleOrgTypeChange(e.target.value)}
                >
                  <option value="HOSPITAL">Hospital</option>
                  <option value="CLINIC">Clinic</option>
                  <option value="DISTRIBUTOR">Distributor</option>
                </select>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-300">Agreement Type</label>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    <Lock className="w-3 h-3 text-blue-400" />
                    Freedom Postpaid
                  </span>
                </div>
                <select
                  disabled
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-gray-300 cursor-not-allowed focus:outline-none"
                  value="POSTPAID"
                >
                  <option value="POSTPAID">Freedom Postpaid (UnivLabs Freedom Plan)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Billing Cycle</label>
              <select
                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.billing_cycle || 'MONTHLY'}
                onChange={e => setFormData({...formData, billing_cycle: e.target.value})}
              >
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
                <option value="ANNUAL">Annual</option>
              </select>
            </div>

            {formData.organization_type !== 'DISTRIBUTOR' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Assigned Distributor (Optional)</label>
                <select
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.distributor_id || ''}
                  onChange={e => setFormData({...formData, distributor_id: e.target.value || undefined})}
                >
                  <option value="">-- None (Direct Facility) --</option>
                  {customers.filter(c => c.organization_type === 'DISTRIBUTOR').map(d => (
                    <option key={d.customer_id} value={d.customer_id}>{d.name} ({d.customer_id})</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-gray-300">Address</label>
                <span className="text-xs text-gray-500">{(formData.address || '').length}/255</span>
              </div>
              <input
                type="text"
                maxLength={255}
                placeholder="Physical address or facility location"
                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.address || ''}
                onChange={e => setFormData({...formData, address: e.target.value})}
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-gray-300">Notes / Description</label>
                <span className="text-xs text-gray-500">{(formData.notes || '').length}/255</span>
              </div>
              <textarea
                maxLength={255}
                rows={2}
                placeholder="Additional notes or description"
                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                value={formData.notes || ''}
                onChange={e => setFormData({...formData, notes: e.target.value})}
              />
            </div>
            
            <div className="border-t border-white/10 pt-4 mt-4">
              <h4 className="text-sm font-medium text-gray-400 mb-3">Contact Information</h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Contact Person</label>
                  <input
                    type="text"
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={formData.contact_person || ''}
                    onChange={e => {
                      setFormData({...formData, contact_person: e.target.value});
                      setAdminName(e.target.value);
                    }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Phone</label>
                    <input
                      type="text"
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={formData.phone || ''}
                      onChange={e => setFormData({...formData, phone: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                    <input
                      type="email"
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={formData.email || ''}
                      onChange={e => {
                        setFormData({...formData, email: e.target.value});
                        setAdminEmail(e.target.value);
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {!isEditing && (
              <div className="border-t border-white/10 pt-4 mt-4">
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="checkbox"
                    id="inviteAdminCheckbox"
                    checked={inviteAdmin}
                    onChange={(e) => setInviteAdmin(e.target.checked)}
                    className="w-4 h-4 rounded bg-black/40 border-white/20 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
                  />
                  <label htmlFor="inviteAdminCheckbox" className="text-sm font-medium text-white cursor-pointer select-none">
                    Create &amp; Invite Primary Administrator
                  </label>
                </div>

                {inviteAdmin && (
                  <div className="space-y-4 p-4 rounded-xl bg-white/[0.03] border border-white/10 mt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Primary Administrator Account</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">Role:</span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                          formData.organization_type === 'DISTRIBUTOR'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        }`}>
                          {formData.organization_type === 'DISTRIBUTOR' ? 'distributor_admin' : 'hospital_admin'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-300 mb-1">Admin Name</label>
                        <input
                          type="text"
                          required={inviteAdmin}
                          placeholder="Administrator username"
                          className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={adminName}
                          onChange={(e) => setAdminName(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-300 mb-1">Admin Email</label>
                        <input
                          type="email"
                          placeholder="admin@organization.com"
                          className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={adminEmail}
                          onChange={(e) => setAdminEmail(e.target.value)}
                        />
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-400">
                      Primary admin account will be provisioned with full management scope for this customer.
                    </p>
                  </div>
                )}
              </div>
            )}
            
            {error && (
              <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm">
                {error}
              </div>
            )}
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-lg font-medium transition-colors shadow-lg shadow-blue-900/20 disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Save Customer'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        isOpen={isManageTowersOpen}
        onClose={() => setIsManageTowersOpen(false)}
        title={`Manage Towers for ${selectedCustomerForTowers?.name}`}
      >
        <div className="mt-4 space-y-6">
          <div>
            <h4 className="text-sm font-medium text-gray-400 mb-2">Assigned Towers</h4>
            {towers.filter(t => t.customer_id === selectedCustomerForTowers?.customer_id).length === 0 ? (
              <p className="text-sm text-gray-500 italic">No towers assigned to this customer.</p>
            ) : (
              <ul className="space-y-2">
                {towers.filter(t => t.customer_id === selectedCustomerForTowers?.customer_id).map(t => (
                  <li key={t.tower_id} className="flex justify-between items-center bg-black/30 p-3 rounded-lg border border-white/5">
                    <span className="text-white font-medium">{t.tower_id} <span className="text-xs text-gray-500 ml-2">({t.status})</span></span>
                    <button 
                      onClick={() => handleUnassignTower(t.tower_id)}
                      disabled={isUpdatingTowers}
                      className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-white/10 pt-4">
            <h4 className="text-sm font-medium text-gray-400 mb-2">Assign Existing Tower</h4>
            <div className="flex gap-2">
              <select
                value={assignTowerId}
                onChange={(e) => setAssignTowerId(e.target.value)}
                className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Select Unassigned Tower --</option>
                {towers.filter(t => !t.customer_id).map(t => (
                  <option key={t.tower_id} value={t.tower_id}>{t.tower_id} ({t.status})</option>
                ))}
              </select>
              <button
                onClick={handleAssignTower}
                disabled={!assignTowerId || isUpdatingTowers}
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Assign
              </button>
            </div>
          </div>
          
          <div className="flex justify-end pt-2">
            <button
              onClick={() => setIsManageTowersOpen(false)}
              className="px-4 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* Customer Detail Accordion/Modal */}
      <Modal
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        title={selectedCustomerForDetails ? `Customer Details: ${selectedCustomerForDetails.name}` : 'Customer Details'}
      >
        {selectedCustomerForDetails && (
          <div className="mt-4 space-y-6">
            {/* Overview pill badges */}
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="font-mono bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg text-blue-300 font-semibold">
                ID: {selectedCustomerForDetails.customer_id}
              </span>
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30">
                {selectedCustomerForDetails.organization_type}
              </span>
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30">
                {selectedCustomerForDetails.agreement_type}
              </span>
              {selectedCustomerForDetails.distributor_id && (
                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-lg">
                  Distributor: {customers.find(c => c.customer_id === selectedCustomerForDetails.distributor_id)?.name || selectedCustomerForDetails.distributor_id}
                </span>
              )}
              {selectedCustomerForDetails.contact_person && (
                <span className="bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg text-gray-300">
                  Contact: {selectedCustomerForDetails.contact_person}
                </span>
              )}
            </div>

            {/* Towers Section */}
            <div>
              <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
                <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Radio className="w-4 h-4 text-purple-400" />
                  <span>Associated Towers ({towers.filter(t => t.customer_id === selectedCustomerForDetails.customer_id).length})</span>
                </h4>
                <button
                  type="button"
                  onClick={() => {
                    handleOpenManageTowers(selectedCustomerForDetails);
                  }}
                  className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                >
                  Manage Towers &rarr;
                </button>
              </div>

              {towers.filter(t => t.customer_id === selectedCustomerForDetails.customer_id).length === 0 ? (
                <p className="text-xs text-gray-500 italic p-3 bg-black/20 rounded-lg">No towers assigned to this customer.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {towers.filter(t => t.customer_id === selectedCustomerForDetails.customer_id).map(t => (
                    <div key={t.tower_id} className="p-2.5 rounded-lg bg-black/30 border border-white/5 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-semibold text-white">{t.tower_id}</div>
                        <div className="text-gray-400 text-[11px]">{t.model || 'Standard Tower'}</div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        t.is_online ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-gray-500/20 text-gray-400'
                      }`}>
                        {t.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Portal Users Section */}
            <div>
              <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
                <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-400" />
                  <span>Portal Users ({users.filter(u => u.customer_id === selectedCustomerForDetails.customer_id).length})</span>
                </h4>
                {!isAddingUser && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingUser(true);
                      setNewUserData({
                        username: '',
                        email: '',
                        role: selectedCustomerForDetails.organization_type === 'DISTRIBUTOR' ? 'distributor_admin' : 'hospital_admin'
                      });
                      setAddUserError('');
                      setNewUserActivationLink(null);
                    }}
                    className="inline-flex items-center gap-1 text-xs bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/30 px-2.5 py-1 rounded-lg transition-colors font-medium"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>+ Add User to this Customer</span>
                  </button>
                )}
              </div>

              {/* Add User Inline Form */}
              {isAddingUser && (
                <div className="mb-4 p-4 rounded-xl bg-white/[0.03] border border-blue-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <UserPlus className="w-4 h-4 text-blue-400" />
                      Add Portal User for {selectedCustomerForDetails.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsAddingUser(false)}
                      className="text-gray-400 hover:text-white text-xs"
                    >
                      Cancel
                    </button>
                  </div>

                  {addUserError && (
                    <div className="p-2.5 rounded-lg bg-red-500/20 border border-red-500/40 text-red-200 text-xs flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{addUserError}</span>
                    </div>
                  )}

                  {newUserActivationLink ? (
                    <div className="space-y-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                      <div className="text-xs text-emerald-300 font-semibold flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        User Created Successfully!
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={newUserActivationLink}
                          className="w-full px-2.5 py-1.5 text-xs font-mono bg-black/40 border border-white/10 rounded-lg text-blue-300 select-all"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(newUserActivationLink);
                            setCopiedUserLink(true);
                            setTimeout(() => setCopiedUserLink(false), 2000);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 ${
                            copiedUserLink ? 'bg-emerald-600 text-white' : 'bg-white/10 text-gray-200 hover:bg-white/20'
                          }`}
                        >
                          {copiedUserLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedUserLink ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setNewUserActivationLink(null);
                            setIsAddingUser(false);
                          }}
                          className="text-xs text-gray-300 hover:text-white underline"
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleAddCustomerUser} className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-medium text-gray-300 mb-1">Username *</label>
                          <input
                            type="text"
                            required
                            placeholder="username"
                            value={newUserData.username}
                            onChange={(e) => setNewUserData({ ...newUserData, username: e.target.value })}
                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-gray-300 mb-1">Email</label>
                          <input
                            type="email"
                            placeholder="user@hospital.com"
                            value={newUserData.email}
                            onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-gray-400">Role:</span>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                            {newUserData.role}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setIsAddingUser(false)}
                            className="px-3 py-1 rounded-lg text-xs text-gray-400 hover:text-white transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={isSubmittingUser}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                          >
                            {isSubmittingUser ? 'Creating...' : 'Invite User'}
                          </button>
                        </div>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* Users list */}
              {users.filter(u => u.customer_id === selectedCustomerForDetails.customer_id).length === 0 ? (
                <p className="text-xs text-gray-500 italic p-3 bg-black/20 rounded-lg">No portal users associated with this customer yet.</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {users.filter(u => u.customer_id === selectedCustomerForDetails.customer_id).map(u => (
                    <div key={u.id} className="p-2.5 rounded-lg bg-black/30 border border-white/5 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-semibold text-white flex items-center gap-2">
                          <span>{u.username}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-400 border border-white/10 font-normal">
                            {u.role}
                          </span>
                        </div>
                        {u.email && <div className="text-gray-400 text-[11px] mt-0.5">{u.email}</div>}
                      </div>
                      <div className="flex items-center gap-2">
                        {u.is_active !== false ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Active
                          </span>
                        ) : (
                          <>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                              Pending Activation
                            </span>
                            <button
                              type="button"
                              onClick={() => handleResendUserInvite(u)}
                              disabled={resendingUserId === u.id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 border border-blue-500/30 transition-colors disabled:opacity-50"
                              title="Resend Invitation Link"
                            >
                              <Send className={`w-3 h-3 ${resendingUserId === u.id ? 'animate-pulse' : ''}`} />
                              <span>{resendingUserId === u.id ? 'Sending...' : 'Resend Invite'}</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setIsDetailsOpen(false)}
                className="px-4 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/5 transition-colors text-sm"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Resend Invitation Modal */}
      <Modal
        isOpen={Boolean(resendInviteModal?.isOpen)}
        onClose={() => setResendInviteModal(null)}
        title="Resend Invitation"
      >
        {resendInviteModal && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-start gap-3 text-blue-300">
              <CheckCircle2 className="w-6 h-6 flex-shrink-0 mt-0.5 text-blue-400" />
              <div>
                <h4 className="font-semibold text-white">Fresh Activation Link Generated!</h4>
                <p className="text-xs text-blue-300/90 mt-1">
                  A fresh activation token was issued for <strong className="text-white">{resendInviteModal.username}</strong>
                  {resendInviteModal.email ? ` (${resendInviteModal.email})` : ''}. Share this single-use link with the user.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                Activation Link
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={resendInviteModal.activationLink}
                  className="w-full px-3 py-2 text-xs font-mono bg-black/40 border border-white/10 rounded-xl text-blue-300 select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(resendInviteModal.activationLink);
                    setCopiedResendLink(true);
                    setTimeout(() => setCopiedResendLink(false), 2500);
                  }}
                  className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                    copiedResendLink
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white/10 hover:bg-white/20 text-gray-200'
                  }`}
                >
                  {copiedResendLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedResendLink ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setResendInviteModal(null)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-semibold transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Customer Confirmation Modal */}
      <Modal
        isOpen={Boolean(customerToDelete)}
        onClose={() => !isDeletingCustomer && setCustomerToDelete(null)}
        title="Confirm Customer Purge"
      >
        {customerToDelete && (() => {
          const linkedTowers = towers.filter(t => t.customer_id === customerToDelete.customer_id);
          const activeLinkedTowers = linkedTowers.filter(t => t.is_online || t.status === 'ACTIVE');
          const activeTowerIds = activeLinkedTowers.map(t => t.tower_id);

          return (
            <div className="space-y-4">
              {activeLinkedTowers.length > 0 ? (
                <div className="p-4 rounded-xl bg-red-500/20 border-2 border-red-500/60 text-red-200 text-xs flex items-start gap-3 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
                  <ShieldAlert className="w-6 h-6 flex-shrink-0 text-red-400 mt-0.5 animate-pulse" />
                  <div className="space-y-1.5 w-full">
                    <h4 className="font-black text-red-100 text-sm uppercase tracking-wide">
                      Active/Online Towers Detected!
                    </h4>
                    <p className="text-red-200 text-xs leading-relaxed font-semibold">
                      Active/Online Towers Detected! Purging this customer will immediately unassign towers [{activeTowerIds.join(', ')}] and expire their subscriptions.
                    </p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {activeLinkedTowers.map(t => (
                        <span key={t.tower_id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-red-900/60 text-red-200 border border-red-500/40">
                          <span className={`w-1.5 h-1.5 rounded-full ${t.is_online ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
                          {t.tower_id} ({t.is_online ? 'ONLINE' : t.status})
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-300 text-xs">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-400" />
                  <div>
                    <h4 className="font-bold text-white text-sm">Purge Customer Facility?</h4>
                    <p className="text-xs text-rose-300/90 mt-1">
                      Customer facility <strong className="text-white font-mono">{customerToDelete.name} ({customerToDelete.customer_id})</strong> will be permanently removed.
                      {linkedTowers.length > 0 && ` All ${linkedTowers.length} linked tower(s) will be unassigned.`}
                    </p>
                  </div>
                </div>
              )}

              <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 text-xs text-gray-300 space-y-1.5">
                <div><span className="text-gray-500">Customer ID:</span> <span className="font-mono text-white">{customerToDelete.customer_id}</span></div>
                <div><span className="text-gray-500">Organization:</span> <span className="font-semibold text-white">{customerToDelete.name} ({customerToDelete.organization_type})</span></div>
                <div><span className="text-gray-500">Linked Towers:</span> <span className="font-semibold text-white">{linkedTowers.length} tower(s) ({activeLinkedTowers.length} active/online)</span></div>
                <div><span className="text-gray-500">Contact:</span> <span className="text-gray-300">{customerToDelete.contact_person || 'N/A'} &bull; {customerToDelete.email || customerToDelete.phone || 'N/A'}</span></div>
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setCustomerToDelete(null)}
                  disabled={isDeletingCustomer}
                  className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!customerToDelete) return;
                    setIsDeletingCustomer(true);
                    try {
                      await deleteCustomer(customerToDelete.customer_id);
                      addToast(`Customer ${customerToDelete.name} purged successfully.`, 'success');
                      setCustomerToDelete(null);
                      await fetchData();
                    } catch (err: any) {
                      const msg = err.response?.data?.detail || err.response?.data?.message || 'Failed to delete customer';
                      addToast(msg, 'error');
                    } finally {
                      setIsDeletingCustomer(false);
                    }
                  }}
                  disabled={isDeletingCustomer}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-rose-600/30 transition-all flex items-center gap-2"
                >
                  {isDeletingCustomer ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Purging...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Confirm Delete Customer</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* 3-Step Guided Deployment Onboarding Wizard */}
      <DeploymentWizardModal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onSuccess={fetchData}
      />
    </div>
  );
};

export default CustomerManagement;
