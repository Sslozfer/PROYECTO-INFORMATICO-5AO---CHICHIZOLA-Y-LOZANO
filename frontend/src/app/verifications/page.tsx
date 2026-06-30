'use client';

import React, { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { RoleGuard } from '@/components/common/RoleGuard';
import { Card, CardContent } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
import { employmentsApi, type Employment } from '@/lib/api';

export default function VerificationsPage() {
  const [pending,  setPending]  = useState<Employment[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [actingId, setActingId] = useState<number | null>(null);
  const [msg,      setMsg]      = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    employmentsApi.getPendingForCo()
      .then(setPending)
      .catch(() => setPending([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleVerify = async (id: number, confirm: boolean) => {
    setActingId(id);
    setMsg(null);
    try {
      await employmentsApi.verifyEmployment(id, confirm);
      setMsg(confirm ? '✓ Empleo verificado.' : '✗ Solicitud rechazada.');
      load();
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : 'Error al procesar');
    } finally {
      setActingId(null);
    }
  };

  return (
    <RoleGuard allow={['company', 'admin']}>
      <MainLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Verificaciones de Empleo</h1>
            <p className="text-gray-600 mt-1">Empleados que solicitan verificar que trabajan en tu empresa</p>
          </div>

          {msg && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm">{msg}</div>
          )}

          {loading && (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Card key={i}><CardContent className="h-20 animate-pulse bg-gray-50 rounded-xl" /></Card>
              ))}
            </div>
          )}

          {!loading && pending.length === 0 && (
            <Card>
              <CardContent className="py-14 text-center">
                <Clock className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No hay solicitudes pendientes.</p>
                <p className="text-gray-400 text-sm mt-1">
                  Cuando un empleado declare que trabaja en tu empresa aparecerá aquí.
                </p>
              </CardContent>
            </Card>
          )}

          {!loading && pending.map(emp => (
            <Card key={emp.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900">Usuario #{emp.user_id}</p>
                    {emp.role && <p className="text-sm text-gray-600 mt-0.5">Puesto: {emp.role}</p>}
                    <div className="flex gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                      {emp.start_date && <span>Desde: {new Date(emp.start_date).toLocaleDateString('es-AR')}</span>}
                      {emp.end_date && <span>Hasta: {new Date(emp.end_date).toLocaleDateString('es-AR')}</span>}
                    </div>
                    <Badge variant="warning" className="mt-2">Nivel {emp.verification_level} — sin confirmar</Badge>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button variant="secondary" isLoading={actingId === emp.id}
                      onClick={() => handleVerify(emp.id, true)}>
                      <CheckCircle className="w-4 h-4 mr-1" />Confirmar
                    </Button>
                    <Button variant="danger" isLoading={actingId === emp.id}
                      onClick={() => handleVerify(emp.id, false)}>
                      <XCircle className="w-4 h-4 mr-1" />Rechazar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </MainLayout>
    </RoleGuard>
  );
}