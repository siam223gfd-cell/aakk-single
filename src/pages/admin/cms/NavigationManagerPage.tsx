import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ArrowDown, ArrowUp, Navigation, Plus, Save, Trash2 } from 'lucide-react';
import { AdminLayout, PermissionGuard } from '../../../layouts/AdminLayout';
import { AdminPageHeader, ErrorBanner, LoadingCards } from '../../../components/admin/ui';
import { apiRequest } from '../../../services/api';
import { useAppDispatch } from '../../../app/hooks';
import { showToast } from '../../../features/notifications/toastSlice';
import { useSeoMeta } from '../../../lib/useSeoMeta';

interface NavMenuItem {
  label: string;
  url: string;
  icon?: string;
  openInNewTab?: boolean;
  sortOrder: number;
  isActive: boolean;
}

export function NavigationManagerPage() {
  useSeoMeta({ title: 'Navigation Menu | NOVARA Admin', noIndex: true });
  const dispatch = useAppDispatch();

  const [items, setItems] = useState<NavMenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<{ ok: true; config: { navigationMenu?: NavMenuItem[] } }>('/api/admin/cms/homepage');
      setItems(
        (res.config?.navigationMenu || []).map((m, i) => ({
          label: m.label || '',
          url: m.url || '/',
          icon: m.icon || '',
          openInNewTab: Boolean(m.openInNewTab),
          sortOrder: Number(m.sortOrder ?? i),
          isActive: Boolean(m.isActive ?? true),
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load navigation menu.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { label: 'New Link', url: '/shop', icon: '', openInNewTab: false, sortOrder: prev.length, isActive: true },
    ]);
  };

  const moveItem = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    setItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next.map((item, i) => ({ ...item, sortOrder: i }));
    });
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const cleanMenu = items.map((m, i) => ({
        label: m.label.trim(),
        url: m.url.trim(),
        icon: m.icon?.trim() || '',
        openInNewTab: Boolean(m.openInNewTab),
        sortOrder: i,
        isActive: Boolean(m.isActive),
      }));
      await apiRequest('/api/admin/cms/homepage', {
        method: 'PUT',
        body: JSON.stringify({ navigationMenu: cleanMenu }),
      });
      dispatch(showToast({ variant: 'success', message: 'Storefront navigation menu saved.' }));
      load();
    } catch (err) {
      dispatch(showToast({ variant: 'error', message: err instanceof Error ? err.message : 'Save failed.' }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout>
      <PermissionGuard permission="cms.manage">
        <div className="space-y-5 max-w-[1040px] mx-auto">
          <AdminPageHeader
            title="Navigation Menu"
            subtitle="Reorder, toggle, and customize top-level navigation bar links synced directly to the storefront header."
            breadcrumbs={[{ label: 'Marketing' }, { label: 'Navigation Menu' }]}
            actions={
              <button
                type="button"
                onClick={addItem}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#145CFF] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0E47D9]"
              >
                <Plus className="h-4 w-4" /> Add Menu Link
              </button>
            }
          />

          {error && <ErrorBanner message={error} onRetry={load} />}
          {loading ? (
            <LoadingCards count={2} />
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="rounded-2xl border border-[#E4EAF5] dark:border-slate-800 bg-white dark:bg-[#0B1730] p-5 shadow-xs space-y-3">
                {items.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[#64748B]">
                    <Navigation className="mx-auto mb-2 h-6 w-6 text-[#145CFF]" />
                    No custom navigation links configured. Click "Add Menu Link" to create your header bar.
                  </div>
                ) : (
                  items.map((item, idx) => (
                    <div
                      key={idx}
                      className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] items-center rounded-xl border border-[#E4EAF5] dark:border-slate-800 bg-[#F8FAFF] dark:bg-slate-900/50 p-3"
                    >
                      <div>
                        <label className="mb-1 block text-[11px] font-semibold text-[#64748B]">Label *</label>
                        <input
                          required
                          value={item.label}
                          onChange={(e) =>
                            setItems((prev) => prev.map((r, i) => (i === idx ? { ...r, label: e.target.value } : r)))
                          }
                          className="w-full h-9 rounded-lg border border-[#E4EAF5] dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-semibold text-[#64748B]">Destination URL *</label>
                        <input
                          required
                          value={item.url}
                          onChange={(e) =>
                            setItems((prev) => prev.map((r, i) => (i === idx ? { ...r, url: e.target.value } : r)))
                          }
                          className="w-full h-9 rounded-lg border border-[#E4EAF5] dark:border-slate-700 bg-white dark:bg-slate-900 px-3 font-mono-tabular text-xs"
                        />
                      </div>
                      <label className="inline-flex items-center gap-1.5 text-xs font-semibold pt-4">
                        <input
                          type="checkbox"
                          checked={item.isActive}
                          onChange={(e) =>
                            setItems((prev) => prev.map((r, i) => (i === idx ? { ...r, isActive: e.target.checked } : r)))
                          }
                          className="h-4 w-4 rounded text-[#145CFF]"
                        />
                        Active
                      </label>
                      <div className="flex items-center gap-1 pt-4">
                        <button
                          type="button"
                          onClick={() => moveItem(idx, -1)}
                          disabled={idx === 0}
                          className="rounded-lg border border-[#E4EAF5] dark:border-slate-700 p-1.5 disabled:opacity-30"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveItem(idx, 1)}
                          disabled={idx === items.length - 1}
                          className="rounded-lg border border-[#E4EAF5] dark:border-slate-700 p-1.5 disabled:opacity-30"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                          className="rounded-lg border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#145CFF] px-6 py-2.5 text-xs font-semibold text-white hover:bg-[#0E47D9] disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'Saving...' : 'Save Navigation Menu'}
                </button>
              </div>
            </form>
          )}
        </div>
      </PermissionGuard>
    </AdminLayout>
  );
}
