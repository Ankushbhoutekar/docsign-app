import React, { useState, useRef } from 'react';
import { useAuth, api } from '../context/AuthContext';
import toast from 'react-hot-toast';
import SignatureCanvas from 'react-signature-canvas';

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);
  const [savingSig, setSavingSig] = useState(false);
  const sigPad = useRef();

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.put('/auth/profile', { name });
      updateUser(res.data.user);
      toast.success('Profile updated!');
    } catch {
      toast.error('Update failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSignature = async () => {
    if (sigPad.current?.isEmpty()) return toast.error('Please draw your signature first.');
    setSavingSig(true);
    try {
      const signatureImage = sigPad.current.toDataURL('image/png');
      const res = await api.put('/auth/signature', { signatureImage });
      updateUser(res.data.user);
      toast.success('Signature saved!');
    } catch {
      toast.error('Failed to save signature.');
    } finally {
      setSavingSig(false);
    }
  };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div className="page-header">
        <h2>👤 Profile & Signature</h2>
      </div>

      {/* Profile */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 20, fontSize: 15 }}>Account Information</h3>
        <form onSubmit={handleSaveProfile}>
          <div className="form-group">
            <label>Full Name</label>
            <input
              type="text"
              className="form-control"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              className="form-control"
              value={user?.email}
              disabled
              style={{ opacity: 0.6 }}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>

      {/* Saved Signature */}
      <div className="card">
        <h3 style={{ marginBottom: 6, fontSize: 15 }}>Your Signature</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20 }}>
          Draw your signature below. This will be used when signing documents.
        </p>

        {user?.signatureImage && (
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>Current saved signature:</p>
            <div style={{ background: 'white', padding: 12, borderRadius: 8, display: 'inline-block' }}>
              <img src={user.signatureImage} alt="Saved signature" style={{ maxHeight: 80 }} />
            </div>
          </div>
        )}

        <div className="sig-pad-wrapper" style={{ marginBottom: 12 }}>
          <SignatureCanvas
            ref={sigPad}
            penColor="#1a1aff"
            canvasProps={{ width: 500, height: 150 }}
          />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={() => sigPad.current?.clear()}>Clear</button>
          <button className="btn btn-primary" onClick={handleSaveSignature} disabled={savingSig}>
            {savingSig ? 'Saving...' : '💾 Save Signature'}
          </button>
        </div>
      </div>
    </div>
  );
}
