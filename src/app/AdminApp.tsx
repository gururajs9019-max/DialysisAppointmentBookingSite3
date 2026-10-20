import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useStaffSync } from "./lib/useStaffSync";
import { usePrescriptionLeaveGuard, usePrescriptionDraftGuard, type PrescriptionDraftStateListener } from "./lib/usePrescriptionLeaveGuard";
import { updatePatient, fetchStaffAccounts, createStaffAccount, updateStaffAccount, type StaffData, type StaffNotification } from "./lib/staffApi";
import { AdminAuthPortal, AdminData } from "./components/admin/AdminAuthPortal";
import { AnalyticsSection } from "./components/admin/AnalyticsSection";
import { PatientClinicalEditor } from "./components/admin/PatientClinicalEditor";
import { ScheduleClinicalLinks, type ScheduleLinks } from "./components/admin/ScheduleClinicalLinks";
import { logoutStaff } from "./lib/appointmentApi";
import { createMachine, createPatient, createPrescription, createSession, fetchPatientById, loadStaffData, markNotificationRead, markAllNotificationsRead, openNotificationTarget, updateMachine, updatePrescription, updateSession, PrescriptionConflictError, type SessionUpdatePayload } from "./lib/staffApi";
import { localDateKey } from "./lib/scheduleDateMapping.mjs";
import { StaffNotificationsPage } from "./components/staff/StaffNotificationsPage";
import { PrescriptionConflict } from "./components/PrescriptionConflict";
import {
  LayoutDashboard, Activity, Cpu, ClipboardList, Bell, Search, LogOut,
  UserCog, Menu, X, CheckCircle, AlertCircle, ChevronRight, Eye, Edit3,
  RefreshCw, Power, PowerOff, Wrench, UserPlus, Shield, Calendar,
  HeartPulse, Stethoscope, Syringe, FileText, FlaskConical, Info,
  ArrowRight, ArrowLeft, Clock, AlertTriangle, CalendarPlus, Check,
  Users, ChevronDown, ClipboardCheck, Ban, SkipForward, HeartHandshake,
  MapPin, Phone, TrendingUp, Zap, ScrollText, UserCheck, UserX,
  ChevronUp, BarChart3, Pill, Plus, Filter, Building2, Tag,
  Trash2, EyeOff, Lock
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type NavSection =
  | "dashboard" | "live-schedule" | "patient-history" | "machines"
  | "viral-status" | "register-patient" | "notifications" | "assign-patient"
  | "treatment-status" | "search-patients" | "missed-slots" | "doctors" | "analytics";

type DoctorStatus = "Active" | "Inactive";

interface DoctorRecord {
  id: string;
  name: string;
  email: string;
  employeeId: string;
  specialization: string;
  phone: string;
  status: DoctorStatus;
  dateAdded: string;
  hasHistoricalRecords: boolean;
}

type MachineStatus = "available" | "in-use" | "scheduled" | "maintenance" | "disabled";
type ViralStatusValue = "Positive" | "Negative" | "Unknown" | "Awaiting Report";
const TREATMENT_STATUSES = ["Active", "Transplanted", "Expired", "Shifted", "Discontinued", "Temporarily inactive", "Transferred", "Screening ended"] as const;
type TreatmentStatus = typeof TREATMENT_STATUSES[number];
type AttendanceStatus = "Scheduled" | "Completed" | "Missed" | "Cancelled";
type SessionStatus = "Scheduled" | "Running" | "Waiting" | "Called" | "Completed" | "Missed" | "Cancelled";
type AssignStep = 1 | 2 | 3 | 4 | "success";

interface ViralProfile {
  hepatitisB: ViralStatusValue;
  hepatitisC: ViralStatusValue;
  hiv: ViralStatusValue;
  other: string;
}

export interface Patient {
  id: string; uhid: string; name: string; age: number; gender: "Male" | "Female";
  mobile: string; address: string; city: string; primaryDisease: string;
  causeOfFailure: string; biopsyDone: boolean; biopsyDetails: string;
  comorbidities: string; bloodGroup: string; dialysisStartDate: string;
  referredBy: string; treatingNephrologist: string; viralStatus: ViralProfile;
  emergencyContact: string; insurance: string; remarks: string;
  treatmentStatus: TreatmentStatus; registeredDate: string;
  lastDialysis: string; currentSchedule: string | null;
  dialysisDaysPerWeek: number;
  dialysisDays: string[];
  dateOfBirth?: string;
  registrationFields?: Record<string, unknown>;
  medicalInfo?: Record<string, unknown>;
  investigations?: Record<string, unknown>;
}

interface DialysisUnit {
  id: string;
  name: string;
}

interface MachineTypeConfig {
  id: string;
  label: string;
}

export interface Machine {
  id: string;
  number: string;
  unit: string;
  category: string;
  name: string;
  status: MachineStatus;
  currentPatient: string | null;
  nextPatient: string | null;
  nextAvailableTime: string | null;
  lastMaintenance: string;
  notes: string;
}

export interface DialysisSession {
  id: string; patientId: string; patientName: string; uhid: string;
  date: string; slot: string; machine: string; machineId: string; unit: string;
  duration: string; doctor: string; attendance: AttendanceStatus;
  doctorId?: string; prescriptionId?: string;
  notes: string; startTime: string; endTime: string;
  status: SessionStatus; missedReason?: string; missedReasonOther?: string;
  slotType?: "normal" | "emergency";
  emergencyTime?: string;
  vitals?: { bp: string; heartRate: string };
  complications?: string[];
  importantNote?: string;
}

interface AssignmentDraft {
  doctorId?: string;
  prescriptionId?: string;
  patient: Patient | null;
  unit: DialysisUnit | null;
  machine: Machine | null;
  slot: string;
  startTime: string;
  endTime: string;
  duration: string;
  doctor: string;
  notes: string;
  date: string;
  slotType: "normal" | "emergency" | "";
  emergencyTime: string;
}

interface ValidationResult {
  ok: boolean; errors: string[]; warnings: string[];
}

export interface RxDialysis {
  weeklySessionsCount: string; dialysisDays: string[];
  slot: string; duration: string;
  bloodFlow: string; dialysateFlow: string; membrane: string;
  dryWeight: string; anticoagulation: string;
}

export const WEEKLY_SESSION_OPTIONS = [
  "1 Session / Week","2 Sessions / Week","3 Sessions / Week","4 Sessions / Week",
  "5 Sessions / Week","6 Sessions / Week","7 Sessions / Week",
];
export const DIALYSIS_DAY_OPTIONS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
export const SLOT_OPTIONS = ["8:00 AM – 12:00 PM","12:00 PM – 4:00 PM","4:00 PM – 8:00 PM"];
export const DURATION_OPTIONS = ["2 Hours","3 Hours","4 Hours","5 Hours"];

export const ADMIN_RX_SCALAR_FIELDS: { key: keyof Omit<RxDialysis,"dialysisDays">; label: string }[] = [
  { key: "weeklySessionsCount", label: "Weekly Sessions" },
  { key: "slot",                label: "Slot" },
  { key: "duration",            label: "Duration" },
  { key: "bloodFlow",           label: "Blood Flow" },
  { key: "dialysateFlow",       label: "Dialysate Flow" },
  { key: "membrane",            label: "Membrane" },
  { key: "dryWeight",           label: "Dry Weight" },
  { key: "anticoagulation",     label: "Anticoagulation" },
];
export interface RxMedication { name: string; dose: string; frequency: string; route: string; }
export interface PrescriptionHistoryEntry {
  version: number; updatedDate: string; updatedBy: string;
  updatedByRole: "Administrator" | "Doctor";
  updatedAt?: string;
  changedFields: string[];
  dialysisRx: RxDialysis; medications: RxMedication[];
  notes: string; status: "Active" | "Revised" | "Discontinued";
}
export interface AdminPrescription {
  id: string; patientId: string; patientName: string; patientUhid: string;
  diagnosis: string; status: "Active" | "Revised" | "Discontinued";
  issuedDate: string; updatedBy: string; updatedByRole: "Administrator" | "Doctor";
  lastUpdatedAt?: string;
  dialysisRx: RxDialysis; medications: RxMedication[];
  notes: string; history: PrescriptionHistoryEntry[];
  version?: number;
  createdAt?: string;
  createdBy?: string;
  createdByRole?: "Administrator" | "Doctor";
}
export interface RxNotification {
  id: string; doctorName: string; patientName: string; patientUhid: string;
  prescriptionId: string; timestamp: string; read: boolean; changedFields: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SLOTS = [
  { label: "Slot 1", display: "Slot 1 (8:00 AM – 12:00 PM)", start: "08:00", end: "12:00", startFmt: "8:00 AM", endFmt: "12:00 PM" },
  { label: "Slot 2", display: "Slot 2 (12:00 PM – 4:00 PM)",  start: "12:00", end: "16:00", startFmt: "12:00 PM", endFmt: "4:00 PM" },
  { label: "Slot 3", display: "Slot 3 (4:00 PM – 8:00 PM)",   start: "16:00", end: "20:00", startFmt: "4:00 PM",  endFmt: "8:00 PM" },
];

const INITIAL_UNITS: DialysisUnit[] = [
  { id: "U1", name: "Unit 1" },
  { id: "U2", name: "Unit 2" },
];

const BASE_CATEGORIES: MachineTypeConfig[] = [
  { id: "Negative",   label: "Negative" },
  { id: "HCV",        label: "HCV" },
  { id: "HBsAg",      label: "HBsAg" },
  { id: "HIV",        label: "HIV" },
  { id: "RVD (HIV)",  label: "RVD (HIV)" },
];

const INITIAL_DOCTORS: DoctorRecord[] = [
  { id: "DOC001", name: "Dr. Suresh Pillai",        email: "s.pillai@kmcri.in",          employeeId: "EMP-101", specialization: "Nephrology",             phone: "Contact via portal", status: "Active",   dateAdded: "Recently", hasHistoricalRecords: true },
  { id: "DOC002", name: "Dr. Anita Krishnamurthy",  email: "a.krishnamurthy@kmcri.in",   employeeId: "EMP-102", specialization: "Nephrology",             phone: "Contact via portal", status: "Active",   dateAdded: "Recently", hasHistoricalRecords: true },
  { id: "DOC003", name: "Dr. Kavita Nair",           email: "k.nair@kmcri.in",            employeeId: "EMP-103", specialization: "Renal Medicine",         phone: "Contact via portal", status: "Active",   dateAdded: "Recently", hasHistoricalRecords: true },
  { id: "DOC004", name: "Dr. Ramesh Babu",           email: "r.babu@kmcri.in",            employeeId: "EMP-104", specialization: "Nephrology",             phone: "Contact via portal", status: "Active",   dateAdded: "Recently", hasHistoricalRecords: true },
  { id: "DOC005", name: "Dr. Meena Gupta",           email: "m.gupta@kmcri.in",           employeeId: "EMP-105", specialization: "Internal Medicine",      phone: "Contact via portal", status: "Inactive", dateAdded: "Recently", hasHistoricalRecords: true },
];

// 36-machine IIFE: Unit 1 (29) + Unit 2 (7)
export const INITIAL_MACHINES: Machine[] = (() => {
  const ms: Machine[] = [];

  // Unit 1 layout: 22 Negative + 5 HCV + 1 HBsAg + 1 RVD(HIV) = 29
  type Layout = { cat: string; status: MachineStatus; patient: string | null };
  const u1: Layout[] = [
    // Negative (M01–M22)
    { cat: "Negative", status: "in-use",      patient: "Arjun Mehta" },     // M01
    { cat: "Negative", status: "available",   patient: null },               // M02
    { cat: "Negative", status: "available",   patient: null },               // M03
    { cat: "Negative", status: "available",   patient: null },               // M04
    { cat: "Negative", status: "maintenance", patient: null },               // M05
    { cat: "Negative", status: "available",   patient: null },               // M06
    { cat: "Negative", status: "disabled",    patient: null },               // M07
    { cat: "Negative", status: "in-use",      patient: "Sanjay Patel" },     // M08
    { cat: "Negative", status: "available",   patient: null },               // M09
    { cat: "Negative", status: "available",   patient: null },               // M10
    { cat: "Negative", status: "available",   patient: null },               // M11
    { cat: "Negative", status: "available",   patient: null },               // M12
    { cat: "Negative", status: "available",   patient: null },               // M13
    { cat: "Negative", status: "available",   patient: null },               // M14
    { cat: "Negative", status: "available",   patient: null },               // M15
    { cat: "Negative", status: "in-use",      patient: "Priya Reddy" },      // M16
    { cat: "Negative", status: "available",   patient: null },               // M17
    { cat: "Negative", status: "available",   patient: null },               // M18
    { cat: "Negative", status: "available",   patient: null },               // M19
    { cat: "Negative", status: "available",   patient: null },               // M20
    { cat: "Negative", status: "available",   patient: null },               // M21
    { cat: "Negative", status: "available",   patient: null },               // M22
    // HCV (M23–M27)
    { cat: "HCV",     status: "in-use",      patient: "Vikram Singh" },      // M23
    { cat: "HCV",     status: "available",   patient: null },                // M24
    { cat: "HCV",     status: "available",   patient: null },                // M25
    { cat: "HCV",     status: "available",   patient: null },                // M26
    { cat: "HCV",     status: "scheduled",   patient: null },                // M27
    // HBsAg (M28)
    { cat: "HBsAg",   status: "in-use",      patient: "Lakshmi Iyer" },      // M28
    // RVD (HIV) (M29)
    { cat: "RVD (HIV)", status: "available", patient: null },                // M29
  ];

  u1.forEach((m, i) => {
    const n = String(i + 1).padStart(2, "0");
    ms.push({
      id: `M${n}`, number: `Machine ${n}`, unit: "U1", category: m.cat,
      name: `Machine ${n}`, status: m.status, currentPatient: m.patient,
      nextPatient: null, nextAvailableTime: null, lastMaintenance: "Recently", notes: "",
    });
  });

  // Unit 2: 5 Negative + 1 HCV + 1 HIV = 7
  const u2: Layout[] = [
    { cat: "Negative", status: "in-use",    patient: "Ramesh Nair" },        // U2-M01
    { cat: "Negative", status: "available", patient: null },                 // U2-M02
    { cat: "Negative", status: "available", patient: null },                 // U2-M03
    { cat: "Negative", status: "available", patient: null },                 // U2-M04
    { cat: "Negative", status: "scheduled", patient: null },                 // U2-M05
    { cat: "HCV",      status: "available", patient: null },                 // U2-M06
    { cat: "HIV",      status: "available", patient: null },                 // U2-M07
  ];

  u2.forEach((m, i) => {
    const n = String(i + 1).padStart(2, "0");
    ms.push({
      id: `U2M${n}`, number: `U2-Machine ${n}`, unit: "U2", category: m.cat,
      name: `U2-Machine ${n}`, status: m.status, currentPatient: m.patient,
      nextPatient: null, nextAvailableTime: null, lastMaintenance: "Recently", notes: "",
    });
  });

  return ms;
})();

export const INITIAL_PATIENTS: Patient[] = [
  {
    id: "P001", uhid: "KMCRI-2024-001", name: "Arjun Mehta", age: 45, gender: "Male",
    mobile: "Contact via portal", address: "12, Shivaji Nagar", city: "Pune",
    primaryDisease: "Chronic Kidney Disease Stage 5", causeOfFailure: "Diabetic Nephropathy",
    biopsyDone: true, biopsyDetails: "Diffuse mesangial expansion",
    comorbidities: "Type 2 Diabetes, Hypertension", bloodGroup: "B+",
    dialysisStartDate: "Recently", referredBy: "Dr. Kavita Nair",
    treatingNephrologist: "Dr. Suresh Pillai",
    viralStatus: { hepatitisB: "Negative", hepatitisC: "Negative", hiv: "Negative", other: "None" },
    emergencyContact: "Contact via portal", insurance: "Star Health",
    remarks: "Requires thrice weekly sessions", treatmentStatus: "Active",
    registeredDate: "Recently", lastDialysis: "Recently", currentSchedule: "Slot 1 · Machine 01",
    dialysisDaysPerWeek: 3, dialysisDays: ["Monday", "Wednesday", "Friday"],
  },
  {
    id: "P002", uhid: "KMCRI-2024-002", name: "Lakshmi Iyer", age: 52, gender: "Female",
    mobile: "Contact via portal", address: "45, Gandhi Road", city: "Chennai",
    primaryDisease: "End Stage Renal Disease", causeOfFailure: "Hypertensive Nephrosclerosis",
    biopsyDone: false, biopsyDetails: "",
    comorbidities: "Hypertension, Anaemia", bloodGroup: "O+",
    dialysisStartDate: "Recently", referredBy: "Dr. Ramesh Babu",
    treatingNephrologist: "Dr. Anita Krishnamurthy",
    viralStatus: { hepatitisB: "Positive", hepatitisC: "Negative", hiv: "Negative", other: "None" },
    emergencyContact: "Contact via portal", insurance: "Government Scheme",
    remarks: "HBsAg positive — isolated machine required", treatmentStatus: "Active",
    registeredDate: "Recently", lastDialysis: "Recently", currentSchedule: "Slot 1 · Machine 28",
    dialysisDaysPerWeek: 3, dialysisDays: ["Monday", "Wednesday", "Friday"],
  },
  {
    id: "P003", uhid: "KMCRI-2024-003", name: "Vikram Singh", age: 38, gender: "Male",
    mobile: "Contact via portal", address: "7, Nehru Colony", city: "Jaipur",
    primaryDisease: "Polycystic Kidney Disease", causeOfFailure: "Genetic (PKD1 mutation)",
    biopsyDone: true, biopsyDetails: "Multiple cysts, cortical thinning",
    comorbidities: "Hepatomegaly", bloodGroup: "A+",
    dialysisStartDate: "Recently", referredBy: "Dr. Meena Gupta",
    treatingNephrologist: "Dr. Suresh Pillai",
    viralStatus: { hepatitisB: "Negative", hepatitisC: "Positive", hiv: "Negative", other: "None" },
    emergencyContact: "Contact via portal", insurance: "New India Assurance",
    remarks: "HCV positive — dedicated machine slot allocated", treatmentStatus: "Active",
    registeredDate: "Recently", lastDialysis: "Recently", currentSchedule: "Slot 2 · Machine 23",
    dialysisDaysPerWeek: 3, dialysisDays: ["Tuesday", "Thursday", "Saturday"],
  },
  {
    id: "P004", uhid: "KMCRI-2024-004", name: "Priya Reddy", age: 48, gender: "Female",
    mobile: "Contact via portal", address: "23, MG Road", city: "Hyderabad",
    primaryDisease: "Glomerulonephritis", causeOfFailure: "IgA Nephropathy",
    biopsyDone: true, biopsyDetails: "Mesangial IgA deposits",
    comorbidities: "Anaemia", bloodGroup: "AB+",
    dialysisStartDate: "Recently", referredBy: "Dr. Padma Lakshmi",
    treatingNephrologist: "Dr. Anita Krishnamurthy",
    viralStatus: { hepatitisB: "Negative", hepatitisC: "Negative", hiv: "Unknown", other: "None" },
    emergencyContact: "Contact via portal", insurance: "ICICI Lombard",
    remarks: "HIV status awaiting confirmation", treatmentStatus: "Active",
    registeredDate: "Recently", lastDialysis: "Recently", currentSchedule: "Slot 1 · Machine 16",
    dialysisDaysPerWeek: 3, dialysisDays: ["Monday", "Wednesday", "Friday"],
  },
  {
    id: "P005", uhid: "KMCRI-2024-005", name: "Sanjay Patel", age: 55, gender: "Male",
    mobile: "Contact via portal", address: "8, Sardar Patel Marg", city: "Ahmedabad",
    primaryDisease: "Diabetic Nephropathy", causeOfFailure: "Type 1 Diabetes",
    biopsyDone: false, biopsyDetails: "",
    comorbidities: "Peripheral Neuropathy, Retinopathy", bloodGroup: "B-",
    dialysisStartDate: "Recently", referredBy: "Dr. Harish Shah",
    treatingNephrologist: "Dr. Suresh Pillai",
    viralStatus: { hepatitisB: "Negative", hepatitisC: "Negative", hiv: "Negative", other: "None" },
    emergencyContact: "Contact via portal", insurance: "Religare",
    remarks: "Transplant evaluation in progress", treatmentStatus: "Active",
    registeredDate: "Recently", lastDialysis: "Recently", currentSchedule: "Slot 1 · Machine 08",
    dialysisDaysPerWeek: 3, dialysisDays: ["Monday", "Wednesday", "Friday"],
  },
  {
    id: "P006", uhid: "KMCRI-2024-006", name: "Anjali Sharma", age: 42, gender: "Female",
    mobile: "Contact via portal", address: "91, Civil Lines", city: "Delhi",
    primaryDisease: "Lupus Nephritis", causeOfFailure: "SLE",
    biopsyDone: true, biopsyDetails: "Class IV diffuse proliferative",
    comorbidities: "SLE, Thrombocytopenia", bloodGroup: "A-",
    dialysisStartDate: "Recently", referredBy: "Dr. Sunita Joshi",
    treatingNephrologist: "Dr. Anita Krishnamurthy",
    viralStatus: { hepatitisB: "Awaiting Report", hepatitisC: "Awaiting Report", hiv: "Negative", other: "None" },
    emergencyContact: "Contact via portal", insurance: "Max Bupa",
    remarks: "Awaiting viral panel — hold machine assignment", treatmentStatus: "Active",
    registeredDate: "Recently", lastDialysis: "Recently", currentSchedule: null,
    dialysisDaysPerWeek: 2, dialysisDays: ["Monday", "Thursday"],
  },
  {
    id: "P007", uhid: "KMCRI-2024-007", name: "Ramesh Nair", age: 61, gender: "Male",
    mobile: "Contact via portal", address: "4, Vivekananda Street", city: "Kochi",
    primaryDisease: "Obstructive Uropathy", causeOfFailure: "BPH-related obstruction",
    biopsyDone: false, biopsyDetails: "",
    comorbidities: "BPH, Hypertension", bloodGroup: "O-",
    dialysisStartDate: "Recently", referredBy: "Dr. George Thomas",
    treatingNephrologist: "Dr. Suresh Pillai",
    viralStatus: { hepatitisB: "Negative", hepatitisC: "Negative", hiv: "Negative", other: "None" },
    emergencyContact: "Contact via portal", insurance: "None",
    remarks: "Emergency admitted — waiting list patient", treatmentStatus: "Active",
    registeredDate: "Recently", lastDialysis: "Recently", currentSchedule: "Slot 1 · U2-Machine 01",
    dialysisDaysPerWeek: 2, dialysisDays: ["Monday", "Wednesday"],
  },
];

export const INITIAL_SESSIONS: DialysisSession[] = [
  { id: "S001", patientId: "P001", patientName: "Arjun Mehta",   uhid: "KMCRI-2024-001", date: "Today",    slot: "Slot 1", machine: "Machine 01",    machineId: "M01",   unit: "U1", duration: "4 hours", doctor: "Dr. Suresh Pillai",         attendance: "Completed", notes: "Session uneventful. BP stable.",   startTime: "8:00 AM", endTime: "12:00 PM", status: "Running",   slotType: "normal" },
  { id: "S002", patientId: "P002", patientName: "Lakshmi Iyer",  uhid: "KMCRI-2024-002", date: "Today",    slot: "Slot 1", machine: "Machine 28",    machineId: "M28",   unit: "U1", duration: "4 hours", doctor: "Dr. Anita Krishnamurthy",    attendance: "Completed", notes: "HBsAg+ — dedicated HBsAg machine.", startTime: "8:00 AM", endTime: "12:00 PM", status: "Running",   slotType: "normal" },
  { id: "S003", patientId: "P003", patientName: "Vikram Singh",  uhid: "KMCRI-2024-003", date: "Today",    slot: "Slot 2", machine: "Machine 23",    machineId: "M23",   unit: "U1", duration: "4 hours", doctor: "Dr. Suresh Pillai",         attendance: "Completed", notes: "HCV+ — dedicated HCV machine.",    startTime: "12:00 PM", endTime: "4:00 PM", status: "Waiting",   slotType: "normal" },
  { id: "S004", patientId: "P004", patientName: "Priya Reddy",   uhid: "KMCRI-2024-004", date: "Today",    slot: "Slot 1", machine: "Machine 16",    machineId: "M16",   unit: "U1", duration: "4 hours", doctor: "Dr. Anita Krishnamurthy",    attendance: "Completed", notes: "HIV unknown — caution.",           startTime: "8:00 AM", endTime: "12:00 PM", status: "Waiting",   slotType: "normal" },
  { id: "S005", patientId: "P005", patientName: "Sanjay Patel",  uhid: "KMCRI-2024-005", date: "Today",    slot: "Slot 1", machine: "Machine 08",    machineId: "M08",   unit: "U1", duration: "4 hours", doctor: "Dr. Suresh Pillai",         attendance: "Completed", notes: "Transplant follow-up scheduled.",  startTime: "8:00 AM", endTime: "12:00 PM", status: "Running",   slotType: "normal" },
  { id: "S006", patientId: "P007", patientName: "Ramesh Nair",   uhid: "KMCRI-2024-007", date: "Recently", slot: "Slot 3", machine: "U2-Machine 01", machineId: "U2M01", unit: "U2", duration: "4 hours", doctor: "Dr. Suresh Pillai",         attendance: "Missed",    notes: "Patient did not report.",          startTime: "4:00 PM", endTime: "8:00 PM",  status: "Completed", missedReason: "Personal reason", slotType: "normal" },
  { id: "S007", patientId: "P006", patientName: "Anjali Sharma", uhid: "KMCRI-2024-006", date: "Recently", slot: "Slot 1", machine: "Machine 06",    machineId: "M06",   unit: "U1", duration: "4 hours", doctor: "Dr. Anita Krishnamurthy",    attendance: "Completed", notes: "Viral panel awaited.",             startTime: "8:00 AM", endTime: "12:00 PM", status: "Completed", slotType: "normal" },
];

export const INITIAL_ADMIN_PRESCRIPTIONS: AdminPrescription[] = [
  {
    id: "RX001", patientId: "P001", patientName: "Arjun Mehta", patientUhid: "KMCRI-2024-001",
    diagnosis: "Chronic Kidney Disease Stage 5 — Diabetic Nephropathy",
    status: "Active", issuedDate: "Recently", updatedBy: "Dr. Suresh Pillai", updatedByRole: "Administrator",
    dialysisRx: {
      weeklySessionsCount: "3 Sessions / Week", dialysisDays: ["Monday", "Wednesday", "Friday"],
      slot: "8:00 AM – 12:00 PM", duration: "4 Hours",
      bloodFlow: "300 mL/min", dialysateFlow: "500 mL/min",
      membrane: "High flux polysulfone", dryWeight: "Target within acceptable range",
      anticoagulation: "Heparin — standard dose",
    },
    medications: [
      { name: "Erythropoietin alfa", dose: "4000 IU", frequency: "Per session (post-dialysis)", route: "SC" },
      { name: "IV Iron sucrose", dose: "100 mg", frequency: "Weekly", route: "IV" },
      { name: "Calcium carbonate", dose: "500 mg", frequency: "TID with meals", route: "PO" },
      { name: "Alfacalcidol", dose: "0.25 mcg", frequency: "Once daily", route: "PO" },
      { name: "Metoprolol succinate", dose: "50 mg", frequency: "Once daily", route: "PO" },
    ],
    notes: "Patient tolerating dialysis well. Monitor blood pressure closely.",
    history: [],
  },
  {
    id: "RX002", patientId: "P002", patientName: "Lakshmi Iyer", patientUhid: "KMCRI-2024-002",
    diagnosis: "End-Stage Renal Disease — Hypertensive Nephrosclerosis",
    status: "Active", issuedDate: "Recently", updatedBy: "Dr. Anita Krishnamurthy", updatedByRole: "Administrator",
    dialysisRx: {
      weeklySessionsCount: "3 Sessions / Week", dialysisDays: ["Monday", "Wednesday", "Friday"],
      slot: "8:00 AM – 12:00 PM", duration: "4 Hours",
      bloodFlow: "280 mL/min", dialysateFlow: "500 mL/min",
      membrane: "High flux polysulfone", dryWeight: "Target within acceptable range",
      anticoagulation: "Heparin — reduced dose (bleeding risk)",
    },
    medications: [
      { name: "Darbepoetin alfa", dose: "30 mcg", frequency: "Fortnightly", route: "SC" },
      { name: "Sevelamer", dose: "800 mg", frequency: "TID with meals", route: "PO" },
      { name: "Alfacalcidol", dose: "0.5 mcg", frequency: "3 times weekly", route: "PO" },
      { name: "Amlodipine", dose: "5 mg", frequency: "Once daily", route: "PO" },
    ],
    notes: "Phosphate control improving. Watch for hypotension during ultrafiltration.",
    history: [],
  },
  {
    id: "RX003", patientId: "P003", patientName: "Vikram Singh", patientUhid: "KMCRI-2024-003",
    diagnosis: "Polycystic Kidney Disease — CKD Stage 5",
    status: "Revised", issuedDate: "Previously", updatedBy: "Dr. Suresh Pillai", updatedByRole: "Administrator",
    dialysisRx: {
      weeklySessionsCount: "3 Sessions / Week", dialysisDays: ["Tuesday", "Thursday", "Saturday"],
      slot: "12:00 PM – 4:00 PM", duration: "4 Hours",
      bloodFlow: "260 mL/min", dialysateFlow: "500 mL/min",
      membrane: "Low flux polysulfone", dryWeight: "Target under review",
      anticoagulation: "Heparin — standard dose",
    },
    medications: [
      { name: "Erythropoietin beta", dose: "6000 IU", frequency: "Per session (post-dialysis)", route: "SC" },
      { name: "Calcium carbonate", dose: "500 mg", frequency: "TID with meals", route: "PO" },
      { name: "Pantoprazole", dose: "40 mg", frequency: "Once daily", route: "PO" },
    ],
    notes: "Blood flow reduced due to AV fistula maturation issues. Review access site at next session.",
    history: [
      {
        version: 1, updatedDate: "Previously", updatedBy: "Dr. Suresh Pillai",
        updatedByRole: "Administrator", changedFields: [], status: "Active",
        dialysisRx: {
          weeklySessionsCount: "3 Sessions / Week", dialysisDays: ["Tuesday", "Thursday", "Saturday"],
          slot: "12:00 PM – 4:00 PM", duration: "4 Hours",
          bloodFlow: "300 mL/min", dialysateFlow: "500 mL/min",
          membrane: "High flux polysulfone", dryWeight: "Target within acceptable range",
          anticoagulation: "Heparin — standard dose",
        },
        medications: [
          { name: "Erythropoietin beta", dose: "4000 IU", frequency: "Per session (post-dialysis)", route: "SC" },
          { name: "Calcium carbonate", dose: "500 mg", frequency: "TID with meals", route: "PO" },
        ],
        notes: "Initial prescription — blood flow to be reassessed after fistula maturation.",
      },
    ],
  },
];

const COMPLICATION_OPTIONS = [
  "Chills", "Cramps", "Hypotension", "Breathlessness", "Hypoglycemia",
  "Convulsions", "Bleeding Tendency", "Requiring Admission", "NIV Support",
  "Requiring Mechanical Intubation", "Death",
];

// ─── Viral Compatibility Helpers ──────────────────────────────────────────────

function getRequiredCategory(patient: Patient): string {
  if (patient.viralStatus.hepatitisB === "Positive") return "HBsAg";
  if (patient.viralStatus.hepatitisC === "Positive") return "HCV";
  if (patient.viralStatus.hiv === "Positive") return "HIV";
  return "Negative";
}

function isMachineCompatible(patient: Patient, machine: Machine): boolean {
  const req = getRequiredCategory(patient);
  if (req === "HIV") return machine.category === "HIV" || machine.category === "RVD (HIV)";
  return machine.category === req;
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateAssignment(draft: AssignmentDraft, sessions: DialysisSession[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!draft.patient || !draft.machine || !draft.date || !draft.slot) {
    return { ok: false, errors: ["Incomplete assignment details."], warnings: [] };
  }

  if (draft.patient.treatmentStatus !== "Active") {
    errors.push(`Patient is marked as "${draft.patient.treatmentStatus}" and cannot be scheduled.`);
  }

  if (draft.machine.status === "maintenance") errors.push(`${draft.machine.number} is under maintenance.`);
  if (draft.machine.status === "disabled")    errors.push(`${draft.machine.number} is disabled.`);
  if (draft.machine.status === "in-use")      errors.push(`${draft.machine.number} is currently in use.`);

  const conflict = sessions.find(s =>
    s.patientId === draft.patient!.id && s.date === draft.date &&
    s.slot === draft.slot && s.attendance !== "Cancelled"
  );
  if (conflict) errors.push(`${draft.patient.name} is already scheduled on ${draft.machine.number} for ${draft.slot} on ${draft.date}.`);

  const machineConflict = sessions.find(s =>
    s.machineId === draft.machine!.id && s.date === draft.date &&
    s.slot === draft.slot && s.attendance !== "Cancelled"
  );
  if (machineConflict) errors.push(`${draft.machine.number} already has a session for ${draft.slot} on ${draft.date}.`);

  // Viral compatibility
  if (draft.patient && draft.machine) {
    const vp = draft.patient.viralStatus;
    const awaiting = vp.hepatitisB === "Awaiting Report" || vp.hepatitisC === "Awaiting Report" || vp.hiv === "Awaiting Report";
    if (awaiting) {
      warnings.push("Viral status is awaiting report. Assign with caution.");
    } else if (!isMachineCompatible(draft.patient, draft.machine)) {
      const req = getRequiredCategory(draft.patient);
      warnings.push(`Viral compatibility mismatch. This patient requires a ${req} machine. Current: ${draft.machine.category}.`);
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

// ─── Shared UI Components ─────────────────────────────────────────────────────

function ViralBadge({ status }: { status: ViralStatusValue }) {
  const map: Record<ViralStatusValue, string> = {
    Positive: "bg-red-100 text-red-700 border-red-200",
    Negative: "bg-emerald-100 text-emerald-700 border-emerald-200",
    Unknown:  "bg-gray-100 text-gray-500 border-gray-200",
    "Awaiting Report": "bg-amber-100 text-amber-700 border-amber-200",
  };
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${map[status]}`}>{status}</span>;
}

function StatusPill({ status }: { status: MachineStatus }) {
  const map: Record<MachineStatus, { cls: string; dot: string; label: string }> = {
    available:   { cls: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500", label: "Available" },
    "in-use":    { cls: "bg-blue-100 text-blue-700",       dot: "bg-blue-500 animate-pulse", label: "In Use" },
    scheduled:   { cls: "bg-amber-100 text-amber-700",     dot: "bg-amber-500", label: "Reserved" },
    maintenance: { cls: "bg-red-100 text-red-700",         dot: "bg-red-500", label: "Maintenance" },
    disabled:    { cls: "bg-gray-100 text-gray-500",       dot: "bg-gray-400", label: "Disabled" },
  };
  const { cls, dot, label } = map[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />{label}
    </span>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const map: Record<string, string> = {
    "Negative":   "bg-slate-100 text-slate-700 border-slate-200",
    "HCV":        "bg-orange-100 text-orange-700 border-orange-200",
    "HBsAg":      "bg-yellow-100 text-yellow-800 border-yellow-200",
    "HIV":        "bg-red-100 text-red-700 border-red-200",
    "RVD (HIV)":  "bg-rose-100 text-rose-700 border-rose-200",
  };
  const cls = map[category] ?? "bg-purple-100 text-purple-700 border-purple-200";
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${cls}`}>{category}</span>;
}

function TreatmentBadge({ status }: { status: TreatmentStatus }) {
  const map: Record<TreatmentStatus, string> = {
    Active:       "bg-emerald-100 text-emerald-700",
    Transplanted: "bg-violet-100 text-violet-700",
    Expired:      "bg-gray-200 text-gray-500",
    Shifted:      "bg-blue-100 text-blue-700",
    Discontinued: "bg-red-100 text-red-700",
    "Temporarily inactive": "bg-amber-100 text-amber-700",
    Transferred: "bg-blue-100 text-blue-700",
    "Screening ended": "bg-gray-200 text-gray-500",
  };
  return <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${map[status]}`}>{status}</span>;
}

function AttendanceBadge({ status }: { status: AttendanceStatus }) {
  const map = {
    Completed: "bg-emerald-100 text-emerald-700",
    Missed:    "bg-red-100 text-red-700",
    Cancelled: "bg-gray-100 text-gray-500",
  };
  return <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${map[status]}`}>{status}</span>;
}

function SessionStatusPill({ status }: { status: SessionStatus }) {
  const map = {
    Running:   "bg-blue-100 text-blue-700",
    Waiting:   "bg-amber-100 text-amber-700",
    Called:    "bg-violet-100 text-violet-700",
    Scheduled: "bg-violet-100 text-violet-700",
    Missed:    "bg-red-100 text-red-700",
    Cancelled: "bg-slate-100 text-slate-600",
    Completed: "bg-slate-100 text-slate-600",
  };
  return <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${map[status]}`}>{status}</span>;
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h2 className="text-xl font-bold text-slate-800">{title}</h2>
      {subtitle && <p className="text-slate-500 text-sm mt-0.5">{subtitle}</p>}
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  return (
    <div className={`rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3 ${color}`}>
      <div className="shrink-0">{icon}</div>
      <div>
        <p className="text-xs text-slate-500 font-medium">{label}</p>
        <p className="text-2xl font-bold text-slate-800 leading-none mt-0.5">{value}</p>
      </div>
    </div>
  );
}

function WizardStep({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className={`flex items-center gap-2 text-sm font-medium ${active ? "text-violet-700" : done ? "text-emerald-600" : "text-slate-400"}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
        done ? "bg-emerald-100 text-emerald-700" : active ? "bg-violet-600 text-white shadow-md shadow-violet-200" : "bg-slate-100 text-slate-400"
      }`}>
        {done ? <Check className="w-3.5 h-3.5" /> : n}
      </div>
      <span className="hidden sm:block whitespace-nowrap">{label}</span>
    </div>
  );
}

// ─── Step 1: Select Patient ───────────────────────────────────────────────────

function Step1SelectPatient({ patients, selected, onSelect }: {
  patients: Patient[]; selected: Patient | null; onSelect: (p: Patient) => void;
}) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<TreatmentStatus | "All">("Active");

  const filtered = useMemo(() => patients.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.uhid.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "All" || p.treatmentStatus === filterStatus;
    return matchSearch && matchStatus;
  }), [patients, search, filterStatus]);

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-48 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Search name or UHID…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as TreatmentStatus | "All")}
          className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white">
          <option value="All">All status</option>
          {(["Active", "Transplanted", "Shifted", "Discontinued"] as TreatmentStatus[]).map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
        {filtered.map(p => {
          const isSelected = selected?.id === p.id;
          const req = getRequiredCategory(p);
          return (
            <button key={p.id} onClick={() => onSelect(p)}
              className={`w-full text-left p-4 rounded-2xl border-2 transition-all hover:shadow-md ${
                isSelected ? "border-violet-500 bg-violet-50 shadow-lg shadow-violet-100" : "border-slate-100 bg-white hover:border-violet-200"
              }`}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-bold text-slate-800">{p.name}</p>
                    <TreatmentBadge status={p.treatmentStatus} />
                    {isSelected && <span className="text-[10px] font-bold bg-violet-600 text-white px-2 py-0.5 rounded-full">Selected</span>}
                  </div>
                  <p className="text-xs text-slate-400">{p.uhid} · {p.bloodGroup} · {p.age} yrs · {p.gender}</p>
                  <p className="text-xs text-slate-500 mt-1 truncate">{p.primaryDisease}</p>
                </div>
                <div className="flex flex-col gap-1.5 items-end shrink-0">
                  <div className="flex gap-1 flex-wrap justify-end">
                    <span className="text-[9px] font-bold text-slate-400">HBsAg</span><ViralBadge status={p.viralStatus.hepatitisB} />
                    <span className="text-[9px] font-bold text-slate-400">Anti HCV</span><ViralBadge status={p.viralStatus.hepatitisC} />
                    <span className="text-[9px] font-bold text-slate-400">HIV I/II</span><ViralBadge status={p.viralStatus.hiv} />
                  </div>
                  <CategoryBadge category={req} />
                  <p className="text-[10px] text-slate-400">Last: {p.lastDialysis}</p>
                </div>
              </div>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="py-10 text-center text-slate-400 text-sm">No patients found.</div>
        )}
      </div>
    </div>
  );
}

// ─── Step 2: Select Unit ──────────────────────────────────────────────────────

function Step2SelectUnit({ units, machines, patient, selected, onSelect }: {
  units: DialysisUnit[]; machines: Machine[]; patient: Patient;
  selected: DialysisUnit | null; onSelect: (u: DialysisUnit) => void;
}) {
  const req = getRequiredCategory(patient);
  return (
    <div className="space-y-4">
      <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 flex gap-2.5 items-start">
        <Info className="w-4 h-4 text-violet-600 shrink-0 mt-0.5" />
        <p className="text-sm text-violet-800">
          Assigning for <strong>{patient.name}</strong> <span className="font-semibold">({patient.uhid})</span>.
          Required machine category: <strong>{req}</strong>.
          Select a dialysis unit to proceed.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {units.map(u => {
          const unitMachines = machines.filter(m => m.unit === u.id);
          const available    = unitMachines.filter(m => m.status === "available");
          const compatible   = available.filter(m => isMachineCompatible(patient, m));
          const inUse        = unitMachines.filter(m => m.status === "in-use").length;
          const isSelected   = selected?.id === u.id;
          const hasCompatible = compatible.length > 0;

          const cats = Array.from(new Set(unitMachines.map(m => m.category)));

          return (
            <button key={u.id} onClick={() => onSelect(u)}
              className={`text-left p-5 rounded-2xl border-2 transition-all hover:shadow-md ${
                isSelected
                  ? "border-violet-500 bg-violet-50 shadow-lg shadow-violet-100"
                  : "border-slate-100 bg-white hover:border-violet-200"
              }`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-bold text-slate-800 text-lg">{u.name}</p>
                  <p className="text-xs text-slate-400">{unitMachines.length} total machines</p>
                </div>
                {isSelected && (
                  <span className="text-[10px] font-bold bg-violet-600 text-white px-2 py-0.5 rounded-full">Selected</span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                <div className="bg-emerald-50 rounded-xl py-2">
                  <p className="text-lg font-bold text-emerald-700">{available.length}</p>
                  <p className="text-[10px] text-emerald-600">Available</p>
                </div>
                <div className="bg-blue-50 rounded-xl py-2">
                  <p className="text-lg font-bold text-blue-700">{inUse}</p>
                  <p className="text-[10px] text-blue-600">In Use</p>
                </div>
                <div className={`rounded-xl py-2 ${hasCompatible ? "bg-violet-50" : "bg-red-50"}`}>
                  <p className={`text-lg font-bold ${hasCompatible ? "text-violet-700" : "text-red-700"}`}>{compatible.length}</p>
                  <p className={`text-[10px] ${hasCompatible ? "text-violet-600" : "text-red-600"}`}>Compatible</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {cats.map(c => <CategoryBadge key={c} category={c} />)}
              </div>

              {!hasCompatible && (
                <div className="mt-3 text-xs text-amber-800 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  No compatible {req} machines available in this unit.
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Step 3: Select Machine ───────────────────────────────────────────────────

function Step3SelectMachine({ machines, patient, unit, selected, onSelect }: {
  machines: Machine[]; patient: Patient; unit: DialysisUnit;
  selected: Machine | null; onSelect: (m: Machine) => void;
}) {
  const req = getRequiredCategory(patient);
  const unitMachines = machines.filter(m => m.unit === unit.id && m.status !== "disabled");
  const isAssignable = (m: Machine) => m.status === "available" || m.status === "scheduled";

  const machineColors: Record<MachineStatus, string> = {
    available:   "border-emerald-300 bg-emerald-50/60",
    "in-use":    "border-blue-200 bg-blue-50/40 opacity-60 cursor-not-allowed",
    scheduled:   "border-amber-200 bg-amber-50/40",
    maintenance: "border-red-200 bg-red-50/40 opacity-60 cursor-not-allowed",
    disabled:    "border-gray-200 bg-gray-50/40 opacity-40 cursor-not-allowed",
  };

  const getCompatibility = (m: Machine): "match" | "warn" | "awaiting" | "ok" => {
    const vp = patient.viralStatus;
    const awaiting = vp.hepatitisB === "Awaiting Report" || vp.hepatitisC === "Awaiting Report" || vp.hiv === "Awaiting Report";
    if (awaiting) return "awaiting";
    if (isMachineCompatible(patient, m)) return "match";
    return "warn";
  };

  return (
    <div className="space-y-4">
      <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 flex gap-2.5 items-start">
        <Building2 className="w-4 h-4 text-violet-600 shrink-0 mt-0.5" />
        <p className="text-sm text-violet-800">
          Showing machines in <strong>{unit.name}</strong>. Required category: <strong>{req}</strong>.
          Only <strong>Available</strong> machines can be selected.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[440px] overflow-y-auto pr-1">
        {unitMachines.map(m => {
          const assignable = isAssignable(m);
          const isSelected = selected?.id === m.id;
          const compat = getCompatibility(m);

          return (
            <button key={m.id} onClick={() => assignable && onSelect(m)} disabled={!assignable}
              className={`text-left p-4 rounded-2xl border-2 transition-all ${
                isSelected ? "border-violet-500 shadow-lg shadow-violet-100 bg-violet-50"
                : machineColors[m.status]
              } ${assignable ? "hover:shadow-md" : ""}`}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <span className="font-bold text-slate-800 text-sm">{m.number}</span>
                  <p className="text-xs text-slate-400">{unit.name}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <StatusPill status={m.status} />
                  <CategoryBadge category={m.category} />
                  {isSelected && <span className="text-[9px] font-bold text-violet-700 bg-violet-100 px-2 py-0.5 rounded-full">Selected</span>}
                </div>
              </div>

              <div className="space-y-0.5 text-xs text-slate-600 mb-2">
                {m.currentPatient && (
                  <div className="flex gap-1.5"><span className="text-slate-400 w-16 shrink-0">Current</span><span className="font-medium">{m.currentPatient}</span></div>
                )}
                {m.nextPatient && (
                  <div className="flex gap-1.5"><span className="text-slate-400 w-16 shrink-0">Next</span><span className="font-medium">{m.nextPatient}</span></div>
                )}
                {m.nextAvailableTime && (
                  <div className="flex gap-1.5"><span className="text-slate-400 w-16 shrink-0">Available</span><span>{m.nextAvailableTime}</span></div>
                )}
              </div>

              {compat === "warn" && assignable && (
                <div className="mt-1 text-[10px] text-amber-800 bg-amber-100 px-2 py-1 rounded-lg border border-amber-200">
                  ⚠ Mismatch — patient needs {req}, machine is {m.category}
                </div>
              )}
              {compat === "match" && (
                <div className="mt-1 text-[10px] text-emerald-800 bg-emerald-100 px-2 py-1 rounded-lg border border-emerald-200 flex items-center gap-1">
                  <CheckCircle className="w-2.5 h-2.5" /> Viral match — {m.category}
                </div>
              )}
              {compat === "awaiting" && assignable && (
                <div className="mt-1 text-[10px] text-amber-800 bg-amber-100 px-2 py-1 rounded-lg border border-amber-200">
                  ⚠ Viral results awaited — assign with caution
                </div>
              )}
              {!assignable && (
                <div className="mt-1 text-[10px] text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">Not available</div>
              )}
            </button>
          );
        })}
        {unitMachines.length === 0 && (
          <div className="col-span-2 py-10 text-center text-slate-400 text-sm">No machines found in {unit.name}.</div>
        )}
      </div>
    </div>
  );
}

// ─── Step 4: Schedule ─────────────────────────────────────────────────────────

function Step4Schedule({ draft, onChange, validation, units, todayOnly = false }: {
  draft: AssignmentDraft;
  onChange: (key: keyof AssignmentDraft, value: string) => void;
  validation: ValidationResult;
  units: DialysisUnit[];
  todayOnly?: boolean;
}) {
  const inputCls = "w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white";
  const labelCls = "block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5";

  const handleNormalSlot = (display: string) => {
    const slot = SLOTS.find(s => s.display === display);
    if (!slot) return;
    onChange("slot", slot.label);
    onChange("startTime", slot.startFmt);
    onChange("endTime", slot.endFmt);
    onChange("duration", "4 hours");
  };

  const handleSlotType = (type: "normal" | "emergency") => {
    onChange("slotType", type);
    if (type === "emergency") {
      onChange("slot", "Emergency");
      onChange("startTime", "");
      onChange("endTime", "");
    } else {
      onChange("slot", "");
      onChange("startTime", "");
      onChange("endTime", "");
      onChange("emergencyTime", "");
    }
  };

  const handleEmergencyTime = (time: string) => {
    onChange("emergencyTime", time);
    onChange("startTime", time);
    onChange("slot", "Emergency");
  };

  return (
    <div className="space-y-5">
      {/* Summary strip */}
      {draft.patient && draft.machine && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {[
            { label: "Patient",  value: draft.patient.name },
            { label: "Unit",     value: draft.unit?.name ?? "—" },
            { label: "Machine",  value: draft.machine.number },
            { label: "Category", value: draft.machine.category },
          ].map(item => (
            <div key={item.label}>
              <p className="text-slate-400 font-semibold uppercase tracking-wider">{item.label}</p>
              <p className="font-bold text-slate-700 mt-0.5">{item.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Slot Type */}
      <div>
        <label className={labelCls}>Slot Type *</label>
        <div className="grid grid-cols-2 gap-3">
          {(["normal", "emergency"] as const).map(type => (
            <button key={type} type="button" onClick={() => handleSlotType(type)}
              className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left ${
                draft.slotType === type
                  ? type === "normal"
                    ? "border-violet-500 bg-violet-50 shadow-md shadow-violet-100"
                    : "border-red-500 bg-red-50 shadow-md shadow-red-100"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}>
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                draft.slotType === type
                  ? type === "normal" ? "border-violet-600" : "border-red-600"
                  : "border-slate-300"
              }`}>
                {draft.slotType === type && (
                  <div className={`w-2 h-2 rounded-full ${type === "normal" ? "bg-violet-600" : "bg-red-600"}`} />
                )}
              </div>
              <div>
                <p className="font-bold text-slate-800 text-sm capitalize">{type === "normal" ? "Normal Slot" : "Emergency Slot"}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {type === "normal" ? "One of the three standard time slots" : "Custom dialysis time outside regular hours"}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Normal slot selection */}
      {draft.slotType === "normal" && (
        <div>
          <label className={labelCls}>Normal Dialysis Slot *</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {SLOTS.map(slot => {
              const isSelected = draft.slot === slot.label;
              return (
                <button key={slot.label} type="button"
                  onClick={() => handleNormalSlot(slot.display)}
                  className={`flex flex-col items-start p-4 rounded-2xl border-2 transition-all text-left ${
                    isSelected
                      ? "border-violet-500 bg-violet-50 shadow-md shadow-violet-100"
                      : "border-slate-200 bg-white hover:border-violet-300 hover:bg-violet-50/30"
                  }`}>
                  <div className="flex items-center gap-2 mb-1">
                    {isSelected && <div className="w-3 h-3 bg-violet-600 rounded-full shrink-0" />}
                    <span className="font-bold text-slate-800 text-sm">{slot.label}</span>
                  </div>
                  <p className="text-xs text-slate-500">{slot.startFmt} – {slot.endFmt}</p>
                  <p className="text-xs text-slate-400 mt-1">4 hours</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Emergency time picker */}
      {draft.slotType === "emergency" && (
        <div>
          <label className={labelCls}>Emergency Dialysis Time *</label>
          <div className="flex items-center gap-3">
            <input type="time" className={`flex-1 px-3 py-2.5 rounded-xl border-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 bg-white ${
              draft.slotType === "emergency" && !draft.emergencyTime ? "border-red-300" : "border-slate-200"
            }`}
              value={draft.emergencyTime}
              onChange={e => handleEmergencyTime(e.target.value)} />
            {draft.emergencyTime && (
              <span className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-bold border border-red-200">
                Emergency · {draft.emergencyTime}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1.5">Enter the specific start time for this emergency dialysis session.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Date *</label>
          {todayOnly
            ? <input type="text" aria-label="Appointment date" className={inputCls} value={draft.date} readOnly />
            : <input type="date" aria-label="Appointment date" className={inputCls} value={draft.date}
                onChange={e => onChange("date", e.target.value)}
                min={localDateKey(new Date())} />}
        </div>
        <ScheduleClinicalLinks key={draft.patient?.id} patientId={draft.patient?.id} value={draft} hideTreatingDoctor={todayOnly}
          onChange={links => { for (const key of ["doctor", "doctorId", "prescriptionId"] as const) onChange(key, links[key]); }} />
      </div>

      <div>
        <label className={labelCls}>Notes</label>
        <input className={inputCls} value={draft.notes}
          onChange={e => onChange("notes", e.target.value)}
          placeholder="Optional clinical notes…" />
      </div>

      {/* Validation feedback */}
      {validation.errors.map((e, i) => (
        <div key={i} className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <p className="text-xs text-red-800">{e}</p>
        </div>
      ))}
      {validation.errors.length === 0 && validation.warnings.map((w, i) => (
        <div key={i} className="flex gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">{w}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Confirmation Dialog ──────────────────────────────────────────────────────

function ConfirmationDialog({ draft, validation, onConfirm, onCancel, isSubmitting, submissionError, todayOnly }: {
  draft: AssignmentDraft; validation: ValidationResult;
  onConfirm: () => void; onCancel: () => void;
  isSubmitting: boolean; submissionError: string | null;
  todayOnly: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md animate-fade-in">
        <div className="bg-gradient-to-r from-violet-700 to-violet-900 px-6 py-5 rounded-t-3xl">
          <h3 className="font-bold text-white text-base">Confirm Assignment</h3>
          <p className="text-violet-200 text-xs mt-0.5">Please review before finalizing</p>
        </div>
        <div className="p-6 space-y-3">
          {[
            { label: "Patient",   value: `${draft.patient?.name} (${draft.patient?.uhid})` },
            { label: "Unit",      value: draft.unit?.name ?? "—" },
            { label: "Machine",   value: `${draft.machine?.number} · ${draft.machine?.category}` },
            { label: "Slot Type", value: draft.slotType === "emergency" ? "Emergency Slot" : draft.slotType === "normal" ? "Normal Slot" : "—" },
            ...(draft.slotType === "emergency"
              ? [{ label: "Emerg. Time", value: draft.emergencyTime || "—" }]
              : [{ label: "Dialysis Slot", value: draft.slot ? `${draft.slot} · ${draft.startTime} – ${draft.endTime}` : "—" }]
            ),
            { label: "Date",      value: draft.date || "—" },
            ...(!todayOnly ? [{ label: "Doctor", value: draft.doctor || "Not assigned" }] : []),
          ].map(item => (
            <div key={item.label} className="flex justify-between text-sm">
              <span className="text-slate-500 font-medium w-24 shrink-0">{item.label}</span>
              <span className={`font-semibold text-right ${item.label === "Slot Type" && draft.slotType === "emergency" ? "text-red-600" : "text-slate-800"}`}>{item.value}</span>
            </div>
          ))}

          {validation.warnings.length > 0 && (
            <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              {validation.warnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-800 flex gap-1.5 items-start">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />{w}
                </p>
              ))}
            </div>
          )}
          {submissionError && (
            <div role="alert" className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <span>{submissionError} You can retry without creating a duplicate.</span>
            </div>
          )}
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onCancel} disabled={isSubmitting} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 font-medium disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={isSubmitting} className="flex-1 px-4 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700 shadow-lg shadow-violet-200 disabled:cursor-wait disabled:opacity-60">
            {isSubmitting ? "Saving…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Assign Patient Section (4-step wizard) ───────────────────────────────────

function AssignPatientSection({ patients, machines, units, sessions, onAssigned, prefillMachine, prefillPatientId, todayOnly = false, prefillDate }: {
  patients: Patient[]; machines: Machine[]; units: DialysisUnit[];
  sessions: DialysisSession[];
  onAssigned: (session: DialysisSession, machineId: string) => Promise<void>;
  prefillMachine?: Machine | null;
  prefillPatientId?: string | null;
  todayOnly?: boolean;
  prefillDate?: string | null;
}) {
  const assignedDate = todayOnly ? localDateKey(new Date()) : prefillDate ?? "";
  const prefillUnit = prefillMachine
    ? units.find(u => u.id === prefillMachine.unit) ?? null
    : null;

  // Patient-ID preselection is resolved asynchronously, so start on the
  // patient-safe step while the fetch is in flight.
  const [step, setStep] = useState<AssignStep>(1);
  const submissionInFlight = useRef(false);
  const [draft, setDraft] = useState<AssignmentDraft>({
    patient: null, unit: prefillUnit, machine: prefillMachine ?? null,
    slot: "", startTime: "", endTime: "", duration: "4 hours", doctor: "", notes: "", date: assignedDate,
    slotType: "", emergencyTime: "",
  });
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [prefillLoading, setPrefillLoading] = useState(Boolean(prefillPatientId));
  const [prefillError, setPrefillError] = useState<string | null>(null);

  useEffect(() => {
    if (!prefillPatientId) {
      setPrefillLoading(false);
      setPrefillError(null);
      setStep(1);
      return;
    }
    let cancelled = false;
    setPrefillLoading(true);
    setPrefillError(null);
    setDraft(d => ({ ...d, patient: null, unit: null, machine: prefillMachine ?? null, date: assignedDate }));
    setStep(1);
    fetchPatientById(prefillPatientId)
      .then(patient => {
        if (cancelled) return;
        setDraft(d => ({ ...d, patient, unit: prefillUnit, machine: prefillMachine ?? null, date: assignedDate }));
        setStep(prefillMachine ? 3 : 2);
      })
      .catch(error => {
        if (cancelled) return;
        setPrefillError(error instanceof Error ? error.message : "Patient could not be found.");
        setStep(1);
      })
      .finally(() => { if (!cancelled) setPrefillLoading(false); });
    return () => { cancelled = true; };
  // Refreshes replace directory objects, not the user's navigation intent.
  }, [prefillPatientId, prefillMachine?.id, prefillUnit?.id, assignedDate]);

  const setField = (key: keyof AssignmentDraft, value: string) =>
    setDraft(d => ({ ...d, [key]: value }));

  const validation = useMemo(() => {
    if (step !== 4 && !showConfirm) return { ok: true, errors: [], warnings: [] };
    return validateAssignment(draft, sessions);
  }, [draft, sessions, step, showConfirm]);

  const slotReady = draft.slotType === "normal" ? !!draft.slot && draft.slot !== "Emergency"
    : draft.slotType === "emergency" ? !!draft.emergencyTime
    : false;
  const canProceed: Record<number, boolean> = {
    1: !!draft.patient,
    2: !!draft.unit,
    3: !!draft.machine,
    4: !!draft.date && !!draft.slotType && slotReady && validation.errors.length === 0,
  };

  const handleConfirm = async () => {
    if (submissionInFlight.current) return;
    const newSession: DialysisSession = {
      id: `S${Date.now()}`,
      patientId: draft.patient!.id,
      patientName: draft.patient!.name,
      uhid: draft.patient!.uhid,
      date: draft.date,
      slot: draft.slot,
      machine: draft.machine!.number,
      machineId: draft.machine!.id,
      unit: draft.unit!.id,
      duration: draft.duration,
      doctor: draft.doctor || "Not assigned",
      doctorId: draft.doctorId, prescriptionId: draft.prescriptionId,
      attendance: "Completed",
      notes: draft.notes,
      startTime: draft.startTime,
      endTime: draft.endTime,
      status: "Waiting",
      slotType: draft.slotType as "normal" | "emergency",
      emergencyTime: draft.slotType === "emergency" ? draft.emergencyTime : undefined,
    };
    submissionInFlight.current = true;
    setIsSubmitting(true);
    setSubmissionError(null);
    try { await onAssigned(newSession, draft.machine!.id); setShowConfirm(false); setStep("success"); }
    catch (error) { setSubmissionError(error instanceof Error ? error.message : "Assignment could not be saved. Check your connection and try again."); }
    finally { submissionInFlight.current = false; setIsSubmitting(false); }
  };

  if (step === "success") {
    return (
      <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-5 shadow-lg shadow-emerald-100">
          <CheckCircle className="w-10 h-10 text-emerald-600" />
        </div>
        <h3 className="text-2xl font-bold text-slate-800 mb-2">Assignment Confirmed</h3>
        <p className="text-slate-500 text-sm mb-1">{draft.patient?.name} assigned to {draft.machine?.number} ({draft.unit?.name})</p>
        <p className="text-slate-400 text-sm mb-1">{draft.date} · {draft.slotType === "emergency" ? `Emergency · ${draft.emergencyTime}` : `${draft.slot} · ${draft.startTime} – ${draft.endTime}`}</p>
        {draft.slotType === "emergency" && <span className="px-2.5 py-0.5 mb-6 bg-red-100 text-red-700 border border-red-200 rounded-full text-xs font-bold">Emergency Slot</span>}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm text-slate-600 max-w-sm w-full space-y-1.5 mb-8">
          <p>✓ Machine status updated to Scheduled</p>
          <p>✓ Session added to daily schedule</p>
          <p>✓ Patient dialysis history updated</p>
          <p>✓ Dashboard reflects new assignment</p>
        </div>
        <button onClick={() => {
          setDraft({ patient: null, unit: null, machine: null, slot: "", startTime: "", endTime: "", duration: "4 hours", doctor: "", notes: "", date: assignedDate, slotType: "", emergencyTime: "" });
          setStep(1);
        }} className="px-6 py-2.5 bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-colors font-semibold">
          New Assignment
        </button>
      </div>
    );
  }

  const steps: { n: AssignStep; label: string }[] = [
    { n: 1, label: "Patient" },
    { n: 2, label: "Unit" },
    { n: 3, label: "Machine" },
    { n: 4, label: "Schedule" },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeader title="Assign Patient to Machine" subtitle="Four-step workflow with viral compatibility validation" />

      {/* Wizard progress bar */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-2 overflow-x-auto">
        {steps.map(({ n, label }, i) => (
          <div key={n} className="flex items-center gap-2 shrink-0">
            <WizardStep
              n={n as number}
              label={label}
              active={step === n}
              done={typeof step === "number" && step > (n as number)}
            />
            {i < steps.length - 1 && <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        {prefillLoading && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5 text-sm text-violet-700">
            <RefreshCw className="h-4 w-4 animate-spin" /> Loading the selected patient…
          </div>
        )}
        {prefillError && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{prefillError} Search for a patient below to choose one manually.</span>
          </div>
        )}
        {step === 1 && (
          <>
            <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-violet-600 text-white rounded-full text-xs flex items-center justify-center font-bold">1</span>
              Select Patient
            </h3>
            <Step1SelectPatient patients={patients} selected={draft.patient}
              onSelect={p => setDraft(d => ({ ...d, prescriptionId: p.id === d.patient?.id ? d.prescriptionId : "", patient: p, unit: d.machine ? d.unit : null, machine: d.machine }))} />
          </>
        )}
        {step === 2 && draft.patient && (
          <>
            <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-violet-600 text-white rounded-full text-xs flex items-center justify-center font-bold">2</span>
              Select Dialysis Unit
            </h3>
            <Step2SelectUnit units={units} machines={machines} patient={draft.patient!}
              selected={draft.unit}
              onSelect={u => setDraft(d => ({ ...d, unit: u, machine: null }))} />
          </>
        )}
        {step === 3 && draft.patient && draft.unit && (
          <>
            <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-violet-600 text-white rounded-full text-xs flex items-center justify-center font-bold">3</span>
              Select Machine — {draft.unit?.name}
            </h3>
            <Step3SelectMachine machines={machines} patient={draft.patient!} unit={draft.unit!}
              selected={draft.machine} onSelect={m => setDraft(d => ({ ...d, machine: m }))} />
          </>
        )}
        {((step === 2 && !draft.patient) || (step === 3 && (!draft.patient || !draft.unit))) && (
          <>
            <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-violet-600 text-white rounded-full text-xs flex items-center justify-center font-bold">1</span>
              Select Patient
            </h3>
            <Step1SelectPatient patients={patients} selected={draft.patient}
              onSelect={p => setDraft(d => ({ ...d, prescriptionId: p.id === d.patient?.id ? d.prescriptionId : "", patient: p, unit: d.machine ? d.unit : null, machine: d.machine }))} />
          </>
        )}
        {step === 4 && (
          <>
            <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-violet-600 text-white rounded-full text-xs flex items-center justify-center font-bold">4</span>
              Schedule & Confirm
            </h3>
            <Step4Schedule draft={draft} onChange={setField} validation={validation} units={units} todayOnly={todayOnly} />
          </>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setStep(s => (typeof s === "number" && s > 1 ? (s - 1) as AssignStep : s))}
          disabled={step === 1}
          className="flex items-center gap-2 px-5 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-0 transition-all font-medium">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        {typeof step === "number" && step < 4 && (
          <button
            onClick={() => setStep(s => (typeof s === "number" ? (s + 1) as AssignStep : s))}
            disabled={!canProceed[step as number]}
            className="flex items-center gap-2 px-6 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-violet-100">
            Continue <ArrowRight className="w-4 h-4" />
          </button>
        )}

        {step === 4 && (
          <button onClick={() => setShowConfirm(true)} disabled={!canProceed[4]}
            className="flex items-center gap-2 px-6 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-violet-100">
            <CalendarPlus className="w-4 h-4" /> Assign Patient
          </button>
        )}
      </div>

      {showConfirm && (
        <ConfirmationDialog draft={draft} validation={validation}
          onConfirm={handleConfirm} onCancel={() => { if (!isSubmitting) setShowConfirm(false); }}
          isSubmitting={isSubmitting} submissionError={submissionError} todayOnly={todayOnly} />
      )}
    </div>
  );
}

// ─── Quick Assign Modal ───────────────────────────────────────────────────────

function QuickAssignModal({ machine, patients, sessions, onAssigned, onClose }: {
  machine: Machine; patients: Patient[]; sessions: DialysisSession[];
  onAssigned: (session: DialysisSession, machineId: string) => Promise<void>;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [date, setDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [clinicalLinks, setClinicalLinks] = useState<ScheduleLinks>({ doctor: "", doctorId: "", prescriptionId: "" });
  const [notes, setNotes] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const filtered = patients.filter(p =>
    p.treatmentStatus === "Active" &&
    (!search || p.name.toLowerCase().includes(search.toLowerCase()) || p.uhid.toLowerCase().includes(search.toLowerCase()))
  );

  const slot = SLOTS.find(s => s.label === selectedSlot);

  const draft: AssignmentDraft = {
    patient: selectedPatient, unit: null, machine,
    slot: selectedSlot, startTime: slot?.startFmt ?? "", endTime: slot?.endFmt ?? "",
    duration: "4 hours", doctor: clinicalLinks.doctor, notes, date,
  };
  const validation = selectedPatient && date && selectedSlot
    ? validateAssignment(draft, sessions)
    : { ok: true, errors: [], warnings: [] };

  const canConfirm = !!selectedPatient && !!date && !!selectedSlot && validation.errors.length === 0;

  const handleConfirm = async () => {
    const newSession: DialysisSession = {
      id: `S${Date.now()}`, patientId: selectedPatient!.id,
      patientName: selectedPatient!.name, uhid: selectedPatient!.uhid,
      date, slot: selectedSlot, machine: machine.number, machineId: machine.id,
      unit: machine.unit, duration: "4 hours",
      doctor: clinicalLinks.doctor || "Not assigned", doctorId: clinicalLinks.doctorId,
      prescriptionId: clinicalLinks.prescriptionId, attendance: "Completed", notes,
      startTime: slot?.startFmt ?? "—", endTime: slot?.endFmt ?? "—", status: "Waiting",
    };
    try { await onAssigned(newSession, machine.id); setConfirmed(true); }
    catch (error) { window.alert(error instanceof Error ? error.message : "Assignment could not be saved."); }
  };

  const inputCls = "w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg animate-fade-in overflow-hidden max-h-[90vh] flex flex-col">
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-5 flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-bold text-white text-base">Quick Assign — {machine.number}</h3>
            <p className="text-slate-400 text-xs mt-0.5">
              {machine.unit === "U1" ? "Unit 1" : "Unit 2"} · <CategoryBadge category={machine.category} />
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
            <X className="w-5 h-5 text-slate-300" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6">
          {confirmed ? (
            <div className="flex flex-col items-center py-8 animate-fade-in">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-8 h-8 text-emerald-600" />
              </div>
              <h4 className="text-lg font-bold text-slate-800 mb-1">Assignment Successful</h4>
              <p className="text-slate-500 text-sm">{selectedPatient?.name} → {machine.number}</p>
              <p className="text-slate-400 text-sm">{date} · {selectedSlot}</p>
              <button onClick={onClose} className="mt-6 px-6 py-2.5 bg-violet-600 text-white rounded-xl font-semibold hover:bg-violet-700">Done</button>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Select Patient</p>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="text" placeholder="Name or UHID…" value={search}
                    onChange={e => { setSearch(e.target.value); setSelectedPatient(null); }}
                    className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
                </div>
                <div className="max-h-44 overflow-y-auto space-y-1.5 border border-slate-100 rounded-xl p-2">
                  {filtered.slice(0, 10).map(p => (
                    <button key={p.id} onClick={() => { setSelectedPatient(p); setClinicalLinks(d => ({ ...d, prescriptionId: p.id === selectedPatient?.id ? d.prescriptionId : "" })); }}
                      className={`w-full text-left px-3 py-2.5 rounded-lg transition-all text-sm ${selectedPatient?.id === p.id ? "bg-violet-50 border-2 border-violet-400" : "hover:bg-slate-50 border-2 border-transparent"}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-slate-800">{p.name}</span>
                          <span className="text-xs text-slate-400 ml-2">{p.uhid}</span>
                        </div>
                        <CategoryBadge category={getRequiredCategory(p)} />
                      </div>
                    </button>
                  ))}
                  {filtered.length === 0 && <p className="text-xs text-slate-400 text-center py-4">No active patients found</p>}
                </div>
              </div>

              {/* Slot selection */}
              <div>
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Select Slot *</p>
                <div className="grid grid-cols-3 gap-2">
                  {SLOTS.map(s => (
                    <button key={s.label} type="button" onClick={() => setSelectedSlot(s.label)}
                      className={`text-left p-3 rounded-xl border-2 transition-all ${
                        selectedSlot === s.label ? "border-violet-500 bg-violet-50" : "border-slate-200 hover:border-violet-300"
                      }`}>
                      <p className="font-bold text-slate-800 text-xs">{s.label}</p>
                      <p className="text-[10px] text-slate-500">{s.startFmt}–{s.endFmt}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Date *</label>
                  <input type="date" className={inputCls} value={date}
                    onChange={e => setDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]} />
                </div>
                <div>
                  <ScheduleClinicalLinks key={selectedPatient?.id} patientId={selectedPatient?.id}
                    value={clinicalLinks} onChange={setClinicalLinks} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Notes</label>
                <input className={inputCls} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional…" />
              </div>

              {validation.errors.map((e, i) => (
                <div key={i} className="flex gap-2 p-2.5 bg-red-50 border border-red-200 rounded-xl">
                  <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-800">{e}</p>
                </div>
              ))}
              {validation.errors.length === 0 && validation.warnings.map((w, i) => (
                <div key={i} className="flex gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800">{w}</p>
                </div>
              ))}

              <div className="flex gap-3 pt-2">
                <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 font-medium">Cancel</button>
                <button onClick={handleConfirm} disabled={!canConfirm}
                  className="flex-1 px-4 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed">
                  Confirm Assignment
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Machine Form Modal (Add / Edit) ─────────────────────────────────────────

function MachineFormModal({ mode, machine, units, categories, onSave, onClose }: {
  mode: "add" | "edit";
  machine?: Machine;
  units: DialysisUnit[];
  categories: MachineTypeConfig[];
  onSave: (m: Machine) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Machine>(machine ?? {
    id: `M${Date.now()}`, number: "", unit: units[0]?.id ?? "U1",
    category: "Negative", name: "", status: "available",
    currentPatient: null, nextPatient: null, nextAvailableTime: null,
    lastMaintenance: "Recently", notes: "",
  });

  const set = (k: keyof Machine, v: string) => setForm(f => ({ ...f, [k]: v }));
  const inputCls = "w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white";
  const labelCls = "block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5";

  const isValid = form.number.trim().length > 0;
  const [saveError, setSaveError] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md animate-fade-in overflow-hidden max-h-[90vh] flex flex-col">
        <div className="bg-gradient-to-r from-violet-700 to-violet-900 px-6 py-5 flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-bold text-white">{mode === "add" ? "Add New Machine" : "Edit Machine"}</h3>
            <p className="text-violet-200 text-xs mt-0.5">{mode === "add" ? "Configure a new dialysis machine" : `Editing ${machine?.number}`}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl"><X className="w-5 h-5 text-white" /></button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          <div>
            <label className={labelCls}>Machine Number *</label>
            <input className={inputCls} value={form.number} onChange={e => set("number", e.target.value)}
              placeholder="e.g. Machine 30, U2-Machine 08…" />
          </div>
          <div>
            <label className={labelCls}>Machine Name</label>
            <input className={inputCls} value={form.name} onChange={e => set("name", e.target.value)}
              placeholder="Optional display name…" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Unit *</label>
              <select className={inputCls} value={form.unit} onChange={e => set("unit", e.target.value)}>
                {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Category *</label>
              <select className={inputCls} value={form.category} onChange={e => set("category", e.target.value)}>
                {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Status</label>
            <select className={inputCls} value={form.status} onChange={e => set("status", e.target.value as MachineStatus)}>
              <option value="available">Available</option>
              <option value="maintenance">Under Maintenance</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Notes</label>
            <textarea className={inputCls + " resize-none"} rows={2} value={form.notes}
              onChange={e => set("notes", e.target.value)} placeholder="Maintenance notes or special instructions…" />
          </div>
        </div>

        <div className="flex gap-3 p-6 pt-0 shrink-0">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 font-medium">Cancel</button>
          <button onClick={async () => { if (!isValid) return; try { setSaveError(null); await onSave(form); } catch (error) { setSaveError(error instanceof Error ? error.message : "Machine could not be saved."); } }} disabled={!isValid}
            className="flex-1 px-4 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700 disabled:opacity-40 shadow-lg shadow-violet-100">
            {mode === "add" ? "Add Machine" : "Save Changes"}
          </button>
          {saveError && <p className="absolute bottom-2 left-6 text-xs text-red-600">{saveError}</p>}
        </div>
      </div>
    </div>
  );
}

// ─── Add Category Modal ───────────────────────────────────────────────────────

function AddCategoryModal({ onAdd, onClose }: { onAdd: (cat: MachineTypeConfig) => void; onClose: () => void }) {
  const [label, setLabel] = useState("");
  const isValid = label.trim().length >= 2;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm animate-fade-in">
        <div className="bg-gradient-to-r from-violet-700 to-violet-900 px-6 py-5 flex items-center justify-between rounded-t-3xl">
          <div>
            <h3 className="font-bold text-white">Add Machine Category</h3>
            <p className="text-violet-200 text-xs mt-0.5">New categories are immediately available during assignment</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl"><X className="w-5 h-5 text-white" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Category Name *</label>
            <input value={label} onChange={e => setLabel(e.target.value)}
              placeholder="e.g. Isolation, Pediatric, Emergency…"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white" />
          </div>
          <p className="text-xs text-slate-400">Once added, this category will appear in machine assignment, machine management, and all filters throughout the portal.</p>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 font-medium">Cancel</button>
            <button onClick={() => isValid && onAdd({ id: label.trim(), label: label.trim() })} disabled={!isValid}
              className="flex-1 px-4 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700 disabled:opacity-40">
              Add Category
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Machine Section ──────────────────────────────────────────────────────────

function MachineSection({ machines: initialMachines, patients, sessions, units, onNavigate }: {
  machines: Machine[]; patients: Patient[]; sessions: DialysisSession[];
  units: DialysisUnit[];
  onNavigate: (section: NavSection, label: string, opts?: { machine?: Machine }) => void;
}) {
  const [machines, setMachines] = useState(initialMachines);
  const [customCategories, setCustomCategories] = useState<MachineTypeConfig[]>([]);
  const allCategories = useMemo(() => [...BASE_CATEGORIES, ...customCategories], [customCategories]);

  useEffect(() => {
    setMachines(initialMachines);
  }, [initialMachines]);

  const [filterUnit, setFilterUnit] = useState("All");
  const [filterCat, setFilterCat] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterAvailable, setFilterAvailable] = useState(false);

  const [showAddMachine, setShowAddMachine] = useState(false);
  const [editMachine, setEditMachine] = useState<Machine | null>(null);
  const [showAddCategory, setShowAddCategory] = useState(false);

  const filtered = useMemo(() => machines.filter(m => {
    if (filterUnit !== "All" && m.unit !== filterUnit) return false;
    if (filterCat !== "All" && m.category !== filterCat) return false;
    if (filterStatus !== "All" && m.status !== filterStatus) return false;
    if (filterAvailable && m.status !== "available") return false;
    return true;
  }), [machines, filterUnit, filterCat, filterStatus, filterAvailable]);

  const updateStatus = async (id: string, status: MachineStatus) => {
    try {
      await updateMachine(id, { status });
      setMachines(prev => prev.map(m => m.id === id ? { ...m, status } : m));
    } catch {
      window.alert("Machine status could not be saved. Please try again.");
    }
  };

  const handleSaveMachine = async (m: Machine) => {
    const existing = machines.some(x => x.id === m.id);
    if (existing) {
      try { await updateMachine(m.id, { status: m.status, name: m.name, notes: m.notes }); }
      catch { throw new Error("Machine changes could not be saved. Please try again."); }
    } else {
      if (!m.unit || !m.number.trim() || !m.category || !(m.name || m.number).trim()) throw new Error("Unit, machine number, category, and name are required.");
      const created = await createMachine({ unitId: m.unit, code: m.number.trim(), name: (m.name || m.number).trim(), category: m.category, status: m.status, notes: m.notes });
      m = { ...m, id: String(created.machine.id), name: String(created.machine.name || m.name || m.number), number: String(created.machine.code || m.number) };
    }
    setMachines(prev => {
      const idx = prev.findIndex(x => x.id === m.id);
      if (idx >= 0) {
        const copy = [...prev]; copy[idx] = m; return copy;
      }
      return [...prev, m];
    });
    setShowAddMachine(false);
    setEditMachine(null);
  };

  const machineColors: Record<MachineStatus, string> = {
    available:   "border-emerald-200 bg-emerald-50/60",
    "in-use":    "border-blue-200 bg-blue-50/40",
    scheduled:   "border-amber-200 bg-amber-50/40",
    maintenance: "border-red-200 bg-red-50/40",
    disabled:    "border-gray-200 bg-gray-50/40 opacity-60",
  };

  const unitName = (id: string) => units.find(u => u.id === id)?.name ?? id;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <SectionHeader title="Machine Management" subtitle="Monitor, control, and manage all dialysis machines across all units" />
        <div className="flex gap-2">
          <button onClick={() => setShowAddCategory(true)}
            className="flex items-center gap-1.5 px-4 py-2 border border-violet-300 text-violet-700 rounded-xl text-sm font-semibold hover:bg-violet-50 transition-colors">
            <Tag className="w-3.5 h-3.5" /> Add Category
          </button>
          <button onClick={() => setShowAddMachine(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700 transition-colors shadow-md shadow-violet-200">
            <Plus className="w-4 h-4" /> Add Machine
          </button>
        </div>
      </div>

      {/* Unit stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {units.map(u => {
          const um = machines.filter(m => m.unit === u.id);
          return (
            <div key={u.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{u.name}</p>
              <p className="text-2xl font-bold text-slate-800">{um.length}</p>
              <p className="text-[10px] text-slate-400">Total machines</p>
              <div className="flex gap-1.5 mt-2">
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                  {um.filter(m => m.status === "available").length} avail
                </span>
                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                  {um.filter(m => m.status === "in-use").length} in use
                </span>
              </div>
            </div>
          );
        })}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Maintenance</p>
          <p className="text-2xl font-bold text-red-600">{machines.filter(m => m.status === "maintenance").length}</p>
          <p className="text-[10px] text-slate-400">Across all units</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total</p>
          <p className="text-2xl font-bold text-slate-800">{machines.length}</p>
          <p className="text-[10px] text-slate-400">All machines</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select value={filterUnit} onChange={e => setFilterUnit(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white">
            <option value="All">All Units</option>
            {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white">
            <option value="All">All Categories</option>
            {allCategories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white">
            <option value="All">All Status</option>
            <option value="available">Available</option>
            <option value="in-use">In Use</option>
            <option value="scheduled">Reserved</option>
            <option value="maintenance">Maintenance</option>
            <option value="disabled">Disabled</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer ml-1">
            <input type="checkbox" checked={filterAvailable} onChange={e => setFilterAvailable(e.target.checked)}
              className="rounded border-slate-300 text-violet-600 focus:ring-violet-300" />
            Available only
          </label>
          <span className="ml-auto text-xs text-slate-400">{filtered.length} machine{filtered.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* Machine cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(m => (
          <div key={m.id} className={`rounded-2xl border-2 p-5 space-y-3 card-hover transition-all ${machineColors[m.status]}`}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-slate-800">{m.number}</h3>
                <p className="text-xs text-slate-500">{unitName(m.unit)}</p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <StatusPill status={m.status} />
                <CategoryBadge category={m.category} />
              </div>
            </div>

            <div className="space-y-1 text-xs text-slate-600">
              <div className="flex gap-1.5"><span className="text-slate-400 w-20 shrink-0">Current</span><span className="font-medium truncate">{m.currentPatient || "—"}</span></div>
              <div className="flex gap-1.5"><span className="text-slate-400 w-20 shrink-0">Next</span><span className="font-medium truncate">{m.nextPatient || "—"}</span></div>
              {m.nextAvailableTime && <div className="flex gap-1.5"><span className="text-slate-400 w-20 shrink-0">Available</span><span>{m.nextAvailableTime}</span></div>}
              <div className="flex gap-1.5"><span className="text-slate-400 w-20 shrink-0">Last service</span><span>{m.lastMaintenance}</span></div>
            </div>

            {m.notes && (
              <p className="text-[10px] text-amber-700 bg-amber-50 px-2 py-1.5 rounded-lg border border-amber-100 truncate">{m.notes}</p>
            )}

            {m.status === "available" && (
              <button onClick={() => onNavigate("assign-patient", "Assign Patient", { machine: m })}
                className="w-full flex items-center justify-center gap-1.5 text-xs px-3 py-2 bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-colors font-semibold">
                <CalendarPlus className="w-3.5 h-3.5" /> Assign Patient
              </button>
            )}

            <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-100/80">
              <button onClick={() => setEditMachine(m)}
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors">
                <Edit3 className="w-3 h-3" /> Edit
              </button>
              {m.status !== "available" && m.status !== "in-use" && (
                <button onClick={() => updateStatus(m.id, "available")}
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
                  <Power className="w-3 h-3" /> Enable
                </button>
              )}
              {m.status !== "maintenance" && m.status !== "disabled" && m.status !== "in-use" && (
                <button onClick={() => updateStatus(m.id, "maintenance")}
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700">
                  <Wrench className="w-3 h-3" /> Maint.
                </button>
              )}
              {m.status !== "disabled" && m.status !== "in-use" && (
                <button onClick={() => updateStatus(m.id, "disabled")}
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-gray-500 text-white rounded-lg hover:bg-gray-600">
                  <PowerOff className="w-3 h-3" /> Disable
                </button>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full py-14 text-center bg-white rounded-2xl border border-slate-100 shadow-sm">
            <Cpu className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No machines match the current filters.</p>
          </div>
        )}
      </div>

      {/* Status count row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {(["available", "in-use", "scheduled", "maintenance", "disabled"] as MachineStatus[]).map(s => (
          <div key={s} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 text-center">
            <p className="text-2xl font-bold text-slate-800">{machines.filter(m => m.status === s).length}</p>
            <div className="mt-1.5 flex justify-center"><StatusPill status={s} /></div>
          </div>
        ))}
      </div>

      {/* Custom categories display */}
      {customCategories.length > 0 && (
        <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4">
          <p className="text-xs font-bold text-violet-700 uppercase tracking-wider mb-2 flex items-center gap-2">
            <Tag className="w-3.5 h-3.5" /> Custom Categories Added
          </p>
          <div className="flex flex-wrap gap-2">
            {customCategories.map(c => <CategoryBadge key={c.id} category={c.label} />)}
          </div>
        </div>
      )}

      {/* Modals */}
      {showAddMachine && (
        <MachineFormModal mode="add" units={units} categories={allCategories}
          onSave={handleSaveMachine} onClose={() => setShowAddMachine(false)} />
      )}
      {editMachine && (
        <MachineFormModal mode="edit" machine={editMachine} units={units} categories={allCategories}
          onSave={handleSaveMachine} onClose={() => setEditMachine(null)} />
      )}
      {showAddCategory && (
        <AddCategoryModal
          onAdd={cat => { setCustomCategories(p => [...p, cat]); setShowAddCategory(false); }}
          onClose={() => setShowAddCategory(false)} />
      )}
    </div>
  );
}

// ─── Dashboard Section ────────────────────────────────────────────────────────

const WEEK_DAYS_FULL = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

function DashboardPatientDetailsDialog({ patient, session, units, machines, sessions, selectedDate, todayDate, onAssign, onUpdate, onClose }: {
  patient: Patient;
  session?: DialysisSession;
  units: DialysisUnit[];
  machines: Machine[];
  sessions: DialysisSession[];
  selectedDate: string;
  todayDate: string;
  onAssign: (todayOnly: boolean) => void;
  onUpdate: (id: string, payload: SessionUpdatePayload) => Promise<void>;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"details" | "reschedule" | "cancel">("details");
  const [unitId, setUnitId] = useState(session?.unit ?? "");
  const [machineId, setMachineId] = useState(session?.machineId ?? "");
  const [slot, setSlot] = useState(SLOTS.some(item => item.label === session?.slot) ? session!.slot : SLOTS[0].label);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const assigned = Boolean(session);
  const canManageAppointment = Boolean(session && session.date === todayDate &&
    ["Scheduled","Waiting","Called"].includes(session.status));
  const statusMap: Record<SessionStatus, SessionUpdatePayload["status"]> = {
    Scheduled: "scheduled", Waiting: "waiting", Called: "called", Running: "running",
    Completed: "completed", Missed: "missed", Cancelled: "cancelled",
  };
  const selectedSlot = SLOTS.find(item => item.label === slot);
  const eligibleMachines = useMemo(() => machines.filter(machine =>
    machine.unit === unitId &&
    ["available","scheduled","in-use"].includes(machine.status) &&
    isMachineCompatible(patient, machine) &&
    !sessions.some(existing =>
      existing.id !== session?.id &&
      existing.machineId === machine.id &&
      existing.date === todayDate &&
      existing.slot === slot &&
      !["Cancelled","Missed"].includes(existing.status)
    )
  ), [machines, unitId, patient, sessions, session?.id, todayDate, slot]);
  const patientConflict = sessions.some(existing =>
    existing.id !== session?.id &&
    existing.patientId === patient.id &&
    existing.date === todayDate &&
    existing.slot === slot &&
    !["Cancelled","Missed"].includes(existing.status)
  );
  const selectedMachineAvailable = eligibleMachines.some(machine => machine.id === machineId);
  const hasRescheduleChanges = Boolean(session && (
    machineId !== session.machineId || unitId !== session.unit ||
    slot !== session.slot || session.date !== todayDate
  ));

  const saveReschedule = async () => {
    if (!session || !selectedSlot || !canManageAppointment || !selectedMachineAvailable || patientConflict || saving) return;
    setSaving(true); setError(null);
    try {
      await onUpdate(session.id, {
        status: statusMap[session.status],
        machineId,
        unitId,
        date: todayDate,
        slot,
        slotType: "normal",
        emergencyTime: "",
        startTime: selectedSlot.startFmt,
        endTime: selectedSlot.endFmt,
        duration: "4 hours",
      });
      setMode("details");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The appointment could not be rescheduled. Please try again.");
    } finally { setSaving(false); }
  };

  const cancelAppointment = async () => {
    if (!session || !canManageAppointment || saving) return;
    setSaving(true); setError(null);
    try {
      await onUpdate(session.id, { status: "cancelled" });
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The appointment could not be cancelled. Please try again.");
    } finally { setSaving(false); }
  };

  const selectedUnitName = units.find(unit => unit.id === (session?.unit ?? ""))?.name ?? session?.unit ?? "—";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="dashboard-patient-dialog-title"
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 rounded-t-3xl bg-gradient-to-r from-violet-700 to-violet-900 px-6 py-5 text-white">
          <div>
            <h3 id="dashboard-patient-dialog-title" className="text-lg font-bold">
              {mode === "reschedule" ? "Reschedule Appointment" : mode === "cancel" ? "Cancel Appointment" : "Patient Appointment Details"}
            </h3>
            <p className="mt-1 text-sm text-violet-100">{patient.name}</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close patient details"
            className="rounded-lg p-2 text-violet-100 hover:bg-white/10 disabled:opacity-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-6">
          {mode === "details" && (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Patient ID</p>
                  <p className="mt-1 break-all text-sm font-semibold text-slate-800">{patient.uhid}</p>
                  <p className="mt-1 break-all text-[10px] text-slate-400">Record: {patient.id}</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Appointment date</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">{session?.date ?? selectedDate}</p>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-100 p-3">
                <span className="text-sm font-semibold text-slate-700">Assignment status</span>
                <span className={`rounded-full border px-3 py-1 text-xs font-bold ${
                  assigned ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-600"
                }`}>{assigned ? "Assigned" : "Unassigned"}</span>
              </div>
              {session && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {[
                    ["Unit", selectedUnitName],
                    ["Machine", session.machine],
                    ["Time slot", session.slotType === "emergency"
                      ? `Emergency · ${session.emergencyTime || session.startTime}`
                      : `${session.slot} · ${session.startTime} – ${session.endTime}`],
                    ["Session status", session.status],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-slate-100 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">{value || "—"}</p>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={onClose}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Close</button>
                {!assigned && patient.treatmentStatus === "Active" && (
                  <button type="button" onClick={() => onAssign(selectedDate === todayDate)}
                    className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-700">
                    {selectedDate === todayDate ? "Assign Today" : "Assign for Selected Date"}
                  </button>
                )}
                {canManageAppointment && (
                  <>
                    <button type="button" onClick={() => { setError(null); setMode("cancel"); }}
                      className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-bold text-red-700 hover:bg-red-50">Cancel Appointment</button>
                    <button type="button" onClick={() => {
                      setUnitId(session?.unit ?? "");
                      setMachineId(session?.machineId ?? "");
                      setSlot(SLOTS.some(item => item.label === session?.slot) ? session!.slot : SLOTS[0].label);
                      setError(null); setMode("reschedule");
                    }} className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-700">
                      Reschedule Appointment
                    </button>
                  </>
                )}
                {session && !canManageAppointment && (
                  <p className="self-center text-xs text-slate-500">This session has started, ended, or is not scheduled for today.</p>
                )}
              </div>
            </>
          )}

          {mode === "reschedule" && session && (
            <>
              <p className="text-sm text-slate-600">Change the unit, compatible machine, or time slot. The existing appointment record will be updated.</p>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Appointment date
                <input aria-label="Reschedule date" type="text" value={todayDate} readOnly
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700" />
              </label>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Dialysis unit
                <select aria-label="Reschedule unit" value={unitId} onChange={event => { setUnitId(event.target.value); setMachineId(""); }}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
                  {units.map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
                </select>
              </label>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Dialysis machine
                <select aria-label="Reschedule machine" value={machineId} onChange={event => setMachineId(event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
                  <option value="">Select an available compatible machine</option>
                  {eligibleMachines.map(machine => (
                    <option key={machine.id} value={machine.id}>{machine.number} · {machine.category}</option>
                  ))}
                </select>
                {eligibleMachines.length === 0 && <span className="mt-1 block text-xs text-red-700">No compatible machine is available for this slot in the selected unit.</span>}
              </label>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Time slot
                <select aria-label="Reschedule time slot" value={slot} onChange={event => setSlot(event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
                  {SLOTS.map(item => <option key={item.label} value={item.label}>{item.label} · {item.startFmt}–{item.endFmt}</option>)}
                </select>
              </label>
              {patientConflict && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">This patient already has an appointment in that slot today.</p>}
              {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" disabled={saving} onClick={() => { setError(null); setMode("details"); }}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 disabled:opacity-50">Back</button>
                <button type="button" disabled={saving || !selectedMachineAvailable || patientConflict || !hasRescheduleChanges}
                  onClick={saveReschedule} className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50">
                  {saving ? "Saving…" : "Save Reschedule"}
                </button>
              </div>
            </>
          )}

          {mode === "cancel" && session && (
            <>
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                Are you sure you want to cancel this dialysis appointment for {patient.name}? The appointment record will be retained for history.
              </p>
              {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" disabled={saving} onClick={() => { setError(null); setMode("details"); }}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 disabled:opacity-50">Cancel</button>
                <button type="button" disabled={saving} onClick={cancelAppointment}
                  className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-wait disabled:opacity-60">
                  {saving ? "Cancelling…" : "Confirm Cancellation"}
                </button>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function DashboardSection({ patients, machines, sessions, units, onNavigate, onAssignToday, onUpdateSession }: {
  patients: Patient[]; machines: Machine[]; sessions: DialysisSession[];
  units: DialysisUnit[];
  onNavigate: (section: NavSection, label: string, opts?: { machine?: Machine; patientId?: string; todayOnly?: boolean; date?: string }) => void;
  onAssignToday: (patientId: string) => void;
  onUpdateSession: (id: string, payload: SessionUpdatePayload) => Promise<void>;
}) {
  const todayDate = localDateKey(new Date());
  const [selectedDate, setSelectedDate] = useState(todayDate);
  const [openedPatientId, setOpenedPatientId] = useState<string | null>(null);
  const openedPatient = patients.find(patient => patient.id === openedPatientId) ?? null;

  const viewDay = WEEK_DAYS_FULL[new Date(selectedDate + "T12:00:00").getDay()];
  const isToday = selectedDate === todayDate;

  // Patients scheduled for the selected day (active only, has dialysisDays set)
  const scheduledPatients = useMemo(() =>
    patients.filter(p =>
      p.treatmentStatus === "Active" &&
      p.dialysisDays.includes(viewDay)
    ),
    [patients, viewDay]
  );

  // Persisted sessions use YYYY-MM-DD; "Today" is retained only for demo records.
  // Match the date selected in this list so a saved assignment remains visible.
  const todaySessionMap = useMemo(() => {
    const map: Record<string, DialysisSession> = {};
    sessions
      .filter(s =>
        (s.date === selectedDate || (isToday && s.date === "Today")) &&
        !["Cancelled","Missed"].includes(s.status)
      )
      .forEach(s => { map[s.patientId] = s; });
    return map;
  }, [sessions, selectedDate, isToday]);

  const activePatients  = patients.filter(p => p.treatmentStatus === "Active");
  const todaySessions   = sessions.filter(s =>
    (s.date === todayDate || s.date === "Today") && !["Cancelled", "Missed"].includes(s.status)
  );
  const runningNow      = sessions.filter(s => s.status === "Running");
  const availableMachines = machines.filter(m => m.status === "available");
  const maintenanceMachines = machines.filter(m => m.status === "maintenance" || m.status === "disabled");
  const emergencyPatients = patients.filter(p => p.remarks.toLowerCase().includes("emergency"));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <SectionHeader title="Administrator Dashboard" subtitle="KMC-RI Dialysis Management System — Overview" />
        <button onClick={() => onNavigate("assign-patient", "Assign Patient")}
          className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700 transition-colors shadow-lg shadow-violet-200">
          <CalendarPlus className="w-4 h-4" /> Assign Patient
        </button>
      </div>

      {/* Overall stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<HeartPulse className="w-6 h-6 text-blue-600" />}   label="On Dialysis Now"     value={runningNow.length}       color="bg-blue-50" />
        <StatCard icon={<Calendar className="w-6 h-6 text-violet-600" />}   label="Scheduled Today"     value={todaySessions.length}    color="bg-violet-50" />
        <StatCard icon={<Cpu className="w-6 h-6 text-emerald-600" />}       label="Available Machines"  value={availableMachines.length} color="bg-emerald-50" />
        <StatCard icon={<Wrench className="w-6 h-6 text-red-600" />}        label="Maintenance/Disabled" value={maintenanceMachines.length} color="bg-red-50" />
        <StatCard icon={<CalendarPlus className="w-6 h-6 text-amber-600" />} label="Empty Slots"        value={availableMachines.length} color="bg-amber-50" />
        <StatCard icon={<Users className="w-6 h-6 text-indigo-600" />}      label="Active Patients"     value={activePatients.length}   color="bg-indigo-50" />
        <StatCard icon={<AlertTriangle className="w-6 h-6 text-orange-600" />} label="Emergency Waiting" value={emergencyPatients.length} color="bg-orange-50" />
        <StatCard icon={<ClipboardList className="w-6 h-6 text-teal-600" />} label="Total Patients"     value={patients.length}         color="bg-teal-50" />
      </div>

      {/* Unit-wise breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {units.map(u => {
          const um = machines.filter(m => m.unit === u.id);
          const us = sessions.filter(s =>
            s.unit === u.id && (s.date === todayDate || s.date === "Today") &&
            !["Cancelled", "Missed"].includes(s.status)
          );
          const uAvail  = um.filter(m => m.status === "available").length;
          const uInUse  = um.filter(m => m.status === "in-use").length;
          const uMaint  = um.filter(m => m.status === "maintenance").length;
          const util    = um.length > 0 ? Math.round((uInUse / um.length) * 100) : 0;
          const cats    = Array.from(new Set(um.map(m => m.category)));
          return (
            <div key={u.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-violet-600" />
                  <h3 className="font-bold text-slate-800">{u.name}</h3>
                  <span className="text-xs text-slate-400">{um.length} machines</span>
                </div>
                <span className="text-xs font-bold text-violet-700 bg-violet-50 px-2.5 py-1 rounded-full border border-violet-200">
                  {util}% utilised
                </span>
              </div>

              {/* Utilisation bar */}
              <div className="w-full bg-slate-100 rounded-full h-2 mb-3">
                <div className={`h-2 rounded-full transition-all ${util > 80 ? "bg-red-500" : util > 50 ? "bg-amber-400" : "bg-emerald-500"}`}
                  style={{ width: `${util}%` }} />
              </div>

              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="bg-emerald-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-emerald-700">{uAvail}</p>
                  <p className="text-[10px] text-emerald-600">Available</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-blue-700">{uInUse}</p>
                  <p className="text-[10px] text-blue-600">In Use</p>
                </div>
                <div className="bg-red-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-red-700">{uMaint}</p>
                  <p className="text-[10px] text-red-600">Maint.</p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-1">
                  {cats.map(c => <CategoryBadge key={c} category={c} />)}
                </div>
                <span className="text-xs text-slate-500">{us.length} sessions today</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Today's Dialysis Patients */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-violet-600" />
              <h3 className="font-semibold text-slate-800">
                Today's Dialysis Patients
                <span className="ml-2 text-xs font-normal text-slate-400">({viewDay}{isToday ? " · Today" : ""})</span>
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white"
              />
              {!isToday && (
                <button onClick={() => setSelectedDate(todayDate)}
                  className="px-3 py-1.5 text-xs bg-violet-50 text-violet-700 border border-violet-200 rounded-lg hover:bg-violet-100 font-medium">
                  Jump to Today
                </button>
              )}
              <span className="text-xs font-semibold bg-violet-600 text-white px-2.5 py-1 rounded-full">
                {scheduledPatients.length} patient{scheduledPatients.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>

        {scheduledPatients.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <Calendar className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No dialysis patients scheduled for {isToday ? "today" : viewDay}.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {scheduledPatients.map(patient => {
              const session = todaySessionMap[patient.id];
              const status: SessionStatus = session?.status ?? "Scheduled";
              const slotLabel = session ? (
                session.slotType === "emergency"
                  ? `Emergency @ ${session.emergencyTime || session.startTime}`
                  : `${session.slot} · ${session.startTime} – ${session.endTime}`
              ) : "No appointment assigned";
              const machineName = session?.machine ?? "—";
              const unitName = session ? (units.find(u => u.id === session.unit)?.name ?? session.unit) : "—";

              return (
                <div key={patient.id} className="px-6 py-4 hover:bg-slate-50/60 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                        status === "Running"   ? "bg-blue-100" :
                        status === "Waiting"   ? "bg-amber-100" :
                        status === "Completed" ? "bg-emerald-100" :
                        "bg-slate-100"
                      }`}>
                        <HeartPulse className={`w-4 h-4 ${
                          status === "Running"   ? "text-blue-600" :
                          status === "Waiting"   ? "text-amber-600" :
                          status === "Completed" ? "text-emerald-600" :
                          "text-slate-400"
                        }`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => setOpenedPatientId(patient.id)}
                            className="font-bold text-slate-800 hover:text-violet-700 hover:underline text-left"
                          >
                            {patient.name}
                          </button>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                            session ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-600"
                          }`}>{session ? "Assigned" : "Unassigned"}</span>
                          <span className="text-xs text-slate-400">{patient.uhid}</span>
                          {session?.slotType === "emergency" && (
                            <span className="px-1.5 py-0.5 bg-red-100 text-red-700 border border-red-200 rounded-full text-[9px] font-bold">Emergency</span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500 mt-0.5">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{slotLabel}</span>
                          <span className="flex items-center gap-1"><Cpu className="w-3 h-3" />{machineName}</span>
                          <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{unitName}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {session && <SessionStatusPill status={status} />}
                      {!session && patient.treatmentStatus === "Active" && (
                        <button
                          onClick={() => isToday
                            ? onAssignToday(patient.id)
                            : onNavigate("assign-patient", "Assign Patient", { patientId: patient.id, date: selectedDate })}
                          className="px-3 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-bold hover:bg-violet-700">
                          {isToday ? "Assign" : "Assign for Date"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {openedPatient && (
        <DashboardPatientDetailsDialog
          patient={openedPatient}
          session={todaySessionMap[openedPatient.id]}
          units={units}
          machines={machines}
          sessions={sessions}
          selectedDate={selectedDate}
          todayDate={todayDate}
          onAssign={todayOnly => {
            setOpenedPatientId(null);
            if (todayOnly) onAssignToday(openedPatient.id);
            else onNavigate("assign-patient", "Assign Patient", { patientId: openedPatient.id, date: selectedDate });
          }}
          onUpdate={onUpdateSession}
          onClose={() => setOpenedPatientId(null)}
        />
      )}

      {/* Live schedule table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-slate-800">Live Dialysis Schedule — Today</h3>
          </div>
          <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                <th className="text-left px-6 py-3">Machine</th>
                <th className="text-left px-6 py-3">Unit</th>
                <th className="text-left px-6 py-3">Patient</th>
                <th className="text-left px-6 py-3">Slot</th>
                <th className="text-left px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {todaySessions.map(s => (
                <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-700">{s.machine}</td>
                  <td className="px-6 py-4 text-xs text-slate-500">{units.find(u => u.id === s.unit)?.name ?? s.unit}</td>
                  <td className="px-6 py-4">
                    <p className="font-medium text-slate-800">{s.patientName}</p>
                    <p className="text-xs text-slate-400">{s.uhid}</p>
                  </td>
                  <td className="px-6 py-4 text-xs">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {s.slotType === "emergency"
                        ? <span className="px-2 py-0.5 bg-red-100 text-red-700 border border-red-200 rounded-full font-bold text-[10px]">Emergency</span>
                        : <span className="px-2 py-0.5 bg-violet-100 text-violet-700 border border-violet-200 rounded-full font-bold text-[10px]">Normal</span>}
                      <span className="text-slate-500">
                        {s.slotType === "emergency" ? `@ ${s.emergencyTime || s.startTime}` : `${s.slot} · ${s.startTime}–${s.endTime}`}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4"><SessionStatusPill status={s.status} /></td>
                </tr>
              ))}
              {todaySessions.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-10 text-center text-slate-400 text-sm">No sessions scheduled for today.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Machine overview grid */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2"><Cpu className="w-5 h-5 text-slate-600" /> Machine Overview</h3>
          <button onClick={() => onNavigate("machines", "Machines")} className="text-xs text-violet-600 hover:underline font-medium flex items-center gap-1">Manage all <ChevronRight className="w-3 h-3" /></button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {machines.slice(0, 10).map(m => (
            <div key={m.id} className="border border-slate-100 rounded-xl p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 text-xs">{m.number}</span>
              </div>
              <CategoryBadge category={m.category} />
              <StatusPill status={m.status} />
              <p className="text-[10px] text-slate-400 truncate">{m.currentPatient || "—"}</p>
            </div>
          ))}
          {machines.length > 10 && (
            <button onClick={() => onNavigate("machines", "Machines")}
              className="border border-dashed border-slate-200 rounded-xl p-3 flex flex-col items-center justify-center gap-1 text-slate-400 hover:border-violet-300 hover:text-violet-600 transition-colors">
              <Plus className="w-4 h-4" />
              <span className="text-[10px] font-medium">+{machines.length - 10} more</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Patient History Section ──────────────────────────────────────────────────

function PatientHistorySection({ sessions, prescriptions }: { sessions: DialysisSession[]; prescriptions: AdminPrescription[] }) {
  const [search, setSearch] = useState("");
  const [filterAttendance, setFilterAttendance] = useState<AttendanceStatus | "All">("All");
  const [histTab, setHistTab] = useState<"sessions" | "prescriptions">("sessions");
  const [expandedHx, setExpandedHx] = useState<string | null>(null);

  const filtered = useMemo(() => sessions.filter(s => {
    const matchSearch = !search || s.patientName.toLowerCase().includes(search.toLowerCase()) || s.uhid.toLowerCase().includes(search.toLowerCase());
    const matchAtt = filterAttendance === "All" || s.attendance === filterAttendance;
    return matchSearch && matchAtt;
  }), [sessions, search, filterAttendance]);

  const filteredRx = prescriptions.filter(rx =>
    !search || rx.patientName.toLowerCase().includes(search.toLowerCase()) || rx.patientUhid.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionHeader title="Patient History" subtitle="Session records and prescription history across all patients" />

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        <button onClick={() => setHistTab("sessions")} className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${histTab === "sessions" ? "bg-white text-violet-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>Session History</button>
        <button onClick={() => setHistTab("prescriptions")} className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 ${histTab === "prescriptions" ? "bg-white text-violet-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
          <ScrollText className="w-3.5 h-3.5" /> Prescription History
        </button>
      </div>

      {/* Search */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-48 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Search patient or UHID…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white" />
        </div>
        {histTab === "sessions" && (["All", "Completed", "Missed", "Cancelled"] as const).map(s => (
          <button key={s} onClick={() => setFilterAttendance(s)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${filterAttendance === s ? "bg-violet-600 text-white border-violet-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>{s}</button>
        ))}
      </div>

      {/* Session history tab */}
      {histTab === "sessions" && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                  <th className="text-left px-5 py-3">Patient</th>
                  <th className="text-left px-5 py-3">Machine / Unit</th>
                  <th className="text-left px-5 py-3">Slot</th>
                  <th className="text-left px-5 py-3">Date</th>
                  <th className="text-left px-5 py-3">Doctor</th>
                  <th className="text-left px-5 py-3">Attendance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4"><p className="font-medium text-slate-800">{s.patientName}</p><p className="text-xs text-slate-400">{s.uhid}</p></td>
                    <td className="px-5 py-4"><p className="font-medium text-slate-700 text-xs">{s.machine}</p><p className="text-[10px] text-slate-400">Unit {s.unit === "U1" ? "1" : "2"}</p></td>
                    <td className="px-5 py-4 text-xs text-slate-600">
                      <div className="flex items-center gap-1 mb-0.5">
                        {s.slotType === "emergency"
                          ? <span className="px-1.5 py-0.5 bg-red-100 text-red-700 border border-red-200 rounded-full font-bold text-[9px]">Emergency</span>
                          : <span className="px-1.5 py-0.5 bg-violet-100 text-violet-700 border border-violet-200 rounded-full font-bold text-[9px]">Normal</span>}
                        <span>{s.slotType === "emergency" ? "Emergency" : s.slot}</span>
                      </div>
                      <p className="text-[10px] text-slate-400">{s.slotType === "emergency" ? `@ ${s.emergencyTime || s.startTime}` : `${s.startTime} – ${s.endTime}`}</p>
                    </td>
                    <td className="px-5 py-4 text-slate-600 text-xs">{s.date}</td>
                    <td className="px-5 py-4 text-xs text-slate-600">{s.doctor}</td>
                    <td className="px-5 py-4"><AttendanceBadge status={s.attendance} /></td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-400 text-sm">No sessions found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Prescription history tab */}
      {histTab === "prescriptions" && (
        <div className="space-y-4">
          {filteredRx.map(rx => {
            const isExp = expandedHx === rx.id;
            const allVersions = [
              { label: "Current Prescription", updatedDate: rx.issuedDate, updatedAt: rx.lastUpdatedAt, updatedBy: rx.updatedBy, updatedByRole: rx.updatedByRole, changedFields: [] as string[], status: rx.status, dialysisRx: rx.dialysisRx, medications: rx.medications, notes: rx.notes, isCurrent: true },
              ...rx.history.map((h, i) => ({ label: `Version ${h.version}`, updatedDate: h.updatedDate, updatedAt: h.updatedAt, updatedBy: h.updatedBy, updatedByRole: h.updatedByRole, changedFields: h.changedFields ?? [], status: h.status, dialysisRx: h.dialysisRx, medications: h.medications, notes: h.notes, isCurrent: false })),
            ];
            return (
              <div key={rx.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <button className="w-full text-left p-5 hover:bg-slate-50 transition-colors" onClick={() => setExpandedHx(isExp ? null : rx.id)}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-800">{rx.patientName}</p>
                      <p className="text-xs text-slate-400">{rx.patientUhid} · {rx.updatedBy}</p>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{rx.diagnosis}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-slate-400">{allVersions.length} version{allVersions.length > 1 ? "s" : ""}</span>
                      {isExp ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                  </div>
                </button>
                {isExp && (
                  <div className="border-t border-slate-100 p-5 space-y-3">
                    {allVersions.map((v, vi) => (
                      <div key={vi} className={`rounded-xl border overflow-hidden ${v.isCurrent ? "border-violet-200" : "border-slate-200"}`}>
                        <div className={`px-4 py-2.5 flex items-center justify-between ${v.isCurrent ? "bg-violet-50" : "bg-slate-50"}`}>
                          <div>
                            <p className={`text-xs font-bold ${v.isCurrent ? "text-violet-700" : "text-slate-700"}`}>{v.label}</p>
                            <p className="text-[10px] text-slate-400">
                              {v.updatedAt ? formatRxTimestamp(v.updatedAt) : v.updatedDate} · {v.updatedBy}
                              {v.updatedByRole && <span className={`ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${v.updatedByRole === "Doctor" ? "bg-violet-100 text-violet-600" : "bg-blue-100 text-blue-600"}`}>{v.updatedByRole}</span>}
                            </p>
                            {!v.isCurrent && v.changedFields.length > 0 && (
                              <p className="text-[10px] text-slate-400 mt-0.5">Changed: {v.changedFields.join(", ")}</p>
                            )}
                          </div>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${v.status === "Active" ? "bg-emerald-100 text-emerald-700 border-emerald-200" : v.status === "Revised" ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-red-100 text-red-700 border-red-200"}`}>{v.status}</span>
                        </div>
                        <div className="px-4 py-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                          <div><p className="text-slate-400 font-semibold">Sessions/Week</p><p className="text-slate-700">{v.dialysisRx.weeklySessionsCount}</p></div>
                          <div><p className="text-slate-400 font-semibold">Days</p><p className="text-slate-700">{v.dialysisRx.dialysisDays.join(", ")}</p></div>
                          <div><p className="text-slate-400 font-semibold">Blood Flow</p><p className="text-slate-700">{v.dialysisRx.bloodFlow}</p></div>
                          <div><p className="text-slate-400 font-semibold">Membrane</p><p className="text-slate-700">{v.dialysisRx.membrane}</p></div>
                        </div>
                        {v.medications.length > 0 && (
                          <div className="px-4 pb-3 border-t border-slate-100">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-2 mb-1.5">Medications ({v.medications.length})</p>
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead><tr className="text-slate-400 font-semibold uppercase tracking-wider">
                                  <th className="text-left pr-3 py-1">Medication</th>
                                  <th className="text-left pr-3 py-1">Dose</th>
                                  <th className="text-left pr-3 py-1">Frequency</th>
                                  <th className="text-left py-1">Route</th>
                                </tr></thead>
                                <tbody>
                                  {v.medications.map((m, mi) => (
                                    <tr key={mi} className="border-t border-slate-50">
                                      <td className="pr-3 py-1 font-medium text-slate-700">{m.name}</td>
                                      <td className="pr-3 py-1 text-slate-600">{m.dose}</td>
                                      <td className="pr-3 py-1 text-slate-600">{m.frequency}</td>
                                      <td className="py-1"><span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${m.route === "IV" ? "bg-red-100 text-red-700" : m.route === "SC" ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-600"}`}>{m.route}</span></td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                        {v.notes && <div className="px-4 pb-3 text-xs text-slate-500 italic border-t border-slate-100 pt-2">"{v.notes}"</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {filteredRx.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
              <ScrollText className="w-10 h-10 text-slate-200 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">No prescription history found.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Search Section ───────────────────────────────────────────────────────────

function SearchSection({ patients, sessions, onNavigate, onAssignPatient }: {
  patients: Patient[]; sessions: DialysisSession[];
  onNavigate: (s: NavSection, l: string, o?: { machine?: Machine }) => void;
  onAssignPatient: (p: Patient) => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Patient | null>(null);

  const results = useMemo(() => query.length < 2 ? [] : patients.filter(p =>
    p.name.toLowerCase().includes(query.toLowerCase()) ||
    p.uhid.toLowerCase().includes(query.toLowerCase()) ||
    p.city.toLowerCase().includes(query.toLowerCase())
  ), [patients, query]);

  const patientSessions = selected ? sessions.filter(s => s.patientId === selected.id) : [];

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionHeader title="Search Patients" subtitle="Find any registered patient by name, UHID, or city" />

      <div className="relative max-w-xl">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input type="text" value={query} onChange={e => { setQuery(e.target.value); setSelected(null); }}
          placeholder="Search name, UHID, city…"
          className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white shadow-sm" />
      </div>

      {results.length > 0 && !selected && (
        <div className="space-y-2">
          {results.map(p => (
            <button key={p.id} onClick={() => setSelected(p)}
              className="w-full text-left p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-violet-200 hover:shadow-md transition-all">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-bold text-slate-800">{p.name}</p>
                  <p className="text-xs text-slate-400">{p.uhid} · {p.city} · {p.bloodGroup}</p>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">{p.primaryDisease}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <TreatmentBadge status={p.treatmentStatus} />
                  <CategoryBadge category={getRequiredCategory(p)} />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-800">{selected.name}</h3>
                <p className="text-slate-400 text-sm">{selected.uhid} · {selected.city}</p>
              </div>
              <div className="flex gap-2">
                <TreatmentBadge status={selected.treatmentStatus} />
                <button onClick={() => setSelected(null)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4 text-slate-400" /></button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              {[
                { label: "Blood Group",   value: selected.bloodGroup },
                { label: "Age",           value: `${selected.age} yrs` },
                { label: "Doctor",        value: selected.treatingNephrologist },
                { label: "Last Dialysis", value: selected.lastDialysis },
              ].map(item => (
                <div key={item.label} className="bg-slate-50 rounded-xl px-3 py-2">
                  <p className="text-slate-400 font-semibold">{item.label}</p>
                  <p className="text-slate-700 font-medium mt-0.5">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="text-[10px] text-slate-400">HBsAg</span><ViralBadge status={selected.viralStatus.hepatitisB} />
              <span className="text-[10px] text-slate-400">Anti HCV</span><ViralBadge status={selected.viralStatus.hepatitisC} />
              <span className="text-[10px] text-slate-400">HIV I/II</span><ViralBadge status={selected.viralStatus.hiv} />
            </div>

            {selected.remarks && (
              <p className="mt-3 text-xs text-amber-800 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">{selected.remarks}</p>
            )}

            {selected.treatmentStatus === "Active" && (
              <button onClick={() => onAssignPatient(selected)}
                className="mt-4 flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700">
                <CalendarPlus className="w-4 h-4" /> Assign to Machine
              </button>
            )}
          </div>

          {patientSessions.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h4 className="font-semibold text-slate-800">Session History ({patientSessions.length})</h4>
              </div>
              <div className="divide-y divide-slate-50">
                {patientSessions.map(s => (
                  <div key={s.id} className="flex items-center justify-between px-5 py-3 text-sm">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="font-medium text-slate-700">{s.machine}</p>
                        {s.slotType === "emergency"
                          ? <span className="px-1.5 py-0.5 bg-red-100 text-red-700 border border-red-200 rounded-full font-bold text-[9px]">Emergency</span>
                          : <span className="px-1.5 py-0.5 bg-violet-100 text-violet-700 border border-violet-200 rounded-full font-bold text-[9px]">Normal</span>}
                      </div>
                      <p className="text-xs text-slate-400">
                        {s.date} · {s.slotType === "emergency" ? `@ ${s.emergencyTime || s.startTime}` : `${s.slot} · ${s.startTime}–${s.endTime}`}
                      </p>
                    </div>
                    <AttendanceBadge status={s.attendance} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {query.length >= 2 && results.length === 0 && !selected && (
        <div className="py-12 text-center bg-white rounded-2xl border border-slate-100 shadow-sm">
          <Search className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No patients found for "{query}"</p>
        </div>
      )}
    </div>
  );
}

// ─── Live Schedule Section ────────────────────────────────────────────────────

function LiveScheduleSection({ sessions, units, onUpdateSession, onRecordOutcome }: {
  sessions: DialysisSession[];
  units: DialysisUnit[];
  onUpdateSession: (id: string, updates: Partial<DialysisSession>) => Promise<void>;
  onRecordOutcome: (id: string, status: "Missed" | "Cancelled", reason?: string) => Promise<void>;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftVitals, setDraftVitals] = useState({ bp: "", heartRate: "" });
  const [draftComplications, setDraftComplications] = useState<string[]>([]);
  const [draftNote, setDraftNote] = useState("");
  const [missedReasonDraft, setMissedReasonDraft] = useState("");
  const [statusSaving, setStatusSaving] = useState(false);
  const [savingOutcome, setSavingOutcome] = useState<"Missed" | "Cancelled" | null>(null);
  const [complicOpen, setComplicOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const [selectedDate, setSelectedDate] = useState(today);
  const dateSessions = sessions.filter(s =>
    s.date === selectedDate || (selectedDate === today && s.date === "Today")
  );
  const scheduled = dateSessions.filter(s => s.status === "Scheduled");
  const running   = dateSessions.filter(s => s.status === "Running");
  const waiting   = dateSessions.filter(s => s.status === "Waiting");
  const called    = dateSessions.filter(s => s.status === "Called");
  const completed = dateSessions.filter(s => s.status === "Completed");
  const missed    = dateSessions.filter(s => s.status === "Missed");
  const cancelled = dateSessions.filter(s => s.status === "Cancelled");
  const selected  = dateSessions.find(s => s.id === selectedId) ?? null;
  const canEdit   = selected !== null;

  const openSession = (s: DialysisSession) => {
    setSelectedId(s.id);
    setDraftVitals(s.vitals ?? { bp: "", heartRate: "" });
    setDraftComplications(s.complications ?? []);
    setDraftNote(s.importantNote ?? "");
    setMissedReasonDraft(s.missedReason ?? "");
    setSaved(false);
    setComplicOpen(false);
  };

  const handleSave = async () => {
    if (!selectedId) return;
    try {
      setSaved(false); setSessionError(null);
      await onUpdateSession(selectedId, { vitals: draftVitals, complications: draftComplications, importantNote: draftNote });
      setSaved(true);
    } catch(e) { setSessionError(e instanceof Error?e.message:"Session data could not be saved."); }
  };

  const toggleComplication = (opt: string) => {
    setSaved(false);
    setDraftComplications(prev => prev.includes(opt) ? prev.filter(x => x !== opt) : [...prev, opt]);
  };

  const handleRecordOutcome = async (status: "Missed" | "Cancelled") => {
    if (!selectedId || savingOutcome) return;
    setSavingOutcome(status);
    try {
      await onRecordOutcome(selectedId, status, status === "Missed" ? missedReasonDraft.trim() || undefined : undefined);
      setMissedReasonDraft("");
      setSessionError(null);
    } catch(e) {
      setSessionError(e instanceof Error?e.message:"Session outcome could not be saved.");
    } finally {
      setSavingOutcome(null);
    }
  };

  const renderCard = (s: DialysisSession) => {
    const unitName = units.find(u => u.id === s.unit)?.name ?? s.unit;
    const isSel = s.id === selectedId;
    return (
      <button key={s.id} onClick={() => openSession(s)}
        className={`w-full text-left p-4 rounded-2xl border transition-all ${isSel ? "border-violet-400 bg-violet-50 shadow-md" : "border-slate-100 bg-white hover:border-violet-200 hover:shadow-sm"}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
              <p className="font-bold text-slate-800 text-sm">{s.patientName}</p>
              {s.slotType === "emergency" && (
                <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[9px] font-bold rounded-full border border-red-200">Emergency</span>
              )}
            </div>
            <p className="text-xs text-slate-400">{s.uhid}</p>
            <p className="text-xs text-slate-500 mt-0.5">{unitName} · {s.machine} · {s.slot}</p>
          </div>
          <SessionStatusPill status={s.status} />
        </div>
        {(s.vitals?.bp || s.vitals?.heartRate || (s.complications?.length ?? 0) > 0) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {s.vitals?.bp && <span className="bg-blue-50 border border-blue-100 text-blue-600 text-[10px] px-1.5 py-0.5 rounded font-semibold">BP: {s.vitals.bp}</span>}
            {s.vitals?.heartRate && <span className="bg-emerald-50 border border-emerald-100 text-emerald-600 text-[10px] px-1.5 py-0.5 rounded font-semibold">HR: {s.vitals.heartRate}</span>}
            {(s.complications?.length ?? 0) > 0 && <span className="bg-amber-50 border border-amber-100 text-amber-600 text-[10px] px-1.5 py-0.5 rounded font-semibold">{s.complications!.length} complication{s.complications!.length > 1 ? "s" : ""}</span>}
          </div>
        )}
      </button>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionHeader title="Live Dialysis Schedule" subtitle="Choose a date to view sessions, record outcomes, or enter session details" />
      {sessionError && <p role="alert" className="text-sm text-red-600">{sessionError}</p>}
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-2xl border border-slate-100 p-4">
        <label htmlFor="schedule-date" className="text-sm font-semibold text-slate-700">Schedule date</label>
        <input
          id="schedule-date"
          type="date"
          value={selectedDate}
          onChange={event => {
            setSelectedDate(event.target.value);
            setSelectedId(null);
          }}
          className="px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white"
        />
        {selectedDate === today && (
          <span className="text-xs font-semibold text-violet-700 bg-violet-50 px-2.5 py-1 rounded-full">Today</span>
        )}
      </div>
      <div className="grid lg:grid-cols-5 gap-6">
        {/* Card list */}
        <div className="lg:col-span-2 space-y-5">
          {dateSessions.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
              <Activity className="w-10 h-10 text-slate-200 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">No sessions scheduled for this date.</p>
            </div>
          )}
          {running.length > 0 && (
            <div>
              <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse inline-block" /> Running ({running.length})
              </p>
              <div className="space-y-2">{running.map(renderCard)}</div>
            </div>
          )}
          {scheduled.length > 0 && (
            <div>
              <p className="text-xs font-bold text-violet-600 uppercase tracking-wider mb-2">Scheduled ({scheduled.length})</p>
              <div className="space-y-2">{scheduled.map(renderCard)}</div>
            </div>
          )}
          {waiting.length > 0 && (
            <div>
              <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-2">Waiting ({waiting.length})</p>
              <div className="space-y-2">{waiting.map(renderCard)}</div>
            </div>
          )}
          {called.length > 0 && (
            <div>
              <p className="text-xs font-bold text-violet-600 uppercase tracking-wider mb-2">Called ({called.length})</p>
              <div className="space-y-2">{called.map(renderCard)}</div>
            </div>
          )}
          {completed.length > 0 && (
            <div>
              <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-2">Completed ({completed.length})</p>
              <div className="space-y-2">{completed.map(renderCard)}</div>
            </div>
          )}
          {missed.length > 0 && (
            <div>
              <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2">Missed ({missed.length})</p>
              <div className="space-y-2">{missed.map(renderCard)}</div>
            </div>
          )}
          {cancelled.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Cancelled ({cancelled.length})</p>
              <div className="space-y-2">{cancelled.map(renderCard)}</div>
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div className="lg:col-span-3">
          {!selected ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-12 flex flex-col items-center justify-center text-center min-h-64">
              <ClipboardList className="w-12 h-12 text-slate-200 mb-3" />
              <p className="text-slate-400 font-medium">Select a patient card</p>
              <p className="text-slate-300 text-sm mt-1">Click any session on the left to view details, enter vitals, or add notes.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-violet-600 to-violet-800 px-6 py-5 text-white">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold">{selected.patientName}</h3>
                    <p className="text-violet-200 text-sm">{selected.uhid}</p>
                  </div>
                  <SessionStatusPill status={selected.status} />
                </div>
              </div>
              <div className="p-6 space-y-6">
                {["Scheduled", "Waiting", "Called"].includes(selected.status) && (
                  <button type="button" disabled={statusSaving} onClick={async () => {
                    try {
                      setSessionError(null); setStatusSaving(true);
                      await onUpdateSession(selected.id, { status: selected.status === "Called" ? "Running" : "Called" });
                    } catch (error) { setSessionError(error instanceof Error ? error.message : "Session status could not be saved."); }
                    finally { setStatusSaving(false); }
                  }} className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold">
                    {selected.status === "Called" ? "Start Treatment" : "Call Patient"}
                  </button>
                )}
                {/* Patient info */}
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Patient Information</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { label: "Dialysis Unit", value: units.find(u => u.id === selected.unit)?.name ?? selected.unit },
                      { label: "Machine", value: selected.machine },
                      { label: "Time Slot", value: selected.slotType === "emergency" ? `Emergency @ ${selected.emergencyTime || selected.startTime}` : selected.slot },
                      { label: "Time", value: `${selected.startTime} – ${selected.endTime}` },
                      { label: "Doctor", value: selected.doctor },
                      { label: "Duration", value: selected.duration },
                    ].map(item => (
                      <div key={item.label} className="bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{item.label}</p>
                        <p className="text-sm font-semibold text-slate-700 mt-0.5 truncate">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {selected.status === "Missed" && (
                  <div className="border-t border-slate-100 pt-5">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Missed Session Reason</h4>
                    {selected.missedReason ? (
                      <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                        {selected.missedReason === "Other" && selected.missedReasonOther
                          ? `Other: ${selected.missedReasonOther}`
                          : selected.missedReason}
                      </p>
                    ) : (
                      <p className="text-sm text-slate-400 italic">No reason was recorded.</p>
                    )}
                  </div>
                )}

                {(["Scheduled", "Waiting", "Called"].includes(selected.status)) && (
                  <div className="border-t border-slate-100 pt-5">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Record Session Outcome</h4>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5" htmlFor="missed-session-reason">
                      Reason for missed session <span className="font-normal text-slate-400">(optional)</span>
                    </label>
                    <textarea id="missed-session-reason" value={missedReasonDraft}
                      onChange={e => setMissedReasonDraft(e.target.value)}
                      placeholder="Add a reason if known…" rows={2}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white resize-none" />
                    <div className="flex flex-wrap gap-2 mt-3">
                      <button type="button" disabled={savingOutcome !== null}
                        onClick={() => void handleRecordOutcome("Missed")}
                        className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 text-white rounded-xl hover:bg-amber-700 disabled:opacity-50 text-sm font-bold">
                        <AlertCircle className="w-4 h-4" /> {savingOutcome === "Missed" ? "Saving…" : "Mark as Missed"}
                      </button>
                      <button type="button" disabled={savingOutcome !== null}
                        onClick={() => void handleRecordOutcome("Cancelled")}
                        className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 disabled:opacity-50 text-sm font-bold">
                        <Ban className="w-4 h-4" /> {savingOutcome === "Cancelled" ? "Saving…" : "Cancel Session"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Vitals */}
                {canEdit && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <HeartPulse className="w-3.5 h-3.5 text-red-500" /> Vitals
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Blood Pressure (BP)</label>
                        <input type="text" inputMode="numeric" placeholder="e.g. 128/80" value={draftVitals.bp}
                          onChange={e => { setSaved(false); setDraftVitals(v => ({ ...v, bp: e.target.value })); }}
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Heart Rate</label>
                        <input type="text" inputMode="numeric" placeholder="e.g. 76" value={draftVitals.heartRate}
                          onChange={e => { setSaved(false); setDraftVitals(v => ({ ...v, heartRate: e.target.value })); }}
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Complication */}
                {canEdit && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Complication</h4>
                    <div className="relative">
                      <button type="button" onClick={() => setComplicOpen(o => !o)}
                        className="w-full flex items-center gap-2 px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-300 text-left min-h-[44px]">
                        <span className="flex flex-wrap gap-1.5 flex-1">
                          {draftComplications.length === 0 ? (
                            <span className="text-slate-400">Select complications…</span>
                          ) : (
                            draftComplications.map(c => (
                              <span key={c} className="bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1">
                                {c}
                                <span role="button" onClick={e => { e.stopPropagation(); toggleComplication(c); }} className="cursor-pointer hover:text-amber-900">
                                  <X className="w-3 h-3" />
                                </span>
                              </span>
                            ))
                          )}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${complicOpen ? "rotate-180" : ""}`} />
                      </button>
                      {complicOpen && (
                        <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-64 overflow-y-auto">
                          {COMPLICATION_OPTIONS.map(opt => {
                            const isSel = draftComplications.includes(opt);
                            return (
                              <button key={opt} type="button" onClick={() => toggleComplication(opt)}
                                className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 hover:bg-violet-50 transition-colors ${isSel ? "bg-violet-50" : ""}`}>
                                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${isSel ? "bg-violet-600 border-violet-600" : "border-slate-300"}`}>
                                  {isSel && <Check className="w-2.5 h-2.5 text-white" />}
                                </div>
                                <span className={isSel ? "text-violet-700 font-semibold" : "text-slate-700"}>{opt}</span>
                              </button>
                            );
                          })}
                          {draftComplications.length > 0 && (
                            <div className="border-t border-slate-100 px-4 py-2">
                              <button type="button" onClick={() => { setSaved(false); setDraftComplications([]); setComplicOpen(false); }}
                                className="text-xs text-slate-400 hover:text-red-600 font-semibold">Clear all</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Important Note */}
                {canEdit && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Important Note</h4>
                    <textarea value={draftNote} onChange={e => { setSaved(false); setDraftNote(e.target.value); }}
                      placeholder="Enter clinical or session notes…" rows={3}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white resize-none" />
                  </div>
                )}

                {/* Existing notes */}
                {selected.notes && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">Session Notes</p>
                      <p className="text-sm text-amber-800 mt-0.5">{selected.notes}</p>
                    </div>
                  </div>
                )}

                {/* Save */}
                {canEdit && (
                  <div className="flex items-center gap-3">
                    <button onClick={handleSave}
                      className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white rounded-xl hover:bg-violet-700 text-sm font-bold shadow-md shadow-violet-200">
                      <Check className="w-4 h-4" /> Save Session Data
                    </button>
                    {saved && <span className="flex items-center gap-1.5 text-emerald-600 text-sm font-semibold"><CheckCircle className="w-4 h-4" /> Saved</span>}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Treatment Status Section ─────────────────────────────────────────────────

export function formatRxTimestamp(iso: string): string {
  const d = new Date(iso);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const h = d.getHours(), m = String(d.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}, ${h % 12 || 12}:${m} ${ampm}`;
}

export function computeChangedFields(old: AdminPrescription, draft: AdminPrescription): string[] {
  const changed: string[] = [];
  const rxLabels: { key: keyof RxDialysis; label: string }[] = [
    { key: "weeklySessionsCount", label: "Weekly Sessions" },
    { key: "slot", label: "Slot" },
    { key: "duration", label: "Duration" },
    { key: "bloodFlow", label: "Blood Flow Rate" },
    { key: "dialysateFlow", label: "Dialysate Flow Rate" },
    { key: "membrane", label: "Dialyzer" },
    { key: "dryWeight", label: "Dry Weight" },
    { key: "anticoagulation", label: "Anticoagulation" },
  ];
  for (const { key, label } of rxLabels) {
    if (key === "dialysisDays") continue;
    if ((old.dialysisRx[key] as string) !== (draft.dialysisRx[key] as string)) changed.push(label);
  }
  const oldDays = [...(old.dialysisRx.dialysisDays ?? [])].sort().join(",");
  const newDays = [...(draft.dialysisRx.dialysisDays ?? [])].sort().join(",");
  if (oldDays !== newDays) changed.push("Dialysis Days");
  if (JSON.stringify(old.medications) !== JSON.stringify(draft.medications)) changed.push("Medications");
  if (old.notes !== draft.notes) changed.push("Notes");
  return changed;
}

function RxStatusBadge({ status }: { status: AdminPrescription["status"] }) {
  const map = { Active: "bg-emerald-100 text-emerald-700 border-emerald-200", Revised: "bg-amber-100 text-amber-700 border-amber-200", Discontinued: "bg-red-100 text-red-700 border-red-200" };
  return <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${map[status]}`}>{status}</span>;
}

function formatDetailValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not available";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.length ? value.map(formatDetailValue).join(", ") : "Not available";
  if (typeof value === "object") {
    const values = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== null && item !== undefined && item !== "")
      .map(([key, item]) => `${key.replace(/([A-Z])/g, " $1")}: ${formatDetailValue(item)}`);
    return values.length ? values.join(" · ") : "Not available";
  }
  return String(value);
}

function firstDetailValue(...values: unknown[]): string {
  const value = values.find(item => item !== null && item !== undefined && item !== "");
  return value === undefined ? "Not available" : formatDetailValue(value);
}

function recordValue(record: Record<string, unknown> | undefined, ...keys: string[]): unknown {
  if (!record) return undefined;
  return keys.map(key => record[key]).find(value => value !== null && value !== undefined && value !== "");
}

function patientComorbidityValue(patient: Patient, key: "hypertension" | "diabetes", legacyValue: unknown): string {
  const flags = patient.medicalInfo?.comorbidityFlags as Record<string, unknown> | undefined;
  if (typeof flags?.[key] === "boolean") return flags[key] ? "Yes" : "No";
  return firstDetailValue(legacyValue, patient.comorbidities.toLowerCase().includes(key) ? "Yes" : undefined);
}

function weightDetailValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not available";
  return `${formatDetailValue(value)} kg`;
}

function blankPrescription(patient: Patient): AdminPrescription {
  return {
    id: "", patientId: patient.id, patientName: patient.name, patientUhid: patient.uhid,
    diagnosis: patient.primaryDisease || "", status: "Active", issuedDate: "", updatedBy: "",
    updatedByRole: "Administrator", dialysisRx: {
      weeklySessionsCount: patient.dialysisDaysPerWeek ? `${patient.dialysisDaysPerWeek} Sessions / Week` : "3 Sessions / Week",
      dialysisDays: patient.dialysisDays || [], slot: "", duration: "4 Hours", bloodFlow: "", dialysateFlow: "",
      membrane: "", dryWeight: "", anticoagulation: "",
    },
    medications: [], notes: "", history: [],
  };
}

function TreatmentStatusSection({ patients, prescriptions, setPrescriptions, sessions, adminName, onPatientUpdated, onSessionStatus, onOpenSchedule, onDraftStateChange, targetPatientId, targetPrescriptionId }: {
  patients: Patient[];
  prescriptions: AdminPrescription[];
  setPrescriptions: React.Dispatch<React.SetStateAction<AdminPrescription[]>>;
  sessions: DialysisSession[];
  adminName: string;
  onPatientUpdated: (patient: Patient) => void;
  onSessionStatus: (session: DialysisSession, status: "running" | "waiting" | "completed") => Promise<void>;
  onOpenSchedule: () => void;
  onDraftStateChange: PrescriptionDraftStateListener;
  targetPatientId?: string | null;
  targetPrescriptionId?: string | null;
}) {
  const [filter, setFilter] = useState<TreatmentStatus | "All">("All");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingRxId, setEditingRxId] = useState<string | null>(null);
  const [creatingPatientId, setCreatingPatientId] = useState<string | null>(null);
  const [clinicalEditor, setClinicalEditor] = useState<Patient | null>(null);
  const [editDraft, setEditDraft] = useState<AdminPrescription | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [savingRx, setSavingRx] = useState(false);
  const draftGuard = usePrescriptionDraftGuard(editDraft, savingRx, onDraftStateChange);
  const initializedTarget = useRef<string | null>(null);

  useEffect(() => {
    if (!targetPrescriptionId || !targetPatientId) {
      initializedTarget.current = null;
      return;
    }
    const targetKey = `${targetPatientId}:${targetPrescriptionId}`;
    if (initializedTarget.current === targetKey) return;
    const patient = patients.find(candidate => candidate.id === targetPatientId);
    if (!patient) return;
    initializedTarget.current = targetKey;
    setFilter("All");
    setSearch(patient.uhid || patient.name);
    setExpandedId(patient.id);
  }, [targetPatientId, targetPrescriptionId, patients]);

  const counts = (["Active", "Transplanted", "Expired", "Shifted", "Discontinued"] as TreatmentStatus[]).reduce(
    (acc, s) => ({ ...acc, [s]: patients.filter(p => p.treatmentStatus === s).length }), {} as Record<TreatmentStatus, number>
  );

  const filteredPatients = useMemo(() => {
    const q = search.toLowerCase();
    return patients.filter(p => {
      const matchStatus = filter === "All" || p.treatmentStatus === filter;
      const matchSearch = !q || p.name.toLowerCase().includes(q) || p.uhid.toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [patients, filter, search]);

  const startEdit = (rx: AdminPrescription) => {
    if (!draftGuard.confirmDiscard()) return;
    draftGuard.beginDraft(rx);
    setConflict(false); setSaveError(null); setCreatingPatientId(null);
    setEditingRxId(rx.id);
    setEditDraft(JSON.parse(JSON.stringify(rx)));
    setExpandedId(rx.patientId);
  };
  const startCreate = (patient: Patient) => {
    if (!draftGuard.confirmDiscard()) return;
    const next = blankPrescription(patient);
    draftGuard.beginDraft(next);
    setConflict(false);
    setCreatingPatientId(patient.id);
    setEditingRxId(null);
    setEditDraft(next);
    setExpandedId(patient.id);
    setSaveError(null);
  };
  const cancelEdit = () => {
    if (!draftGuard.confirmDiscard()) return;
    setEditingRxId(null); setCreatingPatientId(null); setEditDraft(null); setConflict(false); setSaveError(null);
  };

  const saveEdit = async () => {
    if (!editDraft || savingRx || conflict) return;
    setSavingRx(true);
    try {
      setSaveError(null);
      const saved = creatingPatientId
        ? await createPrescription(editDraft.patientId, editDraft)
        : await updatePrescription(editDraft.id, { ...editDraft, updatedBy: adminName, updatedByRole: "Administrator" });
      setPrescriptions(prev => creatingPatientId
        ? [...prev.filter(rx => rx.patientId !== saved.patientId), saved]
        : prev.map(rx => rx.id === saved.id ? saved : rx));
      setEditingRxId(null); setCreatingPatientId(null); setEditDraft(null);
    } catch (error) {
      if (error instanceof PrescriptionConflictError) setConflict(true);
      setSaveError(error instanceof Error ? error.message : "Prescription could not be saved.");
    } finally { setSavingRx(false); }
  };

  const updateRxScalar = (field: keyof Omit<RxDialysis, "dialysisDays">, value: string) => {
    setEditDraft(d => d ? { ...d, dialysisRx: { ...d.dialysisRx, [field]: value } } : d);
  };

  const toggleEditDay = (day: string) => {
    setEditDraft(d => {
      if (!d) return d;
      const days = d.dialysisRx.dialysisDays.includes(day)
        ? d.dialysisRx.dialysisDays.filter(x => x !== day)
        : [...d.dialysisRx.dialysisDays, day];
      return { ...d, dialysisRx: { ...d.dialysisRx, dialysisDays: days } };
    });
  };

  const addMedRow = () => setEditDraft(d => d ? { ...d, medications: [...d.medications, { name: "", dose: "", frequency: "", route: "PO" }] } : d);
  const removeMedRow = (i: number) => setEditDraft(d => d ? { ...d, medications: d.medications.filter((_, idx) => idx !== i) } : d);
  const updateMed = (i: number, field: keyof RxMedication, value: string) => {
    setEditDraft(d => { if (!d) return d; const meds = [...d.medications]; meds[i] = { ...meds[i], [field]: value }; return { ...d, medications: meds }; });
  };

  const viralSummary = (p: Patient) => {
    const flags: string[] = [];
    if (p.viralStatus.hepatitisB === "Positive") flags.push("HBsAg+");
    if (p.viralStatus.hepatitisC === "Positive") flags.push("HCV+");
    if (p.viralStatus.hiv === "Positive") flags.push("HIV+");
    if (p.viralStatus.hepatitisB === "Awaiting Report" || p.viralStatus.hepatitisC === "Awaiting Report") flags.push("Pending");
    return flags.length ? flags.join(", ") : "All Negative";
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionHeader title="Treatment Status" subtitle="Unified patient treatment cards with clinical and prescription details" />
      {clinicalEditor && <PatientClinicalEditor patient={clinicalEditor} onSaved={onPatientUpdated} onClose={()=>setClinicalEditor(null)} />}
      {saveError && <p role="alert" className="text-sm text-red-600">{saveError}</p>}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {TREATMENT_STATUSES.map(s => (
          <button key={s} onClick={() => setFilter(f => f === s ? "All" : s)}
            className={`rounded-2xl border p-4 text-center transition-all ${filter === s ? "border-violet-400 bg-violet-50 shadow-md" : "border-slate-100 bg-white hover:border-violet-200"}`}>
            <p className="text-2xl font-bold text-slate-800">{patients.filter(p=>p.treatmentStatus===s).length}</p>
            <TreatmentBadge status={s} />
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by patient name or UHID…"
          className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300 text-sm bg-white" />
      </div>

      {/* ── Unified patient cards ── */}
      <div className="space-y-4">
        {filteredPatients.map(p => {
          const rx        = prescriptions.find(r => r.patientId === p.id && r.id === targetPrescriptionId)
            ?? prescriptions.find(r => r.patientId === p.id)
            ?? null;
          const todaySess = sessions.find(s => s.patientId === p.id && s.date === "Today") ?? null;
          const isExpanded = expandedId === p.id;
          const isEditing  = rx !== null && editingRxId === rx.id;
          const isCreating = creatingPatientId === p.id;
          const draft      = (isEditing || isCreating) ? editDraft : null;
          const medicalInfo = p.medicalInfo || {};
          const investigations = p.investigations || {};
          const registration = p.registrationFields || {};

          return (
            <div key={p.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${isExpanded ? "border-violet-200 shadow-md" : "border-slate-100"}`}>

              {/* ── Card header (always visible) ── */}
              <button
                className="w-full text-left p-5 hover:bg-slate-50/60 transition-colors"
                onClick={() => { if (isEditing || isCreating) return; setExpandedId(isExpanded ? null : p.id); }}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center shrink-0 shadow-md shadow-violet-200">
                      <span className="text-white font-bold text-lg">{p.name.charAt(0)}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <p className="font-bold text-slate-800 text-base">{p.name}</p>
                        <TreatmentBadge status={p.treatmentStatus} />
                        {rx && <RxStatusBadge status={rx.status} />}
                        {todaySess && (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            todaySess.status === "Running"   ? "bg-blue-100 text-blue-700 border-blue-200" :
                            todaySess.status === "Waiting"   ? "bg-amber-100 text-amber-700 border-amber-200" :
                            "bg-emerald-100 text-emerald-700 border-emerald-200"
                          }`}>{todaySess.status} Today</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">{p.uhid} · {p.treatingNephrologist}</p>
                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{p.primaryDisease}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!isEditing && !isCreating && (isExpanded
                      ? <ChevronUp className="w-5 h-5 text-slate-400" />
                      : <ChevronDown className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                </div>
              </button>

              {/* ── Expanded body ── */}
              {(isExpanded || isEditing || isCreating) && (
                <div className="border-t border-slate-100">

                  {/* ══ SECTION 1: Patient Information ══ */}
                  <div className="px-5 pt-5 pb-4">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <UserCheck className="w-3.5 h-3.5 text-violet-500" /> Patient Information
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {[
                        { label: "Patient Name",    value: p.name },
                        { label: "UHID",            value: p.uhid },
                        { label: "Age / Gender",    value: `${p.age} yrs · ${p.gender}` },
                          { label: "Date of Birth",   value: firstDetailValue(p.dateOfBirth, recordValue(registration, "dateOfBirth", "dob")) },
                        { label: "Blood Group",     value: p.bloodGroup },
                        { label: "Unit",            value: todaySess ? (todaySess.unit === "U1" ? "Unit 1" : "Unit 2") : "—" },
                        { label: "Machine",         value: todaySess ? todaySess.machine : "—" },
                        { label: "Today's Slot",    value: todaySess ? todaySess.slot : (p.currentSchedule ?? "—") },
                        { label: "Nephrologist",    value: p.treatingNephrologist },
                        { label: "Viral Status",    value: viralSummary(p) },
                        { label: "Dialysis Days",   value: `${p.dialysisDaysPerWeek}× / week — ${p.dialysisDays.join(", ")}` },
                        { label: "Treatment Status",value: p.treatmentStatus },
                        { label: "Last Dialysis",   value: p.lastDialysis },
                      ].map(item => (
                        <div key={item.label} className="bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{item.label}</p>
                          <p className="text-xs font-semibold text-slate-700 leading-snug">{item.value}</p>
                        </div>
                      ))}
                    </div>
                    {p.remarks && (
                      <div className="mt-3 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 flex gap-2 items-start">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-800">{p.remarks}</p>
                      </div>
                    )}
                  </div>

                  {/* ══ SECTION 2: Medical Information ══ */}
                  <div className="px-5 pb-4 border-t border-slate-100">
                    <button onClick={()=>setClinicalEditor(p)} className="float-right mt-3 text-xs text-violet-700 border border-violet-200 rounded-lg px-3 py-1.5 hover:bg-violet-50">Edit Clinical Information</button>
                    <label className="inline-flex gap-2 items-center mt-3 text-xs text-slate-600">Treatment status
                      <select aria-label={`Treatment status for ${p.name}`} value={p.treatmentStatus}
                        onChange={async e => {
                          const next=e.target.value as TreatmentStatus;
                          if(next!=="Active"&&!window.confirm("This will cancel this patient's future scheduled sessions and preserve their history. Continue?"))return;
                          try{onPatientUpdated(await updatePatient(p.id,{treatmentStatus:next}));}
                          catch(error){setSaveError(error instanceof Error?error.message:"Patient status could not be saved.");}
                        }} className="border border-slate-200 rounded-lg px-2 py-1 bg-white">
                        {TREATMENT_STATUSES.map(status=><option key={status}>{status}</option>)}
                      </select>
                    </label>
                    <h3 className="pt-4 text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <FlaskConical className="w-3.5 h-3.5 text-violet-500" /> Medical Information
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {[
                        { label: "Comorbidities", value: firstDetailValue(p.comorbidities, recordValue(medicalInfo, "comorbidities")) },
                        { label: "Hypertension", value: patientComorbidityValue(p, "hypertension", recordValue(medicalInfo, "hypertension", "htn")) },
                        { label: "Diabetes", value: patientComorbidityValue(p, "diabetes", recordValue(medicalInfo, "diabetes", "dm")) },
                        { label: "Dry Weight", value: weightDetailValue(recordValue(medicalInfo, "dryWeight")) },
                        { label: "Weight Gain", value: weightDetailValue(recordValue(medicalInfo, "weightGain")) },
                        { label: "Dialysis Access", value: firstDetailValue(recordValue(medicalInfo, "dialysisAccess", "access", "accessType"), recordValue(registration, "dialysisAccess", "accessType")) },
                        { label: "AV Fistula", value: firstDetailValue(recordValue(medicalInfo, "avFistula", "avf")) },
                        { label: "Permacath", value: firstDetailValue(recordValue(medicalInfo, "permacath", "tunnelledCatheter")) },
                        { label: "Temporary Catheter", value: firstDetailValue(recordValue(medicalInfo, "temporaryCatheter", "tempCatheter")) },
                        { label: "Other Access", value: firstDetailValue(recordValue(medicalInfo, "otherAccess")) },
                        { label: "CBC", value: firstDetailValue(recordValue(investigations, "cbc", "CBC"), recordValue(medicalInfo, "cbc", "CBC")) },
                        { label: "Renal Function Test", value: firstDetailValue(recordValue(investigations, "rft", "renalFunctionTest", "RFT")) },
                        { label: "LFT", value: firstDetailValue(recordValue(investigations, "lft", "LFT")) },
                        { label: "HBsAg", value: p.viralStatus.hepatitisB },
                        { label: "HIV I/II", value: p.viralStatus.hiv },
                        { label: "Anti HCV", value: p.viralStatus.hepatitisC },
                        { label: "Serum Calcium", value: firstDetailValue(recordValue(investigations, "serumCalcium", "calcium")) },
                        { label: "Serum Phosphorous", value: firstDetailValue(recordValue(investigations, "serumPhosphorous", "phosphorous", "phosphorus")) },
                        { label: "Serum Ferritin", value: firstDetailValue(recordValue(investigations, "serumFerritin", "ferritin")) },
                        { label: "Thyroid Profile", value: firstDetailValue(recordValue(investigations, "thyroidProfile", "thyroid")) },
                        { label: "2D Echo", value: firstDetailValue(recordValue(investigations, "twoDEcho", "echo2d", "echo")) },
                        { label: "Ejection Fraction", value: firstDetailValue(recordValue(investigations, "ejectionFraction", "ef")) },
                        { label: "OPD / IPD", value: firstDetailValue(recordValue(medicalInfo, "opdIpd", "opd_ipd"), recordValue(registration, "opdIpd", "opd_ipd")) },
                      ].map(item => (
                        <div key={item.label} className="bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{item.label}</p>
                          <p className="text-xs font-semibold text-slate-700 leading-snug">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ══ SECTION 2 & 3: Prescription (view or edit) ══ */}
                  {isCreating && draft ? (
                    /* ── Create mode ── */
                    <div className="px-5 pb-5 border-t border-slate-100 bg-violet-50/30">
                      <div className="pt-4 mb-4 flex items-center justify-between flex-wrap gap-2">
                        <h3 className="text-xs font-bold text-violet-700 uppercase tracking-widest flex items-center gap-2">
                          <Plus className="w-3.5 h-3.5" /> Create Prescription
                        </h3>
                        <span className="text-[10px] text-slate-400 bg-white px-2 py-0.5 rounded-full border border-slate-200">A versioned record will be created</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Diagnosis</label>
                          <input value={draft.diagnosis} onChange={e => setEditDraft(d => d ? { ...d, diagnosis: e.target.value } : d)} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Weekly Dialysis Sessions</label>
                          <select value={draft.dialysisRx.weeklySessionsCount} onChange={e => updateRxScalar("weeklySessionsCount", e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white">
                            {WEEKLY_SESSION_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        </div>
                      </div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Dialysis Days</p>
                      <div className="flex flex-wrap gap-1.5 p-2 border border-slate-200 rounded-xl bg-white mb-3">
                        {DIALYSIS_DAY_OPTIONS.map(day => <button key={day} type="button" onClick={() => toggleEditDay(day)} className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${draft.dialysisRx.dialysisDays.includes(day) ? "bg-violet-600 text-white border-violet-600" : "bg-slate-50 text-slate-600 border-slate-200"}`}>{day.slice(0, 3)}</button>)}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                        <select value={draft.dialysisRx.slot} onChange={e => updateRxScalar("slot", e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white"><option value="">Select slot</option>{SLOT_OPTIONS.map(o => <option key={o}>{o}</option>)}</select>
                        <select value={draft.dialysisRx.duration} onChange={e => updateRxScalar("duration", e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white">{DURATION_OPTIONS.map(o => <option key={o}>{o}</option>)}</select>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
                        {ADMIN_RX_SCALAR_FIELDS.filter(field => !["weeklySessionsCount", "slot", "duration"].includes(field.key)).map(({ key, label }) => (
                          <div key={key}>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</label>
                            <input value={draft.dialysisRx[key]} onChange={e => updateRxScalar(key, e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white" />
                          </div>
                        ))}
                      </div>
                      <div className="mb-5">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Medication Prescription</p>
                          <button onClick={addMedRow} className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 font-semibold"><Plus className="w-3.5 h-3.5" /> Add Row</button>
                        </div>
                        {draft.medications.length === 0 ? (
                          <p className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-400">No medications added.</p>
                        ) : (
                          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                            <table className="w-full text-xs"><thead><tr className="bg-slate-50 text-slate-500"><th className="text-left px-2 py-2">Medication</th><th className="text-left px-2 py-2">Dose</th><th className="text-left px-2 py-2">Frequency</th><th className="text-left px-2 py-2">Route</th><th /></tr></thead>
                              <tbody>{draft.medications.map((med, index) => <tr key={index} className="border-t border-slate-50"><td className="p-1"><input value={med.name} onChange={e => updateMed(index, "name", e.target.value)} className="w-full rounded border border-slate-200 px-2 py-1" /></td><td className="p-1"><input value={med.dose} onChange={e => updateMed(index, "dose", e.target.value)} className="w-full rounded border border-slate-200 px-2 py-1" /></td><td className="p-1"><input value={med.frequency} onChange={e => updateMed(index, "frequency", e.target.value)} className="w-full rounded border border-slate-200 px-2 py-1" /></td><td className="p-1"><select value={med.route} onChange={e => updateMed(index, "route", e.target.value)} className="w-full rounded border border-slate-200 px-2 py-1 bg-white"><option>PO</option><option>IV</option><option>SC</option><option>IM</option></select></td><td className="p-1"><button onClick={() => removeMedRow(index)} className="p-1 text-red-400 hover:text-red-600"><X className="w-3.5 h-3.5" /></button></td></tr>)}</tbody>
                            </table>
                          </div>
                        )}
                      </div>
                      <textarea value={draft.notes} onChange={e => setEditDraft(d => d ? { ...d, notes: e.target.value } : d)} placeholder="Clinical notes (optional)" rows={3} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm resize-none mb-4" />
                      <div className="flex gap-3 justify-end">
                        <button onClick={cancelEdit} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-white text-sm font-semibold">Cancel</button>
                        <button disabled={savingRx} onClick={saveEdit} className="flex items-center gap-2 px-5 py-2 bg-violet-600 text-white rounded-xl hover:bg-violet-700 text-sm font-bold"><Check className="w-4 h-4" /> Create Prescription</button>
                      </div>
                      {saveError && <p className="mt-2 text-xs text-red-600 text-right">{saveError}</p>}
                    </div>
                  ) : rx === null ? (
                    <div className="mx-5 mb-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl p-5 text-center">
                      <FileText className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                      <p className="text-sm text-slate-500 font-medium">No dialysis prescription created yet.</p>
                      <button onClick={() => startCreate(p)} className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 bg-violet-600 text-white rounded-lg text-xs font-bold hover:bg-violet-700">
                        <Plus className="w-3.5 h-3.5" /> Create Prescription
                      </button>
                    </div>
                  ) : isEditing && draft ? (
                    /* ── Edit mode ── */
                    <fieldset disabled={savingRx} className="px-5 pb-5 border-t border-slate-100 bg-violet-50/30 min-w-0">
                      <div className="pt-4 mb-4 flex items-center justify-between flex-wrap gap-2">
                        <h3 className="text-xs font-bold text-violet-700 uppercase tracking-widest flex items-center gap-2">
                          <Edit3 className="w-3.5 h-3.5" /> Editing Prescription
                        </h3>
                        <span className="text-[10px] text-slate-400 bg-white px-2 py-0.5 rounded-full border border-slate-200">Previous version will be archived</span>
                      </div>

                      {conflict && <PrescriptionConflict key={draft.id} draft={draft} onResolve={reviewed => {
                        setEditDraft(reviewed); setConflict(false); setSaveError(null);
                      }} />}
                      {/* Dialysis Rx edit fields */}
                      <div className="space-y-3 mb-5">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Dialysis Prescription</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Weekly Dialysis Sessions</label>
                            <select value={draft.dialysisRx.weeklySessionsCount} onChange={e => updateRxScalar("weeklySessionsCount", e.target.value)}
                              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white">
                              {WEEKLY_SESSION_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Dialysis Days</label>
                            <div className="flex flex-wrap gap-1.5 p-2 border border-slate-200 rounded-xl bg-white min-h-[40px]">
                              {DIALYSIS_DAY_OPTIONS.map(day => {
                                const sel = draft.dialysisRx.dialysisDays.includes(day);
                                return (
                                  <button key={day} type="button" onClick={() => toggleEditDay(day)}
                                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${sel ? "bg-violet-600 text-white border-violet-600" : "bg-slate-50 text-slate-600 border-slate-200 hover:border-violet-300"}`}>
                                    {day.slice(0, 3)}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Slot</label>
                            <select value={draft.dialysisRx.slot} onChange={e => updateRxScalar("slot", e.target.value)}
                              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white">
                              {SLOT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Duration</label>
                            <select value={draft.dialysisRx.duration} onChange={e => updateRxScalar("duration", e.target.value)}
                              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white">
                              {DURATION_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                          </div>
                          {ADMIN_RX_SCALAR_FIELDS.filter(f => !["weeklySessionsCount","slot","duration"].includes(f.key)).map(({ key, label }) => (
                            <div key={key}>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</label>
                              <input type="text" value={draft.dialysisRx[key]} onChange={e => updateRxScalar(key, e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white" />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Medication edit table */}
                      <div className="mb-5">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Medication Prescription</p>
                          <button onClick={addMedRow} className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-800 font-semibold">
                            <Plus className="w-3.5 h-3.5" /> Add Row
                          </button>
                        </div>
                        <div className="overflow-x-auto bg-white rounded-xl border border-slate-200">
                          <table className="w-full text-xs">
                            <thead><tr className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-100">
                              <th className="text-left px-3 py-2">Medication</th>
                              <th className="text-left px-3 py-2">Dose</th>
                              <th className="text-left px-3 py-2">Frequency</th>
                              <th className="text-left px-3 py-2">Route</th>
                              <th className="px-3 py-2"></th>
                            </tr></thead>
                            <tbody>
                              {draft.medications.map((med, i) => (
                                <tr key={i} className="border-t border-slate-50">
                                  <td className="px-2 py-1.5"><input type="text" value={med.name} placeholder="Medication name" onChange={e => updateMed(i, "name", e.target.value)}
                                    className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-violet-300" /></td>
                                  <td className="px-2 py-1.5"><input type="text" value={med.dose} placeholder="Dose" onChange={e => updateMed(i, "dose", e.target.value)}
                                    className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-violet-300" /></td>
                                  <td className="px-2 py-1.5"><input type="text" value={med.frequency} placeholder="Frequency" onChange={e => updateMed(i, "frequency", e.target.value)}
                                    className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-violet-300" /></td>
                                  <td className="px-2 py-1.5"><select value={med.route} onChange={e => updateMed(i, "route", e.target.value)}
                                    className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-violet-300 bg-white">
                                    <option>PO</option><option>IV</option><option>SC</option><option>IM</option>
                                  </select></td>
                                  <td className="px-2 py-1.5 text-center"><button onClick={() => removeMedRow(i)} className="p-1 text-red-400 hover:text-red-600">
                                    <X className="w-3.5 h-3.5" /></button></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Clinical notes */}
                      <div className="mb-5">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Clinical Notes</label>
                        <textarea value={draft.notes} onChange={e => setEditDraft(d => d ? { ...d, notes: e.target.value } : d)}
                          rows={3} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white resize-none" />
                      </div>

                      <div className="flex gap-3 justify-end">
                        <button onClick={cancelEdit} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-white text-sm font-semibold">Cancel</button>
                        <button disabled={savingRx || conflict} onClick={saveEdit} className="flex items-center gap-2 px-5 py-2 bg-violet-600 text-white rounded-xl hover:bg-violet-700 text-sm font-bold shadow-md shadow-violet-200 disabled:opacity-50">
                          <Check className="w-4 h-4" /> Save Prescription
                        </button>
                      </div>
                      {saveError && <p className="mt-2 text-xs text-red-600 text-right">{saveError}</p>}
                    </fieldset>
                  ) : (
                    /* ── View mode ── */
                    <>
                      {/* Dialysis prescription view */}
                      <div className="px-5 pt-4 pb-4 border-t border-slate-100">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-blue-500" /> Dialysis Prescription
                          </h3>
                          <div className="flex items-center gap-2">
                            <RxStatusBadge status={rx.status} />
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-semibold border border-slate-200">v{rx.version ?? rx.history.length + 1}</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                          <div className="bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Weekly Sessions</p>
                            <p className="text-sm font-semibold text-slate-700">{rx.dialysisRx.weeklySessionsCount}</p>
                          </div>
                          <div className="bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100 md:col-span-2">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Dialysis Days</p>
                            <div className="flex flex-wrap gap-1.5">
                              {rx.dialysisRx.dialysisDays.map(d => (
                                <span key={d} className="px-2 py-0.5 bg-violet-100 text-violet-700 border border-violet-200 text-xs font-semibold rounded-full">{d}</span>
                              ))}
                            </div>
                          </div>
                          {ADMIN_RX_SCALAR_FIELDS.filter(f => f.key !== "weeklySessionsCount").map(({ key, label }) => (
                            <div key={key} className="bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
                              <p className="text-sm font-semibold text-slate-700">{rx.dialysisRx[key]}</p>
                            </div>
                          ))}
                        </div>
                        {rx.notes && (
                          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex gap-2 items-start">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-0.5">Clinical Notes</p>
                              <p className="text-sm text-amber-800">{rx.notes}</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Medication prescription view */}
                      <div className="px-5 pb-4 border-t border-slate-100">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 mt-4 flex items-center gap-2">
                          <Pill className="w-3.5 h-3.5 text-violet-500" /> Medication Prescription
                          <span className="text-[10px] font-normal text-slate-400 normal-case">({rx.medications.length} item{rx.medications.length !== 1 ? "s" : ""})</span>
                        </h3>
                        <div className="overflow-x-auto rounded-xl border border-slate-100">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                                <th className="text-left px-4 py-2.5">Medication</th>
                                <th className="text-left px-4 py-2.5">Dose</th>
                                <th className="text-left px-4 py-2.5">Frequency</th>
                                <th className="text-left px-4 py-2.5">Route</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {rx.medications.map((med, i) => (
                                <tr key={i} className="hover:bg-slate-50/70 transition-colors">
                                  <td className="px-4 py-2.5 font-semibold text-slate-800">{med.name}</td>
                                  <td className="px-4 py-2.5 text-slate-600">{med.dose}</td>
                                  <td className="px-4 py-2.5 text-slate-600">{med.frequency}</td>
                                  <td className="px-4 py-2.5">
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${med.route === "IV" ? "bg-red-100 text-red-700" : med.route === "SC" ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-600"}`}>{med.route}</span>
                                  </td>
                                </tr>
                              ))}
                              {rx.medications.length === 0 && (
                                <tr><td colSpan={4} className="px-4 py-5 text-center text-slate-300 text-xs">No medications listed</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                        <div className="mt-3 pt-3 border-t border-slate-100 space-y-0.5">
                          <p className="text-xs text-slate-500">
                            <span className="font-semibold text-slate-600">Created By:</span>{" "}
                            {rx.createdBy || rx.updatedBy} <span className="text-slate-400">({rx.createdByRole || rx.updatedByRole})</span>
                          </p>
                          <p className="text-xs text-slate-500">
                            <span className="font-semibold text-slate-600">Created:</span>{" "}
                            {rx.createdAt ? formatRxTimestamp(rx.createdAt) : rx.issuedDate}
                          </p>
                          <p className="text-xs text-slate-500">
                            <span className="font-semibold text-slate-600">Last Edited:</span>{" "}
                            {rx.lastUpdatedAt ? formatRxTimestamp(rx.lastUpdatedAt) : rx.issuedDate}
                          </p>
                          <p className="text-xs text-slate-500">
                            <span className="font-semibold text-slate-600">Updated By:</span>{" "}
                            {rx.updatedBy} <span className="text-slate-400">({rx.updatedByRole})</span>
                          </p>
                        </div>
                      </div>

                      {/* Prescription audit trail */}
                      <div className="px-5 pb-4 border-t border-slate-100">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 mt-4 flex items-center gap-2">
                          <ScrollText className="w-3.5 h-3.5 text-violet-500" /> Prescription History
                        </h3>
                        {rx.history.length === 0 ? (
                          <p className="text-xs text-slate-400 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5">No previous versions. This is the current prescription.</p>
                        ) : (
                          <div className="space-y-2">
                            {rx.history.map(item => (
                              <div key={item.version} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                <div>
                                  <p className="text-xs font-bold text-slate-700">Version {item.version} · {item.version === 1 ? "Created" : "Edited"}</p>
                                  <p className="text-[11px] text-slate-500">{item.updatedBy} <span className="text-slate-400">({item.updatedByRole})</span> · {item.updatedAt ? formatRxTimestamp(item.updatedAt) : item.updatedDate}</p>
                                </div>
                                <span className="text-[10px] font-semibold text-slate-500">{item.changedFields.length ? item.changedFields.join(", ") : "Snapshot archived"}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* ══ SECTION 4: Treatment Actions ══ */}
                  <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/40">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Stethoscope className="w-3.5 h-3.5 text-slate-400" /> Treatment Actions
                    </h3>
                    <div className="flex flex-wrap gap-2">
                       {rx && !isEditing && !isCreating && (
                        <button onClick={() => startEdit(rx)}
                          className="flex items-center gap-1.5 px-4 py-2 border border-violet-200 text-violet-700 bg-white rounded-xl hover:bg-violet-50 text-xs font-semibold shadow-sm transition-colors">
                          <Edit3 className="w-3.5 h-3.5" /> Edit Prescription
                        </button>
                      )}
                       {!rx && !isCreating && (
                         <button onClick={() => startCreate(p)} className="flex items-center gap-1.5 px-4 py-2 border border-violet-200 text-violet-700 bg-white rounded-xl hover:bg-violet-50 text-xs font-semibold shadow-sm transition-colors">
                           <Plus className="w-3.5 h-3.5" /> Create Prescription
                         </button>
                       )}
                      {todaySess ? (
                        <>
                          {todaySess.status === "Waiting" && (
                            <button onClick={async ()=>{try {await onSessionStatus(todaySess,"running");} catch(e){setSaveError(e instanceof Error?e.message:"Could not start session.");}}} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 text-xs font-semibold shadow-sm shadow-blue-200">
                              <Activity className="w-3.5 h-3.5" /> Start Dialysis
                            </button>
                          )}
                          {todaySess.status === "Running" && (
                            <>
                              <button onClick={async ()=>{try {await onSessionStatus(todaySess,"completed");} catch(e){setSaveError(e instanceof Error?e.message:"Could not complete session.");}}} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 text-xs font-semibold shadow-sm shadow-emerald-200">
                                <CheckCircle className="w-3.5 h-3.5" /> Complete Session
                              </button>
                              <button onClick={async ()=>{try {await onSessionStatus(todaySess,"waiting");} catch(e){setSaveError(e instanceof Error?e.message:"Could not pause session.");}}} className="flex items-center gap-1.5 px-4 py-2 border border-amber-200 text-amber-700 bg-white rounded-xl hover:bg-amber-50 text-xs font-semibold">
                                <RefreshCw className="w-3.5 h-3.5" /> Pause
                              </button>
                            </>
                          )}
                          <button onClick={onOpenSchedule} className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-600 bg-white rounded-xl hover:bg-slate-50 text-xs font-semibold">
                            <HeartPulse className="w-3.5 h-3.5" /> Enter Vitals
                          </button>
                          <button onClick={onOpenSchedule} className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-600 bg-white rounded-xl hover:bg-slate-50 text-xs font-semibold">
                            <AlertTriangle className="w-3.5 h-3.5" /> Record Complication
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-slate-400 italic py-2">No active session today — session controls are available in Live Schedule.</span>
                      )}
                    </div>
                  </div>

                </div>
              )}
            </div>
          );
        })}

        {filteredPatients.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
            <Search className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">No patients match your search.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Missed Slots Section ─────────────────────────────────────────────────────

function MissedSlotsSection({ sessions, patients, machines, onFillSlot, onUpdateMissedReason }: {
  sessions: DialysisSession[]; patients: Patient[]; machines: Machine[];
  onFillSlot: (session: DialysisSession, replacementSession: DialysisSession) => void;
  onUpdateMissedReason?: (id: string, reason: string, otherText: string) => void;
}) {
  const missedSessions = sessions.filter(s => s.attendance === "Missed");
  const [fillModal, setFillModal] = useState<DialysisSession | null>(null);
  const [fillType, setFillType] = useState<"waiting" | "emergency" | "manual" | "">("");
  const [selectedFillPatient, setSelectedFillPatient] = useState<Patient | null>(null);
  const [fillLinks, setFillLinks] = useState<ScheduleLinks>({ doctor: "", doctorId: "", prescriptionId: "" });
  const [fillError, setFillError] = useState("");
  const [fillSaving, setFillSaving] = useState(false);
  const [missedReasons, setMissedReasons] = useState<Record<string, string>>(
    Object.fromEntries(missedSessions.map(s => [s.id, s.missedReason ?? ""]))
  );
  const [missedOtherTexts, setMissedOtherTexts] = useState<Record<string, string>>(
    Object.fromEntries(missedSessions.map(s => [s.id, s.missedReasonOther ?? ""]))
  );
  const [missedReasonEditing, setMissedReasonEditing] = useState<string | null>(null);
  const [fillSuccess, setFillSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filteredMissed = missedSessions.filter(s =>
    !search || s.patientName.toLowerCase().includes(search.toLowerCase()) || s.machine.toLowerCase().includes(search.toLowerCase())
  );

  const waitingPatients   = patients.filter(p => p.treatmentStatus === "Active" && p.currentSchedule === null);
  const emergencyPatients = patients.filter(p => p.remarks.toLowerCase().includes("emergency"));
  const availablePatients = patients.filter(p =>
    p.treatmentStatus === "Active" &&
    !sessions.some(s => s.patientId === p.id && s.date === fillModal?.date && s.slot === fillModal?.slot)
  );

  const candidateList = fillType === "waiting" ? waitingPatients
    : fillType === "emergency" ? emergencyPatients
    : availablePatients;

  const handleFill = async () => {
    if (!fillModal || !selectedFillPatient) return;
    const newSession: DialysisSession = {
      id: `SF${Date.now()}`,
      patientId: selectedFillPatient.id, patientName: selectedFillPatient.name,
      uhid: selectedFillPatient.uhid, date: fillModal.date, slot: fillModal.slot,
      machine: fillModal.machine, machineId: fillModal.machineId, unit: fillModal.unit,
      duration: fillModal.duration, doctor: fillLinks.doctor || "Not assigned",
      doctorId: fillLinks.doctorId, prescriptionId: fillLinks.prescriptionId, attendance: "Completed",
      notes: `Slot filled after missed session (${missedReasons[fillModal.id] || "reason not recorded"})`,
      startTime: fillModal.startTime, endTime: fillModal.endTime, status: "Waiting",
    };
    try {
      setFillSaving(true); setFillError("");
      await onFillSlot(fillModal, newSession);
      setFillSuccess(fillModal.id);
      setFillModal(null); setFillType(""); setSelectedFillPatient(null);
      setFillLinks({ doctor: "", doctorId: "", prescriptionId: "" });
    } catch (error) { setFillError(error instanceof Error ? error.message : "Replacement session could not be saved."); }
    finally { setFillSaving(false); }
  };

  const missedReasonOptions = ["Went to another dialysis centre", "Expired", "Hospitalized", "Personal reason", "No transport", "Family emergency", "Other"];

  const fillTypeConfig = [
    { key: "waiting" as const,   label: "Waiting List",    icon: <Clock className="w-4 h-4" />,      desc: `${waitingPatients.length} patients`,  cls: "bg-blue-50 border-blue-200 text-blue-700" },
    { key: "emergency" as const, label: "Emergency",       icon: <Zap className="w-4 h-4" />,        desc: `${emergencyPatients.length} waiting`,  cls: "bg-red-50 border-red-200 text-red-700" },
    { key: "manual" as const,    label: "Manual Select",   icon: <UserCheck className="w-4 h-4" />,  desc: "Choose any patient",                    cls: "bg-violet-50 border-violet-200 text-violet-700" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionHeader title="Missed Slot Management" subtitle="Track missed dialysis sessions and reallocate vacant machine slots" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Missed",     value: missedSessions.length,                                                  cls: "text-slate-800" },
          { label: "Unfilled Slots",   value: missedSessions.filter(s => fillSuccess !== s.id).length,                cls: "text-red-600" },
          { label: "Waiting List",     value: waitingPatients.length,                                                  cls: "text-blue-600" },
          { label: "Emergency Waiting", value: emergencyPatients.length,                                               cls: "text-orange-600" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">{s.label}</p>
            <p className={`text-3xl font-bold ${s.cls}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input type="text" placeholder="Search patient or machine…" value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white" />
      </div>

      <div className="space-y-3">
        {filteredMissed.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-14 text-center">
            <CheckCircle className="w-10 h-10 mx-auto mb-3 text-emerald-300" />
            <p className="text-slate-500 font-medium">No missed sessions found</p>
          </div>
        )}
        {filteredMissed.map(s => {
          const alreadyFilled = fillSuccess === s.id;
          const reason = missedReasons[s.id];
          return (
            <div key={s.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${alreadyFilled ? "border-emerald-200 opacity-70" : "border-red-100"}`}>
              <div className="flex items-center gap-2 px-5 py-3 border-b bg-red-50/50 border-red-100">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                <span className="text-sm font-bold text-red-700">Missed Session</span>
                {alreadyFilled && (
                  <span className="ml-auto flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full font-semibold">
                    <CheckCircle className="w-3 h-3" /> Slot Filled
                  </span>
                )}
              </div>
              <div className="p-5">
                <div className="flex flex-wrap gap-6 mb-4">
                  <div>
                    <p className="text-xs text-slate-400 mb-0.5">Patient</p>
                    <p className="font-bold text-slate-800">{s.patientName}</p>
                    <p className="text-xs text-slate-400">{s.uhid}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-0.5">Slot / Date</p>
                    <p className="font-semibold text-slate-700">{s.slot}</p>
                    <p className="text-xs text-slate-500">{s.date} · {s.startTime}–{s.endTime}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-0.5">Machine</p>
                    <p className="font-semibold text-slate-700">{s.machine}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-0.5">Doctor</p>
                    <p className="text-sm text-slate-600">{s.doctor}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap mb-4">
                  <p className="text-xs text-slate-500 font-semibold">Reason:</p>
                  {missedReasonEditing === s.id ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <select value={reason} onChange={e => setMissedReasons(prev => ({ ...prev, [s.id]: e.target.value }))}
                          className="text-xs px-2 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-300">
                          <option value="">Select reason…</option>
                          {missedReasonOptions.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <button onClick={() => {
                          onUpdateMissedReason?.(s.id, reason, missedOtherTexts[s.id] ?? "");
                          setMissedReasonEditing(null);
                        }} className="text-xs px-2 py-1.5 bg-violet-600 text-white rounded-lg">Save</button>
                      </div>
                      {reason === "Other" && (
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Please specify</label>
                          <textarea
                            value={missedOtherTexts[s.id] ?? ""}
                            onChange={e => setMissedOtherTexts(prev => ({ ...prev, [s.id]: e.target.value }))}
                            placeholder="Describe the reason…"
                            rows={2}
                            className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none"
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      {reason ? (
                        <span className="text-xs bg-red-50 text-red-700 border border-red-200 px-2.5 py-1 rounded-full font-medium">
                          {reason === "Other" && missedOtherTexts[s.id] ? `Other: ${missedOtherTexts[s.id]}` : reason}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Not recorded</span>
                      )}
                      <button onClick={() => setMissedReasonEditing(s.id)} className="text-xs text-slate-400 hover:text-violet-600 flex items-center gap-1">
                        <Edit3 className="w-3 h-3" /> {reason ? "Edit" : "Record"}
                      </button>
                    </div>
                  )}
                </div>

                {!alreadyFilled && (
                  <div className="flex gap-3">
                    <button onClick={() => { setFillModal(s); setFillType(""); setSelectedFillPatient(null); }}
                      className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700 transition-colors shadow-md shadow-violet-200">
                      <SkipForward className="w-4 h-4" /> Fill Empty Slot
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {fillModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg animate-fade-in overflow-hidden max-h-[90vh] flex flex-col">
            <div className="bg-gradient-to-r from-violet-700 to-violet-900 px-6 py-5 shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white text-base">Fill Empty Slot</h3>
                  <p className="text-violet-200 text-xs mt-0.5">{fillModal.machine} · {fillModal.date} · {fillModal.slot}</p>
                </div>
                <button onClick={() => setFillModal(null)} className="p-2 hover:bg-white/10 rounded-xl"><X className="w-5 h-5 text-slate-200" /></button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 p-6 space-y-5">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800 flex gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <span>Slot freed after missed session by <strong>{fillModal.patientName}</strong>. Select a replacement patient.</span>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Assign Slot To</p>
                <div className="grid grid-cols-3 gap-2">
                  {fillTypeConfig.map(opt => (
                    <button key={opt.key} onClick={() => { setFillType(opt.key); setSelectedFillPatient(null); }}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-xs font-semibold transition-all ${fillType === opt.key ? `border-violet-500 ${opt.cls}` : "border-slate-200 hover:border-slate-300 text-slate-600 hover:bg-slate-50"}`}>
                      {opt.icon}<span>{opt.label}</span>
                      <span className="font-normal text-[10px] opacity-70">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
              {fillType && (
                <div className="space-y-1.5 max-h-52 overflow-y-auto border border-slate-100 rounded-xl p-2">
                  {candidateList.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-6">No patients in this category.</p>
                  ) : candidateList.map(p => (
                    <button key={p.id} onClick={() => { setSelectedFillPatient(p); setFillLinks(d => ({ ...d, prescriptionId: "" })); }}
                      className={`w-full text-left px-3 py-2.5 rounded-lg transition-all border-2 ${selectedFillPatient?.id === p.id ? "border-violet-400 bg-violet-50" : "border-transparent hover:bg-slate-50"}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-slate-800 text-sm">{p.name}</span>
                          <span className="text-xs text-slate-400 ml-2">{p.uhid}</span>
                        </div>
                        <CategoryBadge category={getRequiredCategory(p)} />
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {selectedFillPatient && (
                <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 text-xs text-violet-700">
                  <p className="font-semibold text-violet-900 mb-1 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Replacement: {selectedFillPatient.name}</p>
                  <p>Machine: {fillModal.machine} · {fillModal.date} · {fillModal.slot}</p>
                </div>
              )}
            </div>
            <div className="px-6 pb-4">
              <ScheduleClinicalLinks key={selectedFillPatient?.id} patientId={selectedFillPatient?.id}
                value={fillLinks} onChange={setFillLinks} />
              {fillError && <p role="alert" className="text-sm text-red-700 mt-2">{fillError}</p>}
            </div>
            <div className="p-6 pt-0 flex gap-3 shrink-0">
              <button disabled={fillSaving} onClick={() => { setFillModal(null); setFillType(""); setSelectedFillPatient(null); setFillError(""); setFillLinks({ doctor: "", doctorId: "", prescriptionId: "" }); }}
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 font-medium">Cancel</button>
              <button onClick={handleFill} disabled={!selectedFillPatient || fillSaving}
                className="flex-1 px-4 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed">
                Confirm Replacement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Viral Status Section ─────────────────────────────────────────────────────

function ViralStatusSection({ patients, onPatientUpdated }: { patients: Patient[]; onPatientUpdated: (patient: Patient) => void }) {
  const [editing, setEditing] = useState<Patient | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<ViralProfile>>({});
  const [search, setSearch] = useState("");

  const filtered = patients.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.uhid.toLowerCase().includes(search.toLowerCase())
  );

  const statusOpts: ViralStatusValue[] = ["Negative", "Positive", "Unknown", "Awaiting Report"];

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionHeader title="Viral Status Registry" subtitle="Manage hepatitis B, hepatitis C, and HIV status for all patients" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(["Negative", "Positive", "Unknown", "Awaiting Report"] as ViralStatusValue[]).map(s => (
          <div key={s} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 text-center">
            <ViralBadge status={s} />
            <p className="text-2xl font-bold text-slate-800 mt-2">
              {patients.filter(p => p.viralStatus.hepatitisB === s || p.viralStatus.hepatitisC === s || p.viralStatus.hiv === s).length}
            </p>
          </div>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search patient…"
          className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white" />
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                <th className="text-left px-5 py-3">Patient</th>
                <th className="text-left px-5 py-3">HBsAg</th>
                <th className="text-left px-5 py-3">Anti HCV</th>
                <th className="text-left px-5 py-3">HIV I/II</th>
                <th className="text-left px-5 py-3">Required Machine</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-800">{p.name}</p>
                    <p className="text-xs text-slate-400">{p.uhid}</p>
                  </td>
                  <td className="px-5 py-4"><ViralBadge status={p.viralStatus.hepatitisB} /></td>
                  <td className="px-5 py-4"><ViralBadge status={p.viralStatus.hepatitisC} /></td>
                  <td className="px-5 py-4"><ViralBadge status={p.viralStatus.hiv} /></td>
                  <td className="px-5 py-4"><CategoryBadge category={getRequiredCategory(p)} /></td>
                  <td className="px-5 py-4">
                    <button onClick={() => { setEditing(p); setDraft({ ...p.viralStatus }); }}
                      className="text-xs text-violet-600 hover:underline font-medium flex items-center gap-1">
                      <Edit3 className="w-3 h-3" /> Update
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md animate-fade-in p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-bold text-slate-800">Update Viral Status</h3>
                <p className="text-xs text-slate-400">{editing.name} · {editing.uhid}</p>
              </div>
              <button onClick={() => setEditing(null)} className="p-2 hover:bg-slate-100 rounded-xl"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <div className="space-y-4">
              {(["HBsAg (Hepatitis B)", "Anti HCV", "HIV I/II"] as const).map((label, i) => {
                const keys = ["hepatitisB", "hepatitisC", "hiv"] as const;
                const key = keys[i];
                return (
                  <div key={label}>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">{label}</label>
                    <select value={draft[key] ?? "Negative"}
                      onChange={e => setDraft(d => ({ ...d, [key]: e.target.value as ViralStatusValue }))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white">
                      {statusOpts.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditing(null)} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 font-medium">Cancel</button>
              <button onClick={async () => {
                try {
                  onPatientUpdated(await updatePatient(editing.id, { viralStatus: { ...editing.viralStatus, ...draft } }));
                  setEditing(null); setSaveError(null);
                } catch(error) { setSaveError(error instanceof Error ? error.message : "Viral status could not be saved."); }
              }} className="flex-1 px-4 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700">
                Save Changes
              </button>
            </div>
            {saveError && <p role="alert" className="text-sm text-red-600 mt-3">{saveError}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Register Patient Section ─────────────────────────────────────────────────

// ── Register Patient helpers — defined at module level so they are stable
// component identities across renders. Defining them inside the parent function
// caused React to treat them as new types on every keystroke, unmounting and
// remounting their subtrees (losing focus and triggering scroll jumps).

function RegCheckGroup({ options, selected, onChange }: { options: string[]; selected: string[]; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-3">
      {options.map(opt => (
        <label key={opt} className={`flex items-center gap-2 cursor-pointer px-3 py-2 rounded-xl border text-sm font-medium transition-all select-none ${
          selected.includes(opt)
            ? "bg-violet-50 border-violet-400 text-violet-800"
            : "bg-white border-slate-200 text-slate-600 hover:border-violet-200 hover:bg-violet-50/30"
        }`}>
          <input type="checkbox" checked={selected.includes(opt)} onChange={() => onChange(opt)}
            className="accent-violet-600 w-3.5 h-3.5" />
          {opt}
        </label>
      ))}
    </div>
  );
}

function RegRadioGroup({ options, selected, onChange }: { options: string[]; selected: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-3">
      {options.map(opt => (
        <button key={opt} type="button"
          onClick={() => onChange(selected === opt ? "" : opt)}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all select-none ${
            selected === opt
              ? "bg-violet-50 border-violet-400 text-violet-800"
              : "bg-white border-slate-200 text-slate-600 hover:border-violet-200 hover:bg-violet-50/30"
          }`}>
          <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${
            selected === opt ? "border-violet-600 bg-violet-600" : "border-slate-300 bg-white"
          }`}>
            {selected === opt && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
          </span>
          {opt}
        </button>
      ))}
    </div>
  );
}

function RegInvestRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-3 border-b border-slate-50 last:border-0">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{label}</p>
      {children}
    </div>
  );
}

// Module-level — must NOT be defined inside RegisterPatientSection.
// Inline component definitions inside a parent component get recreated on every
// re-render, causing React to unmount/remount the DOM nodes they wrap and
// destroying input focus after every keystroke.
function RegErrMsg({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
      <AlertCircle className="w-3 h-3 shrink-0" />{error}
    </p>
  );
}

function RegisterPatientSection({ onCreated }: { onCreated: (patient: Patient) => void }) {
  const labelCls = "block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5";

  // ── All form fields as controlled state ──────────────────────────────────
  // Personal Information
  const [name, setName]           = useState("");
  const [age, setAge]             = useState("");
  const [gender, setGender]       = useState("");
  const [mobile, setMobile]       = useState("");
  const [address, setAddress]     = useState("");
  const [city, setCity]           = useState("");
  const [bloodGroup, setBloodGroup] = useState("A+");
  const [registrationDate, setRegistrationDate] = useState("");
  const [patientStatus, setPatientStatus]       = useState("");

  // Medical Information
  const [nativeKidneyDisease, setNativeKidneyDisease] = useState("");
  const [insurance, setInsurance]                     = useState("");
  const [comorbidities, setComorbidities]             = useState<string[]>([]);
  const [dryWeight, setDryWeight] = useState("");
  const [weightGain, setWeightGain] = useState("");
  const [remarks, setRemarks]                         = useState("");
  const [accessAvf, setAccessAvf]                     = useState("");
  const [accessTunnelled, setAccessTunnelled]         = useState("");
  const [accessTemporary, setAccessTemporary]         = useState("");

  // Basic Investigation
  const [cbcHb, setCbcHb]             = useState("");
  const [cbcTlc, setCbcTlc]           = useState("");
  const [cbcPlt, setCbcPlt]           = useState("");
  const [cbcMcv, setCbcMcv]           = useState("");
  const [serumFerritin, setSerumFerritin] = useState("");
  const [serumCalcium, setSerumCalcium]   = useState("");
  const [thyroidT3, setThyroidT3]     = useState("");
  const [thyroidT4, setThyroidT4]     = useState("");
  const [thyroidTsh, setThyroidTsh]   = useState("");
  const [twoDEcho, setTwoDEcho]       = useState("");
  const [ef, setEf]                   = useState("");
  const [efError, setEfError]         = useState(false);
  const [serumPhos, setSerumPhos]     = useState("");
  const [rftUrea, setRftUrea]         = useState("");
  const [rftCreatinine, setRftCreatinine] = useState("");

  // LFT
  const [lftTotalProtein,    setLftTotalProtein]    = useState("");
  const [lftAlbumin,         setLftAlbumin]         = useState("");
  const [lftTotalBilirubin,  setLftTotalBilirubin]  = useState("");
  const [lftDirectBilirubin, setLftDirectBilirubin] = useState("");
  const [lftAst,             setLftAst]             = useState("");
  const [lftAlt,             setLftAlt]             = useState("");
  const [lftAlp,             setLftAlp]             = useState("");

  // Viral Panel
  const [hbsAg, setHbsAg] = useState("Negative");
  const [hcv, setHcv]     = useState("Negative");
  const [hiv, setHiv]     = useState("Negative");

  // OPD/IPD
  const [opdIpd, setOpdIpd] = useState("");

  // Dialysis Schedule
  const [dialysisDaysPerWeek, setDialysisDaysPerWeek] = useState<number | null>(null);
  const [dialysisDays, setDialysisDays] = useState<string[]>([]);

  // Date of Birth (three separate selects — avoids browser native date-picker year scrolling)
  const [dobDay, setDobDay]     = useState("");
  const [dobMonth, setDobMonth] = useState("");
  const [dobYear, setDobYear]   = useState("");

  // ── Submission state ─────────────────────────────────────────────────────
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Refs for scroll-to-error ──────────────────────────────────────────────
  const refs = {
    name:               useRef<HTMLDivElement>(null),
    age:                useRef<HTMLDivElement>(null),
    gender:             useRef<HTMLDivElement>(null),
    mobile:             useRef<HTMLDivElement>(null),
    address:            useRef<HTMLDivElement>(null),
    registrationDate:   useRef<HTMLDivElement>(null),
    patientStatus:      useRef<HTMLDivElement>(null),
    nativeKidneyDisease:useRef<HTMLDivElement>(null),
    dryWeight:          useRef<HTMLDivElement>(null),
    weightGain:         useRef<HTMLDivElement>(null),
    access:              useRef<HTMLDivElement>(null),
    opdIpd:              useRef<HTMLDivElement>(null),
    dialysisDaysPerWeek: useRef<HTMLDivElement>(null),
    dialysisDays:        useRef<HTMLDivElement>(null),
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const toggleArr = (arr: string[], set: (v: string[]) => void, val: string) =>
    set(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);

  const handleEf = (v: string) => {
    setEf(v);
    const n = Number(v);
    setEfError(v !== "" && (isNaN(n) || n < 0 || n > 100));
  };

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = () => {
    const e: Partial<Record<keyof typeof refs, string>> = {};
    if (!name.trim() || name.trim().length < 3)
      e.name = name.trim().length > 0 ? "Name must be at least 3 characters." : "Full name is required.";
    if (!age || Number(age) <= 0)
      e.age = "A valid age greater than 0 is required.";
    if (!gender)
      e.gender = "Please select a gender.";
    if (!mobile.trim() || !/^\d{10}$/.test(mobile.trim()))
      e.mobile = "Mobile number must be exactly 10 digits.";
    if (!address.trim())
      e.address = "Address is required.";
    if (!registrationDate)
      e.registrationDate = "Registration date is required.";
    if (!patientStatus)
      e.patientStatus = "Patient status is required.";
    if (!nativeKidneyDisease.trim())
      e.nativeKidneyDisease = "Native kidney disease is required.";
    if (dryWeight !== "" && (!Number.isFinite(Number(dryWeight)) || Number(dryWeight) <= 0))
      e.dryWeight = "Dry weight must be a number greater than 0 kg.";
    if (weightGain !== "" && (!Number.isFinite(Number(weightGain)) || Number(weightGain) < 0))
      e.weightGain = "Weight gain must be a number of at least 0 kg.";
    if (!accessAvf && !accessTunnelled && !accessTemporary)
      e.access = "Please enter a value for at least one access type (AVF, Tunnelled Catheter, or Temporary Catheter).";
    if (!opdIpd)
      e.opdIpd = "Please select OPD or IPD.";
    if (!dialysisDaysPerWeek)
      e.dialysisDaysPerWeek = "Please select how many days per week the patient requires dialysis.";
    if (dialysisDaysPerWeek && dialysisDays.length !== dialysisDaysPerWeek)
      e.dialysisDays = `Please select exactly ${dialysisDaysPerWeek} dialysis day${dialysisDaysPerWeek !== 1 ? "s" : ""}.${dialysisDays.length > 0 ? ` (${dialysisDays.length} selected)` : ""}`;
    return e;
  };

  const errors = attempted ? validate() : {};
  const hasErrors = Object.keys(validate()).length > 0;

  // ── Input class helpers ───────────────────────────────────────────────────
  const fldCls = (hasErr: boolean) =>
    `w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 bg-white transition-colors ${
      hasErr ? "border-red-400 focus:ring-red-200" : "border-slate-200 focus:ring-violet-300"
    }`;

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setAttempted(true);
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      const firstKey = Object.keys(errs)[0] as keyof typeof refs;
      refs[firstKey]?.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const uhid = `KMCRI-${Date.now()}`;
      const result = await createPatient({
        uhid, name, age: Number(age), gender, mobile, address, city, bloodGroup,
        primaryDisease: nativeKidneyDisease,
        insurance, comorbidities: comorbidities.join(", "), remarks, dialysisStartDate: registrationDate,
        treatmentStatus: patientStatus, viralStatus: { hepatitisB: hbsAg, hepatitisC: hcv, hiv, other: "" },
        dialysisDaysPerWeek, dialysisDays,
        dateOfBirth: dobYear && dobMonth && dobDay ? `${dobYear}-${String(["January","February","March","April","May","June","July","August","September","October","November","December"].indexOf(dobMonth)+1).padStart(2,"0")}-${dobDay.padStart(2,"0")}` : "",
        registeredDate: registrationDate,
        registrationFields: { registrationDate, nativeKidneyDisease, patientStatus, opdIpd },
        medicalInfo: {
          comorbidityFlags: {
            hypertension: comorbidities.includes("Hypertension"),
            diabetes: comorbidities.includes("Diabetes"),
            others: comorbidities.includes("Others"),
          },
          dryWeight: dryWeight === "" ? "" : Number(dryWeight),
          weightGain: weightGain === "" ? "" : Number(weightGain),
          avFistula: accessAvf, permacath: accessTunnelled, temporaryCatheter: accessTemporary, opdIpd,
          dialysisAccess: [accessAvf && accessAvf !== "No" ? "AVF" : "", accessTunnelled && accessTunnelled !== "No" ? "Permacath" : "", accessTemporary && accessTemporary !== "No" ? "Temp Catheter" : ""].filter(Boolean).join(", "),
        },
        investigations: {
          cbc: { hb: cbcHb, tlc: cbcTlc, plt: cbcPlt, mcv: cbcMcv },
          serumFerritin, serumCalcium, thyroidProfile: { t3: thyroidT3, t4: thyroidT4, tsh: thyroidTsh },
          twoDEcho, ejectionFraction: ef, serumPhosphorous: serumPhos,
          rft: { urea: rftUrea, creatinine: rftCreatinine },
          lft: { totalProtein: lftTotalProtein, albumin: lftAlbumin, totalBilirubin: lftTotalBilirubin,
            directBilirubin: lftDirectBilirubin, ast: lftAst, alt: lftAlt, alp: lftAlp },
        },
      });
      onCreated(result.patient as Patient);
      setSubmitted(true);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Patient could not be registered.");
    } finally { setSaving(false); }
  };

  // ── Success screen ────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-5">
          <CheckCircle className="w-10 h-10 text-emerald-600" />
        </div>
        <h3 className="text-2xl font-bold text-slate-800 mb-2">Patient Registered</h3>
        <p className="text-slate-400 text-sm mb-2">{name} has been added to the system.</p>
        <p className="text-slate-400 text-sm mb-8">The patient record is ready for machine assignment.</p>
        <button onClick={() => {
          setSubmitted(false); setAttempted(false);
          setName(""); setAge(""); setGender(""); setMobile(""); setAddress(""); setCity("");
          setRegistrationDate(""); setPatientStatus(""); setNativeKidneyDisease("");
          setInsurance("");
          setComorbidities([]); setDryWeight(""); setWeightGain("");
          setRemarks(""); setAccessAvf(""); setAccessTunnelled(""); setAccessTemporary(""); setOpdIpd("");
          setCbcHb(""); setCbcTlc(""); setCbcPlt(""); setCbcMcv("");
          setSerumFerritin(""); setSerumCalcium("");
          setThyroidT3(""); setThyroidT4(""); setThyroidTsh("");
          setTwoDEcho(""); setEf(""); setEfError(false); setSerumPhos("");
          setRftUrea(""); setRftCreatinine("");
          setLftTotalProtein(""); setLftAlbumin(""); setLftTotalBilirubin("");
          setLftDirectBilirubin(""); setLftAst(""); setLftAlt(""); setLftAlp("");
          setHbsAg("Negative"); setHcv("Negative"); setHiv("Negative");
          setDialysisDaysPerWeek(null); setDialysisDays([]);
          setDobDay(""); setDobMonth(""); setDobYear("");
        }} className="px-6 py-2.5 bg-violet-600 text-white rounded-xl font-semibold hover:bg-violet-700">
          Register Another Patient
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionHeader title="Register New Patient" subtitle="Add a new patient to the KMC-RI Dialysis Management System" />

      {/* Summary error banner — shown only after first submit attempt */}
      {attempted && hasErrors && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl animate-fade-in">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-red-800">Please complete all required fields before registering the patient.</p>
            <p className="text-xs text-red-600 mt-0.5">{Object.keys(validate()).length} field{Object.keys(validate()).length !== 1 ? "s" : ""} need attention — scroll up to review highlighted fields.</p>
          </div>
        </div>
      )}
      {saveError && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{saveError}</div>}

      {/* ── Personal Information ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
        <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-3">Personal Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <div ref={refs.name}>
            <label className={labelCls}>Full Name *</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className={fldCls(!!errors.name)} placeholder="Patient full name" />
            <RegErrMsg error={errors.name} />
          </div>

          <div ref={refs.age}>
            <label className={labelCls}>Age *</label>
            <input type="number" min={1} value={age} onChange={e => setAge(e.target.value)}
              className={fldCls(!!errors.age)} placeholder="Age in years" />
            <RegErrMsg error={errors.age} />
          </div>

          <div ref={refs.gender}>
            <label className={labelCls}>Gender *</label>
            <select value={gender} onChange={e => setGender(e.target.value)}
              className={fldCls(!!errors.gender)}>
              <option value="">Select gender…</option>
              <option>Male</option><option>Female</option><option>Other</option>
            </select>
            <RegErrMsg error={errors.gender} />
          </div>

          <div ref={refs.mobile}>
            <label className={labelCls}>Mobile Number *</label>
            <input type="tel" value={mobile} onChange={e => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
              className={fldCls(!!errors.mobile)} placeholder="10-digit mobile number" maxLength={10} />
            <RegErrMsg error={errors.mobile} />
          </div>

          <div>
            <label className={labelCls}>Blood Group</label>
            <select value={bloodGroup} onChange={e => setBloodGroup(e.target.value)} className={fldCls(false)}>
              <option>A+</option><option>A-</option><option>B+</option><option>B-</option>
              <option>AB+</option><option>AB-</option><option>O+</option><option>O-</option>
            </select>
          </div>

          <div>
            <label className={labelCls}>City</label>
            <input value={city} onChange={e => setCity(e.target.value)} className={fldCls(false)} placeholder="City" />
          </div>

          <div className="md:col-span-2">
            <label className={labelCls}>Date of Birth</label>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Day</label>
                <select value={dobDay} onChange={e => setDobDay(e.target.value)} className={fldCls(false)}>
                  <option value="">Day</option>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                    <option key={d} value={String(d)}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Month</label>
                <select value={dobMonth} onChange={e => setDobMonth(e.target.value)} className={fldCls(false)}>
                  <option value="">Month</option>
                  {["January","February","March","April","May","June","July","August","September","October","November","December"].map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Year</label>
                <select value={dobYear} onChange={e => setDobYear(e.target.value)} className={fldCls(false)}>
                  <option value="">Year</option>
                  {Array.from({ length: new Date().getFullYear() - 1919 }, (_, i) => new Date().getFullYear() - i).map(y => (
                    <option key={y} value={String(y)}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div ref={refs.registrationDate}>
            <label className={labelCls}>Registration Date *</label>
            <input type="date" value={registrationDate} onChange={e => setRegistrationDate(e.target.value)}
              className={fldCls(!!errors.registrationDate)}
              max={new Date().toISOString().split("T")[0]} />
            <RegErrMsg error={errors.registrationDate} />
          </div>

          <div ref={refs.address}>
            <label className={labelCls}>Address *</label>
            <input value={address} onChange={e => setAddress(e.target.value)}
              className={fldCls(!!errors.address)} placeholder="Full address" />
            <RegErrMsg error={errors.address} />
          </div>

          <div ref={refs.patientStatus}>
            <label className={labelCls}>Patient Status *</label>
            <select value={patientStatus} onChange={e => setPatientStatus(e.target.value)}
              className={fldCls(!!errors.patientStatus)}>
              <option value="">Select status…</option>
              <option>Active</option><option>Transplanted</option><option>Shifted</option>
              <option>Discontinued</option>
            </select>
            <RegErrMsg error={errors.patientStatus} />
          </div>

        </div>
      </div>

      {/* ── Medical Information ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
        <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-3">Medical Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <div ref={refs.nativeKidneyDisease}>
            <label className={labelCls}>Native Kidney Disease *</label>
            <input value={nativeKidneyDisease} onChange={e => setNativeKidneyDisease(e.target.value)}
              className={fldCls(!!errors.nativeKidneyDisease)} placeholder="e.g. Chronic Kidney Disease Stage 5" />
            <RegErrMsg error={errors.nativeKidneyDisease} />
          </div>

          <div>
            <label className={labelCls}>Scheme</label>
            <input value={insurance} onChange={e => setInsurance(e.target.value)}
              className={fldCls(false)} placeholder="Scheme or None" />
          </div>

          <div className="md:col-span-2">
            <label className={labelCls}>Comorbidities</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-1">
              {(["Hypertension", "Diabetes", "Others"] as const).map(condition => (
                <label key={condition}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-medium cursor-pointer transition-all ${
                    comorbidities.includes(condition)
                      ? "border-violet-500 bg-violet-50 text-violet-800"
                      : "border-slate-200 bg-white text-slate-600 hover:border-violet-300"
                  }`}>
                  <input type="checkbox" checked={comorbidities.includes(condition)}
                    onChange={() => toggleArr(comorbidities, setComorbidities, condition)}
                    className="h-4 w-4 accent-violet-600" />
                  {condition}
                </label>
              ))}
            </div>
          </div>

          <div className="md:col-span-2">
            <label className={labelCls}>Remarks</label>
            <input value={remarks} onChange={e => setRemarks(e.target.value)}
              className={fldCls(false)} placeholder="Special instructions or notes" />
          </div>
        </div>

        {/* Vitals */}
        <div className="border-t border-slate-100 pt-5">
          <h4 className="font-bold text-slate-800 mb-4">Vitals</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div ref={refs.dryWeight}>
              <label htmlFor="register-dry-weight" className={labelCls}>Dry Weight (kg)</label>
              <input id="register-dry-weight" type="number" min="0" step="any" inputMode="decimal" value={dryWeight}
                onChange={e => setDryWeight(e.target.value)} placeholder="e.g. 52.5"
                className={fldCls(!!errors.dryWeight)} />
              <RegErrMsg error={errors.dryWeight} />
            </div>
            <div ref={refs.weightGain}>
              <label htmlFor="register-weight-gain" className={labelCls}>Weight Gain (kg)</label>
              <input id="register-weight-gain" type="number" min="0" step="any" inputMode="decimal" value={weightGain}
                onChange={e => setWeightGain(e.target.value)} placeholder="e.g. 2.5"
                className={fldCls(!!errors.weightGain)} />
              <RegErrMsg error={errors.weightGain} />
            </div>
          </div>
        </div>

        {/* Access */}
        <div ref={refs.access}>
          <div className="border-t border-slate-100 pt-5">
            <label className={labelCls}>
              Access *
              {errors.access && <span className="ml-2 text-red-500 normal-case font-normal text-[10px]">(required — enter at least one)</span>}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
              {([
                ["AVF",                accessAvf,       setAccessAvf],
                ["Tunnelled Catheter", accessTunnelled, setAccessTunnelled],
                ["Temporary Catheter", accessTemporary, setAccessTemporary],
              ] as const).map(([lbl, val, setter]) => (
                <div key={lbl}>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{lbl}</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={val}
                    onChange={e => setter(e.target.value)}
                    placeholder="—"
                    className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 bg-white transition-colors ${
                      errors.access ? "border-red-400 focus:ring-red-200" : "border-slate-200 focus:ring-violet-300"
                    }`}
                  />
                </div>
              ))}
            </div>
            <RegErrMsg error={errors.access} />
          </div>
        </div>

        {/* Basic Investigation */}
        <div className="border-t border-slate-100 pt-5">
          <div className="flex items-center gap-2 mb-4">
            <FlaskConical className="w-4 h-4 text-violet-600" />
            <h4 className="font-bold text-slate-800">Basic Investigation</h4>
          </div>
          <div className="divide-y divide-slate-50">
            {/* CBC */}
            <RegInvestRow label="CBC">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {([["Hb", cbcHb, setCbcHb], ["TLC", cbcTlc, setCbcTlc], ["PLT", cbcPlt, setCbcPlt], ["MCV", cbcMcv, setCbcMcv]] as const).map(([lbl, val, setter]) => (
                  <div key={lbl}>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">{lbl}</label>
                    <input type="number" step="any" min="0" value={val}
                      onChange={e => setter(e.target.value)} placeholder="—"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white" />
                  </div>
                ))}
              </div>
            </RegInvestRow>

            {/* Renal Function Test — moved immediately after CBC */}
            <RegInvestRow label="Renal Function Test">
              <div className="grid grid-cols-2 gap-3">
                {([["Urea", rftUrea, setRftUrea], ["Serum Creatinine", rftCreatinine, setRftCreatinine]] as const).map(([lbl, val, setter]) => (
                  <div key={lbl}>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">{lbl}</label>
                    <input type="number" step="any" min="0" value={val}
                      onChange={e => setter(e.target.value)} placeholder="—"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white" />
                  </div>
                ))}
              </div>
            </RegInvestRow>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 py-3">
              <div>
                <label htmlFor="register-serum-ferritin" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Serum Ferritin</label>
                <input id="register-serum-ferritin" type="number" step="any" min="0" value={serumFerritin}
                  onChange={e => setSerumFerritin(e.target.value)} placeholder="—"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white" />
              </div>
              <div>
                <label htmlFor="register-serum-calcium" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Serum Calcium</label>
                <input id="register-serum-calcium" type="number" step="any" min="0" value={serumCalcium}
                  onChange={e => setSerumCalcium(e.target.value)} placeholder="—"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white" />
              </div>
              <div>
                <label htmlFor="register-serum-phosphorous" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Serum Phosphorous</label>
                <input id="register-serum-phosphorous" type="number" step="any" min="0" value={serumPhos}
                  onChange={e => setSerumPhos(e.target.value)} placeholder="—"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white" />
              </div>
            </div>

            {/* Thyroid Profile */}
            <RegInvestRow label="Thyroid Profile">
              <div className="grid grid-cols-3 gap-3">
                {([["T3", thyroidT3, setThyroidT3], ["T4", thyroidT4, setThyroidT4], ["TSH", thyroidTsh, setThyroidTsh]] as const).map(([lbl, val, setter]) => (
                  <div key={lbl}>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">{lbl}</label>
                    <input type="number" step="any" min="0" value={val}
                      onChange={e => setter(e.target.value)} placeholder="—"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white" />
                  </div>
                ))}
              </div>
            </RegInvestRow>

            {/* 2D Echo */}
            <RegInvestRow label="2D Echo">
              <input type="number" step="any" min="0" value={twoDEcho}
                onChange={e => setTwoDEcho(e.target.value)} placeholder="—"
                className="w-36 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white" />
            </RegInvestRow>

            {/* EF */}
            <RegInvestRow label="EF (Ejection Fraction)">
              <div className="flex items-center gap-3">
                <div className="relative w-32">
                  <input type="number" min={0} max={100} value={ef}
                    onChange={e => handleEf(e.target.value)} placeholder="e.g. 65"
                    className={`w-full px-3 py-2.5 pr-8 rounded-xl border text-sm focus:outline-none focus:ring-2 bg-white ${
                      efError ? "border-red-400 focus:ring-red-300 text-red-700" : "border-slate-200 focus:ring-violet-300"
                    }`} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium pointer-events-none">%</span>
                </div>
                {efError && <p className="text-xs text-red-600 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> Must be 0–100</p>}
                {!efError && ef !== "" && <p className="text-xs text-emerald-700 font-semibold">EF: {ef}%</p>}
              </div>
            </RegInvestRow>

          </div>
        </div>

        {/* LFT */}
        <div className="border-t border-slate-100 pt-5">
          <div className="flex items-center gap-2 mb-4">
            <FlaskConical className="w-4 h-4 text-blue-600" />
            <h4 className="font-bold text-slate-800">LFT</h4>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
            {([
              ["Total Protein",         "register-lft-total-protein"],
              ["Albumin",               "register-lft-albumin"],
              ["Total Bilirubin (TB)",  "register-lft-total-bilirubin"],
              ["Direct Bilirubin (DB)", "register-lft-direct-bilirubin"],
              ["AST",                   "register-lft-ast"],
              ["ALT",                   "register-lft-alt"],
              ["ALP",                   "register-lft-alp"],
            ] as const).map(([lbl, inputId]) => {
              const stateKey = lbl === "Total Protein"         ? [lftTotalProtein,     setLftTotalProtein]
                : lbl === "Albumin"               ? [lftAlbumin,          setLftAlbumin]
                : lbl === "Total Bilirubin (TB)"  ? [lftTotalBilirubin,   setLftTotalBilirubin]
                : lbl === "Direct Bilirubin (DB)" ? [lftDirectBilirubin,  setLftDirectBilirubin]
                : lbl === "AST"                   ? [lftAst,              setLftAst]
                : lbl === "ALT"                   ? [lftAlt,              setLftAlt]
                :                                   [lftAlp,              setLftAlp];
              const [val, setter] = stateKey as [string, (v: string) => void];
              return (
                <div key={lbl} className="min-w-0 flex flex-col">
                  <label htmlFor={inputId} className="block min-h-[2rem] text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 leading-tight">{lbl}</label>
                  <input id={inputId} type="number" step="any" min="0" value={val}
                    onChange={e => setter(e.target.value)} placeholder="—"
                    className="mt-auto w-full min-w-0 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white" />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Viral Panel ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
        <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-3">Viral Panel</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {([["HBsAg (Hep B)", hbsAg, setHbsAg, "register-viral-hbsag"], ["Anti HCV", hcv, setHcv, "register-viral-hcv"], ["HIV I/II", hiv, setHiv, "register-viral-hiv"]] as const).map(([lbl, val, setter, inputId]) => (
            <div key={lbl}>
              <label htmlFor={inputId} className={labelCls}>{lbl} *</label>
              <select id={inputId} value={val} onChange={e => setter(e.target.value)} className={fldCls(false)}>
                <option value="Negative">Negative</option>
                <option value="Positive">Positive</option>
                <option value="Unknown">Unknown</option>
                <option value="Awaiting Report">Awaiting Report</option>
              </select>
            </div>
          ))}
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex gap-2 text-xs text-blue-800">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-600" />
          Viral panel results determine machine category assignment during dialysis scheduling.
        </div>
      </div>

      {/* ── Dialysis Schedule ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
        <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-3">Dialysis Schedule</h3>

        {/* Days per week */}
        <div ref={refs.dialysisDaysPerWeek}>
          <label className={labelCls}>
            Dialysis Days Per Week *
            {errors.dialysisDaysPerWeek && <span className="ml-2 text-red-500 normal-case font-normal text-[10px]">(required)</span>}
          </label>
          <div className="flex flex-wrap gap-2">
            {[1,2,3,4,5,6,7].map(n => (
              <button key={n} type="button"
                onClick={() => {
                  setDialysisDaysPerWeek(n);
                  // If more days selected than new limit, trim selection
                  if (dialysisDays.length > n) setDialysisDays(dialysisDays.slice(0, n));
                }}
                className={`px-4 py-2 rounded-xl border-2 text-sm font-bold transition-all ${
                  dialysisDaysPerWeek === n
                    ? "border-violet-500 bg-violet-50 text-violet-800"
                    : "border-slate-200 bg-white text-slate-600 hover:border-violet-300"
                }`}>
                {n} {n === 1 ? "day" : "days"}
              </button>
            ))}
          </div>
          <RegErrMsg error={errors.dialysisDaysPerWeek} />
        </div>

        {/* Days of week */}
        <div ref={refs.dialysisDays}>
          <label className={labelCls}>
            Dialysis Days *
            {dialysisDaysPerWeek && (
              <span className="ml-2 normal-case font-normal text-slate-400 text-[11px]">
                Select exactly {dialysisDaysPerWeek} day{dialysisDaysPerWeek !== 1 ? "s" : ""} · {dialysisDays.length}/{dialysisDaysPerWeek} selected
              </span>
            )}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].map(day => {
              const isSelected = dialysisDays.includes(day);
              const atLimit = dialysisDaysPerWeek !== null && dialysisDays.length >= dialysisDaysPerWeek && !isSelected;
              return (
                <button key={day} type="button"
                  disabled={atLimit}
                  onClick={() => {
                    if (isSelected) {
                      setDialysisDays(dialysisDays.filter(d => d !== day));
                    } else if (!atLimit) {
                      setDialysisDays([...dialysisDays, day]);
                    }
                  }}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all text-left ${
                    isSelected
                      ? "border-violet-500 bg-violet-50 text-violet-800"
                      : atLimit
                        ? "border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed"
                        : "border-slate-200 bg-white text-slate-600 hover:border-violet-300"
                  }`}>
                  <div className={`w-4 h-4 rounded flex items-center justify-center border-2 shrink-0 ${
                    isSelected ? "border-violet-500 bg-violet-500" : "border-slate-300"
                  }`}>
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                  {day}
                </button>
              );
            })}
          </div>
          {dialysisDaysPerWeek && dialysisDays.length > 0 && dialysisDays.length !== dialysisDaysPerWeek && (
            <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {dialysisDays.length < dialysisDaysPerWeek
                ? `Select ${dialysisDaysPerWeek - dialysisDays.length} more day${dialysisDaysPerWeek - dialysisDays.length !== 1 ? "s" : ""}.`
                : `Too many days selected. Remove ${dialysisDays.length - dialysisDaysPerWeek}.`}
            </p>
          )}
          <RegErrMsg error={errors.dialysisDays} />
        </div>

        {dialysisDaysPerWeek && dialysisDays.length === dialysisDaysPerWeek && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-emerald-800">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>{dialysisDaysPerWeek}×/week</strong> — {dialysisDays.join(", ")}
            </span>
          </div>
        )}
      </div>

      {/* ── OPD / IPD ── */}
      <div ref={refs.opdIpd}>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <label className={labelCls}>
            OPD / IPD *
            {errors.opdIpd && <span className="ml-2 text-red-500 normal-case font-normal text-[10px]">(required)</span>}
          </label>
          <RegRadioGroup options={["OPD", "IPD"]} selected={opdIpd} onChange={setOpdIpd} />
          <RegErrMsg error={errors.opdIpd} />
        </div>
      </div>

      {/* Summary error re-shown near button for convenience */}
      {attempted && hasErrors && (
        <p className="text-center text-sm text-red-600 font-medium">
          Please complete all required fields before registering the patient.
        </p>
      )}

      <button
        onClick={handleSubmit}
        disabled={saving}
        className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm transition-colors shadow-lg ${
          saving
            ? "bg-violet-400 text-white cursor-not-allowed"
            : attempted && hasErrors
              ? "bg-slate-300 text-slate-500 cursor-not-allowed shadow-none"
              : "bg-violet-600 text-white hover:bg-violet-700 shadow-violet-200"
        }`}>
        {saving ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin" /> Saving…
          </>
        ) : (
          <>
            <UserPlus className="w-4 h-4" /> Register Patient
          </>
        )}
      </button>
    </div>
  );
}

// ─── Doctors Section ─────────────────────────────────────────────────────────

const SPECIALIZATIONS = [
  "Nephrology", "Renal Medicine", "Internal Medicine", "Urology",
  "Transplant Medicine", "Interventional Nephrology", "Dialysis & Critical Care",
];

function validateDoctorForm(form: {
  name: string; email: string; password: string; specialization: string;
}, existing: DoctorRecord[]): Partial<Record<"name" | "email" | "password" | "specialization", string>> {
  const e: Partial<Record<"name" | "email" | "password" | "specialization", string>> = {};
  if (!form.name.trim() || form.name.trim().length < 2) e.name = "Full name is required (min 2 characters).";
  if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = "A valid email address is required.";
  else if (existing.some(d => d.email.toLowerCase() === form.email.trim().toLowerCase())) e.email = "A doctor with this email already exists.";
  if (!form.password || form.password.length < 12) e.password = "Password must be at least 12 characters.";
  else if (!/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) e.password = "Password must contain at least one letter and one number.";
  if (!form.specialization) e.specialization = "Please select a specialization.";
  return e;
}

function DoctorsSection({ sessions }: { sessions: DialysisSession[] }) {
  const [doctors, setDoctors] = useState<DoctorRecord[]>([]);
  const [doctorError, setDoctorError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    fetchStaffAccounts().then(r => { if(active) setDoctors(r.users.filter(u=>u.role==="doctor")); })
      .catch(e=>{ if(active) setDoctorError(e.message); });
    return ()=>{active=false;};
  }, []);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<DoctorStatus | "All">("All");

  // Add Doctor modal
  const [showAdd, setShowAdd] = useState(false);
  const [addAttempted, setAddAttempted] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", email: "", password: "", specialization: "", phone: "", employeeId: "" });
  const [addSuccess, setAddSuccess] = useState(false);
  const [editingDoctorId, setEditingDoctorId] = useState<string | null>(null);

  // Delete / deactivate modal
  const [deleteTarget, setDeleteTarget] = useState<DoctorRecord | null>(null);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);

  // Status toggle confirmation
  const [toggleTarget, setToggleTarget] = useState<DoctorRecord | null>(null);

  const validationForm = editingDoctorId && !addForm.password ? { ...addForm, password: "unchanged-Password1" } : addForm;
  const validationDoctors = doctors.filter(d=>d.id!==editingDoctorId);
  const addErrors = addAttempted ? validateDoctorForm(validationForm, validationDoctors) : {};
  const addHasErrors = Object.keys(validateDoctorForm(validationForm, validationDoctors)).length > 0;

  const setField = (k: keyof typeof addForm, v: string) => setAddForm(f => ({ ...f, [k]: v }));

  const handleAdd = async () => {
    setAddAttempted(true);
    if (addHasErrors) return;
    setAddSaving(true);
    try {
      const result = editingDoctorId ? await updateStaffAccount(editingDoctorId,addForm) : await createStaffAccount({ ...addForm, role: "doctor" });
      setDoctors(prev => editingDoctorId ? prev.map(d=>d.id===result.user.id?result.user:d) : [result.user,...prev]);
      setAddSuccess(true);
      setDoctorError(null);
    } catch(error) { setDoctorError(error instanceof Error ? error.message : "Doctor could not be saved."); }
    finally { setAddSaving(false); }
  };

  const resetAdd = () => {
    setShowAdd(false); setAddAttempted(false); setAddSaving(false);
    setEditingDoctorId(null);
    setShowPassword(false); setAddSuccess(false);
    setAddForm({ name: "", email: "", password: "", specialization: "", phone: "", employeeId: "" });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      const result = await updateStaffAccount(deleteTarget.id, { status: "Inactive" });
      setDoctors(prev => prev.map(d=>d.id===result.user.id?result.user:d));
      setDeleteConfirmed(true); setDoctorError(null);
    } catch(error) { setDoctorError(error instanceof Error ? error.message : "Doctor could not be deactivated."); }
  };

  const handleToggleStatus = async (doc: DoctorRecord) => {
    try {
      const result = await updateStaffAccount(doc.id, { status: doc.status === "Active" ? "Inactive" : "Active" });
      setDoctors(prev => prev.map(d=>d.id===result.user.id?result.user:d));
      setToggleTarget(null); setDoctorError(null);
    } catch(error) { setDoctorError(error instanceof Error ? error.message : "Doctor status could not be saved."); }
  };

  const filtered = useMemo(() => doctors.filter(d => {
    if (filterStatus !== "All" && d.status !== filterStatus) return false;
    if (search && !d.name.toLowerCase().includes(search.toLowerCase()) && !d.email.toLowerCase().includes(search.toLowerCase()) && !d.employeeId.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [doctors, filterStatus, search]);

  const inputCls = "w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white";
  const errCls   = "w-full px-3 py-2.5 rounded-xl border border-red-400 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 bg-white";
  const labelCls = "block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5";

  const historyCount = (doc: DoctorRecord) =>
    sessions.filter(s => s.doctor === doc.name).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <SectionHeader title="Doctor Management" subtitle="View, add, and manage all registered doctors in the system" />
        {doctorError && <p role="alert" className="text-sm text-red-600">{doctorError}</p>}
        <button onClick={() => { setShowAdd(true); setAddSuccess(false); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700 transition-colors shadow-md shadow-violet-200">
          <Plus className="w-4 h-4" /> Add Doctor
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Doctors",    value: doctors.length,                               color: "bg-violet-50",  text: "text-violet-700" },
          { label: "Active",           value: doctors.filter(d => d.status === "Active").length,   color: "bg-emerald-50", text: "text-emerald-700" },
          { label: "Inactive",         value: doctors.filter(d => d.status === "Inactive").length, color: "bg-red-50",     text: "text-red-600" },
          { label: "Specializations",  value: new Set(doctors.map(d => d.specialization)).size,    color: "bg-blue-50",    text: "text-blue-700" },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl border border-slate-100 shadow-sm p-4 ${s.color}`}>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{s.label}</p>
            <p className={`text-3xl font-bold ${s.text}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Search name, email, or employee ID…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white" />
        </div>
        {(["All", "Active", "Inactive"] as const).map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
              filterStatus === s ? "bg-violet-600 text-white border-violet-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}>{s}</button>
        ))}
        <span className="text-xs text-slate-400 ml-auto">{filtered.length} doctor{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Doctor table */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-16 flex flex-col items-center gap-4">
          <Stethoscope className="w-12 h-12 text-slate-200" />
          <p className="text-slate-500 font-medium">
            {search || filterStatus !== "All" ? "No doctors match your filters." : "No doctors registered yet."}
          </p>
          {!search && filterStatus === "All" && (
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700">
              <Plus className="w-4 h-4" /> Add Doctor
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                  <th className="text-left px-5 py-3">Doctor</th>
                  <th className="text-left px-5 py-3">Employee ID</th>
                  <th className="text-left px-5 py-3">Specialization</th>
                  <th className="text-left px-5 py-3">Contact</th>
                  <th className="text-left px-5 py-3">Sessions</th>
                  <th className="text-left px-5 py-3">Status</th>
                  <th className="text-left px-5 py-3">Added</th>
                  <th className="px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(doc => (
                  <tr key={doc.id} className={`hover:bg-slate-50 transition-colors ${doc.status === "Inactive" ? "opacity-60" : ""}`}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                          <Stethoscope className="w-4 h-4 text-violet-600" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">{doc.name}</p>
                          <p className="text-xs text-slate-400">{doc.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-xs font-mono text-slate-600">{doc.employeeId}</td>
                    <td className="px-5 py-4">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-200">
                        {doc.specialization}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-500">{doc.phone}</td>
                    <td className="px-5 py-4 text-center">
                      <span className="text-sm font-bold text-slate-700">{historyCount(doc)}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        doc.status === "Active"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-600"
                      }`}>{doc.status}</span>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-400">{doc.dateAdded}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 justify-end">
                        <button onClick={()=> {
                          setEditingDoctorId(doc.id); setAddForm({name:doc.name,email:doc.email,password:"",
                            specialization:doc.specialization,phone:doc.phone,employeeId:doc.employeeId});
                          setAddSuccess(false); setAddAttempted(false); setShowAdd(true);
                        }} className="text-xs px-2.5 py-1.5 text-violet-600 border rounded-lg">Edit</button>
                        <button onClick={() => setToggleTarget(doc)}
                          className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-semibold border transition-colors ${
                            doc.status === "Active"
                              ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                          }`}>
                          {doc.status === "Active" ? <UserX className="w-3 h-3" /> : <UserCheck className="w-3 h-3" />}
                          {doc.status === "Active" ? "Deactivate" : "Activate"}
                        </button>
                        <button onClick={() => { setDeleteTarget(doc); setDeleteConfirmed(false); }}
                          className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 font-semibold transition-colors">
                          <Trash2 className="w-3 h-3" />
                          Deactivate
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Add Doctor Modal ── */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg animate-fade-in overflow-hidden max-h-[90vh] flex flex-col">
            <div className="bg-gradient-to-r from-violet-700 to-violet-900 px-6 py-5 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-white text-base">Add New Doctor</h3>
                <p className="text-violet-200 text-xs mt-0.5">Role is automatically set to Doctor — administrator role cannot be assigned here</p>
              </div>
              <button onClick={resetAdd} className="p-2 hover:bg-white/10 rounded-xl"><X className="w-5 h-5 text-white" /></button>
            </div>

            {addSuccess ? (
              <div className="flex flex-col items-center py-10 px-6 gap-4 animate-fade-in">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-emerald-600" />
                </div>
                <h4 className="text-lg font-bold text-slate-800">Doctor added successfully.</h4>
                <p className="text-sm text-slate-500 text-center">
                  {addForm.name.trim()} can now log in to the Doctor Portal using their email and password.
                </p>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 w-full text-xs space-y-1 text-slate-600">
                  <p>✓ Doctor profile created</p>
                  <p>✓ Role assigned: Doctor (not Administrator)</p>
                  <p>✓ Doctor Portal access granted</p>
                </div>
                <div className="flex gap-3 w-full pt-2">
                  <button onClick={resetAdd} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 font-medium">Close</button>
                  <button onClick={() => { setAddSuccess(false); setAddAttempted(false); setAddForm({ name: "", email: "", password: "", specialization: "", phone: "", employeeId: "" }); }}
                    className="flex-1 px-4 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700">
                    Add Another
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-y-auto flex-1 p-6 space-y-4">
                {doctorError && <p role="alert" className="text-sm text-red-600">{doctorError}</p>}
                {/* Name */}
                <div>
                  <label className={labelCls}>Full Name *</label>
                  <input value={addForm.name} onChange={e => setField("name", e.target.value)}
                    placeholder="e.g. Dr. Priya Sharma"
                    className={addErrors.name ? errCls : inputCls} />
                  {addErrors.name && <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{addErrors.name}</p>}
                </div>

                {/* Email */}
                <div>
                  <label className={labelCls}>Email *</label>
                  <input type="email" value={addForm.email} onChange={e => setField("email", e.target.value)}
                    placeholder="doctor@kmcri.in"
                    className={addErrors.email ? errCls : inputCls} />
                  {addErrors.email && <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{addErrors.email}</p>}
                </div>

                {/* Password */}
                <div>
                  <label className={labelCls}>Password *</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type={showPassword ? "text" : "password"} value={addForm.password}
                      onChange={e => setField("password", e.target.value)}
                      placeholder={editingDoctorId ? "Leave blank to keep the current password" : "Min 12 chars, include a number"}
                      className={`pl-9 pr-10 ${addErrors.password ? errCls : inputCls}`} />
                    <button type="button" onClick={() => setShowPassword(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {addErrors.password && <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{addErrors.password}</p>}
                </div>

                {/* Specialization */}
                <div>
                  <label className={labelCls}>Specialization *</label>
                  <select value={addForm.specialization} onChange={e => setField("specialization", e.target.value)}
                    className={addErrors.specialization ? errCls : inputCls}>
                    <option value="">Select specialization…</option>
                    {SPECIALIZATIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {addErrors.specialization && <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{addErrors.specialization}</p>}
                </div>

                {/* Optional fields */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Phone (optional)</label>
                    <input value={addForm.phone} onChange={e => setField("phone", e.target.value)}
                      placeholder="Contact number" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Employee ID (optional)</label>
                    <input value={addForm.employeeId} onChange={e => setField("employeeId", e.target.value)}
                      placeholder="e.g. EMP-201" className={inputCls} />
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex gap-2 text-xs text-blue-800">
                  <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-600" />
                  The new doctor will receive the <strong>Doctor</strong> role. Administrator access cannot be assigned through this form.
                </div>

                {addAttempted && Object.keys(addErrors).length > 0 && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                    <p className="text-xs text-red-800 font-medium">Please fix the errors above before adding the doctor.</p>
                  </div>
                )}
              </div>
            )}

            {!addSuccess && (
              <div className="flex gap-3 p-6 pt-0 shrink-0 border-t border-slate-100">
                <button onClick={resetAdd} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 font-medium">Cancel</button>
                <button onClick={handleAdd} disabled={addSaving}
                  className="flex-1 px-4 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700 disabled:opacity-50 shadow-lg shadow-violet-100 flex items-center justify-center gap-2">
                  {addSaving ? <><RefreshCw className="w-4 h-4 animate-spin" /> Saving…</> : <><UserPlus className="w-4 h-4" /> {editingDoctorId ? "Save Doctor" : "Add Doctor"}</>}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Status Toggle Confirmation ── */}
      {toggleTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm animate-fade-in p-6">
            <div className="flex items-center gap-3 mb-4">
              {toggleTarget.status === "Active"
                ? <UserX className="w-6 h-6 text-amber-600" />
                : <UserCheck className="w-6 h-6 text-emerald-600" />}
              <h3 className="font-bold text-slate-800 text-base">
                {toggleTarget.status === "Active" ? "Deactivate Doctor" : "Activate Doctor"}
              </h3>
            </div>
            <p className="text-sm text-slate-600 mb-1">
              {toggleTarget.status === "Active"
                ? `Deactivating ${toggleTarget.name} will prevent them from logging into the Doctor Portal.`
                : `Activating ${toggleTarget.name} will restore their Doctor Portal access.`}
            </p>
            <p className="text-xs text-slate-400 mb-5">Existing patient records and dialysis sessions will not be affected.</p>
            <div className="flex gap-3">
              <button onClick={() => setToggleTarget(null)} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 font-medium">Cancel</button>
              <button onClick={() => handleToggleStatus(toggleTarget)}
                className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white ${
                  toggleTarget.status === "Active" ? "bg-amber-600 hover:bg-amber-700" : "bg-emerald-600 hover:bg-emerald-700"
                }`}>
                {toggleTarget.status === "Active" ? "Deactivate" : "Activate"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete / Safe-Deactivate Confirmation ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm animate-fade-in p-6">
            {deleteConfirmed ? (
              <div className="flex flex-col items-center py-6 gap-3 animate-fade-in">
                <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-7 h-7 text-emerald-600" />
                </div>
                <h4 className="font-bold text-slate-800">
                  Doctor deactivated.
                </h4>
                <p className="text-xs text-slate-500 text-center">
                  {deleteTarget.hasHistoricalRecords
                    ? "The doctor's account is now inactive. All historical records are preserved."
                    : "The doctor is inactive. Their profile and records are preserved."}
                </p>
                <button onClick={() => { setDeleteTarget(null); setDeleteConfirmed(false); }}
                  className="mt-2 px-5 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700">
                  Done
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                    <Trash2 className="w-5 h-5 text-red-600" />
                  </div>
                  <h3 className="font-bold text-slate-800 text-base">
                    Deactivate Doctor
                  </h3>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4">
                  <p className="font-semibold text-slate-800">{deleteTarget.name}</p>
                  <p className="text-xs text-slate-400">{deleteTarget.email}</p>
                </div>

                {deleteTarget.hasHistoricalRecords ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5 flex gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800">
                      This doctor has <strong>{historyCount(deleteTarget)} dialysis session{historyCount(deleteTarget) !== 1 ? "s" : ""}</strong> in the records.
                      To preserve historical data, the account will be <strong>deactivated</strong> rather than permanently deleted.
                      All patient records will remain intact.
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-600 mb-5">
                    Deactivate this doctor? Access will be disabled and all historical records will be preserved.
                  </p>
                )}

                <div className="flex gap-3">
                  <button onClick={() => setDeleteTarget(null)} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 font-medium">Cancel</button>
                  <button onClick={handleDeleteConfirm}
                    className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700">
                    Deactivate Doctor
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main AdminApp ────────────────────────────────────────────────────────────

export default function AdminApp({
  prescriptions,
  setPrescriptions,
}: {
  prescriptions: AdminPrescription[];
  setPrescriptions: React.Dispatch<React.SetStateAction<AdminPrescription[]>>;
  rxNotifications: RxNotification[];
  markRxRead: (id: string) => void;
}) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<AdminData | null>(null);
  const [activeSection, setActiveSection] = useState<NavSection>("dashboard");
  const [activeSectionLabel, setActiveSectionLabel] = useState("Dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [prefillMachine, setPrefillMachine] = useState<Machine | null>(null);
  const [prefillPatientId, setPrefillPatientId] = useState<string | null>(null);
  const [prefillTodayOnly, setPrefillTodayOnly] = useState(false);
  const [prefillDate, setPrefillDate] = useState<string | null>(null);
  const [prescriptionTarget, setPrescriptionTarget] = useState<{ patientId: string; prescriptionId: string } | null>(null);

  const [patients, setPatients] = useState<Patient[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [units, setUnits] = useState<DialysisUnit[]>([]);
  const [sessions, setSessions] = useState<DialysisSession[]>(INITIAL_SESSIONS);
  const [notifications, setNotifications] = useState<StaffNotification[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);
  const { onDraftStateChange, confirmLeave } = usePrescriptionLeaveGuard();
  const applyStaffData = useCallback((records: StaffData) => {
    setPatients(records.patients); setMachines(records.machines); setUnits(records.units);
    setSessions(records.sessions); setPrescriptions(records.prescriptions);
    setNotifications(records.notifications);
  }, [setPrescriptions]);
  useStaffSync(isAuthenticated, applyStaffData, setStaffError);
  const onPatientUpdated = (patient: Patient) => setPatients(prev=>prev.map(p=>p.id===patient.id?patient:p));

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleAssigned = async (session: DialysisSession, _machineId: string) => {
    const created = await createSession({
      patientId: session.patientId, machineId: session.machineId, unitId: session.unit,
      date: session.date, slot: session.slot, status: "waiting", duration: session.duration,
      doctor: session.doctor, doctorId: session.doctorId, prescriptionId: session.prescriptionId, notes: session.notes,
      startTime: session.startTime, endTime: session.endTime, slotType: session.slotType,
      emergencyTime: session.emergencyTime,
    });
    const savedSession = created.session;
    setSessions(prev => [savedSession, ...prev.filter(existing => existing.id !== savedSession.id)]);
    setMachines(prev => prev.map(machine => machine.id === savedSession.machineId
      ? {
          ...machine,
          status: "scheduled",
          nextPatient: savedSession.patientName,
          nextAvailableTime: `${savedSession.date} · ${savedSession.slot}`,
        }
      : machine));
  };
  const applySessionUpdate = async (id: string, payload: SessionUpdatePayload, updates: Partial<DialysisSession>) => {
    const result = await updateSession(id, payload);
    setSessions(prev => prev.map(s => s.id === id ? { ...s, ...result.session, ...updates } : s));
    if (result.machines) {
      const updatedMachines = new Map(result.machines.map(machine => [machine.id, machine]));
      setMachines(prev => prev.map(machine => updatedMachines.get(machine.id) ?? machine));
    } else if (result.machine) {
      setMachines(prev => prev.map(machine => machine.id === result.machine!.id ? result.machine! : machine));
    }
  };
  const handleLogout = async () => {
    if (confirmLeave("Logout?")) {
      await logoutStaff();
      setIsAuthenticated(false);
      setCurrentUser(null);
    }
  };

  if (!isAuthenticated) {
    return (
      <AdminAuthPortal
        onAuthenticate={async data => {
          setStaffLoading(true); setStaffError(null);
          try {
            const records = await loadStaffData();
            setPatients(records.patients); setMachines(records.machines); setUnits(records.units);
            setSessions(records.sessions); setPrescriptions(records.prescriptions);
            setNotifications(records.notifications);
          } catch (error) {
            setStaffError(error instanceof Error ? error.message : "Saved administrator records could not be loaded.");
          } finally { setStaffLoading(false); }
          setCurrentUser(data);
          setIsAuthenticated(true);
        }}
        onBack={() => window.location.reload()}
      />
    );
  }

  const navigate = (section: NavSection, label: string, opts?: {
    machine?: Machine;
    patientId?: string;
    prescriptionId?: string;
    skipGuard?: boolean;
    todayOnly?: boolean;
    date?: string;
  }) => {
    if (section !== activeSection && !opts?.skipGuard && !confirmLeave()) return;
    setActiveSection(section);
    setActiveSectionLabel(label);
    setPrefillMachine(opts?.machine ?? null);
    setPrefillPatientId(opts?.patientId ?? null);
    setPrefillTodayOnly(Boolean(opts?.todayOnly));
    setPrefillDate(opts?.date ?? null);
    setPrescriptionTarget(section === "treatment-status" && opts?.prescriptionId
      ? { patientId: opts.patientId ?? "", prescriptionId: opts.prescriptionId }
      : null);
    setSidebarOpen(false);
  };
  const assignPatientToday = (patientId: string) => {
    if (!confirmLeave()) return;
    const date = localDateKey(new Date());
    setActiveSection("assign-patient");
    setActiveSectionLabel("Assign Patient");
    setPrefillMachine(null);
    setPrefillPatientId(patientId);
    setPrefillTodayOnly(true);
    setPrefillDate(date);
    setPrescriptionTarget(null);
    setSidebarOpen(false);
  };

  const markRead = async (id: string, read: boolean) => {
    const result = await markNotificationRead(id, read);
    setNotifications(previous => previous.map(notification =>
      notification.id === id ? result.notification : notification,
    ));
  };

  const markAllRead = async () => {
    const result = await markAllNotificationsRead();
    const markedIds = new Set(result.ids);
    setNotifications(previous => previous.map(notification =>
      markedIds.has(notification.id) ? { ...notification, read: true } : notification,
    ));
  };

  const openPrescriptionNotification = async (notification: StaffNotification) => {
    if (!confirmLeave()) return;
    const target = await openNotificationTarget(notification.id);
    const refreshed = await loadStaffData();
    applyStaffData(refreshed);
    const result = await markNotificationRead(notification.id, true);
    setNotifications(previous => previous.map(item =>
      item.id === notification.id ? result.notification : item,
    ));
    navigate("treatment-status", "Treatment Status", {
      patientId: target.patientId,
      prescriptionId: target.prescriptionId,
      skipGuard: true,
    });
  };

  const sidebarLinks: { section: NavSection; label: string; icon: React.ReactNode; highlight?: boolean; group: string }[] = [
    { section: "dashboard",        label: "Dashboard",         icon: <LayoutDashboard className="w-4 h-4" />, group: "main" },
    { section: "assign-patient",   label: "Assign Patient",    icon: <CalendarPlus className="w-4 h-4" />,    group: "main", highlight: true },
    { section: "live-schedule",    label: "Live Schedule",     icon: <Activity className="w-4 h-4" />,        group: "scheduling" },
    { section: "missed-slots",     label: "Missed Slots",      icon: <SkipForward className="w-4 h-4" />,     group: "scheduling" },
    { section: "patient-history",  label: "Patient History",   icon: <ClipboardList className="w-4 h-4" />,   group: "patients" },
    { section: "treatment-status", label: "Treatment Status",  icon: <HeartPulse className="w-4 h-4" />,      group: "patients" },
    { section: "search-patients",  label: "Search Patients",   icon: <Search className="w-4 h-4" />,          group: "patients" },
    { section: "machines",         label: "Machines",          icon: <Cpu className="w-4 h-4" />,             group: "resources" },
    { section: "viral-status",     label: "Viral Status",      icon: <FlaskConical className="w-4 h-4" />,    group: "resources" },
    { section: "register-patient", label: "Register Patient",  icon: <UserPlus className="w-4 h-4" />,        group: "resources" },
    { section: "doctors",          label: "Doctors",           icon: <Stethoscope className="w-4 h-4" />,     group: "resources" },
    { section: "notifications",    label: "Notifications",     icon: <Bell className="w-4 h-4" />,            group: "system" },
    { section: "analytics",        label: "Analytics",         icon: <BarChart3 className="w-4 h-4" />,       group: "system" },
  ];

  const renderContent = () => {
    switch (activeSection) {
      case "dashboard":
        return <DashboardSection patients={patients} machines={machines} sessions={sessions} units={units} onNavigate={navigate}
          onAssignToday={assignPatientToday}
          onUpdateSession={(id, payload) => applySessionUpdate(id, payload, {})} />;
      case "assign-patient":
        return <AssignPatientSection patients={patients} machines={machines} units={units} sessions={sessions}
          onAssigned={handleAssigned} prefillMachine={prefillMachine} prefillPatientId={prefillPatientId}
          todayOnly={prefillTodayOnly} prefillDate={prefillDate} />;
      case "live-schedule":
        return (
          <LiveScheduleSection
            sessions={sessions}
            units={units}
            onUpdateSession={async (id, updates) => {
              const currentStatus = updates.status ?? sessions.find(s => s.id === id)?.status ?? "Scheduled";
              const statusMap: Record<SessionStatus, SessionUpdatePayload["status"]> = {
                Scheduled: "scheduled", Waiting: "waiting", Called: "called", Running: "running",
                Completed: "completed", Missed: "missed", Cancelled: "cancelled",
              };
              const next = statusMap[currentStatus];
              await applySessionUpdate(id, { ...updates, status: next }, updates);
            }}
            onRecordOutcome={async (id, status, reason) => {
              const next = status === "Missed" ? "missed" : "cancelled";
              const updates: Partial<DialysisSession> = { status, attendance: status };
              const payload: SessionUpdatePayload = { status: next };
              if (status === "Missed" && reason) {
                payload.missedReason = reason;
                updates.missedReason = reason;
              }
              await applySessionUpdate(id, payload, updates);
            }}
          />
        );
      case "patient-history":   return <PatientHistorySection sessions={sessions} prescriptions={prescriptions} />;
      case "machines":          return <MachineSection machines={machines} patients={patients} sessions={sessions} units={units} onNavigate={navigate} />;
      case "viral-status":      return <ViralStatusSection patients={patients} onPatientUpdated={onPatientUpdated} />;
      case "register-patient":  return <RegisterPatientSection onCreated={patient => setPatients(prev => [patient, ...prev])} />;
      case "notifications":     return <StaffNotificationsPage
        notifications={notifications}
        onMarkRead={markRead}
        onMarkAllRead={markAllRead}
        onOpenPrescription={openPrescriptionNotification}
        accent="violet"
      />;
      case "treatment-status":  return <TreatmentStatusSection patients={patients} prescriptions={prescriptions} setPrescriptions={setPrescriptions} sessions={sessions} adminName={currentUser?.name ?? "Administrator"} onPatientUpdated={onPatientUpdated} onDraftStateChange={onDraftStateChange}
        targetPatientId={prescriptionTarget?.patientId}
        targetPrescriptionId={prescriptionTarget?.prescriptionId}
        onOpenSchedule={()=>navigate("live-schedule","Live Schedule")}
        onSessionStatus={(session,status)=>applySessionUpdate(session.id,{status},{status:({running:"Running",waiting:"Waiting",completed:"Completed"} as const)[status]})} />;
      case "search-patients":
        return (
          <SearchSection patients={patients} sessions={sessions} onNavigate={navigate}
            onAssignPatient={() => navigate("assign-patient", "Assign Patient")} />
        );
      case "doctors":
        return <DoctorsSection sessions={sessions} />;
      case "missed-slots":
        return (
          <MissedSlotsSection sessions={sessions} patients={patients} machines={machines}
            onFillSlot={async (_missed, replacement) => {
              await handleAssigned(replacement, replacement.machineId);
            }}
            onUpdateMissedReason={async (id, reason, otherText) => {
              try {
                await applySessionUpdate(id, { status: "missed", missedReason: reason, ...(otherText ? { missedReasonOther: otherText } : {}) }, {
                  missedReason: reason,
                  missedReasonOther: otherText || undefined,
                });
              } catch (error) { setStaffError(error instanceof Error ? error.message : "Missed-slot reason could not be saved."); }
            }} />
        );
      case "analytics":
        return <AnalyticsSection patients={patients} machines={machines} sessions={sessions} prescriptions={prescriptions} isAdmin />;
      default:
        return <DashboardSection patients={patients} machines={machines} sessions={sessions} units={units} onNavigate={navigate}
          onAssignToday={assignPatientToday}
          onUpdateSession={(id, payload) => applySessionUpdate(id, payload, {})} />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/20 to-slate-100 flex">
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] right-[-5%] w-96 h-96 rounded-full opacity-20 blur-3xl"
          style={{ background: "radial-gradient(circle, #7c3aed 0%, transparent 70%)" }} />
        <div className="absolute bottom-[-5%] left-[-5%] w-80 h-80 rounded-full opacity-10 blur-3xl"
          style={{ background: "radial-gradient(circle, #2563eb 0%, transparent 70%)" }} />
      </div>

      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 h-full z-40 transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"} w-56 bg-slate-900 flex flex-col shadow-2xl`}>
        <div className="px-4 py-5 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-violet-700 rounded-xl flex items-center justify-center shrink-0">
              <Syringe className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-tight">KMC-RI</p>
              <p className="text-slate-400 text-xs">Dialysis Admin</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {(["main", "scheduling", "patients", "resources", "system"] as const).map(group => {
            const items = sidebarLinks.filter(l => l.group === group);
            const groupLabels: Record<string, string> = { main: "", scheduling: "Scheduling", patients: "Patients", resources: "Resources", system: "System" };
            return (
              <div key={group} className={group !== "main" ? "mt-4" : ""}>
                {groupLabels[group] && (
                  <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest px-3 mb-1">{groupLabels[group]}</p>
                )}
                <div className="space-y-0.5">
                  {items.map(item => {
                    const isActive = activeSection === item.section;
                    return (
                      <button key={item.label} onClick={() => navigate(item.section, item.label)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
                          isActive
                            ? item.highlight ? "bg-violet-600 text-white shadow-lg shadow-violet-900/40" : "bg-slate-700/80 text-white"
                            : item.highlight ? "text-violet-400 hover:bg-violet-900/40 hover:text-violet-300" : "text-slate-400 hover:bg-slate-800 hover:text-white"
                        }`}>
                        <span className="shrink-0">{item.icon}</span>
                        <span className="truncate">{item.label}</span>
                        {item.label === "Notifications" && unreadCount > 0 && (
                          <span className="ml-auto w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold shrink-0">{unreadCount}</span>
                        )}
                        {item.label === "Missed Slots" && sessions.filter(s => s.attendance === "Missed").length > 0 && (
                          <span className="ml-auto w-5 h-5 bg-amber-500 text-white text-xs rounded-full flex items-center justify-center font-bold shrink-0">
                            {sessions.filter(s => s.attendance === "Missed").length}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-violet-700 rounded-xl flex items-center justify-center shrink-0">
              <UserCog className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold truncate">{currentUser?.name}</p>
              <p className="text-slate-400 text-xs">@{currentUser?.username}</p>
            </div>
            <button onClick={handleLogout} aria-label="Logout"
              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors shrink-0">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 md:ml-56 flex flex-col min-h-screen relative z-10">
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/60 px-4 md:px-6 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg">
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-base font-bold text-slate-800">{activeSectionLabel}</h1>
              <p className="text-xs text-slate-400 hidden sm:block">KMC-RI Hospital · Administrator Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate("assign-patient", "Assign Patient")}
              className="hidden sm:flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white rounded-xl text-xs font-bold hover:bg-violet-700 transition-colors">
              <CalendarPlus className="w-3.5 h-3.5" /> Assign Patient
            </button>
            <button onClick={() => navigate("notifications", "Notifications")}
              aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
              className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-rose-600 px-1 text-[10px] font-bold leading-none text-white">{unreadCount > 99 ? "99+" : unreadCount}</span>}
            </button>
            <div className="hidden sm:flex items-center gap-2 ml-1 pl-3 border-l border-slate-200">
              <p className="text-xs font-semibold text-slate-700">{currentUser?.name}</p>
              <button onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {sidebarOpen && (
          <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        <main className="flex-1 px-4 md:px-6 py-6 max-w-7xl w-full mx-auto">
          {(staffLoading || staffError) && (
            <div className={`mb-4 rounded-lg px-3 py-2 text-sm ${staffError ? "bg-red-50 text-red-700" : "bg-violet-50 text-violet-700"}`}>
              {staffError || "Loading saved administrator records…"}
            </div>
          )}
          {renderContent()}
        </main>

        <footer className="border-t border-slate-200/60 px-6 py-4 text-center text-xs text-slate-400 bg-white/50">
          KMC-RI Hospital · Dialysis Administrator Portal · All rights reserved
        </footer>
      </div>
    </div>
  );
}
