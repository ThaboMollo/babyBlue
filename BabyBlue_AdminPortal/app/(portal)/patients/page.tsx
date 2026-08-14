import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function PatientsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("clinic_id")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/onboarding");

  const { data: patients } = await supabase
    .from("patients")
    .select("id, name, phone, email, dob, created_at")
    .eq("clinic_id", profile.clinic_id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#0F172A] mb-6">Patients</h1>

      <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
        {!patients || patients.length === 0 ? (
          <div className="text-center py-16 text-[#475569] text-sm">
            No patients yet. Add a walk-in from the queue screen.
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F7FAFC]">
                <th className="text-left text-xs font-semibold text-[#475569] uppercase tracking-wider px-4 py-3">
                  Name
                </th>
                <th className="text-left text-xs font-semibold text-[#475569] uppercase tracking-wider px-4 py-3">
                  Phone
                </th>
                <th className="text-left text-xs font-semibold text-[#475569] uppercase tracking-wider px-4 py-3">
                  Email
                </th>
                <th className="text-left text-xs font-semibold text-[#475569] uppercase tracking-wider px-4 py-3">
                  DOB
                </th>
                <th className="text-left text-xs font-semibold text-[#475569] uppercase tracking-wider px-4 py-3">
                  Added
                </th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F7FAFC]"
                >
                  <td className="px-4 py-3 text-sm font-medium">
                    <Link
                      href={`/patients/${p.id}`}
                      className="text-[#0B5AA8] hover:underline"
                    >
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#475569]">{p.phone}</td>
                  <td className="px-4 py-3 text-sm text-[#475569]">
                    {p.email ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#475569]">
                    {p.dob
                      ? new Date(p.dob).toLocaleDateString("en-ZA")
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#475569]">
                    {new Date(p.created_at).toLocaleDateString("en-ZA")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
