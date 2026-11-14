import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Clock, Loader2, RefreshCw, X } from "lucide-react";
import { BookingCalendarPicker } from "./BookingCalendarPicker";
import {
  addDays,
  groupSlotsByLocalDate,
  startOfDay,
  toLocalDateKey,
} from "./bookingCalendarUtils";
import {
  cancelCounsellingReservation,
  confirmCounsellingReservation,
  CounsellingRequestError,
  createCounsellingCheckout,
  fetchCounsellingAvailability,
  fetchCounsellingConfig,
  formatSlotLabel,
  getUserTimeZone,
  invalidateCounsellingAvailability,
  prefetchCounsellingAvailability,
  reserveCounsellingSlot,
  SLOT_HOLD_GENERAL_HINT,
  type CounsellingConfig,
  type CounsellingSlot,
  type DurationMinutes,
} from "../../services/counsellingService";
import { useBillingContext } from "../../context/BillingContext";

export type BookingModalMentor = {
  id: number;
  name: string;
  title: string;
  quals: string;
  photoUrl: string;
  bookingAvailable?: boolean;
  availableDurations?: DurationMinutes[];
};

type Step = "duration" | "slots" | "confirm" | "success";

type Props = {
  mentor: BookingModalMentor;
  onClose: () => void;
  onBooked?: () => void;
  renderPhoto: (className: string) => React.ReactNode;
};

const ALL_DURATIONS: DurationMinutes[] = [30, 45, 60];

const FALLBACK_PRICE_LABELS: Record<
  DurationMinutes,
  { standard: string; premium: string }
> = {
  30: { standard: "£30", premium: "£25" },
  45: { standard: "£35", premium: "£30" },
  60: { standard: "£40", premium: "£35" },
};

