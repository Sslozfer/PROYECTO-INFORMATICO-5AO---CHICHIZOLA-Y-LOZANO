'use client';

import React, { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { RoleGuard } from '@/components/common/RoleGuard';
import { Card, CardContent, CardHeader } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import {
  adminApi,
  categoriesApi,
  type FraudByTypeEntry,
  type HighRiskUserEntry,
  type SuspiciousPairEntry,
  type FraudClustersResult,
  type LowReliabilityVoterEntry,
  type SourceBiasEntry,
  type BlockedUserEntry,
  type JobType,
  type PendingCategory,
} from '@/lib/api';
import { AlertTriangle, ShieldAlert, Users2, Network, Gauge, Scale, Ban, RefreshCw, Layers } from 'lucide-react';

type Tab = 'overview' | 'high-risk' | 'pairs' | 'clusters' | 'reliability' | 'bias' | 'blocked' | 'categories';

export default function AdminPage() {
  return (
    <RoleGuard allow={['admin']}>
      <AdminDashboard />
    </RoleGuard>
  );
}

function AdminDashboard() {
  const [tab, setTab] = useState<Tab>('overview');

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Panel de Administración</h1>
          <p className="text-gray-600 mt-1">Monitoreo de fraude, confiabilidad y sesgo de fuente</p>
        </div>

        <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
          {([
            ['overview',    'Resumen',          AlertTriangle],
            ['high-risk',   'Alto riesgo',      ShieldAlert],
            ['pairs',       'Pares sospechosos',Users2],
            ['clusters',    'Clusters',         Network],
            ['reliability', 'Confiabilidad',    Gauge],
            ['bias',        'Sesgo de fuente',  Scale],
            ['blocked',     'Bloqueados',       Ban],
            ['categories',  'Rubros y Categorías', Layers],
          ] as [Tab, string, typeof AlertTriangle][]).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                tab === key
                  ? 'text-blue-600 border-blue-600'
                  : 'text-gray-500 border-transparent hover:text-gray-800'
              }`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        {tab === 'overview'    && <OverviewTab />}
        {tab === 'high-risk'   && <HighRiskTab />}
        {tab === 'pairs'       && <PairsTab />}
        {tab === 'clusters'    && <ClustersTab />}
        {tab === 'reliability' && <ReliabilityTab />}
        {tab === 'bias'        && <BiasTab />}
        {tab === 'blocked'     && <BlockedTab />}
        {tab === 'categories'  && <CategoriesTab />}
      </div>
    </MainLayout>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function Loading() {
  return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (
        <Card key={i}><CardContent className="h-16 animate-pulse bg-gray-50 rounded-xl" /></Card>
      ))}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-center text-gray-400 py-8">{text}</p>;
}

function severityBadge(severity: number) {
  if (severity >= 5) return <Badge variant="danger">{severity.toFixed(1)}</Badge>;
  if (severity >= 2) return <Badge variant="warning">{severity.toFixed(1)}</Badge>;
  return <Badge variant="default">{severity.toFixed(1)}</Badge>;
}

// ─── Resumen general (fraud by type) ──────────────────────────────────────

function OverviewTab() {
  const [data, setData]       = useState<FraudByTypeEntry[] | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    adminApi.getFraudByType().then(setData).catch(() => setData([])).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const labels: Record<string, string> = {
    anomaly:             'Anomalía (varianza/velocidad)',
    mutual_unknown:      'Votación recíproca (desconocidos)',
    mutual_peer_outlier: 'Votación recíproca (par outlier)',
    vote_ring:           'Círculo de votación',
    source_bias:         'Sesgo de fuente',
  };

  if (loading) return <Loading />;
  if (!data || data.length === 0) return <Empty text="No hay flags de fraude registrados todavía." />;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {data.map((row) => (
        <Card key={row.type}>
          <CardContent className="pt-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-bold text-gray-900">{labels[row.type] ?? row.type}</p>
                <p className="text-xs text-gray-400 mt-1">{row.total} flags detectados</p>
              </div>
              {severityBadge(Number(row.severity_sum))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Severidad promedio: {Number(row.severity_avg).toFixed(2)}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Usuarios de alto riesgo ───────────────────────────────────────────────

function HighRiskTab() {
  const [data, setData]       = useState<HighRiskUserEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [minRisk, setMinRisk] = useState(5);
  const [busyId, setBusyId]   = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    adminApi.getHighRiskUsers(minRisk).then(setData).catch(() => setData([])).finally(() => setLoading(false));
  };

  useEffect(load, [minRisk]);

  const unblock = async (id: number) => {
    setBusyId(id);
    try { await adminApi.unblockUser(id); load(); } finally { setBusyId(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-600">Riesgo mínimo</label>
        <input
          type="number" min={0} step={1} value={minRisk}
          onChange={(e) => setMinRisk(Number(e.target.value))}
          className="w-20 rounded-lg border border-gray-300 px-2 py-1 text-sm"
        />
        <Button size="sm" variant="outline" onClick={load}><RefreshCw className="w-3.5 h-3.5" /></Button>
      </div>

      {loading && <Loading />}
      {!loading && (!data || data.length === 0) && <Empty text="No hay usuarios por encima del umbral de riesgo." />}
      {!loading && data && data.length > 0 && (
        <div className="space-y-3">
          {data.map((u) => (
            <Card key={u.user_id}>
              <CardContent className="pt-5 flex items-center justify-between">
                <div>
                  <p className="font-bold text-gray-900">{u.name} <span className="text-gray-400 font-normal">#{u.user_id}</span></p>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="danger">fraud_score {Number(u.fraud_score).toFixed(1)}</Badge>
                    {u.is_blocked && <Badge variant="warning">Bloqueado</Badge>}
                  </div>
                </div>
                {u.is_blocked && (
                  <Button size="sm" variant="outline" isLoading={busyId === u.user_id} onClick={() => unblock(u.user_id)}>
                    Desbloquear
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Pares sospechosos ──────────────────────────────────────────────────────

function PairsTab() {
  const [data, setData]       = useState<SuspiciousPairEntry[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getSuspiciousPairs().then(setData).catch(() => setData([])).finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;
  if (!data || data.length === 0) return <Empty text="No hay pares con flags acumulados." />;

  return (
    <div className="space-y-3">
      {data.map((p, i) => (
        <Card key={i}>
          <CardContent className="pt-5 flex items-center justify-between">
            <p className="text-sm text-gray-700">
              Usuario <strong>#{p.user1}</strong> → Usuario <strong>#{p.user2}</strong>
              <span className="text-gray-400 ml-2">({p.flag_count} flags)</span>
            </p>
            {severityBadge(Number(p.severity_sum))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Clusters de fraude ─────────────────────────────────────────────────────

function ClustersTab() {
  const [data, setData]       = useState<FraudClustersResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getFraudClusters().then(setData).catch(() => setData({ count: 0, clusters: [] })).finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;
  if (!data || data.count === 0) return <Empty text="No se detectaron clusters de votación sospechosa." />;

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">{data.count} cluster(s) detectado(s)</p>
      {data.clusters.map((cluster, i) => (
        <Card key={i}>
          <CardHeader><p className="font-bold text-gray-900">Cluster #{i + 1} ({cluster.length} usuarios)</p></CardHeader>
          <CardContent className="pt-4 flex flex-wrap gap-2">
            {cluster.map((id) => <Badge key={id} variant="outline">#{id}</Badge>)}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Confiabilidad de votantes ──────────────────────────────────────────────

function ReliabilityTab() {
  const [data, setData]       = useState<LowReliabilityVoterEntry[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getLowReliabilityVoters(0.6).then(setData).catch(() => setData([])).finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;
  if (!data || data.length === 0) return <Empty text="No hay votantes con confiabilidad baja." />;

  return (
    <div className="space-y-3">
      {data.map((v) => (
        <Card key={v.user_id}>
          <CardContent className="pt-5 flex items-center justify-between">
            <div>
              <p className="font-bold text-gray-900">{v.name} <span className="text-gray-400 font-normal">#{v.user_id}</span></p>
              <p className="text-xs text-gray-400">{v.total_votes} votos emitidos</p>
            </div>
            <Badge variant="warning">reliability {Number(v.reliability).toFixed(2)}</Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Sesgo de fuente ─────────────────────────────────────────────────────────

function BiasTab() {
  const [data, setData]       = useState<SourceBiasEntry[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getSourceBiasReport(0.35).then(setData).catch(() => setData([])).finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;
  if (!data || data.length === 0) return <Empty text="No hay divergencias relevantes entre fuentes." />;

  return (
    <div className="space-y-3">
      {data.map((r, i) => (
        <Card key={i}>
          <CardContent className="pt-5">
            <p className="font-bold text-gray-900">Usuario #{r.user_id} · {r.category}</p>
            <div className="flex gap-3 mt-2 text-xs text-gray-500">
              <span>Empleador: {r.employer_avg ? Number(r.employer_avg).toFixed(1) : '—'}</span>
              <span>Par: {r.peer_avg ? Number(r.peer_avg).toFixed(1) : '—'}</span>
              <span>Cliente: {r.client_avg ? Number(r.client_avg).toFixed(1) : '—'}</span>
              <span className="text-gray-700 font-medium">Global: {Number(r.global_score).toFixed(1)}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Usuarios bloqueados ─────────────────────────────────────────────────────

function BlockedTab() {
  const [data, setData]       = useState<BlockedUserEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId]   = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    adminApi.getBlockedUsers().then(setData).catch(() => setData([])).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const unblock = async (id: number) => {
    setBusyId(id);
    try { await adminApi.unblockUser(id); load(); } finally { setBusyId(null); }
  };

  if (loading) return <Loading />;
  if (!data || data.length === 0) return <Empty text="No hay usuarios bloqueados." />;

  return (
    <div className="space-y-3">
      {data.map((u) => (
        <Card key={u.id}>
          <CardContent className="pt-5 flex items-center justify-between">
            <div>
              <p className="font-bold text-gray-900">{u.name}</p>
              <p className="text-xs text-gray-400">{u.email} · fraud_score {Number(u.fraud_score).toFixed(1)}</p>
            </div>
            <Button size="sm" variant="outline" isLoading={busyId === u.id} onClick={() => unblock(u.id)}>
              Desbloquear
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
// ─── Rubros y categorías ─────────────────────────────────────────────────────

function CategoriesTab() {
  const [jobTypes, setJobTypes]   = useState<JobType[]>([]);
  const [pending, setPending]     = useState<PendingCategory[]>([]);
  const [loading, setLoading]     = useState(true);
  const [busyId, setBusyId]       = useState<number | string | null>(null);
  const [error, setError]         = useState<string | null>(null);

  const [newJobType, setNewJobType] = useState({ name: '', description: '' });
  const [creatingJobType, setCreatingJobType] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      categoriesApi.getJobTypes(false),
      categoriesApi.getPending(),
    ])
      .then(([jt, p]) => { setJobTypes(jt); setPending(p); })
      .catch((err) => setError(err?.message ?? 'Error al cargar categorías'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreateJobType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJobType.name.trim()) return;
    setCreatingJobType(true);
    try {
      await categoriesApi.createJobType(newJobType);
      setNewJobType({ name: '', description: '' });
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al crear el rubro');
    } finally {
      setCreatingJobType(false);
    }
  };

  const handleActivate = async (id: number) => {
    setBusyId(id);
    try { await categoriesApi.activateJobType(id); load(); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error al activar'); }
    finally { setBusyId(null); }
  };

  const handleSuggest = async (jobTypeId: number) => {
    setBusyId(`suggest-${jobTypeId}`);
    try { await categoriesApi.suggestCategories(jobTypeId); load(); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error al sugerir categorías con IA'); }
    finally { setBusyId(null); }
  };

  const handleApprove = async (id: number) => {
    setBusyId(id);
    try { await categoriesApi.approve(id); load(); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error al aprobar'); }
    finally { setBusyId(null); }
  };

  const handleReject = async (id: number) => {
    setBusyId(id);
    try { await categoriesApi.reject(id); load(); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error al rechazar'); }
    finally { setBusyId(null); }
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-8">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      {/* Rubros */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-3">Rubros (job types)</h2>
        <Card className="mb-4">
          <CardContent className="pt-5">
            <form onSubmit={handleCreateJobType} className="flex flex-wrap gap-2 items-end">
              <div className="flex-1 min-w-[160px]">
                <label className="block text-xs font-medium text-gray-600 mb-1">Nombre</label>
                <input
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={newJobType.name}
                  onChange={(e) => setNewJobType((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ej: Desarrollo de Software"
                />
              </div>
              <div className="flex-1 min-w-[160px]">
                <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
                <input
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={newJobType.description}
                  onChange={(e) => setNewJobType((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Opcional"
                />
              </div>
              <Button type="submit" isLoading={creatingJobType}>Crear rubro</Button>
            </form>
          </CardContent>
        </Card>

        {jobTypes.length === 0 && <Empty text="No hay rubros creados todavía." />}
        <div className="space-y-2">
          {jobTypes.map((jt) => (
            <Card key={jt.id}>
              <CardContent className="pt-4 flex items-center justify-between">
                <div>
                  <p className="font-bold text-gray-900">
                    {jt.name} <Badge variant={jt.is_active ? 'success' : 'default'}>{jt.is_active ? 'Activo' : 'Inactivo'}</Badge>
                  </p>
                  {jt.description && <p className="text-xs text-gray-400">{jt.description}</p>}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm" variant="outline"
                    isLoading={busyId === `suggest-${jt.id}`}
                    onClick={() => handleSuggest(jt.id)}
                  >
                    Sugerir categorías (IA)
                  </Button>
                  {!jt.is_active && (
                    <Button size="sm" isLoading={busyId === jt.id} onClick={() => handleActivate(jt.id)}>
                      Activar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Categorías pendientes */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-3">Categorías pendientes de aprobación</h2>
        {pending.length === 0 && <Empty text="No hay categorías pendientes." />}
        <div className="space-y-2">
          {pending.map((c) => (
            <Card key={c.id}>
              <CardContent className="pt-4 flex items-center justify-between">
                <div>
                  <p className="font-bold text-gray-900">
                    {c.name} {c.suggested_by_ai && <Badge variant="info">Sugerida por IA</Badge>}
                  </p>
                  {c.description && <p className="text-xs text-gray-400">{c.description}</p>}
                  <p className="text-xs text-gray-400 mt-1">
                    Pesos: empleador {c.employer_weight} · par {c.peer_weight} · cliente {c.client_weight}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" isLoading={busyId === c.id} onClick={() => handleApprove(c.id)}>
                    Aprobar
                  </Button>
                  <Button size="sm" variant="danger" isLoading={busyId === c.id} onClick={() => handleReject(c.id)}>
                    Rechazar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
