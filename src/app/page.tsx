'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';

const speiFormSchema = z.object({
  debtorAlias: z.string().min(1, 'CLABE del ordenante requerida'),
  debtorName: z.string().optional(),
  creditorAlias: z.string().min(1, 'CLABE del beneficiario requerida'),
  creditorName: z.string().optional(),
  amount: z.coerce.number().positive('Monto debe ser mayor a 0'),
  currency: z.string().default('MXN'),
  purpose: z.string().optional().default('TRANSFERENCIA'),
  reference: z.string().optional(),
});

type SpeiFormValues = z.infer<typeof speiFormSchema>;

export default function SpeiSimulatorPage() {
  const [response, setResponse] = useState<any>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SpeiFormValues>({
    resolver: zodResolver(speiFormSchema),
    defaultValues: {
      debtorAlias: '012180000118359719',
      debtorName: 'Juan Pérez',
      creditorAlias: '002180012345678901',
      creditorName: 'María García',
      amount: 500.0,
      currency: 'MXN',
      purpose: 'TRANSFERENCIA',
      reference: 'SPEI-TEST-001',
    },
  });

  const onSubmit = async (data: SpeiFormValues) => {
    try {
      setStatus('loading');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      
      const response = await fetch(`${apiUrl}/api/simulate/spei`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const result = await response.json();
      setResponse(result);
      setStatus('success');
      toast.success('Transacción simulada exitosamente');
    } catch (err) {
      setStatus('error');
      toast.error('Error en la simulación', {
        description: err instanceof Error ? err.message : 'Error desconocido',
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <span className="text-4xl">🇲🇽</span>
            <h1 className="text-4xl font-bold text-gray-900">SPEI Simulator</h1>
          </div>
          <p className="text-gray-600">Simula transferencias SPEI en tiempo real</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">CLABE Ordenante</label>
                <input
                  type="text"
                  {...register('debtorAlias')}
                  placeholder="012180000118359719"
                  maxLength={18}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">18 dígitos</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nombre Ordenante</label>
                <input
                  type="text"
                  {...register('debtorName')}
                  placeholder="Juan Pérez"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">CLABE Beneficiario</label>
                <input
                  type="text"
                  {...register('creditorAlias')}
                  placeholder="002180012345678901"
                  maxLength={18}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nombre Beneficiario</label>
                <input
                  type="text"
                  {...register('creditorName')}
                  placeholder="María García"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Monto</label>
                  <input
                    type="number"
                    step="0.01"
                    {...register('amount')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Moneda</label>
                  <input
                    type="text"
                    {...register('currency')}
                    maxLength={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || status === 'loading'}
                className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {status === 'loading' && <Loader2 className="w-5 h-5 animate-spin" />}
                Simular Transferencia
              </button>
            </form>
          </div>

          <div>
            {status === 'idle' && (
              <div className="bg-white rounded-lg shadow-lg p-8 h-full flex items-center justify-center">
                <div className="text-center text-gray-400">
                  <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Completa el formulario y simula una transferencia</p>
                </div>
              </div>
            )}

            {status === 'loading' && (
              <div className="bg-white rounded-lg shadow-lg p-8 h-full flex items-center justify-center">
                <div className="text-center">
                  <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-green-600" />
                  <p className="text-gray-600">Procesando simulación...</p>
                </div>
              </div>
            )}

            {status === 'success' && response && (
              <div className="bg-white rounded-lg shadow-lg p-8">
                <div className="flex items-center gap-3 mb-6">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                  <h3 className="text-xl font-bold text-gray-900">Transferencia Simulada</h3>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm overflow-auto max-h-96">
                  <pre>{JSON.stringify(response, null, 2)}</pre>
                </div>
                <button
                  onClick={() => setStatus('idle')}
                  className="w-full mt-4 bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold py-2 rounded-lg transition-colors"
                >
                  Nueva Simulación
                </button>
              </div>
            )}

            {status === 'error' && (
              <div className="bg-white rounded-lg shadow-lg p-8">
                <div className="flex items-center gap-3 mb-6">
                  <XCircle className="w-8 h-8 text-red-600" />
                  <h3 className="text-xl font-bold text-gray-900">Error en Simulación</h3>
                </div>
                <button
                  onClick={() => setStatus('idle')}
                  className="w-full bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold py-2 rounded-lg transition-colors"
                >
                  Volver a intentar
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
