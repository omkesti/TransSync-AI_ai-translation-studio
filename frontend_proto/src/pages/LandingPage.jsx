import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BookMarked,
  Database,
  EyeOff,
  FileText,
  Lock,
  ScanSearch,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  AnimatePresence,
  animate,
  motion,
  useInView,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";

const EASE = [0.22, 1, 0.36, 1];

/* ----------------------------------------------------------------------- */
/* Motion primitives                                                       */
/* ----------------------------------------------------------------------- */

/** Line of display type revealed from behind a mask.
 *  The viewport observer lives on the outer (unclipped) mask: the inner span
 *  starts fully clipped by overflow-hidden, so IntersectionObserver would
 *  never see it intersect. The reveal is propagated down via variants. */
function MaskLine({ children, delay = 0, className = "", once = true }) {
  return (
    <motion.span
      className={`block overflow-hidden ${className}`}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, margin: "-8% 0px" }}
    >
      <motion.span
        className="block will-change-transform"
        variants={{
          hidden: { y: "115%" },
          visible: { y: 0, transition: { duration: 1, ease: EASE, delay } },
        }}
      >
        {children}
      </motion.span>
    </motion.span>
  );
}

/** Generic fade-and-rise on scroll. */
function Reveal({ children, delay = 0, y = 36, className = "" }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10% 0px" }}
      transition={{ duration: 0.9, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

/** Word that flips through its translations. */
function CyclingWord({ words, interval = 2400, className = "" }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIndex((i) => (i + 1) % words.length), interval);
    return () => clearInterval(t);
  }, [words.length, interval]);

  return (
    <span className={`inline-grid overflow-hidden align-bottom ${className}`}>
      <AnimatePresence mode="wait" initial>
        <motion.span
          key={words[index]}
          className="inline-block whitespace-nowrap [grid-area:1/1]"
          initial={{ y: "105%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "-105%", opacity: 0 }}
          transition={{ duration: 0.55, ease: EASE }}
        >
          {words[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** Element that magnetically follows the cursor. */
function Magnetic({ children, strength = 0.3, className = "" }) {
  const ref = useRef(null);
  const x = useSpring(0, { stiffness: 220, damping: 16 });
  const y = useSpring(0, { stiffness: 220, damping: 16 });

  const onMove = (e) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    x.set((e.clientX - rect.left - rect.width / 2) * strength);
    y.set((e.clientY - rect.top - rect.height / 2) * strength);
  };
  const onLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ x, y }}
      className={`inline-block ${className}`}
    >
      {children}
    </motion.div>
  );
}

/** Rotating "scroll to explore" badge. */
function ScrollBadge() {
  return (
    <div className="relative h-28 w-28 md:h-32 md:w-32 shrink-0" aria-hidden="true">
      <svg viewBox="0 0 100 100" className="h-full w-full animate-spin-slow">
        <defs>
          <path
            id="scroll-circle"
            d="M 50,50 m -40,0 a 40,40 0 1,1 80,0 a 40,40 0 1,1 -80,0"
          />
        </defs>
        <text
          fill="#adaaaa"
          style={{ fontSize: "8px", fontFamily: '"Space Mono", monospace', letterSpacing: "0.18em" }}
        >
          <textPath href="#scroll-circle">
            SCROLL TO EXPLORE · SCROLL TO EXPLORE ·
          </textPath>
        </text>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        >
          <ArrowDown size={18} className="text-primary-container" />
        </motion.div>
      </div>
    </div>
  );
}

/** Count-up statistic. */
function Stat({ value, label, delay = 0 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-15% 0px" });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, value, {
      duration: 1.6,
      delay,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, value, delay]);

  return (
    <div ref={ref} className="flex flex-col items-center gap-3 py-10 text-center">
      <span className="font-hero text-6xl font-black leading-none tracking-tight md:text-7xl">
        {display}
      </span>
      <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-on-surface-variant">
        {label}
      </span>
    </div>
  );
}

/** Showcase card with scroll parallax + hover zoom, reference style. */
function ShowcaseCard({ img, title, tag, className = "", delay = 0 }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], ["-9%", "9%"]);

  return (
    <Reveal delay={delay} className={className}>
      <Link
        to="/login"
        className="group relative block h-full w-full overflow-hidden rounded-2xl bg-surface-container-low"
      >
        <div ref={ref} className="h-full w-full">
          <motion.div style={{ y }} className="h-full w-full scale-[1.18]">
            <img
              src={img}
              alt={title}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-105"
            />
          </motion.div>
        </div>

        {/* Caption bar */}
        <div className="absolute inset-x-3 bottom-3 flex items-center justify-between rounded-xl bg-black/55 px-5 py-4 backdrop-blur-md">
          <p className="font-grotesk text-sm text-on-surface md:text-base">
            {title}{" "}
            <span className="text-on-surface-variant">/ {tag}</span>
          </p>
          <ArrowRight
            size={18}
            className="shrink-0 text-primary-container transition-transform duration-300 group-hover:translate-x-1.5"
          />
        </div>
      </Link>
    </Reveal>
  );
}

