import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserPlus, Shield, Trash2, Edit2, Search, Loader2, CheckCircle2, X, Mail, User as UserIcon, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { useStore } from '../store/useStore';

interface AdminUser {
  id: string;
  full_name: string;
  email: string;
  role: string;
  phone_number?: string;
  avatar_url?: string;
}

export const AdminManagement = () => {
  const { brandSettings, updateBrand } = useStore();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    password: '',
    role: 'admin'
  });

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    setIsLoading(true);
    try {
      // Fetch all profiles to allow promoting users to admin
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('role', { ascending: true })
        .order('full_name');

      if (error) throw error;
      setAdmins(data || []);
    } catch (err: any) {
      console.error('Error fetching users:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus admin ini?')) return;
    
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setAdmins(admins.filter(a => a.id !== id));
    } catch (err: any) {
      alert(`Gagal menghapus: ${err.message}`);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (editingAdmin) {
        // Update existing profile
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: formData.name,
            role: formData.role
          })
          .eq('id', editingAdmin.id);

        if (error) throw error;
      } else {
        // Create new admin directly via backend API
        const response = await fetch('/api/admin/create-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
            name: formData.name,
            role: formData.role
          })
        });

        let result;
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
          result = await response.json();
        } else {
          const text = await response.text();
          console.error("Server returned non-JSON response:", text);
          // Show a bit of the response text to help debugging
          const preview = text.substring(0, 100).replace(/<[^>]*>/g, '');
          throw new Error(`Server tidak merespon dengan JSON. Status: ${response.status}. Pesan: ${preview}...`);
        }

        if (!response.ok) throw new Error(result.error || 'Gagal membuat admin');
        
        alert(`Admin ${formData.name} berhasil dibuat!`);
      }

      await fetchAdmins();
      setIsModalOpen(false);
      setEditingAdmin(null);
    } catch (err: any) {
      alert(`Gagal menyimpan: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredAdmins = admins.filter(a => 
    a.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black text-gray-900 mb-2">Manajemen Admin</h1>
          <p className="text-gray-500">Kelola hak akses dan daftar administrator sistem</p>
        </div>
        <button 
          onClick={() => {
            setEditingAdmin(null);
            setFormData({ email: '', name: '', password: '', role: 'admin' });
            setIsModalOpen(true);
          }}
          className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold flex items-center gap-2 hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all"
        >
          <UserPlus size={20} /> Tambah Admin
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input 
          type="text"
          placeholder="Cari admin berdasarkan nama atau email..."
          className="w-full pl-12 pr-4 py-4 rounded-2xl border border-gray-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white shadow-sm"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Admin List */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/50 border-bottom border-gray-100">
              <th className="px-8 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest">Admin</th>
              <th className="px-8 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest">Role</th>
              <th className="px-8 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest">Kontak</th>
              <th className="px-8 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-8 py-12 text-center">
                  <Loader2 className="animate-spin mx-auto text-indigo-500 mb-2" size={32} />
                  <p className="text-gray-400 font-medium">Memuat daftar admin...</p>
                </td>
              </tr>
            ) : filteredAdmins.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-8 py-12 text-center">
                  <p className="text-gray-400 font-medium">Tidak ada admin ditemukan</p>
                </td>
              </tr>
            ) : (
              filteredAdmins.map((admin) => (
                <tr key={admin.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold overflow-hidden">
                        {admin.avatar_url ? (
                          <img src={admin.avatar_url} className="w-full h-full object-cover" alt={admin.full_name} />
                        ) : (
                          <UserIcon size={20} />
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{admin.full_name || 'Tanpa Nama'}</p>
                        <p className="text-xs text-gray-400">{admin.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                      admin.role === 'admin' ? "bg-indigo-50 text-indigo-600" : "bg-gray-100 text-gray-500"
                    )}>
                      {admin.role}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <p className="text-sm text-gray-600">{admin.phone_number || '-'}</p>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => {
                          setEditingAdmin(admin);
                          setFormData({ email: admin.email, name: admin.full_name, password: '', role: admin.role });
                          setIsModalOpen(true);
                        }}
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(admin.id)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* System Configuration */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600">
            <Lock size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-gray-900">Konfigurasi Sistem</h2>
            <p className="text-sm text-gray-500">Kelola kunci API dan pengaturan global aplikasi</p>
          </div>
        </div>

        <div className="max-w-2xl space-y-6">
          <div className="p-6 bg-amber-50 rounded-[2rem] border border-amber-100">
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-xs font-bold text-amber-700 mb-2 uppercase tracking-wider">Gemini API Key</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-400" size={18} />
                  <input
                    type="password"
                    className="w-full pl-12 pr-4 py-3 rounded-2xl border border-amber-200 focus:ring-2 focus:ring-amber-500 outline-none transition-all bg-white"
                    placeholder="Masukkan API Key Gemini baru..."
                    value={brandSettings.geminiApiKey || ''}
                    onChange={(e) => updateBrand({ geminiApiKey: e.target.value })}
                  />
                </div>
                <p className="mt-3 text-[11px] text-amber-600 leading-relaxed">
                  <strong>Penting:</strong> Jika API Key utama (dari environment) sudah habis, Anda dapat memasukkan API Key cadangan di sini. Sistem akan memprioritaskan kunci yang ada di sini.
                </p>
              </div>
              <div className="flex items-end">
                <button
                  onClick={async () => {
                    try {
                      setIsLoading(true);
                      const { error } = await supabase
                        .from('brand_settings')
                        .upsert({ 
                          id: 1, // Assuming single row with ID 1 or using upsert logic
                          gemini_api_key: brandSettings.geminiApiKey,
                          updated_at: new Date().toISOString()
                        });
                      
                      if (error) throw error;
                      alert('API Key berhasil diperbarui!');
                    } catch (err: any) {
                      alert(`Gagal memperbarui API Key: ${err.message}`);
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                  disabled={isLoading}
                  className="px-6 py-3 bg-amber-600 text-white rounded-2xl font-bold hover:bg-amber-700 transition-all shadow-lg shadow-amber-100 disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Simpan Key'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-8">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-black text-gray-900">
                    {editingAdmin ? 'Edit Admin' : 'Tambah Admin Baru'}
                  </h2>
                  <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-all">
                    <X size={24} />
                  </button>
                </div>

                {!editingAdmin && (
                  <div className="mb-6 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                    <p className="text-xs text-indigo-700 leading-relaxed">
                      <strong>Info:</strong> Anda dapat membuat akun admin baru secara langsung. Masukkan email dan password yang akan digunakan oleh admin tersebut untuk login.
                    </p>
                  </div>
                )}

                <form onSubmit={handleSave} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-1 ml-1 uppercase tracking-wider">Nama Lengkap</label>
                    <div className="relative">
                      <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input
                        type="text"
                        className="w-full pl-12 pr-4 py-3 rounded-2xl border border-gray-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-gray-50/50"
                        placeholder="Nama Lengkap"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  {!editingAdmin && (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-gray-400 mb-1 ml-1 uppercase tracking-wider">Email</label>
                        <div className="relative">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                          <input
                            type="email"
                            className="w-full pl-12 pr-4 py-3 rounded-2xl border border-gray-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-gray-50/50"
                            placeholder="email@example.com"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            required
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-400 mb-1 ml-1 uppercase tracking-wider">Password</label>
                        <div className="relative">
                          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                          <input
                            type="password"
                            className="w-full pl-12 pr-4 py-3 rounded-2xl border border-gray-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-gray-50/50"
                            placeholder="••••••••"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            required={!editingAdmin}
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-1 ml-1 uppercase tracking-wider">Role</label>
                    <select
                      className="w-full px-4 py-3 rounded-2xl border border-gray-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-gray-50/50 appearance-none"
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    >
                      <option value="admin">Admin</option>
                      <option value="user">User (Non-Admin)</option>
                    </select>
                  </div>

                  <div className="pt-4">
                    <button
                      type="submit"
                      className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 size={24} />
                      {editingAdmin ? 'Simpan Perubahan' : 'Tambah Admin'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
