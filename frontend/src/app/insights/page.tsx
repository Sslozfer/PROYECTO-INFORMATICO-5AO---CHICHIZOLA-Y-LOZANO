'use client';

import React from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader } from '@/components/common/Card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

const mockMarketInsights = [
  { skill: 'React', demand: 95, avgScore: 88, salaryRange: '50-65k€' },
  { skill: 'Python', demand: 92, avgScore: 85, salaryRange: '45-60k€' },
  { skill: 'TypeScript', demand: 88, avgScore: 86, salaryRange: '48-63k€' },
  { skill: 'AWS', demand: 85, avgScore: 82, salaryRange: '50-70k€' },
  { skill: 'Docker', demand: 78, avgScore: 81, salaryRange: '45-60k€' },
];

const mockDemandTrend = [
  { month: 'Ene', demand: 70 },
  { month: 'Feb', demand: 75 },
  { month: 'Mar', demand: 78 },
  { month: 'Abr', demand: 82 },
  { month: 'May', demand: 88 },
  { month: 'Jun', demand: 92 },
];

const mockSalaryTrend = [
  { month: 'Ene', junior: 35, mid: 50, senior: 70 },
  { month: 'Feb', junior: 36, mid: 51, senior: 72 },
  { month: 'Mar', junior: 37, mid: 52, senior: 74 },
  { month: 'Abr', junior: 38, mid: 54, senior: 76 },
  { month: 'May', junior: 40, mid: 56, senior: 78 },
  { month: 'Jun', junior: 42, mid: 58, senior: 80 },
];

export default function InsightsPage() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Insights del Mercado Laboral</h1>
          <p className="text-gray-600 mt-2">
            Tendencias y datos sobre demanda de talento en la plataforma
          </p>
        </div>

        <Card>
          <CardHeader>
            <h2 className="text-xl font-bold">Tendencia de Demanda</h2>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={mockDemandTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="demand" stroke="#3B82F6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-xl font-bold">Tendencia de Salarios (€)</h2>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={mockSalaryTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="junior" stroke="#10B981" name="Junior" />
                <Line type="monotone" dataKey="mid" stroke="#F59E0B" name="Mid-Level" />
                <Line type="monotone" dataKey="senior" stroke="#EF4444" name="Senior" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-xl font-bold">Skills Más Demandados</h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockMarketInsights.map((item) => (
                <div
                  key={item.skill}
                  className="pb-4 border-b border-gray-200 last:border-b-0"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-gray-900">{item.skill}</h3>
                    <span className="text-2xl font-bold text-blue-600">
                      {item.demand}%
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Score Promedio</p>
                      <p className="font-bold text-gray-900">{item.avgScore}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Salario Range</p>
                      <p className="font-bold text-gray-900">{item.salaryRange}</p>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${item.demand}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}