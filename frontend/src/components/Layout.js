import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navLinks = [
  { to: '/dashboard', label: 'Dashboard', icon: '⊞' },
  { to: '/upload', label: 'Upload Document', icon: '↑' },
  { to: '/profile', label: 'Profile & Signature', icon: '✎' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside style={{
        width: collapsed ? 64 : 240,
        background: 'var(--bg-card)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s',
        flexShrink: 0
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ background: 'var(--accent)', color: 'white', padding: '6px 10px', borderRadius: 8, fontSize: 16, flexShrink: 0 }}>✍</span>
          {!collapsed && <span style={{ fontWeight: 700, fontSize: 15 }}>DocuSign Pro</span>}
        </div>

        {/* Nav links */}
        <nav style={{ flex: 1, padding: '12px 8px' }}>
          {navLinks.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 8,
                marginBottom: 4,
                color: isActive ? 'white' : 'var(--text-secondary)',
                background: isActive ? 'var(--accent)' : 'transparent',
                textDecoration: 'none',
                fontSize: 14,
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
                overflow: 'hidden'
              })}
            >
              <span style={{ fontSize: 16, flexShrink: 0 }}>{link.icon}</span>
              {!collapsed && link.label}
            </NavLink>
          ))}
        </nav>

        {/* User / Logout */}
        <div style={{ padding: '12px 8px', borderTop: '1px solid var(--border)' }}>
          {!collapsed && (
            <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{user?.name}</div>
              <div>{user?.email}</div>
            </div>
          )}
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 12px',
              background: 'none',
              border: 'none',
              color: 'var(--danger)',
              cursor: 'pointer',
              borderRadius: 8,
              fontSize: 14,
              fontFamily: 'Inter',
            }}
          >
            <span>⏻</span>
            {!collapsed && 'Logout'}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px',
              background: 'none',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              borderRadius: 8,
              marginTop: 4,
              fontSize: 16
            }}
          >
            {collapsed ? '›' : '‹'}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflow: 'auto', padding: '32px' }}>
        <Outlet />
      </main>
    </div>
  );
}
