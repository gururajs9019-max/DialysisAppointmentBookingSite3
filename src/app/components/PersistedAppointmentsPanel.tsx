import { useState } from "react";
import { AlertCircle, Calendar, CheckCircle2, Clock, Loader2, Plus, RefreshCw, XCircle } from "lucide-react";
import type { Appointment } from "./AppointmentCard";
import { BookingForm, type BookingFormData } from "./BookingForm";
import { createAppointment, updateAppointment, type AppointmentUpdates } from "../lib/appointmentApi";

type PanelRole = "patient" | "doctor" | "admin";

interface PersistedAppointmentsPanelProps {
  appointments: Appointment[];
  role: PanelRole;
  patient?: { name: string; email: string; phone: string } | null;
  loading: boolean;
  loadError: string | null;
  onReload: () => void;
  onUpdated: (appointment: Appointment) => void;
  onCreated?: (appointment: Appointment) => void;
}

function matchesPatient(appointment: Appointment, patient: NonNullable<PersistedAppointmentsPanelProps["patient"]>) {
  const emailMatches = patient.email && appointment.email && appointment.email.toLowerCase() === patient.email.toLowerCase();
  const phoneMatches = patient.phone && appointment.phone && appointment.phone === patient.phone;
  const nameMatches = patient.name && appointment.patientName && appointment.patientName.toLowerCase() === patient.name.toLowerCase();
  return Boolean(emailMatches || phoneMatches || nameMatches);
}

export function PersistedAppointmentsPanel({
  appointments,
  role,
  patient,
  loading,
  loadError,
  onReload,
  onUpdated,
  onCreated,
}: PersistedAppointmentsPanelProps) {
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const visibleAppointments = role === "patient" && patient
    ? appointments.filter((appointment) => matchesPatient(appointment, patient))
    : appointments;

  const saveUpdate = async (id: string, updates: AppointmentUpdates) => {
    setSavingId(id);
    setSaveError(null);
    try {
      onUpdated(await updateAppointment(id, updates));
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "The appointment change could not be saved.");
    } finally {
      setSavingId(null);
    }
  };
  const saveNewAppointment = async (data: BookingFormData) => {
    setIsSubmitting(true);
    setSaveError(null);
    try {
      onCreated?.(await createAppointment(data));
      setIsCreating(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "The appointment could not be saved.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="space-y-4">
      {role !== "patient" && onCreated && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-800">Add a patient booking</h3>
              <p className="mt-1 text-sm text-slate-600">Create a booking that is saved for both staff portals.</p>
            </div>
            {!isCreating && (
              <button
                onClick={() => { setSaveError(null); setIsCreating(true); }}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" /> Add booking
              </button>
            )}
          </div>
          {isCreating && (
            <div className="mt-5">
              <BookingForm
                onSubmit={saveNewAppointment}
                onCancel={() => { if (!isSubmitting) { setSaveError(null); setIsCreating(false); } }}
                isSubmitting={isSubmitting}
                submitError={saveError}
              />
            </div>
          )}
        </div>
      )}
      {loadError && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div className="flex-1">
            <p className="font-bold">Appointments could not be loaded</p>
            <p className="mt-1">{loadError}</p>
            <button onClick={onReload} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-red-100 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-200">
              <RefreshCw className="h-3.5 w-3.5" /> Try again
            </button>
          </div>
        </div>
      )}
      {saveError && !isCreating && (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" /> {saveError}
        </div>
      )}
      {loading && !loadError && (
        <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading saved appointments…
        </div>
      )}
      {!loading && !loadError && visibleAppointments.length === 0 && (
        <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
          <Calendar className="mx-auto mb-3 h-10 w-10 text-slate-200" />
          No saved appointments to display.
        </div>
      )}
      <div className="space-y-3">
        {visibleAppointments.map((appointment) => {
          const isSaving = savingId === appointment.id;
          return (
            <div key={appointment.id} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-slate-800">
                    {role !== "patient" && appointment.patientName ? appointment.patientName : `${appointment.firstName} ${appointment.lastName}`}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {role !== "patient" ? `Patient ID: ${appointment.medicalId}` : appointment.dialysisType}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                  appointment.status === "upcoming" ? "bg-emerald-100 text-emerald-700" :
                  appointment.status === "completed" ? "bg-slate-100 text-slate-600" : "bg-red-100 text-red-700"
                }`}>
                  {appointment.status}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-2 text-sm text-slate-600 sm:grid-cols-3">
                <span className="flex items-center gap-2"><Calendar className="h-4 w-4 text-blue-600" />{appointment.appointmentDate}</span>
                <span className="flex items-center gap-2"><Clock className="h-4 w-4 text-blue-600" />{appointment.appointmentTime}</span>
                <span>{appointment.location}</span>
              </div>
              {role !== "patient" && (
                <p className="mt-3 text-xs text-slate-500">{appointment.email} · {appointment.phone}</p>
              )}
              {appointment.notes && <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">{appointment.notes}</p>}
              {appointment.status === "upcoming" && (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                  {role === "patient" ? (
                    <button disabled={isSaving} onClick={() => saveUpdate(appointment.id, { status: "cancelled" })}
                      className="inline-flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-50">
                      <XCircle className="h-3.5 w-3.5" /> Cancel appointment
                    </button>
                  ) : (
                    <>
                      <button disabled={isSaving} onClick={() => saveUpdate(appointment.id, { status: "completed" })}
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Mark completed
                      </button>
                      <button disabled={isSaving} onClick={() => saveUpdate(appointment.id, { status: "cancelled" })}
                        className="inline-flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-50">
                        <XCircle className="h-3.5 w-3.5" /> Cancel
                      </button>
                    </>
                  )}
                  {isSaving && <Loader2 className="h-4 w-4 animate-spin self-center text-blue-600" />}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}