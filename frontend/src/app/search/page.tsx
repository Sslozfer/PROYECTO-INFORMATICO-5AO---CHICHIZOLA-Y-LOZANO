'use client';

import React, { useEffect, useRef, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Avatar } from '@/components/common/Avatar';
import { Input } from '@/components/common/Input';
import { Search, Building2 } from 'lucide-react';
import Link from 'next/link';
import {
  usersApi, companiesApi, categoriesApi,
  type RankingEntry, type Company, type JobType,
} from '@/lib/api';

type Tab = 'all' | 'professionals' | 'companies';

export default function SearchPage() {
  const [query,      setQuery]      = useState('');
  const [activeTab,  setActiveTab]  = useState<Tab>('all');
  const [jobTypeId,  setJobTypeId]  = useState<number | ''>('');
  const [jobTypes,   setJobTypes]   = useState<JobType[]>([]);

  const [professionals, setProfessionals] = useState<RankingEntry[]>([]);
  const [companies,     setCompanies]     = useState<Company[]>([]);
  const [loading,       setLoading]       = useState(false);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controller  = useRef<AbortController | null>(null);

  // Cargar rubros para filtro
  useEffect(() => {
    categoriesApi.getJobTypes(true).then(setJobTypes).catch(() => setJobTypes([]));
  }, []);

  // Re-buscar cuando query o jobTypeId cambian (debounce 400ms)
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (controller.current)  controller.current.abort();
    controller.current = new AbortController();

    const q = query.trim();
    if (!q && jobTypeId === '') {
      setProfessionals([]);
      setCompanies([]);
      return;
    }

    searchTimer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const [proRes, coRes] = await Promise.all([
          usersApi.getRanking(jobTypeId || undefined).catch(() => [] as RankingEntry[]),
          companiesApi.getAll(jobTypeId || undefined).catch(() => [] as Company[]),
        ]);

        const qLow = q.toLowerCase();
        setProfessionals(
          q ? proRes.filter(p => p.name.toLowerCase().includes(qLow)) : proRes,
        );
        setCompanies(
          q ? coRes.filter(c =>
            c.name.toLowerCase().includes(qLow) ||
            (c.domain ?? '').toLowerCase().includes(qLow),
          ) : coRes,
        );
      } finally {
        setLoading(false);
      }
    }, 400);
  }, [query, jobTypeId]);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'all',           label: 'Todos' },
    { id: 'professionals', label: `Profesionales (${professionals.length})` },
    { id: 'companies',     label: `Empresas (${companies.length})` },
  ];

  const showPros = activeTab === 'all' || activeTab === 'professionals';
  const showCos  = activeTab === 'all' || activeTab === 'companies';

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Búsqueda Global</h1>
          <p className="text-gray-600 mt-1">
            Encuentra profesionales y empresas verificadas
          </p>
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400 pointer-events-none" />
            <Input
              placeholder="Buscar por nombre, empresa, skill..."
              className="pl-10"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-56"
            value={jobTypeId}
            onChange={(e) => setJobTypeId(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">Todos los rubros</option>
            {jobTypes.map(jt => (
              <option key={jt.id} value={jt.id}>{jt.name}</option>
            ))}
          </select>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-gray-200">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 font-medium text-sm transition-colors ${
                activeTab === t.id
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-6 h-32 animate-pulse bg-gray-50 rounded-xl" />
              </Card>
            ))}
          </div>
        )}

        {!loading && query === '' && jobTypeId === '' && (
          <p className="text-center text-gray-400 py-12">
            Escribe un nombre o selecciona un rubro para buscar.
          </p>
        )}

        {!loading && (query !== '' || jobTypeId !== '') && (
          <div className="space-y-8">
            {/* Profesionales */}
            {showPros && (
              <section>
                <h2 className="text-lg font-bold text-gray-800 mb-3">
                  Profesionales ({professionals.length})
                </h2>
                {professionals.length === 0 ? (
                  <p className="text-gray-400 text-sm">Sin resultados.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {professionals.map(pro => (
                      <Card key={pro.id}>
                        <CardContent className="pt-6">
                          <div className="flex items-center gap-3 mb-3">
                            <Avatar
                              initials={pro.name.slice(0, 2).toUpperCase()}
                              size="md"
                            />
                            <div className="min-w-0">
                              <p className="font-bold text-gray-900 truncate">{pro.name}</p>
                            </div>
                            <div className="ml-auto text-right shrink-0">
                              <p className="text-xl font-bold text-blue-600">
                                {Math.round(pro.performance_score)}
                              </p>
                              <p className="text-xs text-gray-400">score</p>
                            </div>
                          </div>
                          <Link href={`/professionals/${pro.id}`}>
                            <Button variant="outline" className="w-full">Ver Perfil</Button>
                          </Link>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Empresas */}
            {showCos && (
              <section>
                <h2 className="text-lg font-bold text-gray-800 mb-3">
                  Empresas ({companies.length})
                </h2>
                {companies.length === 0 ? (
                  <p className="text-gray-400 text-sm">Sin resultados.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {companies.map(co => (
                      <Card key={co.id}>
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <Building2 className="w-5 h-5 text-blue-500 shrink-0" />
                              <p className="font-bold text-gray-900 truncate">{co.name}</p>
                            </div>
                            {co.verified && (
                              <Badge variant="success" className="shrink-0 ml-2">✓</Badge>
                            )}
                          </div>
                          {co.job_types?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-3">
                              {co.job_types.map(jt => (
                                <Badge key={jt.id} variant="info">{jt.name}</Badge>
                              ))}
                            </div>
                          )}
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm text-gray-500">Score</span>
                            <span className="text-xl font-bold text-blue-600">
                              {Math.round(co.company_score)}
                            </span>
                          </div>
                          <Link href={`/companies/${co.id}`}>
                            <Button variant="outline" className="w-full">Ver Empresa</Button>
                          </Link>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
}