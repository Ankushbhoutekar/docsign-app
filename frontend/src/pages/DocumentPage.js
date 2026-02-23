import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const STATUS_MAP = {
  draft: { label: 'Draft', cls: 'badge-draft' },
  pending: { label: 'Pending', cls: 'badge-pending' },
  partially_signed: { label: 'Partially Signed', cls: 'badge-partially_signed' },
  signed: { label: 'Signed', cls: 'badge-signed' },
  rejected: { label: 'Rejected', cls: 'badge-rejected' }
};

const ACTION_ICONS = {
  document_created: '📝', document_viewed: '👁', document_sent: '📧',
  signer_viewed: '👀', signer_signed: '✅', signer_rejected: '❌',
  signed_pdf_generated: '📄', document_downloaded: '⬇', link_shared: '🔗'
};

export default function DocumentPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [doc, setDoc] = useState(null);
  const [audit, setAudit] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [newSignerEmail, setNewSignerEmail] = useState('');
  const [sending, setSending] = useState(false);
  // Store signing links from send response (they include tokens)
  const [signingLinks, setSigningLinks] = useState([]);

  const fetchDoc = async () => {
    try {
      const [docRes, auditRes] = await Promise.all([
        api.get(`/documents/${id}`),
        api.get(`/audit/${id}`)
      ]);
      setDoc(docRes.data.document);
      setAudit(auditRes.data.logs);
    } catch {
      toast.error('Failed to load document.');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDoc(); }, [id]);

  const addSigner = async () => {
    if (!newSignerEmail.trim()) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newSignerEmail.trim())) {
      return toast.error('Enter a valid email address.');
    }
    if (doc.signers.some(s => s.email === newSignerEmail.trim())) {
      return toast.error('This signer is already added.');
    }

    // FIXED: Only send new signer email — backend handles token generation
    // Do NOT send existing signers (that was causing token to be stripped)
    try {
      const res = await api.post(`/documents/${id}/add-signer`, {
        email: newSignerEmail.trim()
      });
      setDoc(res.data.document);
      setNewSignerEmail('');
      toast.success('Signer added!');
    } catch {
      toast.error('Failed to add signer.');
    }
  };

  const removeSigner = async (email) => {
    try {
      const res = await api.post(`/documents/${id}/remove-signer`, { email });
      setDoc(res.data.document);
      toast.success('Signer removed.');
    } catch {
      toast.error('Failed to remove signer.');
    }
  };

  const sendDocument = async () => {
    if (doc.signers.length === 0) return toast.error('Add at least one signer first.');
    setSending(true);
    try {
      const res = await api.post(`/documents/${id}/send`);
      // Store signing links — these contain the actual tokens from backend
      setSigningLinks(res.data.signingLinks || []);
      toast.success('Document sent! Signing links are ready below 👇', { duration: 6000 });
      fetchDoc();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Send failed.');
    } finally {
      setSending(false);
    }
  };

  const copyLink = (link) => {
    navigator.clipboard.writeText(link);
    toast.success('Signing link copied! 🔗');
  };

  // Get link for a signer from stored signingLinks
  const getLinkForSigner = (email) => {
    const found = signingLinks.find(l => l.email === email);
    return found ? found.link : null;
  };

  const generateSignedPDF = async () => {
    try {
      await api.post(`/signatures/generate/${id}`);
      toast.success('Signed PDF generated!');
      fetchDoc();
    } catch {
      toast.error('PDF generation failed.');
    }
  };

  const downloadDoc = async () => {
    try {
      const res = await api.get(`/documents/${id}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `signed-${doc.title}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Download failed.');
    }
  };

  if (loading) return <div style={{ padding: 48, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>;
  if (!doc) return null;

  const status = STATUS_MAP[doc.status] || { label: doc.status, cls: 'badge-draft' };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <button className="btn btn-secondary btn-sm" style={{ marginBottom: 8 }} onClick={() => navigate('/dashboard')}>
            ← Back
          </button>
          <h2 style={{ marginTop: 4 }}>{doc.title}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
            <span className={`badge ${status.cls}`}>{status.label}</span>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Created {format(new Date(doc.createdAt), 'MMM d, yyyy')}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {doc.status === 'draft' && (
            <button className="btn btn-primary" onClick={sendDocument} disabled={sending || doc.signers.length === 0}>
              {sending ? 'Sending...' : '📧 Send for Signing'}
            </button>
          )}
          {doc.status === 'pending' && (
            <button className="btn btn-secondary" onClick={sendDocument} disabled={sending}>
              {sending ? '...' : '🔄 Resend Links'}
            </button>
          )}
          {(doc.status === 'signed' || doc.status === 'partially_signed') && (
            <>
              <button className="btn btn-secondary" onClick={generateSignedPDF}>♻ Regenerate PDF</button>
              <button className="btn btn-success" onClick={downloadDoc}>⬇ Download Signed PDF</button>
            </>
          )}
        </div>
      </div>

      {/* Signing Links Banner — shown right after send */}
      {signingLinks.length > 0 && (
        <div style={{
          background: 'rgba(34,197,94,0.1)', border: '1px solid var(--success)',
          borderRadius: 10, padding: 20, marginBottom: 20
        }}>
          <div style={{ fontWeight: 600, color: 'var(--success)', marginBottom: 12, fontSize: 15 }}>
            ✅ Document Sent! Copy signing links below and share with signers:
          </div>
          {signingLinks.map(link => (
            <div key={link.email} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'var(--bg-secondary)', borderRadius: 8, padding: '10px 14px', marginBottom: 8
            }}>
              <div>
                <div style={{ fontWeight: 500, fontSize: 14 }}>{link.email}</div>
                <div style={{
                  fontSize: 12, color: 'var(--accent)', fontFamily: 'monospace',
                  marginTop: 4, wordBreak: 'break-all'
                }}>
                  {link.link}
                </div>
              </div>
              <button
                className="btn btn-primary btn-sm"
                style={{ marginLeft: 16, flexShrink: 0 }}
                onClick={() => copyLink(link.link)}
              >
                🔗 Copy
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        {['overview', 'signers', 'audit'].map(t => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'overview' ? '📋 Overview' : t === 'signers' ? '👥 Signers' : '📜 Audit Trail'}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div className="card">
            <h3 style={{ marginBottom: 16, fontSize: 15 }}>Document Info</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                ['Title', doc.title],
                ['Description', doc.description || '—'],
                ['Status', <span className={`badge ${status.cls}`}>{status.label}</span>],
                ['Expires', format(new Date(doc.expiresAt), 'MMM d, yyyy')],
                ['File Size', doc.originalFile?.size ? `${(doc.originalFile.size / 1024).toFixed(1)} KB` : '—'],
              ].map(([key, val]) => (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{key}</span>
                  <span>{val}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <h3 style={{ marginBottom: 16, fontSize: 15 }}>Signing Progress</h3>
            {doc.signers.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>No signers added yet.</p>
            ) : (
              <div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Progress</span>
                    <span>{doc.signers.filter(s => s.status === 'signed').length}/{doc.signers.length} signed</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--bg-primary)', borderRadius: 3 }}>
                    <div style={{
                      height: '100%', borderRadius: 3, background: 'var(--success)',
                      width: `${(doc.signers.filter(s => s.status === 'signed').length / doc.signers.length) * 100}%`,
                      transition: 'width 0.3s'
                    }} />
                  </div>
                </div>
                {doc.signers.map(s => (
                  <div key={s.email} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, fontSize: 14 }}>
                    <span>{s.email}</span>
                    <span className={`badge badge-${s.status}`}>{s.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Signers Tab */}
      {tab === 'signers' && (
        <div>
          {(doc.status === 'draft' || doc.status === 'pending') && (
            <div className="card" style={{ marginBottom: 20 }}>
              <h3 style={{ marginBottom: 16, fontSize: 15 }}>Add Signer</h3>
              <div style={{ display: 'flex', gap: 12 }}>
                <input
                  type="email"
                  className="form-control"
                  placeholder="signer@email.com"
                  value={newSignerEmail}
                  onChange={e => setNewSignerEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addSigner()}
                />
                <button className="btn btn-primary" onClick={addSigner}>+ Add</button>
              </div>
            </div>
          )}

          {doc.status === 'draft' && doc.signers.length > 0 && (
            <div style={{
              background: 'rgba(59,130,246,0.08)', border: '1px solid var(--accent)',
              borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: 'var(--accent)'
            }}>
              💡 Signers added! Now click <strong>"Send for Signing"</strong> button above — signing links will appear here.
            </div>
          )}

          {doc.signers.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 48, color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
              <p>No signers added yet. Add an email above.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {doc.signers.map(signer => {
                const signerLink = getLinkForSigner(signer.email);
                return (
                  <div key={signer.email} className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 500, marginBottom: 4 }}>{signer.name || signer.email}</div>
                        {signer.name && <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>{signer.email}</div>}
                        <span className={`badge badge-${signer.status}`}>{signer.status}</span>
                        {signer.signedAt && (
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 8 }}>
                            Signed {format(new Date(signer.signedAt), 'MMM d, yyyy HH:mm')}
                          </span>
                        )}
                        {signer.rejectionReason && (
                          <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>
                            Reason: {signer.rejectionReason}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {signerLink && (
                          <button className="btn btn-primary btn-sm" onClick={() => copyLink(signerLink)}>
                            🔗 Copy Link
                          </button>
                        )}
                        {doc.status === 'draft' && (
                          <button className="btn btn-danger btn-sm" onClick={() => removeSigner(signer.email)}>✕ Remove</button>
                        )}
                      </div>
                    </div>

                    {/* Show link inline if available */}
                    {signerLink && (
                      <div style={{
                        marginTop: 12, padding: '8px 12px',
                        background: 'var(--bg-primary)', borderRadius: 6,
                        fontSize: 12, color: 'var(--accent)', fontFamily: 'monospace',
                        wordBreak: 'break-all'
                      }}>
                        {signerLink}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Resend hint */}
          {doc.status === 'pending' && signingLinks.length === 0 && (
            <div style={{
              marginTop: 16, padding: '12px 16px',
              background: 'rgba(245,158,11,0.08)', border: '1px solid var(--warning)',
              borderRadius: 8, fontSize: 13, color: 'var(--warning)'
            }}>
              ⚠️ Page refresh se signing links reset ho jaate hain. Links dobara dekhne ke liye <strong>"Resend Links"</strong> button click karo.
            </div>
          )}
        </div>
      )}

      {/* Audit Trail Tab */}
      {tab === 'audit' && (
        <div className="card">
          <h3 style={{ marginBottom: 20, fontSize: 15 }}>📜 Audit Trail</h3>
          {audit.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>No events yet.</p>
          ) : (
            <ul className="audit-list">
              {audit.map((log, i) => (
                <li key={i} className="audit-item">
                  <div className="audit-dot" />
                  <div style={{ flex: 1 }}>
                    <div style={{ marginBottom: 4 }}>
                      <span style={{ marginRight: 8 }}>{ACTION_ICONS[log.action] || '📌'}</span>
                      <strong>{log.action.replace(/_/g, ' ')}</strong>
                      <span style={{ color: 'var(--text-secondary)', marginLeft: 8 }}>by {log.actor}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {format(new Date(log.timestamp), 'MMM d, yyyy HH:mm:ss')}
                      {log.ipAddress && log.ipAddress !== 'unknown' && ` · IP: ${log.ipAddress}`}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