function priceLabelForDuration(
  config: CounsellingConfig | null,
  mins: DurationMinutes,
  isPremium: boolean,
): string {
  if (config) {
    const table = isPremium
      ? config.premiumPrices
      : (config.standardPrices ?? config.prices);
    return table[mins]?.label ?? FALLBACK_PRICE_LABELS[mins].standard;
  }
  return isPremium
    ? FALLBACK_PRICE_LABELS[mins].premium
    : FALLBACK_PRICE_LABELS[mins].standard;
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

type SlotErrorKind = "held" | "unavailable" | "error";

function slotErrorFromUnknown(err: unknown): {
  message: string;
  kind: SlotErrorKind;
} {
  if (err instanceof CounsellingRequestError) {
    if (err.code === "SLOT_HELD" || err.code === "SLOT_UNAVAILABLE") {
      return { message: err.message, kind: "held" };
    }
    return { message: err.message, kind: "error" };
  }
  const message =
    err instanceof Error
      ? err.message
      : "Something went wrong. Please try again.";
  if (/held/i.test(message)) return { message, kind: "held" };
  if (/no longer available|unavailable/i.test(message))
    return { message, kind: "held" };
  return { message, kind: "error" };
}

export const BookingModal: React.FC<Props> = ({
  mentor,
  onClose,
  onBooked,
  renderPhoto,
}) => {
  const { isPremium } = useBillingContext();
  const timeZone = getUserTimeZone();

  const [step, setStep] = useState<Step>("duration");
  const [config, setConfig] = useState<CounsellingConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [duration, setDuration] = useState<DurationMinutes | null>(null);
  const [slots, setSlots] = useState<CounsellingSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [slotsErrorKind, setSlotsErrorKind] = useState<SlotErrorKind | null>(
    null,
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<CounsellingSlot | null>(
    null,
  );
  const [reservationId, setReservationId] = useState<string | null>(null);
  const [reservationExpiresAt, setReservationExpiresAt] = useState<
    string | null
  >(null);
  const [reserving, setReserving] = useState(false);
  const [countdownMs, setCountdownMs] = useState(0);
  const [goal, setGoal] = useState("");
  const [booking, setBooking] = useState(false);
  const [bookError, setBookError] = useState<string | null>(null);
  const [meetingUrl, setMeetingUrl] = useState<string | null>(null);

  const reservationIdRef = useRef<string | null>(null);
  reservationIdRef.current = reservationId;

  const slotsByDate = useMemo(
    () => groupSlotsByLocalDate(slots, timeZone),
    [slots, timeZone],
  );

  const offeredDurations = useMemo((): DurationMinutes[] => {
    const fromMentor = mentor.availableDurations?.filter((d) =>
      ALL_DURATIONS.includes(d),
    );
    if (fromMentor && fromMentor.length > 0) return fromMentor;
    const fromConfig = config?.durations?.filter((d) =>
      ALL_DURATIONS.includes(d),
    );
    if (fromConfig && fromConfig.length > 0) return fromConfig;
    return ALL_DURATIONS;
  }, [mentor.availableDurations, config?.durations]);

  const bookingWindowKeys = useMemo(() => {
    const today = startOfDay(new Date());
    const min = addDays(today, 0);
    const max = addDays(today, config?.bookingWindowDays ?? 10);
    return {
      minDateKey: toLocalDateKey(min.toISOString(), timeZone),
      maxDateKey: toLocalDateKey(max.toISOString(), timeZone),
    };
  }, [config?.bookingWindowDays, timeZone]);

  const releaseReservation = useCallback(async (id?: string | null) => {
    const rid = id ?? reservationIdRef.current;
    if (!rid) return;
    if (reservationIdRef.current === rid) {
      setReservationId(null);
      setReservationExpiresAt(null);
    }
    try {
      await cancelCounsellingReservation(rid);
    } catch {
      // best effort
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchCounsellingConfig()
      .then((data) => {
        if (!cancelled) setConfig(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setConfigError(
            err instanceof Error
              ? err.message
              : "Could not load booking settings.",
          );
        }
      });
    const prefetchMins = mentor.availableDurations?.[0] ?? 45;
    prefetchCounsellingAvailability(mentor.id, prefetchMins);
    return () => {
      cancelled = true;
    };
  }, [mentor.id, mentor.availableDurations]);

  useEffect(() => {
    return () => {
      void releaseReservation();
    };
  }, [releaseReservation]);

  const loadSlots = useCallback(
    async (
      mins: DurationMinutes,
      options?: { skipCache?: boolean; preserveSlotError?: boolean },
    ) => {
      const preserveError = options?.preserveSlotError === true;
      setSlotsLoading(true);
      if (!preserveError) {
        setSlotsError(null);
        setSlotsErrorKind(null);
      }
      setSlots([]);
      if (!preserveError) {
        setSelectedDate(null);
        setSelectedSlot(null);
      }
      try {
        const data = await fetchCounsellingAvailability(
          mentor.id,
          mins,
          options,
        );
        setSlots(data);
        if (!data.length && !preserveError) {
          setSlotsError(
            "No slots available in the next few days. Try another duration.",
          );
          setSlotsErrorKind("error");
        }
      } catch (err: unknown) {
        if (!preserveError) {
          setSlotsError(
            err instanceof Error ? err.message : "Could not load availability.",
          );
          setSlotsErrorKind("error");
        }
      } finally {
        setSlotsLoading(false);
      }
    },
    [mentor.id],
  );

  // If only one duration is offered, skip the picker and go straight to slots.
  useEffect(() => {
    if (duration != null || step !== "duration") return;
    if (offeredDurations.length !== 1) return;
    const only = offeredDurations[0];
    setDuration(only);
    setStep("slots");
    void loadSlots(only);
  }, [offeredDurations, duration, step, loadSlots]);

  useEffect(() => {
    if (!reservationExpiresAt || step !== "confirm") return;

    const tick = () => {
      const remaining = new Date(reservationExpiresAt).getTime() - Date.now();
      if (remaining <= 0) {
        setCountdownMs(0);
        setBookError(
          "Your hold on this slot expired. Please pick a time again.",
        );
        void releaseReservation();
        setSelectedSlot(null);
        setStep("slots");
        if (duration) void loadSlots(duration, { skipCache: true });
        return;
      }
      setCountdownMs(remaining);
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [reservationExpiresAt, step, duration, loadSlots, releaseReservation]);

  const onPickDuration = async (mins: DurationMinutes) => {
    await releaseReservation();
    setDuration(mins);
    setStep("slots");
    void loadSlots(mins);
    if (mins !== 30) {
      prefetchCounsellingAvailability(mentor.id, mins);
    }
  };

  const onSelectDate = useCallback((dateKey: string) => {
    setSelectedDate(dateKey);
    setSelectedSlot(null);
    setSlotsError(null);
    setSlotsErrorKind(null);
  }, []);

  const onPickSlot = async (slot: CounsellingSlot) => {
    if (!duration) return;
    setBookError(null);
    setSlotsError(null);
    setSlotsErrorKind(null);
    setSelectedSlot(slot);
    setReservationId(null);
    setReservationExpiresAt(null);
    setStep("confirm");
    setReserving(true);
    try {
      const reservation = await reserveCounsellingSlot({
        mentorId: mentor.id,
        durationMinutes: duration,
        slotStartsAt: slot.startsAt,
      });
      setReservationId(reservation.reservationId);
      setReservationExpiresAt(reservation.expiresAt);
      setCountdownMs(new Date(reservation.expiresAt).getTime() - Date.now());
      invalidateCounsellingAvailability(mentor.id, duration);
    } catch (err: unknown) {
      setSelectedSlot(null);
      setReservationId(null);
      setReservationExpiresAt(null);
      setStep("slots");
      const { message, kind } = slotErrorFromUnknown(err);
      setSlotsError(message);
      setSlotsErrorKind(kind);
      if (duration)
        void loadSlots(duration, { skipCache: true, preserveSlotError: true });
    } finally {
      setReserving(false);
    }
  };

  const onBackToSlots = async () => {
    if (reserving) return;
    await releaseReservation();
    setSelectedSlot(null);
    setBookError(null);
    setStep("slots");
  };

  const handleClose = async () => {
    await releaseReservation();
    onClose();
  };

  const priceLabel = useMemo(() => {
    if (!duration) return null;
    return priceLabelForDuration(config, duration, isPremium);
  }, [config, duration, isPremium]);

  const holdMinutes = config?.reservationHoldMinutes ?? 10;

  const onConfirmBook = async () => {
    if (!duration || !selectedSlot || !reservationId) return;
    setBooking(true);
    setBookError(null);
    try {
      if (config?.paymentRequired && config.stripeConfigured) {
        const checkout = await createCounsellingCheckout({
          reservationId,
          goal: goal.trim() || undefined,
          attendeeTimeZone: timeZone,
        });
        window.location.assign(checkout.url);
        return;
      }

      const result = await confirmCounsellingReservation({
        reservationId,
        goal: goal.trim() || undefined,
        attendeeTimeZone: timeZone,
      });
      setReservationId(null);
      setReservationExpiresAt(null);
      setMeetingUrl(result.meetingUrl ?? result.booking.meetingUrl);
      setStep("success");
      onBooked?.();
    } catch (err: unknown) {
      const { message, kind } = slotErrorFromUnknown(err);
      setBookError(message);
      if (kind === "held") {
        setStep("slots");
        setSlotsError(message);
        setSlotsErrorKind(kind);
        if (duration)
          void loadSlots(duration, {
            skipCache: true,
            preserveSlotError: true,
          });
      }
    } finally {
      setBooking(false);
    }
  };

  const paymentBanner =
    config?.paymentRequired && !config.stripeConfigured ? (
      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
        Paid sessions are not fully configured yet. Please try again later or
        contact support.
      </p>
    ) : config?.skipPayment ? (
      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
        Booking without payment for now. Payment will be required before public
        launch.
      </p>
    ) : null;

  const modalWidth =
    step === "slots"
      ? "sm:max-w-3xl"
      : step === "confirm"
        ? "sm:max-w-lg"
        : "sm:max-w-lg";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-[2px] p-0 sm:p-4"
      onClick={() => void handleClose()}
    >
      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className={`relative w-full ${modalWidth} bg-white sm:rounded-2xl rounded-t-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-modal-title"
      >
        <div className="relative bg-blue-600 p-5 flex items-center gap-4 shrink-0">
          <div className="w-14 h-14 rounded-2xl bg-white/20 border border-white/30 overflow-hidden shrink-0">
            {renderPhoto("w-full h-full")}
          </div>
          <div className="min-w-0 flex-1">
            <p
              id="booking-modal-title"
              className="text-white font-bold text-base leading-tight"
            >
              {mentor.name}
            </p>
            {mentor.quals && (
              <p className="text-blue-200 text-[11px] font-semibold">
                {mentor.quals}
              </p>
            )}
            <p className="text-white/75 text-xs mt-0.5 truncate">
              {mentor.title}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleClose()}
            className="p-2 rounded-xl hover:bg-white/20 transition-colors text-white shrink-0"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {configError && (
            <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">
              {configError}
            </p>
          )}
          {paymentBanner}

          {step === "duration" && (
            <>
              <h3 className="text-lg font-bold text-slate-900">
                Choose session length
              </h3>
              <div className="grid gap-3">
                {offeredDurations.map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => void onPickDuration(mins)}
                    className="flex items-center justify-between w-full px-4 py-3.5 rounded-2xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition-colors text-left"
                  >
                    <span className="font-semibold text-slate-800">
                      {mins} minutes
                    </span>
                    <span className="text-sm text-slate-500">
                      {priceLabelForDuration(config, mins, isPremium)}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === "slots" && duration && (
            <>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Choose date & time
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {duration} min session
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      duration && void loadSlots(duration, { skipCache: true })
                    }
                    disabled={slotsLoading || reserving}
                    className="inline-flex items-center gap-1 text-sm text-slate-600 font-medium px-2 py-1 rounded-lg hover:bg-slate-100 disabled:opacity-50"
                    aria-label="Refresh availability"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${slotsLoading ? "animate-spin" : ""}`}
                    />
                    Refresh
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void releaseReservation();
                      setStep("duration");
                    }}
                    className="text-sm text-blue-600 font-medium"
                    hidden={offeredDurations.length <= 1}
                  >
                    Change duration
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 leading-relaxed">
                {SLOT_HOLD_GENERAL_HINT}
              </p>

              {(slotsError || slotsErrorKind === "held") && (
                <div
                  className={`flex flex-col sm:flex-row sm:items-center gap-2 text-sm rounded-xl px-3 py-2.5 border ${
                    slotsErrorKind === "held"
                      ? "text-amber-900 bg-amber-50 border-amber-200"
                      : slotsErrorKind === "unavailable"
                        ? "text-amber-900 bg-amber-50 border-amber-200"
                        : "text-red-700 bg-red-50 border-red-100"
                  } ${slotsLoading ? "opacity-80" : ""}`}
                  role="alert"
                >
                  <span className="flex-1 leading-relaxed">
                    {slotsError ?? SLOT_HOLD_GENERAL_HINT}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSlotsError(null);
                      setSlotsErrorKind(null);
                      void loadSlots(duration, { skipCache: true });
                    }}
                    disabled={slotsLoading}
                    className={`font-semibold underline-offset-2 hover:underline shrink-0 disabled:opacity-50 ${
                      slotsErrorKind === "held" ||
                      slotsErrorKind === "unavailable"
                        ? "text-amber-900"
                        : "text-red-800"
                    }`}
                  >
                    {slotsLoading ? "Refreshing…" : "Refresh Slots"}
                  </button>
                </div>
              )}

              {!slotsError && !slotsLoading && slots.length === 0 && (
                <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-4 text-center">
                  No availability in the next {config?.bookingWindowDays ?? 10}{" "}
                  days. Try another session length.
                </p>
              )}

              {(slotsLoading || slots.length > 0) && (
                <BookingCalendarPicker
                  slotsByDate={slotsByDate}
                  selectedDate={selectedDate}
                  onSelectDate={onSelectDate}
                  selectedSlot={selectedSlot}
                  onSelectSlot={(slot) => void onPickSlot(slot)}
                  timeZone={timeZone}
                  loading={slotsLoading}
                  reserving={reserving}
                  minDateKey={bookingWindowKeys.minDateKey}
                  maxDateKey={bookingWindowKeys.maxDateKey}
                />
              )}
            </>
          )}

          {step === "confirm" && duration && selectedSlot && (
            <>
              <h3 className="text-lg font-bold text-slate-900">
                Confirm booking
              </h3>
              {reserving && !reservationId && (
                <div className="flex items-center gap-2 text-sm text-blue-800 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
                  <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
                  <span>Securing your slot…</span>
                </div>
              )}
              {reservationExpiresAt && countdownMs > 0 && !reserving && (
                <div className="flex items-center gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  <Clock className="w-4 h-4 shrink-0" />
                  <span>
                    Slot held for{" "}
                    <strong>{formatCountdown(countdownMs)}</strong>. Complete
                    booking before it expires ({holdMinutes} min hold).
                  </span>
                </div>
              )}
              <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-2 text-sm">
                <p>
                  <span className="text-slate-500">When: </span>
                  <span className="font-medium text-slate-900">
                    {formatSlotLabel(selectedSlot.startsAt)}
                  </span>
                </p>
                <p>
                  <span className="text-slate-500">Duration: </span>
                  <span className="font-medium text-slate-900">
                    {duration} min
                  </span>
                </p>
                {priceLabel && (
                  <p>
                    <span className="text-slate-500">Price: </span>
                    <span className="font-medium text-slate-900">
                      {config?.skipPayment
                        ? `${priceLabel} (no payment yet)`
                        : priceLabel}
                    </span>
                  </p>
                )}
              </div>
              <label className="block text-sm font-medium text-slate-700">
                What would you like to focus on? (optional)
                <textarea
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  maxLength={2000}
                  rows={3}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  placeholder="e.g. CV review, interview prep, visa questions…"
                />
              </label>
              {bookError && (
                <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">
                  {bookError}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void onBackToSlots()}
                  className="flex-1 py-3 rounded-2xl border border-slate-200 font-semibold text-slate-700"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={
                    booking ||
                    !reservationId ||
                    reserving ||
                    (config?.paymentRequired === true &&
                      config.stripeConfigured === false)
                  }
                  onClick={() => void onConfirmBook()}
                  className="flex-1 py-3 rounded-2xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {booking && <Loader2 className="w-4 h-4 animate-spin" />}
                  {config?.paymentRequired && config.stripeConfigured
                    ? "Continue to payment"
                    : config?.skipPayment
                      ? "Book session"
                      : "Confirm booking"}
                </button>
              </div>
            </>
          )}

          {step === "success" && (
            <div className="flex flex-col items-center text-center gap-4 py-4">
              <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-9 h-9 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">
                Session booked
              </h3>
              <p className="text-slate-500 text-sm max-w-sm">
                You&apos;ll receive a calendar invite from Cal.com.{" "}
                {mentor.name} will meet you at the scheduled time.
              </p>
              {meetingUrl && (
                <a
                  href={meetingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 font-semibold text-sm hover:underline"
                >
                  Open meeting link
                </a>
              )}
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3.5 rounded-2xl bg-blue-600 text-white font-semibold hover:bg-blue-700"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};
