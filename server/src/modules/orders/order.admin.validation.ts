import { z } from 'zod';

export const orderStatusUpdateSchema = z.object({
  nextStatus: z.enum(['confirmed', 'processing', 'packed', 'shipped', 'delivered', 'cancelled']),
  reason: z.string().trim().max(240).optional(),
  courierName: z.string().trim().max(80).optional(),
  trackingNumber: z.string().trim().max(80).optional(),
});

export const orderNoteSchema = z.object({
  note: z.string().trim().min(2).max(500),
});

export const returnUpdateSchema = z.object({
  status: z.enum(['approved', 'rejected', 'received', 'refunded']),
  inspectionNotes: z.string().trim().max(500).optional(),
  restockEligible: z.boolean().default(false),
});
