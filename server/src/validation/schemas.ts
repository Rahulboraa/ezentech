import { z } from 'zod';
import { PRODUCT_CODE_LENGTH, UNIT_TYPE_KEYS, type UnitType } from '../domain/units.js';
import { ROLES, type Role } from '../models/User.js';

const str = z.string().trim();

export const loginSchema = z.object({
  userId: str.min(1),
  pin: str.min(1),
});

// PINs are typed on a shop-floor keypad, so keep them short but not guessable
const pin = str.min(4, 'PIN must be at least 4 characters').max(12);

export const userCreateSchema = z.object({
  name: str.min(1, 'Station name is required'),
  role: z.enum(ROLES as unknown as [Role, ...Role[]]),
  pin,
  // required for customer logins so the account can be scoped to its own machines
  customerId: str.optional().nullable(),
});

export const userUpdateSchema = z.object({
  name: str.min(1).optional(),
  role: z.enum(ROLES as unknown as [Role, ...Role[]]).optional(),
  active: z.boolean().optional(),
});

export const resetPinSchema = z.object({ pin });

export const ownPinSchema = z.object({
  currentPin: str.min(1, 'Enter your current PIN'),
  newPin: pin,
});

export const customerSchema = z.object({
  name: str.min(1, 'Customer name is required'),
  phone: str.default(''),
  city: str.default(''),
  address: str.default(''),
});

export const productModelCreateSchema = z.object({
  name: str.min(1, 'Model name is required'),
  productCode: str
    .toUpperCase()
    .length(PRODUCT_CODE_LENGTH, `Enter the full ${PRODUCT_CODE_LENGTH}-character product code`)
    .regex(/^[A-Z0-9]+$/, 'Product code may only contain letters and digits'),
  variant: str.toUpperCase().length(1, 'Enter the 1-character product variant').regex(/^[A-Z0-9]$/, 'Variant must be a letter or digit'),
  type: z.enum(UNIT_TYPE_KEYS as [UnitType, ...UnitType[]]),
});

export const productModelUpdateSchema = productModelCreateSchema.partial().extend({
  active: z.boolean().optional(),
});

// The operator never types the serial's building blocks — the model carries the
// product code, variant and assembly type, and the line is a station setting.
export const unitCreateSchema = z.object({
  modelId: str.min(1, 'Pick the model this line is running'),
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

export const complaintCreateSchema = z.object({
  unitId: str.min(1, 'Enter the serial number printed on the machine'),
  problem: str.min(3, 'Describe the problem'),
});

export const remarkSchema = z.object({
  text: str.min(1, 'Enter a remark first'),
});

// One truck carries many units, so the trip — driver, vehicle, destination and
// invoice — is entered once and stamped onto every unit on board.
const tripFields = {
  driverName: str.min(1, 'Driver name is required'),
  vehicleNumber: str.min(1, 'Vehicle number is required'),
  location: str.min(1, 'Location is required'),
  invoiceNumber: str.min(1, 'Invoice number is required'),
  overwrite: z.boolean().default(false),
};

export const dispatchSchema = z.object(tripFields);

export const dispatchBatchSchema = z.object({
  unitIds: z.array(str.min(1)).min(1, 'Scan at least one unit onto the truck').max(200, 'Too many units for one trip'),
  ...tripFields,
});

export const gateRequestSchema = z.object({
  reason: str.default(''),
});

export const qualityDecisionSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
});
