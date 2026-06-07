import type { Metadata } from "next";
import { UiShowcaseClient } from "./UiShowcaseClient";

export const metadata: Metadata = {
  title: "UI Showcase - ClearTrend",
};

export default function UiShowcasePage() {
  return <UiShowcaseClient />;
}
