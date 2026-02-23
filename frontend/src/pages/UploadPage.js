import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function UploadPage() {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();
  const navigate = useNavigate();

  const handleFile = (f) => {
    if (!f) return;
    if (f.type !== 'application/pdf') {
      toast.error('Only PDF files are supported.');
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      toast.error('File must be under 20MB.');
      return;
    }
    setFile(f);
    if (!title) setTitle(f.name.replace('.pdf', ''));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return toast.error('Please select a PDF file.');
    if (!title.trim()) return toast.error('Please enter a document title.');

    setUploading(true);
    const formData = new FormData();
    formData.append('document', file);
    formData.append('title', title.trim());
    formData.append('description', description.trim());

    try {
      const res = await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Document uploaded successfully!');
      navigate(`/documents/${res.data.document._id}`);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div className="page-header">
        <h2>📤 Upload Document</h2>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Drop zone */}
        <div
          className={`drop-zone ${dragging ? 'active' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current.click()}
        >
          <input
            type="file"
            ref={fileRef}
            accept="application/pdf"
            onChange={e => handleFile(e.target.files[0])}
          />
          {file ? (
            <div>
              <div style={{ fontSize: 40, marginBottom: 8 }}>📄</div>
              <div style={{ fontWeight: 500, marginBottom: 4 }}>{file.name}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ marginTop: 12 }}
                onClick={e => { e.stopPropagation(); setFile(null); setTitle(''); }}
              >
                Change file
              </button>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 48, marginBottom: 12 }}>☁</div>
              <div style={{ fontWeight: 500, marginBottom: 8 }}>Drop your PDF here, or click to browse</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>PDF only · Max 20MB</div>
            </div>
          )}
        </div>

        {/* Fields */}
        <div className="card" style={{ marginTop: 20 }}>
          <div className="form-group">
            <label>Document Title *</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Employment Agreement Q1 2025"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Description (optional)</label>
            <textarea
              className="form-control"
              placeholder="Brief description of the document..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/dashboard')}
          >
            Cancel
          </button>
          <button type="submit" className="btn btn-primary btn-lg" disabled={uploading || !file}>
            {uploading ? 'Uploading...' : '↑ Upload & Continue →'}
          </button>
        </div>
      </form>
    </div>
  );
}
