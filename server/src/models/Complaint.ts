import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

// A customer raises this against a serial they already own. It is the start of
// the rework cycle: the gate turns an open complaint into a gate entry when the
// unit physically arrives.
const complaintSchema = new Schema(
  {
    unitId: { type: String, required: true, uppercase: true, trim: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', default: null },
    customerName: { type: String, default: '' },
    problem: { type: String, required: true, trim: true },
    status: { type: String, enum: ['open', 'received', 'closed'], default: 'open' },
    raisedBy: { type: String, required: true },
    raisedAt: { type: Date, default: Date.now },
    receivedBy: { type: String, default: '' },
    receivedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

complaintSchema.index({ status: 1, raisedAt: -1 });
complaintSchema.index({ unitId: 1 });

export type Complaint = InferSchemaType<typeof complaintSchema>;
export type ComplaintDoc = HydratedDocument<Complaint>;

export const ComplaintModel = model('Complaint', complaintSchema);
