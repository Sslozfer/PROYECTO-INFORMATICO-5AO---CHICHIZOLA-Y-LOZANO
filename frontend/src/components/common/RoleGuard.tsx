'use client';

import React from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/common/Card';
import { useAuthStore } from '@/store/auth.store';
import { ShieldOff } from 'lucide-react';

interface RoleGuardProps {
  allow: string[];
  children: React.ReactNode;
}

/**
 * Muestra `children` solo si el rol del usuario logueado está en `allow`.
 * Si no, muestra un mensaje (sin redirigir) explicando que esa sección
 * no aplica a su tipo de cuenta.
 */
export function RoleGuard({ allow, children }: RoleGuardProps) {
  const { user } = useAuthStore();
  const role = user?.role ?? 'user';

  if (allow.includes(role)) {
    return <>{children}</>;
  }

  return (
    <MainLayout>
      <Card>
        <CardContent className="py-16 text-center">
          <ShieldOff className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-gray-900 mb-1">Sección no disponible</h2>
          <p className="text-gray-500">
            Esta sección no aplica para cuentas de tipo &quot;{role}&quot;.
          </p>
        </CardContent>
      </Card>
    </MainLayout>
  );
}