'use client';

import React, { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import Link from 'next/link';
import { jobsApi, type JobApplication } from '@/lib/api';

const STATUS: Record<string, { label: string; variant: 'warning' | 'success' | 'danger' | 'default' }> = {
  pending:               { label: 'Pendiente',              variant: 'warning' },
  auto_accepted:         { label: 'Aceptada automáticamente', variant: 'success' },
  accepted:              { label: 'Aceptada',               variant: 'success' },
  rejected_by_candidate: { label: 'Rechazada por vos',      variant: 'default' },
  rejected_by_company:   { label: 'Rechazada',              variant: 'danger' },
  withdrawn:             { label: 'Retirada',               variant: 'default' },
};

const MODALITY: Record<string, string> = {
  remote: 'Remoto', onsite: 'Presencial', hybrid: 'Híbrido',
};

export default function ApplicationsPage() {
  const [apps,         setApps]         = useState<JobApplication[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [expandedId,   setExpandedId]   = useState<number | null>(null);
  const [withdrawingId,setWithdrawingId]= useState<number | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    jobsApi.getMyApplications()
      .then(setApps)
      .catch((err) => setError(err?.message ?? 'Error al cargar solicitudes'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleWithdraw = async (id: number) => {
    if (!confirm('¿Seguro que querés retirar esta solicitud?')) return;
    setWithdrawingId(id);
    try {
      await jobsApi.withdraw(id);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al retirar');
    } finally {
      setWithdrawingId(null);
    }
  };

  const pending  = apps.filter(a => a.status === 'pending').length;
  const accepted = apps.filter(a => a.status === 'accepted' || a.status === 'auto_accepted').length;

  return (
    <MainLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Mis Solicitudes</h1>
            <p className="text-gray-600 mt-1">Historial de tus aplicaciones a empleos</p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
          )}

          {/* Resumen */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total',     value: apps.length,  color: 'text-blue-600' },
              { label: 'Pendientes',value: pending,       color: 'text-yellow-600' },
              { label: 'Aceptadas', value: accepted,      color: 'text-green-600' },
            ].map(c => (
              <Card key={c.label}>
                <CardContent className="pt-6">
                  <p className="text-sm text-gray-500">{c.label}</p>
                  <p className={`text-3xl font-bold mt-1 ${c.color}`}>{c.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Skeleton */}
          {loading && (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Card key={i}><CardContent className="h-24 animate-pulse bg-gray-50 rounded-xl" /></Card>
              ))}
            </div>
          )}

          {/* Vacío */}
          {!loading && apps.length === 0 && (
            <p className="text-center text-gray-500 py-8">
              No aplicaste a ninguna publicación todavía.{' '}
              <Link href="/jobs" className="text-blue-600 hover:underline">Ver empleos</Link>
            </p>
          )}

          {/* Lista */}
          {!loading && apps.length > 0 && (
            <div className="space-y-4">
              {apps.map(app => {
                const st = STATUS[app.status] ?? { label: app.status, variant: 'default' as const };
                const post = app.job_post;
                const expanded = expandedId === app.id;

                return (
                  <Card key={app.id}>
                    <CardContent className="pt-6">
                      {/* Cabecera */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-bold text-gray-900 text-lg truncate">
                            {post?.title ?? `Publicación #${app.job_post_id}`}
                          </h3>
                          {post && (
                            <p className="text-sm text-gray-500 mt-0.5">
                              {post.location_label && `📍 ${post.location_label}`}
                              {post.modality && ` · ${MODALITY[post.modality] ?? post.modality}`}
                              {(post.salary_min || post.salary_max) &&
                                ` · 💰 ${post.salary_min ?? '?'}–${post.salary_max ?? '?'} ${post.currency ?? ''}`}
                            </p>
                          )}
                          <p className="text-xs text-gray-400 mt-1">
                            Aplicado: {new Date(app.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <Badge variant={st.variant}>{st.label}</Badge>
                          {app.compatibility_score != null && (
                            <div className="mt-1">
                              <p className="text-lg font-bold text-blue-600">{Math.round(app.compatibility_score)}%</p>
                              <p className="text-xs text-gray-400">compatibilidad</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Detalles expandidos */}
                      {expanded && (
                        <div className="mt-4 p-3 bg-gray-50 rounded-lg space-y-2 text-sm">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="font-medium text-gray-600">Modo:</span>{' '}
                              <span className="text-gray-800 capitalize">{app.mode ?? '—'}</span>
                            </div>
                            {app.auto_offer_expires_at && (
                              <div>
                                <span className="font-medium text-gray-600">Oferta expira:</span>{' '}
                                <span className="text-gray-800">
                                  {new Date(app.auto_offer_expires_at).toLocaleString('es-AR')}
                                </span>
                              </div>
                            )}
                          </div>
                          {app.rejection_reason && (
                            <div className="p-2 bg-red-50 rounded border border-red-100 text-red-700">
                              <span className="font-medium">Motivo de rechazo:</span> {app.rejection_reason}
                            </div>
                          )}
                          {app.conditions_snapshot && Object.keys(app.conditions_snapshot).length > 0 && (
                            <div>
                              <span className="font-medium text-gray-600">Condiciones evaluadas:</span>
                              <ul className="mt-1 space-y-1">
                                {Object.entries(app.conditions_snapshot).map(([k, v]) => (
                                  <li key={k} className="text-gray-700">
                                    <span className="capitalize">{k.replace(/_/g, ' ')}:</span>{' '}
                                    {String(v)}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {post?.description && (
                            <div>
                              <span className="font-medium text-gray-600">Descripción del puesto:</span>
                              <p className="text-gray-700 mt-1">{post.description}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Acciones */}
                      <div className="flex gap-2 mt-4">
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => setExpandedId(expanded ? null : app.id)}
                        >
                          {expanded ? 'Ocultar detalles' : 'Ver detalles'}
                        </Button>
                        {app.status === 'pending' && (
                          <Button
                            variant="danger"
                            isLoading={withdrawingId === app.id}
                            onClick={() => handleWithdraw(app.id)}
                          >
                            Retirar
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </MainLayout>
  );
}