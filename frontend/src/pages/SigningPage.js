import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import SignatureCanvas from 'react-signature-canvas';

const publicApi = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
});

export default function SigningPage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [step, setStep] = useState('view'); // view | sign | done
  const [name, setName] = useState('');
  const [sigMode, setSigMode] = useState('draw'); // draw | type
  const [typedSig, setTypedSig] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const sigPad = useRef();

  useEffect(() => {
    publicApi.get(`/signatures/public/${token}`)
      .then(res => {
        setData(res.data);
        setName(res.data.signer.name || '');
      })
      .catch(err => setError(err?.response?.data?.message || 'Invalid signing link.'))
      .finally(() => setLoading(false));
  }, [token]);

  const getSignatureData = () => {
    if (sigMode === 'type') {
      if (!typedSig.trim()) return null;
      // Create canvas from typed name
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 80;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = 'italic 36px Georgia';
      ctx.fillStyle = '#1a1aff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(typedSig, 200, 40);
      return canvas.toDataURL('image/png');
    } else {
      if (sigPad.current?.isEmpty()) return null;
      return sigPad.current.toDataURL('image/png');
    }
  };

  const handleSign = async () => {
    const sigData = getSignatureData();
    if (!sigData) return toast.error('Please provide your signature.');
    if (!name.trim()) return toast.error('Please enter your full name.');

    setSubmitting(true);
    try {
      await publicApi.post(`/signatures/sign/${token}`, { signatureData: sigData, name: name.trim() });
      setStep('done');
      toast.success('Document signed successfully!');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Signing failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return toast.error('Please provide a reason for rejection.');
    setSubmitting(true);
    try {
      await publicApi.post(`/signatures/reject/${token}`, { reason: rejectReason });
      setStep('done');
      toast.success('Document rejected.');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Rejection failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#0f172a' }}>
      <div className="spinner" />
    </div>
  );

  if (error) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#0f172a' }}>
      <div className="card" style={{ textAlign: 'center', maxWidth: 420 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <h2 style={{ marginBottom: 8 }}>Link Error</h2>
        <p style={{ color: 'var(--text-secondary)' }}>{error}</p>
      </div>
    </div>
  );

  if (step === 'done') return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#0f172a' }}>
      <div className="card" style={{ textAlign: 'center', maxWidth: 420 }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>{rejecting ? '❌' : '✅'}</div>
        <h2 style={{ marginBottom: 12 }}>{rejecting ? 'Document Rejected' : 'Document Signed!'}</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          {rejecting
            ? 'You have rejected this document. The sender has been notified.'
            : 'Your signature has been recorded. A copy will be sent to all parties.'
          }
        </p>
      </div>
    </div>
  );

  const { document: doc, signer } = data;
  const alreadySigned = signer.status === 'signed';
  const alreadyRejected = signer.status === 'rejected';

  return (
    <div className="signing-wrapper">
      {/* Header */}
      <div className="signing-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ background: 'var(--accent)', color: 'white', padding: '6px 10px', borderRadius: 8 }}>✍</span>
          <strong>DocuSign Pro</strong>
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          Signing as <strong style={{ color: 'var(--text-primary)' }}>{signer.email}</strong>
        </div>
      </div>

      <div className="signing-body">
        {/* Sidebar */}
        <div className="signing-sidebar">
          <h3 style={{ marginBottom: 4, fontSize: 16 }}>{doc.title}</h3>
          {doc.description && <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>{doc.description}</p>}

          <div style={{ height: 1, background: 'var(--border)', margin: '16px 0' }} />

          {alreadySigned ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
              <p style={{ color: 'var(--success)', fontWeight: 500 }}>You've already signed this document.</p>
            </div>
          ) : alreadyRejected ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>❌</div>
              <p style={{ color: 'var(--danger)', fontWeight: 500 }}>You've rejected this document.</p>
            </div>
          ) : (
            <>
              <div className="form-group">
                <label>Your Full Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="John Smith"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8, display: 'block' }}>Signature Method</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['draw', 'type'].map(m => (
                    <button
                      key={m}
                      className={`btn btn-sm ${sigMode === m ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setSigMode(m)}
                    >
                      {m === 'draw' ? '✏️ Draw' : '⌨️ Type'}
                    </button>
                  ))}
                </div>
              </div>

              {sigMode === 'draw' ? (
                <div>
                  <div className="sig-pad-wrapper" style={{ marginBottom: 8 }}>
                    <SignatureCanvas
                      ref={sigPad}
                      penColor="#1a1aff"
                      canvasProps={{ width: 270, height: 130, className: 'sig-canvas' }}
                    />
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={() => sigPad.current?.clear()}>
                    Clear
                  </button>
                </div>
              ) : (
                <div className="form-group">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Type your signature..."
                    value={typedSig}
                    onChange={e => setTypedSig(e.target.value)}
                    style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 20, color: '#1a1aff' }}
                  />
                </div>
              )}

              <div style={{ height: 1, background: 'var(--border)', margin: '16px 0' }} />

              <button
                className="btn btn-success"
                style={{ width: '100%', marginBottom: 10 }}
                onClick={handleSign}
                disabled={submitting}
              >
                {submitting ? 'Signing...' : '✅ Sign Document'}
              </button>

              {!rejecting ? (
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ width: '100%', color: 'var(--danger)', borderColor: 'var(--danger)' }}
                  onClick={() => setRejecting(true)}
                >
                  Decline / Reject
                </button>
              ) : (
                <div>
                  <div className="form-group" style={{ marginBottom: 8 }}>
                    <label>Reason for rejection *</label>
                    <textarea
                      className="form-control"
                      rows={2}
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      placeholder="I reject because..."
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => setRejecting(false)}>Cancel</button>
                    <button className="btn btn-danger btn-sm" onClick={handleReject} disabled={submitting}>
                      {submitting ? '...' : 'Confirm Reject'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* PDF preview area */}
        <div className="signing-canvas-area">
          <div className="card" style={{ textAlign: 'center', padding: 48 }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>📄</div>
            <h3 style={{ marginBottom: 8 }}>{doc.title}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>
              PDF preview — In production, this area renders the actual PDF using react-pdf
            </p>
            <div style={{ padding: 24, background: 'var(--bg-primary)', borderRadius: 8, textAlign: 'left', maxWidth: 480, margin: '0 auto' }}>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                <strong style={{ color: 'var(--text-primary)' }}>Document:</strong> {doc.title}<br />
                <strong style={{ color: 'var(--text-primary)' }}>Expires:</strong> {new Date(doc.expiresAt).toLocaleDateString()}<br />
                <strong style={{ color: 'var(--text-primary)' }}>Your status:</strong>{' '}
                <span className={`badge badge-${signer.status}`}>{signer.status}</span>
              </p>
            </div>
            {doc.signatureFields?.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>Signature fields assigned to you:</p>
                {doc.signatureFields.map((field, i) => (
                  <div key={i} style={{
                    display: 'inline-block',
                    margin: 8,
                    padding: '16px 32px',
                    border: '2px dashed var(--accent)',
                    borderRadius: 6,
                    color: 'var(--accent)',
                    fontSize: 13
                  }}>
                    ✍ {field.label || 'Signature'} — Page {field.page}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
