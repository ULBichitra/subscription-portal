import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingDown, 
  TrendingUp,
  Sparkles, 
  CheckCircle2, 
  FileSpreadsheet, 
  Printer, 
  Sliders, 
  RefreshCw, 
  Info, 
  BarChart3,
  Target,
  DollarSign,
  Activity,
  Award
} from 'lucide-react';
import { 
  getModelPricingConfigs, 
  DEFAULT_PRICING_CONFIGS, 
  type ModelPricingConfig 
} from '../services/api';

export const CommercialCalculator: React.FC = () => {
  const [pricingConfigs, setPricingConfigs] = useState<Record<string, ModelPricingConfig>>(DEFAULT_PRICING_CONFIGS);
  const [selectedModelKey, setSelectedModelKey] = useState<'LUMINA' | 'SPECTRA'>('SPECTRA');
  const [surgeriesPerMonth, setSurgeriesPerMonth] = useState<number>(20);
  const [avgMinutesPerSurgery, setAvgMinutesPerSurgery] = useState<number>(60);
  const [hospitalProcedureCharge, setHospitalProcedureCharge] = useState<number>(45000);
  const [hospitalName, setHospitalName] = useState<string>('Apex Memorial Institute of Surgery');
  const [departmentName, setDepartmentName] = useState<string>('Department of Minimally Invasive Surgery');
  const [showProposalModal, setShowProposalModal] = useState<boolean>(false);

  useEffect(() => {
    const loadConfigs = async () => {
      try {
        const configs = await getModelPricingConfigs();
        setPricingConfigs(configs);
      } catch (err) {
        console.error('Failed to load pricing configs', err);
      }
    };
    loadConfigs();
  }, []);

  const currentConfig = useMemo(() => {
    return pricingConfigs[selectedModelKey] || DEFAULT_PRICING_CONFIGS[selectedModelKey];
  }, [pricingConfigs, selectedModelKey]);

  // Real-time Year 1 to 5 calculation per Freedom Plan Postpaid Specification
  const calculations = useMemo(() => {
    const monthlyMinutes = surgeriesPerMonth * avgMinutesPerSurgery;
    const surgeriesPerYear = surgeriesPerMonth * 12;
    const totalSurgeries5Years = surgeriesPerYear * 5;
    const totalMinutesPerYear = surgeriesPerYear * avgMinutesPerSurgery;

    const minCommit = currentConfig.monthlyMinCommitment || (selectedModelKey === 'SPECTRA' ? 49000 : 39000);
    const maxCap = currentConfig.monthlyMaxCap || (selectedModelKey === 'SPECTRA' ? 99000 : 79000);
    const cmcRate = currentConfig.cmcRatePerMin || 2.0;
    const cmcCap = currentConfig.cmcMonthlyCap || 10000;

    const yearlyData = currentConfig.rates.map((rateObj) => {
      const rate = rateObj.baseRatePerMin || (selectedModelKey === 'SPECTRA' ? 20.0 : 16.0);
      const rawMonthly = monthlyMinutes * rate;
      const monthlyPlan = Math.min(maxCap, Math.max(minCommit, rawMonthly));
      const monthlyCmc = Math.min(cmcCap, monthlyMinutes * cmcRate);
      const monthlyUsageCost = monthlyPlan + monthlyCmc;
      const annualUsageCost = monthlyUsageCost * 12;
      const costPerSurgery = surgeriesPerYear > 0 ? annualUsageCost / surgeriesPerYear : 0;

      return {
        year: rateObj.year,
        baseRate: rate,
        ratePerMin: rate,
        incrementalRate: rate,
        monthlyPlan: Math.round(monthlyPlan),
        monthlyCmc: Math.round(monthlyCmc),
        costPerSurgery: Math.round(costPerSurgery * 100) / 100,
        monthlyUsageCost: Math.round(monthlyUsageCost),
        annualUsageCost: Math.round(annualUsageCost),
        baseMinsPerSurgery: avgMinutesPerSurgery,
        incMinsPerSurgery: 0,
      };
    });

    const totalUsageCost5Years = yearlyData.reduce((acc, y) => acc + y.annualUsageCost, 0);
    const totalFreedomCost5Years = totalUsageCost5Years + currentConfig.advancePayment;

    const avgCostPerSurgery5Years = Math.round(totalFreedomCost5Years / totalSurgeries5Years);
    const avgCostPerMinute5Years = Math.round((totalFreedomCost5Years / (totalSurgeries5Years * avgMinutesPerSurgery)) * 100) / 100;

    // Imported Competition Benchmark: Rs 1,04,80,000 (Section 6)
    const importedCost5Years = currentConfig.importedBenchmarkCost || 10480000;
    const customerAdvantageSavings = importedCost5Years - totalFreedomCost5Years;
    const savingsPercent = Math.round((customerAdvantageSavings / importedCost5Years) * 1000) / 10;

    // Buy-Now + 12% Compounding Benchmark
    const buyNowCapital = currentConfig.buyNowBaseCost || 6200000;
    const annualAmc = currentConfig.annualServiceCost || 349000;
    // Compounding model: Capital + 12% cost of capital + 5 years AMC
    const buyNowTotal5Years = Math.round(buyNowCapital * 1.28 + (annualAmc * 5));
    const buyNowAdvantageSavings = buyNowTotal5Years - totalFreedomCost5Years;

    // Hospital Revenue & Cumulative Cash Margin Calculations
    const annualHospitalRevenue = surgeriesPerYear * hospitalProcedureCharge;
    const totalHospitalRevenue5Years = annualHospitalRevenue * 5;

    let cumRev = 0;
    let cumFreedomCost = currentConfig.advancePayment;
    let cumImportedCost = 7500000; // Benchmark imported initial CAPEX
    let cumBuyNowCost = buyNowCapital;

    const cumulativeMargins = yearlyData.map((y) => {
      cumRev += annualHospitalRevenue;
      cumFreedomCost += y.annualUsageCost;
      cumImportedCost += 600000; // ~₹6L AMC/year
      cumBuyNowCost += annualAmc;

      const freedomMargin = cumRev - cumFreedomCost;
      const importedMargin = cumRev - cumImportedCost;
      const buyNowMargin = cumRev - cumBuyNowCost;

      return {
        year: y.year,
        annualRevenue: annualHospitalRevenue,
        cumulativeRevenue: cumRev,
        cumulativeFreedomCost: cumFreedomCost,
        cumulativeImportedCost: cumImportedCost,
        cumulativeBuyNowCost: cumBuyNowCost,
        cumulativeFreedomMargin: freedomMargin,
        cumulativeImportedMargin: importedMargin,
        cumulativeBuyNowMargin: buyNowMargin,
        freedomMarginPct: Math.round((freedomMargin / cumRev) * 100),
        importedMarginPct: Math.round((importedMargin / cumRev) * 100),
      };
    });

    // Break-even month calculation
    const monthlyHospitalRev = surgeriesPerMonth * hospitalProcedureCharge;
    const monthlyFreedomCost = yearlyData[0].monthlyUsageCost;
    const netMonthlyFreedomMargin = monthlyHospitalRev - monthlyFreedomCost;
    const freedomBreakEvenMonths = netMonthlyFreedomMargin > 0
      ? Math.max(1, Math.ceil(currentConfig.advancePayment / netMonthlyFreedomMargin))
      : 99;

    const monthlyImportedAmc = 50000; // ₹6L/12
    const netMonthlyImportedMargin = monthlyHospitalRev - monthlyImportedAmc;
    const importedBreakEvenMonths = netMonthlyImportedMargin > 0
      ? Math.max(1, Math.ceil(7500000 / netMonthlyImportedMargin))
      : 99;

    const totalFreedomMargin5Years = totalHospitalRevenue5Years - totalFreedomCost5Years;
    const totalImportedMargin5Years = totalHospitalRevenue5Years - importedCost5Years;
    const additionalCashRetained = totalFreedomMargin5Years - totalImportedMargin5Years;

    return {
      yearlyData,
      surgeriesPerYear,
      totalSurgeries5Years,
      totalMinutesPerYear,
      totalUsageCost5Years,
      totalFreedomCost5Years,
      avgCostPerSurgery5Years,
      avgCostPerMinute5Years,
      importedCost5Years,
      customerAdvantageSavings,
      savingsPercent,
      buyNowTotal5Years,
      buyNowAdvantageSavings,
      annualHospitalRevenue,
      totalHospitalRevenue5Years,
      cumulativeMargins,
      freedomBreakEvenMonths,
      importedBreakEvenMonths,
      totalFreedomMargin5Years,
      totalImportedMargin5Years,
      additionalCashRetained,
    };
  }, [currentConfig, surgeriesPerMonth, avgMinutesPerSurgery, hospitalProcedureCharge]);

  const handlePrintProposal = () => {
    window.print();
  };

  return (
    <div className="space-y-8 pb-16">
      
      {/* Top Banner & Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-950 via-zinc-900 to-indigo-950 border border-blue-500/20 p-6 sm:p-8 shadow-2xl">
        <div className="absolute -right-16 -top-16 w-80 h-80 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
        <div className="absolute right-32 -bottom-20 w-64 h-64 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Commercial ROI & Cost Advantage Studio
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Hospital Executive ROI Simulation
            </h1>
            <p className="text-sm text-gray-300 leading-relaxed">
              Model your facility's case volumes and surgical procedure durations against the UnivLabs Freedom Pay-Per-Minute contract. Realize immediate capital protection with guaranteed rate step-downs over 5 years.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowProposalModal(true)}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-blue-600/30 border border-blue-400/30 transition-all flex items-center gap-2 cursor-pointer transform hover:-translate-y-0.5"
            >
              <FileSpreadsheet className="w-4 h-4 text-cyan-300" />
              <span>Export Commercial Proposal</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Interactive Controls Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Interactive Sliders & Configuration (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-3xl bg-zinc-900/80 border border-white/10 p-6 backdrop-blur-xl shadow-xl space-y-6">
            
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Workload Parameters</h3>
                  <p className="text-xs text-gray-400">Adjust clinical caseload metrics</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSurgeriesPerMonth(20);
                  setAvgMinutesPerSurgery(60);
                  setHospitalProcedureCharge(45000);
                }}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                title="Reset to default 20 surgeries / 60 mins"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Reset Defaults
              </button>
            </div>

            {/* Model Selector Tabs */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                Surgical Imaging Platform
              </label>
              <div className="grid grid-cols-2 gap-3 p-1 bg-black/40 rounded-2xl border border-white/10">
                <button
                  onClick={() => setSelectedModelKey('SPECTRA')}
                  className={`py-3 px-4 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                    selectedModelKey === 'SPECTRA'
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 border border-blue-400/40'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span className="font-extrabold text-sm">SPECTRA ICG 4K</span>
                  <span className="text-[10px] opacity-80">Fluorescence Imaging</span>
                </button>
                <button
                  onClick={() => setSelectedModelKey('LUMINA')}
                  className={`py-3 px-4 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                    selectedModelKey === 'LUMINA'
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 border border-blue-400/40'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span className="font-extrabold text-sm">LUMINA 4K</span>
                  <span className="text-[10px] opacity-80">Ultra HD Visualization</span>
                </button>
              </div>
            </div>

            {/* Slider 1: Surgeries per Month */}
            <div className="space-y-3 p-4 rounded-2xl bg-black/30 border border-white/5">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>Monthly Surgeries</span>
                    <span className="text-[10px] text-gray-400 font-normal">(Cases / Month)</span>
                  </label>
                  <p className="text-[11px] text-gray-400">Total procedural volume per tower</p>
                </div>
                <div className="text-right">
                  <span className="text-xl font-black font-mono text-cyan-400">{surgeriesPerMonth}</span>
                  <span className="text-xs text-gray-400 ml-1">surgeries</span>
                </div>
              </div>

              <input
                type="range"
                min="1"
                max="100"
                step="1"
                value={surgeriesPerMonth}
                onChange={(e) => setSurgeriesPerMonth(Number(e.target.value))}
                className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500 focus:outline-none"
              />

              <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                <span>1 case/mo</span>
                <span className="text-blue-400 font-semibold">Default: 20</span>
                <span>50</span>
                <span>100 cases/mo</span>
              </div>
            </div>

            {/* Slider 2: Average Minutes per Surgery */}
            <div className="space-y-3 p-4 rounded-2xl bg-black/30 border border-white/5">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>Average Surgery Duration</span>
                    <span className="text-[10px] text-gray-400 font-normal">(Minutes / Case)</span>
                  </label>
                  <p className="text-[11px] text-gray-400">First 90 min @ Base rate, 91+ min @ Incremental rate</p>
                </div>
                <div className="text-right">
                  <span className="text-xl font-black font-mono text-blue-400">{avgMinutesPerSurgery}</span>
                  <span className="text-xs text-gray-400 ml-1">mins</span>
                </div>
              </div>

              <input
                type="range"
                min="15"
                max="240"
                step="5"
                value={avgMinutesPerSurgery}
                onChange={(e) => setAvgMinutesPerSurgery(Number(e.target.value))}
                className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 focus:outline-none"
              />

              <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                <span>15 mins</span>
                <span className="text-cyan-400 font-semibold">Default: 60 mins</span>
                <span>90 min base</span>
                <span>240 mins</span>
              </div>
            </div>

            {/* Slider 3: Hospital Procedure Billing Charge */}
            <div className="space-y-3 p-4 rounded-2xl bg-black/30 border border-emerald-500/20">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-white flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Hospital Tariff / Surgery</span>
                    <span className="text-[10px] text-gray-400 font-normal">(Patient Billing)</span>
                  </label>
                  <p className="text-[11px] text-gray-400">Direct procedure billing fee charged by hospital</p>
                </div>
                <div className="text-right">
                  <span className="text-lg font-black font-mono text-emerald-400">₹{(hospitalProcedureCharge / 1000).toFixed(0)}k</span>
                  <span className="text-xs text-gray-400 ml-1">/case</span>
                </div>
              </div>

              <input
                type="range"
                min="20000"
                max="150000"
                step="5000"
                value={hospitalProcedureCharge}
                onChange={(e) => setHospitalProcedureCharge(Number(e.target.value))}
                className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-400 focus:outline-none"
              />

              <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                <span>₹20,000</span>
                <span className="text-emerald-400 font-semibold">Default: ₹45,000</span>
                <span>₹1,50,000</span>
              </div>
            </div>

            {/* Contract Specifications Box */}
            <div className="p-4 rounded-2xl bg-blue-950/30 border border-blue-500/20 text-xs space-y-2">
              <div className="flex items-center gap-2 text-blue-300 font-bold">
                <Info className="w-4 h-4 text-blue-400" />
                <span>Freedom Plan Commercial Rules</span>
              </div>
              <ul className="space-y-1.5 text-gray-300 text-[11px] pl-5 list-disc">
                <li><strong className="text-white">Advance Security Deposit:</strong> ₹{(currentConfig.advancePayment / 100000).toFixed(2)} Lakhs (one-time refundable / deductible).</li>
                <li><strong className="text-white">Dual Tier Billing:</strong> First 90 minutes of each surgery billed at annual base rate; subsequent minutes billed at discounted rate (₹{currentConfig.rates[0].incrementalRatePerMin}/min).</li>
                <li><strong className="text-white">Annual Variable Step-Down:</strong> Base rate decreases every year for 5 years.</li>
                <li><strong className="text-white">Full UnivLabs Warranty:</strong> Zero AMC, zero spare part costs, zero downtime risk for 5 years.</li>
              </ul>
            </div>

          </div>
        </div>

        {/* Right Column: Prominent Savings Badge & Real-time Metrics (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Prominent Customer Advantage Savings Hero Card */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950 via-zinc-900 to-emerald-900/60 border-2 border-emerald-500/40 p-6 sm:p-8 shadow-2xl">
            <div className="absolute right-0 top-0 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
            
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Guaranteed Customer Advantage
                  </span>
                  <span className="text-xs text-gray-400">5-Year Term</span>
                </div>
                <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                  ₹{(calculations.customerAdvantageSavings / 100000).toFixed(2)} Lakhs
                </h2>
                <p className="text-sm font-semibold text-emerald-400 flex items-center gap-1.5 pt-1">
                  <TrendingDown className="w-4 h-4 text-emerald-400" />
                  <span>{calculations.savingsPercent}% total cost savings vs Imported Competition</span>
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-black/40 border border-emerald-500/20 text-right space-y-1 sm:min-w-[190px]">
                <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Freedom 5-Yr Total</p>
                <p className="text-xl font-black text-white font-mono">
                  ₹{(calculations.totalFreedomCost5Years / 100000).toFixed(2)} L
                </p>
                <p className="text-[10px] text-gray-400">
                  Usage: ₹{(calculations.totalUsageCost5Years / 100000).toFixed(2)}L + Adv: ₹{(currentConfig.advancePayment / 100000).toFixed(2)}L
                </p>
              </div>
            </div>

            {/* Quick Metrics Strip */}
            <div className="grid grid-cols-3 gap-3 mt-6 pt-6 border-t border-emerald-500/20 text-center">
              <div className="p-2.5 rounded-xl bg-white/5">
                <p className="text-[10px] text-gray-400 uppercase font-semibold">Avg Cost / Surgery</p>
                <p className="text-base font-extrabold text-white font-mono mt-0.5">₹{calculations.avgCostPerSurgery5Years.toLocaleString()}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-white/5">
                <p className="text-[10px] text-gray-400 uppercase font-semibold">Avg Cost / Minute</p>
                <p className="text-base font-extrabold text-cyan-400 font-mono mt-0.5">₹{calculations.avgCostPerMinute5Years.toFixed(2)}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-white/5">
                <p className="text-[10px] text-gray-400 uppercase font-semibold">5-Yr Procedures</p>
                <p className="text-base font-extrabold text-emerald-400 font-mono mt-0.5">{calculations.totalSurgeries5Years.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Visual Comparison Bar Chart */}
          <div className="rounded-3xl bg-zinc-900/80 border border-white/10 p-6 backdrop-blur-xl shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-bold text-white">5-Year TCO Comparison</h3>
              </div>
              <span className="text-xs text-gray-400 font-mono">TCO (Total Cost of Ownership)</span>
            </div>

            {/* Comparison Bars */}
            <div className="space-y-4">
              
              {/* 1. UnivLabs Freedom Plan */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                    UnivLabs Freedom Plan (Usage + Advance)
                  </span>
                  <span className="font-mono font-bold text-white">
                    ₹{(calculations.totalFreedomCost5Years / 100000).toFixed(2)} Lakhs (100% OPEX)
                  </span>
                </div>
                <div className="h-6 w-full bg-zinc-800 rounded-xl overflow-hidden p-0.5">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-lg flex items-center justify-end pr-2 text-[10px] font-bold text-zinc-950 transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(20, (calculations.totalFreedomCost5Years / calculations.importedCost5Years) * 100))}%` }}
                  >
                    Lowest TCO
                  </div>
                </div>
              </div>

              {/* 2. UnivLabs Buy-Now + 12% Compounding & AMC */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-amber-300 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                    UnivLabs Buy-Now (CAPEX + 12% Cost of Capital + 5y AMC)
                  </span>
                  <span className="font-mono font-semibold text-gray-300">
                    ₹{(calculations.buyNowTotal5Years / 100000).toFixed(2)} Lakhs
                  </span>
                </div>
                <div className="h-6 w-full bg-zinc-800 rounded-xl overflow-hidden p-0.5">
                  <div 
                    className="h-full bg-gradient-to-r from-amber-500 to-orange-400 rounded-lg flex items-center justify-end pr-2 text-[10px] font-bold text-zinc-950 transition-all duration-500"
                    style={{ width: `${Math.min(100, (calculations.buyNowTotal5Years / calculations.importedCost5Years) * 100)}%` }}
                  >
                    CAPEX Model
                  </div>
                </div>
              </div>

              {/* 3. Imported Competition */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-rose-400 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                    Imported Competition (CAPEX + High AMC + Spares)
                  </span>
                  <span className="font-mono font-semibold text-rose-400">
                    ₹{(calculations.importedCost5Years / 100000).toFixed(2)} Lakhs (₹1.05 Cr benchmark)
                  </span>
                </div>
                <div className="h-6 w-full bg-zinc-800 rounded-xl overflow-hidden p-0.5">
                  <div 
                    className="h-full bg-gradient-to-r from-rose-600 to-rose-400 rounded-lg flex items-center justify-end pr-2 text-[10px] font-bold text-white transition-all duration-500"
                    style={{ width: '100%' }}
                  >
                    Standard Imported
                  </div>
                </div>
              </div>

            </div>

            <p className="text-[11px] text-gray-400 italic pt-1">
              * Imported competition benchmark is based on ₹75L capital outlay + 12% cost of capital compounding + ₹6L annual comprehensive AMC over 5 years.
            </p>
          </div>

        </div>

      </div>

      {/* Cumulative Hospital Cash Margin & Break-Even Studio */}
      <div className="rounded-3xl bg-zinc-900/80 border border-white/10 p-6 sm:p-8 backdrop-blur-xl shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
              <Activity className="w-3.5 h-3.5" /> Clinical Profitability & Liquidity Protection
            </div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              <span>Cumulative Hospital Cash Margin & Break-Even Studio</span>
            </h3>
            <p className="text-xs text-gray-400">
              Modeling cumulative cash retention with ₹{(hospitalProcedureCharge / 1000).toFixed(0)}k tariff/case vs equipment operational outlays over 60 months.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 rounded-xl bg-black/40 border border-white/10 text-right">
              <p className="text-[10px] text-gray-400 uppercase font-semibold">Annual Hospital Billing</p>
              <p className="text-sm font-extrabold text-white font-mono">₹{(calculations.annualHospitalRevenue / 100000).toFixed(2)} Lakhs/yr</p>
            </div>
          </div>
        </div>

        {/* 4 Break-Even & Margin KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/40 to-zinc-900 border border-emerald-500/30 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Freedom Break-Even</span>
              <Target className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-black text-white font-mono">Month {calculations.freedomBreakEvenMonths}</p>
            <p className="text-[11px] text-emerald-400 font-medium">Near-instant capital recovery</p>
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-950/40 to-zinc-900 border border-rose-500/30 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">Imported Break-Even</span>
              <Target className="w-4 h-4 text-rose-400" />
            </div>
            <p className="text-2xl font-black text-white font-mono">Month {calculations.importedBreakEvenMonths}</p>
            <p className="text-[11px] text-rose-400 font-medium">Prolonged CAPEX lock-in risk</p>
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-950/40 to-zinc-900 border border-cyan-500/30 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">5-Yr Freedom Net Margin</span>
              <Award className="w-4 h-4 text-cyan-400" />
            </div>
            <p className="text-2xl font-black text-white font-mono">₹{(calculations.totalFreedomMargin5Years / 100000).toFixed(2)} L</p>
            <p className="text-[11px] text-cyan-300 font-medium">{calculations.cumulativeMargins[4]?.freedomMarginPct}% profit retained</p>
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-950/40 to-zinc-900 border border-purple-500/30 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Net Cash Advantage</span>
              <DollarSign className="w-4 h-4 text-purple-400" />
            </div>
            <p className="text-2xl font-black text-emerald-400 font-mono">+₹{(calculations.additionalCashRetained / 100000).toFixed(2)} L</p>
            <p className="text-[11px] text-gray-300 font-medium">Surplus liquidity generated</p>
          </div>
        </div>

        {/* Cumulative Cashflow Milestone Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-y border-white/10 bg-white/5 text-gray-300">
                <th className="py-3 px-4 font-bold">Timeline</th>
                <th className="py-3 px-4 font-bold text-right">Cumulative Patient Billing</th>
                <th className="py-3 px-4 font-bold text-right">Freedom Outlay (Usage+Adv)</th>
                <th className="py-3 px-4 font-bold text-right text-emerald-400">Freedom Net Margin</th>
                <th className="py-3 px-4 font-bold text-right">Imported Outlay</th>
                <th className="py-3 px-4 font-bold text-right text-rose-400">Imported Margin</th>
                <th className="py-3 px-4 font-bold text-right text-cyan-300">Freedom Advantage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono">
              {calculations.cumulativeMargins.map((m) => {
                const advantage = m.cumulativeFreedomMargin - m.cumulativeImportedMargin;
                return (
                  <tr key={m.year} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4 font-sans font-bold text-white">Year {m.year} (Month {m.year * 12})</td>
                    <td className="py-3 px-4 text-right text-gray-200">₹{(m.cumulativeRevenue / 100000).toFixed(2)} L</td>
                    <td className="py-3 px-4 text-right text-emerald-300 font-semibold">₹{(m.cumulativeFreedomCost / 100000).toFixed(2)} L</td>
                    <td className="py-3 px-4 text-right text-emerald-400 font-bold">
                      ₹{(m.cumulativeFreedomMargin / 100000).toFixed(2)} L ({m.freedomMarginPct}%)
                    </td>
                    <td className="py-3 px-4 text-right text-rose-300">₹{(m.cumulativeImportedCost / 100000).toFixed(2)} L</td>
                    <td className="py-3 px-4 text-right text-rose-400">
                      ₹{(m.cumulativeImportedMargin / 100000).toFixed(2)} L ({m.importedMarginPct}%)
                    </td>
                    <td className="py-3 px-4 text-right text-cyan-300 font-bold">
                      +₹{(advantage / 100000).toFixed(2)} Lakhs
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Year 1 to 5 Variable Rate Breakdown Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">5-Year Progressive Rate Step-Down Schedule</h3>
            <p className="text-xs text-gray-400">Guaranteed rate reductions contractually locked for your hospital</p>
          </div>
          <span className="text-xs font-mono text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
            {currentConfig.displayName}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {calculations.yearlyData.map((y, idx) => {
            const isFirst = idx === 0;
            const isLast = idx === 4;
            return (
              <div 
                key={y.year}
                className={`p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between ${
                  isLast 
                    ? 'bg-gradient-to-b from-blue-900/30 to-zinc-900 border-blue-500/40 shadow-lg shadow-blue-500/10'
                    : isFirst
                    ? 'bg-zinc-900/90 border-white/15'
                    : 'bg-zinc-900/60 border-white/10'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-blue-400">
                      Year {y.year}
                    </span>
                    {isLast && (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Max Savings
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-gray-400">Base Rate:</span>
                      <span className="text-lg font-black font-mono text-white">₹{y.baseRate.toFixed(2)}<span className="text-xs text-gray-400 font-normal">/min</span></span>
                    </div>
                    <div className="flex items-baseline justify-between text-xs text-gray-400">
                      <span>Incremental:</span>
                      <span className="font-mono text-cyan-400 font-semibold">₹{y.incrementalRate.toFixed(2)}/min</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/10 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Per Surgery:</span>
                      <span className="font-mono font-bold text-white">₹{y.costPerSurgery.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Monthly Est:</span>
                      <span className="font-mono text-gray-300">₹{(y.monthlyUsageCost / 1000).toFixed(1)}k</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-white/10 text-right">
                  <p className="text-[10px] text-gray-500 uppercase font-semibold">Annualized Total</p>
                  <p className="text-sm font-black font-mono text-emerald-400">
                    ₹{(y.annualUsageCost / 100000).toFixed(2)} Lakhs
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Export Commercial Proposal Modal */}
      {showProposalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-4xl bg-zinc-950 border border-white/20 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-zinc-900/90 no-print">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-bold text-white">Commercial Proposal Preview</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintProposal}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" /> Print / Save as PDF
                </button>
                <button
                  onClick={() => setShowProposalModal(false)}
                  className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Printable Content Body */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-10 bg-white text-zinc-900" id="proposal-print">
              
              {/* Proposal Document Header */}
              <div className="flex justify-between items-start pb-6 border-b-2 border-zinc-900">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-lg bg-blue-600 text-white font-bold text-xl flex items-center justify-center">
                      U
                    </div>
                    <div>
                      <h1 className="text-2xl font-black tracking-tight text-zinc-950">UNIVLABS TECHNOLOGIES</h1>
                      <p className="text-xs text-zinc-600 font-semibold">Freedom Pay-Per-Minute Commercial Offer</p>
                    </div>
                  </div>
                  <div className="mt-4 text-xs space-y-0.5 text-zinc-600">
                    <p><strong className="text-zinc-900">Prepared For:</strong> {hospitalName}</p>
                    <p><strong className="text-zinc-900">Department:</strong> {departmentName}</p>
                    <p><strong className="text-zinc-900">Date:</strong> {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    <p><strong className="text-zinc-900">Proposal ID:</strong> UL-COMM-ROI-{Date.now().toString().slice(-6)}</p>
                  </div>
                </div>

                <div className="text-right">
                  <div className="inline-block bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded mb-2">
                    5-Year Locked Agreement
                  </div>
                  <p className="text-sm font-bold text-zinc-900">{currentConfig.displayName}</p>
                  <p className="text-xs text-zinc-500">Dual-Rate Surgical Minute Architecture</p>
                </div>
              </div>

              {/* Hospital Customization Inputs (In-Document Editor) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6 p-4 rounded-xl bg-zinc-50 border border-zinc-200 text-xs no-print">
                <div>
                  <label className="font-bold text-zinc-700 block mb-1">Target Healthcare Institution Name:</label>
                  <input
                    type="text"
                    value={hospitalName}
                    onChange={(e) => setHospitalName(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-zinc-300 rounded-lg text-zinc-900 font-medium text-xs focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-zinc-700 block mb-1">Department / Clinical Unit:</label>
                  <input
                    type="text"
                    value={departmentName}
                    onChange={(e) => setDepartmentName(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-zinc-300 rounded-lg text-zinc-900 font-medium text-xs focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Executive Summary Cards */}
              <div className="grid grid-cols-3 gap-4 my-6">
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                  <p className="text-[10px] font-bold uppercase text-emerald-800 tracking-wider">Hospital Advantage Savings</p>
                  <p className="text-xl font-black text-emerald-700 mt-1 font-mono">
                    ₹{(calculations.customerAdvantageSavings / 100000).toFixed(2)} Lakhs
                  </p>
                  <p className="text-[11px] text-emerald-600 mt-0.5">{calculations.savingsPercent}% lower than imported competition</p>
                </div>

                <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
                  <p className="text-[10px] font-bold uppercase text-blue-800 tracking-wider">Freedom 5-Yr Commitment</p>
                  <p className="text-xl font-black text-blue-900 mt-1 font-mono">
                    ₹{(calculations.totalFreedomCost5Years / 100000).toFixed(2)} Lakhs
                  </p>
                  <p className="text-[11px] text-blue-600 mt-0.5">Includes ₹{(currentConfig.advancePayment / 100000).toFixed(2)}L advance</p>
                </div>

                <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200">
                  <p className="text-[10px] font-bold uppercase text-zinc-700 tracking-wider">Average Procedure Cost</p>
                  <p className="text-xl font-black text-zinc-900 mt-1 font-mono">
                    ₹{calculations.avgCostPerSurgery5Years.toLocaleString()}
                  </p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">Based on {surgeriesPerMonth} cases/mo ({avgMinutesPerSurgery}m avg)</p>
                </div>
              </div>

              {/* Table of 5-Year Cashflow Schedule */}
              <div className="my-6">
                <h4 className="text-sm font-bold text-zinc-950 mb-2">5-Year Progressive Rate & Cashflow Schedule</h4>
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-y-2 border-zinc-900 bg-zinc-100 text-zinc-900">
                      <th className="py-2.5 px-3 font-bold">Contract Period</th>
                      <th className="py-2.5 px-3 font-bold text-right">Postpaid Rate</th>
                      <th className="py-2.5 px-3 font-bold text-right">CMC Rate</th>
                      <th className="py-2.5 px-3 font-bold text-right">Cost / Surgery</th>
                      <th className="py-2.5 px-3 font-bold text-right">Monthly Estimated</th>
                      <th className="py-2.5 px-3 font-bold text-right">Annual Outlay</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 font-mono">
                    {calculations.yearlyData.map((y) => (
                      <tr key={y.year}>
                        <td className="py-2 px-3 font-sans font-semibold text-zinc-900">Year {y.year}</td>
                        <td className="py-2 px-3 text-right">₹{y.baseRate.toFixed(2)}/min</td>
                        <td className="py-2 px-3 text-right">₹2.00/min (Cap ₹10k)</td>
                        <td className="py-2 px-3 text-right font-semibold">₹{y.costPerSurgery.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right">₹{y.monthlyUsageCost.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right font-bold text-zinc-950">₹{y.annualUsageCost.toLocaleString()}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-zinc-900 bg-zinc-50 font-bold">
                      <td className="py-2.5 px-3 font-sans" colSpan={5}>Total 5-Year Usage Charges:</td>
                      <td className="py-2.5 px-3 text-right text-zinc-950">₹{calculations.totalUsageCost5Years.toLocaleString()}</td>
                    </tr>
                    <tr className="bg-zinc-50 font-bold">
                      <td className="py-2 px-3 font-sans" colSpan={5}>Advance Security Deposit:</td>
                      <td className="py-2 px-3 text-right text-zinc-950">₹{currentConfig.advancePayment.toLocaleString()}</td>
                    </tr>
                    <tr className="border-t-2 border-zinc-900 bg-blue-50 font-black text-sm text-blue-950">
                      <td className="py-3 px-3 font-sans" colSpan={5}>Total 5-Year Freedom Commitment:</td>
                      <td className="py-3 px-3 text-right text-blue-700">₹{calculations.totalFreedomCost5Years.toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Cumulative Margin & Break-Even Section in Proposal */}
              <div className="my-6 p-4 rounded-xl bg-emerald-50/70 border border-emerald-200">
                <h4 className="text-sm font-bold text-emerald-950 mb-1 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Hospital Cumulative Cash Margin & Break-Even Analysis</span>
                </h4>
                <p className="text-[11px] text-emerald-800 mb-3">
                  Based on {surgeriesPerMonth} procedures/month @ ₹{(hospitalProcedureCharge / 1000).toFixed(0)}k procedure billing tariff (₹{(calculations.annualHospitalRevenue / 100000).toFixed(2)} Lakhs annual patient revenue).
                </p>
                <div className="grid grid-cols-4 gap-3 text-center mb-3">
                  <div className="p-2.5 bg-white rounded-lg border border-emerald-200">
                    <p className="text-[10px] uppercase font-bold text-emerald-800">Freedom Break-Even</p>
                    <p className="text-base font-black text-emerald-700 font-mono">Month {calculations.freedomBreakEvenMonths}</p>
                    <p className="text-[10px] text-zinc-500">Immediate ROI</p>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-emerald-200">
                    <p className="text-[10px] uppercase font-bold text-zinc-700">Imported Break-Even</p>
                    <p className="text-base font-black text-rose-700 font-mono">Month {calculations.importedBreakEvenMonths}</p>
                    <p className="text-[10px] text-zinc-500">High CAPEX Exposure</p>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-emerald-200">
                    <p className="text-[10px] uppercase font-bold text-emerald-800">5-Yr Hospital Net Margin</p>
                    <p className="text-base font-black text-emerald-700 font-mono">₹{(calculations.totalFreedomMargin5Years / 100000).toFixed(2)} L</p>
                    <p className="text-[10px] text-emerald-600">{calculations.cumulativeMargins[4]?.freedomMarginPct}% retained</p>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-emerald-200">
                    <p className="text-[10px] uppercase font-bold text-emerald-800">Surplus Cash Retained</p>
                    <p className="text-base font-black text-blue-700 font-mono">+₹{(calculations.additionalCashRetained / 100000).toFixed(2)} L</p>
                    <p className="text-[10px] text-zinc-500">vs Imported Competition</p>
                  </div>
                </div>
              </div>

              {/* Value Inclusions */}
              <div className="my-6 p-4 rounded-xl bg-zinc-50 border border-zinc-200 text-xs space-y-2">
                <h5 className="font-bold text-zinc-900">Included Services & Value Propositions:</h5>
                <div className="grid grid-cols-2 gap-2 text-zinc-600">
                  <p className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Full comprehensive warranty with 0 AMC cost</p>
                  <p className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Free xenon/LED illuminator replacements</p>
                  <p className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> 24/7 telemetry monitoring & predictive failure prevention</p>
                  <p className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Guaranteed 4-hour field engineer response</p>
                </div>
              </div>

              {/* Signatures Area */}
              <div className="grid grid-cols-2 gap-8 pt-8 mt-8 border-t border-zinc-300 text-xs">
                <div>
                  <div className="h-12 border-b border-zinc-400" />
                  <p className="font-bold text-zinc-900 mt-1">Authorized Signatory (UnivLabs Technologies)</p>
                  <p className="text-zinc-500">Commercial Operations & Institutional Sales</p>
                </div>
                <div>
                  <div className="h-12 border-b border-zinc-400" />
                  <p className="font-bold text-zinc-900 mt-1">Accepted By ({hospitalName})</p>
                  <p className="text-zinc-500">Medical Director / Head of Procurement</p>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default CommercialCalculator;
