'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Card, CardContent, CardHeader } from '@/components/common/Card';
import { useAuthStore } from '@/store/auth.store';

type Role = 'user' | 'company';

export default function RegisterPage() {
  const router = useRouter();
  const { register: registerUser, isLoading } = useAuthStore();

  const [role,        setRole]        = useState<Role>('user');
  const [name,        setName]        = useState('');
  const [companyName, setCompanyName] = useState('');
  const [domain,      setDomain]      = useState('');
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [confirm,     setConfirm]     = useState('');
  const [error,       setError]       = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return; }
    if (password.length < 8)  { setError('La contraseña debe tener al menos 8 caracteres'); return; }
    setError(null);
    try {
      await registerUser(name, email, password, role, companyName || undefined, domain || undefined);
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al registrarse');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <h1 className="text-2xl font-bold text-gray-900">Crear cuenta</h1>
          <p className="text-sm text-gray-500 mt-1">Únete a TrustScore</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* Tipo de cuenta */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de cuenta
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['user', 'company'] as Role[]).map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`py-2 rounded-lg text-sm font-medium border transition-colors ${
                      role === r
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-gray-300 text-gray-700 hover:border-blue-400'
                    }`}
                  >
                    {r === 'user' ? '👤 Profesional' : '🏢 Empresa'}
                  </button>
                ))}
              </div>
            </div>

            {/* Nombre */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {role === 'company' ? 'Tu nombre (responsable)' : 'Nombre completo'}
              </label>
              <Input
                placeholder="Juan García"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </div>

            {/* Campos extra para empresa */}
            {role === 'company' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre de la empresa
                  </label>
                  <Input
                    placeholder="TechCorp S.A."
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dominio <span className="text-gray-400">(opcional)</span>
                  </label>
                  <Input
                    placeholder="techcorp.com"
                    value={domain}
                    onChange={e => setDomain(e.target.value)}
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <Input
                type="email"
                placeholder="correo@ejemplo.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
              <Input
                type="password"
                placeholder="Mínimo 8 caracteres"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar contraseña</label>
              <Input
                type="password"
                placeholder="Repetir contraseña"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full" isLoading={isLoading}>
              Crear cuenta
            </Button>

            <p className="text-center text-sm text-gray-500">
              ¿Ya tenés cuenta?{' '}
              <Link href="/login" className="text-blue-600 hover:underline font-medium">
                Iniciar sesión
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
