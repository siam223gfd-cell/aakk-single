import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Edit3, Plus, SlidersHorizontal, Trash2 } from 'lucide-react';
import { AdminLayout, PermissionGuard } from '../../../layouts/AdminLayout';
import {
  AdminPageHeader,
  DataTable,
  EmptyStateCard,
  ErrorBanner,
  StatusBadge,
} from '../../../components/admin/ui';
import { ConfirmDialog, Modal } from '../../../components/ui/Modal';
import { apiRequest } from '../../../services/api';
import { useAppDispatch } from '../../../app/hooks';
import { showToast } from '../../../features/notifications/toastSlice';
import type { ProductAttributePresetItem } from '../../../types/commerce';
import { useSeoMeta } from '../../../lib/useSeoMeta';

function slugifyCode(val: string) {
  return val
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function AttributesPage() {
  useSeoMeta({ title: 'Product Attributes | NOVARA Admin', noIndex: true });
  const dispatch = useAppDispatch();

  const [attributes, setAttributes] = useState<ProductAttributePresetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [group, setGroup] = useState<ProductAttributePresetItem['group']>('general');
  const [valuesText, setValuesText] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ProductAttributePresetItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<{ ok: true; attributes: ProductAttributePresetItem[] }>('/api/admin/attributes');
      setAttributes(res.attributes || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load product attributes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setName('');
    setCode('');
    setGroup('general');
    setValuesText('');
    setIsActive(true);
    setModalOpen(true);
  };

  const openEdit = (item: ProductAttributePresetItem) => {
    setEditingId(item.id);
    setName(item.name);
    setCode(item.code);
    setGroup(item.group);
    setValuesText((item.values || []).join(', '));
    setIsActive(item.isActive);
    setModalOpen(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        code: (code.trim() || slugifyCode(name)).toLowerCase(),
        group,
        values: valuesText.split(',').map((s) => s.trim()).filter(Boolean),
        isActive,
      };
      if (editingId) {
        await apiRequest(`/api/admin/attributes/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
        dispatch(showToast({ variant: 'success', message: 'Attribute preset updated.' }));
      } else {
        await apiRequest('/api/admin/attributes', { method: 'POST', body: JSON.stringify(payload) });
        dispatch(showToast({ variant: 'success', message: 'Attribute preset created.' }));
      }
      setModalOpen(false);
      load();
    } catch (err) {
      dispatch(showToast({ variant: 'error', message: err instanceof Error ? err.message : 'Save failed.' }));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiRequest(`/api/admin/attributes/${deleteTarget.id}`, { method: 'DELETE' });
      dispatch(showToast({ variant: 'success', message: 'Attribute preset deleted.' }));
      setDeleteTarget(null);
      load();
    } catch (err) {
      dispatch(showToast({ variant: 'error', message: err instanceof Error ? err.message : 'Delete failed.' }));
    }
  };

  return (
    <AdminLayout>
      <PermissionGuard permission="catalog.view">
        <div className="space-y-4 max-w-[1440px] mx-auto">
          <AdminPageHeader
            title="Product Attributes"
            subtitle="Define reusable specification keys & option value presets (e.g., Storage, Material, Color, Skin Type)."
            breadcrumbs={[{ label: 'Product Management' }, { label: 'Product Attributes' }]}
            actions={
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#145CFF] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#0E47D9]"
              >
                <Plus className="h-4 w-4" /> Add Attribute
              </button>
            }
          />

          {error && <ErrorBanner message={error} onRetry={load} />}

          <DataTable<ProductAttributePresetItem>
            rows={attributes}
            rowKey={(a) => a.id}
            loading={loading}
            emptyState={
              <EmptyStateCard
                icon={<SlidersHorizontal className="h-6 w-6" />}
                title="No attribute presets yet"
                description="Create shared attribute presets to standardize specifications across product groups."
                action={
                  <button
                    type="button"
                    onClick={openCreate}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#145CFF] px-4 py-2 text-xs font-semibold text-white"
                  >
                    <Plus className="h-4 w-4" /> Add Attribute
                  </button>
                }
              />
            }
            columns={[
              {
                key: 'name',
                header: 'Attribute Name & Code',
                render: (a) => (
                  <div>
                    <div className="font-semibold text-[#101B35] dark:text-white">{a.name}</div>
                    <div className="font-mono-tabular text-[11px] text-[#64748B]">{a.code}</div>
                  </div>
                ),
              },
              {
                key: 'group',
                header: 'Group',
                render: (a) => <StatusBadge label={a.group} tone="blue" />,
              },
              {
                key: 'values',
                header: 'Allowed Values',
                render: (a) => (
                  <div className="flex flex-wrap gap-1 max-w-md">
                    {(a.values || []).slice(0, 6).map((v) => (
                      <span
                        key={v}
                        className="rounded-md bg-[#F4F7FF] dark:bg-slate-800 border border-[#E4EAF5] dark:border-slate-700 px-2 py-0.5 text-[11px] font-medium"
                      >
                        {v}
                      </span>
                    ))}
                    {(a.values?.length || 0) > 6 && (
                      <span className="text-[11px] text-[#64748B]">+{a.values.length - 6} more</span>
                    )}
                  </div>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (a) => (
                  <StatusBadge label={a.isActive ? 'Active' : 'Inactive'} tone={a.isActive ? 'emerald' : 'slate'} />
                ),
              },
              {
                key: 'actions',
                header: 'Actions',
                align: 'right',
                render: (a) => (
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEdit(a)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#E4EAF5] dark:border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-[#101B35] dark:text-slate-200 hover:bg-slate-50"
                    >
                      <Edit3 className="h-3.5 w-3.5 text-[#145CFF]" /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(a)}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  </div>
                ),
              },
            ]}
          />

          <Modal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            title={editingId ? 'Edit Attribute Preset' : 'Add Attribute Preset'}
            size="md"
          >
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold">Attribute Name *</label>
                <input
                  required
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!editingId) setCode(slugifyCode(e.target.value));
                  }}
                  placeholder="e.g. Storage Capacity"
                  className="w-full h-10 rounded-xl border border-[#E4EAF5] dark:border-slate-700 bg-[#F4F7FF] dark:bg-slate-900 px-3 text-xs"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold">Code *</label>
                  <input
                    required
                    value={code}
                    onChange={(e) => setCode(slugifyCode(e.target.value))}
                    className="w-full h-10 rounded-xl border border-[#E4EAF5] dark:border-slate-700 bg-[#F4F7FF] dark:bg-slate-900 px-3 font-mono-tabular text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold">Attribute Group</label>
                  <select
                    value={group}
                    onChange={(e) => setGroup(e.target.value as ProductAttributePresetItem['group'])}
                    className="w-full h-10 rounded-xl border border-[#E4EAF5] dark:border-slate-700 bg-[#F4F7FF] dark:bg-slate-900 px-3 text-xs"
                  >
                    <option value="general">General</option>
                    <option value="electronics">Electronics</option>
                    <option value="beauty">Beauty</option>
                    <option value="books">Books</option>
                    <option value="home">Home</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold">Preset Values (comma separated)</label>
                <input
                  value={valuesText}
                  onChange={(e) => setValuesText(e.target.value)}
                  placeholder="128GB, 256GB, 512GB, 1TB"
                  className="w-full h-10 rounded-xl border border-[#E4EAF5] dark:border-slate-700 bg-[#F4F7FF] dark:bg-slate-900 px-3 text-xs"
                />
              </div>
              <label className="inline-flex items-center gap-2 text-xs font-semibold">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 rounded text-[#145CFF]"
                />
                Active
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-[#E4EAF5] px-4 py-2 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-[#145CFF] px-5 py-2 text-xs font-semibold text-white hover:bg-[#0E47D9] disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Attribute'}
                </button>
              </div>
            </form>
          </Modal>

          <ConfirmDialog
            open={Boolean(deleteTarget)}
            onClose={() => setDeleteTarget(null)}
            onConfirm={handleDelete}
            title="Delete Attribute Preset"
            message={`Remove "${deleteTarget?.name}" preset? Existing products keep their stored attribute values.`}
            confirmLabel="Delete"
            destructive
          />
        </div>
      </PermissionGuard>
    </AdminLayout>
  );
}
