'use client';

import React, { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { RoleGuard } from '@/components/common/RoleGuard';
import { Card, CardContent } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Avatar } from '@/components/common/Avatar';
import { Input } from '@/components/common/Input';
import { Search } from 'lucide-react';
import Link from 'next/link';

const mockCandidates = [
  {
    id: '1',
    name: 'María López',
    title: 'Senior Data Scientist',
    score: 94,
    skills: ['Python', 'Machine Learning', 'TensorFlow'],
    compatibility: 95,
    verified: true,
    email: 'maria@example.com',
  },
  {
    id: '2',
    name: 'Juan García',
    title: 'Full Stack Developer',
    score: 91,
    skills: ['React', 'Node.js', 'PostgreSQL'],
    compatibility: 88,
    verified: true,
    email: 'juan@example.com',
  },
  {
    id: '3',
    name: 'Carlos Rodríguez',
    title: 'DevOps Engineer',
    score: 87,
    skills: ['Docker', 'Kubernetes', 'AWS'],
    compatibility: 82,
    verified: false,
    email: 'carlos@example.com',
  },
];

export default function CandidatesPage() {
  const [query, setQuery] = useState('');
  const [contactId, setContactId] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const candidates = mockCandidates.filter((c) =>
    q === '' ||
    c.name.toLowerCase().includes(q) ||
    c.title.toLowerCase().includes(q) ||
    c.skills.some((s) => s.toLowerCase().includes(q))
  );

  return (
    <RoleGuard allow={['company', 'admin']}>
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Búsqueda de Candidatos</h1>
          <p className="text-gray-600 mt-2">
            Encuentra los mejores candidatos para tu empresa
          </p>
        </div>

        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <Input
              placeholder="Buscar por nombre, título o skill..."
              className="pl-10"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        {candidates.length === 0 && (
          <p className="text-center text-gray-500 py-8">No se encontraron candidatos para "{query}".</p>
        )}

        <div className="space-y-4">
          {candidates.map((candidate) => (
            <Card key={candidate.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-4">
                    <Avatar
                      alt={candidate.name}
                      size="lg"
                      initials={candidate.name.slice(0, 2)}
                    />
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">
                        {candidate.name}
                      </h3>
                      <p className="text-gray-600">{candidate.title}</p>
                      <div className="flex items-center gap-2 mt-2">
                        {candidate.verified && (
                          <Badge variant="success">✓ Verificado</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-blue-600">
                      {candidate.score}
                    </p>
                    <p className="text-sm text-gray-600">score</p>
                    <p className="text-lg font-bold text-green-600 mt-2">
                      {candidate.compatibility}%
                    </p>
                    <p className="text-xs text-gray-600">compatibilidad</p>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Habilidades</p>
                  <div className="flex flex-wrap gap-2">
                    {candidate.skills.map((skill) => (
                      <Badge key={skill} variant="info">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>

                {contactId === candidate.id && (
                  <p className="text-sm text-gray-600 mb-3 p-2 bg-gray-50 rounded-lg">
                    📧 Contacto: <a href={`mailto:${candidate.email}`} className="text-blue-600 hover:underline">{candidate.email}</a>
                  </p>
                )}

                <div className="flex gap-2">
                  <Link href={`/professionals/${candidate.id}`} className="flex-1">
                    <Button className="w-full">Ver Perfil</Button>
                  </Link>
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() => setContactId(contactId === candidate.id ? null : candidate.id)}
                  >
                    {contactId === candidate.id ? 'Ocultar Contacto' : 'Contactar'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </MainLayout>
    </RoleGuard>
  );
}
