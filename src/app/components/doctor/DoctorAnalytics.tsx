import React from "react";
import {
  INITIAL_PATIENTS,
  INITIAL_MACHINES,
  INITIAL_SESSIONS,
  type AdminPrescription,
} from "../../AdminApp";
import { AnalyticsSection } from "../admin/AnalyticsSection";

interface DoctorAnalyticsProps {
  onNavigate: (view: string) => void;
  prescriptions: AdminPrescription[];
}

export function DoctorAnalytics({ onNavigate: _onNavigate, prescriptions }: DoctorAnalyticsProps) {
  return (
    <AnalyticsSection
      patients={INITIAL_PATIENTS}
      machines={INITIAL_MACHINES}
      sessions={INITIAL_SESSIONS}
      prescriptions={prescriptions}
      isAdmin={false}
    />
  );
}
