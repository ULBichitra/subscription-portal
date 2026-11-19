import React, { useState, useEffect, useMemo } from 'react';
import { getDistributors, getCustomers, getTowers, type Distributor, type Customer, type Tower } from '../services/api';
import { Building2, Hospital, Server, ChevronDown } from 'lucide-react';

export interface EntitySelectorValues {
  distributorId: string;
  customerId: string;
  towerId: string;
}

export interface EntitySelectorProps {
  selectedDistributorId?: string;
  selectedCustomerId?: string;
  selectedTowerId?: string;
  onChange?: (values: EntitySelectorValues) => void;
  onDistributorChange?: (distributorId: string) => void;
  onCustomerChange?: (customerId: string) => void;
  onTowerChange?: (towerId: string) => void;
  showDistributor?: boolean;
  showCustomer?: boolean;
  showTower?: boolean;
  disabledDistributor?: boolean;
  disabledCustomer?: boolean;
  disabledTower?: boolean;
  requiredCustomer?: boolean;
  requiredTower?: boolean;
  layout?: 'grid' | 'row' | 'col';
  size?: 'sm' | 'md';
  labels?: {
    distributor?: string;
    customer?: string;
    tower?: string;
  };
  className?: string;
}

export const EntitySelector: React.FC<EntitySelectorProps> = ({
  selectedDistributorId = '',
  selectedCustomerId = '',
  selectedTowerId = '',
  onChange,
  onDistributorChange,
  onCustomerChange,
  onTowerChange,
  showDistributor = true,
  showCustomer = true,
  showTower = true,
  disabledDistributor = false,
  disabledCustomer = false,
  disabledTower = false,
  requiredCustomer = false,
  requiredTower = false,
  layout = 'grid',
  size = 'md',
  labels,
  className = '',
}) => {
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [towers, setTowers] = useState<Tower[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [currentDistributor, setCurrentDistributor] = useState<string>(selectedDistributorId);
  const [currentCustomer, setCurrentCustomer] = useState<string>(selectedCustomerId);
  const [currentTower, setCurrentTower] = useState<string>(selectedTowerId);

  // Sync internal state with external props
  useEffect(() => {
    setCurrentDistributor(selectedDistributorId);
  }, [selectedDistributorId]);

  useEffect(() => {
    setCurrentCustomer(selectedCustomerId);
  }, [selectedCustomerId]);

  useEffect(() => {
    setCurrentTower(selectedTowerId);
  }, [selectedTowerId]);

  // Load live data from API
  useEffect(() => {
    let isMounted = true;
    const loadEntities = async () => {
      setIsLoading(true);
      try {
        const [distsData, custsData, towersData] = await Promise.all([
          getDistributors(),
          getCustomers(),
          getTowers(),
        ]);
        if (isMounted) {
          setDistributors(distsData || []);
          setCustomers(custsData || []);
          setTowers(towersData || []);
        }
      } catch (err) {
        console.error('Failed to load entity selector data', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadEntities();
    return () => {
      isMounted = false;
    };
  }, []);

  // Filtered customer list based on selected distributor
  const filteredCustomers = useMemo(() => {
    if (!currentDistributor) return customers;
    return customers.filter(
      (c) =>
        c.distributor_id === currentDistributor ||
        c.customer_id === currentDistributor ||
        (c.organization_type !== 'DISTRIBUTOR' && !c.distributor_id)
    );
  }, [customers, currentDistributor]);

  // Filtered towers list based on selected customer and distributor
  const filteredTowers = useMemo(() => {
    let result = towers;
    if (currentDistributor) {
      result = result.filter(
        (t) =>
          t.distributor_id === currentDistributor ||
          (t.customer_id && filteredCustomers.some((c) => c.customer_id === t.customer_id))
      );
    }
    if (currentCustomer) {
      result = result.filter((t) => t.customer_id === currentCustomer);
    }
    return result;
  }, [towers, currentDistributor, currentCustomer, filteredCustomers]);

  const handleDistributorSelect = (distId: string) => {
    setCurrentDistributor(distId);
    let nextCustomer = currentCustomer;
    let nextTower = currentTower;

    // Check if current customer is valid under selected distributor
    if (distId && currentCustomer) {
      const isCustValid = customers.some(
        (c) => c.customer_id === currentCustomer && (c.distributor_id === distId || c.customer_id === distId)
      );
      if (!isCustValid) {
        nextCustomer = '';
        nextTower = '';
        setCurrentCustomer('');
        setCurrentTower('');
      }
    }

    onDistributorChange?.(distId);
    onChange?.({
      distributorId: distId,
      customerId: nextCustomer,
      towerId: nextTower,
    });
  };

  const handleCustomerSelect = (custId: string) => {
    setCurrentCustomer(custId);
    let nextDistributor = currentDistributor;
    let nextTower = currentTower;

    // Auto-infer distributor if not selected
    if (custId) {
      const foundCust = customers.find((c) => c.customer_id === custId);
      if (foundCust?.distributor_id && !currentDistributor) {
        nextDistributor = foundCust.distributor_id;
        setCurrentDistributor(nextDistributor);
        onDistributorChange?.(nextDistributor);
      }
    }

    // Check if current tower is valid under selected customer
    if (custId && currentTower) {
      const isTowerValid = towers.some((t) => t.tower_id === currentTower && t.customer_id === custId);
      if (!isTowerValid) {
        nextTower = '';
        setCurrentTower('');
      }
    }

    onCustomerChange?.(custId);
    onChange?.({
      distributorId: nextDistributor,
      customerId: custId,
      towerId: nextTower,
    });
  };

  const handleTowerSelect = (twrId: string) => {
    setCurrentTower(twrId);
    let nextDistributor = currentDistributor;
    let nextCustomer = currentCustomer;

    if (twrId) {
      const foundTower = towers.find((t) => t.tower_id === twrId);
      if (foundTower) {
        if (foundTower.customer_id && foundTower.customer_id !== currentCustomer) {
          nextCustomer = foundTower.customer_id;
          setCurrentCustomer(nextCustomer);
          onCustomerChange?.(nextCustomer);
        }
        if (foundTower.distributor_id && foundTower.distributor_id !== currentDistributor) {
          nextDistributor = foundTower.distributor_id;
          setCurrentDistributor(nextDistributor);
          onDistributorChange?.(nextDistributor);
        }
      }
    }

    onTowerChange?.(twrId);
    onChange?.({
      distributorId: nextDistributor,
      customerId: nextCustomer,
      towerId: twrId,
    });
  };

  const layoutClass =
    layout === 'row'
      ? 'flex flex-row gap-3 items-end'
      : layout === 'col'
      ? 'flex flex-col gap-3'
      : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3';

  const inputPadding = size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm';

  return (
    <div className={`${layoutClass} ${className}`}>
      {/* Distributor Dropdown */}
      {showDistributor && (
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-medium text-gray-400 mb-1 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-blue-400" />
            <span>{labels?.distributor || 'Distributor'}</span>
          </label>
          <div className="relative">
            <select
              value={currentDistributor}
              disabled={disabledDistributor || isLoading}
              onChange={(e) => handleDistributorSelect(e.target.value)}
              className={`w-full ${inputPadding} bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500 disabled:opacity-50 appearance-none pr-8 transition-colors`}
            >
              <option value="">All Distributors</option>
              {distributors.map((d) => (
                <option key={d.distributor_id} value={d.distributor_id}>
                  {d.name || d.distributor_id} ({d.distributor_id})
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      )}

      {/* Customer / Hospital Dropdown */}
      {showCustomer && (
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-medium text-gray-400 mb-1 flex items-center gap-1.5">
            <Hospital className="w-3.5 h-3.5 text-indigo-400" />
            <span>{labels?.customer || 'Hospital / Customer'}</span>
            {requiredCustomer && <span className="text-rose-400">*</span>}
          </label>
          <div className="relative">
            <select
              value={currentCustomer}
              disabled={disabledCustomer || isLoading}
              onChange={(e) => handleCustomerSelect(e.target.value)}
              required={requiredCustomer}
              className={`w-full ${inputPadding} bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500 disabled:opacity-50 appearance-none pr-8 transition-colors`}
            >
              <option value="">{requiredCustomer ? 'Select Customer...' : 'All Customers'}</option>
              {filteredCustomers.map((c) => (
                <option key={c.customer_id} value={c.customer_id}>
                  {c.name} ({c.customer_id})
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      )}

      {/* Tower Dropdown */}
      {showTower && (
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-medium text-gray-400 mb-1 flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5 text-emerald-400" />
            <span>{labels?.tower || 'Fleet Tower'}</span>
            {requiredTower && <span className="text-rose-400">*</span>}
          </label>
          <div className="relative">
            <select
              value={currentTower}
              disabled={disabledTower || isLoading}
              onChange={(e) => handleTowerSelect(e.target.value)}
              required={requiredTower}
              className={`w-full ${inputPadding} bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500 disabled:opacity-50 appearance-none pr-8 transition-colors`}
            >
              <option value="">{requiredTower ? 'Select Tower...' : 'All Towers'}</option>
              {filteredTowers.map((t) => (
                <option key={t.tower_id} value={t.tower_id}>
                  {t.tower_id} {t.model ? `(${t.model})` : ''} - {t.status}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      )}
    </div>
  );
};

export default EntitySelector;
