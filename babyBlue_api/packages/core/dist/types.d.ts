import type { IdType } from "./identity.js";
import type { ConsentMethod, ConsentType } from "./consent.js";
export type { IdType } from "./identity.js";
export type { ConsentMethod, ConsentType } from "./consent.js";
export type AppointmentStatus = "scheduled" | "waiting" | "in_consultation" | "done" | "cancelled";
export type UserRole = "admin" | "reception" | "doctor";
export type QuestionType = "text" | "dropdown" | "scale" | "boolean";
export type ActorType = "patient" | "staff";
export interface Clinic {
    id: string;
    name: string;
    slug: string;
    address: string | null;
    phone: string | null;
    avg_consultation_minutes: number;
    created_at: string;
}
export interface Profile {
    id: string;
    clinic_id: string;
    role: UserRole;
    full_name: string | null;
    created_at: string;
}
/**
 * Global patient identity — one row per human across all practices
 * (restructure Seam 1). Lives in the `people` table; service-role access
 * only. The durable cross-practice key is the (confirmed) WhatsApp number,
 * with the national ID as a secondary key. Never assume `phone` is WhatsApp.
 */
export interface Person {
    id: string;
    first_name: string;
    last_name: string;
    phone: string | null;
    whatsapp_number: string | null;
    whatsapp_confirmed: boolean;
    id_type: IdType | null;
    id_number: string | null;
    dob: string | null;
    nationality: string | null;
    email: string | null;
    created_at: string;
}
export interface Patient {
    id: string;
    clinic_id: string;
    /** Link to the global {@link Person} identity (Seam 1). */
    person_id: string | null;
    name: string;
    phone: string;
    email: string | null;
    dob: string | null;
    created_at: string;
    nationality: string | null;
    id_type: IdType | null;
    id_number: string | null;
    allergies: string | null;
    chronic_conditions: string | null;
    current_medications: string | null;
    blood_type: string | null;
    clinical_notes: string | null;
    record_updated_at: string | null;
}
/**
 * Vocabulary alias: `Patient` IS the per-practice record (clinic-scoped
 * clinical file) in the Seam 1 model. Prefer `PracticePatient` in new code
 * that also deals with the global {@link Person}.
 */
export type PracticePatient = Patient;
export interface Appointment {
    id: string;
    clinic_id: string;
    patient_id: string;
    status: AppointmentStatus;
    appointment_date: string;
    access_token: string;
    entered_queue_at: string;
    consultation_started_at: string | null;
    completed_at: string | null;
    notes: string | null;
    created_at: string;
}
export interface AppointmentWithPatient extends Appointment {
    patients: Pick<Patient, "id" | "name" | "phone">;
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
export type DocType = "historical_file" | "referral" | "lab_result" | "id_document" | "other";
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
/** A clinic intake question resolved for a given appointment. */
export interface ResolvedQuestion {
    id: string;
    question_key: string;
    question_text: string;
    question_type: QuestionType;
    options: string[] | null;
    sort_order: number;
}
export interface JoinQueueResponse {
    appointment_id: string;
    access_token: string;
    clinic_name: string;
    position: number;
    is_reconnect: boolean;
}
export interface AppointmentView {
    appointment: {
        id: string;
        status: AppointmentStatus;
        entered_queue_at: string;
        consultation_started_at: string | null;
        completed_at: string | null;
    };
    position: number;
    estimated_wait_minutes: number;
    estimated_wait_range: {
        min: number;
        max: number;
    } | null;
    clinic: {
        name: string;
        address: string | null;
    };
    intake_submitted: boolean;
    feedback_submitted: boolean;
    questions: ResolvedQuestion[];
}
export interface PatientSession {
    appointmentId: string;
    accessToken: string;
    clinicSlug: string;
}
export interface PatientInfo {
    name: string;
    phone: string;
    nationality?: string;
    id_type?: IdType;
    id_number?: string;
}
//# sourceMappingURL=types.d.ts.map