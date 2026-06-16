'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Avatar } from '@/components/common/Avatar';
import { Badge } from '@/components/common/Badge';
import { useAuthStore } from '@/store/auth.store';
import {
  usersApi, companiesApi, employmentsApi, categoriesApi, matchingApi,
  type OwnProfile, type Company, type Category,
} from '@/lib/api';
import { Edit2, Shield, Briefcase, Star, X, Tag } from 'lucide-react';

export default function ProfilePage() {
  const { user } = useAuthStore();
  const role = user?.role ?? 'user';

  return (
    <MainLayout>
      {role === 'company' ? <CompanyProfile /> : <UserProfile />}
    </MainLayout>
  );
}

// ─── Perfil del profesional ──────────────────────────────────────────────────
function UserProfile() {
  const { user } = useAuthStore();

  const [profile,      setProfile]      = useState<OwnProfile | null>(null);
  const [allCats,      setAllCats]      = useState<Category[]>([]);
  const [mySkills,     setMySkills]     = useState<number[]>([]);
  const [savingSkills, setSavingSkills] = useState(false);
  const [skillsMsg,    setSkillsMsg]    = useState<string | null>(null);
  const [loading,      setLoading]      = useState(true);

  const [showModal,   setShowModal]   = useState(false);
  const [companies,   setCompanies]   = useState<Company[]>([]);
  const [form,        setForm]        = useState({ company_id: '', role: '', start_date: '', end_date: '' });
  const [submitting,  setSubmitting]  = useState(false);
  const [formError,   setFormError]   = useState<string | null>(null);

  const loadProfile = () => {
    setLoading(true);
    Promise.all([
      usersApi.getMe().catch(() => null),
      categoriesApi.getAll().catch(() => []),
      matchingApi.getMySkills().catch(() => []),
    ]).then(([p, cats, skills]) => {
      setProfile(p);
      setAllCats(cats);
      setMySkills(skills);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { loadProfile(); }, []);

  useEffect(() => {
    if (showModal && companies.length === 0) {
      companiesApi.getAll().then(setCompanies).catch(() => setCompanies([]));
    }
  }, [showModal, companies.length]);

  const toggleSkill = (id: number) =>
    setMySkills(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const saveSkills = async () => {
    setSavingSkills(true);
    setSkillsMsg(null);
    try {
      await matchingApi.setMySkills(mySkills);
      setSkillsMsg('Skills guardadas.');
    } catch {
      setSkillsMsg('No se pudo guardar.');
    } finally {
      setSavingSkills(false);
      setTimeout(() => setSkillsMsg(null), 3000);
    }
  };

  const handleAddEmployment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await employmentsApi.create({
        company_id: Number(form.company_id),
        role:       form.role || undefined,
        start_date: form.start_date || undefined,
        end_date:   form.end_date || undefined,
      });
      setShowModal(false);
      setForm({ company_id: '', role: '', start_date: '', end_date: '' });
      loadProfile();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Error al agregar experiencia');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-48 bg-gray-100 rounded animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <Card key={i}><CardContent className="h-40 animate-pulse bg-gray-50 rounded-xl" /></Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Mi Perfil</h1>
          <p className="text-gray-500 text-sm mt-1">Profesional</p>
        </div>
        <Link href="/settings">
          <Button variant="outline"><Edit2 className="w-4 h-4 mr-2" />Editar</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna izquierda */}
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <Avatar
                initials={(profile?.name ?? user?.name ?? 'U').slice(0, 2).toUpperCase()}
                size="xl"
                className="mx-auto"
              />
              <h2 className="text-xl font-bold text-gray-900 mt-3">
                {profile?.name ?? user?.name}
              </h2>
              <p className="text-gray-500 text-sm">{profile?.email ?? user?.email}</p>
              <div className="flex justify-center gap-2 mt-3 flex-wrap">
                {profile?.identity_verified && (
                  <Badge variant="success">
                    <Shield className="w-3 h-3 mr-1" />Verificado
                  </Badge>
                )}
                <Badge variant="info">Profesional</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-500" />Score Global
              </h3>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-5xl font-bold text-blue-600">
                {Math.round(profile?.performance_score ?? 0)}
              </p>
              <p className="text-xs text-gray-400 mt-2">Promedio ponderado de subáreas</p>
            </CardContent>
          </Card>
        </div>

        {/* Columna derecha */}
        <div className="lg:col-span-2 space-y-4">
          {/* Scores por subárea */}
          {profile && profile.category_scores.length > 0 && (
            <Card>
              <CardHeader><h3 className="text-lg font-bold">Scores por Subárea</h3></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {profile.category_scores.map(cs => (
                    <div key={cs.category} className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-800 w-36 shrink-0 truncate">
                        {cs.category}
                      </span>
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${Math.min(cs.score, 100)}%` }}
                        />
                      </div>
                      <span className="font-bold text-gray-900 w-10 text-right">
                        {Math.round(cs.score)}
                      </span>
                      <span className="text-xs text-gray-400 w-12">
                        ({cs.vote_count}v)
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Skills */}
          {allCats.length > 0 && (
            <Card>
              <CardHeader>
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Tag className="w-4 h-4 text-gray-400" />Mis Skills
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Seleccioná las subáreas en que te especializás. Aparecerás en los filtros de búsqueda.
                </p>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 mb-4">
                  {allCats.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => toggleSkill(cat.id)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                        mySkills.includes(cat.id)
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-gray-300 text-gray-600 hover:border-blue-400'
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <Button onClick={saveSkills} isLoading={savingSkills}>
                    Guardar Skills
                  </Button>
                  {skillsMsg && (
                    <span className="text-sm text-green-600">{skillsMsg}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Experiencia */}
          <Card>
            <CardHeader>
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-gray-400" />Experiencia Laboral
              </h3>
            </CardHeader>
            <CardContent>
              {profile && profile.employments.length > 0 ? (
                <div className="space-y-4 mb-4">
                  {profile.employments.map((emp, i) => (
                    <div key={i} className="pb-4 border-b border-gray-100 last:border-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-bold text-gray-900">{emp.role ?? 'Sin especificar'}</p>
                          <p className="text-sm text-gray-600">{emp.company_name}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {emp.start_date ? new Date(emp.start_date).getFullYear() : '?'} —{' '}
                            {emp.end_date ? new Date(emp.end_date).getFullYear() : 'Presente'}
                          </p>
                        </div>
                        <Badge variant={emp.verification_level >= 2 ? 'success' : 'warning'}>
                          {emp.verification_level >= 2 ? '✓ Verificado' : '⏳ Pendiente'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-sm text-center py-4 mb-4">
                  No hay experiencia laboral registrada.
                </p>
              )}
              <Button variant="outline" className="w-full" onClick={() => setShowModal(true)}>
                + Agregar Experiencia
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal agregar experiencia */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Agregar Experiencia Laboral</h2>
                <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-gray-100">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddEmployment} className="space-y-4">
                {formError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {formError}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Empresa</label>
                  <select
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.company_id}
                    onChange={e => setForm(f => ({ ...f, company_id: e.target.value }))}
                    required
                  >
                    <option value="">Seleccionar...</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Puesto</label>
                  <Input
                    placeholder="Ej: Senior Developer"
                    value={form.role}
                    onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Inicio</label>
                    <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fin (opcional)</label>
                    <Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
                  </div>
                </div>
                <Button type="submit" className="w-full" isLoading={submitting}>Guardar</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── Perfil de empresa ───────────────────────────────────────────────────────
function CompanyProfile() {
  const { user } = useAuthStore();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    companiesApi.getMyCompany()
      .then(setCompany)
      .catch(() => setCompany(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <Card><CardContent className="h-48 animate-pulse bg-gray-50 rounded-xl" /></Card>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {company?.name ?? user?.name ?? 'Mi Empresa'}
          </h1>
          <p className="text-gray-500 text-sm mt-1">Cuenta de Empresa</p>
        </div>
        <Link href="/settings">
          <Button variant="outline"><Edit2 className="w-4 h-4 mr-2" />Editar empresa</Button>
        </Link>
      </div>

      {company ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader><h3 className="font-bold text-gray-900">Información</h3></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {company.domain && (
                <p><span className="text-gray-500">Dominio:</span> <span className="font-medium">{company.domain}</span></p>
              )}
              {company.contact_email && (
                <p><span className="text-gray-500">Email:</span> <span className="font-medium">{company.contact_email}</span></p>
              )}
              <div className="flex items-center gap-2 mt-2">
                {company.verified
                  ? <Badge variant="success">✓ Dominio verificado</Badge>
                  : <Badge variant="warning">⏳ Verificación pendiente</Badge>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><h3 className="font-bold text-gray-900">Scores</h3></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { label: 'Score General',      value: company.company_score,       color: 'text-blue-600' },
                  { label: 'Reputación Interna', value: company.internal_reputation,  color: 'text-green-600' },
                  { label: 'Percepción Externa', value: company.external_perception,  color: 'text-purple-600' },
                ].map(s => (
                  <div key={s.label} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">{s.label}</span>
                    <span className={`text-2xl font-bold ${s.color}`}>{Math.round(s.value)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {company.job_types && company.job_types.length > 0 && (
            <Card className="md:col-span-2">
              <CardHeader><h3 className="font-bold text-gray-900">Rubros</h3></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {company.job_types.map(jt => (
                    <Badge key={jt.id} variant="info">{jt.name}</Badge>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-3">
                  Gestiona tus rubros en{' '}
                  <Link href="/settings" className="text-blue-600 hover:underline">Configuración</Link>.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-gray-500">
            No tenés una empresa asociada. Contactá al administrador.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
