const express = require('express');
const path = require('path');
const Document = require('../models/Document');
const { protect } = require('../middleware/auth');
const { saveSignedPdf } = require('../utils/pdfUtils');
const { createAuditLog } = require('../utils/auditHelper');

const router = express.Router();

// GET /api/signatures/public/:token - Public route for signer to view document
router.get('/public/:token', async (req, res, next) => {
  try {
    const doc = await Document.findOne({
      'signers.token': req.params.token
    }).select('-signers.token');

    if (!doc) {
      return res.status(404).json({ message: 'Signing link not found or expired.' });
    }

    const signer = doc.signers.find(s => s.token === req.params.token);
    if (!signer) return res.status(404).json({ message: 'Signer not found.' });

    // Check token expiry
    if (new Date() > new Date(signer.tokenExpiry)) {
      return res.status(410).json({ message: 'This signing link has expired.' });
    }

    if (doc.status === 'expired') {
      return res.status(410).json({ message: 'This document has expired.' });
    }

    // Log signer viewed
    if (signer.status === 'pending') {
      signer.status = 'viewed';
      await doc.save();
    }

    await createAuditLog({
      documentId: doc._id,
      action: 'signer_viewed',
      actor: signer.email,
      actorType: 'signer',
      req
    });

    res.json({
      document: {
        _id: doc._id,
        title: doc.title,
        description: doc.description,
        status: doc.status,
        originalFile: doc.originalFile,
        signatureFields: doc.signatureFields.filter(f => f.signerEmail === signer.email),
        expiresAt: doc.expiresAt
      },
      signer: {
        email: signer.email,
        name: signer.name,
        status: signer.status
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/signatures/sign/:token - Submit signature
router.post('/sign/:token', async (req, res, next) => {
  try {
    const { signatureData, name } = req.body;

    if (!signatureData) {
      return res.status(400).json({ message: 'Signature data is required.' });
    }

    const doc = await Document.findOne({ 'signers.token': req.params.token });
    if (!doc) return res.status(404).json({ message: 'Signing link not found.' });

    const signer = doc.signers.find(s => s.token === req.params.token);
    if (!signer) return res.status(404).json({ message: 'Signer not found.' });

    if (signer.status === 'signed') {
      return res.status(409).json({ message: 'You have already signed this document.' });
    }

    if (new Date() > new Date(signer.tokenExpiry)) {
      return res.status(410).json({ message: 'This signing link has expired.' });
    }

    // Update signer
    signer.status = 'signed';
    signer.signedAt = new Date();
    signer.signatureData = signatureData;
    signer.name = name || signer.name;
    signer.ipAddress = req.ip || req.headers['x-forwarded-for'];
    signer.userAgent = req.headers['user-agent'];

    // Update overall document status
    doc.updateStatus();

    // If all signed, generate final signed PDF
    if (doc.status === 'signed') {
      try {
        const signedDir = path.join(__dirname, '../signed');
        const { filename, path: signedPath } = await saveSignedPdf(
          doc.originalFile.path,
          doc.signatureFields,
          doc.signers,
          signedDir
        );
        doc.signedFile = { filename, path: signedPath, generatedAt: new Date() };

        await createAuditLog({
          documentId: doc._id,
          action: 'signed_pdf_generated',
          actor: 'system',
          actorType: 'system',
          metadata: { filename },
          req
        });
      } catch (pdfError) {
        console.error('PDF generation error:', pdfError.message);
      }
    }

    await doc.save();

    await createAuditLog({
      documentId: doc._id,
      action: 'signer_signed',
      actor: signer.email,
      actorType: 'signer',
      metadata: { name: signer.name, ipAddress: signer.ipAddress },
      req
    });

    res.json({
      message: 'Document signed successfully!',
      status: doc.status
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/signatures/reject/:token - Reject signing
router.post('/reject/:token', async (req, res, next) => {
  try {
    const { reason } = req.body;

    const doc = await Document.findOne({ 'signers.token': req.params.token });
    if (!doc) return res.status(404).json({ message: 'Signing link not found.' });

    const signer = doc.signers.find(s => s.token === req.params.token);
    if (!signer) return res.status(404).json({ message: 'Signer not found.' });

    if (signer.status === 'signed') {
      return res.status(409).json({ message: 'Cannot reject an already signed document.' });
    }

    signer.status = 'rejected';
    signer.rejectedAt = new Date();
    signer.rejectionReason = reason || 'No reason provided';
    signer.ipAddress = req.ip;

    doc.updateStatus();
    await doc.save();

    await createAuditLog({
      documentId: doc._id,
      action: 'signer_rejected',
      actor: signer.email,
      actorType: 'signer',
      metadata: { reason: signer.rejectionReason },
      req
    });

    res.json({ message: 'Document rejected.', status: doc.status });
  } catch (error) {
    next(error);
  }
});

// POST /api/signatures/generate/:id - Manually trigger PDF generation (owner only)
router.post('/generate/:id', protect, async (req, res, next) => {
  try {
    const doc = await Document.findOne({ _id: req.params.id, owner: req.user._id });
    if (!doc) return res.status(404).json({ message: 'Document not found.' });

    const signedDir = path.join(__dirname, '../signed');
    const { filename, path: signedPath } = await saveSignedPdf(
      doc.originalFile.path,
      doc.signatureFields,
      doc.signers,
      signedDir
    );

    doc.signedFile = { filename, path: signedPath, generatedAt: new Date() };
    await doc.save();

    res.json({
      message: 'Signed PDF generated!',
      signedFile: doc.signedFile
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
