"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type RefreshRateOption = {
  label: string;
  value: number;
};

type AdminFinanceRefreshRateSelectProps = {
  ariaLabel: string;
  initialValue: number;
  label: string;
  options: RefreshRateOption[];
};

export function AdminFinanceRefreshRateSelect({
  ariaLabel,
  initialValue,
  label,
  options,
}: AdminFinanceRefreshRateSelectProps) {
  const router = useRouter();
  const [value, setValue] = useState(String(initialValue));
  const [isPending, startTransition] = useTransition();

  function handleChange(nextValue: string) {
    setValue(nextValue);
    startTransition(async () => {
      const response = await fetch("/api/admin/settings/finance-refresh-rate", {
        body: JSON.stringify({
          refreshRateSeconds: Number.parseInt(nextValue, 10),
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });

      if (!response.ok) {
        setValue(String(initialValue));
        return;
      }

      router.refresh();
    });
  }

  return (
    <label className="language-select admin-refresh-rate-select">
      <span className="language-select-label">{label}</span>
      <select
        aria-label={ariaLabel}
        className="language-select-control"
        disabled={isPending}
        onChange={(event) => handleChange(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
