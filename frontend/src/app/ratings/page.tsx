'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { ratingsApi, type RatingEntry } from '@/lib/api';

const SRC_LABEL: Record<string, string> = {
  employer: 'Empleador/Jefe',
  peer:     'Par/Colega',
  client:   'Cliente',
};

export default function RatingsPage() {
  const [ratings, setRatings] = useState<RatingEntry[]>([]);
  const [loading,  setLoading] = useState(true);

  useEffect(() => {
    ratingsApi.getReceived()
      .catch(() => [])
      .then((r) => setRatings(r ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Evaluaciones</h1>
          <p className="text-gray-600 mt-2">
            Evaluaciones que recibiste en la plataforma
          </p>
        </div>

        {loading && (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Card key={i}><CardContent className="h-20 animate-pulse bg-gray-50 rounded-xl" /></Card>
            ))}
          </div>
        )}

        {!loading && ratings.length === 0 && (
          <p className="text-center text-gray-400 py-8">Todavía no recibiste evaluaciones.</p>
        )}

        {!loading && ratings.length > 0 && (
          <div className="space-y-4">
            {ratings.map((rating) => (
              <Card key={rating.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-gray-900">
                        {rating.is_anonymous ? 'Alguien' : (rating.from_name ?? 'Alguien')} te evaluó en {rating.category}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {new Date(rating.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-blue-600">{rating.score}</p>
                      <p className="text-sm text-gray-600">en {rating.category}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant="info">{SRC_LABEL[rating.source_type] ?? rating.source_type}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Link href="/my-evaluations">
          <Button>Nueva Evaluación</Button>
        </Link>
      </div>
    </MainLayout>
  );
}