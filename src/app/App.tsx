import React, { useState } from "react";
import { PortalSelector } from "./PortalSelector";
import PatientApp from "./PatientApp";
import DoctorApp from "./DoctorApp";
import AdminApp, {
  INITIAL_ADMIN_PRESCRIPTIONS,
  type AdminPrescription,
  type RxNotification,
} from "./AdminApp";

export default function App() {
  const [selectedPortal, setSelectedPortal] = useState<"patient" | "doctor" | "admin" | null>(null);
  const [prescriptions, setPrescriptions] = useState<AdminPrescription[]>(INITIAL_ADMIN_PRESCRIPTIONS);
  const [rxNotifications, setRxNotifications] = useState<RxNotification[]>([]);
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
      />
    );
  }

  return (
    <DoctorApp
      prescriptions={prescriptions}
      setPrescriptions={setPrescriptions}
      addRxNotification={addRxNotification}
    />
  );
}
