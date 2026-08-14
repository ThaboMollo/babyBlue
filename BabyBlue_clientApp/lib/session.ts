import type { PatientSession, PatientInfo } from "./supabase/types";

const KEY = "babyblue_session";
const PATIENT_KEY = "babyblue_patient";

export function saveSession(session: PatientSession): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(session));
}

export function loadSession(): PatientSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PatientSession;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}

export function savePatientInfo(info: PatientInfo): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PATIENT_KEY, JSON.stringify(info));
}

export function loadPatientInfo(): PatientInfo | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PATIENT_KEY);
    if (!raw) return null;
    const info = JSON.parse(raw) as PatientInfo;
    return info.name && info.phone ? info : null;
  } catch {
    return null;
  }
}

export function clearPatientInfo(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PATIENT_KEY);
}
