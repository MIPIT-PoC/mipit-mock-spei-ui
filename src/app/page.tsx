'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast, Toaster } from 'sonner';
import {
  Loader2, CheckCircle, XCircle, Clock, ArrowRight,
  Globe, Zap, Send, RefreshCw, Settings, ToggleLeft, ToggleRight,
} from 'lucide-react';

const RAIL_INFO = {
  PIX:  { flag: '🇧🇷', name: 'PIX',   country: 'Brasil',   currency: 'BRL' },
  SPEI: { flag: '🇲🇽', name: 'SPEI',  country: 'Mexico',   currency: 'MXN' },
  BREB: { flag: '🇨🇴', name: 'BRE_B', country: 'Colombia', currency: 'COP' },
} as const;

const PAYMENT_STAGES = [
  { key: 'created_at',       label: 'Recibido'       },
  { key: 'validated_at',     label: 'Validado'       },
  { key: 'canonicalized_at', label: 'Canonicalizado' },
  { key: 'routed_at',        label: 'Enrutado'       },
  { key: 'queued_at',        label: 'En Cola'        },
  { key: 'sent_at',          label: 'Enviado'        },
  { key: 'acked_at',         label: 'Confirmado'     },
  { key: 'completed_at',     label: 'Completado'     },
];

const REJECT_CODES_SPEI = ['R01', 'R02', 'R03', 'R04', 'R05', 'R06'];

type AdapterConfig = {
  enabled: boolean; rejectionRate: number; minLatencyMs: number;
  maxLatencyMs: number; forceRejectCode: string;
  forceRejectNext?: boolean; forceTimeoutNext?: boolean;
};
type AdapterStats = {
  rail: string; totalReceived: number; totalAccepted: number;
  totalRejected: number; totalTimeout: number;
  lastPaymentAt: string | null; idempotencyStoreSize: number; config: AdapterConfig;
};
type PaymentDetail = {
  payment_id: string; status: string; origin_rail: string;
  destination_rail: string; amount: number; currency: string;
  trace_id: string; timestamps: Record<string, string | null>;
};
type DestRail = 'PIX' | 'BREB';
type PageMode = 'local' | 'international' | 'simulator';

const localSchema = z.object({
  debtorAlias:   z.string().min(1, 'Requerido'),
  debtorName:    z.string().optional(),
  creditorAlias: z.string().min(1, 'Requerido'),
  creditorName:  z.string().optional(),
  amount:        z.coerce.number().positive('Debe ser mayor a 0'),
  currency:      z.string().default('MXN'),
  purpose:       z.string().optional().default('TRANSFERENCIA'),
  reference:     z.string().optional(),
});
const intlSchema = z.object({
  debtorAlias:   z.string().min(1, 'Requerido'),
  debtorName:    z.string().optional(),
  creditorAlias: z.string().min(1, 'Requerido'),
  creditorName:  z.string().optional(),
  amount:        z.coerce.number().positive('Debe ser mayor a 0'),
  reference:     z.string().optional(),
});
type LocalValues = z.infer<typeof localSchema>;
type IntlValues  = z.infer<typeof intlSchema>;

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    COMPLETED: 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30',
    FAILED:    'bg-red-500/20 text-red-400 ring-1 ring-red-500/30',
    REJECTED:  'bg-orange-500/20 text-orange-400 ring-1 ring-orange-500/30',
    QUEUED:    'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30',
    ROUTED:    'bg-teal-500/20 text-teal-400 ring-1 ring-teal-500/30',
    SENT:      'bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/30',
    ACKED:     'bg-violet-500/20 text-violet-400 ring-1 ring-violet-500/30',
    VALIDATED: 'bg-cyan-500/20 text-cyan-400 ring-1 ring-cyan-500/30',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${map[status] ?? 'bg-zinc-500/20 text-zinc-400'}`}>
      {status}
    </span>
  );
}

function FlowDiagram({ dest, status }: { dest: DestRail; status?: string }) {
  const dst = RAIL_INFO[dest];
  const done   = status === 'COMPLETED';
  const failed = status === 'FAILED' || status === 'REJECTED';
  const line = done ? 'bg-emerald-500' : failed ? 'bg-red-500' : 'bg-emerald-500';
  const hub  = done ? 'bg-emerald-500 shadow-emerald-500/30' : failed ? 'bg-red-500 shadow-red-500/30' : 'bg-emerald-500 shadow-emerald-500/30 animate-pulse';
  return (
    <div className="glass-card rounded-2xl p-5">
      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">Ruta del pago</p>
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col items-center gap-1 min-w-[60px]">
          <div className="w-12 h-12 bg-zinc-800/80 rounded-xl shadow-lg flex items-center justify-center text-2xl border border-zinc-700/50">🇲🇽</div>
          <span className="text-xs font-bold text-zinc-200">SPEI</span>
          <span className="text-[10px] text-zinc-500">Mexico</span>
        </div>
        <div className="flex flex-1 items-center gap-1">
          <div className={`h-0.5 flex-1 rounded ${line} transition-colors duration-700`} />
          <div className="flex flex-col items-center gap-0.5">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center shadow-lg transition-all duration-700 ${hub}`}>
              <Zap className="w-4 h-4 text-zinc-900" />
            </div>
            <span className="text-[10px] text-zinc-500 whitespace-nowrap">mipit-core</span>
          </div>
          <div className={`h-0.5 flex-1 rounded ${line} transition-colors duration-700`} />
        </div>
        <div className="flex flex-col items-center gap-1 min-w-[60px]">
          <div className="w-12 h-12 bg-zinc-800/80 rounded-xl shadow-lg flex items-center justify-center text-2xl border border-zinc-700/50">{dst.flag}</div>
          <span className="text-xs font-bold text-zinc-200">{dst.name}</span>
          <span className="text-[10px] text-zinc-500">{dst.country}</span>
        </div>
      </div>
    </div>
  );
}

