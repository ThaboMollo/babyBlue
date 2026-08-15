export interface Clinic {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  phone: string | null;
  city: string | null;
  suburb: string | null;
  booking_mode: "request" | "live";
}

export interface Practitioner {
  id: string;
  clinic_id: string;
  first_name: string;
  last_name: string;
  slug: string;
  title: string | null;
  specialty: string | null;
  bio: string | null;
}

export interface Service {
  id: string;
  clinic_id: string;
  name: string;
  slug: string;
  duration_minutes: number;
  description: string | null;
}

export interface Slot {
  start: string;
  remaining: number;
}
