'use client';

import { RoleGuard } from '@/components/common/RoleGuard';
import React, { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Search } from 'lucide-react';
import {
  categoriesApi, matchingApi, jobsApi,
  type JobType, type JobMatch, type UserProfile,
} from '@/lib/api';

const MODALITY: Record<string, string> = { remote: 'Remoto', onsite: 'Presencial', hybrid: 'Híbrido' };

export default function JobsPage() {
  const [jobTypes, setJobTypes] = useState<JobType[]>([]);
  const [jobTypeId, setJobTypeId] = useState<number>(0);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [checkingProfile, setCheckingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    salary_min: '', salary_max: '', currency: 'USD',
    modality: 'remote' as 'remote' | 'onsite' | 'hybrid', location_label: '',
  });
  const [savingProfile, setSavingProfile] = useState(false);

  const [jobs, setJobs] = useState<JobMatch[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [applyingId, setApplyingId] = useState<number | null>(null);
  const [status, setStatus] = useState<Record<number, 'ok' | 'error' | undefined>>({});
  const [statusMsg, setStatusMsg] = useState<Record<number, string>>({});

  useEffect(() => {
    categoriesApi.getJobTypes(true).then(setJobTypes).catch(() => setJobTypes([]));
  }, []);

  useEffect(() => {
    if (!jobTypeId) { setProfile(null); setJobs([]); return; }
    setCheckingProfile(true);
    setError(null);
    matchingApi.getMyProfile(jobTypeId)
      .then((p) => setProfile(p))
      .catch(() => setProfile(null))
      .finally(() => setCheckingProfile(false));
  }, [jobTypeId]);

  useEffect(() => {
    if (!jobTypeId || !profile) return;
    loadJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobTypeId, profile]);

  const loadJobs = () => {
    setLoadingJobs(true);
    setError(null);
    matchingApi.getJobs(jobTypeId)
      .then(setJobs)
      .catch((err) => setError(err?.message ?? 'Error al buscar empleos'))
      .finally(() => setLoadingJobs(false));
  };

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setError(null);
    try {
      const saved = await matchingApi.upsertProfile({
        job_type_id: jobTypeId,
        salary_min: profileForm.salary_min ? Number(profileForm.salary_min) : undefined,
        salary_max: profileForm.salary_max ? Number(profileForm.salary_max) : undefined,
        currency: profileForm.currency,
        modality: profileForm.modality,
        location_label: profileForm.location_label || undefined,
      });
      setProfile(saved);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar tu perfil de búsqueda');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleApply = async (jobPostId: number) => {
    setApplyingId(jobPostId);
    setStatus((s) => ({ ...s, [jobPostId]: undefined }));
    try {
      await jobsApi.apply(jobPostId);
      setStatus((s) => ({ ...s, [jobPostId]: 'ok' }));
    } catch (err: unknown) {
      setStatus((s) => ({ ...s, [jobPostId]: 'error' }));
      setStatusMsg((s) => ({ ...s, [jobPostId]: err instanceof Error ? err.message : 'No se pudo enviar la solicitud' }));
    } finally {
      setApplyingId(null);
    }
  };

  const q = query.trim().toLowerCase();
  const filteredJobs = jobs.filter((j) => q === '' || j.title.toLowerCase().includes(q));

  return (
    <RoleGuard allow={['user', 'admin']}>
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Búsqueda de Empleos</h1>
          <p className="text-gray-600 mt-2">
            Encuentra oportunidades laborales que se adaptan a tu perfil
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Rubro</label>
          <select
            className="w-full max-w-sm rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={jobTypeId}
            onChange={(e) => setJobTypeId(Number(e.target.value))}
          >
            <option value={0}>Seleccioná un rubro para buscar...</option>
            {jobTypes.map((jt) => <option key={jt.id} value={jt.id}>{jt.name}</option>)}
          </select>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
        )}

        {!!jobTypeId && checkingProfile && (
          <p className="text-sm text-gray-500">Verificando tu perfil de búsqueda...</p>
        )}

        {!!jobTypeId && !checkingProfile && !profile && (
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-bold text-gray-900 mb-1">Configurá tu búsqueda para este rubro</h3>
              <p className="text-sm text-gray-500 mb-4">
                Necesitamos algunas preferencias para calcular tu compatibilidad con las publicaciones activas.
              </p>
              <form onSubmit={handleCreateProfile} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Salario mín. esperado</label>
                    <Input type="number" value={profileForm.salary_min}
                      onChange={(e) => setProfileForm((f) => ({ ...f, salary_min: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Salario máx. esperado</label>
                    <Input type="number" value={profileForm.salary_max}
                      onChange={(e) => setProfileForm((f) => ({ ...f, salary_max: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Modalidad</label>
                    <select
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={profileForm.modality}
                      onChange={(e) => setProfileForm((f) => ({ ...f, modality: e.target.value as 'remote' | 'onsite' | 'hybrid' }))}
                    >
                      <option value="remote">Remoto</option>
                      <option value="onsite">Presencial</option>
                      <option value="hybrid">Híbrido</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación</label>
                    <Input placeholder="Ej: Buenos Aires" value={profileForm.location_label}
                      onChange={(e) => setProfileForm((f) => ({ ...f, location_label: e.target.value }))} />
                  </div>
                </div>
                <Button type="submit" isLoading={savingProfile}>Guardar y buscar</Button>
              </form>
            </CardContent>
          </Card>
        )}

        {!!jobTypeId && profile && (
          <>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <Input
                  placeholder="Filtrar por título..."
                  className="pl-10"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>

            {loadingJobs && (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Card key={i}><CardContent className="h-32 animate-pulse bg-gray-50 rounded-xl" /></Card>
                ))}
              </div>
            )}

            {!loadingJobs && filteredJobs.length === 0 && (
              <p className="text-center text-gray-500 py-8">
                No hay publicaciones compatibles con tu perfil en este rubro por ahora.
              </p>
            )}

            <div className="space-y-4">
              {filteredJobs.map((job) => (
                <Card key={job.job_post_id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">{job.title}</h3>
                        <p className="text-gray-600">Empresa #{job.company_id}</p>
                        <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
                          {job.match.modality_match && <Badge variant="info">Modalidad compatible</Badge>}
                          {job.match.salary_match && <Badge variant="success">Salario compatible</Badge>}
                          {job.match.distance_km != null && <span>📍 {Math.round(job.match.distance_km)} km</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-blue-600">{job.match.compatibility_score}%</p>
                        <p className="text-xs text-gray-500">compatibilidad</p>
                      </div>
                    </div>

                    {Object.keys(job.match.details).length > 0 && (
                      <div className="mb-4">
                        <p className="text-sm font-medium text-gray-700 mb-2">Tus scores en este rubro</p>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(job.match.details).map(([cat, score]) => (
                            <Badge key={cat} variant="info">{cat}: {score}</Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {status[job.job_post_id] === 'ok' && (
                      <p className="text-sm text-green-600 mb-2">
                        ✓ Solicitud enviada. Podés verla en &quot;Mis Solicitudes&quot;.
                      </p>
                    )}
                    {status[job.job_post_id] === 'error' && (
                      <p className="text-sm text-red-600 mb-2">
                        {statusMsg[job.job_post_id] ?? 'No se pudo enviar la solicitud.'}
                      </p>
                    )}

                    <Button
                      className="w-full"
                      isLoading={applyingId === job.job_post_id}
                      onClick={() => handleApply(job.job_post_id)}
                    >
                      Aplicar
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </MainLayout>
    </RoleGuard>
  );
}
