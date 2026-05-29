import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { translateSentences } from '../services/api';
import { useAppContext } from '../context/AppContext';
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
  Zap,
  History,
  Languages,
  CheckCircle,
  MoreHorizontal,
  Sparkles
} from 'lucide-react';

function ReviewPage() {
  const [isTranslating, setIsTranslating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const {
    sentences,
    results,
    setResults,
    sourceLang,
    targetLang,
  } = useAppContext();

  const hasResults = results && results.length > 0;

  useEffect(() => {
    const runTranslation = async () => {
      if (!sentences || sentences.length === 0) {
        setErrorMessage('No validated sentences found. Please validate the document first.');
        return;
      }

      if (!targetLang) {
        setErrorMessage('Target language is missing. Please select a language.');
        return;
      }

      if (hasResults) {
        return;
      }

      setIsTranslating(true);
      setErrorMessage('');

      try {
        const response = await translateSentences(sentences, sourceLang, targetLang);
        setResults(response.results || []);
      } catch (error) {
        setErrorMessage(error.message || 'Translation failed.');
      } finally {
        setIsTranslating(false);
      }
    };

    runTranslation();
  }, [sentences, sourceLang, targetLang, hasResults, setResults]);

  const displayResults = useMemo(() => {
    if (hasResults) {
      return results;
    }
    return [];
  }, [hasResults, results]);

  const matchLabel = (matchType) => {
    if (!matchType) {
      return 'Pending';
    }

    return matchType.replace('_', ' ').toUpperCase();
  };

  return (
    <div className="h-screen bg-[#0a0a0a] text-[#ffffff] font-sans flex overflow-hidden selection:bg-[#c5fe00] selection:text-[#0a0a0a]">
      
      {/* Left Sidebar */}
      <aside className="w-[260px] border-r border-[#262626] border-opacity-50 flex flex-col shrink-0 bg-[#0a0a0a] hidden md:flex z-50">
        <div className="p-6 pb-2 flex-1 flex flex-col">
          
          {/* Logo / Branding */}
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-full bg-[#c5fe00] text-[#0a0a0a] flex items-center justify-center p-2 shadow-[0_0_20px_rgba(197,254,0,0.2)]">
              <Sparkles strokeWidth={2.5} size={22} />
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

            {/* Active Item */}
            <div className="flex items-center gap-4 bg-[#1a1c10] text-[#c5fe00] border border-[#2a2e16] px-4 py-3 rounded-[12px] cursor-pointer shadow-[inset_0_0_10px_rgba(197,254,0,0.05)]">
              <MessageSquare size={18} />
              <span className="text-[11px] font-bold uppercase tracking-widest">Review</span>
            </div>

            <Link to="/glossary" className="flex items-center gap-4 text-[#8c8c8b] hover:text-[#ffffff] hover:bg-[#131313] transition-colors px-4 py-3 rounded-[12px] cursor-pointer">
              <Book size={18} />
              <span className="text-[11px] font-bold uppercase tracking-widest">Glossary</span>
            </Link>
          </nav>
        </div>

        <div className="p-6 space-y-1 pb-8">
           {/* Bottom Links */}
           <div className="flex items-center gap-4 text-[#8c8c8b] hover:text-[#ffffff] hover:bg-[#131313] transition-colors px-4 py-3 rounded-[12px] cursor-pointer">
              <HelpCircle size={18} />
              <span className="text-[11px] font-bold uppercase tracking-widest">Help</span>
            </div>
            <div className="flex items-center gap-4 text-[#8c8c8b] hover:text-[#ffffff] hover:bg-[#131313] transition-colors px-4 py-3 rounded-[12px] cursor-pointer">
              <LogOut size={18} />
              <span className="text-[11px] font-bold uppercase tracking-widest">Logout</span>
            </div>
        </div>
      </aside>

      {/* Main Framework */}
      <div className="flex flex-col flex-1 relative w-full h-full overflow-hidden bg-[#0e0e0e]">
        
        {/* Top Header */}
        <header className="h-[80px] w-full border-b border-[#262626] bg-[#0a0a0a] flex items-center justify-between px-8 shrink-0 z-40">
           
           <div className="flex items-center gap-4">
             <Link to="/" className="inline-block">
               <span className="font-display font-bold text-xl tracking-tight text-[#c5fe00] leading-none">
                 TransSync
               </span>
             </Link>
             <div className="w-px h-6 bg-[#262626]"></div>
             <div className="flex items-center gap-2">
               <span className="text-[#555555] font-bold text-[10px] uppercase tracking-widest">Project:</span>
               <span className="text-[#ffffff] text-[13px] font-bold">
                 {targetLang ? `Target: ${targetLang}` : 'No target language'}
               </span>
             </div>
           </div>

           {/* Live Sync Status */}
           <div className="hidden lg:flex items-center gap-3 bg-[#1a1a1a] border border-[#262626] px-4 py-2 rounded-full absolute left-1/2 -translate-x-1/2">
             <div className="w-2.5 h-2.5 bg-[#ffffff] rounded-full animate-pulse"></div>
             <span className="text-[#a0a09f] font-bold text-[9px] uppercase tracking-widest leading-none">Live Sync<br/>Active</span>
           </div>

           {/* Right User Tools */}
           <div className="flex items-center gap-6">
             <button className="text-[#8c8c8b] hover:text-[#ffffff] transition-colors"><Bell size={18} /></button>
             <button className="text-[#8c8c8b] hover:text-[#ffffff] transition-colors"><Settings size={18} /></button>
             <button className="w-8 h-8 rounded-full bg-[#1a1a1a] border border-[#262626] overflow-hidden ml-2 ring-2 ring-transparent transition-all">
               <img src="https://i.pravatar.cc/150?img=11" alt="User Avatar" className="w-full h-full object-cover" />
             </button>
           </div>
        </header>

        {/* Dual Pane Layout */}
        <div className="flex-1 flex overflow-hidden w-full pb-[100px]">
          
          {/* Main Translation Stream Column */}
          <main className="flex-1 overflow-y-auto layout-scrollbar bg-[#0a0a0a]">
             <div className="p-8 max-w-5xl mx-auto space-y-6">
               {errorMessage ? (
                 <div className="bg-[#2a1313] border border-[#ff4d4d] rounded-[24px] p-6 text-[#ff4d4d] text-sm">
                   {errorMessage}
                 </div>
               ) : null}

               {isTranslating ? (
                 <div className="bg-[#15170d] border border-[#2a2e16] rounded-[24px] p-8 text-[#c5fe00] text-sm">
                   Translating sentences...
                 </div>
               ) : null}

               {displayResults.length === 0 && !isTranslating && !errorMessage ? (
                 <div className="bg-[#111111] border border-[#262626] rounded-[24px] p-8 text-[#8c8c8b] text-sm">
                   No translation results yet.
                 </div>
               ) : null}

               {displayResults.map((item, index) => (
                 <div key={`${item.source}-${index}`} className="bg-[#111111] border border-[#262626] rounded-[24px] overflow-hidden grid grid-cols-1 md:grid-cols-2 relative group hover:border-[#333333] transition-colors">
                   <div className="p-8 border-r border-[#262626] flex flex-col">
                     <div className="flex justify-between items-center mb-4">
                       <span className="text-[#555555] text-[10px] font-bold uppercase tracking-widest">
                         Source — {sourceLang.toUpperCase()}
                       </span>
                     </div>
                     <p className="text-[#a0a09f] text-[16px] leading-[1.6] font-sans">
                       {item.source}
                     </p>
                   </div>

                   <div className="p-8 flex flex-col relative">
                     <div className="flex justify-between items-center mb-4">
                       <span className="text-[#555555] text-[10px] font-bold uppercase tracking-widest">
                         Target — {targetLang ? targetLang.toUpperCase() : 'TBD'}
                       </span>
                     </div>
                     <p className="text-[#ffffff] text-[16px] leading-[1.6] font-sans pr-2">
                       {item.translation}
                     </p>
                     <div className="absolute bottom-6 left-8 bg-[#1a200a] text-[#c5fe00] border border-[#2a2e16] text-[9px] font-bold uppercase tracking-widest rounded-full px-3 py-1.5 flex items-center shadow-[inset_0_0_10px_rgba(197,254,0,0.05)]">
                       {matchLabel(item.match_type)}
                     </div>
                   </div>
                 </div>
               ))}
             </div>
          </main>

          {/* Right Context Panel */}
          <aside className="w-[360px] border-l border-[#262626] bg-[#0e0e0e] shrink-0 flex flex-col overflow-y-auto layout-scrollbar">
             
             {/* Header Tabs */}
             <div className="flex items-center gap-6 border-b border-[#262626] px-8 pt-8">
               <div className="text-[#c5fe00] text-[10px] font-bold uppercase tracking-widest pb-4 border-b-2 border-[#c5fe00] cursor-pointer">Context</div>
               <div className="text-[#555555] hover:text-[#8c8c8b] transition-colors text-[10px] font-bold uppercase tracking-widest pb-4 cursor-pointer">Activity</div>
               <div className="text-[#555555] hover:text-[#8c8c8b] transition-colors text-[10px] font-bold uppercase tracking-widest pb-4 cursor-pointer">Comments</div>
             </div>

             <div className="p-8 space-y-12">
               
               {/* Draft Settings */}
               <div>
                  <h4 className="text-[#555555] font-bold text-[10px] uppercase tracking-[0.2em] mb-6">Draft Settings</h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-[#8c8c8b]">Tone of Voice</span>
                      <span className="text-[#c5fe00] font-bold">Sophisticated</span>
                    </div>
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-[#8c8c8b]">Max Length</span>
                      <span className="text-[#ffffff] font-bold">140 chars</span>
                    </div>
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-[#8c8c8b]">Formality</span>
                      <div className="w-[100px] h-1.5 rounded-full bg-[#262626] overflow-hidden">
                        <div className="w-[85%] h-full bg-[#c5fe00] rounded-full"></div>
                      </div>
                    </div>
                  </div>
               </div>

               {/* Glossary Matches */}
               <div>
                  <h4 className="text-[#555555] font-bold text-[10px] uppercase tracking-[0.2em] mb-6">Glossary Matches (2)</h4>
                  <div className="space-y-3">
                    
                    {/* Match 1 */}
                    <div className="bg-[#13150d] border border-[#2a2e16] rounded-[20px] p-5 shadow-[0_5px_15px_rgba(197,254,0,0.02)]">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-white font-bold text-[14px]">TransSync-Core™</span>
                        <span className="bg-[#262626] text-[#8c8c8b] text-[8px] font-bold uppercase tracking-widest px-2 py-1 rounded-[6px]">Proprietary</span>
                      </div>
                      <p className="text-[#a0a09f] text-[12px] leading-relaxed">
                        Always leave as-is. Translate secondary descriptions only.
                      </p>
                    </div>

                    {/* Match 2 */}
                    <div className="bg-[#151515] border border-[#262626] rounded-[20px] p-5">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-white font-bold text-[14px]">Workload</span>
                        <span className="bg-[#262626] text-[#8c8c8b] text-[8px] font-bold uppercase tracking-widest px-2 py-1 rounded-[6px]">Technical</span>
                      </div>
                      <p className="text-[#8c8c8b] text-[12px] leading-relaxed">
                        Use 'Workload' (EN) or 'Arbeitslast' (DE) depending on context.
                      </p>
                    </div>

                  </div>
               </div>

               {/* Activity Mini Feed */}
               <div>
                 <h4 className="text-[#555555] font-bold text-[10px] uppercase tracking-[0.2em] mb-6">Activity</h4>
                 <div className="space-y-6 relative before:absolute before:inset-0 before:ml-[5px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-px before:bg-gradient-to-b before:from-transparent before:via-[#262626] before:to-transparent">
                    
                    <div className="relative flex items-start gap-4">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#c5fe00] absolute -left-[5px] top-1 ring-4 ring-[#0e0e0e]"></div>
                      <div className="flex flex-col ml-6">
                        <p className="text-[#ffffff] text-[12px] font-medium leading-relaxed">
                          <span className="font-bold text-white">AI Agent</span> pre-translated segment #42
                        </p>
                        <span className="text-[#555555] text-[10px]">2 minutes ago</span>
                      </div>
                    </div>

                    <div className="relative flex items-start gap-4">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#262626] absolute -left-[5px] top-1 ring-4 ring-[#0e0e0e]"></div>
                      <div className="flex flex-col ml-6">
                        <p className="text-[#a0a09f] text-[12px] font-medium leading-relaxed">
                          <span className="font-bold text-[#8c8c8b]">System</span> updated Glossary rules
                        </p>
                        <span className="text-[#555555] text-[10px]">1 hour ago</span>
                      </div>
                    </div>

                 </div>
               </div>
             </div>

             {/* Comment Input */}
             <div className="px-8 pb-8 mt-auto sticky bottom-0 bg-[#0e0e0e]">
               <input 
                 type="text" 
                 placeholder="Add a comment..." 
                 className="w-full bg-[#151515] border border-[#262626] rounded-full px-5 py-4 text-[13px] text-white focus:outline-none focus:border-[#c5fe00] transition-colors placeholder:text-[#555555]"
               />
             </div>
          </aside>
        </div>

        {/* Global Footer Action Bar */}
        <div className="absolute w-full bottom-0 h-[88px] border-t border-[#262626] bg-[#0a0a0a]/90 backdrop-blur-md flex items-center justify-between px-8 z-50">
          
          {/* Progress Module */}
          <div className="flex items-center gap-12">
            <div className="flex flex-col gap-2 w-[240px]">
              <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-[0.2em] text-[#555555]">
                <span>Progress</span>
                <span className="text-[#ffffff]">68%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-[#262626] overflow-hidden">
                <div className="w-[68%] h-full bg-[#c5fe00] rounded-full"></div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-8 text-[#a0a09f] text-[11px] font-bold tracking-[0.1em] uppercase">
             <div className="flex items-center gap-2">
               <CheckCircle size={14} className="text-[#c5fe00]" /> 1,240 Reviewed
             </div>
             <div className="flex items-center gap-2">
               <MoreHorizontal size={14} className="text-[#8c8c8b]" /> 412 Pending
             </div>
          </div>

          {/* Core Action CTA */}
          <div className="flex items-center gap-6">
            <button className="text-[#a0a09f] hover:text-[#ff4d4d] transition-colors font-bold text-xs uppercase tracking-widest">
              Discard Draft
            </button>
            <button className="bg-[#c5fe00] hover:bg-[#b9ef00] transition-colors text-[#0a0a0a] rounded-full px-8 py-4 font-black flex items-center gap-3 text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(197,254,0,0.2)] hover:scale-[1.02] transform duration-300">
              Approve & Next
            </button>
          </div>

        </div>

      </div>

    </div>
  );
}

export default ReviewPage;
