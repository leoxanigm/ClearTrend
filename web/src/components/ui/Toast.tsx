import { cx } from "./cx";
import type { NotificationTone } from "./Notifications";

// Individual transient notification rendered by NotificationProvider.
type ToastProps = {
  body?: string;
  dismissLabel?: string;
  onDismiss: () => void;
  title: string;
  tone?: NotificationTone;
};

// The provider owns timing; Toast only presents content and emits dismissal.
export function Toast({
  body = "",
  dismissLabel = "Dismiss notification",
  onDismiss,
  title,
  tone = "info",
}: ToastProps) {
  // Errors use an interrupting alert role; other messages remain polite.
  const liveRegionRole = tone === "error" ? "alert" : "status";

  return (
    <section
      className={cx("notification-toast", `notification-toast-${tone}`)}
      role={liveRegionRole}
    >
      <div className="notification-toast-content">
        <p className="notification-toast-title">{title}</p>
        {body ? <p className="notification-toast-body">{body}</p> : null}
      </div>
      <button
        // A text label makes the symbolic x understandable to screen readers.
        aria-label={dismissLabel}
        className="notification-toast-dismiss"
        onClick={onDismiss}
        type="button"
      >
        <span aria-hidden="true">x</span>
      </button>
    </section>
  );
}
