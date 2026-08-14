"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, ChevronUp, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { IntakeQuestionTemplate, QuestionType } from "@/types";

interface ClinicQuestion {
  id: string;
  clinic_id: string;
  template_id: string | null;
  inherit_global: boolean;
  question_text: string | null;
  question_type: QuestionType | null;
  options: string[] | null;
  sort_order: number;
  is_active: boolean;
  intake_question_templates: {
    question_text: string;
    question_type: QuestionType;
    options: string[] | null;
  } | null;
}

interface Props {
  clinicId: string;
  clinicQuestions: ClinicQuestion[];
  unlinkedTemplates: IntakeQuestionTemplate[];
}

export default function IntakeClient({
  clinicId,
  clinicQuestions: initial,
  unlinkedTemplates: initialTemplates,
}: Props) {
  const [questions, setQuestions] = useState(initial);
  const [templates, setTemplates] = useState(initialTemplates);
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customText, setCustomText] = useState("");
  const [customType, setCustomType] = useState<QuestionType>("text");
  const [customOptions, setCustomOptions] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const supabase = createClient();

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function toggleActive(q: ClinicQuestion) {
    const { error } = await supabase
      .from("clinic_intake_questions")
      .update({ is_active: !q.is_active })
      .eq("id", q.id);

    if (error) { showToast("Error: " + error.message); return; }
    setQuestions((prev) =>
      prev.map((x) => (x.id === q.id ? { ...x, is_active: !x.is_active } : x))
    );
  }

  async function addFromTemplate(template: IntakeQuestionTemplate) {
    const maxOrder = Math.max(0, ...questions.map((q) => q.sort_order));
    const { data, error } = await supabase
      .from("clinic_intake_questions")
      .insert({
        clinic_id: clinicId,
        template_id: template.id,
        inherit_global: true,
        sort_order: maxOrder + 1,
        is_active: true,
      })
      .select("*, intake_question_templates(question_text, question_type, options)")
      .single();

    if (error) { showToast("Error: " + error.message); return; }
    setQuestions((prev) => [...prev, data]);
    setTemplates((prev) => prev.filter((t) => t.id !== template.id));
    showToast("Question added");
  }

  async function addCustomQuestion(e: React.FormEvent) {
    e.preventDefault();
    const maxOrder = Math.max(0, ...questions.map((q) => q.sort_order));
    const opts =
      customType === "dropdown"
        ? customOptions.split(",").map((s) => s.trim()).filter(Boolean)
        : null;

    const { data, error } = await supabase
      .from("clinic_intake_questions")
      .insert({
        clinic_id: clinicId,
        template_id: null,
        inherit_global: false,
        question_text: customText,
        question_type: customType,
        options: opts,
        sort_order: maxOrder + 1,
        is_active: true,
      })
      .select("*, intake_question_templates(question_text, question_type, options)")
      .single();

    if (error) { showToast("Error: " + error.message); return; }
    setQuestions((prev) => [...prev, data]);
    setCustomText("");
    setCustomType("text");
    setCustomOptions("");
    setShowAddCustom(false);
    showToast("Custom question added");
  }

  async function moveQuestion(idx: number, dir: "up" | "down") {
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= questions.length) return;

    const updated = [...questions];
    const a = updated[idx];
    const b = updated[swapIdx];
    updated[idx] = { ...b, sort_order: a.sort_order };
    updated[swapIdx] = { ...a, sort_order: b.sort_order };

    setQuestions(updated);

    await Promise.all([
      supabase.from("clinic_intake_questions").update({ sort_order: a.sort_order }).eq("id", b.id),
      supabase.from("clinic_intake_questions").update({ sort_order: b.sort_order }).eq("id", a.id),
    ]);
  }

  function getQuestionText(q: ClinicQuestion) {
    return q.inherit_global
      ? q.intake_question_templates?.question_text ?? "—"
      : q.question_text ?? "—";
  }

  function getQuestionType(q: ClinicQuestion) {
    return q.inherit_global
      ? q.intake_question_templates?.question_type ?? "text"
      : q.question_type ?? "text";
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/settings"
          className="inline-flex items-center gap-2 text-sm text-[#475569] hover:text-[#0B5AA8] transition-colors"
        >
          <ArrowLeft size={16} />
          Settings
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Intake Questions</h1>
          <p className="text-sm text-[#475569] mt-0.5">
            Questions shown to patients before their appointment
          </p>
        </div>
      </div>

      {/* Current questions */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
          <h2 className="font-semibold text-[#0F172A]">
            Active Questions ({questions.filter((q) => q.is_active).length})
          </h2>
        </div>

        {questions.length === 0 ? (
          <div className="text-center py-12 text-[#475569] text-sm">
            No questions configured yet.
          </div>
        ) : (
          <ul className="divide-y divide-[#E2E8F0]">
            {questions.map((q, idx) => (
              <li
                key={q.id}
                className={`flex items-center gap-4 px-5 py-4 ${
                  !q.is_active ? "opacity-50" : ""
                }`}
              >
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={() => moveQuestion(idx, "up")}
                    disabled={idx === 0}
                    className="text-[#475569] hover:text-[#0F172A] disabled:opacity-30"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    onClick={() => moveQuestion(idx, "down")}
                    disabled={idx === questions.length - 1}
                    className="text-[#475569] hover:text-[#0F172A] disabled:opacity-30"
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#0F172A] truncate">
                    {getQuestionText(q)}
                  </p>
                  <p className="text-xs text-[#475569]">
                    {getQuestionType(q)}
                    {q.inherit_global && (
                      <span className="ml-2 bg-blue-50 text-[#0B5AA8] px-1.5 py-0.5 rounded text-xs">
                        global
                      </span>
                    )}
                  </p>
                </div>

                <button
                  onClick={() => toggleActive(q)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors min-h-[36px] ${
                    q.is_active
                      ? "bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-[#EF4444]"
                      : "bg-emerald-50 text-[#0FAE7B] hover:bg-emerald-100"
                  }`}
                >
                  {q.is_active ? "Deactivate" : "Activate"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Add from templates */}
      {templates.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 mb-6">
          <h2 className="font-semibold text-[#0F172A] mb-3">Add from Global Templates</h2>
          <div className="space-y-2">
            {templates.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between px-4 py-3 bg-[#F7FAFC] rounded-lg"
              >
                <div>
                  <p className="text-sm font-medium text-[#0F172A]">{t.question_text}</p>
                  <p className="text-xs text-[#475569]">{t.question_type}</p>
                </div>
                <button
                  onClick={() => addFromTemplate(t)}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-[#0B5AA8] text-white rounded-lg hover:bg-[#083E78] transition-colors"
                >
                  <Plus size={12} />
                  Add
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add custom question */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-[#0F172A]">Add Custom Question</h2>
          {!showAddCustom && (
            <button
              onClick={() => setShowAddCustom(true)}
              className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 bg-[#F7FAFC] border border-[#E2E8F0] rounded-lg hover:bg-[#E2E8F0] transition-colors"
            >
              <Plus size={14} />
              New Question
            </button>
          )}
        </div>

        {showAddCustom && (
          <form onSubmit={addCustomQuestion} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-[#0F172A] mb-1">
                Question text
              </label>
              <input
                required
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-[#E2E8F0] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B5AA8]"
                placeholder="e.g. Do you have any allergies?"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#0F172A] mb-1">
                Type
              </label>
              <select
                value={customType}
                onChange={(e) => setCustomType(e.target.value as QuestionType)}
                className="w-full px-3 py-2.5 rounded-lg border border-[#E2E8F0] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B5AA8]"
              >
                <option value="text">Text</option>
                <option value="boolean">Yes / No</option>
                <option value="scale">Scale (1–10)</option>
                <option value="dropdown">Dropdown</option>
              </select>
            </div>

            {customType === "dropdown" && (
              <div>
                <label className="block text-sm font-medium text-[#0F172A] mb-1">
                  Options (comma-separated)
                </label>
                <input
                  value={customOptions}
                  onChange={(e) => setCustomOptions(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-[#E2E8F0] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B5AA8]"
                  placeholder="Option 1, Option 2, Option 3"
                />
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowAddCustom(false)}
                className="px-4 py-2.5 border border-[#E2E8F0] rounded-lg text-sm font-medium text-[#475569] hover:bg-[#F7FAFC] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2.5 bg-[#0B5AA8] hover:bg-[#083E78] text-white rounded-lg text-sm font-medium transition-colors"
              >
                Add Question
              </button>
            </div>
          </form>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#0F172A] text-white text-sm font-medium px-5 py-3 rounded-xl shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
