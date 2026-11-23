/**
 * Project: CCP – Subscription-Controlled Endoscopic Tower
 * Module: Portal Frontend – Real-Time Telemetry & Event Pipeline
 * Description: Client-side real-time service connecting via WebSocket with automatic SSE and Polling fallback.
 * Safety Relevance: Yes (Live telemetry, watchdog status, and fault alerting)
 */

import { getWsBaseUrl, getApiBaseUrl } from './api';

export interface RealtimePeripherals {
  camera: boolean;
  light: boolean;
  pump: boolean;
  insufflator: boolean;
}

export interface RealtimeTelemetryEvent {
  tower_id: string;
  customer_id?: string | null;
  status?: string;
  is_online?: boolean;
  live_balance_sec?: number | null;
  live_grace_sec?: number | null;
  balance_sec?: number | null;
  grace_sec?: number | null;
  remaining_balance_sec?: number | null;
  is_surgery_active?: boolean;
  surgery_active?: boolean;
  subscription_active?: boolean;
  die_temp_c?: number | null;
  peripherals?: RealtimePeripherals;
  store_seq?: number;
  last_heartbeat_at?: string;
  agreement_type?: string;
  plan_type?: string;
  session_elapsed_sec?: number | null;
  elapsed_sec?: number | null;
}

export type RealtimeEventHandler = (data: any) => void;

class RealtimeClient {
  private ws: WebSocket | null = null;
  private sse: EventSource | null = null;
  private pollTimer: any = null;
  private pingTimer: any = null;
  private reconnectTimer: any = null;
  private listeners: Map<string, Set<RealtimeEventHandler>> = new Map();
  private isConnected: boolean = false;

  constructor() {
    this.connect();
  }

  public connect(): void {
    if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) return;

    const wsBase = getWsBaseUrl();
    let wsUrl: string;

    if (wsBase) {
      if (wsBase.startsWith('ws://') || wsBase.startsWith('wss://')) {
        wsUrl = wsBase.endsWith('/ws') ? wsBase : `${wsBase}/ws`;
      } else if (wsBase.startsWith('/')) {
        const protocol = typeof window !== 'undefined' && window.location?.protocol === 'https:' ? 'wss:' : 'ws:';
        const defaultHost = (import.meta.env as any).VITE_BACKEND_URL ? (import.meta.env as any).VITE_BACKEND_URL.replace(/^https?:\/\//i, '') : 'localhost:8000';
        const host = typeof window !== 'undefined' && window.location?.host ? window.location.host : defaultHost;
        wsUrl = `${protocol}//${host}${wsBase.endsWith('/ws') ? wsBase : `${wsBase}/ws`}`;
      } else {
        wsUrl = `ws://${wsBase.endsWith('/ws') ? wsBase : `${wsBase}/ws`}`;
      }
    } else if (typeof window !== 'undefined' && window.location?.host) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${protocol}//${window.location.host}/ws`;
    } else {
      const backendUrl = (import.meta.env as any).VITE_BACKEND_URL;
      const defaultWs = backendUrl ? backendUrl.replace(/^http/i, 'ws') : 'ws://localhost:8000';
      wsUrl = `${defaultWs.replace(/\/+$/, '')}/ws`;
    }

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.stopPoll();
        this.emit('connection_status', { connected: true, transport: 'websocket' });

