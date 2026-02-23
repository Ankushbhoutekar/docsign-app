const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const signatureFieldSchema = new mongoose.Schema({
  id: { type: String, default: () => uuidv4() },
  page: { type: Number, required: true },
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  width: { type: Number, default: 200 },
  height: { type: Number, default: 60 },
  signerEmail: { type: String, required: true },
  label: { type: String, default: 'Signature' },
  required: { type: Boolean, default: true }
});

const signerSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true },
  name: { type: String },
  status: {
    type: String,
    enum: ['pending', 'signed', 'rejected', 'viewed'],
    default: 'pending'
  },
  signedAt: { type: Date },
  rejectedAt: { type: Date },
  rejectionReason: { type: String },
  token: { type: String, default: () => uuidv4() },
  tokenExpiry: {
    type: Date,
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  },
  signatureData: { type: String }, // Base64 signature image
  ipAddress: { type: String },
  userAgent: { type: String }
});

const documentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Document title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  originalFile: {
    filename: String,
    originalName: String,
    path: String,
    size: Number,
    mimetype: String
  },
  signedFile: {
    filename: String,
    path: String,
    generatedAt: Date
  },
  status: {
    type: String,
    enum: ['draft', 'pending', 'partially_signed', 'signed', 'rejected', 'expired'],
    default: 'draft'
  },
  signers: [signerSchema],
  signatureFields: [signatureFieldSchema],
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
  },
  isPublic: { type: Boolean, default: false },
  pageCount: { type: Number, default: 1 }
}, {
  timestamps: true
});

// Auto-update document status based on signers
documentSchema.methods.updateStatus = function() {
  if (this.signers.length === 0) return;
  
  const allSigned = this.signers.every(s => s.status === 'signed');
  const anySigned = this.signers.some(s => s.status === 'signed');
  const anyRejected = this.signers.some(s => s.status === 'rejected');
  
  if (allSigned) this.status = 'signed';
  else if (anyRejected) this.status = 'rejected';
  else if (anySigned) this.status = 'partially_signed';
  else this.status = 'pending';
};

module.exports = mongoose.model('Document', documentSchema);
