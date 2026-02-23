import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const STATUS_FILTERS = ['all', 'draft', 'pending', 'partially_signed', 'signed', 'rejected'];

export default function DashboardPage() {
  const [docs, setDocs] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    try {
      const [docsRes, statsRes] = await Promise.all([
        api.get(`/documents?status=${activeFilter}&search=${search}`),
        api.get('/documents/stats')
      ]);
      setDocs(docsRes.data.documents);
      setStats(statsRes.data);
    } catch {
      toast.error('Failed to load documents.');
    } finally {
      setLoading(false);
    }
  }, [activeFilter, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this document? This cannot be undone.')) return;
    try {
      await api.delete(`/documents/${id}`);
      toast.success('Document deleted.');
      fetchData();
    } catch {
      toast.error('Delete failed.');
    }
  };

  const statusLabel = {
    draft: 'Draft',
    pending: 'Pending',
    partially_signed: 'Partially Signed',
    signed: 'Signed',
    rejected: 'Rejected',
    expired: 'Expired'
  };

  return (
    <div>
      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card accent">
          <div className="stat-value">{stats.total ?? '—'}</div>
          <div className="stat-label">Total Documents</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-value">{stats.pending ?? '—'}</div>
          <div className="stat-label">Awaiting Signature</div>
        </div>
        <div className="stat-card success">
          <div className="stat-value">{stats.signed ?? '—'}</div>
          <div className="stat-label">Fully Signed</div>
        </div>
        <div className="stat-card danger">
          <div className="stat-value">{stats.rejected ?? '—'}</div>
          <div className="stat-label">Rejected</div>
        </div>
      </div>

      {/* Controls */}
      <div className="page-header">
        <h2>📄 My Documents</h2>
        <div style={{ display: 'flex', gap: 12 }}>
          <input
            className="form-control"
            style={{ width: 240 }}
            placeholder="Search documents..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <Link to="/upload" className="btn btn-primary">
            ↑ Upload New
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="tabs" style={{ flexWrap: 'wrap' }}>
        {STATUS_FILTERS.map(f => (
          <button
            key={f}
            className={`tab ${activeFilter === f ? 'active' : ''}`}
            onClick={() => setActiveFilter(f)}
          >
            {f === 'all' ? 'All' : statusLabel[f] || f}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '0 auto' }} />
          </div>
        ) : docs.length === 0 ? (
          <div style={{ padding: 64, textAlign: 'center', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📄</div>
            <p style={{ marginBottom: 16 }}>No documents found.</p>
            <Link to="/upload" className="btn btn-primary">Upload your first document</Link>
          </div>
        ) : (
          <table className="doc-table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Status</th>
                <th>Signers</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {docs.map(doc => (
                <tr
                  key={doc._id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/documents/${doc._id}`)}
                >
                  <td>
                    <div style={{ fontWeight: 500 }}>{doc.title}</div>
                    {doc.description && (
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                        {doc.description.slice(0, 60)}{doc.description.length > 60 ? '...' : ''}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={`badge badge-${doc.status}`}>
                      {statusLabel[doc.status] || doc.status}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      {doc.signers?.filter(s => s.status === 'signed').length ?? 0}/{doc.signers?.length ?? 0} signed
                    </span>
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    {format(new Date(doc.createdAt), 'MMM d, yyyy')}
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => navigate(`/documents/${doc._id}`)}
                      >
                        View
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={(e) => handleDelete(doc._id, e)}
                      >
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
