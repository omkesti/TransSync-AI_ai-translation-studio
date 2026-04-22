import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Bell, 
  LayoutDashboard,
  FileUp,
  CheckCircle2,
  MessageSquare,
  Book,
  HelpCircle,
  LogOut,
  FileText,
  AlertTriangle,
  AlertCircle,
  Activity,
  ArrowRight,
  Sparkles
} from 'lucide-react';

function ValidationPage() {
  return (
    <div className="h-screen bg-[#0a0a0a] text-[#ffffff] font-sans flex overflow-hidden selection:bg-[#c5fe00] selection:text-[#0a0a0a]">
      
      {/* Left Sidebar */}
      <aside className="w-[260px] border-r border-[#262626] border-opacity-50 flex flex-col shrink-0 bg-[#0a0a0a] hidden md:flex z-50">
        <div className="p-6 pb-2 flex-1 flex flex-col">
          
          {/* Logo / Branding */}
          <div className="mb-12">
            <h1 className="font-display font-black text-2xl tracking-tight text-[#c5fe00] leading-none mb-1 shadow-[#c5fe00]">
              TransSync
            </h1>
            <p className="text-[#555555] font-bold text-[9px] uppercase tracking-widest leading-none">AI Studio</p>
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

            {/* Active Item */}
            <div className="flex items-center gap-4 bg-[#1a1c10] text-[#c5fe00] border border-[#2a2e16] px-4 py-3 rounded-[12px] cursor-pointer shadow-[inset_0_0_10px_rgba(197,254,0,0.05)]">
              <CheckCircle2 size={18} />
              <span className="text-[11px] font-bold uppercase tracking-widest">Validation</span>
            </div>

            <Link to="/review" className="flex items-center gap-4 text-[#8c8c8b] hover:text-[#ffffff] hover:bg-[#131313] transition-colors px-4 py-3 rounded-[12px] cursor-pointer">
              <MessageSquare size={18} />
              <span className="text-[11px] font-bold uppercase tracking-widest">Review</span>
            </Link>

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
        <header className="h-[88px] w-full border-b border-[#262626] bg-[#0e0e0e] flex items-center justify-between px-8 shrink-0 z-40">
           
           {/* Left File Information */}
           <div className="flex flex-col gap-1.5">
             <div className="flex items-center gap-2">
               <FileText size={12} className="text-[#c5fe00]" strokeWidth={3} />
               <span className="text-[#c5fe00] text-[9px] font-bold uppercase tracking-[0.2em] leading-none">Active File</span>
             </div>
             <h2 className="font-display text-[22px] font-bold tracking-tight text-white leading-none">
               Document: annual_report.v2.docx
             </h2>
           </div>

           {/* Right Health Metrics & User */}
           <div className="flex items-center gap-12">
             
             {/* Health Status */}
             <div className="flex flex-col items-end gap-2">
               <div className="flex items-center gap-2">
                 <Activity size={12} className="text-[#c5fe00]" />
                 <span className="text-[#8c8c8b] text-[9px] font-bold uppercase tracking-[0.2em] leading-none">Health Score</span>
               </div>
               <div className="flex items-center gap-4">
                 <div className="w-[100px] h-1.5 rounded-full bg-[#262626] overflow-hidden">
                   <div className="w-[82%] h-full bg-[#c5fe00] rounded-full"></div>
                 </div>
                 <span className="font-display font-bold text-xl leading-none">82%</span>
               </div>
             </div>

             {/* User Tools */}
             <div className="flex items-center gap-4 border-l border-[#262626] pl-8">
               <button className="w-10 h-10 rounded-full bg-[#151515] border border-[#262626] flex items-center justify-center text-[#8c8c8b] hover:text-white hover:bg-[#222222] transition-all">
                 <Bell size={18} />
               </button>
               <button className="w-10 h-10 rounded-full bg-[#151515] border border-[#262626] flex items-center justify-center text-[#8c8c8b] hover:text-white hover:bg-[#222222] transition-all overflow-hidden ring-2 ring-transparent">
                 <img src="https://i.pravatar.cc/150?img=11" alt="User Avatar" className="w-full h-full object-cover" />
               </button>
             </div>

           </div>
        </header>

        {/* Scrollable Main Area */}
        <div className="flex-1 overflow-y-auto layout-scrollbar pb-[100px]">
          <div className="p-8 lg:p-12 max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 relative">
            
            {/* Left Validation Stream (Spans 8 cols) */}
            <main className="lg:col-span-8 flex flex-col">
              
              <div className="mb-12">
                <h1 className="font-display font-black text-[40px] tracking-tight mb-4">source validation</h1>
                <p className="text-[#a0a09f] text-[15px] leading-relaxed max-w-2xl font-sans">
                  Our neural analysis engine has detected structural and semantic inconsistencies in the source document. Resolve these before proceeding to translation.
                </p>
              </div>

              <div className="space-y-8">
                
                {/* High Severity Card */}
                <div className="bg-[#151515] border border-[#262626] rounded-[32px] p-8 relative overflow-hidden transition-colors hover:border-[#333333]">
                  {/* Subtle red glow background top left */}
                  <div className="absolute top-0 left-0 w-64 h-64 bg-[#ff4d4d] opacity-[0.03] blur-[60px] pointer-events-none rounded-full -translate-x-1/2 -translate-y-1/2"></div>
                  
                  <div className="flex justify-between items-start mb-6 relative z-10">
                    <div className="flex items-start gap-5">
                      <div className="w-12 h-12 rounded-full bg-[#2a1313] flex items-center justify-center text-[#ff3333] shrink-0">
                        <AlertTriangle size={20} strokeWidth={2.5}/>
                      </div>
                      <div>
                        <span className="text-[#ff3333] text-[9px] font-bold uppercase tracking-[0.2em] leading-none mb-2 block">High Severity</span>
                        <h3 className="font-display font-bold text-2xl tracking-tight text-white mb-2">Inconsistent Financial<br/>Terminology</h3>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-[#8c8c8b] text-[11px]">Lines: 124, 452,<br/>891</span>
                    </div>
                  </div>

                  <p className="text-[#a0a09f] text-[14px] leading-relaxed mb-8 max-w-xl font-sans relative z-10">
                    The term "EBITDA" is used interchangeably with "Operating Earnings" and "Adjusted Margin" in the fiscal summary section. This may confuse the LLM during cross-context translation.
                  </p>

                  <div className="flex gap-4 relative z-10">
                    <button className="bg-[#c5fe00] hover:bg-[#b9ef00] text-[#0a0a0a] font-bold text-xs uppercase tracking-widest px-8 py-3.5 rounded-full transition-colors shadow-[0_0_15px_rgba(197,254,0,0.15)]">
                      Apply AI Fix
                    </button>
                    <button className="bg-[#222222] hover:bg-[#2a2a2a] border border-transparent text-[#a0a09f] hover:text-white font-bold text-xs uppercase tracking-widest px-8 py-3.5 rounded-full transition-colors">
                      Ignore
                    </button>
                  </div>
                </div>

                {/* Medium Severity Card */}
                <div className="bg-[#151515] border border-[#262626] rounded-[32px] p-8 relative overflow-hidden transition-colors hover:border-[#333333]"> 
                  {/* Subtle yellow glow background top left */}
                  <div className="absolute top-0 left-0 w-64 h-64 bg-[#ffd166] opacity-[0.03] blur-[60px] pointer-events-none rounded-full -translate-x-1/2 -translate-y-1/2"></div>
                  
                  <div className="flex justify-between items-start mb-6 relative z-10">
                    <div className="flex items-start gap-5">
                      <div className="w-12 h-12 rounded-full bg-[#262111] flex items-center justify-center text-[#ffd166] shrink-0">
                        <AlertCircle size={20} strokeWidth={2.5}/>
                      </div>
                      <div>
                        <span className="text-[#ffd166] text-[9px] font-bold uppercase tracking-[0.2em] leading-none mb-2 block">Medium Severity</span>
                        <h3 className="font-display font-bold text-2xl tracking-tight text-white mb-2">Untranslatable Proper Noun</h3>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-[#8c8c8b] text-[11px]">Line: 12</span>
                    </div>
                  </div>

                  <p className="text-[#a0a09f] text-[14px] leading-relaxed mb-8 max-w-xl font-sans relative z-10">
                    The name "TransSync-Core-V2" was detected as a primary product identifier. Verify if this should remain untranslated or localized for European markets.
                  </p>

                  <div className="flex gap-4 relative z-10">
                    <button className="bg-[#c5fe00] hover:bg-[#b9ef00] text-[#0a0a0a] font-bold text-xs uppercase tracking-widest px-8 py-3.5 rounded-full transition-colors shadow-[0_0_15px_rgba(197,254,0,0.15)]">
                      Apply AI Fix
                    </button>
                    <button className="bg-[#222222] hover:bg-[#2a2a2a] border border-transparent text-[#a0a09f] hover:text-white font-bold text-xs uppercase tracking-widest px-8 py-3.5 rounded-full transition-colors">
                      Ignore
                    </button>
                  </div>
                </div>

              </div>
            </main>

            {/* Right Context Metrics (Spans 4 cols) */}
            <aside className="lg:col-span-4 flex flex-col gap-12 mt-4 lg:mt-0">
              
              {/* Validation Summary */}
              <div>
                <h4 className="text-[#555555] font-bold text-[10px] uppercase tracking-[0.2em] mb-6">Validation Summary</h4>
                <div className="space-y-3">
                  <div className="bg-[#111111] border border-[#1a1a1a] rounded-[20px] p-5 flex items-center justify-between">
                    <span className="text-[#a0a09f] text-[13px] font-medium">Critical Issues</span>
                    <span className="font-display font-bold text-xl text-[#ff4d4d]">01</span>
                  </div>
                  <div className="bg-[#111111] border border-[#1a1a1a] rounded-[20px] p-5 flex items-center justify-between">
                    <span className="text-[#a0a09f] text-[13px] font-medium">Warnings</span>
                    <span className="font-display font-bold text-xl text-[#ffd166]">12</span>
                  </div>
                  <div className="bg-[#111111] border border-[#1a1a1a] rounded-[20px] p-5 flex items-center justify-between">
                    <span className="text-[#a0a09f] text-[13px] font-medium">Style Suggestions</span>
                    <span className="font-display font-bold text-xl text-[#ffd166]">08</span>
                  </div>
                </div>
              </div>

              {/* Quality Metrics */}
              <div>
                <h4 className="text-[#555555] font-bold text-[10px] uppercase tracking-[0.2em] mb-6">Quality Metrics</h4>
                <div className="bg-[#111111] border border-[#1a1a1a] rounded-[24px] p-6 space-y-6">
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-[11px] font-sans">
                      <span className="text-[#a0a09f]">Readability Index</span>
                      <span className="font-bold text-[#c5fe00]">92%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-[#222222] overflow-hidden">
                       <div className="w-[92%] h-full bg-[#c5fe00] rounded-full"></div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-[11px] font-sans">
                      <span className="text-[#a0a09f]">Context Preservation</span>
                      <span className="font-bold text-[#c5fe00]">78%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-[#222222] overflow-hidden">
                       <div className="w-[78%] h-full bg-[#c5fe00] rounded-full"></div>
                    </div>
                  </div>

                </div>
              </div>

              {/* AI Quick-Resolve Block */}
              <div className="bg-[#151515] border border-[#2a2e16] rounded-[24px] p-8 shadow-[0_20px_40px_rgba(197,254,0,0.03)] mt-auto relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-32 h-32 bg-[#c5fe00] opacity-[0.03] blur-[40px] pointer-events-none rounded-full group-hover:opacity-10 transition-opacity"></div>
                <h4 className="font-display text-white font-bold text-[18px] mb-3 relative z-10">AI Quick-Resolve</h4>
                <p className="text-[#8c8c8b] text-[12px] leading-relaxed mb-6 font-sans relative z-10">
                  Enable auto-fix for all low-severity issues to speed up the workflow by 25%.
                </p>
                <button className="text-[#c5fe00] hover:text-[#b9ef00] transition-colors font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 relative z-10">
                  Activate Auto-Pilot <ArrowRight size={14} />
                </button>
              </div>

            </aside>
          </div>
        </div>

        {/* Global Action Footer */}
        <div className="absolute w-full bottom-0 h-[88px] border-t border-[#262626] bg-[#0a0a0a]/90 backdrop-blur-md flex items-center justify-between px-8 lg:px-12 z-50">
          
          {/* Status Tracker */}
          <div className="flex items-center gap-4">
             <div className="w-10 h-10 rounded-full bg-[#1a200a] text-[#c5fe00] border border-[#2a2e16] flex items-center justify-center relative shadow-[inset_0_0_10px_rgba(197,254,0,0.1)]">
               <Sparkles size={16} />
               {/* Pulsing indicator */}
               <div className="absolute right-0 bottom-0 w-2.5 h-2.5 bg-[#c5fe00] rounded-full border border-[#0a0a0a] animate-pulse"></div>
             </div>
             <p className="text-[#8c8c8b] text-[12px] font-medium font-sans">
                TransSync Engine is monitoring your validation progress.
             </p>
          </div>

          {/* Core Navigation CTA */}
          <button className="bg-[#c5fe00] hover:bg-[#b9ef00] transition-colors text-[#0a0a0a] rounded-full px-8 py-4 font-black flex items-center gap-3 text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(197,254,0,0.2)] hover:scale-[1.02] transform duration-300">
            Proceed to Translation <ArrowRight strokeWidth={3} size={16} />
          </button>
        </div>

      </div>

    </div>
  );
}

export default ValidationPage;
