'use client';

import React from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const mockSkillRankings = [
  { skill: 'React', professionals: 234, avgScore: 88, demandLevel: 'Muy Alta' },
  { skill: 'TypeScript', professionals: 189, avgScore: 85, demandLevel: 'Muy Alta' },
  { skill: 'Python', professionals: 267, avgScore: 82, demandLevel: 'Alta' },
  { skill: 'Node.js', professionals: 156, avgScore: 83, demandLevel: 'Muy Alta' },
  { skill: 'AWS', professionals: 134, avgScore: 80, demandLevel: 'Alta' },
  { skill: 'Docker', professionals: 98, avgScore: 81, demandLevel: 'Alta' },
];

const mockChartData = [
  { skill: 'React', count: 234 },
  { skill: 'Python', count: 267 },
  { skill: 'TypeScript', count: 189 },
  { skill: 'Node.js', count: 156 },
  { skill: 'AWS', count: 134 },
];

export default function SkillRankingsPage() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Rankings por Skill</h1>
          <p className="text-gray-600 mt-2">
            Las habilidades más demandadas y mejor valoradas
          </p>
        </div>

        <Card>
          <CardHeader>
            <h2 className="text-xl font-bold">Profesionales por Skill</h2>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={mockChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="skill" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#F59E0B" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {mockSkillRankings.map((item) => (
            <Card key={item.skill}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">{item.skill}</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {item.professionals} profesionales con esta habilidad
                    </p>
                  </div>
                  <div className="flex items-center gap-6">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Demanda</p>
                      <Badge variant="danger">{item.demandLevel}</Badge>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Score Promedio</p>
                      <p className="text-2xl font-bold text-blue-600">{item.avgScore}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}