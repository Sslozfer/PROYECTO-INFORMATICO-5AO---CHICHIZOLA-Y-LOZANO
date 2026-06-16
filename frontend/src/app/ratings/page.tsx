'use client';

import React from 'react';
import Link from 'next/link';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';

const mockRatings = [
  {
    id: '1',
    evaluator: 'Juan García',
    professional: 'María López',
    skill: 'React',
    score: 95,
    context: 'boss',
    date: '2024-01-15',
  },
  {
    id: '2',
    evaluator: 'Carlos Rodríguez',
    professional: 'Juan García',
    skill: 'Node.js',
    score: 88,
    context: 'peer',
    date: '2024-01-10',
  },
];

const contextLabels = {
  boss: 'Jefe',
  peer: 'Par',
  client: 'Cliente',
};

export default function RatingsPage() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Evaluaciones</h1>
          <p className="text-gray-600 mt-2">
            Historial de evaluaciones en la plataforma
          </p>
        </div>

        <div className="space-y-4">
          {mockRatings.map((rating) => (
            <Card key={rating.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-gray-900">
                      {rating.evaluator} evaluó a {rating.professional}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">{rating.date}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-blue-600">
                      {rating.score}
                    </p>
                    <p className="text-sm text-gray-600">en {rating.skill}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="info">
                    {contextLabels[rating.context as keyof typeof contextLabels]}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Link href="/my-evaluations">
          <Button>Nueva Evaluación</Button>
        </Link>
      </div>
    </MainLayout>
  );
}