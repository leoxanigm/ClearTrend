"use client";

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
import { usePathname } from "next/navigation";

export type NotificationTone = "error" | "info" | "success" | "warning";

export type NotificationInput = {
  body?: string;
  durationMs?: number;
  title: string;
  tone?: NotificationTone;
};

type NotificationItem = Required<NotificationInput> & {
  id: string;
};

type NotificationContextValue = {
  notify: (notification: NotificationInput) => string;
  notifyAfterNavigation: (notification: NotificationInput) => void;
  dismissNotification: (id: string) => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

const defaultNotificationDurationMs = 5_000;
const queuedNotificationStorageKey = "cleartrend-next-notification";

function createNotificationId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const timeoutRefs = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismissNotification = useCallback((id: string) => {
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
      const id = createNotificationId();
      const durationMs =
        notification.durationMs === undefined
          ? defaultNotificationDurationMs
          : notification.durationMs;

      setNotifications((currentNotifications) => [
        ...currentNotifications,
        {
          body: notification.body ?? "",
          durationMs,
          id,
          title: notification.title,
          tone: notification.tone ?? "info",
        },
      ]);

      if (durationMs > 0) {
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

    window.sessionStorage.setItem(
      queuedNotificationStorageKey,
      JSON.stringify(notification)
    );
  }, []);

  const contextValue = useMemo(
    () => ({
      dismissNotification,
      notify,
      notifyAfterNavigation,
    }),
    [dismissNotification, notify, notifyAfterNavigation]
  );

  useEffect(() => {
    const timeouts = timeoutRefs.current;

    return () => {
      timeouts.forEach((timeout) => clearTimeout(timeout));
      timeouts.clear();
    };
  }, []);

  useEffect(() => {
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
      <div
        aria-live="polite"
        aria-relevant="additions text"
        className="notification-region"
      >
        {notifications.map((notification) => (
          <section
            className={`notification-toast notification-toast-${notification.tone}`}
            key={notification.id}
            role={notification.tone === "error" ? "alert" : "status"}
          >
            <div className="notification-toast-content">
              <p className="notification-toast-title">{notification.title}</p>
              {notification.body ? (
                <p className="notification-toast-body">{notification.body}</p>
              ) : null}
            </div>
            <button
              aria-label="Dismiss notification"
              className="notification-toast-dismiss"
              onClick={() => dismissNotification(notification.id)}
              type="button"
            >
              <span aria-hidden="true">x</span>
            </button>
          </section>
        ))}
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error("useNotifications must be used inside NotificationProvider.");
  }

  return context;
}
