'use client';

import React, { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { RoleGuard } from '@/components/common/RoleGuard';
import { Card, CardContent } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Search } from 'lucide-react';
import { jobsApi } from '@/lib/api';

const mockJobs = [
  {
    id: '1',
    title: 'Senior React Developer',
    company: 'TechCorp',
    location: 'Madrid',
    salary: '45k - 55k€',
    skills: ['React', 'TypeScript', 'Node.js'],
    type: 'Full-time',
  },
  {
    id: '2',
    title: 'Data Scientist',
    company: 'InnovaLabs',
    location: 'Barcelona',
    salary: '40k - 50k€',
    skills: ['Python', 'Machine Learning', 'SQL'],
    type: 'Full-time',
  },
  {
    id: '3',
    title: 'DevOps Engineer',
    company: 'CloudWorks',
    location: 'Remote',
    salary: '35k - 45k€',
    skills: ['Docker', 'Kubernetes', 'AWS'],
    type: 'Full-time',
  },
];

export default function JobsPage() {
  const [query, setQuery] = useState('');
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, 'ok' | 'error' | undefined>>({});

  const q = query.trim().toLowerCase();
  const jobs = mockJobs.filter((job) =>
    q === '' ||
    job.title.toLowerCase().includes(q) ||
    job.company.toLowerCase().includes(q) ||
    job.location.toLowerCase().includes(q) ||
    job.skills.some((s) => s.toLowerCase().includes(q))
  );

  const handleApply = async (jobId: string) => {
    setApplyingId(jobId);
    setStatus((s) => ({ ...s, [jobId]: undefined }));
    try {
      await jobsApi.apply(Number(jobId));
      setStatus((s) => ({ ...s, [jobId]: 'ok' }));
    } catch {
      setStatus((s) => ({ ...s, [jobId]: 'error' }));
    } finally {
      setApplyingId(null);
    }
  };

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

        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <Input
              placeholder="Buscar por título, empresa, ubicación o skill..."
              className="pl-10"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        {jobs.length === 0 && (
          <p className="text-center text-gray-500 py-8">No se encontraron empleos para "{query}".</p>
        )}

        <div className="space-y-4">
          {jobs.map((job) => (
            <Card key={job.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{job.title}</h3>
                    <p className="text-gray-600">{job.company}</p>
                    <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
                      <span>📍 {job.location}</span>
                      <span>•</span>
                      <Badge variant="info">{job.type}</Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-blue-600">{job.salary}</p>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Skills Requeridos</p>
                  <div className="flex flex-wrap gap-2">
                    {job.skills.map((skill) => (
                      <Badge key={skill} variant="info">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>

                {status[job.id] === 'ok' && (
                  <p className="text-sm text-green-600 mb-2">
                    ✓ Solicitud enviada. Podés verla en "Mis Solicitudes".
                  </p>
                )}
                {status[job.id] === 'error' && (
                  <p className="text-sm text-red-600 mb-2">
                    No se pudo enviar la solicitud (revisá que estés logueado y que la publicación exista).
                  </p>
                )}

                <Button
                  className="w-full"
                  isLoading={applyingId === job.id}
                  onClick={() => handleApply(job.id)}
                >
                  Aplicar
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </MainLayout>
    </RoleGuard>
  );
}
