import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useCafe } from '../contexts/CafeContext';
import { Save, Upload, Plus, UserCog, Image, QrCode, Key, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface CafeSettings {
  cafe_name: string;
  tagline: string;
  address: string;
  contact_number: string;
  upi_id: string;
  qr_code_path: string;
  logo_path: string;
  receipt_footer: string;
}

interface User {
  id: string;
  username: string;
  full_name: string;
  role: string;
  is_active: number;
}

export default function SettingsPage() {
  const { isAdmin } = useAuth();
  const { reloadSettings } = useCafe();
  const [settings, setSettings] = useState<CafeSettings | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'cafe' | 'users'>('cafe');

  // File uploads
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // New user form
  const [newUser, setNewUser] = useState({ username: '', password: '', full_name: '', role: 'cashier' });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [settingsRes, usersRes] = await Promise.all([
        api.get('/settings'),
        isAdmin ? api.get('/settings/users') : Promise.resolve({ data: [] })
      ]);
      setSettings(settingsRes.data);
      setUsers(usersRes.data);
    } catch (_) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    try {
      await api.put('/settings', settings);

      // Upload Logo if selected
      if (logoFile) {
        const logoForm = new FormData();
        logoForm.append('logo', logoFile);
        const res = await api.post('/settings/upload-logo', logoForm, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        setSettings(prev => prev ? ({ ...prev, logo_path: res.data.logo_path }) : null);
        setLogoFile(null);
        toast.success('Cafe Logo uploaded successfully!');
      }

      // Upload QR if selected
      if (qrFile) {
        const qrForm = new FormData();
        qrForm.append('qr_code', qrFile);
        const res = await api.post('/settings/upload-qr', qrForm, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        setSettings(prev => prev ? ({ ...prev, qr_code_path: res.data.qr_code_path }) : null);
        setQrFile(null);
        toast.success('UPI QR Code uploaded successfully!');
      }

      toast.success('Settings saved!');
      await reloadSettings();
      loadData();
    } catch (_) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post('/settings/users', newUser);
      toast.success('User created!');
      setNewUser({ username: '', password: '', full_name: '', role: 'cashier' });
      loadData();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      toast.error(error?.response?.data?.error || 'Failed to create user');
    }
  }

  async function handleToggleUser(user: User) {
    try {
      await api.put(`/settings/users/${user.id}`, { ...user, is_active: user.is_active ? 0 : 1 });
      toast.success(`User ${user.is_active ? 'deactivated' : 'activated'}`);
      loadData();
    } catch (_) {
      toast.error('Failed to update user');
    }
  }

  async function handleResetPassword(user: User) {
    const newPass = window.prompt(`Enter new password for ${user.username}:`);
    if (!newPass || !newPass.trim()) return;
    try {
      await api.put(`/settings/users/${user.id}`, { ...user, password: newPass.trim() });
      toast.success(`Password updated for @${user.username}`);
      loadData();
    } catch (_) {
      toast.error('Failed to reset password');
    }
  }

  async function handleDeleteUser(user: User) {
    if (!window.confirm(`Are you sure you want to permanently delete account @${user.username}?`)) return;
    try {
      await api.delete(`/settings/users/${user.id}`);
      toast.success(`User @${user.username} deleted`);
      loadData();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      toast.error(error?.response?.data?.error || 'Failed to delete user');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 bg-white">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const currentLogo = logoPreview || settings?.logo_path || '/images/logo.png';
  const currentQr = qrPreview || settings?.qr_code_path || '/images/payment-qr.png';

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6 bg-white min-h-screen text-gray-900">
      <div>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Settings & Configuration</h1>
        <p className="text-gray-500 text-xs md:text-sm mt-0.5">Customize cafe branding, payment QR codes, and staff access</p>
      </div>

      {isAdmin && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('cafe')}
            className={`px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all ${
              activeTab === 'cafe'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-white border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            Cafe Branding & Payments
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all ${
              activeTab === 'users'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-white border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            Staff Roles & Accounts
          </button>
        </div>
      )}

      {activeTab === 'cafe' && settings && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          {/* Section 1: Logo & Visual Branding */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 md:p-6 space-y-5 shadow-xs">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
              <Image size={18} className="text-amber-500" />
              <h2 className="text-gray-900 font-bold text-base">Cafe Logo & Branding</h2>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-5">
              <div className="w-28 h-28 rounded-2xl bg-gray-50 border border-gray-200 p-2 flex items-center justify-center overflow-hidden flex-shrink-0">
                <img
                  src={currentLogo}
                  alt="Cafe Logo"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/images/logo.png';
                  }}
                />
              </div>

              <div className="space-y-2 flex-1 text-center sm:text-left">
                <p className="text-sm font-bold text-gray-900">Cafe Brand Logo</p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Used across the mobile app, navigation header, login screen, order receipts, and printouts.
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-1 justify-center sm:justify-start">
                  <label className="flex items-center gap-2 bg-gray-50 hover:bg-gray-100 text-gray-800 border border-gray-300 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors shadow-2xs">
                    <Upload size={14} className="text-amber-600" />
                    <span>{logoFile ? logoFile.name : 'Upload New Logo'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setLogoFile(file);
                          setLogoPreview(URL.createObjectURL(file));
                        }
                      }}
                    />
                  </label>
                  <span className="text-[11px] text-gray-400">Default fallback: public/images/logo.png</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Cafe Details */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 md:p-6 space-y-4 shadow-xs">
            <h2 className="text-gray-900 font-bold text-base border-b border-gray-100 pb-3">Cafe Profile Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Cafe Name" value={settings.cafe_name} onChange={v => setSettings({ ...settings, cafe_name: v })} />
              <Field label="Tagline" value={settings.tagline} onChange={v => setSettings({ ...settings, tagline: v })} />
              <div className="sm:col-span-2">
                <Field label="Location / Address" value={settings.address} onChange={v => setSettings({ ...settings, address: v })} />
              </div>
              <Field label="Contact Phone" value={settings.contact_number} onChange={v => setSettings({ ...settings, contact_number: v })} />
              <Field label="Receipt Footer Note" value={settings.receipt_footer} onChange={v => setSettings({ ...settings, receipt_footer: v })} />
            </div>
          </div>

          {/* Section 3: UPI Payment Configuration */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 md:p-6 space-y-5 shadow-xs">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
              <QrCode size={18} className="text-amber-500" />
              <h2 className="text-gray-900 font-bold text-base">UPI Payment & QR Code</h2>
            </div>

            <Field
              label="Cafe UPI ID (VPA)"
              value={settings.upi_id}
              onChange={v => setSettings({ ...settings, upi_id: v })}
              placeholder="e.g. thecheesyslice@okaxis"
            />

            <div className="flex flex-col sm:flex-row items-center gap-5 pt-2">
              <div className="w-32 h-32 rounded-2xl bg-white p-2 border border-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-2xs">
                <img
                  src={currentQr}
                  alt="Payment QR Code"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/images/payment-qr.png';
                  }}
                />
              </div>

              <div className="space-y-2 flex-1 text-center sm:text-left">
                <p className="text-sm font-bold text-gray-900">Static Payment QR Code Image</p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Upload your cafe's printed bank/UPI QR code. If none is uploaded, the app automatically generates an interactive dynamic QR code using your UPI ID!
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-1 justify-center sm:justify-start">
                  <label className="flex items-center gap-2 bg-gray-50 hover:bg-gray-100 text-gray-800 border border-gray-300 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors shadow-2xs">
                    <Upload size={14} className="text-amber-600" />
                    <span>{qrFile ? qrFile.name : 'Upload Custom QR'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setQrFile(file);
                          setQrPreview(URL.createObjectURL(file));
                        }
                      }}
                    />
                  </label>
                  <span className="text-[11px] text-gray-400">Default fallback: public/images/payment-qr.png</span>
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving || !isAdmin}
            className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-black px-6 py-3.5 rounded-xl transition-all disabled:opacity-50 text-sm shadow-md shadow-amber-500/20 cursor-pointer"
          >
            <Save size={18} />
            <span>{saving ? 'Saving Changes...' : 'Save Cafe Settings'}</span>
          </button>
        </form>
      )}

      {/* Staff Management Tab */}
      {activeTab === 'users' && isAdmin && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-5 md:p-6 shadow-xs">
            <h2 className="text-gray-900 font-bold text-base mb-4 flex items-center gap-2 border-b border-gray-100 pb-3">
              <Plus size={18} className="text-amber-500" />
              <span>Add Staff Account</span>
            </h2>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Full Name" value={newUser.full_name} onChange={v => setNewUser({ ...newUser, full_name: v })} placeholder="e.g. Rahul Sharma" />
                <Field label="Username" value={newUser.username} onChange={v => setNewUser({ ...newUser, username: v })} placeholder="e.g. rahul123" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Password" type="password" value={newUser.password} onChange={v => setNewUser({ ...newUser, password: v })} placeholder="••••••••" />
                <div>
                  <label className="text-xs font-bold text-gray-700 mb-1.5 block">Role & Permissions</label>
                  <select
                    value={newUser.role}
                    onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                    className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none shadow-2xs font-medium"
                  >
                    <option value="cashier">Cashier / Staff (Orders & Billing)</option>
                    <option value="kitchen">Kitchen Staff (Kitchen Display KDS)</option>
                    <option value="admin">Admin / Owner (Full System Access)</option>
                  </select>
                </div>
              </div>
              <button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-colors shadow-xs"
              >
                Create Staff User
              </button>
            </form>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="p-4 md:p-5 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-gray-900 font-bold text-sm flex items-center gap-2">
                <UserCog size={16} className="text-amber-500" />
                <span>Active Staff Accounts</span>
              </h2>
            </div>
            <div className="divide-y divide-gray-100">
              {users.map(user => (
                <div key={user.id} className="flex items-center justify-between p-4 hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-extrabold text-sm shadow-xs">
                      {user.full_name?.charAt(0)}
                    </div>
                    <div>
                      <p className="text-gray-900 text-sm font-bold">{user.full_name}</p>
                      <p className="text-gray-500 text-xs">@{user.username} • <span className="uppercase font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-[10px]">{user.role}</span></p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleResetPassword(user)}
                      className="text-xs px-2.5 py-1.5 rounded-xl font-bold bg-gray-100 hover:bg-amber-50 text-gray-700 hover:text-amber-800 border border-gray-200 transition-colors flex items-center gap-1"
                      title="Reset this user's password"
                    >
                      <Key size={13} />
                      <span className="hidden sm:inline">Reset Pass</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleUser(user)}
                      className={`text-xs px-2.5 py-1.5 rounded-xl font-bold transition-colors ${
                        user.is_active
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-red-50 hover:text-red-700'
                          : 'bg-red-50 text-red-700 border border-red-200 hover:bg-emerald-50 hover:text-emerald-700'
                      }`}
                    >
                      {user.is_active ? 'Active' : 'Inactive'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteUser(user)}
                      className="p-1.5 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Permanently delete user"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs font-bold text-gray-700 mb-1.5 block">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-xs font-medium shadow-2xs transition-colors"
      />
    </div>
  );
}
