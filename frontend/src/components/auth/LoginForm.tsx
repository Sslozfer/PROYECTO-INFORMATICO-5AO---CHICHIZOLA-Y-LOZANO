'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Trophy } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Card, CardContent, CardHeader } from '@/components/common/Card';
import { useAuthStore } from '@/store/auth.store';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const { login, isLoading } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginFormData) => {
    setError(null);
    try {
      await login(data.email, data.password);
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-white" />
          </div>
          <span className="text-2xl font-bold text-gray-900">TrustScore</span>
        </div>
        <h1 className="text-xl font-semibold text-gray-900">Iniciar sesión</h1>
        <p className="text-sm text-gray-500 mt-1">Reputación laboral verificable</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <Input
              type="email"
              placeholder="tu@email.com"
              error={errors.email?.message}
              {...register('email')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
            <Input
              type="password"
              placeholder="••••••••"
              error={errors.password?.message}
              {...register('password')}
            />
          </div>

          <Button type="submit" isLoading={isLoading} className="w-full" size="lg">
            Iniciar sesión
          </Button>

          <div className="text-center text-sm">
            <span className="text-gray-600">¿No tienes cuenta? </span>
            <Link href="/register" className="text-blue-600 hover:underline font-medium">
              Regístrate gratis
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}