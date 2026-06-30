'use client';

import React, { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Badge } from '@/components/common/Badge';
import { useAuthStore } from '@/store/auth.store';
import { usersApi, companiesApi, categoriesApi, type Company, type JobType } from '@/lib/api';

type Msg = { type: 'ok' | 'error'; text: string };

function StatusMsg({ msg }: { msg: Msg | null }) {
  if (!msg) return null;
  return (
    <div className={`p-3 rounded-lg text-sm border ${
      msg.type === 'ok'
        ? 'bg-green-50 border-green-200 text-green-700'
        : 'bg-red-50 border-red-200 text-red-700'
    }`}>
      {msg.text}
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAuthStore();
  const role = user?.role ?? 'user';

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Configuración</h1>
          <p className="text-gray-600 mt-1">Gestiona tu cuenta y preferencias</p>
        </div>

        {role === 'company' ? <CompanySettings /> : <UserSettings />}
      </div>
    </MainLayout>
  );
}

// ─── Configuración de profesional ────────────────────────────────────────────
function UserSettings() {
  const { user } = useAuthStore();
  const [name,    setName]    = useState(user?.name ?? '');
  const [email,   setEmail]   = useState(user?.email ?? '');
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState<Msg | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setMsg(null);
    try {
      await usersApi.updateMe({ name, email });
      setMsg({ type: 'ok', text: 'Cambios guardados.' });
    } catch (err: unknown) {
      setMsg({ type: 'error', text: err instanceof Error ? err.message : 'No se pudo guardar.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader><h2 className="text-xl font-bold">Información Personal</h2></CardHeader>
      <CardContent className="space-y-4">
        <StatusMsg msg={msg} />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <Button onClick={handleSave} isLoading={saving}>Guardar Cambios</Button>
      </CardContent>
    </Card>
  );
}

// ─── Configuración de empresa ─────────────────────────────────────────────────
function CompanySettings() {
  const [company,      setCompany]      = useState<Company | null>(null);
  const [allJobTypes,  setAllJobTypes]  = useState<JobType[]>([]);
  const [selectedJTs,  setSelectedJTs]  = useState<number[]>([]);
  const [loading,      setLoading]      = useState(true);

  // Formulario info empresa
  const [name,        setName]        = useState('');
  const [domain,      setDomain]      = useState('');
  const [email,       setEmail]       = useState('');
  const [savingInfo,  setSavingInfo]  = useState(false);
  const [infoMsg,     setInfoMsg]     = useState<Msg | null>(null);

  // Formulario rubros
  const [savingJTs, setSavingJTs] = useState(false);
  const [jtsMsg,    setJtsMsg]    = useState<Msg | null>(null);

  useEffect(() => {
    Promise.all([
      companiesApi.getMyCompany().catch(() => null),
      categoriesApi.getJobTypes(true).catch(() => []),
    ]).then(([co, jts]) => {
      if (co) {
        setCompany(co);
        setName(co.name ?? '');
        setDomain(co.domain ?? '');
        setEmail(co.contact_email ?? '');
        setSelectedJTs((co.job_types ?? []).map((jt) => jt.id));
      }
      setAllJobTypes(jts);
    }).finally(() => setLoading(false));
  }, []);

  const toggleJT = (id: number) =>
    setSelectedJTs((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const handleSaveInfo = async () => {
    setSavingInfo(true);
    setInfoMsg(null);
    try {
      const updated = await companiesApi.updateMe({ name, domain, contact_email: email });
      setCompany(updated);
      setInfoMsg({ type: 'ok', text: 'Información actualizada.' });
    } catch (err: unknown) {
      setInfoMsg({ type: 'error', text: err instanceof Error ? err.message : 'Error al guardar.' });
    } finally {
      setSavingInfo(false);
    }
  };

  const handleSaveJTs = async () => {
    setSavingJTs(true);
    setJtsMsg(null);
    try {
      const updated = await companiesApi.setMyJobTypes(selectedJTs);
      setJtsMsg({ type: 'ok', text: `Rubros guardados: ${updated.map((j) => j.name).join(', ') || '(ninguno)'}` });
    } catch (err: unknown) {
      setJtsMsg({ type: 'error', text: err instanceof Error ? err.message : 'Error al guardar rubros.' });
    } finally {
      setSavingJTs(false);
    }
  };

  if (loading) {
    return <Card><CardContent className="h-48 animate-pulse bg-gray-50 rounded-xl" /></Card>;
  }

  if (!company) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-gray-500">
          No tenés una empresa asociada. Contactá al administrador.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Información de la empresa */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Información de la Empresa</h2>
            {company.verified && <Badge variant="success">✓ Dominio verificado</Badge>}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <StatusMsg msg={infoMsg} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dominio</label>
            <Input
              placeholder="Ej: techcorp.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">
              El dominio se verifica manualmente por el equipo de TrustScore.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email de contacto</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <Button onClick={handleSaveInfo} isLoading={savingInfo}>
            Guardar Información
          </Button>
        </CardContent>
      </Card>

      {/* Rubros */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-bold">Rubros en que Opera</h2>
          <p className="text-sm text-gray-500 mt-1">
            Los empleadores que filtrean por rubro verán tu empresa solo si tenés al menos uno activo.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <StatusMsg msg={jtsMsg} />
          <div className="flex flex-wrap gap-2">
            {allJobTypes.map((jt) => (
              <button
                key={jt.id}
                type="button"
                onClick={() => toggleJT(jt.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  selectedJTs.includes(jt.id)
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-300 text-gray-600 hover:border-blue-400'
                }`}
              >
                {jt.name}
              </button>
            ))}
          </div>
          {allJobTypes.length === 0 && (
            <p className="text-sm text-gray-400">No hay rubros disponibles todavía.</p>
          )}
          <Button onClick={handleSaveJTs} isLoading={savingJTs}>
            Guardar Rubros
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}