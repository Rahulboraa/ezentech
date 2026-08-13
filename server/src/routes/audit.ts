import { Router } from 'express';
import { AuditLogModel } from '../models/AuditLog.js';
import { serializeAudit } from '../lib/sanitize.js';

export const auditRouter = Router();

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const RANGE_DAYS: Record<string, number> = { today: 1, '7d': 7, '30d': 30, '90d': 90 };

auditRouter.get('/', async (req, res) => {
  const search = String(req.query.search ?? '').trim();
  const action = String(req.query.action ?? '').trim();
  const user = String(req.query.user ?? '').trim();
  const range = String(req.query.range ?? '').trim();
  const page = Math.max(parseInt(String(req.query.page)) || 1, 1);
  const limit = Math.min(Math.max(parseInt(String(req.query.limit)) || 20, 1), 200);

  const filter: Record<string, unknown> = {};
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ user: rx }, { unitId: rx }, { action: rx }, { details: rx }];
  }
  if (action) filter.action = action;
  if (user) filter.user = user;
  if (RANGE_DAYS[range]) {
    const since = new Date();
    if (range === 'today') since.setHours(0, 0, 0, 0);
    else since.setDate(since.getDate() - RANGE_DAYS[range]);
    filter.at = { $gte: since };
  }

  // the dropdowns list what actually happened on this line, not every enum value
  const [rows, total, actions, users] = await Promise.all([
    AuditLogModel.find(filter)
      .sort({ at: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    AuditLogModel.countDocuments(filter),
    AuditLogModel.distinct('action'),
    AuditLogModel.distinct('user'),
  ]);

  res.json({
    rows: rows.map(serializeAudit),
    total,
    page,
    limit,
    actions: (actions as string[]).sort(),
    users: (users as string[]).sort(),
  });
});
