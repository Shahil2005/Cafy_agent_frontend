import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Calendar,
  CalendarDays,
  Clock,
  Loader2,
  Video,
  X,
} from 'lucide-react';
import {
  fetchMyCounsellingBookings,
  formatSlotLabel,
  getUserTimeZone,
  type CounsellingBooking,
} from '../../services/counsellingService';
import { getBackendUrl } from '../../services/apiConfig';
import { mentorPhotoUrl } from '../../utils/mentorPhoto';
import { toLocalDateKey } from './bookingCalendarUtils';

type Tab = 'today' | 'upcoming' | 'expired';

type Props = {
  open: boolean;
  onClose: () => void;
  refreshKey?: number;
};

function isPastSession(booking: CounsellingBooking): boolean {
  if (booking.status === 'expired') return true;
  if (!booking.slotStartsAt) return false;
  return new Date(booking.slotStartsAt).getTime() < Date.now();
}

function displayStatus(booking: CounsellingBooking): string {
  switch (booking.status) {
    case 'cancelled':
      return 'Cancelled';
    case 'failed':
      return 'Failed';
    case 'reserved':
      return 'Held';
    default:
      if (isPastSession(booking)) return 'Expired';
      if (booking.status === 'confirmed') return 'Confirmed';
      return booking.status.charAt(0).toUpperCase() + booking.status.slice(1);
  }
}

function statusClass(booking: CounsellingBooking): string {
  const label = displayStatus(booking);
  switch (label) {
    case 'Confirmed':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Held':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'Failed':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'Cancelled':
      return 'bg-slate-100 text-slate-600 border-slate-200';
    case 'Expired':
      return 'bg-slate-100 text-slate-500 border-slate-200';
    default:
      return 'bg-slate-50 text-slate-600 border-slate-200';
  }
}

function canJoinSession(booking: CounsellingBooking): boolean {
  return booking.status === 'confirmed' && !isPastSession(booking) && !!booking.meetingUrl;
}

function isTodaySession(booking: CounsellingBooking, timeZone: string, todayKey: string): boolean {
  if (!booking.slotStartsAt) return false;
  return toLocalDateKey(booking.slotStartsAt, timeZone) === todayKey;
}

function mentorInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('');
}

