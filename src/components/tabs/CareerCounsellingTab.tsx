import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  X,
  ExternalLink,
  Calendar,
  CalendarDays,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { getBackendUrl } from "../../services/apiConfig";
import {
  fetchCounsellingPublicStatus,
  confirmCounsellingPayment,
  prefetchCounsellingAvailability,
  prefetchCounsellingConfig,
  type CounsellingPublicStatus,
} from "../../services/counsellingService";
import { mentorPhotoUrl, preloadMentorPhotos } from "../../utils/mentorPhoto";
import { BookingModal } from "../counselling/BookingModal";
import { MyCounsellingSessions } from "../counselling/MyCounsellingSessions";
import { PaymentConfirmingOverlay } from "../counselling/PaymentConfirmingOverlay";

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

interface Mentor {
  id: number;
  slug: string;
  name: string;
  quals: string;
  title: string;
  org: string;
  domain: string;
  exp: string;
  linkedin: string;
  photoUrl: string;
  bookingAvailable?: boolean;
  availableDurations?: Array<30 | 45 | 60>;
}

function mentorInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("");
}

function warmMentorBooking(mentor: Mentor): void {
  if (!mentor.bookingAvailable) return;
  const mins = mentor.availableDurations?.[0] ?? 45;
  prefetchCounsellingAvailability(mentor.id, mins);
}

/** Matches Home welcome hero — gradient wash + `/home/hero-image.jpg` */
const HOME_HERO_BACKGROUND: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(135deg, rgba(255, 255, 255, 0.65) 0%, rgba(245, 247, 255, 0.75) 45%, rgba(238, 243, 255, 0.85) 100%), url('/home/hero-image.jpg')",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right center",
  backgroundSize: "cover",
};

const HOME_HERO_BACKGROUND_SOFT: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(135deg, rgba(255, 255, 255, 0.82) 0%, rgba(248, 250, 255, 0.88) 50%, rgba(255, 255, 255, 0.92) 100%), url('/home/hero-image.jpg')",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "left center",
  backgroundSize: "cover",
};

function HeroBackgroundDecor() {
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden>
      <div className="absolute -top-10 -right-12 w-64 h-64 rounded-full bg-blue-100/60 blur-3xl" />
      <div className="absolute bottom-0 left-0 w-72 h-48 bg-slate-100/80 blur-2xl" />
      <div className="absolute top-10 right-24 w-6 h-6 rounded-full bg-blue-200/70" />
    </div>
  );
}

