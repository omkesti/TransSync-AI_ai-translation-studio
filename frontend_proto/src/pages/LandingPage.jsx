import React from "react";
import { Link } from "react-router-dom";
import {
  Bell,
  Settings,
  User,
  Shield,
  Lock,
  Globe,
  Sparkles,
} from "lucide-react";

function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-on-surface font-sans selection:bg-primary-container selection:text-background">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-white/5 sticky top-0 bg-background/80 backdrop-blur-md z-50">
        <div className="flex items-center">
          <span className="font-display font-bold text-xl tracking-tight text-primary-container">
            TransSync <span className="text-on-surface">AI</span>
          </span>
        </div>

        <ul className="hidden md:flex gap-8 text-sm font-medium text-on-surface-variant">
          <li className="text-primary-container cursor-pointer">Solutions</li>
          <li className="hover:text-on-surface cursor-pointer transition-colors">
            Technology
          </li>
          <li className="hover:text-on-surface cursor-pointer transition-colors">
            Security
          </li>
          <li className="hover:text-on-surface cursor-pointer transition-colors">
            Pricing
          </li>
        </ul>

        <div className="flex items-center gap-4 text-on-surface-variant">
          <button className="hover:text-on-surface transition-colors p-1">
            <Bell size={18} />
          </button>
          <button className="hover:text-on-surface transition-colors p-1">
            <Settings size={18} />
          </button>
          <Link
            to="/login"
            className="bg-surface-container-highest border border-outline-variant/30 text-on-surface hover:bg-surface-variant transition-colors px-4 py-1.5 rounded-full text-sm font-semibold ml-2"
          >
            Login
          </Link>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6">
        {/* Hero Section */}
        <section className="pt-24 pb-16 text-center space-y-8 flex flex-col items-center">
          <h1 className="font-display text-6xl md:text-8xl font-black tracking-tight leading-[0.9]">
            Global Translation.
            <br />
            <span className="text-primary-container">
              Local Context. Neural Intelligence.
            </span>
          </h1>
          <p className="text-on-surface-variant max-w-xl mx-auto font-sans leading-relaxed text-sm md:text-base">
            RAG-powered translation with a perfect memory.
            <br /> Secure, consistent, and contextually precise across every
            document.
          </p>
          <Link
            to="/dashboard"
            className="mt-4 bg-primary-container text-background font-bold px-8 py-3 rounded-xl hover:bg-primary hover:shadow-[0_0_20px_rgba(197,254,0,0.3)] transition-all flex items-center gap-2"
          >
            Start Translating{" "}
            <span className="text-lg leading-none">&rarr;</span>
          </Link>

          <div className="w-full mt-16 flex justify-center">
            {/* The generated image contains the 3 angled devices */}
            <div className="relative w-full max-w-4xl opacity-90 hover:opacity-100 transition-opacity duration-700">
              <div className="absolute inset-0 bg-primary-container/10 blur-[100px] rounded-full z-0 pointer-events-none"></div>
              <img
                src="/hero_devices.png"
                className="w-full h-auto relative z-10 rounded-3xl"
                alt="TransSync AI Platform Interface On Devices"
              />
            </div>
          </div>
        </section>

        {/* Feature Section - The Liquid Workflow */}
        <section className="py-24 space-y-12">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div>
              <p className="text-primary-container font-bold text-xs tracking-widest uppercase mb-3">
                Architecture
              </p>
              <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
                The Liquid Workflow
              </h2>
            </div>
            <p className="text-on-surface-variant text-sm max-w-xs md:text-right">
              Experience data that flows like water, adapting to cultural
              nuances in real-time.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1 */}
            <div className="bg-surface-container-low rounded-3xl flex flex-col overflow-hidden relative group">
              <div className="p-8 pb-0 flex-1 space-y-4">
                <div className="w-10 h-10 rounded-full bg-surface-container-highest border border-outline-variant/15 flex items-center justify-center text-primary-container mb-6 shadow-[0_0_15px_rgba(197,254,0,0.1)]">
                  <Sparkles size={18} />
                </div>
                <h3 className="font-display text-xl font-bold">
                  Neural Adaptation
                </h3>
                <p className="text-on-surface-variant text-sm leading-relaxed pb-8">
                  Our engines don't just translate; they adapt to the emotional
                  cadence of the speaker.
                </p>
              </div>
              <div className="h-40 w-full overflow-hidden shrink-0 mt-auto px-4 pb-4">
                <img
                  src="/feature_neural.png"
                  className="w-full h-full object-cover rounded-2xl group-hover:scale-105 transition-transform duration-700 opacity-60"
                  alt="Neural Adaptation"
                />
              </div>
            </div>

            {/* Card 2 */}
            <div className="bg-surface-container-low rounded-3xl flex flex-col overflow-hidden relative group">
              <div className="p-8 pb-0 flex-1 space-y-4">
                <div className="w-10 h-10 rounded-full bg-surface-container-highest border border-outline-variant/15 flex items-center justify-center text-secondary mb-6 shadow-[0_0_15px_rgba(0,227,253,0.1)]">
                  <Sparkles size={18} />
                </div>
                <h3 className="font-display text-xl font-bold">
                  TransSync Engine V2
                </h3>
                <p className="text-on-surface-variant text-sm leading-relaxed pb-8">
                  Proprietary LLM technology optimized for sub-100ms latency
                  across 140+ dialects.
                </p>
              </div>
              <div className="h-40 w-full overflow-hidden shrink-0 mt-auto px-4 pb-4">
                <img
                  src="/feature_transsync.png"
                  className="w-full h-full object-cover rounded-2xl group-hover:scale-105 transition-transform duration-700 opacity-80"
                  alt="TransSync Engine"
                />
              </div>
            </div>

            {/* Card 3 */}
            <div className="bg-surface-container-low rounded-3xl flex flex-col overflow-hidden relative group">
              <div className="p-8 pb-0 flex-1 space-y-4">
                <div className="w-10 h-10 rounded-full bg-surface-container-highest border border-outline-variant/15 flex items-center justify-center text-on-surface mb-6 shadow-[0_0_15px_rgba(255,255,255,0.05)]">
                  <Globe size={18} />
                </div>
                <h3 className="font-display text-xl font-bold">
                  Global Context
                </h3>
                <p className="text-on-surface-variant text-sm leading-relaxed pb-8">
                  Localized slang and professional terminology are baked into
                  every request.
                </p>
              </div>
              <div className="h-40 w-full overflow-hidden shrink-0 mt-auto px-4 pb-4">
                <img
                  src="/feature_global.png"
                  className="w-full h-full object-cover rounded-2xl group-hover:scale-105 transition-transform duration-700 opacity-70"
                  alt="Global Context"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Security / Compliance Section */}
        <section className="py-24 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Visual Side */}
          <div className="rounded-3xl border border-outline-variant/15 bg-surface-container-low/50 aspect-square max-w-md mx-auto w-full relative flex items-center justify-center overflow-hidden">
            {/* Suble grid background using an inline SVG pattern */}
            <div
              className="absolute inset-0 opacity-5"
              style={{
                backgroundImage:
                  "radial-gradient(#ffffff 1px, transparent 1px)",
                backgroundSize: "20px 20px",
              }}
            ></div>
            <img
              src="/security_shield.png"
              className="w-3/4 h-3/4 object-contain opacity-90 mix-blend-screen"
              alt="Security Shield"
            />
          </div>

          {/* Text Side */}
          <div className="space-y-8">
            <div>
              <p className="text-primary-container font-bold text-xs tracking-widest uppercase mb-3">
                Compliance
              </p>
              <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
                Enterprise Grade
                <br />
                Security
              </h2>
            </div>

            <p className="text-on-surface-variant text-sm leading-relaxed">
              Your data stays yours. We employ end-to-end post-quantum
              encryption and zero-knowledge storage, ensuring your conversations
              remain private at every layer of the translation process.
            </p>

            <div className="space-y-6 pt-4">
              <div className="flex gap-4">
                <div className="mt-1 text-primary-container">
                  <Shield
                    size={20}
                    fill="currentColor"
                    className="opacity-80"
                  />
                </div>
                <div>
                  <h4 className="font-display font-bold text-lg mb-1 relative after:content-[''] after:inline-block after:w-2 after:h-2 after:bg-primary-container after:rounded-full after:ml-2 after:mb-1 after:animate-pulse">
                    SOC2 Type II Certified
                  </h4>
                  <p className="text-on-surface-variant text-sm">
                    Meeting the highest global standards for data security and
                    operational excellence.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="mt-1 text-primary-container">
                  <Lock size={20} fill="currentColor" className="opacity-80" />
                </div>
                <div>
                  <h4 className="font-display font-bold text-lg mb-1 relative after:content-[''] after:inline-block after:w-2 after:h-2 after:bg-primary-container after:rounded-full after:ml-2 after:mb-1 after:animate-pulse">
                    Zero-Retention Policy
                  </h4>
                  <p className="text-on-surface-variant text-sm">
                    Translations are processed in volatile memory and instantly
                    purged upon delivery.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Bottom CTA Block */}
        <section className="py-16 my-12">
          <div className="bg-surface-dim border border-outline-variant/10 rounded-3xl p-12 md:p-24 text-center space-y-8 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.5)]">
            <h2 className="font-display text-4xl md:text-6xl font-black italic tracking-tighter">
              Break the Silence.
            </h2>
            <p className="text-on-surface-variant max-w-lg mx-auto text-sm">
              Join over 5,000 global enterprises scaling their communication
              with TransSync AI.
            </p>
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-4">
              <Link
                to="/login"
                className="bg-primary-container text-background font-bold px-8 py-3 rounded-xl hover:bg-primary transition-colors w-full sm:w-auto text-center"
              >
                Get Started Free
              </Link>
              <button className="bg-transparent border border-outline-variant/30 text-on-surface font-bold px-8 py-3 rounded-xl hover:bg-surface-container-highest transition-colors w-full sm:w-auto">
                Contact Sales
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-outline-variant/10 py-12 px-8 mt-12 bg-background">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          <div className="col-span-1 border-r border-outline-variant/10 pr-8 hidden md:block">
            <div className="font-display font-bold text-xl tracking-tight text-primary-container mb-4">
              TransSync <span className="text-on-surface">AI</span>
            </div>
            <p className="text-on-surface-variant text-xs leading-relaxed max-w-xs">
              Redefining how the world communicates through atmospheric neural
              intelligence.
            </p>
          </div>

          <div className="space-y-4">
            <h5 className="font-display text-primary-container text-xs font-bold uppercase tracking-widest">
              Product
            </h5>
            <ul className="text-on-surface-variant text-xs space-y-3 font-medium">
              <li className="hover:text-on-surface cursor-pointer">
                Neural Engines
              </li>
              <li className="hover:text-on-surface cursor-pointer">
                Real-time Audio
              </li>
              <li className="hover:text-on-surface cursor-pointer">
                API Documentation
              </li>
              <li className="hover:text-on-surface cursor-pointer">
                Voice Synthesis
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h5 className="font-display text-primary-container text-xs font-bold uppercase tracking-widest">
              Company
            </h5>
            <ul className="text-on-surface-variant text-xs space-y-3 font-medium">
              <li className="hover:text-on-surface cursor-pointer">About Us</li>
              <li className="hover:text-on-surface cursor-pointer">Careers</li>
              <li className="hover:text-on-surface cursor-pointer">
                Global Impact
              </li>
              <li className="hover:text-on-surface cursor-pointer">Contact</li>
            </ul>
          </div>

          <div className="space-y-4">
            <h5 className="font-display text-primary-container text-xs font-bold uppercase tracking-widest">
              Legal
            </h5>
            <ul className="text-on-surface-variant text-xs space-y-3 font-medium">
              <li className="hover:text-on-surface cursor-pointer">
                Privacy Policy
              </li>
              <li className="hover:text-on-surface cursor-pointer">
                Terms of Service
              </li>
              <li className="hover:text-on-surface cursor-pointer">
                Security Audit
              </li>
              <li className="hover:text-on-surface cursor-pointer">
                Cookie Policy
              </li>
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto flex justify-between items-center pt-8 border-t border-outline-variant/10 text-[10px] text-on-surface-variant">
          <p>&copy; 2026 TransSync AI Inc. Built for the unbroken future.</p>
          <div className="flex gap-4">
            <Globe size={14} className="hover:text-on-surface cursor-pointer" />
            <Settings
              size={14}
              className="hover:text-on-surface cursor-pointer"
            />
            <User size={14} className="hover:text-on-surface cursor-pointer" />
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
