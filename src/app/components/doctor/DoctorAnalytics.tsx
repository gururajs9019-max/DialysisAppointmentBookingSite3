import React from "react";
import {
  type AdminPrescription,
  type Patient, type Machine, type DialysisSession,
} from "../../AdminApp";
import { AnalyticsSection } from "../admin/AnalyticsSection";
import type { StaffAnalytics } from "../../lib/staffApi";

interface DoctorAnalyticsProps {
  onNavigate: (view: string) => void;
  prescriptions: AdminPrescription[];
  patients: Patient[];
  machines: Machine[];
  sessions: DialysisSession[];
  analytics: StaffAnalytics | null;
}

export function DoctorAnalytics({ onNavigate: _onNavigate, prescriptions, patients, machines, sessions }: DoctorAnalyticsProps) {
  return (
    <AnalyticsSection
      patients={patients}
      machines={machines}
      sessions={sessions}
      prescriptions={prescriptions}
      isAdmin={false}
    />
  );
}
