import React from 'react';
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
  MoreHorizontal
} from 'lucide-react';

function GlossaryPage() {
  const terms = [
    { id: 1, source: "Neural Interface", target: "Interface Neurale", cat: "TECHNICAL", status: "VERIFIED" },
    { id: 2, source: "Latency Protocol", target: "Protocole de Latence", cat: "TECHNICAL", status: "PENDING" },
    { id: 3, source: "Compliance Clause", target: "Clause de Conformité", cat: "LEGAL", status: "VERIFIED" },
    { id: 4, source: "Sustainable Offset", target: "Compensation Durable", cat: "ESG", status: "VERIFIED" },
    { id: 5, source: "Smart Contract Sync", target: "Synchronisation de Contrat", cat: "TECHNICAL", status: "PENDING" }
  ];

  return (
    <div className="h-screen bg-[#0a0a0a] text-[#ffffff] font-sans flex overflow-hidden selection:bg-[#c5fe00] selection:text-[#0a0a0a]">
      
      {/* Left Sidebar */}
      <aside className="w-[260px] border-r border-[#262626] border-opacity-50 flex flex-col shrink-0 bg-[#0a0a0a] hidden md:flex z-50">
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

      {/* Main Container */}
      <div className="flex-1 flex flex-col relative w-full h-full overflow-hidden bg-[#0e0e0e]">
        
        {/* Top Nav Centered Search */}
        <nav className="h-[80px] w-full flex items-center justify-between px-8 bg-transparent z-40 relative">
          
          <div className="w-1/3"></div>
          
          {/* Centered Global Search Pill */}
          <div className="w-[400px] bg-[#1a1a1a] border border-[#262626] focus-within:border-[#333333] transition-colors rounded-full flex items-center px-4 py-2.5 gap-3">
             <Search size={16} className="text-[#555555]" />
             <input type="text" placeholder="Search glossary terms..." className="bg-transparent border-none text-[#ffffff] focus:outline-none w-full text-[13px] placeholder:text-[#555555]" />
          </div>

          <div className="w-1/3 flex justify-end items-center gap-6">
            <button className="text-[#8c8c8b] hover:text-[#ffffff] transition-colors"><Bell size={18} /></button>
            <button className="text-[#8c8c8b] hover:text-[#ffffff] transition-colors"><Settings size={18} /></button>
            <button className="w-8 h-8 rounded-full bg-[#1a1a1a] border border-[#262626] overflow-hidden ml-2 ring-2 ring-transparent transition-all">
              <img src="https://i.pravatar.cc/150?img=11" alt="User Avatar" className="w-full h-full object-cover" />
            </button>
          </div>
        </nav>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto layout-scrollbar pb-16">
          <div className="p-8 lg:p-12 max-w-[1400px] mx-auto relative pt-4">
             
             {/* Massive Radial Glow Drop */}
             <div className="absolute top-0 left-[20%] w-[600px] h-[400px] bg-[#c5fe00] opacity-[0.05] blur-[150px] rounded-full pointer-events-none z-0"></div>

             {/* Header Section */}
             <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 relative z-10 gap-6">
                <div>
                  <h1 className="font-display font-black text-5xl tracking-tight mb-3">glossary <br className="hidden md:block"/>management</h1>
                  <p className="text-[#8c8c8b] text-[15px] font-sans">
                    Centralized linguistic assets for TransSync global projects.
                  </p>
                </div>
                <button className="bg-[#c5fe00] hover:bg-[#b9ef00] text-[#0a0a0a] rounded-full px-6 py-3.5 font-bold flex items-center gap-2 text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(197,254,0,0.2)] hover:scale-[1.02] transform transition-all whitespace-nowrap">
                   <Plus size={16} strokeWidth={2.5} /> Add New Term
                </button>
             </div>

             {/* Grid Layout Container */}
             <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
                
                {/* Data Table Column */}
                <div className="lg:col-span-8 bg-[#111111] border border-[#1a1a1a] rounded-[32px] p-8 min-h-[600px] flex flex-col shadow-[0_0_40px_rgba(0,0,0,0.5)]">
                  
                  {/* Table Headers */}
                  <div className="grid grid-cols-4 gap-4 px-6 pb-6 border-b border-[#262626]">
                    <span className="text-[#555555] font-bold text-[9px] uppercase tracking-widest col-span-1">Source Term (EN)</span>
                    <span className="text-[#555555] font-bold text-[9px] uppercase tracking-widest col-span-1">Translation (FR)</span>
                    <span className="text-[#555555] font-bold text-[9px] uppercase tracking-widest col-span-1">Category</span>
                    <span className="text-[#555555] font-bold text-[9px] uppercase tracking-widest col-span-1 text-right md:text-left block">Status</span>
                  </div>

                  {/* Table Body */}
                  <div className="flex-1 flex flex-col pt-2">
                    {terms.map((term, index) => (
                      <div key={term.id} className="grid grid-cols-4 items-center gap-4 px-6 py-8 border-b border-[#1a1a1a] hover:bg-[#151515] transition-colors rounded-none">
                        
                        {/* Col 1 */}
                        <div className="col-span-1">
                          <span className="text-white font-bold text-[15px] tracking-wide">{term.source}</span>
                        </div>

                        {/* Col 2 */}
                        <div className="col-span-1 pr-4">
                          <span className="text-[#a0a09f] text-[15px]">{term.target}</span>
                        </div>

                        {/* Col 3 */}
                        <div className="col-span-1">
                           <span className="bg-[#1a1a1a] border border-[#262626] text-[#8c8c8b] text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full inline-block">
                             {term.cat}
                           </span>
                        </div>

                        {/* Col 4 */}
                        <div className="col-span-1 flex md:items-center justify-end md:justify-start">
                          {term.status === "VERIFIED" ? (
                            <div className="flex items-center gap-2 text-[#c5fe00]">
                              <CheckCircle size={14} className="fill-transparent stroke-[#c5fe00]" />
                              <span className="text-[10px] font-bold uppercase tracking-widest">Verified</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-[#ffd166]">
                              <MoreHorizontal size={14} className="fill-transparent stroke-[#ffd166]" />
                              <span className="text-[10px] font-bold uppercase tracking-widest">Pending</span>
                            </div>
                          )}
                        </div>

                      </div>
                    ))}
                  </div>

                  {/* Pagination Wrapper */}
                  <div className="pt-8 flex items-center justify-center gap-3 mt-auto">
                    <button className="w-8 h-8 rounded-full border border border-[#2a2e16] bg-[#1a1c10] text-[#c5fe00] flex items-center justify-center font-bold text-xs shadow-[inset_0_0_10px_rgba(197,254,0,0.05)]">1</button>
                    <button className="w-8 h-8 rounded-full border border-transparent text-[#8c8c8b] hover:text-white transition-colors flex items-center justify-center font-bold text-xs">2</button>
                    <button className="w-8 h-8 rounded-full border border-transparent text-[#8c8c8b] hover:text-white transition-colors flex items-center justify-center font-bold text-xs">3</button>
                  </div>

                </div>


                {/* Insights Column */}
                <div className="lg:col-span-4 flex flex-col gap-6">
                   
                   {/* Main Chart Card */}
                   <div className="bg-[#15170d] border border-[#2a2e16] rounded-[32px] p-8 shadow-[0_20px_40px_rgba(197,254,0,0.02)]">
                     <h4 className="text-[#c5fe00] font-bold text-[10px] uppercase tracking-widest mb-6">Linguistic Asset Insights</h4>
                     
                     <div className="flex justify-between items-end mb-8">
                       <span className="text-[#a0a09f] text-[13px] font-medium">Term Consistency</span>
                       <span className="font-display font-black text-3xl text-[#c5fe00]">98.4%</span>
                     </div>

                     {/* CSS Bar Chart visual block */}
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
                           <span className="text-[#8c8c8b] text-[12px] font-medium">New Approved Terms</span>
                         </div>
                         <span className="font-bold text-[16px] text-white tracking-widest">+124</span>
                       </div>
                       
                       <div className="bg-[#111111] border border-[#1a1a1a] rounded-[20px] p-4 flex items-center justify-between">
                         <div className="flex items-center gap-3">
                           <div className="w-2.5 h-2.5 rounded-full bg-[#ffd166]"></div>
                           <span className="text-[#8c8c8b] text-[12px] font-medium">Flagged for Review</span>
                         </div>
                         <span className="font-bold text-[16px] text-white tracking-widest">12</span>
                       </div>
                     </div>
                   </div>

                   {/* Sub Metrics Row */}
                   <div className="grid grid-cols-2 gap-4">
                     <div className="bg-[#151515] border border-[#1a1a1a] rounded-[24px] p-6">
                       <span className="text-[#555555] font-bold text-[8px] uppercase tracking-widest mb-2 block">Total Terms</span>
                       <span className="font-display font-black text-2xl tracking-tight">4,812</span>
                     </div>
                     <div className="bg-[#151515] border border-[#1a1a1a] rounded-[24px] p-6">
                       <span className="text-[#555555] font-bold text-[8px] uppercase tracking-widest mb-2 block">Global Reach</span>
                       <span className="font-display font-black text-2xl tracking-tight flex items-end gap-1">18 <span className="text-[12px] text-[#8c8c8b] font-sans pb-0.5">Langs</span></span>
                     </div>
                   </div>

                   {/* Generated Map Render Block */}
                   <div className="bg-[#0c0c0c] border border-[#1a1a1a] rounded-[32px] overflow-hidden relative h-[220px] group">
                     {/* Map Image directly injected from absolute map.png generation */}
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
