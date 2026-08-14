export type AppointmentStatus =
  | "scheduled"
  | "waiting"
  | "in_consultation"
  | "done"
  | "cancelled";

export type QuestionType = "text" | "dropdown" | "scale" | "boolean";

export type ActorType = "patient" | "staff";

export type UserRole = "admin" | "reception" | "doctor";

export interface Database {
  public: {
    Tables: {
      clinics: {
        Row: {
          id: string;
          name: string;
          slug: string;
          address: string | null;
          phone: string | null;
          avg_consultation_minutes: number;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["clinics"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["clinics"]["Insert"]>;
      };
      profiles: {
        Row: {
          id: string;
          clinic_id: string;
          role: UserRole;
          full_name: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["profiles"]["Row"], "created_at">;
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      patients: {
        Row: {
          id: string;
          clinic_id: string;
          name: string;
          phone: string;
          email: string | null;
          dob: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["patients"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["patients"]["Insert"]>;
      };
      appointments: {
        Row: {
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
        };
        Insert: Omit<
          Database["public"]["Tables"]["appointments"]["Row"],
          "id" | "access_token" | "created_at"
        >;
        Update: Partial<Database["public"]["Tables"]["appointments"]["Insert"]>;
      };
      intake_question_templates: {
        Row: {
          id: string;
          question_key: string;
          question_text: string;
          question_type: QuestionType;
          options: string[] | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["intake_question_templates"]["Row"],
          "id" | "created_at"
        >;
        Update: Partial<Database["public"]["Tables"]["intake_question_templates"]["Insert"]>;
      };
      clinic_intake_questions: {
        Row: {
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
        };
        Insert: Omit<
          Database["public"]["Tables"]["clinic_intake_questions"]["Row"],
          "id" | "created_at"
        >;
        Update: Partial<Database["public"]["Tables"]["clinic_intake_questions"]["Insert"]>;
      };
      intake_responses: {
        Row: {
          id: string;
          appointment_id: string;
          clinic_id: string;
          question_id: string | null;
          question_key: string;
          question_text: string;
          answer: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["intake_responses"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["intake_responses"]["Insert"]>;
      };
      appointment_events: {
        Row: {
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
        };
        Insert: Omit<Database["public"]["Tables"]["appointment_events"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["appointment_events"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

// --- Convenience types used across the app ---

export type Clinic = Database["public"]["Tables"]["clinics"]["Row"];
export type Appointment = Database["public"]["Tables"]["appointments"]["Row"];
export type IntakeQuestionTemplate =
  Database["public"]["Tables"]["intake_question_templates"]["Row"];
export type ClinicIntakeQuestion =
  Database["public"]["Tables"]["clinic_intake_questions"]["Row"];
export type IntakeResponse = Database["public"]["Tables"]["intake_responses"]["Row"];

// What the Edge Functions return
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
  estimated_wait_range: { min: number; max: number } | null;
  clinic: {
    name: string;
    address: string | null;
  };
  intake_submitted: boolean;
  feedback_submitted: boolean;
  questions: ResolvedQuestion[];
}

export interface ResolvedQuestion {
  id: string;
  question_key: string;
  question_text: string;
  question_type: QuestionType;
  options: string[] | null;
  sort_order: number;
}

// Stored in localStorage
export interface PatientSession {
  appointmentId: string;
  accessToken: string;
  clinicSlug: string;
}

// Stored in localStorage separately from the session, so returning
// patients get a prefilled join form after the visit is long gone
export interface PatientInfo {
  name: string;
  phone: string;
  nationality?: string;
  id_type?: "rsa_id" | "passport" | "asylum";
  id_number?: string;
}
