'use client';

import React, { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { RoleGuard } from '@/components/common/RoleGuard';
import { Card, CardContent, CardHeader } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import {
  adminApi,
  type FraudByTypeEntry,
  type HighRiskUserEntry,
  type SuspiciousPairEntry,
  type FraudClustersResult,
  type LowReliabilityVoterEntry,
  type SourceBiasEntry,
  type BlockedUserEntry,
} from '@/lib/api';
import { AlertTriangle, ShieldAlert, Users2, Network, Gauge, Scale, Ban, RefreshCw } from 'lucide-react';

type Tab = 'overview' | 'high-risk' | 'pairs' | 'clusters' | 'reliability' | 'bias' | 'blocked';

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
