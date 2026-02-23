# ✍ DocuSign Pro — Digital Document Signature App (MERN Stack)

A production-ready, enterprise-grade digital signature platform built with MongoDB, Express.js, React, and Node.js. Mirrors real-world platforms like DocuSign and Adobe Sign.

---

## 📁 Project Structure

```
docsign-app/
├── backend/                    # Express.js API
│   ├── models/
│   │   ├── User.js             # User schema + bcrypt
│   │   ├── Document.js         # Document + Signer + SignatureField schemas
│   │   └── AuditLog.js         # Immutable audit trail
│   ├── routes/
│   │   ├── auth.js             # Register, Login, Profile, Save Signature
│   │   ├── documents.js        # Upload, CRUD, Send, Download
│   │   ├── signatures.js       # Public signing, reject, PDF generation
│   │   └── audit.js            # Fetch audit trail
│   ├── middleware/
│   │   ├── auth.js             # JWT protect middleware
│   │   └── upload.js           # Multer PDF upload handler
│   ├── utils/
│   │   ├── pdfUtils.js         # pdf-lib signature embedding + audit page
│   │   └── auditHelper.js      # createAuditLog() helper
│   ├── uploads/                # Raw uploaded PDFs (auto-created)
│   ├── signed/                 # Generated signed PDFs (auto-created)
│   ├── .env.example            # Copy to .env and fill in values
│   ├── server.js               # Main Express app
│   └── package.json
│
├── frontend/                   # React App
│   ├── public/index.html
│   ├── src/
│   │   ├── context/
│   │   │   └── AuthContext.js  # JWT auth state + axios instance
│   │   ├── components/
│   │   │   └── Layout.js       # Collapsible sidebar layout
│   │   ├── pages/
│   │   │   ├── LoginPage.js
│   │   │   ├── RegisterPage.js
│   │   │   ├── DashboardPage.js   # Stats + document list + filters
│   │   │   ├── UploadPage.js      # Drag-and-drop PDF upload
│   │   │   ├── DocumentPage.js    # Signer management + audit trail
│   │   │   ├── SigningPage.js     # Public signing (draw/type signature)
│   │   │   └── ProfilePage.js     # Profile + saved signature pad
│   │   ├── App.js              # Router with private routes
│   │   ├── index.js
│   │   └── index.css           # Global dark theme styles
│   └── package.json
│
├── package.json                # Root scripts for running both
├── .gitignore
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js v16+
- MongoDB (local or Atlas)

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd docsign-app

# Install all dependencies
npm install         # root (for concurrently)
cd backend && npm install
cd ../frontend && npm install
```

### 2. Configure Environment

```bash
cd backend
cp .env.example .env
```

Edit `.env`:
```
PORT=5000
MONGO_URI=mongodb://localhost:27017/docsign
JWT_SECRET=your_super_secret_key_min_32_chars
CLIENT_URL=http://localhost:3000
```

### 3. Run Development

```bash
# From root — runs both backend and frontend
npm run dev

# OR run separately:
cd backend && npm run dev      # Backend on :5000
cd frontend && npm start       # Frontend on :3000
```

### 4. Open App

Navigate to **http://localhost:3000**

---

## 🔑 Core Workflows

### 1. Document Owner (You)
1. Register/Login
2. Upload a PDF document
3. Add signer emails
4. Click "Send for Signing"
5. Copy signing links and share with signers
6. Track status on Dashboard (Pending → Signed)
7. Download signed PDF with embedded audit trail

### 2. Signer (External Person)
1. Receives signing link: `/sign/:token`
2. Views document details
3. Draws or types their signature
4. Clicks "Sign Document" or "Decline"
5. IP, timestamp, and user-agent are logged

---

## 🔐 Security Features

| Feature | Implementation |
|---------|---------------|
| Auth | JWT (7-day tokens, Bearer header) |
| Passwords | bcryptjs (12 salt rounds) |
| File Access | Owner-only document access |
| Signing Links | UUID tokens per signer (7-day expiry) |
| PDF Storage | Server-side, not publicly accessible |
| Audit Trail | Immutable MongoDB records per event |

---

## 📡 API Reference

### Auth Endpoints
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login, get JWT |
| GET | `/api/auth/me` | Get current user |
| PUT | `/api/auth/signature` | Save signature image |
| PUT | `/api/auth/profile` | Update name |

### Document Endpoints (Protected)
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/documents` | List user's documents |
| GET | `/api/documents/stats` | Dashboard stats |
| POST | `/api/documents/upload` | Upload PDF |
| GET | `/api/documents/:id` | Get document details |
| PUT | `/api/documents/:id` | Update (signers, fields, title) |
| POST | `/api/documents/:id/send` | Send to signers |
| DELETE | `/api/documents/:id` | Delete document |
| GET | `/api/documents/:id/download` | Download signed PDF |

### Signature Endpoints (Public)
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/signatures/public/:token` | Signer views document |
| POST | `/api/signatures/sign/:token` | Submit signature |
| POST | `/api/signatures/reject/:token` | Reject signing |
| POST | `/api/signatures/generate/:id` | Manually generate signed PDF |

### Audit Endpoints (Protected)
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/audit/:documentId` | Get audit trail |

---

## 📄 Document Lifecycle

```
Upload → Draft → Pending (sent) → Partially Signed → Signed ✅
                                                    → Rejected ❌
```

---

## 🏗 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, React Router v6, react-signature-canvas |
| Styling | Pure CSS with CSS variables (dark theme) |
| HTTP Client | Axios with JWT interceptor |
| Backend | Node.js + Express.js |
| Database | MongoDB + Mongoose |
| Auth | JWT + bcryptjs |
| File Upload | Multer (disk storage) |
| PDF Processing | pdf-lib (signature embedding, audit page) |
| Notifications | react-hot-toast |

---

## 🔮 Production Enhancements

To take this to production, add:

- **Email sending**: Nodemailer / SendGrid for signing notifications
- **PDF rendering**: react-pdf for actual PDF preview in browser  
- **Drag-and-drop signature fields**: fabric.js or PDF.js canvas overlay
- **Email verification**: Token-based account confirmation
- **S3 storage**: AWS S3 or Cloudflare R2 for file storage
- **Rate limiting**: express-rate-limit on public endpoints
- **HTTPS**: SSL certificate via Let's Encrypt
- **Docker**: Containerize for deployment

---

## 📊 Key Design Patterns

1. **Token-based signing links** — UUID tokens stored per signer, expire in 7 days
2. **Audit logging middleware** — Every meaningful event creates an immutable AuditLog record
3. **Document status machine** — Auto-updates based on all signers' statuses
4. **Server-side PDF generation** — pdf-lib embeds signatures + generates audit trail page
5. **Protected file serving** — Files served via Express static, not public CDN

---

*Built to demonstrate enterprise SaaS architecture: JWT auth, document lifecycle management, PDF processing, tokenized access, and audit trails.*
