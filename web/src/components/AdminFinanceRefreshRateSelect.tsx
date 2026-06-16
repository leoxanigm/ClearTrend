"use client";

import { SelectField } from "@/components/ui/SelectField";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

// Admin-only control that persists the backend market refresh interval.
type RefreshRateOption = {
  label: string;
  value: number;
};

// Labels are prepared server-side while values remain numeric configuration data.
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
  // Local string state matches the native select value contract.
  const router = useRouter();
  const [value, setValue] = useState(String(initialValue));
  const [isPending, startTransition] = useTransition();
  // Convert numeric settings once into SelectField's string options.
  const selectOptions = options.map((option) => ({
    label: option.label,
    value: String(option.value),
  }));

  function handleChange(nextValue: string) {
    // Optimistically update the select while the server validates the setting.
    setValue(nextValue);
    startTransition(async () => {
      // Only administrators can persist this value through the protected route.
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
        // Restore the server-provided value if persistence fails.
        setValue(String(initialValue));
        return;
      }

      // Refresh server-rendered admin data after a successful update.
      router.refresh();
    });
  }

  return (
    <SelectField
      ariaLabel={ariaLabel}
      containerClassName="language-select admin-refresh-rate-select"
      disabled={isPending}
      label={label}
      onValueChange={handleChange}
      options={selectOptions}
      value={value}
    />
  );
}
