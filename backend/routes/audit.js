const express = require('express');
const AuditLog = require('../models/AuditLog');
const Document = require('../models/Document');
const { protect } = require('../middleware/auth');

const router = express.Router();

// GET /api/audit/:documentId - Get audit trail for a document
router.get('/:documentId', protect, async (req, res, next) => {
  try {
    // Verify document belongs to user
    const doc = await Document.findOne({
      _id: req.params.documentId,
      owner: req.user._id
    });

    if (!doc) {
      return res.status(404).json({ message: 'Document not found.' });
    }

    const logs = await AuditLog.find({ document: req.params.documentId })
      .sort({ timestamp: -1 })
      .limit(100);

    res.json({ logs });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
