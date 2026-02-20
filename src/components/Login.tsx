import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Lock, User as UserIcon, AlertCircle, Mail, ArrowRight, Loader2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { supabase } from '../lib/supabase';

export const Login = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [role] = useState<'admin' | 'user'>('admin');
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    name: ''
  });
  const [error, setError] = useState('');
  const setUser = useStore((state) => state.setUser);
  const brandSettings = useStore((state) => state.brandSettings);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isLogin) {
        // Supabase Login
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email: formData.email || `${formData.username}@example.com`,
          password: formData.password,
        });

        if (authError) throw authError;

        if (data.user) {
          // In a real app, you'd fetch the role from a profiles table
          // For now, we'll use the role selected in the UI or check metadata
          const userRole = data.user.user_metadata?.role || role;
          
          setUser({
            id: data.user.id,
            name: data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || 'User',
            email: data.user.email || '',
            role: userRole,
            credits: userRole === 'admin' ? 9999 : 10,
            avatarUrl: data.user.user_metadata?.avatar_url
          });
        }
      } else {
        // Supabase Sign Up
        const { data, error: authError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              full_name: formData.name,
              username: formData.username,
              role: role,
            }
          }
        });

        if (authError) throw authError;

        if (data.user) {
          setUser({
            id: data.user.id,
            name: formData.name,
            email: formData.email,
            role: role,
            credits: role === 'admin' ? 9999 : 10
          });
        }
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat autentikasi');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FE] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl p-10 border border-indigo-50"
      >
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center overflow-hidden shadow-xl border border-gray-50 mx-auto mb-6">
            <img 
              src={brandSettings.logoUrl} 
              alt="Logo" 
              className="w-full h-full object-contain p-2"
              referrerPolicy="no-referrer"
            />
          </div>
          <h1 className="text-2xl font-black text-gray-900 mb-1">{brandSettings.name} <span className="text-indigo-600">{brandSettings.tagline}</span></h1>
          <p className="text-gray-500 text-sm">
            Masuk ke Panel Admin
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="p-4 bg-red-50 text-red-600 rounded-2xl flex items-center gap-3 text-sm font-medium"
              >
                <AlertCircle size={18} />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

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
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="animate-spin" size={24} />
            ) : (
              <>
                Masuk Sekarang
                <ArrowRight size={20} />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-[10px] text-gray-400 uppercase tracking-widest">
          <p>© 2026 {brandSettings.name} • SDN Cimahi Mandiri 3</p>
          <button 
            onClick={() => {
              if (window.confirm('Ini akan menghapus data login dan cache lokal untuk memperbaiki masalah error. Lanjutkan?')) {
                localStorage.clear();
                window.location.reload();
              }
            }}
            className="mt-4 text-red-400 hover:text-red-500 underline cursor-pointer"
          >
            Reset Data Aplikasi (Fix Error)
          </button>
        </div>
      </motion.div>
    </div>
  );
};
