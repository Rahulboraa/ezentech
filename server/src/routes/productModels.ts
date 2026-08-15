import { Router } from 'express';
import { ProductModel } from '../models/ProductModel.js';
import { UnitModel } from '../models/Unit.js';
import { requireRole } from '../middleware/auth.js';
import { HttpError } from '../lib/httpError.js';
import { logAudit } from '../lib/audit.js';
import { productModelCreateSchema, productModelUpdateSchema } from '../validation/schemas.js';

export const productModelsRouter = Router();

function serialize(m: Record<string, any>) {
  return {
    id: String(m._id),
    name: m.name,
    productCode: m.productCode,
    variant: m.variant,
    type: m.type,
    active: m.active,
    updatedAt: m.updatedAt,
  };
}

// The assembly tray only ever offers active models; the Models screen asks for
// the retired ones too so they can be brought back.
productModelsRouter.get('/', async (req, res) => {
  const filter = req.query.includeInactive === '1' ? {} : { active: true };
  const models = await ProductModel.find(filter).sort({ name: 1 }).lean();
  res.json(models.map(serialize));
});

productModelsRouter.use(requireRole('production'));

async function assertNameFree(name: string, exceptId?: string) {
  const clash = await ProductModel.findOne({ name }).select('_id').lean();
  if (clash && String(clash._id) !== exceptId) throw new HttpError(409, 'A model with that name already exists');
}

// Two models sharing a code and variant would issue identical serial prefixes,
// which makes the traceability report ambiguous.
async function assertCodeFree(productCode: string, variant: string, exceptId?: string) {
  const clash = await ProductModel.findOne({ productCode, variant }).select('_id name').lean();
  if (clash && String(clash._id) !== exceptId) {
    throw new HttpError(409, `${productCode}·${variant} is already used by "${clash.name}"`);
  }
}

productModelsRouter.post('/', async (req, res) => {
  const body = productModelCreateSchema.parse(req.body);
  await assertNameFree(body.name);
  await assertCodeFree(body.productCode, body.variant);
  const created = await ProductModel.create({ ...body, active: true });
  await logAudit(req.user.name, 'model-create', '', `${body.name} · ${body.productCode}${body.variant}`);
  res.status(201).json(serialize(created.toObject()));
});

productModelsRouter.patch('/:id', async (req, res) => {
  const body = productModelUpdateSchema.parse(req.body);
  const doc = await ProductModel.findById(req.params.id);
  if (!doc) throw new HttpError(404, 'Model not found');

  if (body.name !== undefined) await assertNameFree(body.name, String(doc._id));
  const productCode = body.productCode ?? doc.productCode;
  const variant = body.variant ?? doc.variant;
  if (body.productCode !== undefined || body.variant !== undefined) {
    await assertCodeFree(productCode, variant, String(doc._id));
  }

  if (body.name !== undefined) doc.name = body.name;
  if (body.productCode !== undefined) doc.productCode = body.productCode;
  if (body.variant !== undefined) doc.variant = body.variant;
  if (body.type !== undefined) doc.type = body.type;
  if (body.active !== undefined) doc.active = body.active;
  await doc.save();
  await logAudit(req.user.name, 'model-edit', '', `${doc.name} · ${doc.productCode}${doc.variant}`);
  res.json(serialize(doc.toObject()));
});

// Units keep their own copy of the code and variant, so a model that has
// already built something is retired rather than erased.
productModelsRouter.delete('/:id', async (req, res) => {
  const doc = await ProductModel.findById(req.params.id);
  if (!doc) throw new HttpError(404, 'Model not found');
  const built = await UnitModel.exists({ modelId: doc._id });
  if (built) {
    throw new HttpError(409, `${doc.name} has units on record — deactivate it instead of deleting it`);
  }
  await doc.deleteOne();
  await logAudit(req.user.name, 'model-delete', '', doc.name);
  res.json({ ok: true });
});
