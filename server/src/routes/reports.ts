import { Router } from 'express';
import * as XLSX from 'xlsx';
import { UnitModel, type UnitDoc } from '../models/Unit.js';
import { HttpError } from '../lib/httpError.js';
import { UNIT_TYPES, type UnitType } from '../domain/units.js';

export const reportsRouter = Router();

const NO_CUSTOMER = '(No customer assigned)';

function fmtDate(value: Date | string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  return (
    d.toLocaleDateString('en-GB', { month: 'short', day: '2-digit', year: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  );
}

function unitRow(r: UnitDoc) {
  return {
    'Unit ID': r.unitId,
    Type: UNIT_TYPES[r.type as UnitType]?.label ?? r.type,
    'Compressor Serial': r.compressor || '',
    'Motor Serial': r.motor || '',
    'Controller Serial': r.controller || '',
    'Heat Exchanger Serial': r.heatExchanger || '',
    'Assembled At': fmtDate(r.assembledAt),
    Dispatched: r.dispatch ? 'Yes' : 'No',
    'Driver Name': r.dispatch?.driverName ?? '',
    'Vehicle Number': r.dispatch?.vehicleNumber ?? '',
    'Dispatch Location': r.dispatch?.location ?? '',
    'Dispatched At': r.dispatch ? fmtDate(r.dispatch.dispatchedAt) : '',
  };
}

// Excel sheet names: max 31 chars, no \ / ? * [ ] : and must be unique
function safeSheetName(name: string, used: Set<string>): string {
  const base = (name || 'Unassigned').replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 28) || 'Unassigned';
  let candidate = base;
  let n = 2;
  while (used.has(candidate.toLowerCase())) {
    candidate = `${base} (${n})`.slice(0, 31);
    n++;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

reportsRouter.get('/customers.xlsx', async (req, res) => {
  const choice = String(req.query.customer ?? '__ALL__');
  const units = await UnitModel.find().sort({ assembledAt: -1 });
  if (units.length === 0) throw new HttpError(400, 'No records to report on');

  const wb = XLSX.utils.book_new();
  const dateStamp = new Date().toISOString().slice(0, 10);
  let fileName: string;

  if (choice === '__ALL__') {
    const byName = new Map<string, UnitDoc[]>();
    for (const u of units) {
      const name = u.customerName || NO_CUSTOMER;
      if (!byName.has(name)) byName.set(name, []);
      byName.get(name)!.push(u);
    }
    const names = [...byName.keys()].sort((a, b) => a.localeCompare(b));
    const summary = names.map((n) => ({
      Customer: n,
      'Units Supplied': byName.get(n)!.length,
      Dispatched: byName.get(n)!.filter((r) => r.dispatch).length,
      'Pending Dispatch': byName.get(n)!.filter((r) => !r.dispatch).length,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'Summary');
    const used = new Set(['summary']);
    for (const n of names) {
      const ws = XLSX.utils.json_to_sheet(byName.get(n)!.map(unitRow));
      XLSX.utils.book_append_sheet(wb, ws, safeSheetName(n, used));
    }
    fileName = `units_by_customer_${dateStamp}.xlsx`;
  } else {
    const matched = units.filter((r) => (r.customerName || NO_CUSTOMER) === choice);
    if (matched.length === 0) throw new HttpError(404, 'No units found for that customer');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(matched.map(unitRow)), safeSheetName(choice, new Set()));
    const safe = choice.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'customer';
    fileName = `units_${safe}_${dateStamp}.xlsx`;
  }

  const buffer: Buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(buffer);
});
