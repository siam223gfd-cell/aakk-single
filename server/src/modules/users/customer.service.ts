import { UserModel, CustomerGroupModel } from './user.model';
import { OrderModel } from '../orders/order.model';
import { AddressModel } from '../addresses/address.model';
import { AppError } from '../../middleware/error.middleware';

export async function listCustomersAdmin(params: {
  page: number;
  limit: number;
  q: string;
  status?: string;
  groupId?: string;
}) {
  const { page, limit, q, status, groupId } = params;
  const filter: Record<string, unknown> = { role: 'customer' };
  if (status) filter.status = status;
  if (groupId) filter.customerGroupId = groupId;
  if (q) {
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: regex }, { email: regex }, { phone: regex }];
  }

  const [total, customers, orderAgg] = await Promise.all([
    UserModel.countDocuments(filter),
    UserModel.find(filter)
      .populate('customerGroupId', 'name discountPercent')
      .select('name email phone isVerified status customerGroupId notes createdAt lastLoginAt')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    OrderModel.aggregate([
      { $match: { orderStatus: { $ne: 'cancelled' } } },
      { $group: { _id: '$userId', orderCount: { $sum: 1 }, totalSpent: { $sum: '$total' } } },
    ]),
  ]);

  const aggMap = new Map(orderAgg.map((a) => [String(a._id), a]));

  return {
    customers: customers.map((c) => {
      const stats = aggMap.get(String(c._id));
      return {
        ...c,
        id: String(c._id),
        orderCount: stats?.orderCount || 0,
        totalSpent: stats?.totalSpent || 0,
      };
    }),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

export async function getCustomerByIdAdmin(id: string) {
  const customer = await UserModel.findOne({ _id: id, role: 'customer' })
    .populate('customerGroupId', 'name discountPercent')
    .select('name email phone isVerified status customerGroupId notes createdAt lastLoginAt')
    .lean();
  if (!customer) throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found.');

  const [orders, addresses] = await Promise.all([
    OrderModel.find({ userId: customer._id })
      .sort({ createdAt: -1 })
      .limit(40)
      .select('orderNumber total orderStatus paymentStatus paymentMethod createdAt items')
      .lean(),
    AddressModel.find({ userId: customer._id }).lean(),
  ]);

  const totalSpent = orders.filter((o) => o.orderStatus !== 'cancelled').reduce((s, o) => s + o.total, 0);

  return {
    customer: {
      ...customer,
      id: String(customer._id),
      orderCount: orders.length,
      totalSpent,
    },
    orders: orders.map((o) => ({ ...o, id: String(o._id) })),
    addresses: addresses.map((a) => ({ ...a, id: String(a._id) })),
  };
}

export async function updateCustomerStatusAdmin(params: {
  id: string;
  status?: 'active' | 'suspended';
  customerGroupId?: string | null;
  notes?: string;
}) {
  const patch: Record<string, unknown> = {};
  if (params.status !== undefined) patch.status = params.status;
  if (params.customerGroupId !== undefined) patch.customerGroupId = params.customerGroupId || null;
  if (params.notes !== undefined) patch.notes = params.notes;

  const updated = await UserModel.findOneAndUpdate(
    { _id: params.id, role: 'customer' },
    { $set: patch },
    { new: true },
  )
    .populate('customerGroupId', 'name discountPercent')
    .select('name email phone isVerified status customerGroupId notes createdAt lastLoginAt');

  if (!updated) throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found.');
  return { ...updated.toObject(), id: String(updated._id) };
}

export async function listCustomerGroupsAdmin() {
  const groups = await CustomerGroupModel.find().sort({ discountPercent: 1, name: 1 }).lean();
  return groups.map((g) => ({ ...g, id: String(g._id) }));
}

export async function createCustomerGroupAdmin(input: {
  name: string;
  slug: string;
  description?: string;
  discountPercent: number;
  minOrders: number;
  isActive: boolean;
}) {
  const group = await CustomerGroupModel.create(input);
  return { ...group.toObject(), id: String(group._id) };
}

export async function updateCustomerGroupAdmin(
  id: string,
  input: {
    name: string;
    slug: string;
    description?: string;
    discountPercent: number;
    minOrders: number;
    isActive: boolean;
  },
) {
  const updated = await CustomerGroupModel.findByIdAndUpdate(id, { $set: input }, { new: true });
  if (!updated) throw new AppError(404, 'GROUP_NOT_FOUND', 'Customer group not found.');
  return { ...updated.toObject(), id: String(updated._id) };
}

export async function deleteCustomerGroupAdmin(id: string) {
  await CustomerGroupModel.findByIdAndDelete(id);
  return { deleted: true };
}
