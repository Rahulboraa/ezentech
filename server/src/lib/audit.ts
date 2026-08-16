import { AuditLogModel } from '../models/AuditLog.js';

export type AuditAction =
  | 'create'
  | 'edit'
  | 'delete'
  | 'remark'
  | 'dispatch'
  | 'dispatch-after-rework'
  | 'gate-request'
  | 'gate-quality-approved'
  | 'gate-quality-rejected'
  | 'gate-issued'
  | 'rework-completed'
  | 'model-create'
  | 'model-edit'
  | 'model-delete'
  | 'complaint-raised'
  | 'complaint-received';

export async function logAudit(user: string, action: AuditAction, unitId = '', details = '') {
  await AuditLogModel.create({ user, action, unitId, details, at: new Date() });
}
