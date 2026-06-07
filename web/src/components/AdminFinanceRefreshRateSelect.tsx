"use client";

import { SelectField } from "@/components/ui/SelectField";
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
  const selectOptions = options.map((option) => ({
    label: option.label,
    value: String(option.value),
  }));

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
