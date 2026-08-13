import { z } from 'zod';
import { PRODUCT_CODE_LENGTH, UNIT_TYPE_KEYS, type UnitType } from '../domain/units.js';

const str = z.string().trim();

export const loginSchema = z.object({
  userId: str.min(1),
  pin: str.min(1),
});

export const customerSchema = z.object({
  name: str.min(1, 'Customer name is required'),
  phone: str.default(''),
  city: str.default(''),
  address: str.default(''),
});

export const unitCreateSchema = z.object({
  type: z.enum(UNIT_TYPE_KEYS as [UnitType, ...UnitType[]]),
  productCode: str.length(PRODUCT_CODE_LENGTH, `Enter the full ${PRODUCT_CODE_LENGTH}-character product code`),
  variant: str.length(1, 'Enter the 1-character product variant'),
  lineCode: str.length(1, 'Enter the manufacturing line code'),
  operator: str.default(''),
  customerId: str.optional().nullable(),
  compressor: str.default(''),
  motor: str.default(''),
  controller: str.default(''),
  heatExchanger: str.default(''),
});

export const unitEditSchema = z.object({
  customerId: str.optional().nullable(),
  operator: str.default(''),
});

export const remarkSchema = z.object({
  text: str.min(1, 'Enter a remark first'),
});

export const dispatchSchema = z.object({
  driverName: str.min(1, 'Driver name is required'),
  vehicleNumber: str.min(1, 'Vehicle number is required'),
  location: str.min(1, 'Location is required'),
  overwrite: z.boolean().default(false),
});

export const gateRequestSchema = z.object({
  reason: str.default(''),
});

export const qualityDecisionSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
});
