"use client";

import type { NotificationType } from "@/generated/prisma/enums";
import { usePathname } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Toast } from "./Toast";

// Public notification contract used by any component through the context hook.
export type NotificationTone = "error" | "info" | "success" | "warning";

export type NotificationInput = {
  // durationMs <= 0 creates a persistent toast requiring manual dismissal.
  body?: string;
  durationMs?: number;
  entityId?: string;
  entityType?: string;
  persist?: boolean;
  title: string;
  tone?: NotificationTone;
  type?: NotificationType;
};

// Internal items contain normalized required values and a generated identifier.
type NotificationItem = {
  body: string;
  durationMs: number;
  id: string;
  title: string;
  tone: NotificationTone;
};

type NotificationContextValue = {
  notify: (notification: NotificationInput) => string;
  notifyAfterNavigation: (notification: NotificationInput) => void;
  dismissNotification: (id: string) => void;
};

// A nullable default lets the hook detect use outside the provider.
const NotificationContext = createContext<NotificationContextValue | null>(null);

const defaultNotificationDurationMs = 5_000;
const queuedNotificationStorageKey = "cleartrend-next-notification";
const notificationLogEndpoint = "/api/notifications";

// Prefer browser UUIDs, with a deterministic-enough fallback for older runtimes.
function createNotificationId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function logNotification(notification: NotificationInput) {
  // Local-only messages can explicitly opt out of database persistence.
  if (notification.persist === false) {
    return;
  }

  fetch(notificationLogEndpoint, {
    body: JSON.stringify({
      body: notification.body ?? null,
      entityId: notification.entityId ?? null,
      entityType: notification.entityType ?? null,
      title: notification.title,
      type: notification.type ?? "SYSTEM",
    }),
    headers: {
      "Content-Type": "application/json",
    },
    // Allow logging to finish even when the notification triggers navigation.
    keepalive: true,
    method: "POST",
  }).catch(() => null);
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  // Path changes trigger consumption of notifications queued before navigation.
  const pathname = usePathname();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const timeoutRefs = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismissNotification = useCallback((id: string) => {
    // Clear both the visual item and its pending automatic-dismiss timer.
    const timeout = timeoutRefs.current.get(id);

    if (timeout) {
      clearTimeout(timeout);
      timeoutRefs.current.delete(id);
    }

    setNotifications((currentNotifications) =>
      currentNotifications.filter((notification) => notification.id !== id)
    );
  }, []);

  const notify = useCallback(
    (notification: NotificationInput) => {
      // Normalize optional input once before storing and rendering the toast.
      const id = createNotificationId();
      const durationMs =
        notification.durationMs === undefined
          ? defaultNotificationDurationMs
          : notification.durationMs;

      setNotifications((currentNotifications) => [
        // Preserve display order by appending new notifications.
        ...currentNotifications,
        {
          body: notification.body ?? "",
          durationMs,
          id,
          title: notification.title,
          tone: notification.tone ?? "info",
        },
      ]);
      logNotification(notification);

      if (durationMs > 0) {
        // A non-positive duration keeps the toast visible until manual dismissal.
        const timeout = setTimeout(() => dismissNotification(id), durationMs);
        timeoutRefs.current.set(id, timeout);
      }

      return id;
    },
    [dismissNotification]
  );

  const notifyAfterNavigation = useCallback((notification: NotificationInput) => {
    if (typeof window === "undefined") {
      return;
    }

    // Queue one message for the provider mounted after the next navigation.
    window.sessionStorage.setItem(
      queuedNotificationStorageKey,
      JSON.stringify(notification)
    );
  }, []);

  const contextValue = useMemo(
    // Keep context identity stable unless one of its callable actions changes.
    () => ({
      dismissNotification,
      notify,
      notifyAfterNavigation,
    }),
    [dismissNotification, notify, notifyAfterNavigation]
  );

  useEffect(() => {
    const timeouts = timeoutRefs.current;

    // Prevent timers from updating an unmounted provider.
    return () => {
      timeouts.forEach((timeout) => clearTimeout(timeout));
      timeouts.clear();
    };
  }, []);

  useEffect(() => {
    // Consume a notification queued by the previous route.
    const queuedNotification = window.sessionStorage.getItem(
      queuedNotificationStorageKey
    );

    if (!queuedNotification) {
      return;
    }

    window.sessionStorage.removeItem(queuedNotificationStorageKey);

    try {
      const notification = JSON.parse(queuedNotification) as NotificationInput;

      if (notification.title) {
        setTimeout(() => notify(notification), 0);
      }
    } catch {
      window.sessionStorage.removeItem(queuedNotificationStorageKey);
    }
  }, [notify, pathname]);

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      {/* One polite live region announces newly mounted toast content. */}
      <div
        aria-live="polite"
        aria-relevant="additions text"
        className="notification-region"
      >
        {notifications.map((notification) => (
          <Toast
            body={notification.body}
            key={notification.id}
            onDismiss={() => dismissNotification(notification.id)}
            title={notification.title}
            tone={notification.tone}
          />
        ))}
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  // Centralizing the guard produces a clearer error than a null dereference.
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error("useNotifications must be used inside NotificationProvider.");
  }

  return context;
}
