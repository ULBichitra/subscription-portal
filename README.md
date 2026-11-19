# UnivLabs CCP Web Portal – Clinical & Subscription Management PWA

[![React](https://img.shields.io/badge/React-19.0-61DAFB.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF.svg)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC.svg)](https://tailwindcss.com/)
[![PWA Ready](https://img.shields.io/badge/PWA-Detachable%20Installable-success.svg)](https://web.dev/progressive-web-apps/)
[![IEC 62304 Compliant](https://img.shields.io/badge/IEC%2062304-Class%20B-blue.svg)](https://www.iso.org/standard/38421.html)

The **UnivLabs CCP Web Portal** is an installable, high-reliability Progressive Web Application (PWA) designed for clinical staff, biomedical engineers, hospital administrators, and UnivLabs operations personnel. It interfaces with the unified `csm-backend` (port 8000) or standalone Subscription Server to provide real-time tower telemetry monitoring, subscription billing, customer management, quality complaints resolution, and remote maintenance.

---

## Table of Contents

- [1. Detachable PWA Web Portal](#1-detachable-pwa-web-portal)
- [2. Mobile & Desktop Install Prompt](#2-mobile--desktop-install-prompt)
- [3. Cyber-Clinical UI Design System](#3-cyber-clinical-ui-design-system)
- [4. Customer Analytics & Telemetry Dashboards](#4-customer-analytics--telemetry-dashboards)
- [5. API Routing & Real-Time Communication](#5-api-routing--real-time-communication)
- [6. Project Structure](#6-project-structure)
- [7. Development & Production Workflows](#7-development--production-workflows)

---

## 1. Detachable PWA Web Portal

The portal operates as a fully detachable Progressive Web Application (PWA):
- **Standalone Display Mode**: Launches in an isolated, chromeless window without browser navigation bars (`"display": "standalone"` in `public/manifest.json`).
- **Offline Resilience**: Registered service worker (`public/sw.js` and `src/sw.ts`) caches core app shells, assets, and styling for instant startup even during hospital network drops.
- **Offline Status Banner**: Active network listener (`src/components/OfflineBanner.tsx`) displays live offline warning when connectivity is interrupted.
- **Maskable App Icons**: High-resolution 512x512 maskable icons (`public/icon-maskable-512.png`) provide adaptive launcher icons on Android, iOS, Windows, and macOS.

---

## 2. Mobile & Desktop Install Prompt

The portal implements native and in-app install flows:
- **`beforeinstallprompt` Interception**: Captures browser-level installation triggers and defers them to custom UI prompts (`src/components/PwaInstallPrompt.tsx`).
- **One-Click Installation**: Persistent quick-install button in the top navigation bar allows operators to pin the portal to their desktop or home screen.
- **Custom Install Modal**: Step-by-step instructions for Safari/iOS ("Add to Home Screen") and Chrome/Edge desktop installation.

---

## 3. Cyber-Clinical UI Design System

Built on Tailwind CSS with a specialized **Cyber-Clinical Dark Mode** aesthetic tailored for surgical suites and dimly lit operating theaters:

### Visual Language & Design Tokens
- **Base Canvas**: Deep void slate (`#0b0f19`, `#111827`) reducing screen glare in clinical rooms.
- **Glow & Accent Palette**:
  - `Cyan Accent` (`#00f5ff` / `rgb(6 182 212)`): Active tower link and real-time telemetry streaming.
  - `Emerald Status` (`#10b981`): Healthy balance, authenticated session, and verified device identity.
  - `Amber Caution` (`#f59e0b`): Expiring subscription, low balance (<5 hours), or serial link warning.
  - `Rose Critical` (`#ef4444`): Device lockout, tamper alert, or failed hardware communication.
- **Glassmorphism Components**: Translucent backdrop blur cards (`src/components/ui/GlassCard.tsx`) with subtle high-contrast border outlines.
- **Clinical Gauges & Telemetry Charts**:
  - `BalanceGauge.tsx`: Radial SVG gauge tracking remaining surgical time units.
  - `ProgressGauge.tsx`: Dual-metric linear consumption tracker.
  - `StatusDonutChart.tsx`, `LineChart.tsx`, `AreaChart.tsx`, `BarChart.tsx`: Real-time canvas/SVG metrics for procedure timelines.

---

## 4. Customer Analytics & Telemetry Dashboards

The portal provides zero-mock, live operational dashboards:
- **Executive Dashboard (`src/views/Dashboard.tsx`)**: Real-time KPI summary showing active towers, online/offline ratios, total surgical hours, and pending recharges.
- **Tower Fleet Management (`src/views/TowerManagement.tsx`)**: Multi-column table with hardware IDs, hospital assignments, serial status, and remote maintenance unlock.
- **Customer & Hospital Accounts (`src/views/CustomerManagement.tsx`)**: Hospital profile management, contractual plan allocations, and tower provisioning wizards.
- **Subscription & Balance Tracking (`src/views/SubscriptionManagement.tsx`, `src/views/BalanceManagement.tsx`)**: Real-time balance ledger, two-phase recharge approvals, and automated billing generation.
- **Commercial Calculator (`src/views/CommercialCalculator.tsx`)**: Tiered pricing projections and cost-per-procedure modeling.
- **Quality & Complaints Management (`src/views/ComplaintsManagement.tsx`)**: IEC 62304 / ISO 13485 compliant complaint logging, triage workflows, and root cause audits.
- **Session & Audit Trails (`src/views/SessionLogs.tsx`, `src/views/AuditTrail.tsx`)**: 7-year retained immutable surgery records, HMAC-SHA256 signature verification, and PDF/CSV export.

---

## 5. API Routing & Real-Time Communication

### 5.1 Architecture & Proxy Configuration
In development, Vite proxies `/api` and `/ws` to the backend server (default `http://127.0.0.1:8000`):
```typescript
// vite.config.ts
export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      },
      '/ws': {
        target: process.env.VITE_WS_URL || 'ws://127.0.0.1:8000',
        ws: true,
      }
    }
  }
});
```

### 5.2 Core API Routes
| Endpoint Prefix | Backend Domain | Purpose |
|---|---|---|
| `/api/portal/auth` | `subscription/portal-compat` | RBAC login, JWT issuance, password reset, account activation |
| `/api/portal/users` | `subscription/portal-compat` | User administration, roles (`SuperAdmin`, `Admin`, `HospitalUser`, `FieldEngineer`) |
| `/api/portal/towers` | `subscription/portal-compat` | Device registry, tower activation, certificate status |
| `/api/portal/subscriptions` | `subscription/portal-compat` | Subscription tiers, balance allocation, recharge requests |
| `/api/portal/invoices` | `subscription/portal-compat` | Invoicing, payment reconciliations, commercial rate cards |
| `/api/portal/complaints` | `subscription/portal-compat` | Customer complaints, CAPA tracking, regulatory logs |
| `/api/portal/audit-trail` | `subscription/portal-compat` | Surgery session logs, audit trail queries, tamper detection |
| `/ws` | `subscription/websocket` | WebSocket stream for live tower heartbeats and status events |

---

## 6. Project Structure

```
subscription-portal/
├── public/
│   ├── manifest.json              # PWA manifest metadata
│   ├── sw.js                      # PWA service worker
│   └── icon-maskable-512.png      # Maskable app icons
├── src/
│   ├── assets/                    # Static brand logos and artwork
│   ├── components/                # Reusable UI widgets and layout modules
│   │   ├── ui/                    # Cyber-clinical atomic components (Gauges, Charts, Cards)
│   │   ├── Layout.tsx             # Master navigation frame with sidebar & header
│   │   ├── PwaInstallPrompt.tsx   # Mobile & desktop installation modal
│   │   └── OfflineBanner.tsx      # Network status warning strip
│   ├── services/
│   │   ├── api.ts                 # Axios HTTP client with JWT interceptors
│   │   └── realtime.ts            # WebSocket connection manager
│   ├── views/                     # Top-level route views (Dashboard, Towers, Subscriptions, etc.)
│   ├── App.tsx                    # Route definitions and RBAC guard wrappers
│   └── main.tsx                   # React root entry point
├── package.json                   # Dependencies and build scripts
└── vite.config.ts                 # Vite build & reverse proxy configuration
```

---

## 7. Development & Production Workflows

### 7.1 Development Server
```bash
# 1. Install dependencies
npm install

# 2. Run Vite dev server with Hot Module Replacement (HMR)
npm run dev
```
Accessible at: `http://localhost:5173`

### 7.2 Production Build
```bash
# Compile TypeScript and generate optimized production bundle
npm run build
```
Output is emitted to `dist/`, which is directly mountable and servable via Nginx reverse proxy or static CDN.
