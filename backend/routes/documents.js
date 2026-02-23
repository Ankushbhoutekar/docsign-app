const express = require('express');
const path = require('path');
const fs = require('fs');
const Document = require('../models/Document');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { createAuditLog } = require('../utils/auditHelper');

const router = express.Router();

// GET /api/documents - Get all docs for logged-in user
router.get('/', protect, async (req, res, next) => {
  try {
    const { status, search } = req.query;
    const query = { owner: req.user._id };
    
    if (status && status !== 'all') query.status = status;
    if (search) query.title = { $regex: search, $options: 'i' };

    const documents = await Document.find(query)
      .sort({ createdAt: -1 })
      .select('-signatureFields -signers.token');

    res.json({ documents });
  } catch (error) {
    next(error);
  }
});

// GET /api/documents/stats - Dashboard stats
router.get('/stats', protect, async (req, res, next) => {
  try {
    const ownerId = req.user._id;
    const [total, pending, signed, rejected] = await Promise.all([
      Document.countDocuments({ owner: ownerId }),
      Document.countDocuments({ owner: ownerId, status: { $in: ['pending', 'partially_signed'] } }),
      Document.countDocuments({ owner: ownerId, status: 'signed' }),
      Document.countDocuments({ owner: ownerId, status: 'rejected' })
    ]);
    res.json({ total, pending, signed, rejected });
  } catch (error) {
    next(error);
  }
});

// POST /api/documents/upload - Upload new PDF
router.post('/upload', protect, upload.single('document'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'PDF file is required.' });
    }

    const { title, description } = req.body;

    const doc = await Document.create({
      title: title || req.file.originalname,
      description,
      owner: req.user._id,
      originalFile: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        path: req.file.path,
        size: req.file.size,
        mimetype: req.file.mimetype
      },
      status: 'draft'
    });

    await createAuditLog({
      documentId: doc._id,
      action: 'document_created',
      actor: req.user.email,
      metadata: { title: doc.title, fileSize: req.file.size },
      req
    });

    res.status(201).json({ message: 'Document uploaded!', document: doc });
  } catch (error) {
    next(error);
  }
});

// GET /api/documents/:id - Get single document
router.get('/:id', protect, async (req, res, next) => {
  try {
    const doc = await Document.findOne({
      _id: req.params.id,
      owner: req.user._id
    }).populate('owner', 'name email');

    if (!doc) {
      return res.status(404).json({ message: 'Document not found.' });
    }

    await createAuditLog({
      documentId: doc._id,
      action: 'document_viewed',
      actor: req.user.email,
      req
    });

    res.json({ document: doc });
  } catch (error) {
    next(error);
  }
});


