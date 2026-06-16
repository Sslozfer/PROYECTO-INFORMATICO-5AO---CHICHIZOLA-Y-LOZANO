'use client';

import React from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const mockCompanyRankings = [
  { rank: 1, name: 'TechCorp', quality: 92, employees: 245, verified: true },
  { rank: 2, name: 'InnovaLabs', quality: 89, employees: 89, verified: true },
  { rank: 3, name: 'DataSolutions', quality: 85, employees: 56, verified: true },
  { rank: 4, name: 'CloudWorks', quality: 82, employees: 120, verified: false },
  { rank: 5, name: 'DevFactory', quality: 79, employees: 340, verified: true },
];

const mockChartData = [
  { name: 'TechCorp', quality: 92 },
  { name: 'InnovaLabs', quality: 89 },
  { name: 'DataSolutions', quality: 85 },
  { name: 'CloudWorks', quality: 82 },
  { name: 'DevFactory', quality: 79 },
];

export default function CompanyRankingsPage() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Rankings de Empresas</h1>
          <p className="text-gray-600 mt-2">
            Las mejores empresas verificadas por calidad de talento
          </p>
        </div>

        <Card>
          <CardHeader>
            <h2 className="text-xl font-bold">Top 5 Empresas</h2>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={mockChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="quality" fill="#10B981" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {mockCompanyRankings.map((company) => (
            <Card key={company.rank}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-2xl font-bold text-green-600 w-12 text-center">
                      #{company.rank}
                    </div>
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <span className="text-xl font-bold text-blue-600">
                        {company.name.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{company.name}</h3>
                      <p className="text-sm text-gray-600">{company.employees} empleados</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {company.verified && <Badge variant="success">✓ Verificada</Badge>}
                    <div className="text-right">
                      <p className="text-2xl font-bold text-green-600">{company.quality}</p>
                      <p className="text-sm text-gray-600">calidad</p>
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