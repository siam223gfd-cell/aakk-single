import { useEffect, useState, type FormEvent } from 'react';
import { CreditCard, Save } from 'lucide-react';
import { AdminLayout, PermissionGuard } from '../../../layouts/AdminLayout';
import { AdminPageHeader, ErrorBanner, LoadingCards, StatusBadge } from '../../../components/admin/ui';
import { useAdminSettings } from './useAdminSettings';
import { useSeoMeta } from '../../../lib/useSeoMeta';

export function PaymentMethodsPage() {
  useSeoMeta({ title: 'Payment Methods | NOVARA Admin', noIndex: true });
  const { config, integrations, loading, saving, error, load, savePatch } = useAdminSettings();

  const [codEnabled, setCodEnabled] = useState(true);
  const [sslcommerzEnabled, setSslcommerzEnabled] = useState(true);
  const [bkashEnabled, setBkashEnabled] = useState(true);
  const [cardEnabled, setCardEnabled] = useState(true);
  const [codMaxAmount, setCodMaxAmount] = useState('50000');
  const [codInstructions, setCodInstructions] = useState('');

  useEffect(() => {
    const p = config?.paymentMethods;
    if (!p) return;
    setCodEnabled(Boolean(p.codEnabled ?? true));
    setSslcommerzEnabled(Boolean(p.sslcommerzEnabled ?? true));
    setBkashEnabled(Boolean(p.bkashEnabled ?? true));
    setCardEnabled(Boolean(p.cardEnabled ?? true));
    setCodMaxAmount(String(p.codMaxAmount ?? 50000));
    setCodInstructions(p.codInstructions || '');
  }, [config]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await savePatch(
      {
        paymentMethods: {
          codEnabled,
          sslcommerzEnabled,
          bkashEnabled,
          cardEnabled,
          codMaxAmount: Number(codMaxAmount || 0),
          codInstructions,
        },
      },
      'Payment method controls updated.',
    );
  };

  return (
    <AdminLayout>
      <PermissionGuard permission="settings.manage">
        <div className="space-y-5 max-w-[920px] mx-auto">
          <AdminPageHeader
            title="Payment Methods"
            subtitle="Control checkout payment options, Cash on Delivery limits, and inspect live gateway integration status."
            breadcrumbs={[{ label: 'Payments & Shipping' }, { label: 'Payment Methods' }]}
          />

          {error && <ErrorBanner message={error} onRetry={load} />}
          {loading ? (
            <LoadingCards count={2} />
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="rounded-2xl border border-[#E4EAF5] dark:border-slate-800 bg-white dark:bg-[#0B1730] p-6 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-display text-sm font-bold flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-[#145CFF]" /> Checkout Payment Channels
                  </h2>
                  <StatusBadge
                    label={
                      (integrations.paymentGateway ?? integrations.sslcommerz)
                        ? 'SSLCommerz Configured'
                        : 'SSLCommerz Sandbox / Unconfigured'
                    }
                    tone={(integrations.paymentGateway ?? integrations.sslcommerz) ? 'emerald' : 'amber'}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { label: 'Cash on Delivery (COD)', val: codEnabled, set: setCodEnabled },
                    { label: 'SSLCommerz Gateway', val: sslcommerzEnabled, set: setSslcommerzEnabled },
                    { label: 'bKash Digital Wallet', val: bkashEnabled, set: setBkashEnabled },
                    { label: 'Visa / Mastercard / Cards', val: cardEnabled, set: setCardEnabled },
                  ].map((m) => (
                    <label
                      key={m.label}
                      className="flex items-center justify-between rounded-xl border border-[#E4EAF5] dark:border-slate-800 bg-[#F8FAFF] dark:bg-slate-900/50 p-3.5 text-xs font-semibold cursor-pointer"
                    >
                      <span>{m.label}</span>
                      <input
                        type="checkbox"
                        checked={m.val}
                        onChange={(e) => m.set(e.target.checked)}
                        className="h-4 w-4 rounded text-[#145CFF]"
                      />
                    </label>
                  ))}
                </div>

                <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-[#E4EAF5] dark:border-slate-800">
                  <div>
                    <label className="mb-1 block text-xs font-semibold">Maximum COD Order Limit (৳)</label>
                    <input
                      type="number"
                      min={0}
                      value={codMaxAmount}
                      onChange={(e) => setCodMaxAmount(e.target.value)}
                      className="w-full h-10 rounded-xl border border-[#E4EAF5] dark:border-slate-700 bg-[#F4F7FF] dark:bg-slate-900 px-3 font-mono-tabular text-xs"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold">COD Checkout Instructions</label>
                    <input
                      value={codInstructions}
                      onChange={(e) => setCodInstructions(e.target.value)}
                      className="w-full h-10 rounded-xl border border-[#E4EAF5] dark:border-slate-700 bg-[#F4F7FF] dark:bg-slate-900 px-3 text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#145CFF] px-6 py-2.5 text-xs font-semibold text-white hover:bg-[#0E47D9] disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'Saving...' : 'Save Payment Settings'}
                </button>
              </div>
            </form>
          )}
        </div>
      </PermissionGuard>
    </AdminLayout>
  );
}