function PaymentTimeline({ timestamps }: { timestamps: Record<string, string | null> }) {
  return (
    <div className="space-y-2.5">
      {PAYMENT_STAGES.map((stage) => {
        const ts = timestamps[stage.key];
        return (
          <div key={stage.key} className="flex items-center gap-3">
            <div className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center transition-colors duration-500 ${ts ? 'bg-emerald-500' : 'bg-zinc-700'}`}>
              {ts ? <CheckCircle className="w-3.5 h-3.5 text-zinc-900" /> : <div className="w-1.5 h-1.5 rounded-full bg-zinc-500" />}
            </div>
            <span className={`flex-1 text-sm transition-colors ${ts ? 'text-zinc-200 font-medium' : 'text-zinc-500'}`}>{stage.label}</span>
            {ts && <span className="text-xs font-mono text-zinc-500">{new Date(ts).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>}
          </div>
        );
      })}
    </div>
  );
}

function BankingSimulator({ adapterUrl, rejectCodes }: { adapterUrl: string; rejectCodes: string[] }) {
  const [stats, setStats]           = useState<AdapterStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [config, setConfig]         = useState<AdapterConfig>({
    enabled: true, rejectionRate: 10, minLatencyMs: 80, maxLatencyMs: 450, forceRejectCode: rejectCodes[0],
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const res = await fetch(`${adapterUrl}/admin/stats`);
      if (!res.ok) return;
      const data: AdapterStats = await res.json();
      setStats(data);
      // Audit 4 Y13 — adapter devuelve rejectionRate en 0-1; UI lo muestra 0-100.
      setConfig({ ...data.config, rejectionRate: Math.round(data.config.rejectionRate * 100) });
    } catch { /* offline */ } finally { setStatsLoading(false); }
  }, [adapterUrl]);

  useEffect(() => {
    fetchStats();
    intervalRef.current = setInterval(fetchStats, 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchStats]);

  const saveConfig = async () => {
    try {
      setActionLoading('config');
      // Audit 4 Y13 — UI mantiene rejectionRate en 0-100 (slider); adapter 0-1.
      const payload = { ...config, rejectionRate: config.rejectionRate / 100 };
      const res = await fetch(`${adapterUrl}/admin/config`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      toast.success('Configuracion guardada');
      fetchStats();
    } catch { toast.error('Error al guardar configuracion'); } finally { setActionLoading(null); }
  };

  const doAction = async (endpoint: string, label: string) => {
    try {
      setActionLoading(endpoint);
      const res = await fetch(`${adapterUrl}/admin/${endpoint}`, { method: 'POST' });
      if (!res.ok) throw new Error();
      toast.success(label);
      fetchStats();
    } catch { toast.error(`Error: ${label}`); } finally { setActionLoading(null); }
  };

  return (
    <div className="space-y-4">
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between border-b border-zinc-700/50">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🇲🇽</span>
            <div>
              <h3 className="font-bold text-zinc-100 text-sm">SPEI (Mexico)</h3>
              <p className="text-xs text-zinc-500">Adaptador mock - puerto 9102</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-1.5 text-xs font-medium ${stats ? 'text-emerald-400' : 'text-zinc-500'}`}>
              <span className={`w-2 h-2 rounded-full ${stats ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} />
              {stats ? 'En linea' : 'Sin conexion'}
            </div>
            <button onClick={fetchStats} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-zinc-700 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-300">
              <RefreshCw className={`w-3 h-3 ${statsLoading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>
        </div>
        <div className="p-5">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Estadisticas</p>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Recibidos',  value: stats?.totalReceived ?? 0, color: 'text-zinc-100'   },
              { label: 'Aceptados',  value: stats?.totalAccepted ?? 0, color: 'text-emerald-400' },
              { label: 'Rechazados', value: stats?.totalRejected ?? 0, color: 'text-red-400'    },
              { label: 'Timeouts',   value: stats?.totalTimeout  ?? 0, color: 'text-orange-400' },
            ].map((s) => (
              <div key={s.label} className="bg-zinc-800/50 rounded-xl p-3 border border-zinc-700/50">
                <p className="text-[10px] text-zinc-500 mb-1">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-zinc-700/50">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Configuracion</p>
        </div>
        <div className="p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-200">Mock habilitado</p>
              <p className="text-xs text-zinc-500 mt-0.5">El adaptador procesara pagos entrantes</p>
            </div>
            <button onClick={() => setConfig((c) => ({ ...c, enabled: !c.enabled }))}
              className={`transition-colors ${config.enabled ? 'text-emerald-500' : 'text-zinc-600'}`}>
              {config.enabled ? <ToggleRight className="w-8 h-8 text-emerald-500" /> : <ToggleLeft className="w-8 h-8 text-zinc-600" />}
            </button>
          </div>
          <div className="h-px bg-zinc-700/50" />
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-zinc-200">Tasa de rechazo</p>
              <span className="text-sm font-bold text-emerald-400">{config.rejectionRate}%</span>
            </div>
            <input type="range" min={0} max={100} step={1} value={config.rejectionRate}
              onChange={(e) => setConfig((c) => ({ ...c, rejectionRate: Number(e.target.value) }))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer bg-zinc-700 accent-emerald-500" />
            <div className="flex justify-between text-[10px] text-zinc-500 mt-1"><span>0%</span><span>50%</span><span>100%</span></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Latencia min. (ms)</label>
              <input type="number" value={config.minLatencyMs}
                onChange={(e) => setConfig((c) => ({ ...c, minLatencyMs: Number(e.target.value) }))}
                className="w-full px-3 py-2 text-sm bg-zinc-800/80 border border-zinc-700 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 text-zinc-200" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Latencia max. (ms)</label>
              <input type="number" value={config.maxLatencyMs}
                onChange={(e) => setConfig((c) => ({ ...c, maxLatencyMs: Number(e.target.value) }))}
                className="w-full px-3 py-2 text-sm bg-zinc-800/80 border border-zinc-700 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 text-zinc-200" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Codigo de rechazo forzado</label>
            <select value={config.forceRejectCode}
              onChange={(e) => setConfig((c) => ({ ...c, forceRejectCode: e.target.value }))}
              className="w-full px-3 py-2 text-sm bg-zinc-800/80 border border-zinc-700 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/50 text-zinc-200">
              {rejectCodes.map((code) => <option key={code} value={code}>{code}</option>)}
            </select>
          </div>
          <button onClick={saveConfig} disabled={actionLoading === 'config'}
            className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-zinc-900 font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors text-sm">
            {actionLoading === 'config' ? <><Loader2 className="w-4 h-4 animate-spin" />Guardando...</> : <><Settings className="w-4 h-4" />Guardar Configuracion</>}
          </button>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-5">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Acciones de prueba</p>
        <div className="flex gap-3">
          <button onClick={() => doAction('reject-next', 'Proximo pago sera rechazado')} disabled={!!actionLoading}
            className="flex-1 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 disabled:opacity-60 text-red-400 font-semibold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors">
            {actionLoading === 'reject-next' ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
            Rechazar siguiente
          </button>
          <button onClick={() => doAction('timeout-next', 'Proximo pago tendra timeout')} disabled={!!actionLoading}
            className="flex-1 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 disabled:opacity-60 text-orange-400 font-semibold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors">
            {actionLoading === 'timeout-next' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
            Timeout siguiente
          </button>
          <button onClick={() => doAction('reset', 'Adaptador reseteado')} disabled={!!actionLoading}
            className="px-4 bg-zinc-700/50 hover:bg-zinc-700 border border-zinc-600/50 disabled:opacity-60 text-zinc-300 font-semibold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors">
            {actionLoading === 'reset' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Resetear
          </button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {stats?.config.forceRejectNext && (
            <div className="flex items-center gap-1.5 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400 font-medium">
              <XCircle className="w-3.5 h-3.5" /> Proximo rechazo activo
            </div>
          )}
          {stats?.config.forceTimeoutNext && (
            <div className="flex items-center gap-1.5 px-3 py-2 bg-orange-500/10 border border-orange-500/30 rounded-lg text-xs text-orange-400 font-medium">
              <Clock className="w-3.5 h-3.5" /> Proximo timeout activo
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SpeiSimulatorPage() {
  const [mode, setMode]         = useState<PageMode>('local');
  const [destRail, setDestRail] = useState<DestRail>('PIX');
  const [localStatus, setLocalStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [localResponse, setLocalResponse] = useState<object | null>(null);
  const [intlStatus, setIntlStatus] = useState<'idle' | 'loading' | 'polling' | 'success' | 'error'>('idle');
  const [payment, setPayment]   = useState<PaymentDetail | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Audit 4 — /admin/* y /api/simulate/* viven en mock-server (:9002),
  // NO en health-server (:9102 que sólo expone /health y /metrics).
  const apiUrl     = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';
  const adapterUrl = process.env.NEXT_PUBLIC_ADAPTER_URL  || 'http://localhost:9002';

  const localForm = useForm<LocalValues>({
    resolver: zodResolver(localSchema),
    defaultValues: {
      // Audit 4 Y14 — CLABE mod-10 weighted válidas.
      debtorAlias: 'SPEI-012180000118359713', debtorName: 'Juan Pérez',
      creditorAlias: 'SPEI-002180012345678906', creditorName: 'María García',
      amount: 500.00, currency: 'MXN', purpose: 'TRANSFERENCIA', reference: 'SPEI-TEST-001',
    },
  });

  // Audit 4 Y14 — CPF mod-11 + +57 mobile-only TR-002.
  const DEST_DEFAULTS: Record<DestRail, { alias: string; name: string }> = {
    PIX:  { alias: 'PIX-12345678909',    name: 'João Silva' },
    BREB: { alias: 'BREB-+573001234567', name: 'Ana López'  },
  };

  const intlForm = useForm<IntlValues>({
    resolver: zodResolver(intlSchema),
    defaultValues: {
      // Audit 4 Y14 — CLABE válido (idéntico al de Local form).
      debtorAlias: 'SPEI-012180000118359713', debtorName: 'Juan Pérez',
      creditorAlias: DEST_DEFAULTS.PIX.alias, creditorName: DEST_DEFAULTS.PIX.name,
      amount: 500.00, reference: 'SPEI-INTL-001',
    },
  });

  const handleDestRailChange = (rail: DestRail) => {
    setDestRail(rail);
    intlForm.setValue('creditorAlias', DEST_DEFAULTS[rail].alias);
    intlForm.setValue('creditorName',  DEST_DEFAULTS[rail].name);
  };

  // Audit 4 Y1 — el core devuelve { access_token, token_type, expires_in };
  // antes leíamos { token } → Bearer undefined → 401 silencioso.
  async function getToken(): Promise<string> {
    const r = await fetch(`${apiUrl}/auth/token`, { method: 'POST' });
    if (!r.ok) throw new Error(`auth/token HTTP ${r.status}`);
    const j = (await r.json()) as { access_token?: string };
    return j.access_token ?? '';
  }

  const pollPayment = useCallback(async (id: string) => {
    try {
      // Audit 4 Y3 — antes /payments/:id sin Authorization → 401 silencioso.
      const token = await getToken().catch(() => '');
      const res = await fetch(`${apiUrl}/payments/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return;
      const data: PaymentDetail = await res.json();
      setPayment(data);
      if (['COMPLETED', 'FAILED', 'REJECTED'].includes(data.status)) {
        if (pollingRef.current) clearInterval(pollingRef.current);
        setIntlStatus(data.status === 'COMPLETED' ? 'success' : 'error');
        if (data.status === 'COMPLETED') toast.success('Pago completado exitosamente');
        else toast.error(`Pago ${data.status.toLowerCase()}`);
      }
    } catch { /* silent */ }
  }, [apiUrl]);

  useEffect(() => () => { if (pollingRef.current) clearInterval(pollingRef.current); }, []);

  const onLocalSubmit = async (data: LocalValues) => {
    try {
      setLocalStatus('loading');
      // Audit 4 Y2 — /api/simulate/spei vive en mock-server (:9002), NO core.
      const res = await fetch(`${adapterUrl}/api/simulate/spei`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      setLocalResponse(await res.json());
      setLocalStatus('success');
      toast.success('Simulacion completada');
    } catch (err) {
      setLocalStatus('error');
      toast.error('Error en simulacion', { description: err instanceof Error ? err.message : 'Error desconocido' });
    }
  };

  const onIntlSubmit = async (data: IntlValues) => {
    try {
      setIntlStatus('loading');
      setPayment(null);
      const token = await getToken().catch(() => '');
      const body = {
        amount: data.amount, currency: 'MXN',
        debtor:   { alias: data.debtorAlias,  name: data.debtorName  || undefined },
        creditor: { alias: data.creditorAlias, name: data.creditorName || undefined },
        purpose: 'TRANSFERENCIA', reference: data.reference || 'SPEI-INTL',
      };
      const res = await fetch(`${apiUrl}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message || `Error ${res.status}`);
      }
      const created = await res.json() as PaymentDetail;
      setPayment({ ...created, timestamps: { created_at: created.timestamps?.created_at ?? new Date().toISOString() } });
      setIntlStatus('polling');
      toast.info('Pago enviado, procesando...', { description: created.payment_id });
      pollingRef.current = setInterval(() => pollPayment(created.payment_id), 2000);
      setTimeout(() => { if (pollingRef.current) clearInterval(pollingRef.current); setIntlStatus((s) => s === 'polling' ? 'success' : s); }, 60_000);
    } catch (err) {
      setIntlStatus('error');
      toast.error('Error al crear pago', { description: err instanceof Error ? err.message : 'Error desconocido' });
    }
  };

  const resetLocal = () => { setLocalStatus('idle'); setLocalResponse(null); };
  const resetIntl  = () => { if (pollingRef.current) clearInterval(pollingRef.current); setIntlStatus('idle'); setPayment(null); };
  const inp = 'w-full px-3 py-2 text-sm bg-zinc-800/80 border border-zinc-700 rounded-lg outline-none transition focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 text-zinc-200 placeholder:text-zinc-500';

  return (
    <div className="min-h-screen gradient-bg">
      <Toaster richColors position="top-right" theme="dark" />

      <header className="sticky top-0 z-10 glass border-b border-zinc-800/50">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center text-lg shadow-lg shadow-emerald-500/20">🇲🇽</div>
            <div>
              <span className="text-sm font-bold text-zinc-100">SPEI Simulator</span>
              <span className="ml-2 text-xs text-zinc-500">Sistema de Pagos Electronicos Interbancarios</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            mipit-core
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="inline-flex glass-card rounded-xl p-1 mb-8">
          {([
            { id: 'local',         icon: Zap,     label: 'Simulacion Local'   },
            { id: 'international', icon: Globe,    label: 'Pago Internacional' },
            { id: 'simulator',     icon: Settings, label: 'Simulador Bancario' },
          ] as const).map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => setMode(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${mode === id ? 'bg-emerald-500 text-zinc-900 shadow-lg shadow-emerald-500/20' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}`}>
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>

        {mode === 'simulator' && <BankingSimulator adapterUrl={adapterUrl} rejectCodes={REJECT_CODES_SPEI} />}

        {mode !== 'simulator' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass-card rounded-2xl overflow-hidden">
              {mode === 'local' ? (
                <>
                  <div className="px-6 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600">
                    <h2 className="text-base font-semibold text-zinc-900">Simular Transferencia SPEI</h2>
                    <p className="text-xs text-emerald-900/70 mt-0.5">Flujo bancario local dentro de Mexico</p>
                  </div>
                  <form onSubmit={localForm.handleSubmit(onLocalSubmit)} className="p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1">CLABE Ordenante</label>
                        <input {...localForm.register('debtorAlias')} placeholder="SPEI-012180000118359719" className={`${inp} font-mono`} />
                        <p className="text-[10px] text-zinc-500 mt-0.5">SPEI-{'{CLABE 18}'}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1">Nombre Ordenante</label>
                        <input {...localForm.register('debtorName')} placeholder="Juan Perez" className={inp} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1">CLABE Beneficiario</label>
                        <input {...localForm.register('creditorAlias')} placeholder="SPEI-002180012345678901" className={`${inp} font-mono`} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1">Nombre Beneficiario</label>
                        <input {...localForm.register('creditorName')} placeholder="Maria Garcia" className={inp} />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-zinc-400 mb-1">Monto</label>
                        <input type="number" step="0.01" {...localForm.register('amount')} className={inp} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1">Moneda</label>
                        <input {...localForm.register('currency')} maxLength={3} className={inp} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1">Proposito</label>
                        <input {...localForm.register('purpose')} className={inp} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1">Referencia</label>
                        <input {...localForm.register('reference')} placeholder="SPEI-TEST-001" className={inp} />
                      </div>
                    </div>
                    <button type="submit" disabled={localStatus === 'loading'}
                      className="w-full mt-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-zinc-900 font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors text-sm shadow-lg shadow-emerald-500/20">
                      {localStatus === 'loading' ? <><Loader2 className="w-4 h-4 animate-spin" />Simulando...</> : <><Send className="w-4 h-4" />Simular Transferencia SPEI</>}
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <div className="px-6 py-4 bg-gradient-to-r from-sky-500 to-emerald-500">
                    <h2 className="text-base font-semibold text-white">Pago Internacional SPEI</h2>
                    <p className="text-xs text-sky-100/70 mt-0.5">Flujo completo a traves de mipit-core</p>
                  </div>
                  <form onSubmit={intlForm.handleSubmit(onIntlSubmit)} className="p-5 space-y-4">
                    <div className="flex items-center gap-2.5 px-3 py-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                      <span className="text-xl">🇲🇽</span>
                      <div>
                        <div className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wide">Rail Origen</div>
                        <div className="text-sm font-bold text-emerald-400">SPEI - Mexico - MXN</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1">CLABE Ordenante</label>
                        <input {...intlForm.register('debtorAlias')} className={`${inp} font-mono`} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1">Nombre Ordenante</label>
                        <input {...intlForm.register('debtorName')} placeholder="Juan Perez" className={inp} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-px bg-zinc-700/50" />
                      <span className="text-[11px] text-zinc-500 font-medium flex items-center gap-1"><ArrowRight className="w-3 h-3" /> enviar a</span>
                      <div className="flex-1 h-px bg-zinc-700/50" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-2">Rail Destino</label>
                      <div className="grid grid-cols-2 gap-2">
                        {(['PIX', 'BREB'] as DestRail[]).map((rail) => {
                          const info = RAIL_INFO[rail];
                          const selected = destRail === rail;
                          return (
                            <button key={rail} type="button" onClick={() => handleDestRailChange(rail)}
                              className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-all ${selected ? 'border-sky-500 bg-sky-500/10' : 'border-zinc-700 hover:border-zinc-600 bg-zinc-800/50'}`}>
                              <span className="text-xl">{info.flag}</span>
                              <div>
                                <div className="text-xs font-bold text-zinc-200">{info.name}</div>
                                <div className="text-[10px] text-zinc-500">{info.country} - {info.currency}</div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1">Alias Beneficiario <span className="text-zinc-600">({destRail})</span></label>
                        <input {...intlForm.register('creditorAlias')} className={`${inp} font-mono`} />
                        <p className="text-[10px] text-zinc-500 mt-0.5">{destRail === 'PIX' ? 'PIX-{llave PIX}' : 'BREB-{+57...}'}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1">Nombre Beneficiario</label>
                        <input {...intlForm.register('creditorName')} className={inp} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1">Monto (MXN)</label>
                        <input type="number" step="0.01" {...intlForm.register('amount')} className={inp} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1">Referencia</label>
                        <input {...intlForm.register('reference')} placeholder="SPEI-INTL-001" className={inp} />
                      </div>
                    </div>
                    <button type="submit" disabled={intlStatus === 'loading' || intlStatus === 'polling'}
                      className="w-full mt-1 bg-sky-500 hover:bg-sky-600 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors text-sm shadow-lg shadow-sky-500/20">
                      {intlStatus === 'loading' && <><Loader2 className="w-4 h-4 animate-spin" />Enviando...</>}
                      {intlStatus === 'polling' && <><RefreshCw className="w-4 h-4 animate-spin" />Procesando...</>}
                      {(intlStatus === 'idle' || intlStatus === 'success' || intlStatus === 'error') && <><Globe className="w-4 h-4" />Enviar Pago Internacional</>}
                    </button>
                  </form>
                </>
              )}
            </div>

            <div className="space-y-4">
              {mode === 'local' && localStatus === 'idle' && (
                <div className="glass-card rounded-2xl p-10 flex flex-col items-center justify-center min-h-72">
                  <div className="w-14 h-14 bg-zinc-800/50 rounded-2xl flex items-center justify-center mb-4 border border-zinc-700/50"><Clock className="w-7 h-7 text-zinc-600" /></div>
                  <p className="text-sm text-zinc-500 text-center">Completa el formulario para simular una transferencia SPEI</p>
                </div>
              )}
              {mode === 'local' && localStatus === 'loading' && (
                <div className="glass-card rounded-2xl p-10 flex flex-col items-center justify-center min-h-72">
                  <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mb-4" />
                  <p className="text-sm text-zinc-400 font-medium">Simulando flujo bancario SPEI...</p>
                </div>
              )}
              {mode === 'local' && localStatus === 'success' && localResponse && (
                <div className="glass-card rounded-2xl overflow-hidden">
                  <div className="flex items-center gap-2 px-5 py-3.5 bg-emerald-500/10 border-b border-emerald-500/20">
                    <CheckCircle className="w-4 h-4 text-emerald-400" /><span className="text-sm font-semibold text-emerald-400">Transferencia Simulada</span>
                  </div>
                  <div className="p-5">
                    <div className="bg-zinc-900/50 rounded-xl p-4 font-mono text-xs overflow-auto max-h-80 text-zinc-400 border border-zinc-800"><pre>{JSON.stringify(localResponse, null, 2)}</pre></div>
                    <button onClick={resetLocal} className="w-full mt-3 py-2 text-sm text-zinc-400 border border-zinc-700 rounded-xl hover:bg-zinc-800/50 transition-colors">Nueva simulacion</button>
                  </div>
                </div>
              )}
              {mode === 'local' && localStatus === 'error' && (
                <div className="glass-card rounded-2xl overflow-hidden">
                  <div className="flex items-center gap-2 px-5 py-3.5 bg-red-500/10 border-b border-red-500/20">
                    <XCircle className="w-4 h-4 text-red-400" /><span className="text-sm font-semibold text-red-400">Error en simulacion</span>
                  </div>
                  <div className="p-5"><button onClick={resetLocal} className="w-full py-2 text-sm text-zinc-400 border border-zinc-700 rounded-xl hover:bg-zinc-800/50 transition-colors">Volver a intentar</button></div>
                </div>
              )}

              {mode === 'international' && intlStatus === 'idle' && (
                <div className="glass-card rounded-2xl p-10 flex flex-col items-center justify-center min-h-72">
                  <div className="w-14 h-14 bg-zinc-800/50 rounded-2xl flex items-center justify-center mb-4 border border-zinc-700/50"><Globe className="w-7 h-7 text-zinc-600" /></div>
                  <p className="text-sm text-zinc-500 text-center mb-4">Envia un pago desde SPEI hacia otro riel internacional</p>
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <span>🇲🇽 SPEI</span><ArrowRight className="w-3 h-3" /><span className="text-zinc-600">mipit-core</span><ArrowRight className="w-3 h-3" /><span>🇧🇷 PIX - 🇨🇴 BRE_B</span>
                  </div>
                </div>
              )}
              {mode === 'international' && intlStatus === 'loading' && !payment && (
                <div className="glass-card rounded-2xl p-10 flex flex-col items-center justify-center min-h-72">
                  <Loader2 className="w-10 h-10 text-sky-500 animate-spin mb-4" />
                  <p className="text-sm text-zinc-400 font-medium">Enviando al middleware...</p>
                </div>
              )}
              {mode === 'international' && intlStatus === 'error' && !payment && (
                <div className="glass-card rounded-2xl overflow-hidden">
                  <div className="flex items-center gap-2 px-5 py-3.5 bg-red-500/10 border-b border-red-500/20">
                    <XCircle className="w-4 h-4 text-red-400" /><span className="text-sm font-semibold text-red-400">Error al enviar pago</span>
                  </div>
                  <div className="p-5"><button onClick={resetIntl} className="w-full py-2 text-sm text-zinc-400 border border-zinc-700 rounded-xl hover:bg-zinc-800/50 transition-colors">Volver a intentar</button></div>
                </div>
              )}
              {mode === 'international' && payment && intlStatus !== 'idle' && (
                <div className="space-y-4">
                  <FlowDiagram dest={destRail} status={payment.status} />
                  <div className="glass-card rounded-2xl overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-zinc-700/50 flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-zinc-500">{payment.payment_id}</span><StatusBadge status={payment.status} />
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                          <span>🇲🇽 SPEI</span><ArrowRight className="w-3 h-3" />
                          <span>{RAIL_INFO[destRail].flag} {RAIL_INFO[destRail].name}</span>
                          <span className="ml-1 font-semibold text-zinc-300">{payment.amount?.toLocaleString('es-MX', { style: 'currency', currency: payment.currency || 'MXN' })}</span>
                        </div>
                      </div>
                      {intlStatus === 'polling' && <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin flex-shrink-0" />}
                      {intlStatus === 'success'  && <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />}
                      {intlStatus === 'error'    && <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />}
                    </div>
                    <div className="p-5">
                      <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-3">Pipeline de procesamiento</p>
                      <PaymentTimeline timestamps={payment.timestamps ?? {}} />
                    </div>
                    {payment.trace_id && <div className="px-5 pb-4"><p className="text-[10px] font-mono text-zinc-600">trace_id: {payment.trace_id}</p></div>}
                  </div>
                  {(intlStatus === 'success' || intlStatus === 'error') && (
                    <button onClick={resetIntl} className="w-full py-2 text-sm text-zinc-400 glass-card rounded-xl hover:bg-zinc-800/50 transition-colors">Nuevo pago internacional</button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
