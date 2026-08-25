import React, { useCallback, useState } from "react";
import { PortalSelector } from "./PortalSelector";
import PatientApp from "./PatientApp";
import DoctorApp from "./DoctorApp";
import AdminApp, {
  INITIAL_ADMIN_PRESCRIPTIONS,
  type AdminPrescription,
  type RxNotification,
} from "./AdminApp";
import type { Appointment } from "./components/AppointmentCard";
import { fetchAppointments } from "./lib/appointmentApi";

export default function App() {
  const [selectedPortal, setSelectedPortal] = useState<"patient" | "doctor" | "admin" | null>(null);
  const [prescriptions, setPrescriptions] = useState<AdminPrescription[]>(INITIAL_ADMIN_PRESCRIPTIONS);
  const [rxNotifications, setRxNotifications] = useState<RxNotification[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [appointmentsError, setAppointmentsError] = useState<string | null>(null);

  const loadAppointments = useCallback(async () => {
    setAppointmentsLoading(true);
    setAppointmentsError(null);
    try {
      setAppointments(await fetchAppointments());
    } catch (error) {
      setAppointmentsError(error instanceof Error ? error.message : "Saved appointments could not be loaded.");
    } finally {
      setAppointmentsLoading(false);
    }
  }, []);

  const applyAppointmentUpdate = (updated: Appointment) => {
    setAppointments(prev => prev.map(appointment => appointment.id === updated.id ? updated : appointment));
  };
  const addAppointment = (appointment: Appointment) => {
    setAppointments(prev => [...prev, appointment]);
  };

  const addRxNotification = (n: Omit<RxNotification, "id" | "read">) =>
    setRxNotifications(prev => [{ ...n, id: `RXN${Date.now()}`, read: false }, ...prev]);

  const markRxRead = (id: string) =>
    setRxNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));

  if (!selectedPortal) {
    return <PortalSelector onSelectPortal={setSelectedPortal} />;
  }

  if (selectedPortal === "patient") {
    return <PatientApp />;
  }

  if (selectedPortal === "admin") {
    return (
      <AdminApp
        prescriptions={prescriptions}
        setPrescriptions={setPrescriptions}
        rxNotifications={rxNotifications}
        markRxRead={markRxRead}
        appointments={appointments}
        appointmentsLoading={appointmentsLoading}
        appointmentsError={appointmentsError}
        onReloadAppointments={loadAppointments}
        onAppointmentUpdated={applyAppointmentUpdate}
        onAppointmentCreated={addAppointment}
        onSessionAuthenticated={loadAppointments}
      />
    );
  }

  return (
    <DoctorApp
      prescriptions={prescriptions}
      setPrescriptions={setPrescriptions}
      addRxNotification={addRxNotification}
      appointments={appointments}
      appointmentsLoading={appointmentsLoading}
      appointmentsError={appointmentsError}
      onReloadAppointments={loadAppointments}
      onAppointmentUpdated={applyAppointmentUpdate}
      onAppointmentCreated={addAppointment}
      onSessionAuthenticated={loadAppointments}
    />
  );
}
