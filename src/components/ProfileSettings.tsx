import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { User, Mail, Phone, Camera, Save, CheckCircle2, Layout, Image as ImageIcon, Type, Loader2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { supabase } from '../lib/supabase';

export const ProfileSettings = () => {
  const { user, updateUser, brandSettings, updateBrand } = useStore();
  const [activeTab, setActiveTab] = useState<'profile' | 'brand'>('profile');
  const [isLoading, setIsLoading] = useState(false);
  
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phoneNumber: user?.phoneNumber || '',
    avatarUrl: user?.avatarUrl || ''
  });

  const [brandData, setBrandData] = useState({
    name: brandSettings.name,
    tagline: brandSettings.tagline,
    logoUrl: brandSettings.logoUrl
  });

  const [isSaved, setIsSaved] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { 
          full_name: profileData.name,
          phone: profileData.phoneNumber,
          avatar_url: profileData.avatarUrl,
          role: user?.role // Preserve the current role in metadata
        }
      });
      if (error) throw error;

      // Also update the profiles table if user exists
      if (user) {
        await supabase.from('profiles').update({
          full_name: profileData.name,
          email: profileData.email,
          phone_number: profileData.phoneNumber,
          avatar_url: profileData.avatarUrl
          // We don't update role here to prevent users from escalating their own privileges
        }).eq('id', user.id);
      }

      updateUser(profileData);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Gagal memperbarui profil');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBrandSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      // Save to Supabase
      const { error } = await supabase
        .from('brand_settings')
        .upsert({
          id: '00000000-0000-0000-0000-000000000000', // Use fixed ID for single row
          name: brandData.name,
          tagline: brandData.tagline,
          logo_url: brandData.logoUrl,
          updated_at: new Date().toISOString()
        });

      if (error) {
        if (error.message.includes("relation") || error.code === "42P01") {
           throw new Error("Tabel 'brand_settings' belum dibuat. Silakan jalankan script SQL di Supabase.");
        }
        throw error;
      }

      updateBrand(brandData);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err: any) {
      alert(`Gagal menyimpan pengaturan brand: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const checkDatabase = async () => {
    try {
      const { error } = await supabase.from('books').select('count', { count: 'exact', head: true });
      if (error) throw error;
      alert("Koneksi Database Berhasil! Tabel 'books' ditemukan.");
    } catch (err: any) {
      alert(`Koneksi Database Bermasalah: ${err.message}. Pastikan Anda sudah menjalankan script SQL di Supabase.`);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'logo') => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // 1. Resize image first
      const resizedBase64 = await resizeImage(file);
      
      if (type === 'avatar') {
        setIsLoading(true);
        
        // 2. Convert base64 to Blob for upload
        const res = await fetch(resizedBase64);
        const blob = await res.blob();
        
        // 3. Upload to Supabase Storage
        const fileName = `${user?.id || 'unknown'}-${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, blob, {
            contentType: 'image/jpeg',
            upsert: true
          });

        if (uploadError) {
          console.warn("Upload failed, falling back to local base64:", uploadError);
          if (uploadError.message.includes("bucket")) {
             alert("Gagal upload: Bucket 'avatars' tidak ditemukan. Silakan buat Public Bucket bernama 'avatars' di Supabase Storage.");
          }
          // Fallback: use base64 locally
          setProfileData({ ...profileData, avatarUrl: resizedBase64 });
        } else {
          // 4. Get Public URL
          const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(fileName);
          
          // 5. Update State & DB immediately
          setProfileData({ ...profileData, avatarUrl: publicUrl });
          
          if (user) {
            // Update profiles table
            await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
            // Update auth metadata
            await supabase.auth.updateUser({ data: { avatar_url: publicUrl } });
            // Update local store
            updateUser({ avatarUrl: publicUrl });
          }
        }
      } else {
        // For Brand Logo (keep as base64 for now or implement similar logic)
        setBrandData({ ...brandData, logoUrl: resizedBase64 });
      }
    } catch (error: any) {
      console.error("Error processing image:", error);
      alert(`Gagal memproses gambar: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const resizeImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 200; // Limit to 200px
          const MAX_HEIGHT = 200;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.7)); // Compress to 70% quality JPEG
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });
  };

  return (
    <div className="max-w-2xl mx-auto py-8">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-gray-900 mb-2">Pengaturan</h1>
          <p className="text-gray-500">Kelola informasi profil dan identitas brand Anda</p>
        </div>
        <button 
          onClick={checkDatabase}
          className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-200 transition-all mr-2"
        >
          Cek Koneksi Database
        </button>
        <button 
          onClick={() => {
            if (window.confirm('Ini akan menghapus semua data lokal. Lanjutkan?')) {
              localStorage.clear();
              window.location.reload();
            }
          }}
          className="px-4 py-2 bg-red-50 text-red-500 rounded-xl text-sm font-bold hover:bg-red-100 transition-all"
        >
          Reset Data
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${
            activeTab === 'profile' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          <User size={20} /> Profil User
        </button>
        <button
          onClick={() => setActiveTab('brand')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${
            activeTab === 'brand' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          <Layout size={20} /> Identitas Brand
        </button>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-xl border border-gray-100 overflow-hidden">
        <div className="p-10">
          {activeTab === 'profile' ? (
            <form onSubmit={handleProfileSave} className="space-y-8">
              {/* Avatar Upload */}
              <div className="flex flex-col items-center">
                <div className="relative group">
                  <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-indigo-50 shadow-lg bg-gray-100">
                    {profileData.avatarUrl ? (
                      <img src={profileData.avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <User size={64} />
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="absolute bottom-0 right-0 p-3 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 transition-all scale-90 group-hover:scale-100"
                  >
                    <Camera size={20} />
                  </button>
                  <input
                    type="file"
                    ref={avatarInputRef}
                    onChange={(e) => handleFileChange(e, 'avatar')}
                    className="hidden"
                    accept="image/*"
                  />
                </div>
                <p className="mt-4 text-sm font-medium text-gray-500">Klik ikon kamera untuk ganti foto profil</p>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">Nama Lengkap</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="text"
                      className="w-full pl-12 pr-4 py-4 rounded-2xl border border-gray-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-gray-50/50"
                      value={profileData.name}
                      onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                      placeholder="Masukkan nama lengkap"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">Alamat Email</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="email"
                      className="w-full pl-12 pr-4 py-4 rounded-2xl border border-gray-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-gray-50/50"
                      value={profileData.email}
                      onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                      placeholder="Masukkan alamat email"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">Nomor HP</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="tel"
                      className="w-full pl-12 pr-4 py-4 rounded-2xl border border-gray-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-gray-50/50"
                      value={profileData.phoneNumber}
                      onChange={(e) => setProfileData({ ...profileData, phoneNumber: e.target.value })}
                      placeholder="Masukkan nomor HP"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="animate-spin" size={24} />
                  ) : isSaved ? (
                    <>
                      <CheckCircle2 size={24} />
                      Berhasil Disimpan
                    </>
                  ) : (
                    <>
                      <Save size={24} />
                      Simpan Profil
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleBrandSave} className="space-y-8">
              {/* Logo Upload */}
              <div className="flex flex-col items-center">
                <div className="relative group">
                  <div className="w-32 h-32 rounded-2xl overflow-hidden border-4 border-indigo-50 shadow-lg bg-white p-4">
                    {brandData.logoUrl ? (
                      <img src={brandData.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <ImageIcon size={64} />
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="absolute bottom-0 right-0 p-3 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 transition-all scale-90 group-hover:scale-100"
                  >
                    <Camera size={20} />
                  </button>
                  <input
                    type="file"
                    ref={logoInputRef}
                    onChange={(e) => handleFileChange(e, 'logo')}
                    className="hidden"
                    accept="image/*"
                  />
                </div>
                <p className="mt-4 text-sm font-medium text-gray-500">Klik ikon kamera untuk ganti logo brand</p>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">Nama Brand</label>
                  <div className="relative">
                    <Type className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="text"
                      className="w-full pl-12 pr-4 py-4 rounded-2xl border border-gray-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-gray-50/50"
                      value={brandData.name}
                      onChange={(e) => setBrandData({ ...brandData, name: e.target.value })}
                      placeholder="Masukkan nama brand"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">Tagline / Sub-teks</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="text"
                      className="w-full pl-12 pr-4 py-4 rounded-2xl border border-gray-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-gray-50/50"
                      value={brandData.tagline}
                      onChange={(e) => setBrandData({ ...brandData, tagline: e.target.value })}
                      placeholder="misal: by Erna"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2"
                >
                  {isSaved ? (
                    <>
                      <CheckCircle2 size={24} />
                      Berhasil Disimpan
                    </>
                  ) : (
                    <>
                      <Save size={24} />
                      Simpan Identitas Brand
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
