import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../hooks/useApi';
import { isNew } from '../utils/formatDate';
import { Modal } from '../components/ui/Modal';
import { NbslLogo } from '../components/ui/NbslLogo';

interface Announcement {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  visibleFrom: string;
  files: { id: string; filename: string; fileUrl: string }[];
}

interface ResearchProject {
  id: string;
  title: string;
  researchType: 'current' | 'completed';
  summary: string | null;
  description: string | null;
  leadResearcher: string | null;
  year: number | null;
  imageUrl: string | null;
  externalLink: string | null;
}

// ── Auto-scrolling infinite carousel ─────────────────────────────────────────
function ProjectCarousel({
  projects,
  onSelect,
}: {
  projects: ResearchProject[];
  onSelect: (p: ResearchProject) => void;
}) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const n = projects.length;

  const next = useCallback(() => setIdx((i) => (i + 1) % n), [n]);
  const prev = useCallback(() => setIdx((i) => (i - 1 + n) % n), [n]);

  useEffect(() => {
    if (paused || n <= 1) return;
    timerRef.current = setInterval(next, 4000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [paused, next, n]);

  if (n === 0) return null;

  // Show up to 3 cards (loop-aware)
  const visible = Math.min(3, n);
  const cards = Array.from({ length: visible }, (_, i) => projects[(idx + i) % n]);

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((p, i) => (
          <ProjectCard key={`${p.id}-${i}`} project={p} onSelect={onSelect} />
        ))}
      </div>

      {/* Navigation */}
      {n > 1 && (
        <div className="flex items-center justify-center gap-4 mt-6">
          <button
            onClick={prev}
            className="w-9 h-9 rounded-full border border-gray-300 bg-white flex items-center justify-center hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm"
            aria-label="Previous"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Dot indicators */}
          <div className="flex gap-1.5">
            {projects.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={`rounded-full transition-all ${
                  i === idx ? 'w-5 h-2 bg-primary-600' : 'w-2 h-2 bg-gray-300 hover:bg-gray-400'
                }`}
                aria-label={`Go to project ${i + 1}`}
              />
            ))}
          </div>

          <button
            onClick={next}
            className="w-9 h-9 rounded-full border border-gray-300 bg-white flex items-center justify-center hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm"
            aria-label="Next"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

