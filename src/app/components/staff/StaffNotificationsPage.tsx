import React, { useRef, useState } from "react";
import { Activity, Bell, Check, CheckCheck, Clock3, ExternalLink, RotateCw } from "lucide-react";
import type { StaffNotification } from "../../lib/staffApi";

interface StaffNotificationsPageProps {
  notifications: StaffNotification[];
  onMarkRead: (id: string, read: boolean) => Promise<void>;
  onMarkAllRead: () => Promise<void>;
  onOpenPrescription: (notification: StaffNotification) => Promise<void>;
  accent?: "violet" | "blue";
}

function isPrescriptionNotification(notification: StaffNotification) {
  return Boolean(
    notification.patient_id &&
    notification.record_id &&
    ["Prescription created", "Prescription revised"].includes(notification.message ?? ""),
  );
}

function formatNotificationDate(value?: string) {
  if (!value) return "Time unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Time unavailable"
    : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function StaffNotificationsPage({
  notifications,
  onMarkRead,
  onMarkAllRead,
  onOpenPrescription,
  accent = "violet",
}: StaffNotificationsPageProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const retryAction = useRef<(() => Promise<void>) | null>(null);
  const operationLock = useRef(false);
  const unreadCount = notifications.filter(notification => !notification.read).length;
  const accentClasses = accent === "blue"
    ? { icon: "bg-blue-100 text-blue-700", unread: "border-blue-200 bg-blue-50/70", action: "text-blue-700 hover:bg-blue-50", dot: "bg-blue-600" }
    : { icon: "bg-violet-100 text-violet-700", unread: "border-violet-200 bg-violet-50/70", action: "text-violet-700 hover:bg-violet-50", dot: "bg-violet-600" };

  async function run(action: () => Promise<void>, key: string) {
    if (operationLock.current) return;
    operationLock.current = true;
    setBusy(key);
    setError(null);
    retryAction.current = action;
    try {
      await action();
      retryAction.current = null;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Notification could not be updated.");
    } finally {
      setBusy(null);
      operationLock.current = false;
    }
  }

  return (
    <section className="animate-fade-in space-y-5" aria-labelledby="staff-notifications-title">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-end sm:justify-between sm:p-6">
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${accentClasses.icon}`}>
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <h2 id="staff-notifications-title" className="text-xl font-bold text-slate-900">Notifications</h2>
            <p className="mt-1 text-sm text-slate-500">
              {unreadCount > 0 ? `${unreadCount} unread update${unreadCount === 1 ? "" : "s"}` : "You are up to date."}
              {" · "}Prescription previews omit medication details.
            </p>
          </div>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => void run(onMarkAllRead, "all")}
            disabled={busy !== null}
            className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-wait disabled:opacity-60 ${accentClasses.action}`}
          >
            <CheckCheck className="h-4 w-4" />
            {busy === "all" ? "Saving…" : "Mark all read"}
          </button>
        )}
      </div>

      {error && (
        <div role="alert" className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 sm:flex-row sm:items-center sm:justify-between">
          <p>{error}</p>
          <button
            type="button"
            disabled={busy !== null || !retryAction.current}
            onClick={() => retryAction.current && void run(retryAction.current, "retry")}
            className="inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-rose-300 bg-white px-3 font-semibold hover:bg-rose-100 disabled:opacity-50"
          >
            <RotateCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      )}

      {notifications.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-6 py-14 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm">
            <Activity className="h-5 w-5" />
          </div>
          <h3 className="mt-4 text-sm font-semibold text-slate-800">No notifications yet</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">New staff updates will appear here when they are available.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map(notification => {
            const canOpenPrescription = isPrescriptionNotification(notification);
            const isBusy = busy === notification.id;
            return (
              <article
                key={notification.id}
                data-notification-id={notification.id}
                role={canOpenPrescription ? "group" : undefined}
                tabIndex={canOpenPrescription ? 0 : undefined}
                aria-label={canOpenPrescription ? `${notification.message || "Prescription update"} — open prescription` : undefined}
                onClick={canOpenPrescription ? () => void run(() => onOpenPrescription(notification), notification.id) : undefined}
                onKeyDown={canOpenPrescription ? (event: React.KeyboardEvent<HTMLElement>) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    void run(() => onOpenPrescription(notification), notification.id);
                  }
                } : undefined}
                className={`rounded-2xl border p-4 shadow-sm transition-colors sm:p-5 ${
                  notification.read ? "border-slate-200 bg-white" : accentClasses.unread
                } ${canOpenPrescription ? "cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400" : ""}`}
              >
                <div className="flex items-start gap-3">
                  <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${notification.read ? "bg-slate-300" : accentClasses.dot}`} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-semibold text-slate-900">{notification.message || "Notification"}</p>
                        {notification.detail && <p className="mt-1 break-words text-sm leading-relaxed text-slate-600">{notification.detail}</p>}
                      </div>
                      <span className={`inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        notification.read ? "bg-slate-100 text-slate-600" : `${accentClasses.icon}`
                      }`}>
                        {notification.read ? <Check className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                        {notification.read ? "Read" : "Unread"}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-col gap-3 border-t border-slate-200/70 pt-3 sm:flex-row sm:items-center sm:justify-between">
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                        <Clock3 className="h-3.5 w-3.5" /> {formatNotificationDate(notification.created_at)}
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        {canOpenPrescription && (
                          <button
                            type="button"
                            disabled={busy !== null}
                            onClick={event => {
                              event.stopPropagation();
                              void run(() => onOpenPrescription(notification), notification.id);
                            }}
                            className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors disabled:opacity-50 ${accentClasses.action}`}
                          >
                            <ExternalLink className="h-3.5 w-3.5" /> Open prescription
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={event => {
                            event.stopPropagation();
                            void run(() => onMarkRead(notification.id, !notification.read), notification.id);
                          }}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
                        >
                          <Check className="h-3.5 w-3.5" />
                          {isBusy ? "Saving…" : notification.read ? "Mark unread" : "Mark as read"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