const MentorPhoto: React.FC<{
  mentor: Mentor;
  className?: string;
  textClassName?: string;
  /** Display width in CSS px — requests a 2× optimized image from Supabase when available. */
  displayWidth?: number;
  priority?: boolean;
}> = ({
  mentor,
  className = "",
  textClassName = "text-lg",
  displayWidth = 260,
  priority = false,
}) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [useOriginal, setUseOriginal] = useState(false);
  const initials = mentorInitials(mentor.name);

  const optimizedSrc = mentorPhotoUrl(mentor.photoUrl, displayWidth * 2);
  const src = useOriginal ? mentor.photoUrl : optimizedSrc;

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
    setUseOriginal(false);
  }, [mentor.photoUrl, optimizedSrc]);

  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth > 0) {
      setLoaded(true);
    }
  }, [src]);

  if (!mentor.photoUrl || failed) {
    return (
      <div className={`flex items-center justify-center bg-blue-600 text-white font-bold ${className}`}>
        <span className={textClassName}>{initials}</span>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div
        className={`absolute inset-0 flex items-center justify-center bg-blue-600 text-white font-bold transition-opacity duration-200 ${
          loaded ? "opacity-0" : "opacity-100"
        }`}
        aria-hidden={loaded}
      >
        <span className={textClassName}>{initials}</span>
      </div>
      <img
        ref={imgRef}
        key={src}
        src={src}
        alt={mentor.name}
        className={`h-full w-full object-cover object-top transition-opacity duration-300 ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
        width={displayWidth}
        height={Math.round(displayWidth * 1.4)}
        draggable={false}
        loading="eager"
        decoding="async"
        // React 18 only forwards the lowercase DOM attribute; its types only declare camelCase.
        {...({ fetchpriority: priority ? "high" : "auto" } as Record<string, string>)}
        onLoad={() => setLoaded(true)}
        onError={() => {
          if (!useOriginal && optimizedSrc !== mentor.photoUrl) {
            setUseOriginal(true);
            setLoaded(false);
            return;
          }
          setFailed(true);
        }}
      />
    </div>
  );
};

// ─────────────────────────────────────────────────────────
// Stay tuned modal (booking coming soon)
// ─────────────────────────────────────────────────────────

const StayTunedModal: React.FC<{ mentor: Mentor; onClose: () => void }> = ({ mentor, onClose }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-[2px] p-0 sm:p-4"
    onClick={onClose}
  >
    <motion.div
      initial={{ y: "100%", opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: "100%", opacity: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 32 }}
      className="relative w-full sm:max-w-md bg-white sm:rounded-2xl rounded-t-3xl shadow-2xl overflow-hidden"
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="stay-tuned-title"
    >
      <div className="relative bg-blue-600 p-5 flex items-center gap-4 overflow-hidden">
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ backgroundImage: "radial-gradient(circle at 80% 50%, white 0%, transparent 60%)" }}
        />
        <div className="w-14 h-14 rounded-2xl bg-white/20 border border-white/30 overflow-hidden shrink-0">
          <MentorPhoto mentor={mentor} className="w-full h-full" displayWidth={56} priority />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-white font-bold text-base leading-tight">{mentor.name}</p>
          {mentor.quals && <p className="text-blue-200 text-[11px] font-semibold">{mentor.quals}</p>}
          <p className="text-white/75 text-xs mt-0.5 truncate">{mentor.title}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-xl hover:bg-white/20 transition-colors text-white shrink-0"
          aria-label="Close"
        >
          <X size={18} />
        </button>
      </div>

      <div className="p-8 flex flex-col items-center text-center gap-4">
        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center">
          <Sparkles className="w-8 h-8 text-blue-600" />
        </div>
        <h3 id="stay-tuned-title" className="text-xl font-bold text-slate-900">
          Stay tuned for this feature
        </h3>
        <p className="text-slate-500 text-sm leading-relaxed max-w-xs">
          Mentor booking with <strong className="text-slate-800">{mentor.name}</strong> is coming soon.
          We&apos;re putting the finishing touches on career counselling sessions.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3.5 rounded-2xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors mt-2"
        >
          Got it
        </button>
      </div>
    </motion.div>
  </motion.div>
);

// ─────────────────────────────────────────────────────────
// Spotlight Card (big, photo-forward, hover reveal)
// ─────────────────────────────────────────────────────────

const SpotlightCard: React.FC<{ mentor: Mentor; onBook: (m: Mentor) => void; index: number }> = ({ mentor, onBook, index }) => {
  const initials = mentorInitials(mentor.name);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 3) * 0.03, duration: 0.35 }}
      className="group relative shrink-0 rounded-3xl overflow-hidden cursor-pointer select-none"
      style={{ width: "260px", height: "360px" }}
      onClick={() => onBook(mentor)}
      onMouseEnter={() => warmMentorBooking(mentor)}
      onFocus={() => warmMentorBooking(mentor)}
      whileHover={{ scale: 1.03, transition: { duration: 0.2 } }}
    >
      {/* Photo */}
      {mentor.photoUrl ? (
        <MentorPhoto
          mentor={mentor}
          className="absolute inset-0 w-full h-full transition-transform duration-500 group-hover:scale-105"
          displayWidth={260}
          priority={index < 4}
        />
      ) : (
        <div className="absolute inset-0 bg-blue-600 flex items-center justify-center">
          <span className="text-white/20 font-black select-none" style={{ fontSize: "96px" }}>{initials}</span>
        </div>
      )}

      {/* Base gradient overlay */}
      <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.35) 50%, rgba(0,0,0,0.05) 100%)" }} />

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-slate-900/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      {/* Exp badge */}
      {mentor.exp && (
        <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-full border border-white/20">
          {mentor.exp}
        </div>
      )}

      {/* Quals badge */}
      {mentor.quals && (
        <div className="absolute top-4 left-4 bg-blue-600/90 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
          {mentor.quals}
        </div>
      )}

      {/* Bottom info */}
      <div className="absolute bottom-0 inset-x-0 p-5">
        <p className="text-white font-bold text-base leading-tight">{mentor.name}</p>
        <p className="text-white/70 text-xs mt-1 leading-snug line-clamp-2">{mentor.title}</p>
        {mentor.org && <p className="text-blue-300 text-[11px] mt-0.5 truncate">{mentor.org}</p>}

        {/* CTA — slides up on hover */}
        <div className="mt-3 overflow-hidden">
          <div className="translate-y-10 group-hover:translate-y-0 transition-transform duration-300 ease-out flex gap-2">
            <button
              onMouseEnter={() => warmMentorBooking(mentor)}
              onClick={e => { e.stopPropagation(); onBook(mentor); }}
              className="flex-1 flex items-center justify-center gap-1.5 bg-white text-blue-700 font-bold text-xs py-2.5 rounded-xl hover:bg-blue-50 transition-colors shadow-lg"
            >
              <Calendar size={12} />
              Book a call
            </button>
            {mentor.linkedin && (
              <a
                href={mentor.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="flex items-center justify-center w-9 bg-white/20 border border-white/30 text-white rounded-xl hover:bg-white/30 transition-colors"
              >
                <ExternalLink size={13} />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Bottom glow on hover */}
      <div className="absolute inset-x-0 bottom-0 h-1 bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────
// Floating Scene (replaces the mentor grid)
// ─────────────────────────────────────────────────────────

const ORBS = [
  { size: 130, style: { top: "4%",    left: "40%"  }, delay: 0,   opacity: "bg-slate-200/40" },
  { size: 72,  style: { top: "12%",   right: "20%" }, delay: 0.7, opacity: "bg-indigo-100/50" },
  { size: 44,  style: { top: "36%",   right: "36%" }, delay: 1.2, opacity: "bg-slate-200/35" },
  { size: 58,  style: { bottom: "20%",left: "34%"  }, delay: 0.4, opacity: "bg-indigo-50/60" },
  { size: 96,  style: { bottom: "6%", left: "41%"  }, delay: 1.0, opacity: "bg-slate-200/40" },
  { size: 28,  style: { top: "54%",   left: "24%"  }, delay: 1.5, opacity: "bg-indigo-100/45" },
  { size: 78,  style: { bottom: "16%",right: "18%" }, delay: 0.3, opacity: "bg-slate-200/35" },
  { size: 22,  style: { top: "24%",   left: "30%"  }, delay: 1.9, opacity: "bg-indigo-50/50" },
];

const MENTOR_SLOTS = [
  { style: { top: "6%",    left: "3%"   }, floatY: [0, -10, 0], dur: 4.2 },
  { style: { bottom: "8%", left: "2%"   }, floatY: [0, -8,  0], dur: 3.8 },
  { style: { top: "4%",    right: "3%"  }, floatY: [0, -12, 0], dur: 4.6 },
  { style: { bottom: "6%", right: "2%"  }, floatY: [0, -9,  0], dur: 4.0 },
  { style: { top: "44%",   right: "4%"  }, floatY: [0, -7,  0], dur: 3.5 },
];

const FloatingScene: React.FC<{ mentors: Mentor[]; onBook: (m: Mentor) => void }> = ({ mentors, onBook }) => {
  const featured = mentors.slice(0, 5);

  return (
    <div
      className="relative overflow-hidden rounded-[28px] border border-[#E7ECFF] shadow-sm"
      style={{ ...HOME_HERO_BACKGROUND, minHeight: "520px" }}
    >
      <HeroBackgroundDecor />

      {/* Decorative orbs */}
      {ORBS.map((orb, i) => (
        <motion.div
          key={i}
          className={`absolute rounded-full ${orb.opacity} pointer-events-none`}
          style={{ width: orb.size, height: orb.size, ...orb.style }}
          animate={{ y: [0, -14, 0] }}
          transition={{ duration: 3.5 + i * 0.3, repeat: Infinity, ease: "easeInOut", delay: orb.delay }}
        />
      ))}

      {/* Floating mentor avatars */}
      {featured.map((mentor, i) => {
        const slot = MENTOR_SLOTS[i];
        const tag = mentor.domain.split(/[|·]/)[0].trim().slice(0, 22);
        return (
          <motion.div
            key={mentor.id}
            className="absolute hidden sm:flex flex-col items-center gap-2 cursor-pointer group z-10"
            style={slot.style as React.CSSProperties}
            animate={{ y: slot.floatY }}
            transition={{ duration: slot.dur, repeat: Infinity, ease: "easeInOut", delay: i * 0.5 }}
            onClick={() => onBook(mentor)}
          >
            {/* Avatar */}
            <div className="w-20 h-20 rounded-full overflow-hidden bg-blue-600 ring-4 ring-white shadow-xl group-hover:ring-blue-200 transition-all duration-300 group-hover:scale-105">
              <MentorPhoto mentor={mentor} className="w-full h-full" displayWidth={80} />
            </div>
            {/* Tag chip */}
            <div className="bg-white shadow-md border border-slate-100 rounded-full px-3 py-1 text-[10px] font-bold text-slate-700 whitespace-nowrap opacity-0 group-hover:opacity-100 -translate-y-1 group-hover:translate-y-0 transition-all duration-200">
              {tag}
            </div>
          </motion.div>
        );
      })}

      {/* Centre copy */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center px-6 py-16 sm:py-20 min-h-[520px]">
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-[11px] font-black text-indigo-600 uppercase tracking-widest mb-4"
        >
          Why Cafy Counselling
        </motion.p>
        <motion.h2
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 leading-tight max-w-lg"
        >
          With Cafy, you talk to someone who&apos;s actually{" "}
          <span className="relative inline-block">
            <span className="relative z-10">done it before.</span>
            <span className="absolute inset-x-0 bottom-1 h-2.5 bg-indigo-100 rounded -z-10" />
          </span>
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-4 text-slate-500 text-base max-w-sm leading-relaxed"
        >
          Someone just a few steps ahead, not ten.
        </motion.p>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────
// How it works
// ─────────────────────────────────────────────────────────

const HOW_STEPS = [
  { num: "01", title: "Find your expert", desc: "Browse mentors by specialty. CV reviews, interview prep, visa advice, leadership coaching and more." },
  { num: "02", title: "Book a slot",      desc: "Pick a time that works for you. Most mentors have availability within the same week." },
  { num: "03", title: "Join the call",    desc: "Get focused, honest advice from someone who's been exactly where you are. Walk away with a plan." },
];

// ─────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────

const CareerCounsellingTab: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [publicStatus, setPublicStatus] = useState<CounsellingPublicStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [bookingNotice, setBookingNotice] = useState<string | null>(null);
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [loadingMentors, setLoadingMentors] = useState(true);
  const [mentorsError, setMentorsError] = useState<string | null>(null);
  const [selectedMentor, setSelectedMentor] = useState<Mentor | null>(null);
  const [sessionsRefreshKey, setSessionsRefreshKey] = useState(0);
  const [sessionsModalOpen, setSessionsModalOpen] = useState(false);
  const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // drag-to-scroll state
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragScrollLeft = useRef(0);

  useEffect(() => {
    let cancelled = false;
    fetchCounsellingPublicStatus()
      .then((status) => {
        if (!cancelled) setPublicStatus(status);
      })
      .finally(() => {
        if (!cancelled) setStatusLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const booking = searchParams.get("booking");
    const sessionId = searchParams.get("session_id");

    const next = new URLSearchParams(searchParams);
    next.delete("booking");
    next.delete("session_id");
    setSearchParams(next, { replace: true });

    if (!booking) return;

    if (booking === "canceled") {
      setBookingNotice("Checkout was canceled. Your slot hold may have expired. Pick a time again if needed.");
      return;
    }

    if (booking !== "success") return;

    if (!sessionId) {
      setBookingNotice("Payment received. Refresh the page if your session does not appear shortly.");
      setSessionsRefreshKey((k) => k + 1);
      return;
    }

    let cancelled = false;
    setIsConfirmingPayment(true);
    setBookingNotice(null);

    confirmCounsellingPayment(sessionId)
      .then((result) => {
        if (cancelled) return;
        setSessionsRefreshKey((k) => k + 1);
        setSessionsModalOpen(true);
        if (result.alreadyConfirmed) {
          setBookingNotice("Your session is confirmed. See details in My sessions.");
        } else {
          setBookingNotice("Session booked successfully. See your upcoming session in My sessions.");
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Could not confirm your session.";
        setBookingNotice(
          `${message} If payment went through, your session should appear shortly. Try refreshing.`
        );
        setSessionsRefreshKey((k) => k + 1);
        setSessionsModalOpen(true);
      })
      .finally(() => {
        if (!cancelled) setIsConfirmingPayment(false);
      });

    return () => {
      cancelled = true;
    };
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!publicStatus?.enabled) return;
    prefetchCounsellingConfig();
  }, [publicStatus?.enabled]);

  useEffect(() => {
    if (!publicStatus?.enabled) {
      setLoadingMentors(false);
      return;
    }

    let cancelled = false;

    fetch(`${getBackendUrl()}/api/mentors`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (json.success && Array.isArray(json.data)) {
          setMentors(json.data);
          preloadMentorPhotos(json.data, 8, 520);
          setMentorsError(json.data.length ? null : "No mentors are available right now.");
        } else {
          setMentorsError("Couldn't load mentors. Please try again later.");
        }
      })
      .catch(() => {
        if (!cancelled) setMentorsError("Couldn't load mentors. Please try again later.");
      })
      .finally(() => {
        if (!cancelled) setLoadingMentors(false);
      });

    return () => {
      cancelled = true;
    };
  }, [publicStatus?.enabled]);

  const counsellingEnabled = publicStatus?.enabled === true;

  const scrollBy = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({ left: dir === "right" ? 300 : -300, behavior: "smooth" });
  };

  const onMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    dragStartX.current = e.pageX - (scrollRef.current?.offsetLeft ?? 0);
    dragScrollLeft.current = scrollRef.current?.scrollLeft ?? 0;
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    scrollRef.current.scrollLeft = dragScrollLeft.current - (x - dragStartX.current) * 1.4;
  };
  const stopDrag = () => { isDragging.current = false; };

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden custom-scrollbar bg-slate-50">
      <div className="w-full flex flex-col gap-6 sm:gap-8 font-inter p-2 sm:p-4 pb-10">

      {statusLoading ? (
        <div
          data-tour="career-counselling-hero"
          data-tour-loading=""
          className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center text-slate-500 text-sm"
        >
          Loading career counselling…
        </div>
      ) : !counsellingEnabled ? (
        <section
          data-tour="career-counselling-hero"
          className="relative overflow-hidden rounded-[28px] border border-[#E7ECFF] shadow-sm"
          style={HOME_HERO_BACKGROUND}
        >
          <HeroBackgroundDecor />
          <div className="relative z-10 px-6 sm:px-10 py-14 text-center max-w-xl mx-auto">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-5">
              <Sparkles className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-3xl font-black text-slate-900">Career counselling is coming soon</h1>
            <p className="mt-4 text-slate-600 text-sm leading-relaxed">
              We&apos;re putting the finishing touches on 1:1 sessions with mentors who&apos;ve navigated the UK job market.
              Check back shortly.
            </p>
          </div>
        </section>
      ) : (
        <>
      {bookingNotice && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm flex items-start gap-3 ${
            bookingNotice.includes("canceled") || bookingNotice.includes("Could not")
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : "border-green-200 bg-green-50 text-green-900"
          }`}
        >
          {bookingNotice.includes("Could not") ? (
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          )}
          <p>{bookingNotice}</p>
        </div>
      )}

      {/* ── Hero ──────────────────────────────────────────── */}
      <section
        data-tour="career-counselling-hero"
        className="relative overflow-hidden rounded-[28px] border border-[#E7ECFF] shadow-sm"
        style={HOME_HERO_BACKGROUND}
      >
        <HeroBackgroundDecor />
        <div className="relative z-10 px-6 sm:px-8 lg:px-10 py-8 sm:py-10">
        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 leading-tight tracking-tight max-w-2xl"
        >
          Experts who&apos;ve{" "}
          <span className="relative inline-block">
            <span className="relative z-10">done the work.</span>
            <span className="absolute inset-x-0 bottom-1 h-3 bg-indigo-100 rounded" />
          </span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="mt-4 text-slate-600 text-sm sm:text-base leading-relaxed max-w-xl"
        >
          They&apos;ve built careers, navigated visas, and pivoted industries.
          Now they&apos;re here to help you do the same, with clear, honest advice from lived experience.
        </motion.p>
        <motion.button
          type="button"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          onClick={() => setSessionsModalOpen(true)}
          className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 text-sm font-semibold shadow-sm hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 transition-all"
        >
          <CalendarDays className="w-4 h-4" />
          My sessions
        </motion.button>
        </div>
      </section>

      {/* ── Spotlight scroll ──────────────────────────────── */}
      <section
        className="relative overflow-hidden rounded-[28px] border border-[#E7ECFF] shadow-sm pt-6 sm:pt-8 pb-4"
        style={HOME_HERO_BACKGROUND_SOFT}
      >
        <HeroBackgroundDecor />
        <div className="relative z-10">
        {/* Header row */}
        <div className="px-4 sm:px-8 lg:px-12 flex items-end justify-between mb-5">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900">Our career counsellors</h2>
            <p className="text-slate-500 text-sm mt-0.5">
              Browse experienced professionals and select a counsellor to book a session.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => scrollBy("left")}
              className="p-2.5 rounded-full border-2 border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 transition-all shadow-sm"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => scrollBy("right")}
              className="p-2.5 rounded-full border-2 border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 transition-all shadow-sm"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {loadingMentors ? (
          <div className="flex gap-4 overflow-x-auto pb-4 pl-4 sm:pl-8 lg:pl-12 pr-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="shrink-0 rounded-3xl bg-slate-100 animate-pulse"
                style={{ width: "260px", height: "360px" }}
              />
            ))}
          </div>
        ) : mentorsError ? (
          <div className="mx-4 sm:mx-8 lg:mx-12 mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {mentorsError}
          </div>
        ) : (
          <div
            ref={scrollRef}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={stopDrag}
            onMouseLeave={stopDrag}
            className="flex gap-4 overflow-x-auto pb-4 pl-4 sm:pl-8 lg:pl-12 pr-4 scrollbar-hide scroll-smooth"
            style={{ cursor: isDragging.current ? "grabbing" : "grab" }}
          >
            {mentors.map((mentor, i) => (
              <SpotlightCard key={mentor.id} mentor={mentor} onBook={setSelectedMentor} index={i} />
            ))}
            <div className="shrink-0 w-4" />
          </div>
        )}
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm px-6 sm:px-10 py-7">
        <p className="text-[11px] font-black text-indigo-600 uppercase tracking-widest mb-6">How it works</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-10">
          {HOW_STEPS.map(step => (
            <div key={step.num} className="flex gap-5">
              <span className="text-4xl font-black text-slate-200 leading-none shrink-0 select-none">{step.num}</span>
              <div>
                <p className="font-bold text-slate-900 text-sm mb-1">{step.title}</p>
                <p className="text-slate-500 text-xs leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Floating Scene ────────────────────────────────── */}
      <FloatingScene mentors={mentors} onBook={setSelectedMentor} />

      <AnimatePresence>
        {isConfirmingPayment && <PaymentConfirmingOverlay key="payment-confirming" />}
        <MyCounsellingSessions
          open={sessionsModalOpen}
          onClose={() => setSessionsModalOpen(false)}
          refreshKey={sessionsRefreshKey}
        />
        {selectedMentor && selectedMentor.bookingAvailable && (
          <BookingModal
            mentor={selectedMentor}
            onClose={() => setSelectedMentor(null)}
            onBooked={() => setSessionsRefreshKey((k) => k + 1)}
            renderPhoto={(className) => (
              <MentorPhoto mentor={selectedMentor} className={className} displayWidth={56} priority />
            )}
          />
        )}
        {selectedMentor && !selectedMentor.bookingAvailable && (
          <StayTunedModal mentor={selectedMentor} onClose={() => setSelectedMentor(null)} />
        )}
      </AnimatePresence>
      </>
      )}
      </div>
    </div>
  );
};

export default CareerCounsellingTab;
