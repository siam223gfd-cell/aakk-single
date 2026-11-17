import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard } from 'lucide-react';
import { AdminLayout, PermissionGuard } from '../../../layouts/AdminLayout';
import {
  AdminPageHeader,
  DataTable,
  EmptyStateCard,
  ErrorBanner,
  SearchFilterBar,
  StatusBadge,
  statusToTone,
} from '../../../components/admin/ui';
import { apiRequest } from '../../../services/api';
import type { PaymentTransactionRecord } from '../../../types/commerce';
import { useSeoMeta } from '../../../lib/useSeoMeta';

export function PaymentTransactionsPage() {
  useSeoMeta({ title: 'Payment Transactions | NOVARA Admin', noIndex: true });

  const [transactions, setTransactions] = useState<PaymentTransactionRecord[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<{ ok: true; transactions: PaymentTransactionRecord[] }>('/api/admin/payments');
      setTransactions(res.transactions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load payment transactions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = transactions.filter((t) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      t.transactionId.toLowerCase().includes(q) ||
      t.gateway.toLowerCase().includes(q) ||
      (t.orderNumber || '').toLowerCase().includes(q)
    );
  });

  return (
    <AdminLayout>
      <PermissionGuard permission="payments.view">
        <div className="space-y-4 max-w-[1440px] mx-auto">
          <AdminPageHeader
            title="Payment Transactions"
            subtitle="Reconcile SSLCommerz, bKash, card, and COD settlement transactions."
            breadcrumbs={[{ label: 'Sales & Orders' }, { label: 'Payment Transactions' }]}
            actions={
              <Link
                to="/admin/payments/methods"
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#E4EAF5] dark:border-slate-700 bg-white dark:bg-[#0B1730] px-3.5 py-2 text-xs font-semibold"
              >
                Configure Gateways
              </Link>
            }
          />

          <SearchFilterBar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search transaction ref, gateway, or bank reference..."
          />

          {error && <ErrorBanner message={error} onRetry={load} />}

          <DataTable<PaymentTransactionRecord>
            rows={filtered}
            rowKey={(t) => t.id}
            loading={loading}
            emptyState={
              <EmptyStateCard
                icon={<CreditCard className="h-6 w-6" />}
                title="No payment transactions yet"
                description="Completed gateway charges and refunds will appear here automatically."
              />
            }
            columns={[
              {
                key: 'ref',
                header: 'Transaction Reference',
                render: (t) => (
                  <div>
                    <div className="font-mono-tabular font-bold text-[#101B35] dark:text-white">{t.transactionId}</div>
                    <div className="text-[11px] text-[#64748B]">{new Date(t.createdAt).toLocaleString()}</div>
                  </div>
                ),
              },
              {
                key: 'order',
                header: 'Linked Order',
                render: (t) => (
                  <Link to={`/admin/orders/${t.orderId}`} className="font-semibold text-[#145CFF] hover:underline">
                    {t.orderNumber ? `${t.orderNumber} →` : 'View Order →'}
                  </Link>
                ),
              },
              {
                key: 'gateway',
                header: 'Gateway',
                render: (t) => <StatusBadge label={t.gateway.toUpperCase()} tone="blue" />,
              },
              {
                key: 'amount',
                header: 'Amount',
                render: (t) => (
                  <div>
                    <div className="font-mono-tabular font-bold">৳{t.amount.toLocaleString('en-IN')}</div>
                    {(t.refundedAmount ?? 0) > 0 && (
                      <div className="font-mono-tabular text-[11px] text-rose-600">
                        Refunded: ৳{(t.refundedAmount ?? 0).toLocaleString('en-IN')}
                      </div>
                    )}
                  </div>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (t) => <StatusBadge label={t.status} tone={statusToTone(t.status)} />,
              },
            ]}
          />
        </div>
      </PermissionGuard>
    </AdminLayout>
  );
}
