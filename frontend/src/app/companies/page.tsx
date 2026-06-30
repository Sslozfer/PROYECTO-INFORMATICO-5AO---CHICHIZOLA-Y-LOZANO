'use client';

import React, { useEffect, useRef, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Search, Building2 } from 'lucide-react';
import Link from 'next/link';
import { companiesApi, categoriesApi, type Company, type JobType } from '@/lib/api';

export default function CompaniesPage() {
  const [companies,  setCompanies]  = useState<Company[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [query,      setQuery]      = useState('');
  const [jobTypes,   setJobTypes]   = useState<JobType[]>([]);
  const [jobTypeId,  setJobTypeId]  = useState<number | ''>('');
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    categoriesApi.getJobTypes(true)
      .then(setJobTypes)
      .catch(() => setJobTypes([]));
  }, []);

  useEffect(() => {
    if (controllerRef.current) controllerRef.current.abort();
    controllerRef.current = new AbortController();

    setLoading(true);
    companiesApi
      .getAll(jobTypeId || undefined)
      .then((data) => {
        setCompanies(data);
        setLoading(false);
      })
      .catch((err) => {
        if (err?.name !== 'AbortError') {
          setCompanies([]);
          setLoading(false);
        }
      });
  }, [jobTypeId]);

  const filtered = companies.filter((c) =>
    c.name.toLowerCase().includes(query.toLowerCase()) ||
    (c.domain ?? '').toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Empresas</h1>
          <p className="text-gray-600 mt-1">
            Descubre empresas y su reputación de talento
          </p>
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400 pointer-events-none" />
            <Input
              placeholder="Buscar por nombre o dominio..."
              className="pl-10"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-60"
            value={jobTypeId}
            onChange={(e) =>
              setJobTypeId(e.target.value ? Number(e.target.value) : '')
            }
          >
            <option value="">Todos los rubros</option>
            {jobTypes.map((jt) => (
              <option key={jt.id} value={jt.id}>
                {jt.name}
              </option>
            ))}
          </select>
        </div>

        {/* Skeleton */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-6 h-40 animate-pulse bg-gray-50 rounded-xl" />
              </Card>
            ))}
          </div>
        )}

        {/* Vacío */}
        {!loading && filtered.length === 0 && (
          <p className="text-center text-gray-500 py-10">
            {companies.length === 0
              ? 'No hay empresas en este rubro todavía.'
              : `No hay resultados para "${query}".`}
          </p>
        )}

        {/* Grid */}
        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((company) => (
              <Card key={company.id}>
                <CardContent className="pt-6">
                  {/* Cabecera */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 bg-blue-100 rounded-lg shrink-0">
                        <Building2 className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-gray-900 truncate">
                          {company.name}
                        </h3>
                        {company.domain && (
                          <p className="text-xs text-gray-500 truncate">
                            {company.domain}
                          </p>
                        )}
                      </div>
                    </div>
                    {company.verified && (
                      <Badge variant="success" className="shrink-0 ml-2">
                        ✓ Verificada
                      </Badge>
                    )}
                  </div>

                  {/* Rubros */}
                  {company.job_types && company.job_types.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {company.job_types.map((jt) => (
                        <Badge key={jt.id} variant="info">
                          {jt.name}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Scores */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div>
                      <p className="text-xs text-gray-500">Score</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {Math.round(company.company_score)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Reputación interna</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {Math.round(company.internal_reputation)}
                      </p>
                    </div>
                  </div>

                  <Link href={`/companies/${company.id}`}>
                    <Button variant="outline" className="w-full">
                      Ver Empresa
                    </Button>
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