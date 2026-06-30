'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Avatar } from '@/components/common/Avatar';
import { Shield, Briefcase, ArrowLeft, Star } from 'lucide-react';
import { usersApi, type PublicProfile } from '@/lib/api';

export default function ProfessionalDetailPage() {
  const params  = useParams();
  const router  = useRouter();
  const userId  = Number(params?.id);

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!userId || isNaN(userId)) {
      setError('ID inválido');
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    usersApi
      .getPublic(userId)
      .then((p) => { if (!cancelled) setProfile(p); })
      .catch((err) => { if (!cancelled) setError(err?.message ?? 'Error al cargar el perfil'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId]);

  return (
    <MainLayout>
      <div className="space-y-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-800 text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>

        {loading && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card><CardContent className="pt-6 h-48 animate-pulse bg-gray-50 rounded-xl" /></Card>
            <div className="lg:col-span-2 space-y-4">
              <Card><CardContent className="h-32 animate-pulse bg-gray-50 rounded-xl" /></Card>
              <Card><CardContent className="h-48 animate-pulse bg-gray-50 rounded-xl" /></Card>
            </div>
          </div>
        )}

        {!loading && error && (
          <Card>
            <CardContent className="py-14 text-center text-gray-500">
              {error}
            </CardContent>
          </Card>
        )}

        {!loading && profile && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Columna izquierda */}
            <div className="space-y-4">
              <Card>
                <CardContent className="pt-6 text-center">
                  <Avatar
                    initials={profile.name.slice(0, 2).toUpperCase()}
                    size="xl"
                    className="mx-auto"
                  />
                  <h1 className="text-2xl font-bold text-gray-900 mt-4">
                    {profile.name}
                  </h1>
                  {profile.identity_verified && (
                    <Badge variant="success" className="mt-3">
                      <Shield className="w-3 h-3 mr-1" /> Identidad verificada
                    </Badge>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <h3 className="font-bold text-gray-900 flex items-center gap-2">
                    <Star className="w-4 h-4 text-yellow-500" /> Score Global
                  </h3>
                </CardHeader>
                <CardContent className="text-center">
                  <p className="text-5xl font-bold text-blue-600">
                    {Math.round(profile.performance_score)}
                  </p>
                  <p className="text-xs text-gray-400 mt-2">
                    Promedio ponderado de subáreas
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Columna derecha */}
            <div className="lg:col-span-2 space-y-4">
              {/* Scores por categoría */}
              {profile.category_scores.length > 0 && (
                <Card>
                  <CardHeader>
                    <h3 className="text-xl font-bold">Scores por Subárea</h3>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {profile.category_scores.map((cs) => (
                        <div
                          key={cs.category}
                          className="flex items-center gap-3"
                        >
                          <span className="text-sm font-medium text-gray-900 w-40 shrink-0 truncate">
                            {cs.category}
                          </span>
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all"
                              style={{ width: `${Math.min(cs.score, 100)}%` }}
                            />
                          </div>
                          <div className="text-right w-20 shrink-0">
                            <span className="font-bold text-gray-900">
                              {Math.round(cs.score)}
                            </span>
                            <span className="text-xs text-gray-400 ml-1">
                              ({cs.vote_count}v)
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Experiencia laboral */}
              <Card>
                <CardHeader>
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-gray-400" />
                    Experiencia Laboral
                  </h3>
                </CardHeader>
                <CardContent>
                  {profile.employments.length > 0 ? (
                    <div className="space-y-4">
                      {profile.employments.map((emp, i) => (
                        <div
                          key={i}
                          className="pb-4 border-b border-gray-100 last:border-0"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-bold text-gray-900 truncate">
                                {emp.role ?? 'Sin especificar'}
                              </p>
                              <p className="text-sm text-gray-600">
                                {emp.company_name}
                              </p>
                              <p className="text-xs text-gray-400 mt-1">
                                {emp.start_date
                                  ? new Date(emp.start_date).getFullYear()
                                  : '?'}{' '}
                                —{' '}
                                {emp.end_date
                                  ? new Date(emp.end_date).getFullYear()
                                  : 'Presente'}
                              </p>
                            </div>
                            <Badge
                              variant={
                                emp.verification_level >= 2
                                  ? 'success'
                                  : 'warning'
                              }
                            >
                              {emp.verification_level >= 2
                                ? '✓ Verificado'
                                : '⏳ Pendiente'}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm text-center py-6">
                      No hay experiencia laboral registrada.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}