function ProjectCard({
  project: p,
  onSelect,
}: {
  project: ResearchProject;
  onSelect: (p: ResearchProject) => void;
}) {
  const isCompleted = p.researchType === 'completed';

  const handleClick = () => {
    if (isCompleted && p.externalLink) {
      window.open(p.externalLink, '_blank', 'noopener,noreferrer');
    } else {
      onSelect(p);
    }
  };

  return (
    <div
      onClick={handleClick}
      className="group bg-white rounded-2xl border border-gray-200 overflow-hidden cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
    >
      {p.imageUrl ? (
        <div className="h-44 overflow-hidden">
          <img
            src={p.imageUrl}
            alt={p.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      ) : (
        <div className="h-44 bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center">
          <NbslLogo size={48} color="#1d4ed8" className="opacity-30" />
        </div>
      )}
      <div className="p-5">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2 group-hover:text-primary-700 transition-colors">
            {p.title}
          </h3>
          {isCompleted && (
            <span className="shrink-0 text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5 font-medium">Done</span>
          )}
        </div>
        {p.leadResearcher && (
          <p className="text-xs text-gray-500 mb-1">{p.leadResearcher}</p>
        )}
        {p.year && (
          <p className="text-xs text-gray-400 mb-2">{p.year}</p>
        )}
        {p.summary && (
          <p className="text-xs text-gray-600 line-clamp-2 mb-3">{p.summary}</p>
        )}
        <div className="flex items-center gap-1.5 text-xs font-medium">
          {isCompleted && p.externalLink ? (
            <span className="text-primary-600 group-hover:underline">View Publication →</span>
          ) : (
            <span className="text-primary-600 group-hover:underline">Learn more →</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Announcement card navigator ───────────────────────────────────────────────
function AnnouncementSection({
  announcements,
  onOpen,
}: {
  announcements: Announcement[];
  onOpen: (a: Announcement) => void;
}) {
  const [idx, setIdx] = useState(0);
  if (announcements.length === 0) return null;

  const current = announcements[idx];
  const snippet = current.content.slice(0, 160) + (current.content.length > 160 ? '…' : '');

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-KR', { year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <section className="py-16 px-6 bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-900 mb-8">Announcements &amp; Information</h2>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Main card */}
          <div className="flex flex-col md:flex-row">
            {/* Left: content */}
            <div className="flex-1 p-8">
              <div className="flex items-center gap-3 mb-3">
                {isNew(current.createdAt) && (
                  <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-medium">New</span>
                )}
                <span className="text-xs text-gray-400">{fmtDate(current.createdAt)}</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">{current.title}</h3>
              <p className="text-gray-600 text-sm leading-relaxed mb-5">{snippet}</p>
              <button
                onClick={() => onOpen(current)}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
              >
                Read full announcement
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Right: navigation rail */}
            <div className="md:w-64 border-t md:border-t-0 md:border-l border-gray-100 bg-slate-50 p-4 flex flex-col gap-1 overflow-y-auto max-h-72">
              {announcements.map((a, i) => (
                <button
                  key={a.id}
                  onClick={() => setIdx(i)}
                  className={`text-left px-3 py-2.5 rounded-lg text-sm transition-all ${
                    i === idx
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'text-gray-700 bg-slate-50 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isNew(a.createdAt) && i !== idx && (
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full shrink-0" />
                    )}
                    <span className="line-clamp-2 font-medium text-xs">{a.title}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Footer: prev/next */}
          <div className="px-8 py-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-400">{idx + 1} of {announcements.length}</span>
            <div className="flex gap-2">
              <button
                onClick={() => setIdx((i) => (i - 1 + announcements.length) % announcements.length)}
                className="px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                ← Previous
              </button>
              <button
                onClick={() => setIdx((i) => (i + 1) % announcements.length)}
                className="px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Main Landing ──────────────────────────────────────────────────────────────
export default function Landing() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [research, setResearch] = useState<ResearchProject[]>([]);
  const [selectedAnn, setSelectedAnn] = useState<Announcement | null>(null);
  const [selectedProject, setSelectedProject] = useState<ResearchProject | null>(null);

  useEffect(() => {
    api.get('/api/announcements').then((r) => setAnnouncements(r.data.data ?? []));
    api.get('/api/research').then((r) => setResearch(r.data.data ?? []));
  }, []);

  const currentResearch = research.filter((p) => p.researchType === 'current');
  const completedResearch = research.filter((p) => p.researchType === 'completed');

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Top Bar ─────────────────────────────────────────────────── */}
      <header className="border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur z-10">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <NbslLogo size={30} color="#1d4ed8" />
            <div>
              <span className="text-lg font-bold text-primary-900 leading-none block">NBSL</span>
              <span className="text-[10px] text-gray-400 leading-none hidden sm:block">Nondestructive Biosensing Laboratory</span>
            </div>
          </div>
          <Link to="/login" className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors shadow-sm">
            Login
          </Link>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-950 via-primary-800 to-primary-600 text-white py-24 px-6">
        {/* Background decorative logo */}
        <div className="absolute right-8 top-1/2 -translate-y-1/2 opacity-5 pointer-events-none hidden lg:block">
          <NbslLogo size={380} color="white" />
        </div>

        <div className="max-w-4xl mx-auto relative">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-sm text-primary-100 mb-6 backdrop-blur-sm">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            Chungnam National University · Non-destructive Biosensing Research
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-5 leading-tight">
            Nondestructive<br />Biosensing Laboratory
          </h1>
          <p className="text-lg text-primary-100 max-w-2xl mb-8 leading-relaxed">
            Developing advanced optical sensing technologies for non-destructive measurement of quality
            and safety of food and agricultural materials — enabling precision agriculture and fast food safety diagnostics.
          </p>
          <div className="flex flex-wrap gap-4">
            <a href="https://www.bkcho.net/" target="_blank" rel="noopener noreferrer"
              className="bg-white text-primary-700 px-6 py-3 rounded-lg font-semibold hover:bg-primary-50 transition-colors shadow-md">
              Professor's Page
            </a>
            <Link to="/login"
              className="border-2 border-white/60 text-white px-6 py-3 rounded-lg font-semibold hover:bg-white/10 transition-colors backdrop-blur-sm">
              Access Lab System →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Announcements ──────────────────────────────────────────── */}
      <AnnouncementSection announcements={announcements} onOpen={setSelectedAnn} />

      {/* ── Current Research ───────────────────────────────────────── */}
      {currentResearch.length > 0 && (
        <section className="py-16 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Current Research</h2>
                <p className="text-sm text-gray-500 mt-1">Ongoing projects — click to learn more</p>
              </div>
              <span className="text-sm text-gray-400 bg-gray-100 rounded-full px-3 py-1">{currentResearch.length} active</span>
            </div>
            <ProjectCarousel projects={currentResearch} onSelect={setSelectedProject} />
          </div>
        </section>
      )}

      {/* ── Completed Research ─────────────────────────────────────── */}
      {completedResearch.length > 0 && (
        <section className="py-16 px-6 bg-gray-50">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Completed Research</h2>
                <p className="text-sm text-gray-500 mt-1">Click to view publication or project details</p>
              </div>
              <span className="text-sm text-gray-400 bg-gray-100 rounded-full px-3 py-1">{completedResearch.length} completed</span>
            </div>
            <ProjectCarousel projects={completedResearch} onSelect={setSelectedProject} />
          </div>
        </section>
      )}

      {/* ── Footer CTA ─────────────────────────────────────────────── */}
      <section className="py-20 px-6 text-center bg-primary-950 text-white relative overflow-hidden">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-5 pointer-events-none">
          <NbslLogo size={300} color="white" />
        </div>
        <div className="relative">
          <h2 className="text-3xl font-bold mb-4">Access the Lab Management System</h2>
          <p className="text-primary-300 mb-8 max-w-md mx-auto">Equipment booking, procurement, fault reporting, and more — all in one place.</p>
          <Link to="/login" className="inline-block bg-white text-primary-800 px-8 py-3.5 rounded-lg font-semibold hover:bg-primary-50 transition-colors shadow-lg">
            Sign In to Lab System
          </Link>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="bg-gray-950 text-gray-400 py-10 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <NbslLogo size={24} color="#6b7280" />
            <div>
              <p className="text-white font-semibold text-sm">NBSL</p>
              <p className="text-xs text-gray-500">Nondestructive Biosensing Lab · Chungnam National University</p>
            </div>
          </div>
          <p className="text-xs text-gray-600">© {new Date().getFullYear()} NBSL. All rights reserved.</p>
        </div>
      </footer>

      {/* ── Announcement Modal ──────────────────────────────────────── */}
      {selectedAnn && (
        <Modal title={selectedAnn.title} onClose={() => setSelectedAnn(null)} size="lg">
          <p className="text-gray-700 whitespace-pre-wrap mb-4 leading-relaxed">{selectedAnn.content}</p>
          {selectedAnn.files.length > 0 && (
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Attachments</h4>
              <ul className="space-y-1">
                {selectedAnn.files.map((f) => (
                  <li key={f.id}>
                    <a href={f.fileUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary-600 hover:underline flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                      {f.filename}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Modal>
      )}

      {/* ── Project detail Modal ────────────────────────────────────── */}
      {selectedProject && (
        <Modal title={selectedProject.title} onClose={() => setSelectedProject(null)} size="lg">
          <div className="space-y-4">
            {selectedProject.imageUrl && (
              <img src={selectedProject.imageUrl} alt={selectedProject.title} className="w-full h-52 object-cover rounded-xl" />
            )}
            <div className="flex flex-wrap gap-2">
              {selectedProject.leadResearcher && (
                <span className="text-xs bg-primary-50 text-primary-700 rounded-full px-3 py-1 font-medium">
                  {selectedProject.leadResearcher}
                </span>
              )}
              {selectedProject.year && (
                <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-3 py-1">{selectedProject.year}</span>
              )}
            </div>
            {selectedProject.summary && (
              <p className="text-sm text-gray-600 leading-relaxed font-medium">{selectedProject.summary}</p>
            )}
            {selectedProject.description && (
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{selectedProject.description}</p>
            )}
            {selectedProject.externalLink && (
              <a href={selectedProject.externalLink} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary-600 font-medium hover:underline">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                View Publication
              </a>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
