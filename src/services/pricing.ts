import type { Tower } from './api';
import { DEFAULT_PRICING_CONFIGS } from './api';

export interface TowerPricingRate {
  model: string;
  displayName: string;
  ratePerMin: number;
  ratePerHour: number;
}

export interface CommercialBreakdown {
  hours: number;
  minutes: number;
  totalMinutes: number;
  ratePerMin: number;
  ratePerHour: number;
  subtotal: number;
  gstPct: number;
  gstAmount: number;
  totalAmount: number;
}

/**
 * Resolves the active model and per-minute / hourly tariff for a given tower.
 * Supports tower object, model string, or tower_id lookup from a fleet list.
 */
export const resolveTowerPricing = (
  towerOrId?: Tower | string | null,
  towerList?: Tower[]
): TowerPricingRate => {
  let modelStr = 'LUMINA';

  if (towerOrId) {
    if (typeof towerOrId === 'object') {
      const candidate = (towerOrId.model || '').toUpperCase();
      if (candidate.includes('SPECTRA') || candidate.includes('FLUOR')) {
        modelStr = 'SPECTRA';
      } else {
        modelStr = 'LUMINA';
      }
    } else if (typeof towerOrId === 'string') {
      const tid = towerOrId.trim();
      // Check if string directly matches a known model
      if (tid.toUpperCase().includes('SPECTRA') || tid.toUpperCase().includes('FLUOR')) {
        modelStr = 'SPECTRA';
      } else if (towerList && towerList.length > 0) {
        const found = towerList.find(t => t.tower_id === tid);
        if (found) {
          const candidate = (found.model || '').toUpperCase();
          modelStr = (candidate.includes('SPECTRA') || candidate.includes('FLUOR')) ? 'SPECTRA' : 'LUMINA';
        }
      }
    }
  }

  const config = DEFAULT_PRICING_CONFIGS[modelStr] || DEFAULT_PRICING_CONFIGS.LUMINA;
  const ratePerMin = config?.rates?.[0]?.baseRatePerMin || (modelStr === 'SPECTRA' ? 20.0 : 16.0);
  const ratePerHour = Math.round(ratePerMin * 60);

  return {
    model: modelStr,
    displayName: config?.displayName || `${modelStr} Endoscopic Tower`,
    ratePerMin,
    ratePerHour
  };
};

/**
 * Calculates itemized commercial breakdown including subtotal, 18% GST, and gross amount.
 */
export const calculateCommercialBreakdown = (
  hours: number = 0,
  minutes: number = 0,
  ratePerMin: number = 16.0,
  gstPct: number = 18
): CommercialBreakdown => {
  const safeHours = Math.max(0, Number(hours) || 0);
  const safeMinutes = Math.max(0, Math.min(59, Number(minutes) || 0));
  const totalMinutes = (safeHours * 60) + safeMinutes;
  const ratePerHour = Math.round(ratePerMin * 60);

  const subtotal = Math.round(totalMinutes * ratePerMin * 100) / 100;
  const gstAmount = Math.round(subtotal * (gstPct / 100));
  const totalAmount = Math.round(subtotal + gstAmount);

  return {
    hours: safeHours,
    minutes: safeMinutes,
    totalMinutes,
    ratePerMin,
    ratePerHour,
    subtotal,
    gstPct,
    gstAmount,
    totalAmount
  };
};

/**
 * Calculates surgical duration and commercial breakdown from a monetary amount (₹ INR).
 * Supports inclusive or exclusive 18% GST calculation.
 */
export const calculateDurationFromAmount = (
  amount: number = 0,
  ratePerMin: number = 16.0,
  isGstIncluded: boolean = true,
  gstPct: number = 18
): {
  subtotal: number;
  gstAmount: number;
  totalAmount: number;
  totalMinutes: number;
  hours: number;
  minutes: number;
  ratePerMin: number;
} => {
  const safeAmount = Math.max(0, Number(amount) || 0);
  let subtotal: number;
  let gstAmount: number;
  let totalAmount: number;

  if (isGstIncluded) {
    totalAmount = Math.round(safeAmount);
    subtotal = Math.round((totalAmount / (1 + gstPct / 100)) * 100) / 100;
    gstAmount = Math.round(totalAmount - subtotal);
  } else {
    subtotal = Math.round(safeAmount * 100) / 100;
    gstAmount = Math.round(subtotal * (gstPct / 100));
    totalAmount = Math.round(subtotal + gstAmount);
  }

  const effectiveRate = ratePerMin > 0 ? ratePerMin : 53.0;
  const totalMinutes = Math.floor(subtotal / effectiveRate);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return {
    subtotal,
    gstAmount,
    totalAmount,
    totalMinutes,
    hours,
    minutes,
    ratePerMin: effectiveRate
  };
};

