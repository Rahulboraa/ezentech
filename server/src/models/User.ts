import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

export const ROLES = ['production', 'dispatch', 'gate', 'quality', 'customer', 'admin'] as const;
export type Role = (typeof ROLES)[number];

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    role: { type: String, required: true, enum: ROLES },
    pinHash: { type: String, required: true, select: false },
    // a customer login is tied to one account and only ever sees its own machines
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export type User = InferSchemaType<typeof userSchema>;
export type UserDoc = HydratedDocument<User>;

export const UserModel = model('User', userSchema);
