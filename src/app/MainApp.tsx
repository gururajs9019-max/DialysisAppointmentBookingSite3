import { useState } from "react";
import { PortalSelector } from "./PortalSelector";
import PatientApp from "./PatientApp";
import DoctorApp from "./DoctorApp";
import AdminApp from "./AdminApp";

export default function MainApp() {
  const [selectedPortal, setSelectedPortal] = useState<"patient" | "doctor" | "admin" | null>(null);

  const handleSelectPortal = (portal: "patient" | "doctor" | "admin") => {
    setSelectedPortal(portal);
  };

  if (!selectedPortal) {
    return <PortalSelector onSelectPortal={handleSelectPortal} />;
  }

  if (selectedPortal === "patient") {
    return <PatientApp />;
  }

  if (selectedPortal === "admin") {
    return <AdminApp />;
  }

  return <DoctorApp />;
}