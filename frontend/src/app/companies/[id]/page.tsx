'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Building2, Mail, Globe, ArrowLeft } from 'lucide-react';
import { companiesApi, type Company } from '@/lib/api';

export default function CompanyDetailPage() {
  const params  = useParams();
  const router  = useRouter();
  const id      = Number(params?.id);

  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!id || isNaN(id)) {
      setError('ID inválido');
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    companiesApi
      .getOne(id)
      .then((c) => { if (!cancelled) setCompany(c); })
      .catch((err) => { if (!cancelled) setError(err?.message ?? 'Error al cargar la empresa'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

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
          <Card>
            <CardContent className="pt-6 h-48 animate-pulse bg-gray-50 rounded-xl" />
          </Card>
        )}

        {!loading && error && (
          <Card>
            <CardContent className="py-14 text-center text-gray-500">
              {error}
            </CardContent>
          </Card>
        )}

        {!loading && company && (
          <>
            {/* Header */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-3 bg-blue-100 rounded-lg shrink-0">
                      <Building2 className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <h1 className="text-2xl font-bold text-gray-900">
                        {company.name}
                      </h1>
                      {company.domain && (
                        <p className="text-sm text-gray-500">{company.domain}</p>
                      )}
                    </div>
                  </div>
                  {company.verified && (
                    <Badge variant="success">✓ Verificada</Badge>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  {company.contact_email && (
                    <a
                      href={`mailto:${company.contact_email}`}
                      className="flex items-center gap-1 text-blue-600 hover:underline text-sm"
                    >
                      <Mail className="w-4 h-4" />
                      {company.contact_email}
                    </a>
                  )}
                  {company.domain && (
                    <a
                      href={`https://${company.domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-blue-600 hover:underline text-sm"
                    >
                      <Globe className="w-4 h-4" />
                      {company.domain}
                    </a>
                  )}
                </div>

                {/* Rubros */}
                {company.job_types && company.job_types.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      Rubros en que opera:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {company.job_types.map((jt) => (
                        <Badge key={jt.id} variant="info">
                          {jt.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Scores */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: 'Score General',         value: company.company_score,        color: 'text-blue-600' },
                { label: 'Reputación Interna',    value: company.internal_reputation,  color: 'text-green-600' },
                { label: 'Percepción Externa',    value: company.external_perception,  color: 'text-purple-600' },
              ].map((s) => (
                <Card key={s.label}>
                  <CardHeader>
                    <h3 className="text-sm font-bold text-gray-700">{s.label}</h3>
                  </CardHeader>
                  <CardContent>
                    <p className={`text-4xl font-bold text-center ${s.color}`}>
                      {Math.round(s.value)}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}
