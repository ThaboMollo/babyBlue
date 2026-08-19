export type AppointmentStatus =
  | "scheduled"
  | "waiting"
  | "in_consultation"
  | "done"
  | "cancelled";

export type UserRole = "admin" | "reception" | "doctor";
export type QuestionType = "text" | "dropdown" | "scale" | "boolean";
export type ActorType = "patient" | "staff";

export type ClinicStatus = "pending" | "active" | "suspended";

export interface Clinic {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  phone: string | null;
  avg_consultation_minutes: number;
  status: ClinicStatus;
  created_at: string;
}

export interface Profile {
  id: string;
  clinic_id: string;
  role: UserRole;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  created_at: string;
}

export type IdType = "rsa_id" | "passport" | "asylum";

export interface Patient {
  id: string;
  clinic_id: string;
  name: string;
  phone: string;
  email: string | null;
  dob: string | null;
  created_at: string;
  // Identity (Patient File)
  nationality: string | null;
  id_type: IdType | null;
  id_number: string | null;
  // Clinical summary (Patient File)
  allergies: string | null;
  chronic_conditions: string | null;
  current_medications: string | null;
  blood_type: string | null;
  clinical_notes: string | null;
  record_updated_at: string | null;
}

export interface Appointment {
  id: string;
  clinic_id: string;
  patient_id: string;
  status: AppointmentStatus;
  appointment_date: string;
  access_token: string; // NEVER display in UI
  entered_queue_at: string;
  consultation_started_at: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface IntakeResponse {
  id: string;
  appointment_id: string;
  clinic_id: string;
  question_id: string | null;
  question_key: string;
  question_text: string;
  answer: string;
  created_at: string;
}

export interface AppointmentEvent {
  id: string;
  clinic_id: string;
  appointment_id: string;
  actor_type: ActorType;
  actor_user_id: string | null;
  event_type: string;
  from_status: AppointmentStatus | null;
  to_status: AppointmentStatus | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface ClinicIntakeQuestion {
  id: string;
  clinic_id: string;
  template_id: string | null;
  inherit_global: boolean;
  question_text: string | null;
  question_type: QuestionType | null;
  options: string[] | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface IntakeQuestionTemplate {
  id: string;
  question_key: string;
  question_text: string;
  question_type: QuestionType;
  options: string[] | null;
  sort_order: number;
  is_active: boolean;
}

export interface AppointmentWithPatient extends Appointment {
  patients: Pick<Patient, "id" | "name" | "phone">;
}

// ── Patient File ──────────────────────────────────────────

export interface VisitFeedback {
  id: string;
  appointment_id: string;
  clinic_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface VisitNote {
  id: string;
  clinic_id: string;
  appointment_id: string;
  patient_id: string;
  author_id: string | null;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  created_at: string;
  updated_at: string;
}

export type DocType =
  | "historical_file"
  | "referral"
  | "lab_result"
  | "id_document"
  | "other";

export interface PatientDocument {
  id: string;
  clinic_id: string;
  patient_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  doc_type: DocType | null;
  source: "digitised" | "uploaded";
  original_date: string | null;
  uploaded_by: string | null;
  ocr_text: string | null;
  created_at: string;
}

export type ConsentType = "records_storage" | "data_processing";
export type ConsentMethod = "patient_app" | "reception_verbal" | "signed_form";

export interface PatientConsent {
  id: string;
  clinic_id: string;
  patient_id: string;
  consent_type: ConsentType;
  granted: boolean;
  method: ConsentMethod | null;
  captured_by: string | null;
  granted_at: string;
  revoked_at: string | null;
}

/** One visit on the timeline, with its per-visit children joined in. */
export interface TimelineVisit extends Appointment {
  intake_responses: IntakeResponse[];
  appointment_events: AppointmentEvent[];
  visit_feedback: VisitFeedback | null;
  visit_note: VisitNote | null;
}
