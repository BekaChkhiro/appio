"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@appio/ui";

interface TemplateSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export function TemplateSearch({ value, onChange }: TemplateSearchProps) {
  const [local, setLocal] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce the parent callback
  const handleChange = useCallback(
    (text: string) => {
      setLocal(text);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => onChange(text), 250);
    },
    [onChange]
  );

  // Sync external resets
  useEffect(() => {
    setLocal(value);
  }, [value]);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        type="text"
        aria-label="Search templates"
        placeholder="Search templates..."
        value={local}
        onChange={(e) => handleChange(e.target.value)}
        className="pl-9 pr-9"
      />
      {local && (
        <button
          aria-label="Clear search"
          onClick={() => {
            handleChange("");
            inputRef.current?.focus();
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
