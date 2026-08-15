import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { UNIT_TYPE_KEYS } from '../domain/units.js';

const remarkSchema = new Schema(
  {
    user: { type: String, required: true },
    text: { type: String, required: true },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const dispatchSchema = new Schema(
  {
    driverName: { type: String, required: true },
    vehicleNumber: { type: String, required: true },
    location: { type: String, required: true },
    // shared by every unit on the same truck; blank on trips logged before
    // invoice numbers were captured
    invoiceNumber: { type: String, default: '' },
    dispatchedBy: { type: String, required: true },
    dispatchedAt: { type: Date, default: Date.now },
    afterRework: { type: Boolean, default: false },
  },
  { _id: false },
);

const gateEntrySchema = new Schema(
  {
    status: { type: String, enum: ['pending', 'approved', 'issued', 'rejected'], default: 'pending' },
    reason: { type: String, default: '' },
    requestedBy: { type: String, required: true },
    requestedAt: { type: Date, default: Date.now },
    // Quality approve / reject decision
    decidedBy: { type: String, default: '' },
    decidedAt: { type: Date, default: null },
    // Quality issuing the approved unit back to Production
    qualityBy: { type: String, default: '' },
    qualityAt: { type: Date, default: null },
    // Production marking the physical rework finished
    reworkDone: { type: Boolean, default: false },
    reworkDoneBy: { type: String, default: '' },
    reworkDoneAt: { type: Date, default: null },
  },
  { _id: false },
);

const unitSchema = new Schema(
  {
    unitId: { type: String, required: true, unique: true, uppercase: true, trim: true },
    // the model the line was running — the name is denormalised so a renamed or
    // retired model never rewrites history on a unit already built
    modelId: { type: Schema.Types.ObjectId, ref: 'ProductModel', default: null },
    modelName: { type: String, default: '' },
    productCode: { type: String, required: true, uppercase: true, trim: true },
    // 8th character of the serial: the critical-part-change code
    variant: { type: String, default: '', uppercase: true, trim: true },
    // 12th character: Amber WAC code / manufacturing line
    lineCode: { type: String, default: '', uppercase: true, trim: true },
    type: { type: String, required: true, enum: UNIT_TYPE_KEYS },
    compressor: { type: String, default: '', trim: true },
    motor: { type: String, default: '', trim: true },
    controller: { type: String, default: '', trim: true },
    heatExchanger: { type: String, default: '', trim: true },
    operator: { type: String, default: '', trim: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', default: null },
    customerName: { type: String, default: '' },
    assembledAt: { type: Date, default: Date.now },
    loggedBy: { type: String, required: true },
    serviceRemarks: { type: [remarkSchema], default: [] },
    dispatch: { type: dispatchSchema, default: null },
    dispatchLog: { type: [dispatchSchema], default: [] },
    gateLog: { type: [gateEntrySchema], default: [] },
  },
  { timestamps: true },
);

unitSchema.index({ assembledAt: -1 });
unitSchema.index({ customerId: 1 });
// part serials are looked up on every scan to catch duplicates
unitSchema.index({ compressor: 1 });
unitSchema.index({ motor: 1 });
unitSchema.index({ controller: 1 });
unitSchema.index({ heatExchanger: 1 });

export type Unit = InferSchemaType<typeof unitSchema>;
export type UnitDoc = HydratedDocument<Unit>;

export const UnitModel = model('Unit', unitSchema);
