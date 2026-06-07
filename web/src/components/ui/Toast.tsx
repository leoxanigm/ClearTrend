import { cx } from "./cx";
import type { NotificationTone } from "./Notifications";

type ToastProps = {
  body?: string;
  dismissLabel?: string;
  onDismiss: () => void;
  title: string;
  tone?: NotificationTone;
};

export function Toast({
  body = "",
  dismissLabel = "Dismiss notification",
  onDismiss,
  title,
  tone = "info",
}: ToastProps) {
  return (
    <section
      className={cx("notification-toast", `notification-toast-${tone}`)}
      role={tone === "error" ? "alert" : "status"}
    >
      <div className="notification-toast-content">
        <p className="notification-toast-title">{title}</p>
        {body ? <p className="notification-toast-body">{body}</p> : null}
      </div>
      <button
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
