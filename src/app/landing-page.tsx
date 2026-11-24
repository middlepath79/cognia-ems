"use client";

import {
  ArrowDown,
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  Menu,
  MessageSquareText,
  ShieldCheck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const navigation = [
  { label: "Platform", href: "#platform" },
  { label: "Features", href: "#features" },
  { label: "Who we serve", href: "#schools" },
  { label: "About", href: "#about" },
];

const features = [
  {
    title: "Student management",
    description: "Keep admissions, student profiles, guardians and placements connected.",
    icon: GraduationCap,
    tone: "mint",
  },
  {
    title: "Staff management",
    description: "Bring employee records, teaching assignments and staff access together.",
    icon: Users,
    tone: "blue",
  },
  {
    title: "Academic management",
    description: "Shape classes, programmes, subjects and academic periods around your school.",
    icon: BookOpen,
    tone: "peach",
  },
  {
    title: "Attendance management",
    description: "Record and review attendance for classes and course sessions.",
    icon: ClipboardCheck,
    tone: "lavender",
  },
  {
    title: "Timetables",
    description: "Coordinate teaching sessions, staff assignments and learning spaces.",
    icon: CalendarDays,
    tone: "yellow",
  },
  {
    title: "Assessments and results",
    description: "Manage coursework, examinations, grading and student outcomes.",
    icon: BarChart3,
    tone: "mint",
  },
  {
    title: "Finance and fees",
    description: "Organise school fees, invoices and payment records in one place.",
    icon: Wallet,
    tone: "blue",
  },
  {
    title: "Communication",
    description: "Keep essential school information easier to find and share.",
    icon: MessageSquareText,
    tone: "peach",
  },
  {
    title: "Reports and insights",
    description: "Explore academic and operational reports to support better decisions.",
    icon: BarChart3,
    tone: "lavender",
  },
];

const schoolTypes = [
  {
    number: "01",
    title: "Creche & early childhood",
    description: "Care routines and early learning, with the people and records around each child in view.",
  },
  {
    number: "02",
    title: "Nursery & kindergarten",
    description: "A clear foundation for classroom organisation, family details and growing school operations.",
  },
  {
    number: "03",
    title: "Primary schools",
    description: "Connected class, attendance and academic workflows as learners move through each level.",
  },
  {
    number: "04",
    title: "Secondary schools",
    description: "Coordinate subjects, teaching assignments, assessments and school-wide administration.",
  },
];

const staffRoles = [
  { title: "Teachers", detail: "Assigned classes, timetables, attendance and assessments", icon: BookOpen },
  { title: "Accountants", detail: "Authorised finance and fee workflows", icon: Wallet },
  { title: "Librarians", detail: "The library tools their institution makes available", icon: GraduationCap },
  { title: "Receptionists", detail: "Authorised admissions and front-desk tasks", icon: MessageSquareText },
  { title: "School administrators", detail: "Institution oversight and team access", icon: ShieldCheck },
];

type LandingPageProps = {
  navBrand: ReactNode;
  footerBrand: ReactNode;
  year: number;
};

export default function LandingPage({ navBrand, footerBrand, year }: LandingPageProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      gsap.from(".landing-hero-copy > *", {
        autoAlpha: 0,
        y: 22,
        duration: 0.75,
        stagger: 0.11,
        ease: "power2.out",
      });
      gsap.from(".landing-preview-frame", {
        autoAlpha: 0,
        y: 28,
        duration: 0.9,
        delay: 0.2,
        ease: "power3.out",
      });
      gsap.to(".landing-preview-float", {
        y: -7,
        duration: 3.8,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });

      const featureCards = gsap.utils.toArray<HTMLElement>(".landing-feature-card", rootRef.current);
      const featureGrid = rootRef.current?.querySelector(".landing-feature-grid");
      if (featureCards.length && featureGrid) {
        gsap.from(featureCards, {
          autoAlpha: 0,
          y: 18,
          duration: 0.6,
          stagger: 0.08,
          ease: "power2.out",
          scrollTrigger: {
            trigger: featureGrid,
            start: "top 84%",
            once: true,
          },
        });
      }

      gsap.utils.toArray<HTMLElement>("[data-reveal]", rootRef.current).forEach((element) => {
        gsap.from(element, {
          autoAlpha: 0,
          y: 24,
          duration: 0.7,
          ease: "power2.out",
          scrollTrigger: {
            trigger: element,
            start: "top 88%",
            once: true,
          },
        });
      });
    },
    { scope: rootRef },
  );

  useGSAP(
    () => {
      if (!menuOpen || !menuRef.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.from(menuRef.current, { autoAlpha: 0, y: -8, duration: 0.22, ease: "power2.out" });
    },
    { scope: rootRef, dependencies: [menuOpen], revertOnUpdate: true },
  );

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <div className="landing" ref={rootRef}>
      <header className="landing-header">
        <div className="landing-header-inner">
          {navBrand}
          <nav className="landing-desktop-nav" aria-label="Main navigation">
            {navigation.map((item) => (
              <a href={item.href} key={item.label}>{item.label}</a>
            ))}
          </nav>
          <div className="landing-header-actions">
            <Link className="landing-login-link" href="/login">Sign in</Link>
            <Link className="landing-button landing-button-small" href="/register">
              Get started <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
          <button
            type="button"
            className="landing-menu-button"
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={menuOpen}
            aria-controls="landing-mobile-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
        <div
          className="landing-mobile-menu"
          id="landing-mobile-menu"
          ref={menuRef}
          hidden={!menuOpen}
          aria-hidden={!menuOpen}
        >
          <nav aria-label="Mobile navigation">
            {navigation.map((item) => (
              <a href={item.href} key={item.label} onClick={closeMenu}>
                {item.label}<ChevronRight size={16} aria-hidden="true" />
              </a>
            ))}
            <div className="landing-mobile-actions">
              <Link className="landing-mobile-signin" href="/login" onClick={closeMenu}>Sign in</Link>
              <Link className="landing-button" href="/register" onClick={closeMenu}>
                Get started <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
          </nav>
        </div>
      </header>

      <main>
        <section className="landing-hero" id="platform">
          <div className="landing-hero-grid">
            <div className="landing-hero-copy">
              <p className="landing-eyebrow"><span /> A more connected school day</p>
              <h1>Everything your school needs. <em>One intelligent platform.</em></h1>
              <p className="landing-hero-description">
                COGNIA brings your school&apos;s administration, students, staff, academics, attendance,
                finance and everyday operations together in one connected workspace.
              </p>
              <div className="landing-hero-actions">
                <Link className="landing-button" href="/register">
                  Get started <ArrowRight size={16} aria-hidden="true" />
                </Link>
                <Link className="landing-button-outline" href="/login">Sign in to your school</Link>
              </div>
              <div className="landing-hero-note">
                <ShieldCheck size={17} aria-hidden="true" />
                <span>Designed around your school&apos;s people, structure and permissions.</span>
              </div>
            </div>
            <div className="landing-hero-visual">
              <div className="landing-preview-float">
                <DashboardPreview />
              </div>
              <div className="landing-hero-caption">
                <span className="landing-caption-dot" />
                An illustrative look inside COGNIA
              </div>
            </div>
          </div>
          <a className="landing-scroll-cue" href="#features" aria-label="Scroll to platform features">
            <span>Explore the platform</span><ArrowDown size={15} aria-hidden="true" />
          </a>
        </section>

        <section className="landing-features landing-section" id="features">
          <div className="landing-container">
            <div className="landing-section-heading" data-reveal>
              <p className="landing-kicker">The school, connected</p>
              <h2>One platform for the work behind every school day.</h2>
              <p>Bring essential school operations into one considered workspace, built to support how your institution works.</p>
            </div>
            <div className="landing-feature-grid">
              {features.map(({ title, description, icon: Icon, tone }) => (
                <article className="landing-feature-card" key={title}>
                  <span className={`landing-feature-icon ${tone}`}><Icon size={20} strokeWidth={1.8} aria-hidden="true" /></span>
                  <h3>{title}</h3>
                  <p>{description}</p>
                  <ArrowRight className="landing-feature-arrow" size={16} aria-hidden="true" />
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-schools landing-section" id="schools">
          <div className="landing-container landing-schools-layout">
            <div className="landing-schools-intro" data-reveal>
              <p className="landing-kicker">Made for your stage</p>
              <h2>Every school is different. Your systems should know that.</h2>
              <p>
                From early learning through secondary school, COGNIA adapts to each institution&apos;s
                academic structure instead of forcing every school into the same model.
              </p>
              <Link className="landing-text-link" href="/register">Set up your institution <ArrowRight size={16} aria-hidden="true" /></Link>
            </div>
            <div className="landing-school-list">
              {schoolTypes.map((school) => (
                <article className="landing-school-item" key={school.number} data-reveal>
                  <span>{school.number}</span>
                  <div><h3>{school.title}</h3><p>{school.description}</p></div>
                  <ChevronRight size={18} aria-hidden="true" />
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-admin landing-section" id="about">
          <div className="landing-container">
            <div className="landing-admin-heading" data-reveal>
              <p className="landing-kicker landing-kicker-light">A clearer view</p>
              <h2>See your entire school.<br />Manage it from one place.</h2>
              <p>Keep a useful overview of school activity, with the detail behind each area close at hand.</p>
            </div>
            <AdminOverview />
            <div className="landing-admin-footnotes">
              <span><Check size={15} aria-hidden="true" /> School-wide overview</span>
              <span><Check size={15} aria-hidden="true" /> Important alerts</span>
              <span><Check size={15} aria-hidden="true" /> Upcoming activities</span>
              <span className="landing-sample-note">Illustrative interface · sample figures, not live data</span>
            </div>
          </div>
        </section>

        <section className="landing-staff landing-section">
          <div className="landing-container landing-staff-layout">
            <div className="landing-staff-copy" data-reveal>
              <p className="landing-kicker">People, in their place</p>
              <h2>One school.<br />One connected team.</h2>
              <p>
                Employees use a shared staff workspace that presents the tools relevant to their
                responsibilities. Their institution controls access; each role sees only what it is authorised to use.
              </p>
              <div className="landing-access-note"><ShieldCheck size={18} aria-hidden="true" /><span>Access is permission-based and managed by the institution.</span></div>
            </div>
            <div className="landing-role-card" data-reveal>
              <div className="landing-role-card-heading">
                <div><span className="landing-role-overline">THE STAFF WORKSPACE</span><h3>Tools for the work you do.</h3></div>
                <span className="landing-role-lock"><ShieldCheck size={17} aria-hidden="true" /></span>
              </div>
              <div className="landing-role-list">
                {staffRoles.map(({ title, detail, icon: Icon }) => (
                  <div className="landing-role-row" key={title}>
                    <span className="landing-role-icon"><Icon size={18} aria-hidden="true" /></span>
                    <div><h4>{title}</h4><p>{detail}</p></div>
                    <ChevronRight size={16} aria-hidden="true" />
                  </div>
                ))}
              </div>
              <p className="landing-role-footer">One team, with the right access for every role.</p>
            </div>
          </div>
        </section>

        <section className="landing-how landing-section" id="how-it-works">
          <div className="landing-container">
            <div className="landing-section-heading landing-section-heading-center" data-reveal>
              <p className="landing-kicker">A thoughtful start</p>
              <h2>Three steps to a more connected school.</h2>
              <p>Start with your institution. Build the workspace around the way it works.</p>
            </div>
            <div className="landing-steps">
              {[
                { number: "01", title: "Set up your institution", copy: "Create your account and submit your institution details through the existing onboarding flow." },
                { number: "02", title: "Configure your school", copy: "Set up the academic structure and school details that fit your institution." },
                { number: "03", title: "Bring your team in", copy: "Invite employees and organise daily work through authorised school workspaces." },
              ].map((step) => (
                <article className="landing-step" key={step.number} data-reveal>
                  <span className="landing-step-number">{step.number}</span>
                  <span className="landing-step-rule" />
                  <h3>{step.title}</h3>
                  <p>{step.copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-final-cta">
          <div className="landing-container landing-final-cta-inner" data-reveal>
            <p className="landing-kicker landing-kicker-light">A better school day starts here</p>
            <h2>Your school deserves<br />a better way to work.</h2>
            <p>Bring your school operations together with COGNIA.</p>
            <div className="landing-hero-actions">
              <Link className="landing-button" href="/register">Get started <ArrowRight size={16} aria-hidden="true" /></Link>
              <Link className="landing-button-outline" href="/login">Sign in</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-container">
          <div className="landing-footer-main">
            <div className="landing-footer-brand">
              {footerBrand}
              <p>A connected workspace for the people and work behind every school day.</p>
            </div>
            <div className="landing-footer-column"><h3>Platform</h3><a href="#platform">Overview</a><a href="#features">Features</a><a href="#about">School administration</a></div>
            <div className="landing-footer-column"><h3>Explore</h3><a href="#schools">Who we serve</a><a href="#about">About COGNIA</a><a href="#how-it-works">How it works</a></div>
            <div className="landing-footer-column"><h3>Your workspace</h3><Link href="/login">Sign in</Link><Link href="/register">Get started</Link></div>
          </div>
          <div className="landing-footer-bottom">
            <span>© {year} COGNIA. All rights reserved.</span>
            <span>Built for schools. Shaped around your institution.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function DashboardPreview() {
  return (
    <div className="landing-preview-frame" role="img" aria-label="Illustrative COGNIA school administration dashboard">
      <div className="landing-preview-topbar">
        <div className="landing-window-dots"><i /><i /><i /></div>
        <span>cognia / school overview</span>
        <span className="landing-preview-avatar">A</span>
      </div>
      <div className="landing-preview-body">
        <aside className="landing-preview-sidebar">
          <div className="landing-preview-wordmark"><b>COGNIA</b></div>
          <span className="landing-preview-nav-label">WORKSPACE</span>
          <div className="landing-preview-nav active"><LayoutDashboard size={14} /> Overview</div>
          <div className="landing-preview-nav"><GraduationCap size={14} /> Students</div>
          <div className="landing-preview-nav"><Users size={14} /> Staff</div>
          <div className="landing-preview-nav"><CalendarDays size={14} /> Academics</div>
          <div className="landing-preview-nav"><ClipboardCheck size={14} /> Attendance</div>
          <div className="landing-preview-sidebar-note"><span /> All systems ready</div>
        </aside>
        <div className="landing-preview-main">
          <div className="landing-preview-heading">
            <div><span>MONDAY, 12 MAY</span><h2>Good morning, Admin</h2><p>Here&apos;s a look at your school today.</p></div>
            <span className="landing-preview-notification" aria-hidden="true"><Bell size={16} /></span>
          </div>
          <div className="landing-preview-metrics">
            <PreviewMetric icon={<GraduationCap size={14} />} label="Students" value="1,248" change="Across all classes" />
            <PreviewMetric icon={<Users size={14} />} label="Staff" value="86" change="Teaching & support" />
            <PreviewMetric icon={<ClipboardCheck size={14} />} label="Attendance" value="94.2%" change="Today's overview" />
          </div>
          <div className="landing-preview-panels">
            <div className="landing-preview-chart">
              <div className="landing-panel-title"><div><b>School activity</b><span>Attendance overview</span></div><span className="landing-chart-period">This week⌄</span></div>
              <div className="landing-chart-area">
                <div className="landing-chart-y"><span>100%</span><span>75%</span><span>50%</span><span>25%</span></div>
                <div className="landing-chart-bars" aria-hidden="true">
                  {[72, 86, 66, 94, 78, 88, 62].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}
                </div>
              </div>
              <div className="landing-chart-days"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span></div>
            </div>
            <div className="landing-preview-activity">
              <div className="landing-panel-title"><div><b>Coming up</b><span>School calendar</span></div><CalendarDays size={15} /></div>
              <div className="landing-preview-event"><span className="landing-event-date">14<br /><small>MAY</small></span><span><b>Mid-term assessments</b><small>Academic calendar</small></span></div>
              <div className="landing-preview-event"><span className="landing-event-date blue">16<br /><small>MAY</small></span><span><b>Staff planning meeting</b><small>Staff calendar</small></span></div>
            </div>
          </div>
        </div>
      </div>
      <p className="landing-preview-disclaimer">Illustrative sample data · not a live school account</p>
    </div>
  );
}

function PreviewMetric({ icon, label, value, change }: { icon: ReactNode; label: string; value: string; change: string }) {
  return (
    <div className="landing-preview-metric">
      <div className="landing-preview-metric-label">{icon}<span>{label}</span></div>
      <b>{value}</b>
      <small>{change}</small>
    </div>
  );
}

function AdminOverview() {
  return (
    <div className="landing-admin-window" role="img" aria-label="Illustrative school overview showing sample students, staff, attendance, fees, academic activity, alerts, and events" data-reveal>
      <div className="landing-admin-window-bar"><span /><span /><span /><p>School overview</p><span className="landing-window-date">A sample workspace · Today</span></div>
      <div className="landing-admin-window-content">
        <div className="landing-admin-window-heading"><div><span>MONDAY · 12 MAY</span><h3>Good morning, school admin</h3><p>A considered view of the activity across your institution.</p></div><span className="landing-admin-period"><CalendarDays size={14} /> This term</span></div>
        <div className="landing-admin-stat-grid">
          <AdminStat label="Students" value="1,248" detail="Across all year groups" icon={<GraduationCap size={17} />} />
          <AdminStat label="Staff team" value="86" detail="Teaching & non-teaching" icon={<Users size={17} />} />
          <AdminStat label="Attendance" value="94.2%" detail="Illustrative daily view" icon={<ClipboardCheck size={17} />} />
          <AdminStat label="Fee collection" value="72%" detail="Example term progress" icon={<Wallet size={17} />} />
        </div>
        <div className="landing-admin-lower-grid">
          <div className="landing-admin-chart-card">
            <div className="landing-admin-lower-title"><span><b>Academic activity</b><small>Example overview across the term</small></span><span className="landing-chart-period">This term⌄</span></div>
            <div className="landing-admin-chart" aria-hidden="true">
              <div className="landing-admin-chart-guides"><i /><i /><i /><i /></div>
              <div className="landing-admin-chart-bars">{[48, 62, 54, 75, 66, 82, 70, 91, 77, 86, 68, 96].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div>
            </div>
            <div className="landing-admin-chart-labels"><span>Week 1</span><span>Week 4</span><span>Week 8</span><span>Week 12</span></div>
          </div>
          <div className="landing-admin-alert-card">
            <div className="landing-admin-lower-title"><span><b>School pulse</b><small>Illustrative items to review</small></span><span className="landing-alert-indicator" /></div>
            <div className="landing-alert-row"><span className="landing-alert-icon green"><Check size={15} /></span><span><b>Attendance recorded</b><small>Class registers · today</small></span><ChevronRight size={15} /></div>
            <div className="landing-alert-row"><span className="landing-alert-icon gold"><CalendarDays size={15} /></span><span><b>Assessment period ahead</b><small>Academic calendar · this week</small></span><ChevronRight size={15} /></div>
            <div className="landing-alert-row"><span className="landing-alert-icon blue"><Users size={15} /></span><span><b>Team workspace ready</b><small>Staff access · institution managed</small></span><ChevronRight size={15} /></div>
          </div>
        </div>
      </div>
      <div className="landing-admin-disclaimer">Illustrative school overview · sample figures and events, not live data</div>
    </div>
  );
}

function AdminStat({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: ReactNode }) {
  return <div className="landing-admin-stat"><span className="landing-admin-stat-icon">{icon}</span><span className="landing-admin-stat-label">{label}</span><b>{value}</b><small>{detail}</small></div>;
}
