import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, User, Target, BookOpen, ArrowRight, Loader2, Wand2 } from 'lucide-react';
import { generateStory, generateIllustration } from '../lib/gemini';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';

export const StoryWizard = ({ onComplete }: { onComplete: () => void }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    theme: '',
    characterName: '',
    age: '3-5',
    moral: '',
    language: 'Indonesia',
    pages: 8
  });
  
  const { setLoading, setCurrentBook, setError, isLoading, user, error } = useStore();

  const handleNext = () => setStep(s => s + 1);
  const handleBack = () => setStep(s => s - 1);

  const handleGenerate = async () => {
    if (!user) {
      setError("Silakan login terlebih dahulu.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const storyData = await generateStory({
        ...formData,
        pages: formData.pages
      });

      if (!storyData || !storyData.title) {
        throw new Error("Gagal mendapatkan data cerita dari AI.");
      }

      // 1. Save Book to Supabase
      const { data: book, error: bookError } = await supabase
        .from('books')
        .insert({
          user_id: user.id,
          title: storyData.title,
          theme: formData.theme,
          target_age: formData.age,
          moral: formData.moral,
          cover_prompt: storyData.coverPrompt,
          character_description: storyData.characterDescription
        })
        .select()
        .single();

      if (bookError) {
        console.error("Supabase Book Error:", bookError);
        throw new Error(`Gagal menyimpan buku: ${bookError.message}. Pastikan tabel 'books' sudah dibuat di Supabase.`);
      }

      // 2. Generate Cover (Optional)
      let coverUrl = null;
      try {
        coverUrl = await generateIllustration(storyData.coverPrompt);
        if (coverUrl) {
          await supabase.from('books').update({ cover_url: coverUrl }).eq('id', book.id);
        }
      } catch (imgErr) {
        console.warn("Failed to generate cover image:", imgErr);
      }

      // 3. Save Pages to Supabase
      const pagesToInsert = storyData.pages.map((p: any) => ({
        book_id: book.id,
        page_number: p.pageNumber,
        content: p.content,
        illustration_prompt: p.illustrationPrompt
      }));

      const { data: pages, error: pagesError } = await supabase
        .from('pages')
        .insert(pagesToInsert)
        .select();

      if (pagesError) {
        console.error("Supabase Pages Error:", pagesError);
        throw new Error(`Gagal menyimpan halaman: ${pagesError.message}`);
      }

      const fullBook: any = {
        id: book.id,
        title: book.title,
        theme: book.theme,
        targetAge: book.target_age,
        moral: book.moral,
        coverUrl: coverUrl,
        coverPrompt: book.cover_prompt,
        characterDescription: book.character_description,
        pages: pages.map((p: any) => ({
          id: p.id,
          pageNumber: p.page_number,
          content: p.content,
          illustrationUrl: p.illustration_url || null,
          illustrationPrompt: p.illustration_prompt,
          narrationUrl: p.narration_url || null
        }))
      };

      setCurrentBook(fullBook);
      onComplete();
    } catch (err: any) {
      console.error("Generation Error:", err);
      setError(err.message || "Terjadi kesalahan saat membuat cerita. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-8 bg-white rounded-3xl shadow-xl border border-indigo-50">
      <div className="flex justify-between mb-8">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={cn(
              "w-full h-2 rounded-full mx-1 transition-all duration-500",
              step >= s ? "bg-indigo-500" : "bg-indigo-100"
            )}
          />
        ))}
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-medium border border-red-100">
          {error}
        </div>
      )}

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-indigo-100 rounded-2xl text-indigo-600">
                <Sparkles size={24} />
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Ceritanya tentang apa?</h2>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tema Cerita</label>
              <textarea
                className="w-full p-4 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="misal: Seekor naga kecil pemberani yang ingin terbang ke bulan..."
                value={formData.theme}
                onChange={(e) => setFormData({ ...formData, theme: e.target.value })}
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Nama Karakter Utama</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  className="w-full pl-12 pr-4 py-3 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="misal: Budi, Luna, Sparky"
                  value={formData.characterName}
                  onChange={(e) => setFormData({ ...formData, characterName: e.target.value })}
                />
              </div>
            </div>

            <button
              onClick={handleNext}
              disabled={!formData.theme || !formData.characterName}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 disabled:opacity-50 transition-all"
            >
              Langkah Selanjutnya <ArrowRight size={20} />
            </button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-pink-100 rounded-2xl text-pink-600">
                <Target size={24} />
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Target Audiens & Pesan Moral</h2>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Kelompok Usia</label>
              <div className="grid grid-cols-3 gap-3">
                {['3-5', '6-8', '9-12'].map((age) => (
                  <button
                    key={age}
                    onClick={() => setFormData({ ...formData, age })}
                    className={cn(
                      "py-3 rounded-xl border font-medium transition-all",
                      formData.age === age 
                        ? "bg-pink-500 border-pink-500 text-white shadow-lg shadow-pink-200" 
                        : "bg-white border-gray-200 text-gray-600 hover:border-pink-200"
                    )}
                  >
                    {age} Tahun
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Pesan Moral</label>
              <input
                type="text"
                className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-pink-500 outline-none"
                placeholder="misal: Kejujuran, Kebaikan, Keberanian"
                value={formData.moral}
                onChange={(e) => setFormData({ ...formData, moral: e.target.value })}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleBack}
                className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition-all"
              >
                Kembali
              </button>
              <button
                onClick={handleNext}
                className="flex-[2] py-4 bg-pink-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-pink-700 transition-all"
              >
                Langkah Selanjutnya <ArrowRight size={20} />
              </button>
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-amber-100 rounded-2xl text-amber-600">
                <BookOpen size={24} />
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Detail Akhir</h2>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Bahasa</label>
              <select
                className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-amber-500 outline-none"
                value={formData.language}
                onChange={(e) => setFormData({ ...formData, language: e.target.value })}
              >
                <option>Indonesia</option>
                <option>English</option>
                <option>Bilingual (Indo-Eng)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Jumlah Halaman</label>
              <input
                type="range"
                min="5"
                max="15"
                step="1"
                className="w-full accent-amber-500"
                value={formData.pages}
                onChange={(e) => setFormData({ ...formData, pages: parseInt(e.target.value) })}
              />
              <div className="text-center font-bold text-amber-600 mt-2">{formData.pages} Halaman</div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleBack}
                className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition-all"
              >
                Kembali
              </button>
              <button
                onClick={handleGenerate}
                disabled={isLoading}
                className="flex-[2] py-4 bg-amber-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-amber-700 disabled:opacity-50 transition-all"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Sihir sedang bekerja...
                  </>
                ) : (
                  <>
                    <Wand2 size={20} />
                    Buat Ceritaku!
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
