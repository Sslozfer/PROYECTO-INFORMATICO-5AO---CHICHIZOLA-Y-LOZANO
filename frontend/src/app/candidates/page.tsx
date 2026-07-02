'use client';

import React, { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { RoleGuard } from '@/components/common/RoleGuard';
import { Card, CardContent } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Avatar } from '@/components/common/Avatar';
import { Input } from '@/components/common/Input';
import { Search } from 'lucide-react';
import Link from 'next/link';
import { jobPostsApi, usersApi, type JobPost, type UserMatch, type PublicProfile } from '@/lib/api';

type CandidateRow = UserMatch & { profile?: PublicProfile };

export default function CandidatesPage() {
  const [posts, setPosts] = useState<JobPost[]>([]);
  const [postId, setPostId] = useState<number>(0);
  const [loadingPosts, setLoadingPosts] = useState(true);

  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    jobPostsApi.getMy()
      .then((p) => {
        setPosts(p);
        if (p.length > 0) setPostId(p[0].id);
      })
      .catch(() => setPosts([]))
      .finally(() => setLoadingPosts(false));
  }, []);

  useEffect(() => {
    if (!postId) { setCandidates([]); return; }
    setLoading(true);
    setError(null);
    jobPostsApi.getCandidates(postId)
      .then(async (matches) => {
        const withProfiles = await Promise.all(
          matches.map(async (m) => {
            try {
              const profile = await usersApi.getPublic(m.user_id);
              return { ...m, profile };
            } catch {
              return { ...m };
            }
          })
        );
        setCandidates(withProfiles);
      })
      .catch((err) => setError(err?.message ?? 'Error al buscar candidatos'))
      .finally(() => setLoading(false));
  }, [postId]);

  const q = query.trim().toLowerCase();
  const filtered = candidates.filter((c) =>
    q === '' || (c.profile?.name ?? '').toLowerCase().includes(q)
  );

  return (
    <RoleGuard allow={['company', 'admin']}>
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Búsqueda de Candidatos</h1>
          <p className="text-gray-600 mt-2">
            Encuentra los mejores candidatos para tu empresa, según compatibilidad con tus publicaciones
          </p>
        </div>

        {!loadingPosts && posts.length === 0 && (
          <p className="text-center text-gray-500 py-8">
            Todavía no tenés publicaciones activas.{' '}
            <Link href="/job-posts" className="text-blue-600 hover:underline">Crear una publicación</Link>
          </p>
        )}

        {posts.length > 0 && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Publicación</label>
              <select
                className="w-full max-w-sm rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={postId}
                onChange={(e) => setPostId(Number(e.target.value))}
              >
                {posts.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>

            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <Input
                  placeholder="Buscar por nombre..."
                  className="pl-10"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
            )}

            {loading && (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <Card key={i}><CardContent className="h-32 animate-pulse bg-gray-50 rounded-xl" /></Card>
                ))}
              </div>
            )}

            {!loading && filtered.length === 0 && !error && (
              <p className="text-center text-gray-500 py-8">No se encontraron candidatos compatibles para esta publicación.</p>
            )}

            <div className="space-y-4">
              {filtered.map((c) => (
                <Card key={c.user_id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-4">
                        <Avatar
                          alt={c.profile?.name ?? `Usuario #${c.user_id}`}
                          size="lg"
                          initials={(c.profile?.name ?? `U${c.user_id}`).slice(0, 2)}
                        />
                        <div>
                          <h3 className="text-xl font-bold text-gray-900">
                            {c.profile?.name ?? `Usuario #${c.user_id}`}
                          </h3>
                          <div className="flex items-center gap-2 mt-2">
                            {c.profile?.identity_verified && (
                              <Badge variant="success">✓ Verificado</Badge>
                            )}
                            {c.match.modality_match && <Badge variant="info">Modalidad OK</Badge>}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-blue-600">
                          {c.profile?.performance_score ?? '—'}
                        </p>
                        <p className="text-sm text-gray-600">score</p>
                        <p className="text-lg font-bold text-green-600 mt-2">
                          {c.match.compatibility_score}%
                        </p>
                        <p className="text-xs text-gray-600">compatibilidad</p>
                      </div>
                    </div>

                    {Object.keys(c.match.details).length > 0 && (
                      <div className="mb-4">
                        <p className="text-sm font-medium text-gray-700 mb-2">Scores por categoría</p>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(c.match.details).map(([cat, score]) => (
                            <Badge key={cat} variant="info">{cat}: {score}</Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <Link href={`/professionals/${c.user_id}`}>
                      <Button className="w-full">Ver Perfil</Button>
                    </Link>
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
