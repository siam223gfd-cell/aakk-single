import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Save, Truck } from 'lucide-react';
import { AdminLayout, PermissionGuard } from '../../../layouts/AdminLayout';
import { AdminPageHeader, ErrorBanner, LoadingCards } from '../../../components/admin/ui';
import { useAdminSettings } from './useAdminSettings';
import { useSeoMeta } from '../../../lib/useSeoMeta';

export function ShippingSettingsPage() {
  useSeoMeta({ title: 'Shipping Settings | NOVARA Admin', noIndex: true });
  const { config, loading, saving, error, load, savePatch } = useAdminSettings();

  const [dhakaMetroCharge, setDhakaMetroCharge] = useState('70');
  const [dhakaSuburbCharge, setDhakaSuburbCharge] = useState('100');
  const [nationwideCharge, setNationwideCharge] = useState('130');
  const [freeShippingThreshold, setFreeShippingThreshold] = useState('3500');
  const [expressSurcharge, setExpressSurcharge] = useState('60');

  useEffect(() => {
    const s = config?.shippingSettings;
    if (!s) return;
    setDhakaMetroCharge(String(s.dhakaMetroCharge ?? 70));
    setDhakaSuburbCharge(String(s.dhakaSuburbCharge ?? 100));
    setNationwideCharge(String(s.nationwideCharge ?? 130));
    setFreeShippingThreshold(String(s.freeShippingThreshold ?? 3500));
    setExpressSurcharge(String(s.expressSurcharge ?? 60));
  }, [config]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await savePatch(
      {
        shippingSettings: {
          dhakaMetroCharge: Number(dhakaMetroCharge || 0),
          dhakaSuburbCharge: Number(dhakaSuburbCharge || 0),
          nationwideCharge: Number(nationwideCharge || 0),
          freeShippingThreshold: Number(freeShippingThreshold || 0),
          expressSurcharge: Number(expressSurcharge || 0),
        },
      },
      'Shipping rates saved.',
    );
  };

  return (
    <AdminLayout>
      <PermissionGuard permission="settings.manage">
        <div className="space-y-5 max-w-[920px] mx-auto">
          <AdminPageHeader
            title="Shipping Settings"
            subtitle="Configure standard Bangladesh courier fee tiers, express surcharges, and free-shipping thresholds."
            breadcrumbs={[{ label: 'Payments & Shipping' }, { label: 'Shipping Settings' }]}
            actions={
              <Link
                to="/admin/shipping/zones"
                className="rounded-xl border border-[#E4EAF5] dark:border-slate-700 bg-white dark:bg-[#0B1730] px-3.5 py-2 text-xs font-semibold"
              >
                Manage Delivery Zones →
              </Link>
            }
          />

          {error && <ErrorBanner message={error} onRetry={load} />}
          {loading ? (
            <LoadingCards count={1} />
          ) : (
            <form
              onSubmit={handleSubmit}
              className="rounded-2xl border border-[#E4EAF5] dark:border-slate-800 bg-white dark:bg-[#0B1730] p-6 shadow-xs space-y-5"
            >
              <h2 className="font-display text-sm font-bold flex items-center gap-2">
                <Truck className="h-4 w-4 text-[#145CFF]" /> Bangladesh Delivery Fee Matrix
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold">Dhaka Metro Fee (৳)</label>
                  <input
                    type="number"
                    min={0}
                    value={dhakaMetroCharge}
                    onChange={(e) => setDhakaMetroCharge(e.target.value)}
                    className="w-full h-10 rounded-xl border border-[#E4EAF5] dark:border-slate-700 bg-[#F4F7FF] dark:bg-slate-900 px-3 font-mono-tabular text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold">Dhaka Suburb Fee (৳)</label>
                  <input
                    type="number"
                    min={0}
                    value={dhakaSuburbCharge}
                    onChange={(e) => setDhakaSuburbCharge(e.target.value)}
                    className="w-full h-10 rounded-xl border border-[#E4EAF5] dark:border-slate-700 bg-[#F4F7FF] dark:bg-slate-900 px-3 font-mono-tabular text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold">Nationwide Outside Dhaka (৳)</label>
                  <input
                    type="number"
                    min={0}
                    value={nationwideCharge}
                    onChange={(e) => setNationwideCharge(e.target.value)}
                    className="w-full h-10 rounded-xl border border-[#E4EAF5] dark:border-slate-700 bg-[#F4F7FF] dark:bg-slate-900 px-3 font-mono-tabular text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold">Free Shipping Above (৳)</label>
                  <input
                    type="number"
                    min={0}
                    value={freeShippingThreshold}
                    onChange={(e) => setFreeShippingThreshold(e.target.value)}
                    className="w-full h-10 rounded-xl border border-[#E4EAF5] dark:border-slate-700 bg-[#F4F7FF] dark:bg-slate-900 px-3 font-mono-tabular text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold">Same-Day / Express Surcharge (৳)</label>
                  <input
                    type="number"
                    min={0}
                    value={expressSurcharge}
                    onChange={(e) => setExpressSurcharge(e.target.value)}
                    className="w-full h-10 rounded-xl border border-[#E4EAF5] dark:border-slate-700 bg-[#F4F7FF] dark:bg-slate-900 px-3 font-mono-tabular text-xs"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#145CFF] px-6 py-2.5 text-xs font-semibold text-white hover:bg-[#0E47D9] disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'Saving...' : 'Save Shipping Rates'}
                </button>
              </div>
            </form>
          )}
        </div>
      </PermissionGuard>
    </AdminLayout>
  );
}
