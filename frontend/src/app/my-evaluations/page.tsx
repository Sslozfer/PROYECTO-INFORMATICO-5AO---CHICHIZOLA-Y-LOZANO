'use client';

import React, { useEffect, useRef, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Badge } from '@/components/common/Badge';
import { ratingsApi, usersApi, type RatingEntry, type EvaluableResult, type UserLookup } from '@/lib/api';
import { X, Search, CheckCircle } from 'lucide-react';

const SRC_LABEL: Record<string, string> = {
  employer: 'Empleador/Jefe',
  peer:     'Par/Colega',
  client:   'Cliente',
};
type SourceType = 'employer' | 'peer' | 'client';

// Un ítem de evaluación en el modal
interface EvalItem { categoryId: number; score: number }

export default function MyEvaluationsPage() {
  const [activeTab, setActiveTab] = useState<'received' | 'given'>('received');
  const [received, setReceived]   = useState<RatingEntry[]>([]);
  const [given,    setGiven]      = useState<RatingEntry[]>([]);
  const [loading,  setLoading]    = useState(true);

  // Modal state
  const [showModal,   setShowModal]   = useState(false);
  const [queryStr,    setQueryStr]    = useState('');
  const [suggestions, setSuggestions] = useState<UserLookup[]>([]);
  const [loadingSug,  setLoadingSug]  = useState(false);
  const [targetUser,  setTargetUser]  = useState<UserLookup | null>(null);
  const [evaluable,   setEvaluable]   = useState<EvaluableResult | null>(null);
  const [loadingEval, setLoadingEval] = useState(false);
  const [sourceType,  setSourceType]  = useState<SourceType>('peer');
  const [items,       setItems]       = useState<EvalItem[]>([{ categoryId: 0, score: 80 }]);
  const [submitting,  setSubmitting]  = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successCount,setSuccessCount]= useState(0);

  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadEvaluations = () => {
    setLoading(true);
    Promise.all([
      ratingsApi.getReceived().catch(() => []),
      ratingsApi.getGiven().catch(() => []),
    ]).then(([r, g]) => { setReceived(r); setGiven(g); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadEvaluations(); }, []);

  // Lookup debounced
  useEffect(() => {
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    if (!queryStr.trim()) { setSuggestions([]); return; }

    lookupTimer.current = setTimeout(() => {
      setLoadingSug(true);
      usersApi.lookup(queryStr.trim())
        .then(setSuggestions)
        .catch(() => setSuggestions([]))
        .finally(() => setLoadingSug(false));
    }, 400);
  }, [queryStr]);

  // Cuando se elige usuario, cargar evaluable
  const selectUser = (u: UserLookup) => {
    setTargetUser(u);
    setSuggestions([]);
    setQueryStr(u.name);
    setEvaluable(null);
    setLoadingEval(true);
    ratingsApi.getEvaluable(u.id)
      .then(res => {
        setEvaluable(res);
        if (res.available_sources.length) setSourceType(res.available_sources[0]);
      })
      .catch(() => setEvaluable(null))
      .finally(() => setLoadingEval(false));
  };

  const weightKey = `${sourceType}_weight` as const;
  const availableCats = (evaluable?.categories ?? []).filter(
    c => (c as Record<string, unknown>)[weightKey] > 0,
  );

  const addItem = () => setItems(prev => [...prev, { categoryId: 0, score: 80 }]);
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));
  const updateItem = (idx: number, patch: Partial<EvalItem>) =>
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUser) return;
    const validItems = items.filter(it => it.categoryId > 0);
    if (!validItems.length) { setSubmitError('Seleccioná al menos una subárea.'); return; }

    setSubmitting(true);
    setSubmitError(null);
    let ok = 0;
    const errors: string[] = [];
    for (const it of validItems) {
      try {
        await ratingsApi.create({
          to_user_id:             targetUser.id,
          evaluation_category_id: it.categoryId,
          score:                  it.score,
          source_type:            sourceType,
        });
        ok++;
      } catch (err: unknown) {
        errors.push(err instanceof Error ? err.message : 'Error');
      }
    }
    setSuccessCount(ok);
    setSubmitting(false);
    if (ok > 0) loadEvaluations();
    if (errors.length) setSubmitError(errors.join(' | '));
  };

  const openModal = () => {
    setShowModal(true);
    setQueryStr(''); setSuggestions([]); setTargetUser(null); setEvaluable(null);
    setSourceType('peer'); setItems([{ categoryId: 0, score: 80 }]);
    setSubmitError(null); setSuccessCount(0);
  };

  const closeModal = () => { setShowModal(false); };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Mis Evaluaciones</h1>
          <p className="text-gray-600 mt-1">Evaluaciones recibidas y enviadas</p>
        </div>

        <div className="flex items-center justify-between border-b border-gray-200 pb-2">
          <div className="flex gap-0">
            {(['received', 'given'] as const).map(t => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`px-4 py-2 font-medium text-sm transition-colors ${
                  activeTab === t
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {t === 'received'
                  ? `Recibidas (${received.length})`
                  : `Dadas (${given.length})`}
              </button>
            ))}
          </div>
          <Button onClick={openModal}>+ Nueva Evaluación</Button>
        </div>

        {loading && (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Card key={i}><CardContent className="h-20 animate-pulse bg-gray-50 rounded-xl" /></Card>
            ))}
          </div>
        )}

        {!loading && activeTab === 'received' && (
          received.length === 0
            ? <p className="text-center text-gray-400 py-8">Todavía no recibiste evaluaciones.</p>
            : <div className="space-y-3">{received.map(ev => <EvalCard key={ev.id} ev={ev} mode="received" />)}</div>
        )}

        {!loading && activeTab === 'given' && (
          given.length === 0
            ? <p className="text-center text-gray-400 py-8">Todavía no diste evaluaciones.</p>
            : <div className="space-y-3">{given.map(ev => <EvalCard key={ev.id} ev={ev} mode="given" />)}</div>
        )}
      </div>

      {/* ─── Modal ─────────────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6 overflow-y-auto">
          <Card className="w-full max-w-lg my-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Nueva Evaluación</h2>
                <button onClick={closeModal} className="p-1 rounded-lg hover:bg-gray-100">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </CardHeader>
            <CardContent>
              {successCount > 0 && !submitError ? (
                <div className="py-8 text-center">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                  <p className="text-lg font-bold text-green-700">
                    {successCount} evaluación{successCount !== 1 ? 'es' : ''} enviada{successCount !== 1 ? 's' : ''}
                  </p>
                  <Button className="mt-4" onClick={closeModal}>Cerrar</Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  {submitError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                      {submitError}
                    </div>
                  )}

                  {/* Paso 1: buscar usuario */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Usuario a evaluar
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
                      <Input
                        className="pl-9"
                        placeholder="Nombre o ID..."
                        value={queryStr}
                        onChange={e => { setQueryStr(e.target.value); setTargetUser(null); setEvaluable(null); }}
                      />
                    </div>
                    {loadingSug && <p className="text-xs text-gray-400 mt-1">Buscando...</p>}
                    {suggestions.length > 0 && (
                      <ul className="mt-1 border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                        {suggestions.map(u => (
                          <li key={u.id}>
                            <button
                              type="button"
                              className="w-full px-3 py-2 text-left hover:bg-blue-50 flex items-center justify-between"
                              onClick={() => selectUser(u)}
                            >
                              <span className="font-medium text-gray-900">{u.name}</span>
                              <span className="text-xs text-gray-400">
                                #{u.id} · score {Math.round(u.performance_score)}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {targetUser && (
                      <div className="mt-2 p-2 bg-blue-50 rounded-lg flex items-center justify-between">
                        <div>
                          <p className="font-medium text-blue-900">{targetUser.name}</p>
                          <p className="text-xs text-blue-600">
                            #{targetUser.id}
                            {targetUser.identity_verified && ' · ✓ Verificado'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setTargetUser(null); setQueryStr(''); setEvaluable(null); }}
                          className="p-1 rounded hover:bg-blue-100"
                        >
                          <X className="w-4 h-4 text-blue-500" />
                        </button>
                      </div>
                    )}
                    {loadingEval && <p className="text-xs text-gray-400 mt-1">Consultando relación...</p>}
                    {evaluable && evaluable.shared_companies.length > 0 && (
                      <p className="text-xs text-green-600 mt-1">
                        ✓ Empresa en común: {evaluable.shared_companies.map(c => c.name).join(', ')}
                      </p>
                    )}
                  </div>

                  {/* Paso 2: relación */}
                  {evaluable && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tu relación
                      </label>
                      <div className="flex gap-2 flex-wrap">
                        {(['employer', 'peer', 'client'] as SourceType[]).map(s => {
                          const allowed = evaluable.available_sources.includes(s);
                          return (
                            <button
                              key={s}
                              type="button"
                              disabled={!allowed}
                              onClick={() => { setSourceType(s); setItems([{ categoryId: 0, score: 80 }]); }}
                              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                                sourceType === s && allowed
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : allowed
                                  ? 'border-gray-300 text-gray-700 hover:border-blue-400'
                                  : 'border-gray-200 text-gray-300 cursor-not-allowed line-through'
                              }`}
                            >
                              {SRC_LABEL[s]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Paso 3: subáreas (múltiples) */}
                  {evaluable && availableCats.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Subáreas a evaluar
                      </label>
                      <div className="space-y-3">
                        {items.map((item, idx) => (
                          <div key={idx} className="p-3 bg-gray-50 rounded-lg space-y-2">
                            <div className="flex items-center gap-2">
                              <select
                                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={item.categoryId}
                                onChange={e => updateItem(idx, { categoryId: Number(e.target.value) })}
                                required
                              >
                                <option value={0}>Seleccionar subárea...</option>
                                {availableCats.map(c => (
                                  <option
                                    key={c.id}
                                    value={c.id}
                                    disabled={items.some((it, i) => i !== idx && it.categoryId === c.id)}
                                  >
                                    {c.name}
                                  </option>
                                ))}
                              </select>
                              {items.length > 1 && (
                                <button type="button" onClick={() => removeItem(idx)}
                                  className="p-1 rounded hover:bg-red-100 text-red-500">
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                            {item.categoryId > 0 && (
                              <div>
                                <p className="text-xs text-gray-500 mb-1">
                                  Score: <strong className="text-blue-600">{item.score}</strong>
                                </p>
                                <input
                                  type="range" min="1" max="100"
                                  value={item.score}
                                  onChange={e => updateItem(idx, { score: Number(e.target.value) })}
                                  className="w-full accent-blue-600"
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      {items.length < availableCats.length && (
                        <button
                          type="button"
                          onClick={addItem}
                          className="mt-2 text-sm text-blue-600 hover:underline"
                        >
                          + Agregar otra subárea
                        </button>
                      )}
                    </div>
                  )}

                  {evaluable && availableCats.length === 0 && (
                    <p className="text-sm text-orange-500 p-3 bg-orange-50 rounded-lg">
                      No hay subáreas disponibles que puedas evaluar con la relación seleccionada.
                    </p>
                  )}

                  <Button
                    type="submit"
                    className="w-full"
                    isLoading={submitting}
                    disabled={!targetUser || items.every(it => it.categoryId === 0)}
                  >
                    Enviar {items.filter(it => it.categoryId > 0).length > 1
                      ? `${items.filter(it => it.categoryId > 0).length} evaluaciones`
                      : 'evaluación'}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </MainLayout>
  );
}

function EvalCard({ ev, mode }: { ev: RatingEntry; mode: 'received' | 'given' }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-bold text-gray-900 text-sm">
              {mode === 'received'
                ? <><span className="text-gray-500">{ev.from_name ?? 'Alguien'}</span>{' te evaluó en '}<span className="text-blue-600">{ev.category}</span></>
                : <>Evaluaste a <span className="text-blue-600">{ev.to_name ?? '?'}</span>{' en '}{ev.category}</>
              }
            </p>
            <div className="flex gap-2 mt-1 flex-wrap">
              <Badge variant="info">{SRC_LABEL[ev.source_type] ?? ev.source_type}</Badge>
              <span className="text-xs text-gray-400">
                {new Date(ev.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            </div>
          </div>
          <p className="text-3xl font-bold text-blue-600 shrink-0">{ev.score}</p>
        </div>
      </CardContent>
    </Card>
  );
}
