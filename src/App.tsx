/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Plus, Library, Sparkles, LogOut, Settings as SettingsIcon, User as UserIcon, ShieldCheck } from 'lucide-react';
import { useStore } from './store/useStore';
import { StoryWizard } from './components/StoryWizard';
import { BookPreview } from './components/BookPreview';
import { Login } from './components/Login';
import { ProfileSettings } from './components/ProfileSettings';
import { AdminManagement } from './components/AdminManagement';
import { cn } from './lib/utils';
import { supabase } from './lib/supabase';

export default function App() {
  const [view, setView] = useState<'dashboard' | 'wizard' | 'preview' | 'settings' | 'admins'>('dashboard');
  const { currentBook, myBooks, user, setUser, brandSettings, fetchBooks, fetchBrandSettings } = useStore();

  useEffect(() => {
    fetchBrandSettings();
  }, [fetchBrandSettings]);

  useEffect(() => {
    if (user) {
      fetchBooks();
    }
  }, [user, fetchBooks]);

  useEffect(() => {
    // Check for existing session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error("Session error:", error.message);
        if (error.message.includes("refresh_token_not_found") || error.message.includes("Refresh Token Not Found")) {
          supabase.auth.signOut();
          setUser(null);
        }
        return;
      }
      
      if (session?.user) {
        const userRole = session.user.user_metadata?.role || 'user';
        setUser({
          id: session.user.id,
          name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
          email: session.user.email || '',
          role: userRole as 'admin' | 'user',
          credits: userRole === 'admin' ? 9999 : 10,
          avatarUrl: session.user.user_metadata?.avatar_url,
          phoneNumber: session.user.user_metadata?.phone || session.user.user_metadata?.phone_number
        });
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
      }

      if (session?.user) {
        const userRole = session.user.user_metadata?.role || 'user';
        setUser({
          id: session.user.id,
          name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
          email: session.user.email || '',
          role: userRole as 'admin' | 'user',
          credits: userRole === 'admin' ? 9999 : 10,
          avatarUrl: session.user.user_metadata?.avatar_url,
          phoneNumber: session.user.user_metadata?.phone || session.user.user_metadata?.phone_number
        });
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [setUser]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  if (!user) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-[#F8F9FE] font-sans text-gray-900">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-100 p-6 flex flex-col z-20">
        <div className="flex items-center gap-3 mb-12 px-2">
          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center overflow-hidden shadow-md border border-gray-50">
            <img 
              src={brandSettings.logoUrl} 
              alt="Logo" 
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-black tracking-tight text-indigo-900 leading-tight">{brandSettings.name}</span>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{brandSettings.tagline}</span>
          </div>
        </div>

        <nav className="space-y-2 flex-1">
          <button 
            onClick={() => setView('dashboard')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all",
              view === 'dashboard' ? "bg-indigo-50 text-indigo-600" : "text-gray-500 hover:bg-gray-50"
            )}
          >
            <Library size={20} /> Beranda
          </button>
          <button 
            onClick={() => setView('wizard')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all",
              view === 'wizard' ? "bg-indigo-50 text-indigo-600" : "text-gray-500 hover:bg-gray-50"
            )}
          >
            <Plus size={20} /> Buat Baru
          </button>
          <button 
            onClick={() => setView('settings')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all",
              view === 'settings' ? "bg-indigo-50 text-indigo-600" : "text-gray-500 hover:bg-gray-50"
            )}
          >
            <SettingsIcon size={20} /> Pengaturan
          </button>
          {user.role === 'admin' && (
            <button 
              onClick={() => setView('admins')}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all",
                view === 'admins' ? "bg-indigo-50 text-indigo-600" : "text-gray-500 hover:bg-gray-50"
              )}
            >
              <ShieldCheck size={20} /> Manajemen Admin
            </button>
          )}
        </nav>

        <div className="mt-auto pt-6 border-t border-gray-100">
          <div className="flex items-center gap-3 px-2 mb-6">
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white shadow-sm bg-gray-100">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300">
                  <UserIcon size={20} />
                </div>
              )}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-bold truncate">{user.name}</p>
              <p className="text-xs text-gray-400 truncate capitalize">{user.role}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-red-500 hover:bg-red-50 transition-all"
          >
            <LogOut size={20} /> Keluar
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-64 p-8">
        <AnimatePresence mode="wait">
          {view === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="flex justify-between items-end">
                <div>
                  <h1 className="text-4xl font-black text-gray-900 mb-2">Buku Ceritaku</h1>
                  <p className="text-gray-500">Selamat datang kembali! Kamu memiliki {myBooks.length} cerita di perpustakaanmu.</p>
                </div>
                <button 
                  onClick={() => setView('wizard')}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold flex items-center gap-2 hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all"
                >
                  <Plus size={20} /> Buat Cerita Baru
                </button>
              </div>

              {myBooks.length === 0 ? (
                <div className="bg-white rounded-[2.5rem] p-16 text-center border-2 border-dashed border-gray-100">
                  <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6 text-indigo-500">
                    <Sparkles size={48} />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-2">Belum ada cerita</h3>
                  <p className="text-gray-500 mb-8 max-w-sm mx-auto">Mulai petualangan pertamamu dan biarkan AI membantumu membuat buku cerita ajaib untuk anak-anak.</p>
                  <button 
                    onClick={() => setView('wizard')}
                    className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all"
                  >
                    Buat Cerita Pertamamu
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {myBooks.map((book) => (
                    <motion.div
                      key={book.id}
                      whileHover={{ y: -8 }}
                      className="bg-white rounded-[2rem] overflow-hidden shadow-sm hover:shadow-xl transition-all border border-gray-100 cursor-pointer group"
                      onClick={() => {
                        useStore.getState().setCurrentBook(book);
                        setView('preview');
                      }}
                    >
                      <div className="aspect-[4/3] relative overflow-hidden">
                        {book.coverUrl ? (
                          <img src={book.coverUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={book.title} referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-full h-full bg-indigo-50 flex items-center justify-center text-indigo-200">
                            <BookOpen size={64} />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-6">
                          <span className="text-white font-bold flex items-center gap-2">Baca Cerita <Plus size={16} /></span>
                        </div>
                      </div>
                      <div className="p-6">
                        <h3 className="text-xl font-bold text-gray-900 mb-1 truncate">{book.title}</h3>
                        <p className="text-sm text-gray-500 mb-4">{book.pages.length} Halaman • {book.targetAge} Tahun</p>
                        <div className="flex gap-2">
                          <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold uppercase tracking-wider">{book.theme}</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {view === 'wizard' && (
            <motion.div
              key="wizard"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="py-12"
            >
              <StoryWizard onComplete={() => setView('preview')} />
            </motion.div>
          )}

          {view === 'preview' && (
            <motion.div
              key="preview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="mb-6">
                <button 
                  onClick={() => setView('dashboard')}
                  className="text-gray-500 hover:text-indigo-600 font-medium flex items-center gap-2 transition-all"
                >
                  ← Kembali ke Beranda
                </button>
              </div>
              <BookPreview />
            </motion.div>
          )}

          {view === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <ProfileSettings />
            </motion.div>
          )}
          {view === 'admins' && (
            <motion.div
              key="admins"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <AdminManagement />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
