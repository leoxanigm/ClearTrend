"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  DropdownMenu,
  IconButton,
  MetricTile,
  Modal,
  SegmentedControl,
  SelectField,
  TextInput,
  ThemeSwitch,
  Tooltip,
  useNotifications,
} from "@/components/ui";

type AuthMode = "login" | "register";
type RiskLevel = "low" | "medium" | "high";

const colorTokens = [
  { label: "Background", token: "--app-background" },
  { label: "Surface", token: "--app-surface" },
  { label: "Panel", token: "--app-panel" },
  { label: "Border", token: "--app-border" },
  { label: "Text", token: "--app-text" },
  { label: "Muted", token: "--app-muted" },
  { label: "Accent", token: "--app-accent" },
  { label: "Secondary", token: "--app-secondary" },
  { label: "Accent contrast", token: "--app-accent-contrast" },
] as const;

function ShowcaseSection({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <Card className="grid gap-4 self-start" padded>
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </Card>
  );
}

function ColorSwatch({
  label,
  token,
}: {
  label: string;
  token: string;
}) {
  return (
    <div className="grid min-w-0 gap-2">
      <div
        className="h-12 rounded-md border border-[var(--app-border)] shadow-inner"
        style={{ backgroundColor: `var(${token})` }}
      />
      <div className="grid gap-0.5">
        <span className="truncate text-sm font-semibold">{label}</span>
        <code className="truncate text-xs text-[var(--app-muted)]">{token}</code>
      </div>
    </div>
  );
}

export function UiShowcaseClient() {
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [riskLevel, setRiskLevel] = useState<RiskLevel>("medium");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { notify } = useNotifications();

  return (
    <main className="min-h-screen bg-[var(--app-background)] px-4 py-6 text-[var(--app-text)] sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-6xl gap-6">
        <header className="grid gap-2">
          <Badge tone="accent">Design system</Badge>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">UI showcase</h1>
              <p className="mt-1 max-w-2xl text-sm text-[var(--app-muted)]">
                Rendus rapides des composants generiques ClearTrend.
              </p>
            </div>
            <ThemeSwitch />
          </div>
        </header>

        <ShowcaseSection title="Base colors">
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {colorTokens.map((color) => (
              <ColorSwatch
                key={color.token}
                label={color.label}
                token={color.token}
              />
            ))}
          </div>
        </ShowcaseSection>

        <section className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          <ShowcaseSection title="Buttons">
            <div className="flex flex-wrap items-center gap-2">
              <Button className="max-w-max">Primary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="plain">Plain</Button>
            </div>
            <div className="grid gap-2">
              <p className="text-xs font-semibold text-[var(--app-muted)]">
                Segmented control
              </p>
              <SegmentedControl
                onChange={setAuthMode}
                options={[
                  { label: "Login", value: "login" },
                  { label: "Register", value: "register" },
                ]}
                value={authMode}
              />
            </div>
          </ShowcaseSection>

          <ShowcaseSection title="Icon buttons">
            <div className="flex flex-wrap items-center gap-2">
              <IconButton label="Add item">
                <span aria-hidden="true">+</span>
              </IconButton>
              <IconButton label="Favorite item" pressed variant="ghost">
                <span aria-hidden="true">*</span>
              </IconButton>
              <IconButton disabled label="Disabled item" size="sm">
                <span aria-hidden="true">x</span>
              </IconButton>
            </div>
          </ShowcaseSection>

          <ShowcaseSection title="Form fields">
            <div className="grid gap-3">
              <TextInput
                defaultValue="AAPL"
                label="Ticker"
                placeholder="Symbol"
              />
              <SelectField
                label="Risk level"
                onValueChange={setRiskLevel}
                options={[
                  { label: "Low", value: "low" },
                  { label: "Medium", value: "medium" },
                  { label: "High", value: "high" },
                ]}
                value={riskLevel}
              />
            </div>
          </ShowcaseSection>

          <ShowcaseSection title="Badges">
            <div className="grid gap-2">
              <Badge>Default</Badge>
              <Badge tone="accent">Accent</Badge>
              <Badge tone="success">Success</Badge>
              <Badge tone="warning">Warning</Badge>
              <Badge tone="danger">Danger</Badge>
            </div>
          </ShowcaseSection>

          <ShowcaseSection title="Cards">
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricTile
                description="Last 24h"
                label="Portfolio"
                tone="positive"
                value="+2.4%"
              />
              <MetricTile
                description="Tracked assets"
                label="Watchlist"
                tone="secondary"
                value="12"
              />
            </div>
          </ShowcaseSection>

          <ShowcaseSection title="Avatar">
            <div className="flex items-center gap-3">
              <Avatar
                className="h-12 w-12 bg-[var(--app-panel)] text-sm font-bold"
                fallback="CT"
              />
              <div>
                <p className="font-semibold">ClearTrend</p>
                <p className="text-sm text-[var(--app-muted)]">Fallback avatar</p>
              </div>
            </div>
          </ShowcaseSection>

          <ShowcaseSection title="Dropdown">
            <DropdownMenu
              label="Open sample menu"
              panelClassName="right-auto mt-2 min-w-44 rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] p-2 shadow-lg"
              trigger={<span>Open menu</span>}
              triggerClassName="outline-button inline-flex"
            >
              <div className="grid gap-1 text-sm">
                <button
                  className="rounded px-2 py-1 text-left hover:bg-[var(--app-panel)]"
                  type="button"
                >
                  View
                </button>
                <button
                  className="rounded px-2 py-1 text-left hover:bg-[var(--app-panel)]"
                  type="button"
                >
                  Edit
                </button>
              </div>
            </DropdownMenu>
          </ShowcaseSection>

          <ShowcaseSection title="Tooltip">
            <p className="text-sm text-[var(--app-muted)]">
              Market score <Tooltip content="Synthetic demo score">info</Tooltip>
            </p>
          </ShowcaseSection>

          <ShowcaseSection title="Feedback">
            <div className="flex flex-wrap gap-2">
              <Button
                className="max-w-max"
                onClick={() =>
                  notify({
                    body: "Notification depuis le provider global.",
                    title: "Toast preview",
                    tone: "success",
                  })
                }
                variant="outline"
              >
                Show toast
              </Button>
              <Button
                className="max-w-max"
                onClick={() => setIsModalOpen(true)}
              >
                Open modal
              </Button>
            </div>
          </ShowcaseSection>
        </section>
      </div>

      {isModalOpen ? (
        <Modal
          ariaLabelledBy="ui-showcase-modal-title"
          className="grid w-[min(100%,24rem)] gap-4 p-4 shadow-2xl"
          onBackdropPointerDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsModalOpen(false);
            }
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold" id="ui-showcase-modal-title">
                Modal
              </h2>
              <p className="mt-1 text-sm text-[var(--app-muted)]">
                Exemple court du composant dialog.
              </p>
            </div>
            <IconButton
              label="Close modal"
              onClick={() => setIsModalOpen(false)}
              size="sm"
              variant="ghost"
            >
              <span aria-hidden="true">x</span>
            </IconButton>
          </div>
          <Button onClick={() => setIsModalOpen(false)}>Close</Button>
        </Modal>
      ) : null}
    </main>
  );
}
