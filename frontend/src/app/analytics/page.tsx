'use client';

import React from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader } from '@/components/common/Card';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const mockPerformanceData = [
  { month: 'Ene', score: 75 },
  { month: 'Feb', score: 78 },
  { month: 'Mar', score: 82 },
  { month: 'Abr', score: 85 },
  { month: 'May', score: 88 },
  { month: 'Jun', score: 92 },
];

const mockSkillData = [
  { name: 'React', value: 95 },
  { name: 'TypeScript', value: 92 },
  { name: 'Node.js', value: 88 },
  { name: 'AWS', value: 82 },
];

const mockEvaluationDistribution = [
  { name: 'Excelente (80+)', value: 65 },
  { name: 'Bueno (60-79)', value: 25 },
  { name: 'Regular (40-59)', value: 8 },
  { name: 'Bajo (0-39)', value: 2 },
];

const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444'];

export default function AnalyticsPage() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics y Desempeño</h1>
          <p className="text-gray-600 mt-2">
            Analiza tu desempeño y estadísticas en la plataforma
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-600">Score Global</p>
              <p className="text-3xl font-bold text-blue-600 mt-2">92</p>
              <p className="text-xs text-green-600 mt-2">↑ +3 este mes</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-600">Evaluaciones</p>
              <p className="text-3xl font-bold text-green-600 mt-2">24</p>
              <p className="text-xs text-gray-600 mt-2">Recibidas</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-600">Habilidades</p>
              <p className="text-3xl font-bold text-purple-600 mt-2">12</p>
              <p className="text-xs text-gray-600 mt-2">Verificadas</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-600">Consistencia</p>
              <p className="text-3xl font-bold text-yellow-600 mt-2">89</p>
              <p className="text-xs text-gray-600 mt-2">Muy buena</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <h2 className="text-xl font-bold">Evolución de Score</h2>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={mockPerformanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#3B82F6"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-xl font-bold">Top Skills</h2>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={mockSkillData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <h2 className="text-xl font-bold">Distribución de Evaluaciones</h2>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={mockEvaluationDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {mockEvaluationDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}