        if (this.pingTimer) clearInterval(this.pingTimer);
        this.pingTimer = setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
              this.ws.send(JSON.stringify({ type: 'ping' }));
            } catch {}
          }
        }, 15000);
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onerror = () => {
        this.fallbackToSSE();
      };

      this.ws.onclose = () => {
        if (this.pingTimer) {
          clearInterval(this.pingTimer);
          this.pingTimer = null;
        }
        if (!this.sse && !this.pollTimer) {
          this.isConnected = false;
          this.emit('connection_status', { connected: false });
        }
        this.scheduleReconnect();
      };
    } catch {
      this.fallbackToSSE();
    }
  }

  private handleMessage(rawData: string): void {
    try {
      const payload = JSON.parse(rawData);
      if (!payload) return;

      if (payload.type === 'pong' || payload.event === 'pong') return;

      const eventName = payload.event || payload.type || payload.action;
      const data = payload.data !== undefined ? payload.data : (payload.event ? payload : payload);

      const isTelemetryOrStatus =
        eventName === 'tower_status' ||
        eventName === 'telemetry_snapshot' ||
        eventName === 'telemetry_update' ||
        eventName === 'telemetry_tick' ||
        eventName === 'telemetry' ||
        eventName === 'tower_offline' ||
        (!eventName && data && (data.tower_id || data.id));

      if (isTelemetryOrStatus && data && typeof data === 'object') {
        const towerId = data.tower_id || data.id || data.serial_number || '';
        const isOnline =
          data.is_online !== undefined
            ? Boolean(data.is_online)
            : data.status
            ? data.status !== 'OFFLINE'
            : true;

        const liveBalance =
          data.live_balance_sec !== undefined && data.live_balance_sec !== null
            ? data.live_balance_sec
            : data.remaining_balance_sec !== undefined && data.remaining_balance_sec !== null
            ? data.remaining_balance_sec
            : data.balance_sec !== undefined && data.balance_sec !== null
            ? data.balance_sec
            : 0;

        const normalized: RealtimeTelemetryEvent & Record<string, any> = {
          ...data,
          tower_id: towerId,
          is_online: isOnline,
          live_balance_sec: liveBalance,
          balance_sec: data.balance_sec ?? liveBalance,
          remaining_balance_sec: data.remaining_balance_sec ?? liveBalance,
        };

        const resolvedEvent = eventName || 'telemetry_update';

        // Emit target event
        this.emit(resolvedEvent, normalized);

        // Bridge telemetry event aliases so all subscribers receive the update
        if (resolvedEvent === 'telemetry_snapshot' || resolvedEvent === 'telemetry_update') {
          this.emit('telemetry', normalized);
          this.emit('telemetry_tick', normalized);
        } else if (resolvedEvent === 'telemetry_tick' || resolvedEvent === 'telemetry') {
          this.emit('telemetry_snapshot', normalized);
          this.emit('telemetry_update', normalized);
        }

        this.emit('*', { event: resolvedEvent, data: normalized });
      } else if (eventName) {
        this.emit(eventName, data);
        this.emit('*', payload);
      }
    } catch (err) {
      console.warn('[RealtimeClient] Error parsing message:', err);
    }
  }

  private fallbackToSSE(): void {
    if (this.sse) return;

    const apiBase = getApiBaseUrl();
    let sseUrl = apiBase
      ? (apiBase.endsWith('/api') ? `${apiBase}/portal/events` : `${apiBase}/api/portal/events`)
      : '/api/portal/events';

    const token = typeof localStorage !== 'undefined' ? (localStorage.getItem('portal_token') || localStorage.getItem('token')) : null;
    if (token) {
      sseUrl += `${sseUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
    }

    try {
      this.sse = new EventSource(sseUrl);

      this.sse.onopen = () => {
        this.isConnected = true;
        this.stopPoll();
        this.emit('connection_status', { connected: true, transport: 'sse' });
      };

      this.sse.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.sse.onerror = () => {
        if (this.sse) {
          this.sse.close();
          this.sse = null;
        }
        this.fallbackToPoll();
        this.scheduleReconnect();
      };
    } catch (e) {
      console.warn('[RealtimeClient] SSE setup failed:', e);
      this.fallbackToPoll();
      this.scheduleReconnect();
    }
  }

  private fallbackToPoll(): void {
    if (this.pollTimer) return;
    this.isConnected = true;
    this.emit('connection_status', { connected: true, transport: 'poll' });

    const apiBase = getApiBaseUrl();
    const pollUrl = apiBase
      ? (apiBase.endsWith('/api') ? `${apiBase}/portal/towers` : `${apiBase}/api/portal/towers`)
      : '/api/portal/towers';

    const pollOnce = async () => {
      try {
        const token = typeof localStorage !== 'undefined' ? (localStorage.getItem('portal_token') || localStorage.getItem('token')) : null;
        const headers: Record<string, string> = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        const res = await fetch(pollUrl, { headers });
        if (res.ok) {
          const json = await res.json();
          const towers = Array.isArray(json) ? json : json.data || json.towers || [];
          for (const tower of towers) {
            this.handleMessage(JSON.stringify({
              event: 'tower_status',
              data: tower
            }));
          }
        }
      } catch {}
    };

    pollOnce();
    this.pollTimer = setInterval(pollOnce, 5000);
  }

  private stopPoll(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 4000);
  }

  public on(event: string, handler: RealtimeEventHandler): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);

    return () => {
      this.listeners.get(event)?.delete(handler);
    };
  }

  public emit(event: string, data: any): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (err) {
          console.error(`[RealtimeClient] Error in handler for event "${event}":`, err);
        }
      });
    }
  }

  public disconnect(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopPoll();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.sse) {
      this.sse.close();
      this.sse = null;
    }
    this.isConnected = false;
    this.emit('connection_status', { connected: false });
  }
}

export const realtimeClient = new RealtimeClient();
