import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Image as ImageIcon, Volume2, Download, RefreshCw, Loader2, Sparkles, Edit2, Save, X } from 'lucide-react';
import { useStore } from '../store/useStore';
import { generateIllustration, generateNarration } from '../lib/gemini';
import { supabase } from '../lib/supabase';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { cn } from '../lib/utils';

export const BookPreview = () => {
  const { currentBook, updatePage, updateBook, setLoading, isLoading } = useStore();
  const [currentPage, setCurrentPage] = useState(0); // 0 is cover, 1+ are pages
  const [isGeneratingImg, setIsGeneratingImg] = useState(false);
  const [isNarrating, setIsNarrating] = useState(false);
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    title: '',
    targetAge: '',
    theme: '',
    moral: ''
  });

  useEffect(() => {
    if (currentBook) {
      setEditData({
        title: currentBook.title,
        targetAge: currentBook.targetAge,
        theme: currentBook.theme,
        moral: currentBook.moral
      });
    }
  }, [currentBook]);

  if (!currentBook) return null;

  const handleSaveEdit = async () => {
    if (!currentBook) return;
    try {
      // Update local state
      updateBook(currentBook.id, editData);
      
      // Update Supabase
      const { error } = await supabase
        .from('books')
        .update({
          title: editData.title,
          target_age: editData.targetAge,
          theme: editData.theme,
          moral: editData.moral
        })
        .eq('id', currentBook.id);

      if (error) throw error;
      setIsEditing(false);
    } catch (err: any) {
      alert(`Gagal menyimpan perubahan: ${err.message}`);
    }
  };

  const totalPages = currentBook.pages.length;

  const handleGenerateAllImages = async () => {
    if (!currentBook) return;
    setIsBatchGenerating(true);
    setBatchProgress(0);
    
    const pagesToGenerate = currentBook.pages.filter(p => !p.illustrationUrl);
    if (pagesToGenerate.length === 0) {
      setIsBatchGenerating(false);
      return;
    }

    let completed = 0;
    for (const page of pagesToGenerate) {
      try {
        const url = await generateIllustration(page.illustrationPrompt);
        if (url) {
          updatePage(page.id, { illustrationUrl: url });
          // Save to Supabase
          await supabase.from('pages').update({ illustration_url: url }).eq('id', page.id);
        }
        // Increased delay to 3 seconds to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (err: any) {
        console.error(`Failed to generate image for page ${page.pageNumber}:`, err);
        if (err.message?.includes("429") || err.message?.includes("quota")) {
          alert("Limit API tercapai (Rate Limit). Pembuatan gambar otomatis dihentikan sementara. Silakan coba lagi dalam beberapa menit.");
          break; // Stop batch if rate limited
        }
      }
      completed++;
      setBatchProgress(Math.round((completed / pagesToGenerate.length) * 100));
    }
    
    setIsBatchGenerating(false);
  };

  const handleNext = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const handlePrev = () => {
    if (currentPage > 0) setCurrentPage(currentPage - 1);
  };

  const handleGenerateImage = async (pageIndex: number) => {
    const page = currentBook.pages[pageIndex];
    setIsGeneratingImg(true);
    try {
      const url = await generateIllustration(page.illustrationPrompt);
      if (url) {
        updatePage(page.id, { illustrationUrl: url });
        
        // Save to Supabase
        await supabase.from('pages').update({ illustration_url: url }).eq('id', page.id);
      } else {
        alert("Gagal membuat ilustrasi. Silakan coba lagi.");
      }
    } catch (err: any) {
      console.error(err);
      alert(`Gagal membuat ilustrasi: ${err.message}`);
    } finally {
      setIsGeneratingImg(false);
    }
  };

  const handleNarration = async (pageIndex: number) => {
    const page = currentBook.pages[pageIndex];
    setIsNarrating(true);
    try {
      let url = page.narrationUrl;
      if (!url) {
        url = await generateNarration(page.content);
        if (url) {
          updatePage(page.id, { narrationUrl: url });
        }
      }
      
      if (url) {
        const audio = new Audio(url);
        audio.play().catch(e => console.error("Audio play failed:", e));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsNarrating(false);
    }
  };

  const exportToPDF = async () => {
    console.log("Exporting multi-page PDF started...");
    if (!currentBook) {
      console.error("No current book found");
      return;
    }

    setLoading(true);
    try {
      const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Create a hidden container for rendering pages
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.width = '800px'; 
      document.body.appendChild(container);

      const renderPageToCanvas = async (html: string) => {
        const pageEl = document.createElement('div');
        pageEl.innerHTML = html;
        pageEl.style.backgroundColor = 'white';
        pageEl.style.padding = '40px';
        pageEl.style.display = 'flex';
        pageEl.style.flexDirection = 'column';
        pageEl.style.alignItems = 'center';
        pageEl.style.justifyContent = 'center';
        pageEl.style.minHeight = '1100px';
        container.appendChild(pageEl);
        
        const images = pageEl.getElementsByTagName('img');
        await Promise.all(Array.from(images).map(img => {
          if (img.complete) return Promise.resolve();
          return new Promise(resolve => { img.onload = resolve; img.onerror = resolve; });
        }));

        const canvas = await html2canvas(pageEl, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false
        });
        
        container.removeChild(pageEl);
        return canvas;
      };

      // 1. Render Cover
      const coverHtml = `
        <div style="width: 100%; text-align: center; background: linear-gradient(to bottom right, #6366f1, #9333ea); color: white; padding: 60px; border-radius: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
          ${currentBook.coverUrl ? `<img src="${currentBook.coverUrl}" style="width: 80%; border-radius: 20px; margin-bottom: 30px; border: 8px solid rgba(255,255,255,0.2);" />` : ''}
          <h1 style="font-size: 48px; font-weight: 900; margin-bottom: 20px; font-family: sans-serif;">${currentBook.title}</h1>
          <div style="font-size: 18px; font-weight: bold; text-transform: uppercase; font-family: sans-serif;">A Story for ${currentBook.targetAge} Years Old</div>
        </div>
      `;
      const coverCanvas = await renderPageToCanvas(coverHtml);
      const coverImg = coverCanvas.toDataURL('image/jpeg', 0.95);
      doc.addImage(coverImg, 'JPEG', 0, 0, pageWidth, pageHeight);

      // 2. Render Each Page
      for (let i = 0; i < currentBook.pages.length; i++) {
        const page = currentBook.pages[i];
        doc.addPage();
        
        const pageHtml = `
          <div style="width: 100%; display: flex; flex-direction: column; gap: 30px; align-items: center;">
            <div style="width: 100%; aspect-ratio: 1/1; overflow: hidden; border-radius: 20px;">
              ${page.illustrationUrl ? `<img src="${page.illustrationUrl}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 20px;" />` : '<div style="width: 100%; height: 100%; background: #f3f4f6;"></div>'}
            </div>
            <div style="padding: 20px; text-align: center;">
              <div style="color: #6366f1; font-weight: bold; margin-bottom: 15px; text-transform: uppercase; font-family: sans-serif;">Page ${i + 1}</div>
              <p style="font-size: 24px; line-height: 1.6; color: #1f2937; font-family: serif;">${page.content}</p>
            </div>
          </div>
        `;
        
        const pageCanvas = await renderPageToCanvas(pageHtml);
        const pageImg = pageCanvas.toDataURL('image/jpeg', 0.95);
        doc.addImage(pageImg, 'JPEG', 0, 0, pageWidth, pageHeight);
      }

      doc.save(`${currentBook.title}.pdf`);
      document.body.removeChild(container);
    } catch (err) {
      console.error("Multi-page PDF Export Error:", err);
      alert("Gagal mengekspor PDF.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div className="flex-1 mr-8">
          {isEditing ? (
            <div className="space-y-4 bg-white p-6 rounded-2xl shadow-lg border border-indigo-100">
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">Judul Cerita</label>
                <input
                  type="text"
                  className="w-full p-2 border border-gray-200 rounded-lg font-bold text-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={editData.title}
                  onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1">Tema</label>
                  <input
                    type="text"
                    className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={editData.theme}
                    onChange={(e) => setEditData({ ...editData, theme: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1">Target Usia</label>
                  <input
                    type="text"
                    className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={editData.targetAge}
                    onChange={(e) => setEditData({ ...editData, targetAge: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">Pesan Moral</label>
                <textarea
                  className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-h-[80px]"
                  value={editData.moral}
                  onChange={(e) => setEditData({ ...editData, moral: e.target.value })}
                />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg text-sm font-bold flex items-center gap-1"
                >
                  <X size={16} /> Batal
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 flex items-center gap-1"
                >
                  <Save size={16} /> Simpan
                </button>
              </div>
            </div>
          ) : (
            <div className="group relative">
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                {currentBook.title}
                <button 
                  onClick={() => setIsEditing(true)}
                  className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all"
                  title="Edit Detail Cerita"
                >
                  <Edit2 size={18} />
                </button>
              </h1>
              <p className="text-gray-500">Theme: {currentBook.theme} • Age: {currentBook.targetAge}</p>
            </div>
          )}
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleGenerateAllImages}
            disabled={isBatchGenerating}
            className="flex items-center gap-2 px-6 py-3 bg-amber-500 text-white rounded-2xl font-bold hover:bg-amber-600 transition-all disabled:opacity-50"
          >
            {isBatchGenerating ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                {batchProgress}%
              </>
            ) : (
              <>
                <Sparkles size={20} /> Buat Semua Gambar
              </>
            )}
          </button>
          <button 
            onClick={exportToPDF}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all"
          >
            <Download size={20} /> Ekspor PDF
          </button>
        </div>
      </div>

      <div className="relative group">
        <div id="book-content" className="bg-white rounded-[2rem] shadow-2xl overflow-hidden border-8 border-white min-h-[600px] flex flex-col md:flex-row">
          <AnimatePresence mode="wait">
            {currentPage === 0 ? (
              <motion.div
                key="cover"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full flex flex-col items-center justify-center p-12 bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-center"
              >
                {currentBook.coverUrl ? (
                  <img 
                    src={currentBook.coverUrl} 
                    className="w-full max-w-md aspect-square object-cover rounded-2xl shadow-xl mb-8 border-4 border-white/20"
                    alt="Cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full max-w-md aspect-square bg-white/10 rounded-2xl flex items-center justify-center mb-8">
                    <ImageIcon size={64} className="opacity-20" />
                  </div>
                )}
                <h2 className="text-5xl font-black mb-4 tracking-tight leading-tight">{currentBook.title}</h2>
                <div className="px-6 py-2 bg-white/20 rounded-full text-sm font-bold uppercase tracking-widest">
                  Cerita untuk Anak Usia {currentBook.targetAge} Tahun
                </div>
              </motion.div>
            ) : (
              <motion.div
                key={`page-${currentPage}`}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                className="w-full flex flex-col md:flex-row"
              >
                {/* Illustration Side */}
                <div className="flex-1 bg-gray-50 p-8 flex flex-col items-center justify-center relative min-h-[400px]">
                  {currentBook.pages[currentPage - 1].illustrationUrl ? (
                    <div className="relative group/img w-full h-full">
                      <img 
                        src={currentBook.pages[currentPage - 1].illustrationUrl!} 
                        className="w-full h-full object-cover rounded-3xl shadow-lg border-4 border-white"
                        alt={`Page ${currentPage}`}
                        referrerPolicy="no-referrer"
                      />
                      <button 
                        onClick={() => handleGenerateImage(currentPage - 1)}
                        className="absolute bottom-4 right-4 p-3 bg-white rounded-xl shadow-lg text-indigo-600 opacity-0 group-hover/img:opacity-100 transition-all hover:scale-110"
                      >
                        <RefreshCw size={20} />
                      </button>
                    </div>
                  ) : (
                    <div className="text-center space-y-4">
                      <div className="w-32 h-32 bg-indigo-100 rounded-full flex items-center justify-center mx-auto text-indigo-500">
                        <ImageIcon size={48} />
                      </div>
                      <p className="text-gray-500 font-medium">Belum ada ilustrasi</p>
                      <button 
                        onClick={() => handleGenerateImage(currentPage - 1)}
                        disabled={isGeneratingImg}
                        className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {isGeneratingImg ? <Loader2 className="animate-spin" size={20} /> : <Wand2 size={20} />}
                        Buat Ilustrasi
                      </button>
                    </div>
                  )}
                </div>

                {/* Text Side */}
                <div className="flex-1 p-12 flex flex-col justify-center bg-white">
                  <div className="flex justify-between items-start mb-6">
                    <span className="text-sm font-bold text-indigo-500 uppercase tracking-widest">Halaman {currentPage}</span>
                    <button 
                      onClick={() => handleNarration(currentPage - 1)}
                      disabled={isNarrating}
                      className="p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-all disabled:opacity-50"
                    >
                      {isNarrating ? <Loader2 className="animate-spin" size={20} /> : <Volume2 size={20} />}
                    </button>
                  </div>
                  <p className="text-2xl text-gray-800 leading-relaxed font-medium font-serif">
                    {currentBook.pages[currentPage - 1].content}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation Controls */}
        <button 
          onClick={handlePrev}
          disabled={currentPage === 0}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-4 bg-white rounded-full shadow-xl text-gray-800 hover:scale-110 disabled:opacity-0 transition-all z-10"
        >
          <ChevronLeft size={32} />
        </button>
        <button 
          onClick={handleNext}
          disabled={currentPage === totalPages}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-4 bg-white rounded-full shadow-xl text-gray-800 hover:scale-110 disabled:opacity-0 transition-all z-10"
        >
          <ChevronRight size={32} />
        </button>
      </div>

      {/* Page Thumbnails */}
      <div className="mt-12 flex gap-4 overflow-x-auto pb-4 px-2">
        <button 
          onClick={() => setCurrentPage(0)}
          className={cn(
            "flex-shrink-0 w-24 aspect-[3/4] rounded-xl border-4 transition-all overflow-hidden",
            currentPage === 0 ? "border-indigo-500 scale-105 shadow-lg" : "border-transparent opacity-60 hover:opacity-100"
          )}
        >
          <div className="w-full h-full bg-indigo-600 flex items-center justify-center text-white text-[10px] font-bold">SAMPUL</div>
        </button>
        {currentBook.pages.map((p, i) => (
          <button 
            key={p.id}
            onClick={() => setCurrentPage(i + 1)}
            className={cn(
              "flex-shrink-0 w-24 aspect-[3/4] rounded-xl border-4 transition-all overflow-hidden relative",
              currentPage === i + 1 ? "border-indigo-500 scale-105 shadow-lg" : "border-transparent opacity-60 hover:opacity-100"
            )}
          >
            {p.illustrationUrl ? (
              <img src={p.illustrationUrl} className="w-full h-full object-cover" alt={`P${i+1}`} />
            ) : (
              <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400 text-xs">{i + 1}</div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

const Wand2 = ({ size }: { size: number }) => <Sparkles size={size} />;
