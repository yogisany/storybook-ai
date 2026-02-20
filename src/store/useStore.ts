import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface Page {
  id: string;
  pageNumber: number;
  content: string;
  illustrationUrl: string | null;
  illustrationPrompt: string;
  narrationUrl?: string | null;
}

interface Book {
  id: string;
  title: string;
  theme: string;
  targetAge: string;
  moral: string;
  coverUrl: string | null;
  coverPrompt: string;
  characterDescription: string;
  pages: Page[];
}

interface User {
  id: string;
  name: string;
  email: string;
  phoneNumber?: string;
  avatarUrl?: string | null;
  role: 'admin' | 'user';
  credits: number;
}

interface BrandSettings {
  name: string;
  tagline: string;
  logoUrl: string;
  groqApiKey?: string;
  freepikApiKey?: string;
}

interface StoryState {
  user: User | null;
  brandSettings: BrandSettings;
  currentBook: Book | null;
  myBooks: Book[];
  isLoading: boolean;
  error: string | null;
  
  setUser: (user: User | null) => void;
  updateUser: (updates: Partial<User>) => void;
  updateBrand: (updates: Partial<BrandSettings>) => void;
  setCurrentBook: (book: Book | null) => void;
  setMyBooks: (books: Book[]) => void;
  fetchBooks: () => Promise<void>;
  fetchBrandSettings: () => Promise<void>;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  addBook: (book: Book) => void;
  updateBook: (bookId: string, updates: Partial<Book>) => void;
  updatePage: (pageId: string, updates: Partial<Page>) => void;
}

export const useStore = create<StoryState>((set, get) => ({
  user: null,
  brandSettings: {
    name: 'Kisah Ai',
    tagline: 'by Erna',
    logoUrl: 'https://storage.googleapis.com/generativeai-downloads/images/sfx-logo.png',
    groqApiKey: '',
    freepikApiKey: ''
  },
  currentBook: null,
  myBooks: [],
  isLoading: false,
  error: null,

  setUser: (user) => set({ user }),
  updateUser: (updates) => set((state) => ({
    user: state.user ? { ...state.user, ...updates } : null
  })),
  updateBrand: (updates) => set((state) => ({
    brandSettings: { ...state.brandSettings, ...updates }
  })),
  setCurrentBook: (book) => set({ currentBook: book }),
  setMyBooks: (books) => set({ myBooks: books }),
  
  fetchBrandSettings: async () => {
    try {
      const { data, error } = await supabase
        .from('brand_settings')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        set({
          brandSettings: {
            name: data.name,
            tagline: data.tagline,
            logoUrl: data.logo_url,
            groqApiKey: data.groq_api_key || '',
            freepikApiKey: data.freepik_api_key || ''
          }
        });
      }
    } catch (err) {
      // Ignore error if table doesn't exist yet, fallback to defaults
      console.log("Brand settings not found or table missing");
    }
  },

  fetchBooks: async () => {
    const { user } = get();
    if (!user) return;
    
    set({ isLoading: true });
    try {
      const { data: books, error: booksError } = await supabase
        .from('books')
        .select(`
          *,
          pages (*)
        `)
        .order('created_at', { ascending: false });

      if (booksError) throw booksError;
      
      const mappedBooks: Book[] = (books || []).map((b: any) => ({
        id: b.id,
        title: b.title,
        theme: b.theme,
        targetAge: b.target_age,
        moral: b.moral,
        coverUrl: b.cover_url,
        coverPrompt: b.cover_prompt,
        characterDescription: b.character_description,
        pages: (b.pages || []).map((p: any) => ({
          id: p.id,
          pageNumber: p.page_number,
          content: p.content,
          illustrationUrl: p.illustration_url,
          illustrationPrompt: p.illustration_prompt,
          narrationUrl: p.narration_url
        })).sort((p1: any, p2: any) => p1.pageNumber - p2.pageNumber)
      }));

      set({ myBooks: mappedBooks });
    } catch (err: any) {
      set({ error: err.message });
    } finally {
      set({ isLoading: false });
    }
  },

  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  
  addBook: (book) => set((state) => ({ myBooks: [book, ...state.myBooks] })),
  updateBook: (bookId, updates) => set((state) => {
    const updatedBooks = state.myBooks.map(b => 
      b.id === bookId ? { ...b, ...updates } : b
    );
    const updatedCurrentBook = state.currentBook?.id === bookId 
      ? { ...state.currentBook, ...updates } 
      : state.currentBook;
      
    return {
      myBooks: updatedBooks,
      currentBook: updatedCurrentBook
    };
  }),
  updatePage: (pageId, updates) => set((state) => {
    if (!state.currentBook) return state;
    const updatedPages = state.currentBook.pages.map(p => 
      p.id === pageId ? { ...p, ...updates } : p
    );
    return {
      currentBook: { ...state.currentBook, pages: updatedPages }
    };
  }),
}));
