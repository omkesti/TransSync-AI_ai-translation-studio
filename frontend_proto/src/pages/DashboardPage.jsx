import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Bell, 
  Settings, 
  Plus,
  LayoutDashboard,
  FileUp,
  CheckCircle2,
  MessageSquare,
  Book,
  HelpCircle,
  LogOut,
  FileText,
  MoreHorizontal
} from 'lucide-react';

function DashboardPage() {
  return (
    <div className="h-screen bg-[#0a0a0a] text-[#ffffff] font-sans flex flex-col overflow-hidden selection:bg-[#c5fe00] selection:text-[#0a0a0a]">
      
      {/* Top Navigation */}
      <nav className="h-[72px] border-b border-[#262626] border-opacity-50 flex items-center justify-between px-8 bg-[#0a0a0a] shrink-0 z-20">
        <div className="flex items-center gap-16">
          <Link to="/" className="inline-block">
            <span className="font-display font-bold text-xl tracking-tight text-[#c5fe00] block leading-none">
              TransSync <span className="text-[#ffffff]">AI</span>
            </span>
          </Link>
          
          <ul className="hidden md:flex items-center gap-8 text-[13px] font-semibold">
            <li className="text-[#c5fe00] cursor-pointer">Dashboard</li>
            <li className="text-[#8c8c8b] hover:text-[#ffffff] transition-colors cursor-pointer">Projects</li>
            <li className="text-[#8c8c8b] hover:text-[#ffffff] transition-colors cursor-pointer">Analytics</li>
          </ul>
        </div>

        <div className="flex items-center gap-6 text-[#8c8c8b]">
          <button className="hover:text-[#ffffff] transition-colors"><Bell size={18} /></button>
          <button className="hover:text-[#ffffff] transition-colors"><Settings size={18} /></button>
          <button className="w-8 h-8 rounded-full bg-[#1a1a1a] border border-[#262626] overflow-hidden ml-2">
            <img src="https://i.pravatar.cc/150?img=11" alt="User Avatar" className="w-full h-full object-cover" />
          </button>
        </div>
      </nav>

      {/* Body Layout */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* Left Sidebar */}
        <aside className="w-[260px] border-r border-[#262626] border-opacity-50 flex flex-col shrink-0 bg-[#0a0a0a] hidden md:flex">
          <div className="p-6 pb-2">
            
            {/* Workspace Selector */}
            <div className="flex items-center gap-3 mb-8">
              <div className="w-8 h-8 rounded-full bg-[#c5fe00] text-[#0a0a0a] flex items-center justify-center font-bold text-sm">
                A
              </div>
              <div className="flex flex-col">
                <span className="text-[#c5fe00] font-bold text-[11px] uppercase tracking-widest leading-none mb-1">TransSync</span>
                <span className="text-[#555555] font-bold text-[9px] uppercase tracking-widest leading-none">AI Studio</span>
              </div>
            </div>

            {/* CTA */}
            <button className="w-full bg-[#c5fe00] text-[#0a0a0a] hover:bg-[#b9ef00] transition-colors rounded-full py-3.5 flex items-center justify-center gap-2 font-bold text-sm shadow-[0_0_15px_rgba(197,254,0,0.15)] mb-8">
              <Plus size={18} strokeWidth={2.5}/> New Project
            </button>

            {/* Menu Items */}
            <nav className="space-y-1">
              <div className="flex items-center gap-4 bg-[#1a1c10] text-[#c5fe00] border border-[#2a2e16] px-4 py-3 rounded-[12px] cursor-pointer">
                <LayoutDashboard size={18} />
                <span className="text-[11px] font-bold uppercase tracking-widest">Dashboard</span>
              </div>
              
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

              <Link to="/glossary" className="flex items-center gap-4 text-[#8c8c8b] hover:text-[#ffffff] hover:bg-[#131313] transition-colors px-4 py-3 rounded-[12px] cursor-pointer">
                <Book size={18} />
                <span className="text-[11px] font-bold uppercase tracking-widest">Glossary</span>
              </Link>
            </nav>
          </div>

          <div className="mt-auto p-6 space-y-1">
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

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-[#0a0a0a] relative layout-scrollbar">
          
          <div className="p-8 lg:p-12 max-w-7xl mx-auto space-y-12">
            
            {/* Header */}
            <div>
              <h1 className="font-display font-bold text-4xl mb-3 tracking-tight">Systems Overview</h1>
              <p className="text-[#8c8c8b] text-[15px]">Monitoring linguistic processing throughput and document health<br/>across all active translation nodes.</p>
            </div>

            {/* Top Stats Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              <div className="bg-[#131313] border border-[#262626] border-opacity-50 rounded-[28px] p-8 relative overflow-hidden">
                <p className="text-[#555555] font-bold text-[11px] uppercase tracking-widest mb-6">Total Documents</p>
                <div className="flex items-baseline gap-3">
                  <span className="font-display font-bold text-5xl tracking-tight">1,284</span>
                  <span className="text-[#c5fe00] font-bold text-sm tracking-widest">+12%</span>
                </div>
              </div>

              <div className="bg-[#131313] border border-[#262626] border-opacity-50 rounded-[28px] p-8 relative overflow-hidden">
                <p className="text-[#555555] font-bold text-[11px] uppercase tracking-widest mb-6">In Progress</p>
                <div className="flex items-baseline gap-3">
                  <span className="font-display font-bold text-5xl tracking-tight">42</span>
                  <div className="flex gap-[3px] items-center h-5">
                    <div className="w-1.5 h-full bg-[#c5fe00] rounded-full animate-pulse"></div>
                    <div className="w-1.5 h-3/4 bg-[#c5fe00] rounded-full animate-pulse delay-75"></div>
                  </div>
                </div>
              </div>

              <div className="bg-[#131313] border border-[#262626] border-opacity-50 rounded-[28px] p-8 relative overflow-hidden">
                <p className="text-[#555555] font-bold text-[11px] uppercase tracking-widest mb-6">Completed</p>
                <div className="flex items-baseline gap-3">
                  <span className="font-display font-bold text-5xl tracking-tight">1,242</span>
                  <span className="text-[#8c8c8b] font-medium text-sm">/ 96.7%</span>
                </div>
              </div>

            </div>

            {/* Middle Section: Chart & Insights */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
              
              {/* Left Col (Span 2): Engine Performance */}
              <div className="lg:col-span-2 flex flex-col space-y-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-display font-bold text-[22px] tracking-tight mb-1">Engine Performance</h3>
                    <p className="text-[#8c8c8b] text-[13px]">Real-time token processing speed (ms)</p>
                  </div>
                  <div className="border border-[#262626] bg-[#1a1a1a] px-3 py-1.5 rounded-[8px] text-[#555555] font-bold text-[9px] uppercase tracking-widest">
                    Linguist-X V4
                  </div>
                </div>
                
                {/* SVG Chart Container */}
                <div className="bg-[#10130a] border border-[#1a2010] rounded-[24px] h-[300px] w-full relative overflow-hidden mt-2 p-6 flex flex-col">
                  <div className="flex-1 w-full relative">
                     {/* SVG Replicating the flowing green area chart */}
                     <svg className="w-full h-full absolute inset-0 preserve-aspect-none" viewBox="0 0 1000 200" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
                             <stop offset="0%" stopColor="#c5fe00" stopOpacity="0.25" />
                             <stop offset="100%" stopColor="#c5fe00" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        {/* Background subtle dotted wave indicating baseline */}
                        <path d="M0,130 C200,100 400,160 600,140 C800,120 1000,150 1000,150" fill="none" stroke="#262b14" strokeWidth="2" strokeDasharray="6,6" />
                        
                        {/* Main solid performance wave */}
                        <path d="M0,170 C250,140 350,180 500,170 C700,150 850,165 1000,140 L1000,200 L0,200 Z" fill="url(#chartGradient)" />
                        <path d="M0,170 C250,140 350,180 500,170 C700,150 850,165 1000,140" fill="none" stroke="#c5fe00" strokeWidth="2.5" />
                        
                        {/* Active Indicator Point */}
                        <circle cx="500" cy="170" r="4" fill="#ffffff" />
                     </svg>
                  </div>
                  
                  {/* X-Axis labels */}
                  <div className="flex justify-between text-[#404040] text-[10px] font-bold tracking-widest uppercase pb-2">
                    <span>08:00</span>
                    <span>12:00</span>
                    <span>16:00</span>
                    <span>20:00</span>
                    <span>Current</span>
                  </div>
                </div>
              </div>

              {/* Right Col (Span 1): Context Insights */}
              <div className="space-y-6">
                <h3 className="font-display font-bold text-[22px] tracking-tight mb-2">Context Insights</h3>
                
                {/* List of Insight Cards */}
                <div className="space-y-4">
                  {/* Insight 1 */}
                  <div className="bg-[#151515] border border-[#262626] border-opacity-70 rounded-[24px] p-6 space-y-4 hover:border-[#333333] transition-colors cursor-pointer group">
                    <div className="flex items-center gap-3">
                       <FileText size={16} className="text-[#a0a09f]" />
                       <span className="font-bold text-[14px]">Legal_Framework_v2.pdf</span>
                    </div>
                    <p className="text-[#8c8c8b] text-[13px] italic leading-relaxed">
                      "...the jurisdictional boundaries established in the 2024 revised clause regarding cross-..."
                    </p>
                    <div className="flex justify-between items-center pt-2">
                      <span className="text-[#555555] text-[10px] font-bold tracking-widest uppercase">2m ago</span>
                      <span className="text-[#a0a09f] text-[10px] font-bold tracking-widest uppercase group-hover:text-[#ffffff] transition-colors">View Match</span>
                    </div>
                  </div>

                  {/* Insight 2 */}
                  <div className="bg-[#151515] border border-[#262626] border-opacity-70 rounded-[24px] p-6 space-y-4 hover:border-[#333333] transition-colors cursor-pointer group">
                    <div className="flex items-center gap-3">
                       <FileText size={16} className="text-[#a0a09f]" />
                       <span className="font-bold text-[14px]">Q3_Marketing_Brief.docx</span>
                    </div>
                    <p className="text-[#8c8c8b] text-[13px] italic leading-relaxed">
                      "...ensuring the colloquial nuances of the Neo-Lime branding campaign translate seamlessly..."
                    </p>
                    <div className="flex justify-between items-center pt-2">
                      <span className="text-[#555555] text-[10px] font-bold tracking-widest uppercase">14m ago</span>
                      <span className="text-[#a0a09f] text-[10px] font-bold tracking-widest uppercase group-hover:text-[#ffffff] transition-colors">View Match</span>
                    </div>
                  </div>

                  {/* Insight 3 */}
                  <div className="bg-[#151515] border border-[#262626] border-opacity-70 rounded-[24px] p-6 space-y-4 hover:border-[#333333] transition-colors cursor-pointer group">
                    <div className="flex items-center gap-3">
                       <FileText size={16} className="text-[#a0a09f]" />
                       <span className="font-bold text-[14px]">Project_TransSync_Spec.md</span>
                    </div>
                    <p className="text-[#8c8c8b] text-[13px] italic leading-relaxed">
                      "...deployment of high-blur glassmorphic interfaces as a core tenant of the future..."
                    </p>
                    <div className="flex justify-between items-center pt-2">
                       <span className="text-[#555555] text-[10px] font-bold tracking-widest uppercase">1h ago</span>
                       <span className="text-[#a0a09f] text-[10px] font-bold tracking-widest uppercase group-hover:text-[#ffffff] transition-colors">View Match</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Row: Recent Documents Table */}
            <div className="border border-[#262626] border-opacity-80 rounded-[28px] overflow-hidden">
               <div className="p-8 border-b border-[#262626] flex justify-between items-end">
                  <h3 className="font-display font-bold text-[22px] tracking-tight">Recent Documents</h3>
                  <button className="text-[#8c8c8b] text-[11px] font-bold tracking-widest uppercase hover:text-white transition-colors">View All Activity</button>
               </div>
               
               <div className="overflow-x-auto">
                 <table className="w-full text-left border-collapse">
                   <thead>
                     <tr>
                       <th className="py-4 px-8 text-[#555555] text-[10px] font-bold tracking-widest uppercase border-b border-[#262626] w-1/3">Document Name</th>
                       <th className="py-4 px-8 text-[#555555] text-[10px] font-bold tracking-widest uppercase border-b border-[#262626]">Format</th>
                       <th className="py-4 px-8 text-[#555555] text-[10px] font-bold tracking-widest uppercase border-b border-[#262626]">Processing Stage</th>
                       <th className="py-4 px-8 text-[#555555] text-[10px] font-bold tracking-widest uppercase border-b border-[#262626]">Status</th>
                       <th className="py-4 px-8 text-[#555555] text-[10px] font-bold tracking-widest uppercase border-b border-[#262626] text-right">Actions</th>
                     </tr>
                   </thead>
                   <tbody className="text-[13px]">
                     {/* Row 1 */}
                     <tr className="border-b border-[#262626] hover:bg-[#131313] transition-colors">
                       <td className="py-6 px-8 font-bold">Global_Security_Policy_EN.pdf</td>
                       <td className="py-6 px-8 text-[#8c8c8b]">PDF / 2.4 MB</td>
                       <td className="py-6 px-8">
                         <div className="w-[120px] h-2 rounded-full bg-[#262626] overflow-hidden">
                           <div className="w-[60%] h-full bg-[#f3ffcd] rounded-full"></div>
                         </div>
                       </td>
                       <td className="py-6 px-8">
                         <span className="inline-flex items-center gap-2 bg-[#2a2e16] text-[#8c8c8b] text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full">
                           <span className="w-1.5 h-1.5 bg-[#c5fe00] rounded-full animate-pulse"></span> Processing
                         </span>
                       </td>
                       <td className="py-6 px-8 text-right text-[#555555]">
                         <button className="hover:text-white transition-colors"><MoreHorizontal size={18} /></button>
                       </td>
                     </tr>
                     {/* Row 2 */}
                     <tr className="border-b border-[#262626] hover:bg-[#131313] transition-colors">
                       <td className="py-6 px-8 font-bold">Annual_Report_FY24_Final.docx</td>
                       <td className="py-6 px-8 text-[#8c8c8b]">DOCX / 12 MB</td>
                       <td className="py-6 px-8">
                         <div className="w-[120px] h-2 rounded-full bg-[#262626] overflow-hidden">
                           <div className="w-[100%] h-full bg-[#f3ffcd] rounded-full"></div>
                         </div>
                       </td>
                       <td className="py-6 px-8">
                         <span className="inline-flex items-center gap-2 bg-[#1a2010] text-[#c5fe00] text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full border border-[#2a2e16]">
                           Ready
                         </span>
                       </td>
                       <td className="py-6 px-8 text-right text-[#555555]">
                         <button className="hover:text-white transition-colors"><MoreHorizontal size={18} /></button>
                       </td>
                     </tr>
                     {/* Row 3 */}
                     <tr className="hover:bg-[#131313] transition-colors">
                       <td className="py-6 px-8 font-bold">Client_Onboarding_Manifesto.txt</td>
                       <td className="py-6 px-8 text-[#8c8c8b]">TXT / 0.1 MB</td>
                       <td className="py-6 px-8">
                         <div className="w-[120px] h-2 rounded-full bg-[#262626] overflow-hidden">
                           <div className="w-[80%] h-full bg-[#f3ffcd] rounded-full"></div>
                         </div>
                       </td>
                       <td className="py-6 px-8">
                         <span className="inline-flex items-center gap-2 bg-[#262626] text-[#8c8c8b] text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full">
                           In-Review
                         </span>
                       </td>
                       <td className="py-6 px-8 text-right text-[#555555]">
                         <button className="hover:text-white transition-colors"><MoreHorizontal size={18} /></button>
                       </td>
                     </tr>
                   </tbody>
                 </table>
               </div>
            </div>

          </div>
        </main>
      </div>

    </div>
  );
}

export default DashboardPage;