export const MyCounsellingSessions: React.FC<Props> = ({ open, onClose, refreshKey = 0 }) => {
  const [bookings, setBookings] = useState<CounsellingBooking[]>([]);
  const [mentorPhotos, setMentorPhotos] = useState<Map<number, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('today');
  const timeZone = getUserTimeZone();
  const todayKey = useMemo(
    () => toLocalDateKey(new Date().toISOString(), timeZone),
    [timeZone]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, mentorsRes] = await Promise.all([
        fetchMyCounsellingBookings(),
        fetch(`${getBackendUrl()}/api/mentors`).then((r) => r.json()),
      ]);
      setBookings(data);
      if (mentorsRes.success && Array.isArray(mentorsRes.data)) {
        const photos = new Map<number, string>();
        for (const mentor of mentorsRes.data as { id?: number; photoUrl?: string }[]) {
          if (typeof mentor.id === 'number' && mentor.photoUrl) {
            photos.set(mentor.id, mentor.photoUrl);
          }
        }
        setMentorPhotos(photos);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not load your sessions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [load, refreshKey, open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const { today, upcoming, expired } = useMemo(() => {
    const tod: CounsellingBooking[] = [];
    const up: CounsellingBooking[] = [];
    const old: CounsellingBooking[] = [];

    for (const b of bookings) {
      if (b.status === 'confirmed' && !isPastSession(b)) {
        if (isTodaySession(b, timeZone, todayKey)) {
          tod.push(b);
        } else {
          up.push(b);
        }
        continue;
      }
      if (
        b.status === 'confirmed' ||
        b.status === 'cancelled' ||
        b.status === 'failed' ||
        b.status === 'expired'
      ) {
        old.push(b);
      }
    }

    const byStart = (a: CounsellingBooking, b: CounsellingBooking) =>
      new Date(a.slotStartsAt ?? 0).getTime() - new Date(b.slotStartsAt ?? 0).getTime();

    tod.sort(byStart);
    up.sort(byStart);
    old.sort((a, b) => new Date(b.slotStartsAt ?? 0).getTime() - new Date(a.slotStartsAt ?? 0).getTime());

    return { today: tod, upcoming: up, expired: old };
  }, [bookings, timeZone, todayKey]);

  useEffect(() => {
    if (!open) return;
    setActiveTab('today');
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-[3px] p-0 sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="relative w-full sm:max-w-xl bg-white sm:rounded-2xl rounded-t-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="my-sessions-title"
          >
            <div className="relative bg-gradient-to-br from-blue-600 to-indigo-700 px-5 py-5 shrink-0">
              <div
                className="absolute inset-0 opacity-15 pointer-events-none"
                style={{ backgroundImage: 'radial-gradient(circle at 85% 30%, white 0%, transparent 55%)' }}
              />
              <div className="relative flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-white/15 border border-white/20 shrink-0">
                  <CalendarDays className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <h2 id="my-sessions-title" className="text-lg font-bold text-white leading-tight">
                    My sessions
                  </h2>
                  <p className="text-blue-100 text-xs mt-1">
                    Upcoming bookings and your session history
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 rounded-xl hover:bg-white/15 transition-colors text-white shrink-0"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {!loading && !error && (
              <div className="shrink-0 px-5 pt-4 pb-1">
                <div
                  className="flex p-1 bg-slate-100 rounded-xl gap-0.5"
                  role="tablist"
                  aria-label="Session filters"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'today'}
                    onClick={() => setActiveTab('today')}
                    className={`flex-1 py-2.5 px-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                      activeTab === 'today'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Today
                    {today.length > 0 && (
                      <span
                        className={`ml-1 text-xs font-bold ${
                          activeTab === 'today' ? 'text-blue-600' : 'text-slate-400'
                        }`}
                      >
                        {today.length}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'upcoming'}
                    onClick={() => setActiveTab('upcoming')}
                    className={`flex-1 py-2.5 px-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                      activeTab === 'upcoming'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Upcoming
                    {upcoming.length > 0 && (
                      <span
                        className={`ml-1 text-xs font-bold ${
                          activeTab === 'upcoming' ? 'text-indigo-600' : 'text-slate-400'
                        }`}
                      >
                        {upcoming.length}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'expired'}
                    onClick={() => setActiveTab('expired')}
                    className={`flex-1 py-2.5 px-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                      activeTab === 'expired'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Expired
                    {expired.length > 0 && (
                      <span
                        className={`ml-1 text-xs font-bold ${
                          activeTab === 'expired' ? 'text-slate-600' : 'text-slate-400'
                        }`}
                      >
                        {expired.length}
                      </span>
                    )}
                  </button>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-5">
              {loading ? (
                <div className="flex flex-col items-center justify-center gap-3 py-12 text-slate-500">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                  <p className="text-sm">Loading your sessions…</p>
                </div>
              ) : error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              ) : !today.length && !upcoming.length && !expired.length ? (
                <div className="flex flex-col items-center text-center py-10 px-4">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                    <Calendar className="w-7 h-7 text-slate-400" />
                  </div>
                  <p className="font-semibold text-slate-900 text-sm">No sessions yet</p>
                  <p className="text-slate-500 text-xs mt-1.5 max-w-xs leading-relaxed">
                    Book a counsellor to schedule your first career session. Your bookings will appear here.
                  </p>
                </div>
              ) : activeTab === 'today' ? (
                today.length > 0 ? (
                  <div className="space-y-2.5" role="tabpanel">
                    {today.map((b) => (
                      <SessionCard
                        key={b.id}
                        booking={b}
                        today
                        photoUrl={mentorPhotos.get(b.mentorId)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-center py-10 px-4" role="tabpanel">
                    <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
                      <Calendar className="w-7 h-7 text-blue-500" />
                    </div>
                    <p className="font-semibold text-slate-900 text-sm">Nothing scheduled for today</p>
                    <p className="text-slate-500 text-xs mt-1.5 max-w-xs leading-relaxed">
                      Sessions booked for today will show up here with a join link when it&apos;s time.
                    </p>
                  </div>
                )
              ) : activeTab === 'upcoming' ? (
                upcoming.length > 0 ? (
                  <div className="space-y-2.5" role="tabpanel">
                    {upcoming.map((b) => (
                      <SessionCard key={b.id} booking={b} photoUrl={mentorPhotos.get(b.mentorId)} />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-center py-10 px-4" role="tabpanel">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
                      <CalendarDays className="w-7 h-7 text-indigo-400" />
                    </div>
                    <p className="font-semibold text-slate-900 text-sm">No upcoming sessions</p>
                    <p className="text-slate-500 text-xs mt-1.5 max-w-xs leading-relaxed">
                      Book a counsellor above to schedule your next session.
                    </p>
                  </div>
                )
              ) : expired.length > 0 ? (
                <div className="space-y-2.5" role="tabpanel">
                  {expired.map((b) => (
                    <SessionCard
                      key={b.id}
                      booking={b}
                      expired
                      photoUrl={mentorPhotos.get(b.mentorId)}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center text-center py-10 px-4" role="tabpanel">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                    <Clock className="w-7 h-7 text-slate-400" />
                  </div>
                  <p className="font-semibold text-slate-900 text-sm">No expired sessions</p>
                  <p className="text-slate-500 text-xs mt-1.5 max-w-xs leading-relaxed">
                    Completed and past sessions will appear here.
                  </p>
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-slate-100 px-5 py-4 bg-slate-50/80">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-colors"
              >
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const MentorAvatar: React.FC<{ name: string; photoUrl?: string; muted?: boolean }> = ({
  name,
  photoUrl,
  muted,
}) => {
  const [failed, setFailed] = useState(false);
  const [useOriginal, setUseOriginal] = useState(false);
  const initials = mentorInitials(name);
  const optimized = photoUrl ? mentorPhotoUrl(photoUrl, 96) : '';
  const src = useOriginal ? photoUrl : optimized;

  if (!photoUrl?.trim() || failed) {
    return (
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm ${
          muted ? 'bg-slate-200 text-slate-500' : 'bg-blue-600 text-white'
        }`}
        aria-hidden
      >
        {initials || '?'}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt=""
      className={`w-12 h-12 rounded-xl object-cover object-top shrink-0 ring-2 ${
        muted ? 'ring-slate-100 grayscale opacity-75' : 'ring-white shadow-sm'
      }`}
      onError={() => {
        if (!useOriginal && optimized !== photoUrl) {
          setUseOriginal(true);
          return;
        }
        setFailed(true);
      }}
    />
  );
};

const SessionCard: React.FC<{
  booking: CounsellingBooking;
  expired?: boolean;
  today?: boolean;
  photoUrl?: string;
}> = ({ booking, expired, today, photoUrl }) => {
  const name = booking.mentorName ?? 'Career session';
  const when =
    booking.slotStartsAt != null
      ? formatSlotLabel(booking.slotStartsAt)
      : booking.bookedDay && booking.bookedTime
        ? `${booking.bookedDay} ${booking.bookedTime}`
        : 'Time TBC';

  const status = displayStatus(booking);
  const showJoin = canJoinSession(booking);

  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        expired
          ? 'border-slate-100 bg-slate-50/60 opacity-90'
          : today
            ? 'border-blue-200 bg-blue-50/40 shadow-sm'
            : 'border-slate-200 bg-white shadow-sm'
      }`}
    >
      <div className="flex items-start gap-3">
        <MentorAvatar name={name} photoUrl={photoUrl} muted={expired} />
        <div className="min-w-0 flex-1">
          <p className={`font-semibold text-sm truncate ${expired ? 'text-slate-600' : 'text-slate-900'}`}>
            {name}
          </p>
          <div className="flex items-center gap-1.5 mt-1.5 text-xs text-slate-500">
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span>{when}</span>
          </div>
          {booking.durationMinutes != null && (
            <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-400">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>{booking.durationMinutes} minutes</span>
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span
            className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full border ${statusClass(booking)}`}
          >
            {status}
          </span>
          {showJoin && (
            <a
              href={booking.meetingUrl!}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Join session"
              title="Join session"
              className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Video className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
