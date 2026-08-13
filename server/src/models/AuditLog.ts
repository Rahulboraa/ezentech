import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

const auditLogSchema = new Schema({
  user: { type: String, required: true },
  action: { type: String, required: true },
  unitId: { type: String, default: '' },
  details: { type: String, default: '' },
  at: { type: Date, default: Date.now },
});

auditLogSchema.index({ at: -1 });

export type AuditLog = InferSchemaType<typeof auditLogSchema>;
export type AuditLogDoc = HydratedDocument<AuditLog>;

export const AuditLogModel = model('AuditLog', auditLogSchema);
