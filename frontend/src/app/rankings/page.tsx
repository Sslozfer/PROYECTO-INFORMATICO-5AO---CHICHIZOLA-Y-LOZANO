'use client';

import React, { useEffect, useRef, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Avatar } from '@/components/common/Avatar';
import { Input } from '@/components/common/Input';
import { Search, Trophy, Medal } from 'lucide-react';
import Link from 'next/link';
import { usersApi, companiesApi, categoriesApi, type RankingEntry, type Company, type JobType } from '@/lib/api';

type RankingTab = 'professionals' | 'companies';

function medalColor(i: number) {
  if (i === 0) return 'text-yellow-500';
  if (i === 1) return 'text-gray-400';
  if (i === 2) return 'text-amber-600';
  return 'text-gray-300';
}

export default function RankingsPage() {
  const [tab,        setTab]        = useState<RankingTab>('professionals');
  const [jobTypes,   setJobTypes]   = useState<JobType[]>([]);
  const [jobTypeId,  setJobTypeId]  = useState<number | ''>('');
  const [query,      setQuery]      = useState('');

  const [pros,       setPros]       = useState<RankingEntry[]>([]);
  const [companies,  setCompanies]  = useState<Company[]>([]);
  const [loading,    setLoading]    = useState(true);

  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    categoriesApi.getJobTypes(true).then(setJobTypes).catch(() => setJobTypes([]));
  }, []);

  useEffect(() => {
    if (controller.current) controller.current.abort();
    controller.current = new AbortController();
    setLoading(true);

    const fetches =
      tab === 'professionals'
        ? usersApi.getRanking(jobTypeId || undefined).then(setPros).catch(() => setPros([]))
        : companiesApi.getAll(jobTypeId || undefined).then(setCompanies).catch(() => setCompanies([]));

    fetches.finally(() => setLoading(false));
  }, [tab, jobTypeId]);

  const filteredPros = pros.filter(p =>
    p.name.toLowerCase().includes(query.toLowerCase()),
  );
  const filteredCos = companies.filter(c =>
    c.name.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Trophy className="w-8 h-8 text-yellow-500 shrink-0" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Rankings</h1>
            <p className="text-gray-600 mt-0.5">Top profesionales y empresas</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-gray-200">
          {(['professionals', 'companies'] as RankingTab[]).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setQuery(''); }}
              className={`px-4 py-2 font-medium text-sm transition-colors ${
                tab === t
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {t === 'professionals' ? 'Profesionales' : 'Empresas'}
            </button>
          ))}
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400 pointer-events-none" />
            <Input
              placeholder={tab === 'professionals' ? 'Filtrar por nombre...' : 'Filtrar empresas...'}
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
            <option value="">Score global</option>
            {jobTypes.map(jt => (
              <option key={jt.id} value={jt.id}>{jt.name}</option>
            ))}
          </select>
        </div>

        {/* Tabla */}
        <Card>
          <CardHeader>
            <h2 className="text-xl font-bold">
              {tab === 'professionals'
                ? `Top Profesionales${jobTypeId ? ` — ${jobTypes.find(j=>j.id===jobTypeId)?.name}` : ' — Global'}`
                : `Top Empresas${jobTypeId ? ` — ${jobTypes.find(j=>j.id===jobTypeId)?.name}` : ''}`}
            </h2>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="h-14 animate-pulse bg-gray-100 rounded-lg" />
                ))}
              </div>
            ) : tab === 'professionals' ? (
              filteredPros.length === 0 ? (
                <p className="text-center text-gray-400 py-8">
                  {pros.length === 0 ? 'Aún no hay datos de ranking.' : `Sin resultados para "${query}".`}
                </p>
              ) : (
                <div className="space-y-1">
                  {filteredPros.map((entry, i) => (
                    <Link href={`/professionals/${entry.id}`} key={entry.id}>
                      <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                        <div className="w-8 text-center shrink-0">
                          {i < 3 ? (
                            <Medal className={`w-6 h-6 mx-auto ${medalColor(i)}`} />
                          ) : (
                            <span className="text-sm font-bold text-gray-400">#{i + 1}</span>
                          )}
                        </div>
                        <Avatar initials={entry.name.slice(0, 2).toUpperCase()} size="md" />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 truncate">{entry.name}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-2xl font-bold text-blue-600">
                            {Math.round(entry.performance_score)}
                          </p>
                          <p className="text-xs text-gray-400">score</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )
            ) : (
              filteredCos.length === 0 ? (
                <p className="text-center text-gray-400 py-8">
                  {companies.length === 0 ? 'Aún no hay empresas registradas.' : `Sin resultados para "${query}".`}
                </p>
              ) : (
                <div className="space-y-1">
                  {filteredCos.map((co, i) => (
                    <Link href={`/companies/${co.id}`} key={co.id}>
                      <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                        <div className="w-8 text-center shrink-0">
                          {i < 3 ? (
                            <Medal className={`w-6 h-6 mx-auto ${medalColor(i)}`} />
                          ) : (
                            <span className="text-sm font-bold text-gray-400">#{i + 1}</span>
                          )}
                        </div>
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                          <span className="font-bold text-blue-600 text-sm">
                            {co.name.slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 truncate">{co.name}</p>
                          {co.job_types?.length > 0 && (
                            <div className="flex gap-1 mt-0.5 flex-wrap">
                              {co.job_types.slice(0, 2).map(jt => (
                                <Badge key={jt.id} variant="info">{jt.name}</Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-2xl font-bold text-blue-600">
                            {Math.round(co.company_score)}
                          </p>
                          <p className="text-xs text-gray-400">score</p>
                          {co.verified && <Badge variant="success">✓</Badge>}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
