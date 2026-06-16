'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { useAuthStore } from '@/store/auth.store';
import { usersApi, jobsApi, jobPostsApi, hiringApi, type OwnProfile, type JobPost, type JobApplication } from '@/lib/api';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const role = user?.role ?? 'user';

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Bienvenido{user ? `, ${user.name}` : ''}
          </h1>
          <p className="text-gray-600 mt-1">
            {role === 'company'
              ? 'Resumen de tus publicaciones y candidatos'
              : 'Visión general de tu perfil y desempeño'}
          </p>
        </div>

        {role === 'company' ? <CompanyDashboard /> : <UserDashboard />}
      </div>
    </MainLayout>
  );
}

// ─── Dashboard para profesionales ────────────────────────────────────────────
function UserDashboard() {
  const [profile, setProfile] = useState<OwnProfile | null>(null);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      usersApi.getMe().catch(() => null),
      jobsApi.getMyApplications().catch(() => []),
    ]).then(([p, apps]) => {
      setProfile(p);
      setApplications(apps);
    }).finally(() => setLoading(false));
  }, []);

  const pendingApps = applications.filter(a => a.status === 'pending').length;
  const acceptedApps = applications.filter(a => a.status === 'accepted' || a.status === 'auto_accepted').length;

  const scoreCards = [
    { name: 'Score Global', value: profile ? Math.round(profile.performance_score) : 0, color: 'text-blue-600' },
    { name: 'Categorías Evaluadas', value: profile?.category_scores.length ?? 0, color: 'text-purple-600' },
    { name: 'Empleos Verificados', value: profile?.employments.length ?? 0, color: 'text-yellow-600' },
    { name: 'Solicitudes Pendientes', value: pendingApps, color: 'text-orange-600' },
    { name: 'Solicitudes Aceptadas', value: acceptedApps, color: 'text-green-600' },
    { name: 'Total Aplicaciones', value: applications.length, color: 'text-gray-700' },
  ];

  const chartData = profile?.category_scores.map(s => ({
    name: s.category,
    value: Math.round(s.score),
  })) ?? [];

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i}><CardContent className="pt-6 h-24 animate-pulse bg-gray-50 rounded-xl" /></Card>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {scoreCards.map((score) => (
          <Card key={score.name}>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-600">{score.name}</p>
              <p className={`text-3xl font-bold mt-2 ${score.color}`}>{score.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <h2 className="text-xl font-bold">Scores por Categoría</h2>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-xl font-bold">Historial de Score Global</h2>
              <p className="text-xs text-gray-400">Datos de ejemplo — todavía no se guarda historial real</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={[
                  { name: 'Ene', score: 65 },
                  { name: 'Feb', score: 72 },
                  { name: 'Mar', score: 78 },
                  { name: 'Abr', score: 82 },
                  { name: 'May', score: 85 },
                  { name: 'Jun', score: Math.round(profile?.performance_score ?? 88) },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="score" stroke="#3B82F6" strokeWidth={2} dot={{ fill: '#3B82F6' }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {profile && profile.employments.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="text-xl font-bold">Experiencia Verificada</h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {profile.employments.map((emp, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="font-medium text-gray-900">{emp.role}</p>
                    <p className="text-sm text-gray-500">{emp.company_name}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${emp.verification_level >= 2 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {emp.verification_level >= 2 ? '✓ Verificado' : '⏳ Pendiente'}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {applications.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Últimas Solicitudes</h2>
              <Link href="/applications" className="text-sm text-blue-600 hover:underline">Ver todas</Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {applications.slice(0, 5).map((app) => (
                <div key={app.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <p className="font-medium text-gray-900">Publicación #{app.job_post_id}</p>
                  <Badge variant={app.status === 'pending' ? 'warning' : (app.status.includes('accepted') ? 'success' : 'default')}>
                    {app.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}

// ─── Dashboard para empresas ─────────────────────────────────────────────────
function CompanyDashboard() {
  const [posts, setPosts] = useState<JobPost[]>([]);
  const [appsByPost, setAppsByPost] = useState<Record<number, JobApplication[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    jobPostsApi.getMy()
      .then(async (postsRes) => {
        setPosts(postsRes);
        const entries = await Promise.all(
          postsRes.map(async (p) => [p.id, await hiringApi.getApplicationsForPost(p.id).catch(() => [])] as const)
        );
        setAppsByPost(Object.fromEntries(entries));
      })
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, []);

  const allApps = Object.values(appsByPost).flat();
  const pending = allApps.filter(a => a.status === 'pending').length;
  const accepted = allApps.filter(a => a.status === 'accepted' || a.status === 'auto_accepted').length;
  const activePosts = posts.filter(p => p.is_active).length;

  const cards = [
    { name: 'Publicaciones Activas', value: activePosts, color: 'text-blue-600' },
    { name: 'Total Publicaciones', value: posts.length, color: 'text-gray-700' },
    { name: 'Candidatos Totales', value: allApps.length, color: 'text-purple-600' },
    { name: 'Pendientes de Revisión', value: pending, color: 'text-orange-600' },
    { name: 'Contratados/Aceptados', value: accepted, color: 'text-green-600' },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(5)].map((_, i) => (
          <Card key={i}><CardContent className="pt-6 h-24 animate-pulse bg-gray-50 rounded-xl" /></Card>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {cards.map((c) => (
          <Card key={c.name}>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-600">{c.name}</p>
              <p className={`text-3xl font-bold mt-2 ${c.color}`}>{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {posts.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-gray-500">
            Todavía no creaste publicaciones de búsqueda.{' '}
            <Link href="/job-posts" className="text-blue-600 hover:underline">Crear la primera</Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Tus Publicaciones</h2>
              <Link href="/job-posts" className="text-sm text-blue-600 hover:underline">Gestionar</Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {posts.map((post) => (
                <div key={post.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="font-medium text-gray-900">{post.title}</p>
                    <p className="text-sm text-gray-500">{post.location_label}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">{appsByPost[post.id]?.length ?? 0} candidatos</p>
                    <Badge variant={post.is_active ? 'success' : 'default'}>{post.is_active ? 'Activa' : 'Inactiva'}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
