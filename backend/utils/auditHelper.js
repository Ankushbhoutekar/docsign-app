const AuditLog = require('../models/AuditLog');

const createAuditLog = async ({ documentId, action, actor, actorType = 'owner', metadata = {}, req }) => {
  try {
    await AuditLog.create({
      document: documentId,
      action,
      actor,
      actorType,
      metadata,
      ipAddress: req?.ip || req?.headers?.['x-forwarded-for'] || 'unknown',
      userAgent: req?.headers?.['user-agent'] || 'unknown',
    });
  } catch (error) {
    console.error('Audit log error:', error.message);
  }
};

module.exports = { createAuditLog };
