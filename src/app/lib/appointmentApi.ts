import type { Appointment } from "../components/AppointmentCard";
import type { BookingFormData } from "../components/BookingForm";

export type AppointmentUpdates = Partial<Pick<
  Appointment,
  "status" | "appointmentDate" | "appointmentTime" | "dialysisType" | "notes" | "location"
>>;

export class AppointmentApiError extends Error {
  constructor(message: string, public readonly operation: "load" | "save") {
    super(message);
    this.name = "AppointmentApiError";
  }
}

export interface StaffUser {
  id: string;
  username: string | null;
  email: string;
  name: string;
  role: "doctor" | "admin";
}

async function request<T>(url: string, options: RequestInit, operation: "load" | "save"): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...options.headers } });
  } catch {
    throw new AppointmentApiError("The appointment service is unavailable. Check your connection and try again.", operation);
  }

  let body: { error?: string };
  try {
    body = await response.json();
  } catch {
    throw new AppointmentApiError(`The appointment service returned an invalid response (${response.status}).`, operation);
  }
  if (!response.ok) {
    throw new AppointmentApiError(body.error || `Appointment request failed (${response.status}).`, operation);
  }
  return body as T;
}

export async function fetchAppointments(): Promise<Appointment[]> {
  const result = await request<{ appointments: Appointment[] }>("/api/appointments", { method: "GET" }, "load");
  return result.appointments.map((appointment) => ({
    ...appointment,
    createdAt: new Date(appointment.createdAt),
  }));
}

export async function createAppointment(data: BookingFormData): Promise<Appointment> {
  const result = await request<{ appointment: Appointment }>(
    "/api/appointments",
    { method: "POST", body: JSON.stringify(data) },
    "save",
  );
  return { ...result.appointment, createdAt: new Date(result.appointment.createdAt) };
}

export async function updateAppointment(id: string, updates: AppointmentUpdates): Promise<Appointment> {
  const result = await request<{ appointment: Appointment }>(
    `/api/appointments/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(updates) },
    "save",
  );
  return { ...result.appointment, createdAt: new Date(result.appointment.createdAt) };
}

export async function loginStaff(role: StaffUser["role"], identifier: string, password: string): Promise<StaffUser> {
  const result = await request<{ user: StaffUser }>(
    "/api/auth/login",
    { method: "POST", body: JSON.stringify({ role, identifier, password }) },
    "save",
  );
  return result.user;
}

export async function logoutStaff(): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch {
    // Local UI logout must still complete if the network is no longer available.
  }
}