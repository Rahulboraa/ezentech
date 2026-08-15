import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { UNIT_TYPE_KEYS } from '../domain/units.js';

// A model is the thing the line is actually running: one saved product code +
// variant + assembly type under a name the shop floor recognises. The operator
// picks it once at changeover instead of retyping the 7-character code on every
// unit, and a typo can only ever be made here, not on the line.
const productModelSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    // chars 1–7 of every serial this model issues
    productCode: { type: String, required: true, uppercase: true, trim: true },
    // char 8 — the critical-part-change code
    variant: { type: String, required: true, uppercase: true, trim: true },
    type: { type: String, required: true, enum: UNIT_TYPE_KEYS },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

productModelSchema.index({ name: 1 }, { unique: true });
productModelSchema.index({ active: 1, name: 1 });

export type ProductModelType = InferSchemaType<typeof productModelSchema>;
export type ProductModelDoc = HydratedDocument<ProductModelType>;

export const ProductModel = model('ProductModel', productModelSchema);
