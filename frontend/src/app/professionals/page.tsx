'use client';

import React, { useEffect, useRef, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Avatar } from '@/components/common/Avatar';
import { Input } from '@/components/common/Input';
import { Search } from 'lucide-react';
import Link from 'next/link';
import { usersApi, categoriesApi, type RankingEntry, type JobType, type Category } from '@/lib/api';

export default function ProfessionalsPage() {
  const [pros,       setPros]       = useState<RankingEntry[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [query,      setQuery]      = useState('');
  const [jobTypes,   setJobTypes]   = useState<JobType[]>([]);
  const [jobTypeId,  setJobTypeId]  = useState<number | ''>('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<number | ''>('');

  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    categoriesApi.getJobTypes(true).then(setJobTypes).catch(() => setJobTypes([]));
  }, []);

  // Cargar categorías del rubro seleccionado
  useEffect(() => {
    setCategoryId('');
    setCategories([]);
    if (!jobTypeId) return;
    categoriesApi.getByJobType(Number(jobTypeId))
      .then(setCategories)
      .catch(() => setCategories([]));
  }, [jobTypeId]);

  useEffect(() => {
    if (controller.current) controller.current.abort();
    controller.current = new AbortController();
    setLoading(true);
    usersApi
      .getRanking(jobTypeId || undefined, categoryId || undefined)
      .then(setPros)
      .catch(err => { if (err?.name !== 'AbortError') setPros([]); })
      .finally(() => setLoading(false));
  }, [jobTypeId, categoryId]);

  const filtered = pros.filter(p =>
    p.name.toLowerCase().includes(query.toLowerCase()),
  );

  const selectedCat = categories.find(c => c.id === categoryId);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Profesionales</h1>
          <p className="text-gray-600 mt-1">Ranking de profesionales verificados</p>
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
          <div className="flex-1 min-w-48 relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400 pointer-events-none" />
            <Input
              placeholder="Buscar por nombre..."
              className="pl-10"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          <select
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-52"
            value={jobTypeId}
            onChange={e => setJobTypeId(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">Todos los rubros</option>
            {jobTypes.map(jt => <option key={jt.id} value={jt.id}>{jt.name}</option>)}
          </select>
          {categories.length > 0 && (
            <select
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-52"
              value={categoryId}
              onChange={e => setCategoryId(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">Todas las skills</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
        </div>

        {/* Pill de filtro activo */}
        {(jobTypeId || categoryId) && (
          <div className="flex gap-2 flex-wrap">
            {jobTypeId && (
              <Badge variant="info">
                Rubro: {jobTypes.find(j => j.id === jobTypeId)?.name}
              </Badge>
            )}
            {categoryId && selectedCat && (
              <Badge variant="info">
                Skill: {selectedCat.name}
              </Badge>
            )}
            <button
              onClick={() => { setJobTypeId(''); setCategoryId(''); setQuery(''); }}
              className="text-xs text-gray-400 hover:text-gray-700 underline"
            >
              Limpiar filtros
            </button>
          </div>
        )}

        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Card key={i}><CardContent className="pt-6 h-40 animate-pulse bg-gray-50 rounded-xl" /></Card>
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <p className="text-center text-gray-400 py-10">
            {pros.length === 0
              ? 'No hay profesionales con score en este filtro todavía.'
              : `Sin resultados para "${query}".`}
          </p>
        )}

        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((pro, idx) => (
              <Card key={pro.id}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="relative">
                      <Avatar
                        alt={pro.name}
                        initials={pro.name.slice(0, 2).toUpperCase()}
                        size="lg"
                      />
                      {idx < 3 && (
                        <span className="absolute -top-1 -left-1 w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold
                          bg-yellow-400 text-white">
                          {idx + 1}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-gray-900 truncate">{pro.name}</h3>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm text-gray-500">
                      {categoryId ? `Score en ${selectedCat?.name}` : jobTypeId ? 'Score en rubro' : 'Score Global'}
                    </span>
                    <span className="text-2xl font-bold text-blue-600">
                      {Math.round(pro.performance_score)}
                    </span>
                  </div>
                  <Link href={`/professionals/${pro.id}`}>
                    <Button variant="outline" className="w-full">Ver Perfil</Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