/** Feature card for the staggered grid. */
function FeatureCard({ icon: Icon, title, copy, delay = 0, className = "" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-8% 0px" }}
      transition={{ duration: 0.8, ease: EASE, delay }}
      className={`group flex min-h-[280px] flex-col justify-between rounded-2xl bg-surface-container-low p-7 transition-colors duration-500 hover:bg-[#181818] ${className}`}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.05] text-primary-container transition-all duration-500 group-hover:rotate-[360deg] group-hover:shadow-[0_0_24px_rgba(197,254,0,0.25)]">
        <Icon size={18} />
      </div>
      <div className="space-y-3 pt-14">
        <h3 className="font-grotesk text-xl font-semibold tracking-tight text-on-surface">
          {title}
        </h3>
        <p className="text-sm leading-relaxed text-on-surface-variant">{copy}</p>
      </div>
    </motion.div>
  );
}

/** Full-bleed marquee row. */
function MarqueeRow({ items, ghost = false, reverse = false, slow = false }) {
  const anim = reverse
    ? "animate-marquee-reverse"
    : slow
      ? "animate-marquee-slow"
      : "animate-marquee";
  const doubled = [...items, ...items];
  return (
    <div className="flex overflow-hidden">
      <div className={`flex w-max shrink-0 items-center gap-10 pr-10 ${anim}`}>
        {doubled.map((item, i) => (
          <span
            key={i}
            aria-hidden={i >= items.length}
            className="flex items-center gap-10 whitespace-nowrap"
          >
            {/* leading-normal: Devanagari/CJK glyphs paint beyond the latin
                em-box; with the default line-height of 1 the row's
                overflow-hidden clips them top and bottom. */}
            <span
              className={`font-hero text-4xl font-bold uppercase leading-normal tracking-tight md:text-6xl ${
                ghost ? "text-ghost" : "text-on-surface"
              }`}
            >
              {item}
            </span>
            <span className="text-2xl text-primary-container md:text-3xl">✳</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* Sections                                                                */
/* ----------------------------------------------------------------------- */

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.nav
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.9, ease: EASE, delay: 0.15 }}
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-500 ${
        scrolled ? "bg-background/75 backdrop-blur-md" : "bg-transparent"
      }`}
    >
      <div className="relative mx-auto flex h-16 max-w-[1400px] items-center justify-between px-6 md:px-10">
        <div className="hidden gap-8 font-mono text-[11px] uppercase tracking-[0.2em] text-on-surface-variant md:flex">
          <a href="#features" className="transition-colors hover:text-on-surface">
            Platform
          </a>
          <a href="#workflow" className="transition-colors hover:text-on-surface">
            Workflow
          </a>
        </div>

        <Link
          to="/"
          className="absolute left-1/2 -translate-x-1/2 font-hero text-sm font-bold uppercase tracking-[0.35em] text-on-surface"
        >
          TransSync <span className="text-primary-container">AI</span>
        </Link>

        <div className="ml-auto flex items-center gap-8">
          <a
            href="#security"
            className="hidden font-mono text-[11px] uppercase tracking-[0.2em] text-on-surface-variant transition-colors hover:text-on-surface md:block"
          >
            Security
          </a>
          <Link
            to="/login"
            className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary-container transition-colors hover:text-primary"
          >
            Login
          </Link>
        </div>
      </div>
    </motion.nav>
  );
}

function Hero() {
  return (
    <header className="relative flex min-h-[100svh] flex-col justify-center overflow-hidden px-6 pt-28 pb-16 md:px-10">
      {/* Light spill from above, reference style */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_45%_at_50%_-8%,rgba(255,255,255,0.09),transparent_65%)]"
      />
      <div aria-hidden="true" className="dot-grid pointer-events-none absolute inset-0 opacity-[0.05]" />

      {/* Ambient drifting glows */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -top-44 left-[18%] h-[520px] w-[520px] rounded-full bg-primary-container/[0.07] blur-[140px]"
        animate={{ x: [0, 70, -40, 0], y: [0, 50, 15, 0] }}
        transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-56 right-[8%] h-[460px] w-[460px] rounded-full bg-secondary/[0.05] blur-[140px]"
        animate={{ x: [0, -60, 30, 0], y: [0, -40, -10, 0] }}
        transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative mx-auto w-full max-w-[1400px]">
        {/* Top meta row */}
        <div className="mb-10 flex items-start justify-between md:mb-4">
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.5 }}
            className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.25em] text-on-surface-variant"
          >
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary-container" />
            Translation studio
          </motion.p>
          <motion.div
            initial={{ opacity: 0, rotate: -30, scale: 0.6 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            transition={{ duration: 0.9, ease: EASE, delay: 0.6 }}
          >
            <ArrowUpRight
              size={44}
              strokeWidth={1.5}
              className="text-primary-container"
            />
          </motion.div>
        </div>

        {/* Headline */}
        <h1 className="text-center font-hero font-black uppercase leading-[0.88] tracking-[-0.02em] text-on-surface">
          <MaskLine delay={0.2}>
            <span className="text-[clamp(2.6rem,8vw,7.5rem)]">Translate once.</span>
          </MaskLine>
          <MaskLine delay={0.32}>
            <span className="text-[clamp(3rem,10.5vw,10rem)]">Remember</span>
          </MaskLine>
        </h1>
        <div className="mt-1 text-center font-serif text-[clamp(2.2rem,6.5vw,5.8rem)] font-medium italic leading-[1.15] text-on-surface">
          <Reveal delay={0.5} y={24}>
            <CyclingWord
              words={[
                "forever.",
                "pour toujours.",
                "para siempre.",
                "für immer.",
                "per sempre.",
              ]}
            />
          </Reveal>
        </div>

        {/* Sub row: meta / badge / paragraph */}
        <div className="mt-14 flex flex-col items-center gap-10 md:mt-16 md:flex-row md:items-end md:justify-between">
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.9 }}
            className="order-3 hidden font-mono text-[11px] uppercase tracking-[0.25em] text-on-surface-variant md:order-1 md:block"
          >
            (01) — The precision engine
          </motion.p>

          <motion.div
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, ease: EASE, delay: 1 }}
            className="order-1 md:order-2"
          >
            <ScrollBadge />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.9 }}
            className="order-2 max-w-xs space-y-5 text-center md:order-3 md:text-left"
          >
            <p className="text-sm leading-relaxed text-on-surface-variant">
              The AI translation studio with memory — every approved sentence is
              reused, your glossary is enforced, and documents export with their
              original formatting intact.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-full bg-primary-container px-6 py-3 text-sm font-bold text-background transition-all hover:bg-primary hover:shadow-[0_0_28px_rgba(197,254,0,0.35)]"
            >
              Start translating <ArrowRight size={15} />
            </Link>
          </motion.div>
        </div>
      </div>
    </header>
  );
}

function MarqueeBand() {
  return (
    <section className="overflow-hidden py-14 md:py-20" aria-hidden="true">
      <div className="-mx-[3%] w-[106%] -rotate-[1.2deg] space-y-1">
        <MarqueeRow
          items={[
            "English",
            "Español",
            "Français",
            "Deutsch",
            "日本語",
            "हिन्दी",
            "मराठी",
          ]}
        />
        <MarqueeRow
          ghost
          reverse
          items={["Upload", "Validate", "Translate", "Review", "Approve", "Export"]}
        />
      </div>
    </section>
  );
}

function Features() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const headingX = useTransform(scrollYProgress, [0, 1], [0, -60]);

  return (
    <section id="features" ref={ref} className="scroll-mt-24 px-6 py-24 md:px-10 md:py-32">
      <div className="mx-auto max-w-[1400px]">
        <motion.h2
          style={{ x: headingX }}
          className="font-hero text-[clamp(3.4rem,11vw,9.5rem)] font-black uppercase leading-none tracking-tight text-on-surface"
        >
          <MaskLine>Features</MaskLine>
        </motion.h2>

        <div className="mt-14 grid grid-cols-1 gap-3 md:grid-cols-4">
          {/* Left rail */}
          <div className="flex flex-col justify-between gap-16 p-2 md:row-span-2">
            <Reveal delay={0.1}>
              <p className="max-w-[180px] font-grotesk text-lg leading-snug text-on-surface">
                Consistency,
                <br />
                by design
              </p>
            </Reveal>
            <Reveal delay={0.25}>
              <ArrowUpRight
                size={40}
                strokeWidth={1.5}
                className="text-primary-container"
              />
            </Reveal>
          </div>

          <FeatureCard
            icon={Database}
            title="Translation Memory"
            copy="Every approved sentence is stored in your organization's memory. Exact matches return instantly — before a model is ever called."
            delay={0.05}
            className="md:col-start-3"
          />
          <FeatureCard
            icon={ScanSearch}
            title="Semantic Recall"
            copy="Vector search finds near-identical sentences you've already translated and hands them to the model as guidance."
            delay={0.15}
          />
          <FeatureCard
            icon={BookMarked}
            title="Glossary Enforcement"
            copy="Verified terminology is injected into every prompt and re-checked after translation, so domain language stays exact."
            delay={0.1}
            className="md:col-start-2"
          />
          <FeatureCard
            icon={ShieldCheck}
            title="Back-Translation QA"
            copy="An independent model translates every AI result back to the source and flags anything that drifts in meaning."
            delay={0.2}
          />
          <FeatureCard
            icon={FileText}
            title="Format-True Export"
            copy="Translations are injected into your original DOCX at the run level — fonts, tables and styles survive untouched."
            delay={0.3}
          />
        </div>
      </div>
    </section>
  );
}

function Showcase() {
  return (
    <section id="studio" className="scroll-mt-24 px-6 py-24 md:px-10 md:py-32">
      <div className="mx-auto max-w-[1400px]">
        <h2 className="text-center leading-none">
          <MaskLine>
            <span className="font-serif text-[clamp(2.8rem,8vw,6.5rem)] italic text-on-surface">
              Inside{" "}
            </span>
            <span className="font-hero text-[clamp(2.8rem,8vw,6.5rem)] font-black uppercase tracking-tight text-on-surface">
              the Studio
            </span>
          </MaskLine>
        </h2>

        <div className="mt-16 space-y-4">
          <ShowcaseCard
            img="/hero_devices.png"
            title="Review Studio"
            tag="Human-in-the-loop approval"
            className="aspect-[16/10] md:aspect-[21/9]"
          />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ShowcaseCard
              img="/feature_neural.png"
              title="Translation Memory"
              tag="Approved once, reused forever"
              className="aspect-[4/5] md:aspect-[4/4.4]"
              delay={0.1}
            />
            <ShowcaseCard
              img="/feature_transsync.png"
              title="Glossary Engine"
              tag="Terminology under control"
              className="aspect-[4/5] md:aspect-[4/4.4]"
              delay={0.2}
            />
          </div>
          <ShowcaseCard
            img="/feature_global.png"
            title="Format-True Export"
            tag="Every run, every style, intact"
            className="aspect-[16/10] md:aspect-[21/9]"
            delay={0.1}
          />
        </div>
      </div>
    </section>
  );
}

const WORKFLOW_STEPS = [
  {
    n: "01",
    title: "Upload & Validate",
    copy: "PDF or DOCX in. Sentences are cleaned, split and grammar-checked by the NLP pipeline — before a single token is spent.",
  },
  {
    n: "02",
    title: "Translate with Memory",
    copy: "Exact memory hits return instantly. Semantic recall guides the model on near-matches; only genuinely new sentences go cold.",
  },
  {
    n: "03",
    title: "Review & Approve",
    copy: "Editors refine and approve line by line. Every approval is indexed straight back into your organization's memory.",
  },
  {
    n: "04",
    title: "Export Format-True",
    copy: "Translations are injected into the original document at the run level — layout, tables and styles come out untouched.",
  },
];

function Workflow() {
  return (
    <section id="workflow" className="scroll-mt-24 px-6 py-24 md:px-10 md:py-32">
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-16 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <h2 className="font-hero text-[clamp(3rem,9vw,8rem)] font-black uppercase leading-none tracking-tight text-on-surface">
            <MaskLine>Workflow</MaskLine>
          </h2>
          <Reveal delay={0.2}>
            <p className="max-w-xs font-mono text-[11px] uppercase leading-relaxed tracking-[0.2em] text-on-surface-variant md:text-right">
              (02) — From upload
              <br />
              to download
            </p>
          </Reveal>
        </div>

        <div>
          {WORKFLOW_STEPS.map((step, i) => (
            <Reveal key={step.n} delay={i * 0.08}>
              <div className="group grid grid-cols-[auto_1fr] items-baseline gap-6 border-t border-white/5 py-10 transition-colors duration-500 hover:bg-surface-container-low md:grid-cols-[100px_1fr_minmax(0,380px)_40px] md:gap-10 md:px-6">
                <span className="font-mono text-sm text-primary-container">
                  {step.n}
                </span>
                <h3 className="font-hero text-2xl font-bold uppercase tracking-tight text-on-surface md:text-4xl">
                  {step.title}
                </h3>
                <p className="col-span-2 text-sm leading-relaxed text-on-surface-variant md:col-span-1">
                  {step.copy}
                </p>
                <ArrowUpRight
                  size={22}
                  className="hidden text-on-surface-variant opacity-0 transition-all duration-500 group-hover:translate-x-1 group-hover:text-primary-container group-hover:opacity-100 md:block"
                />
              </div>
            </Reveal>
          ))}
          <div className="border-t border-white/5" />
        </div>
      </div>
    </section>
  );
}

function Stats() {
  return (
    <section className="px-6 py-10 md:px-10">
      <div className="mx-auto grid max-w-[1400px] grid-cols-2 rounded-2xl bg-surface-container-low md:grid-cols-4">
        <Stat value={7} label="Languages" />
        <Stat value={4} label="Tiers of recall" delay={0.1} />
        <Stat value={2} label="Independent models" delay={0.2} />
        <Stat value={0} label="Files kept on disk" delay={0.3} />
      </div>
    </section>
  );
}

const SECURITY_ITEMS = [
  {
    icon: EyeOff,
    title: "Stateless by default",
    copy: "Documents are parsed in memory and never written to disk. Nothing persists unless you approve it.",
  },
  {
    icon: Lock,
    title: "Organization-scoped",
    copy: "Role-based access is resolved on every request. Memory, glossary and analytics never leave your org.",
  },
  {
    icon: Users,
    title: "Invitation-only",
    copy: "No public signups. Your workspace grows only when an owner or admin extends an invite.",
  },
];

function Security() {
  return (
    <section id="security" className="scroll-mt-24 px-6 py-24 md:px-10 md:py-32">
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-16 md:grid-cols-2">
        <div>
          <Reveal>
            <p className="mb-6 font-mono text-[11px] uppercase tracking-[0.25em] text-on-surface-variant">
              (03) — Security
            </p>
          </Reveal>
          <h2 className="leading-[0.95]">
            <MaskLine>
              <span className="font-hero text-[clamp(2.6rem,6.5vw,5.5rem)] font-black uppercase tracking-tight text-on-surface">
                Private by
              </span>
            </MaskLine>
            <MaskLine delay={0.12}>
              <span className="font-serif text-[clamp(2.6rem,6.5vw,5.5rem)] italic text-primary-container">
                architecture.
              </span>
            </MaskLine>
          </h2>
        </div>

        <div className="space-y-2 self-center">
          {SECURITY_ITEMS.map((item, i) => (
            <Reveal key={item.title} delay={i * 0.1}>
              <div className="group flex gap-6 rounded-2xl p-6 transition-colors duration-500 hover:bg-surface-container-low">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/[0.05] text-primary-container">
                  <item.icon size={18} />
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-grotesk text-lg font-semibold text-on-surface">
                    {item.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-on-surface-variant">
                    {item.copy}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="relative overflow-hidden px-6 py-32 md:px-10 md:py-44">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <span className="text-ghost font-hero text-[22vw] font-black uppercase leading-none tracking-tight opacity-60">
          Memory
        </span>
      </div>
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-container/[0.06] blur-[130px]"
        animate={{ scale: [1, 1.25, 1] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative mx-auto flex max-w-[1400px] flex-col items-center gap-10 text-center">
        <Reveal>
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-on-surface-variant">
            ( Ready when you are )
          </p>
        </Reveal>
        <h2 className="leading-[0.95]">
          <MaskLine>
            <span className="font-hero text-[clamp(3rem,10vw,8.5rem)] font-black uppercase tracking-tight text-on-surface">
              Start
            </span>
          </MaskLine>
        </h2>
        <div className="-mt-6 font-serif text-[clamp(2.2rem,6vw,5rem)] italic leading-[1.15] text-on-surface">
          <Reveal delay={0.15}>
            <CyclingWord
              words={[
                "translating.",
                "traduire.",
                "traducir.",
                "übersetzen.",
                "tradurre.",
              ]}
              interval={2200}
            />
          </Reveal>
        </div>

        <Reveal delay={0.25}>
          <Magnetic strength={0.35}>
            <Link
              to="/login"
              className="group inline-flex items-center gap-3 rounded-full bg-primary-container px-10 py-5 font-grotesk text-base font-bold text-background transition-all hover:bg-primary hover:shadow-[0_0_40px_rgba(197,254,0,0.4)]"
            >
              Enter the studio
              <ArrowRight
                size={18}
                className="transition-transform duration-300 group-hover:translate-x-1.5"
              />
            </Link>
          </Magnetic>
        </Reveal>

        <Reveal delay={0.35}>
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-on-surface-variant">
            Invitation-only onboarding · ask your workspace admin
          </p>
        </Reveal>
      </div>
    </section>
  );
}

const FOOTER_COLUMNS = [
  {
    heading: "Product",
    items: [
      "Translation Memory",
      "Glossary Control",
      "Review Workflow",
      "Format-True Export",
    ],
  },
  {
    heading: "Company",
    items: ["About Us", "Careers", "Global Impact", "Contact"],
  },
  {
    heading: "Legal",
    items: ["Privacy Policy", "Terms of Service", "Security Audit", "Cookie Policy"],
  },
];

function Footer() {
  return (
    <footer className="overflow-hidden border-t border-white/5 px-6 pb-10 pt-20 md:px-10">
      <div className="mx-auto max-w-[1400px]">
        <Reveal>
          <p className="font-hero text-[clamp(2.6rem,9.5vw,9rem)] font-black uppercase leading-none tracking-tight text-on-surface">
            TransSync <span className="text-primary-container">AI</span>
          </p>
        </Reveal>

        <div className="mt-16 grid grid-cols-1 gap-12 md:grid-cols-4">
          <p className="max-w-xs text-sm leading-relaxed text-on-surface-variant">
            Context-aware document translation with memory, glossary control,
            and human review — built for teams that translate the same domain
            every day.
          </p>
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.heading} className="space-y-4">
              <h5 className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-primary-container">
                {col.heading}
              </h5>
              <ul className="space-y-3 font-grotesk text-sm text-on-surface-variant">
                {col.items.map((item) => (
                  <li
                    key={item}
                    className="cursor-pointer transition-colors hover:text-on-surface"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-white/5 pt-8 font-mono text-[10px] uppercase tracking-[0.2em] text-on-surface-variant md:flex-row">
          <p>© 2026 TransSync AI</p>
          <p>Translate with context, memory, and confidence.</p>
        </div>
      </div>
    </footer>
  );
}

/* ----------------------------------------------------------------------- */
/* Page                                                                    */
/* ----------------------------------------------------------------------- */

function LandingPage() {
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 24 });

  return (
    <div className="min-h-screen bg-background font-grotesk text-on-surface selection:bg-primary-container selection:text-background">
      {/* Scroll progress bar */}
      <motion.div
        style={{ scaleX: progress }}
        className="fixed inset-x-0 top-0 z-[60] h-[2px] origin-left bg-primary-container"
      />
      <div className="noise-overlay" aria-hidden="true" />

      <Navbar />
      <Hero />
      <MarqueeBand />
      <Features />
      <Showcase />
      <Workflow />
      <Stats />
      <Security />
      <CTA />
      <Footer />
    </div>
  );
}

export default LandingPage;