// POST /api/documents/:id/add-signer - Add a single signer safely with token
router.post('/:id/add-signer', protect, async (req, res, next) => {
  try {
    const { email, name } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required.' });

    const doc = await Document.findOne({ _id: req.params.id, owner: req.user._id });
    if (!doc) return res.status(404).json({ message: 'Document not found.' });

    // Check duplicate
    if (doc.signers.some(s => s.email === email.toLowerCase())) {
      return res.status(409).json({ message: 'Signer already added.' });
    }

    const { v4: uuidv4 } = require('uuid');

    // Push directly — Mongoose subdoc, but we set token explicitly to be safe
    doc.signers.push({
      email: email.toLowerCase(),
      name: name || undefined,
      status: 'pending',
      token: uuidv4(),
      tokenExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    await doc.save();
    res.json({ message: 'Signer added!', document: doc });
  } catch (error) {
    next(error);
  }
});

// POST /api/documents/:id/remove-signer - Remove a signer by email
router.post('/:id/remove-signer', protect, async (req, res, next) => {
  try {
    const { email } = req.body;
    const doc = await Document.findOne({ _id: req.params.id, owner: req.user._id });
    if (!doc) return res.status(404).json({ message: 'Document not found.' });

    doc.signers = doc.signers.filter(s => s.email !== email.toLowerCase());
    await doc.save();
    res.json({ message: 'Signer removed.', document: doc });
  } catch (error) {
    next(error);
  }
});

// PUT /api/documents/:id - Update document (title, description, signers, fields)
router.put('/:id', protect, async (req, res, next) => {
  try {
    const { title, description, signers, signatureFields, expiresAt } = req.body;

    const doc = await Document.findOne({ _id: req.params.id, owner: req.user._id });
    if (!doc) return res.status(404).json({ message: 'Document not found.' });

    if (title) doc.title = title;
    if (description !== undefined) doc.description = description;
    if (signatureFields) doc.signatureFields = signatureFields;
    if (expiresAt) doc.expiresAt = expiresAt;
    
    // Merge signers — preserve existing token/status, generate token for new signers
    if (signers) {
      const { v4: uuidv4 } = require('uuid');
      const updatedSigners = signers.map(newSigner => {
        const existing = doc.signers.find(s => s.email === newSigner.email);
        if (existing) {
          // Preserve token, status, signedAt etc for existing signers
          return { ...existing.toObject(), ...newSigner };
        } else {
          // NEW signer — must generate token explicitly
          // (plain object spread bypasses Mongoose schema default: uuidv4)
          return {
            email: newSigner.email,
            name: newSigner.name || undefined,
            status: 'pending',
            token: uuidv4(),
            tokenExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          };
        }
      });
      doc.signers = updatedSigners;
    }

    await doc.save();
    res.json({ message: 'Document updated!', document: doc });
  } catch (error) {
    next(error);
  }
});

// POST /api/documents/:id/send - Send document to signers
router.post('/:id/send', protect, async (req, res, next) => {
  try {
    const doc = await Document.findOne({ _id: req.params.id, owner: req.user._id });
    if (!doc) return res.status(404).json({ message: 'Document not found.' });

    if (doc.signers.length === 0) {
      return res.status(400).json({ message: 'Add at least one signer before sending.' });
    }

    doc.status = 'pending';
    const { v4: uuidv4 } = require('uuid');
    doc.signers.forEach(signer => {
      // Safety net: ensure every signer has a valid token (in case schema default was missed)
      if (!signer.token) {
        signer.token = uuidv4();
        signer.tokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      }
      if (signer.status === 'pending') {
        // In production: send actual email with signing link
        console.log(`📧 Signing link for ${signer.email}: ${process.env.CLIENT_URL}/sign/${signer.token}`);
      }
    });

    await doc.save();

    await createAuditLog({
      documentId: doc._id,
      action: 'document_sent',
      actor: req.user.email,
      metadata: { signers: doc.signers.map(s => s.email) },
      req
    });

    res.json({
      message: 'Document sent to signers!',
      document: doc,
      signingLinks: doc.signers.map(s => ({
        email: s.email,
        link: `${process.env.CLIENT_URL}/sign/${s.token}`
      }))
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/documents/:id - Delete document
router.delete('/:id', protect, async (req, res, next) => {
  try {
    const doc = await Document.findOne({ _id: req.params.id, owner: req.user._id });
    if (!doc) return res.status(404).json({ message: 'Document not found.' });

    // Remove uploaded files
    if (doc.originalFile?.path && fs.existsSync(doc.originalFile.path)) {
      fs.unlinkSync(doc.originalFile.path);
    }
    if (doc.signedFile?.path && fs.existsSync(doc.signedFile.path)) {
      fs.unlinkSync(doc.signedFile.path);
    }

    await doc.deleteOne();
    res.json({ message: 'Document deleted.' });
  } catch (error) {
    next(error);
  }
});

// GET /api/documents/:id/download - Download signed PDF
router.get('/:id/download', protect, async (req, res, next) => {
  try {
    const doc = await Document.findOne({ _id: req.params.id, owner: req.user._id });
    if (!doc) return res.status(404).json({ message: 'Document not found.' });

    const filePath = doc.signedFile?.path || doc.originalFile?.path;
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found.' });
    }

    await createAuditLog({
      documentId: doc._id,
      action: 'document_downloaded',
      actor: req.user.email,
      req
    });

    res.download(filePath, `signed-${doc.title}.pdf`);
  } catch (error) {
    next(error);
  }
});

module.exports = router;