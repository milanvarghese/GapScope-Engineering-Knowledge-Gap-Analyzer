"use client";

import { useState } from "react";

interface SkillChipsProps {
  skills: string[];
  onChange: (skills: string[]) => void;
}

export default function SkillChips({ skills, onChange }: SkillChipsProps) {
  const [input, setInput] = useState("");

  function addSkill(raw: string) {
    const v = raw.trim();
    if (!v || skills.includes(v)) return;
    onChange([...skills, v]);
  }

  function removeSkill(skill: string) {
    onChange(skills.filter((s) => s !== skill));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addSkill(input);
      setInput("");
    } else if (e.key === "Backspace" && input === "" && skills.length > 0) {
      onChange(skills.slice(0, -1));
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        {Array.from(new Set(skills)).map((s) => (
          <span
            key={s}
            className="inline-flex items-center gap-1.5 font-mono text-xs px-2.5 py-1 bg-[var(--canvas-3)] border border-[var(--amber-dim)] text-[var(--amber)]"
          >
            {s}
            <button
              type="button"
              onClick={() => removeSkill(s)}
              className="text-[var(--amber-dim)] hover:text-[var(--amber-glow)] leading-none transition-colors"
              aria-label={`Remove ${s}`}
            >
              ✕
            </button>
          </span>
        ))}
        {skills.length === 0 && (
          <span className="font-mono text-xs text-[var(--ink-muted)]">
            No skills yet — add below or upload a résumé.
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="add skill (Enter or ,)"
          aria-label="Add skill"
          className="flex-1 bg-[var(--canvas-3)] border border-[var(--rule-bright)] text-[var(--ink)] font-mono text-xs px-3 py-1.5 placeholder-[var(--ink-muted)] focus:outline-none focus:border-[var(--amber-dim)] transition-colors duration-150"
        />
        <button
          type="button"
          onClick={() => { addSkill(input); setInput(""); }}
          className="font-mono text-xs px-3 py-1.5 border border-[var(--rule-bright)] text-[var(--ink-muted)] hover:text-[var(--ink)] hover:border-[var(--amber-dim)] transition-colors duration-150"
        >
          add
        </button>
      </div>
    </div>
  );
}
