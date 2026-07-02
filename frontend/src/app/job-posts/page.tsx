'use client';

import React, { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { RoleGuard } from '@/components/common/RoleGuard';
import { Card, CardContent, CardHeader } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Badge } from '@/components/common/Badge';
import { Plus, X, Users } from 'lucide-react';
import {
  jobPostsApi, hiringApi, categoriesApi,
  type JobPost, type JobApplication, type JobType, type CreateJobPostPayload,
} from '@/lib/api';

const statusLabels: Record<string, { label: string; variant: 'warning' | 'success' | 'danger' | 'default' }> = {
  pending:               { label: 'Pendiente',          variant: 'warning' },
  auto_accepted:         { label: 'Aceptada (auto)',    variant: 'success' },
  accepted:              { label: 'Aceptada',           variant: 'success' },
  rejected_by_candidate: { label: 'Rechazada por candidato', variant: 'default' },
  rejected_by_company:   { label: 'Rechazada',          variant: 'danger'  },
  withdrawn:             { label: 'Retirada',           variant: 'default' },
};

export default function JobPostsPage() {
  const [posts, setPosts] = useState<JobPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [jobTypes, setJobTypes] = useState<JobType[]>([]);

  const [showModal, setShowModal] = useState(false);
  const emptyForm: CreateJobPostPayload = {
    job_type_id: 0, title: '', description: '', salary_min: undefined, salary_max: undefined,
    currency: 'USD', modality: 'remote', location_label: '',
    hiring_mode: 'manual', auto_min_compatibility: undefined,
    auto_min_category_score: undefined, auto_max_distance_km: undefined,
    auto_require_identity: false, auto_offer_ttl_hours: 48,
  };
  const [form, setForm] = useState<CreateJobPostPayload>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [expandedPostId, setExpandedPostId] = useState<number | null>(null);
  const [applications, setApplications] = useState<Record<number, JobApplication[]>>({});
  const [loadingApps, setLoadingApps] = useState<number | null>(null);
  const [reviewingId, setReviewingId] = useState<number | null>(null);

  const loadPosts = () => {
    setLoading(true);
    jobPostsApi.getMy().then(setPosts).catch(() => setPosts([])).finally(() => setLoading(false));
  };

  useEffect(() => { loadPosts(); }, []);

  useEffect(() => {
    if (showModal && jobTypes.length === 0) {
      categoriesApi.getJobTypes(true).then(setJobTypes).catch(() => setJobTypes([]));
    }
  }, [showModal, jobTypes.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await jobPostsApi.create({
        ...form,
        job_type_id: Number(form.job_type_id),
        salary_min: form.salary_min ? Number(form.salary_min) : undefined,
        salary_max: form.salary_max ? Number(form.salary_max) : undefined,
      });
      setShowModal(false);
      setForm(emptyForm);
      loadPosts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al crear la publicación');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleApplications = async (postId: number) => {
    if (expandedPostId === postId) {
      setExpandedPostId(null);
      return;
    }
    setExpandedPostId(postId);
    if (!applications[postId]) {
      setLoadingApps(postId);
      try {
        const apps = await hiringApi.getApplicationsForPost(postId);
        setApplications((a) => ({ ...a, [postId]: apps }));
      } catch {
        setApplications((a) => ({ ...a, [postId]: [] }));
      } finally {
        setLoadingApps(null);
      }
    }
  };

  const handleReview = async (postId: number, appId: number, accept: boolean) => {
    setReviewingId(appId);
    try {
      await hiringApi.reviewApplication(appId, accept, accept ? undefined : 'No cumple con los requisitos');
      const apps = await hiringApi.getApplicationsForPost(postId);
      setApplications((a) => ({ ...a, [postId]: apps }));
    } catch {
      // noop
    } finally {
      setReviewingId(null);
    }
  };

  return (
    <RoleGuard allow={['company', 'admin']}>
      <MainLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Mis Publicaciones</h1>
              <p className="text-gray-600 mt-1">Gestiona tus búsquedas y los candidatos que aplican</p>
            </div>
            <Button onClick={() => setShowModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Nueva Publicación
            </Button>
          </div>

          {loading && (
            <div className="space-y-4">
              {[...Array(2)].map((_, i) => (
                <Card key={i}><CardContent className="pt-6 h-28 animate-pulse bg-gray-50 rounded-xl" /></Card>
              ))}
            </div>
          )}

          {!loading && posts.length === 0 && (
            <p className="text-center text-gray-500 py-8">
              Todavía no creaste ninguna publicación. Usá &quot;Nueva Publicación&quot; para empezar a recibir candidatos.
            </p>
          )}

          <div className="space-y-4">
            {posts.map((post) => (
              <Card key={post.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{post.title}</h3>
                      {post.location_label && <p className="text-sm text-gray-500">{post.location_label}</p>}
                    </div>
                    <Badge variant={post.is_active ? 'success' : 'default'}>
                      {post.is_active ? 'Activa' : 'Inactiva'}
                    </Badge>
                  </div>
                  {post.description && <p className="text-gray-700 text-sm mb-3">{post.description}</p>}
                  {(post.salary_min || post.salary_max) && (
                    <p className="text-sm text-gray-600 mb-3">
                      💰 {post.salary_min}–{post.salary_max} {post.currency}
                      {post.modality && <span className="ml-2">· {post.modality}</span>}
                    </p>
                  )}

                  <Button variant="outline" className="w-full" onClick={() => toggleApplications(post.id)}>
                    <Users className="w-4 h-4 mr-2" />
                    {expandedPostId === post.id ? 'Ocultar Candidatos' : 'Ver Candidatos'}
                  </Button>

                  {expandedPostId === post.id && (
                    <div className="mt-4 space-y-3">
                      {loadingApps === post.id && (
                        <p className="text-sm text-gray-500 text-center py-4">Cargando candidatos...</p>
                      )}
                      {loadingApps !== post.id && (applications[post.id]?.length ?? 0) === 0 && (
                        <p className="text-sm text-gray-500 text-center py-4">Todavía no hay candidatos para esta publicación.</p>
                      )}
                      {applications[post.id]?.map((app) => {
                        const status = statusLabels[app.status] ?? { label: app.status, variant: 'default' as const };
                        return (
                          <div key={app.id} className="p-3 bg-gray-50 rounded-lg flex items-center justify-between">
                            <div>
                              <p className="font-medium text-gray-900">Candidato #{app.user_id}</p>
                              <p className="text-xs text-gray-500">
                                Aplicó: {new Date(app.created_at).toLocaleDateString()}
                                {app.compatibility_score != null && ` · ${Math.round(app.compatibility_score)}% compatibilidad`}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={status.variant}>{status.label}</Badge>
                              {app.status === 'pending' && (
                                <>
                                  <Button
                                    variant="secondary"
                                    isLoading={reviewingId === app.id}
                                    onClick={() => handleReview(post.id, app.id, true)}
                                  >
                                    Aceptar
                                  </Button>
                                  <Button
                                    variant="danger"
                                    isLoading={reviewingId === app.id}
                                    onClick={() => handleReview(post.id, app.id, false)}
                                  >
                                    Rechazar
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <Card className="w-full max-w-md">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold">Nueva Publicación</h2>
                  <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-gray-100">
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rubro</label>
                    <select
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={form.job_type_id}
                      onChange={(e) => setForm(f => ({ ...f, job_type_id: Number(e.target.value) }))}
                      required
                    >
                      <option value={0}>Seleccionar...</option>
                      {jobTypes.map(jt => <option key={jt.id} value={jt.id}>{jt.name}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                    <Input
                      placeholder="Ej: Senior React Developer"
                      value={form.title}
                      onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                    <textarea
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                      value={form.description}
                      onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Salario mín.</label>
                      <Input type="number" value={form.salary_min ?? ''} onChange={(e) => setForm(f => ({ ...f, salary_min: e.target.value ? Number(e.target.value) : undefined }))} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Salario máx.</label>
                      <Input type="number" value={form.salary_max ?? ''} onChange={(e) => setForm(f => ({ ...f, salary_max: e.target.value ? Number(e.target.value) : undefined }))} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Modalidad</label>
                      <select
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={form.modality}
                        onChange={(e) => setForm(f => ({ ...f, modality: e.target.value as 'remote' | 'onsite' | 'hybrid' }))}
                      >
                        <option value="remote">Remoto</option>
                        <option value="onsite">Presencial</option>
                        <option value="hybrid">Híbrido</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación</label>
                      <Input
                        placeholder="Ej: Buenos Aires"
                        value={form.location_label}
                        onChange={(e) => setForm(f => ({ ...f, location_label: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="border-t border-gray-100 pt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Modo de contratación</label>
                    <select
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={form.hiring_mode}
                      onChange={(e) => setForm(f => ({ ...f, hiring_mode: e.target.value as 'manual' | 'semi_auto' | 'auto' }))}
                    >
                      <option value="manual">Manual (revisás cada aplicación)</option>
                      <option value="semi_auto">Semi-automático</option>
                      <option value="auto">Automático (se acepta solo si cumple condiciones)</option>
                    </select>
                  </div>

                  {form.hiring_mode !== 'manual' && (
                    <div className="space-y-3 bg-blue-50 p-3 rounded-lg">
                      <p className="text-xs text-blue-700">
                        Un candidato se acepta automáticamente si cumple todas las condiciones que definas. Tiene {form.auto_offer_ttl_hours ?? 48}hs para confirmar la oferta.
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Compatibilidad mín. (%)</label>
                          <Input type="number" min={0} max={100} value={form.auto_min_compatibility ?? ''}
                            onChange={(e) => setForm(f => ({ ...f, auto_min_compatibility: e.target.value ? Number(e.target.value) : undefined }))} />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Score mín. por categoría</label>
                          <Input type="number" min={0} max={100} value={form.auto_min_category_score ?? ''}
                            onChange={(e) => setForm(f => ({ ...f, auto_min_category_score: e.target.value ? Number(e.target.value) : undefined }))} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Distancia máx. (km)</label>
                          <Input type="number" min={0} value={form.auto_max_distance_km ?? ''}
                            onChange={(e) => setForm(f => ({ ...f, auto_max_distance_km: e.target.value ? Number(e.target.value) : undefined }))} />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Horas para responder oferta</label>
                          <Input type="number" min={1} value={form.auto_offer_ttl_hours ?? 48}
                            onChange={(e) => setForm(f => ({ ...f, auto_offer_ttl_hours: e.target.value ? Number(e.target.value) : undefined }))} />
                        </div>
                      </div>
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input type="checkbox" checked={!!form.auto_require_identity}
                          onChange={(e) => setForm(f => ({ ...f, auto_require_identity: e.target.checked }))} />
                        Requerir identidad verificada
                      </label>
                    </div>
                  )}

                  <Button type="submit" className="w-full" isLoading={submitting}>
                    Publicar
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </MainLayout>
    </RoleGuard>
  );
}