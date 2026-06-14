import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  Settings,
  LayoutDashboard,
  FileUp,
  CheckCircle2,
  MessageSquare,
  Book,
  HelpCircle,
  LogOut,
  FlaskConical,
  Search,
  Plus,
  CheckCircle,
  MoreHorizontal,
  X,
  Trash2,
  Loader2,
  Download,
} from 'lucide-react';
import {
  fetchGlossary,
  addGlossaryTerm,
  updateGlossaryTerm,
  deleteGlossaryTerm,
} from '../services/api';
import { TARGET_LANGUAGES } from '../constants/languages';
import UserProfileBlock from '../components/UserProfileBlock';
import { useAuth } from '../context/AuthContext';

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = ['TECHNICAL', 'LEGAL', 'ESG', 'MARKETING', 'GENERAL'];
const ITEMS_PER_PAGE = 8;

// ── Add Term Modal ────────────────────────────────────────────────────────────

function AddTermModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    source_term: '',
    target_term: '',
    target_lang: '',
    category: 'TECHNICAL',
    status: 'PENDING',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.source_term.trim() || !form.target_term.trim() || !form.target_lang.trim()) {
      setError('Source term, translation, and target language are required.');
      return;
    }

    // Split target languages by comma to allow multiple at once
    const langs = form.target_lang.split(',').map(l => l.trim().toLowerCase()).filter(Boolean);
    if (langs.length === 0) {
      setError('Please provide at least one valid target language.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const createdTerms = [];
      for (const lang of langs) {
        const payload = { ...form, target_lang: lang };
        const created = await addGlossaryTerm(payload);
        createdTerms.push(created);
      }
      onSave(createdTerms); // Passing an array of created terms
    } catch (err) {
      setError(err.message || 'Failed to save term(s).');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full bg-[#1a1a1a] border border-[#262626] focus:border-[#c5fe00] focus:outline-none rounded-[12px] px-4 py-3 text-[14px] text-white placeholder:text-[#555555] transition-colors";
  const labelCls = "text-[#555555] font-bold text-[9px] uppercase tracking-widest mb-2 block";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#111111] border border-[#262626] rounded-[32px] p-8 w-full max-w-md shadow-[0_0_60px_rgba(0,0,0,0.8)] relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h2 className="font-display font-bold text-[20px] tracking-tight">Add New Term</h2>
          <button onClick={onClose} className="text-[#555555] hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="bg-[#1a0a0a] border border-[#4a1010] rounded-[12px] px-4 py-3 text-[#ff6b6b] text-[13px] mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className={labelCls}>Source Term (EN)</label>
            <input
              className={inputCls}
              placeholder="e.g. Neural Interface"
              value={form.source_term}
              onChange={e => setForm(f => ({ ...f, source_term: e.target.value }))}
            />
          </div>

          <div>
            <label className={labelCls}>Translation</label>
            <input
              className={inputCls}
              placeholder="e.g. Interface Neurale"
              value={form.target_term}
              onChange={e => setForm(f => ({ ...f, target_term: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Target Language</label>
              <input
                className={inputCls}
                placeholder="fr, de, es..."
                list="glossary-target-lang-options"
                value={form.target_lang}
                onChange={e => setForm(f => ({ ...f, target_lang: e.target.value }))}
              />
              <datalist id="glossary-target-lang-options">
                {TARGET_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.label}
                  </option>
                ))}
              </datalist>
            </div>
            <div>
              <label className={labelCls}>Category</label>
              <select
                className={`${inputCls} cursor-pointer`}
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-[#262626] text-[#8c8c8b] hover:text-white hover:border-[#333333] rounded-full py-3 font-bold text-[12px] uppercase tracking-widest transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-[#c5fe00] hover:bg-[#b9ef00] text-[#0a0a0a] rounded-full py-3 font-bold text-[12px] uppercase tracking-widest transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} strokeWidth={2.5} />}
              {saving ? 'Saving…' : 'Add Term'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

function GlossaryPage() {
  const { accessToken } = useAuth();
  const [terms, setTerms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const searchTimer = useRef(null);

  // ── Load terms ──────────────────────────────────────────────────────────────
  const loadTerms = async (searchQuery = '') => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchGlossary({ search: searchQuery || undefined });
      setTerms(data.terms ?? []);
      setPage(1);
    } catch (err) {
      setError(err.message || 'Failed to load glossary.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (accessToken) loadTerms(); }, [accessToken]);

  // Debounced search
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadTerms(val), 400);
  };

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await deleteGlossaryTerm(id);
      setTerms(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      alert(err.message || 'Delete failed.');
    } finally {
      setDeletingId(null);
    }
  };

  // ── Toggle status ───────────────────────────────────────────────────────────
  const handleToggleStatus = async (term) => {
    const newStatus = term.status === 'VERIFIED' ? 'PENDING' : 'VERIFIED';
    setTogglingId(term.id);
    try {
      const updated = await updateGlossaryTerm(term.id, { status: newStatus });
      setTerms(prev => prev.map(t => t.id === term.id ? { ...t, ...updated } : t));
    } catch (err) {
      alert(err.message || 'Update failed.');
    } finally {
      setTogglingId(null);
    }
  };

  // ── Add term callback ───────────────────────────────────────────────────────
  const handleSaved = (newTerms) => {
    if (Array.isArray(newTerms)) {
      setTerms(prev => [...newTerms, ...prev]);
    } else {
      setTerms(prev => [newTerms, ...prev]);
    }
    setShowModal(false);
  };

  // ── Pagination ──────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(terms.length / ITEMS_PER_PAGE));
  const paginated = terms.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  // ── Sidebar stats ───────────────────────────────────────────────────────────
  const verifiedCount = terms.filter(t => t.status === 'VERIFIED').length;
  const pendingCount  = terms.filter(t => t.status === 'PENDING').length;

  return (
    <div className="h-screen bg-[#0a0a0a] text-[#ffffff] font-sans flex overflow-hidden selection:bg-[#c5fe00] selection:text-[#0a0a0a]">

      {showModal && <AddTermModal onClose={() => setShowModal(false)} onSave={handleSaved} />}

      {/* Left Sidebar */}
      <aside className="w-[260px] border-r border-[#262626] border-opacity-50 flex flex-col shrink-0 bg-[#0a0a0a] hidden md:flex z-50 overflow-y-auto layout-scrollbar">
        <div className="p-6 pb-2 flex-1 flex flex-col">

          {/* Logo / Branding */}
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-full bg-[#c5fe00] text-[#0a0a0a] flex items-center justify-center p-2 shadow-[0_0_20px_rgba(197,254,0,0.2)]">
              <FlaskConical strokeWidth={2.5} size={22} />
            </div>
            <div className="flex flex-col">
              <span className="font-display text-[#c5fe00] font-black text-sm tracking-tight leading-none mb-1">TransSync</span>
              <span className="text-[#555555] font-bold text-[9px] uppercase tracking-widest leading-none">AI Studio</span>
            </div>
          </div>

          {/* Menu Items */}
          <nav className="space-y-1">
            <Link to="/dashboard" className="flex items-center gap-4 text-[#8c8c8b] hover:text-[#ffffff] hover:bg-[#131313] transition-colors px-4 py-3 rounded-[12px] cursor-pointer">
              <LayoutDashboard size={18} />
              <span className="text-[11px] font-bold uppercase tracking-widest">Dashboard</span>
            </Link>

            <Link to="/upload" className="flex items-center gap-4 text-[#8c8c8b] hover:text-[#ffffff] hover:bg-[#131313] transition-colors px-4 py-3 rounded-[12px] cursor-pointer">
              <FileUp size={18} />
              <span className="text-[11px] font-bold uppercase tracking-widest">Upload</span>
            </Link>

            <Link to="/validation" className="flex items-center gap-4 text-[#8c8c8b] hover:text-[#ffffff] hover:bg-[#131313] transition-colors px-4 py-3 rounded-[12px] cursor-pointer">
              <CheckCircle2 size={18} />
              <span className="text-[11px] font-bold uppercase tracking-widest">Validation</span>
            </Link>

            <Link to="/review" className="flex items-center gap-4 text-[#8c8c8b] hover:text-[#ffffff] hover:bg-[#131313] transition-colors px-4 py-3 rounded-[12px] cursor-pointer">
              <MessageSquare size={18} />
              <span className="text-[11px] font-bold uppercase tracking-widest">Review</span>
            </Link>

            {/* Active Item */}
            <div className="flex items-center gap-4 bg-[#1a1c10] text-[#c5fe00] border border-[#2a2e16] px-4 py-3 rounded-[12px] cursor-pointer shadow-[inset_0_0_10px_rgba(197,254,0,0.05)]">
              <Book size={18} />
              <span className="text-[11px] font-bold uppercase tracking-widest">Glossary</span>
            </div>

            <Link to="/export" className="flex items-center gap-4 text-[#8c8c8b] hover:text-[#ffffff] hover:bg-[#131313] transition-colors px-4 py-3 rounded-[12px] cursor-pointer">
              <Download size={18} />
              <span className="text-[11px] font-bold uppercase tracking-widest">Export</span>
            </Link>
          </nav>
        </div>

        <div className="p-6 space-y-1 pb-8">

          <UserProfileBlock />
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col relative w-full h-full overflow-hidden bg-[#0e0e0e]">

        {/* Top Nav */}
        <nav className="h-[80px] w-full flex items-center justify-between px-8 bg-transparent z-40 relative">

          <div className="w-1/3"></div>

          {/* Centered Search */}
          <div className="w-[400px] bg-[#1a1a1a] border border-[#262626] focus-within:border-[#c5fe00] transition-colors rounded-full flex items-center px-4 py-2.5 gap-3">
            <Search size={16} className="text-[#555555] shrink-0" />
            <input
              type="text"
              placeholder="Search glossary terms..."
              value={search}
              onChange={handleSearchChange}
              className="bg-transparent border-none text-[#ffffff] focus:outline-none w-full text-[13px] placeholder:text-[#555555]"
            />
            {search && (
              <button onClick={() => { setSearch(''); loadTerms(''); }} className="text-[#555555] hover:text-white transition-colors">
                <X size={14} />
              </button>
            )}
          </div>

          <div className="w-1/3 flex justify-end items-center gap-6">
            <button className="text-[#8c8c8b] hover:text-[#ffffff] transition-colors"><Bell size={18} /></button>
            <button className="text-[#8c8c8b] hover:text-[#ffffff] transition-colors"><HelpCircle size={18} /></button>
            <button className="text-[#8c8c8b] hover:text-[#ffffff] transition-colors"><Settings size={18} /></button>
            <button className="w-8 h-8 rounded-full bg-[#1a1a1a] border border-[#262626] overflow-hidden ml-2">
              <img src="https://i.pravatar.cc/150?img=11" alt="User Avatar" className="w-full h-full object-cover" />
            </button>
          </div>
        </nav>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto layout-scrollbar pb-16">
          <div className="p-8 lg:p-12 max-w-[1400px] mx-auto relative pt-4">

            {/* Glow */}
            <div className="absolute top-0 left-[20%] w-[600px] h-[400px] bg-[#c5fe00] opacity-[0.05] blur-[150px] rounded-full pointer-events-none z-0"></div>

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 relative z-10 gap-6">
              <div>
                <h1 className="font-display font-black text-5xl tracking-tight mb-3">glossary <br className="hidden md:block"/>management</h1>
                <p className="text-[#8c8c8b] text-[15px] font-sans">Centralized linguistic assets for TransSync global projects.</p>
              </div>
              <button
                onClick={() => setShowModal(true)}
                className="bg-[#c5fe00] hover:bg-[#b9ef00] text-[#0a0a0a] rounded-full px-6 py-3.5 font-bold flex items-center gap-2 text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(197,254,0,0.2)] hover:scale-[1.02] transform transition-all whitespace-nowrap"
              >
                <Plus size={16} strokeWidth={2.5} /> Add New Term
              </button>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="bg-[#1a0a0a] border border-[#4a1010] rounded-[16px] px-6 py-4 mb-8 relative z-10">
                <span className="text-[#ff6b6b] text-sm">{error}</span>
              </div>
            )}

            {/* Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">

              {/* Data Table */}
              <div className="lg:col-span-8 bg-[#111111] border border-[#1a1a1a] rounded-[32px] p-8 min-h-[600px] flex flex-col shadow-[0_0_40px_rgba(0,0,0,0.5)]">

                {/* Table Headers */}
                <div className="grid grid-cols-4 gap-4 px-6 pb-6 border-b border-[#262626]">
                  <span className="text-[#555555] font-bold text-[9px] uppercase tracking-widest col-span-1">Source (EN)</span>
                  <span className="text-[#555555] font-bold text-[9px] uppercase tracking-widest col-span-1">Translation</span>
                  <span className="text-[#555555] font-bold text-[9px] uppercase tracking-widest col-span-1">Category</span>
                  <span className="text-[#555555] font-bold text-[9px] uppercase tracking-widest col-span-1">Status</span>
                </div>

                {/* Table Body */}
                <div className="flex-1 flex flex-col pt-2">
                  {loading ? (
                    // Skeleton rows
                    [1,2,3,4,5].map(i => (
                      <div key={i} className="grid grid-cols-4 items-center gap-4 px-6 py-8 border-b border-[#1a1a1a] animate-pulse">
                        <div className="h-4 w-28 bg-[#1e1e1e] rounded col-span-1"></div>
                        <div className="h-4 w-24 bg-[#1a1a1a] rounded col-span-1"></div>
                        <div className="h-5 w-16 bg-[#1a1a1a] rounded-full col-span-1"></div>
                        <div className="h-4 w-16 bg-[#1a1a1a] rounded col-span-1"></div>
                      </div>
                    ))
                  ) : paginated.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
                      <Book size={32} className="text-[#333333] mb-4" />
                      <p className="text-[#555555] text-[15px] mb-2">
                        {search ? `No terms matching "${search}"` : 'No glossary terms yet.'}
                      </p>
                      {!search && (
                        <button
                          onClick={() => setShowModal(true)}
                          className="text-[#c5fe00] text-[11px] font-bold uppercase tracking-widest hover:underline mt-1"
                        >
                          Add the first term →
                        </button>
                      )}
                    </div>
                  ) : (
                    paginated.map((term) => (
                      <div key={term.id} className="grid grid-cols-4 items-center gap-4 px-6 py-6 border-b border-[#1a1a1a] hover:bg-[#151515] transition-colors group">

                        {/* Col 1: Source */}
                        <div className="col-span-1">
                          <span className="text-white font-bold text-[14px] tracking-wide">{term.source_term}</span>
                          <p className="text-[#555555] text-[10px] font-bold uppercase tracking-widest mt-0.5">{term.target_lang}</p>
                        </div>

                        {/* Col 2: Translation */}
                        <div className="col-span-1 pr-4">
                          <span className="text-[#a0a09f] text-[14px]">{term.target_term}</span>
                        </div>

                        {/* Col 3: Category */}
                        <div className="col-span-1">
                          <span className="bg-[#1a1a1a] border border-[#262626] text-[#8c8c8b] text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full inline-block">
                            {term.category || '—'}
                          </span>
                        </div>

                        {/* Col 4: Status + Actions */}
                        <div className="col-span-1 flex items-center justify-between">
                          <button
                            onClick={() => handleToggleStatus(term)}
                            disabled={togglingId === term.id}
                            title="Click to toggle status"
                            className="flex items-center gap-2 transition-opacity hover:opacity-70 disabled:opacity-40"
                          >
                            {togglingId === term.id ? (
                              <Loader2 size={14} className="animate-spin text-[#555555]" />
                            ) : term.status === 'VERIFIED' ? (
                              <div className="flex items-center gap-2 text-[#c5fe00]">
                                <CheckCircle size={14} />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Verified</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-[#ffd166]">
                                <MoreHorizontal size={14} />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Pending</span>
                              </div>
                            )}
                          </button>

                          {/* Delete button - visible on hover */}
                          <button
                            onClick={() => handleDelete(term.id)}
                            disabled={deletingId === term.id}
                            title="Delete term"
                            className="opacity-0 group-hover:opacity-100 text-[#555555] hover:text-[#ff6b6b] transition-all ml-2 disabled:opacity-40"
                          >
                            {deletingId === term.id
                              ? <Loader2 size={14} className="animate-spin" />
                              : <Trash2 size={14} />
                            }
                          </button>
                        </div>

                      </div>
                    ))
                  )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="pt-8 flex items-center justify-center gap-2 mt-auto">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-colors ${
                          p === page
                            ? 'bg-[#1a1c10] text-[#c5fe00] border border-[#2a2e16] shadow-[inset_0_0_10px_rgba(197,254,0,0.05)]'
                            : 'text-[#8c8c8b] hover:text-white'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                )}

              </div>

              {/* Insights Column */}
              <div className="lg:col-span-4 flex flex-col gap-6">

                {/* Stats Card */}
                <div className="bg-[#15170d] border border-[#2a2e16] rounded-[32px] p-8 shadow-[0_20px_40px_rgba(197,254,0,0.02)]">
                  <h4 className="text-[#c5fe00] font-bold text-[10px] uppercase tracking-widest mb-6">Linguistic Asset Insights</h4>

                  <div className="flex justify-between items-end mb-8">
                    <span className="text-[#a0a09f] text-[13px] font-medium">Total Terms</span>
                    <span className="font-display font-black text-3xl text-[#c5fe00]">
                      {loading ? '…' : terms.length.toLocaleString()}
                    </span>
                  </div>

                  {/* Mini bar chart placeholder — could be replaced with real monthly data */}
                  <div className="h-28 flex items-end gap-[2px] md:gap-1.5 mb-2 px-1">
                    {['35%', '50%', '45%', '70%', '85%', '90%', '80%', '95%'].map((height, i) => (
                      <div key={i} className="flex-1 bg-[#262b14] hover:bg-[#32381c] rounded-t-sm transition-colors" style={{ height }}></div>
                    ))}
                  </div>
                  <div className="flex justify-between text-[#555555] text-[9px] font-bold uppercase tracking-widest mb-8 px-1">
                    <span>Jan</span><span>Jun</span><span>Dec</span>
                  </div>

                  <div className="space-y-3">
                    <div className="bg-[#11130a] border border-[#1a1c10] rounded-[20px] p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#c5fe00]"></div>
                        <span className="text-[#8c8c8b] text-[12px] font-medium">Verified Terms</span>
                      </div>
                      <span className="font-bold text-[16px] text-white tracking-widest">
                        {loading ? '…' : verifiedCount}
                      </span>
                    </div>

                    <div className="bg-[#111111] border border-[#1a1a1a] rounded-[20px] p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#ffd166]"></div>
                        <span className="text-[#8c8c8b] text-[12px] font-medium">Pending Review</span>
                      </div>
                      <span className="font-bold text-[16px] text-white tracking-widest">
                        {loading ? '…' : pendingCount}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sub Metrics */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#151515] border border-[#1a1a1a] rounded-[24px] p-6">
                    <span className="text-[#555555] font-bold text-[8px] uppercase tracking-widest mb-2 block">Total Terms</span>
                    <span className="font-display font-black text-2xl tracking-tight">
                      {loading ? '…' : terms.length.toLocaleString()}
                    </span>
                  </div>
                  <div className="bg-[#151515] border border-[#1a1a1a] rounded-[24px] p-6">
                    <span className="text-[#555555] font-bold text-[8px] uppercase tracking-widest mb-2 block">Verify Rate</span>
                    <span className="font-display font-black text-2xl tracking-tight flex items-end gap-1">
                      {loading || terms.length === 0
                        ? '—'
                        : `${Math.round((verifiedCount / terms.length) * 100)}%`
                      }
                    </span>
                  </div>
                </div>

                {/* Map decoration */}
                <div className="bg-[#0c0c0c] border border-[#1a1a1a] rounded-[32px] overflow-hidden relative h-[220px] group">
                  <img src="/map.png" alt="Global Sync Status Web Nodes" className="w-full h-full object-cover opacity-60 mix-blend-screen scale-110 group-hover:scale-100 transition-transform duration-[2s]" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent"></div>
                  <div className="absolute bottom-6 left-6 z-10">
                    <span className="text-[#c5fe00] font-bold text-[10px] uppercase tracking-widest mb-1 shadow-[0_2px_4px_rgba(0,0,0,1)] block">Global Sync Status</span>
                    <span className="text-[#a0a09f] text-[10px] font-medium shadow-[0_2px_4px_rgba(0,0,0,1)]">All nodes operational</span>
                  </div>
                </div>

              </div>

            </div>
          </div>
        </div>

      </div>

    </div>
  );
}

export default GlossaryPage;
