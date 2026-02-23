const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  document: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document',
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      'document_created',
      'document_viewed',
      'document_sent',
      'signer_viewed',
      'signer_signed',
      'signer_rejected',
      'signature_placed',
      'signed_pdf_generated',
      'document_downloaded',
      'link_shared'
    ]
  },
  actor: {
    type: String, // email or userId
    required: true
  },
  actorType: {
    type: String,
    enum: ['owner', 'signer', 'system'],
    default: 'owner'
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed, // Additional event data
    default: {}
  },
  ipAddress: { type: String },
  userAgent: { type: String },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: false
});

// Index for fast document-based queries
auditLogSchema.index({ document: 1, timestamp: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
