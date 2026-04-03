import { useState, useEffect, useMemo, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { ClearNestLogo } from '@/components/ClearNestLogo';
import { Plus, Pencil, Trash2, X, LogOut, ImageOff, Loader2, Search } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BlogPost {
  id: string;
  title: string;
  description: string;
  category: string;
  picture_url: string | null;
  date_posted: string;
  created_at: string;
  updated_at: string;
}

interface PostForm {
  title: string;
  description: string;
  category: string;
  picture_url: string;
  date_posted: string;
}

const EMPTY_FORM: PostForm = {
  title: '',
  description: '',
  category: 'Guides',
  picture_url: '',
  date_posted: new Date().toISOString().slice(0, 10),
};

const CATEGORIES = [
  'Guides',
  'Real Stories',
  'ClearNest News',
  'Research',
  'Interviews',
  'Opinion',
  'Care Planning',
  'Legal & Financial',
  'Family',
  'News & Updates',
  'General',
];

// Solid accent colours for badges
const CATEGORY_COLOURS: Record<string, string> = {
  'Care Planning':    '#7C65A9',
  'Legal & Financial':'#5B8DB8',
  'Family':           '#E8896A',
  'News & Updates':   '#4CAF82',
  'ClearNest News':   '#E8896A',
  'Guides':           '#7C65A9',
  'General':          '#9CA3AF',
  'Real Stories':     '#5B8DB8',
  'Research':         '#F4A261',
  'Opinion':          '#4CAF82',
  'Interviews':       '#5B8DB8',
};

// Soft pastel card backgrounds (tinted)
const CATEGORY_BG: Record<string, string> = {
  'Care Planning':    '#EDE8F5',
  'Legal & Financial':'#E0EBF5',
  'Family':           '#FAE8E0',
  'News & Updates':   '#E0F2EC',
  'ClearNest News':   '#FDE8DC',
  'Guides':           '#EDE8F5',
  'General':          '#F3F4F6',
  'Real Stories':     '#DDEAF5',
  'Research':         '#FEF0E3',
  'Opinion':          '#E0F5EC',
  'Interviews':       '#E0EBF5',
};

// Filter pills shown above the grid
const FILTER_PILLS = ['All', 'Guides', 'Real Stories', 'ClearNest News', 'Research', 'Interviews', 'Opinion'];

// ─── Component ────────────────────────────────────────────────────────────────

const Blog = () => {
  const navigate = useNavigate();

  const [posts, setPosts]           = useState<BlogPost[]>([]);
  const [session, setSession]       = useState<Session | null>(null);
  const [loading, setLoading]       = useState(true);
  const [query, setQuery]           = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [showModal, setShowModal]   = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [form, setForm]             = useState<PostForm>(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formError, setFormError]   = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const isAdmin = session !== null;

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  // ── Fetch posts ───────────────────────────────────────────────────────────
  const fetchPosts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('blog_posts')
      .select('*')
      .order('date_posted', { ascending: false });
    setPosts((data as BlogPost[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchPosts(); }, []);

  // ── Filtered posts ────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return posts.filter(p => {
      const matchesFilter = activeFilter === 'All' || p.category === activeFilter;
      const matchesSearch = query === '' ||
        p.title.toLowerCase().includes(query.toLowerCase()) ||
        p.description.toLowerCase().includes(query.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [posts, activeFilter, query]);

  // ── Sign out ──────────────────────────────────────────────────────────────
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  // ── Modal helpers ─────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowModal(true);
  };

  const openEdit = (post: BlogPost) => {
    setEditingId(post.id);
    setForm({
      title:       post.title,
      description: post.description,
      category:    post.category,
      picture_url: post.picture_url ?? '',
      date_posted: post.date_posted,
    });
    setFormError(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!form.title.trim() || !form.description.trim()) {
      setFormError('Title and description are required.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title:       form.title.trim(),
        description: form.description.trim(),
        category:    form.category,
        picture_url: form.picture_url.trim() || null,
        date_posted: form.date_posted,
      };
      if (editingId) {
        const { error } = await supabase.from('blog_posts').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('blog_posts').insert(payload);
        if (error) throw error;
      }
      closeModal();
      fetchPosts();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to save post.');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const { error } = await supabase.from('blog_posts').delete().eq('id', id);
    if (!error) setPosts(prev => prev.filter(p => p.id !== id));
    setDeletingId(null);
    setConfirmDeleteId(null);
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const catColour = (cat: string) => CATEGORY_COLOURS[cat] ?? '#9CA3AF';
  const catBg     = (cat: string) => CATEGORY_BG[cat]     ?? '#F3F4F6';

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#F5F0EA', fontFamily: 'inherit' }}>

      {/* ── Admin dev-mode bar ──────────────────────────────────────────────── */}
      {isAdmin && (
        <div
          className="sticky top-0 z-40 flex items-center justify-between px-5 py-2.5 text-white text-sm font-medium shadow-md"
          style={{ background: '#1A1A2E' }}
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span>Dev Mode</span>
            <span className="opacity-50">·</span>
            <span className="opacity-70 text-xs">{session?.user.email}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={openCreate}
              className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 transition-colors rounded-full px-3 py-1 text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              New post
            </button>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 hover:opacity-70 transition-opacity text-xs"
              aria-label="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          </div>
        </div>
      )}

      {/* ── Navbar ──────────────────────────────────────────────────────────── */}
      <nav style={{ background: '#F5F0EA' }} className="sticky top-0 z-30 border-b border-black/5">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <ClearNestLogo variant="small" />
          </button>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium" style={{ color: '#3D3D3D' }}>
            <a href="/#how-it-works" className="hover:opacity-70 transition-opacity">How it works</a>
            <a href="/#features" className="hover:opacity-70 transition-opacity">What Clara covers</a>
            <span style={{ color: '#6C5CE7', fontWeight: 600 }}>Blog</span>
          </div>
          <button
            onClick={() => navigate('/')}
            className="text-sm font-semibold text-white px-5 py-2 rounded-full transition-opacity hover:opacity-90"
            style={{ background: '#3D3D3D' }}
          >
            Priority access
          </button>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-6 pt-12 pb-10">
        <div
          className="inline-block text-xs font-semibold px-3 py-1 rounded-full mb-4"
          style={{ background: '#EDE8F5', color: '#6C5CE7' }}
        >
          From the ClearNest team
        </div>
        <h1
          className="font-display text-4xl md:text-5xl font-bold mb-3 leading-tight"
          style={{ color: '#1A1A2E' }}
        >
          Guides for families
        </h1>
        <p className="text-base mb-8" style={{ color: '#5A5A6E', maxWidth: 520 }}>
          Practical advice on getting your family's affairs in order — before it becomes urgent.
        </p>

        {/* Search */}
        <div className="relative mb-7" style={{ maxWidth: 440 }}>
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#9CA3AF' }} />
          <input
            type="text"
            placeholder="Search articles..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-full border border-black/10 bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
            style={{ color: '#1A1A2E' }}
          />
        </div>

        {/* Filter pills */}
        <div className="flex flex-wrap gap-2">
          {FILTER_PILLS.map(pill => (
            <button
              key={pill}
              onClick={() => setActiveFilter(pill)}
              className="text-sm px-4 py-1.5 rounded-full border transition-colors font-medium"
              style={
                activeFilter === pill
                  ? { background: '#3D3D3D', color: '#fff', borderColor: '#3D3D3D' }
                  : { background: 'transparent', color: '#3D3D3D', borderColor: '#C4BFBA' }
              }
            >
              {pill}
            </button>
          ))}
        </div>
      </div>

      {/* ── Posts grid ──────────────────────────────────────────────────────── */}
      <div style={{ background: '#fff' }}>
        <div className="max-w-6xl mx-auto px-6 py-12">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="rounded-2xl overflow-hidden animate-pulse">
                  <div className="h-44" style={{ background: '#E5E7EB' }} />
                  <div className="p-4 space-y-2">
                    <div className="h-3 rounded" style={{ background: '#E5E7EB', width: '40%' }} />
                    <div className="h-4 rounded" style={{ background: '#E5E7EB' }} />
                    <div className="h-4 rounded" style={{ background: '#E5E7EB', width: '75%' }} />
                    <div className="h-3 rounded mt-2" style={{ background: '#E5E7EB', width: '60%' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-muted-foreground text-lg">
                {query || activeFilter !== 'All' ? 'No posts match your search.' : 'No posts yet.'}
              </p>
              {isAdmin && !query && activeFilter === 'All' && (
                <button
                  onClick={openCreate}
                  className="mt-4 bg-accent text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-primary transition-colors flex items-center gap-2 mx-auto"
                >
                  <Plus className="w-4 h-4" /> Create first post
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {filtered.map(post => (
                <article
                  key={post.id}
                  className="group relative rounded-2xl overflow-hidden cursor-pointer transition-transform hover:-translate-y-0.5"
                  style={{ background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}
                >
                  {!isAdmin && (
                    <a
                      href={`/blog-post.html?id=${encodeURIComponent(post.id)}`}
                      className="absolute inset-0 z-[1] rounded-2xl"
                      aria-label={`Read more: ${post.title}`}
                    />
                  )}
                  {/* Card image area */}
                  <div
                    className={`relative z-[2] w-full h-44 overflow-hidden flex items-end p-3 ${!isAdmin ? 'pointer-events-none' : ''}`}
                    style={{ background: catBg(post.category) }}
                  >
                    {post.picture_url ? (
                      <img
                        src={post.picture_url}
                        alt={post.title}
                        className="absolute inset-0 w-full h-full object-cover"
                        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <ImageOff className="w-8 h-8 opacity-20" style={{ color: catColour(post.category) }} />
                      </div>
                    )}
                    {/* Category badge */}
                    <span
                      className="relative z-10 text-xs font-semibold px-2.5 py-1 rounded-full text-white"
                      style={{ background: catColour(post.category) }}
                    >
                      {post.category}
                    </span>
                  </div>

                  {/* Card body */}
                  <div className={`p-4 relative z-[2] ${!isAdmin ? 'pointer-events-none' : ''}`}>
                    <h2
                      className="font-display font-semibold text-sm leading-snug line-clamp-3 mb-2"
                      style={{ color: '#1A1A2E' }}
                    >
                      {post.title}
                    </h2>
                    <p className="text-xs leading-relaxed line-clamp-3 mb-3" style={{ color: '#6B7280' }}>
                      {post.description}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium" style={{ color: '#6C5CE7' }}>
                        Read more →
                      </span>
                      <span className="text-xs" style={{ color: '#9CA3AF' }}>{formatDate(post.date_posted)}</span>
                    </div>
                  </div>

                  {/* Admin edit / delete overlay */}
                  {isAdmin && (
                    <div className="absolute inset-0 z-[3] bg-black/0 group-hover:bg-black/10 transition-colors rounded-2xl">
                      <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={e => { e.stopPropagation(); openEdit(post); }}
                          className="w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center hover:bg-purple-600 hover:text-white transition-colors"
                          aria-label="Edit post"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); setConfirmDeleteId(post.id); }}
                          className="w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors"
                          aria-label="Delete post"
                        >
                          {deletingId === post.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ background: '#fff', borderTop: '1px solid #E5E7EB' }}>
        <div className="max-w-6xl mx-auto px-6 py-6 text-center text-xs" style={{ color: '#9CA3AF' }}>
          © 2026 Pannonl Ltd ·{' '}
          <a href="/admin" className="underline underline-offset-2 hover:opacity-80">Admin</a>
          {' '}·{' '}
          <a href="/privacy-policy.md" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:opacity-80">Privacy Policy</a>
          {' '}·{' '}
          <a href="/terms-of-service.md" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:opacity-80">Terms of Service</a>
        </div>
      </div>

      {/* ── Create / Edit modal ──────────────────────────────────────────────── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4 py-8 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="post-modal-title"
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
              <h2 id="post-modal-title" className="font-display text-lg font-semibold" style={{ color: '#1A1A2E' }}>
                {editingId ? 'Edit post' : 'New post'}
              </h2>
              <button
                onClick={closeModal}
                className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="px-6 py-5 flex flex-col gap-4">
              {/* Title */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium" style={{ color: '#1A1A2E' }} htmlFor="post-title">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  id="post-title"
                  type="text"
                  required
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. How to set up a Lasting Power of Attorney"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
                />
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium" style={{ color: '#1A1A2E' }} htmlFor="post-desc">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="post-desc"
                  required
                  rows={4}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="A summary of what this post covers…"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 resize-none"
                />
              </div>

              {/* Category + Date */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium" style={{ color: '#1A1A2E' }} htmlFor="post-cat">Category</label>
                  <select
                    id="post-cat"
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium" style={{ color: '#1A1A2E' }} htmlFor="post-date">Date posted</label>
                  <input
                    id="post-date"
                    type="date"
                    required
                    value={form.date_posted}
                    onChange={e => setForm(f => ({ ...f, date_posted: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
                  />
                </div>
              </div>

              {/* Picture URL */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium" style={{ color: '#1A1A2E' }} htmlFor="post-pic">
                  Picture URL <span className="text-sm font-normal text-gray-400">(optional)</span>
                </label>
                <input
                  id="post-pic"
                  type="url"
                  value={form.picture_url}
                  onChange={e => setForm(f => ({ ...f, picture_url: e.target.value }))}
                  placeholder="https://…"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
                />
                {form.picture_url && (
                  <img
                    src={form.picture_url}
                    alt="Preview"
                    className="mt-1 h-24 w-full object-cover rounded-lg border border-gray-200"
                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
              </div>

              {formError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {formError}
                </p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 border border-gray-200 font-medium py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
                  style={{ color: '#1A1A2E' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{ background: '#6C5CE7' }}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create post'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete confirmation ──────────────────────────────────────────────── */}
      {confirmDeleteId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-5 h-5 text-red-500" />
            </div>
            <h2 className="font-display text-lg font-semibold mb-2" style={{ color: '#1A1A2E' }}>Delete this post?</h2>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              This cannot be undone. The post will be permanently removed.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 border border-gray-200 font-medium py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
                style={{ color: '#1A1A2E' }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                disabled={!!deletingId}
                className="flex-1 bg-red-500 text-white font-semibold py-2.5 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {deletingId ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {deletingId ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Blog;
