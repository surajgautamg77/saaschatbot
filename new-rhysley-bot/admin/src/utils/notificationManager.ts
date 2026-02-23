import { toast, Id } from 'react-toastify';

interface Notification {
  id: Id;
  message: string;
  count: number;
}

class NotificationManager {
  private notifications: Map<string, Notification> = new Map();

  private renderMessage(message: string, count: number): string {
    return count > 1 ? `${message} (${count})` : message;
  }

  public show(message: string, key: string): void {
    const existingNotification = this.notifications.get(key);

    if (existingNotification) {
      existingNotification.count += 1;
      toast.update(existingNotification.id, {
        render: this.renderMessage(existingNotification.message, existingNotification.count),
      });
    } else {
      const newId = toast.info(this.renderMessage(message, 1), {
        onClose: () => {
          this.notifications.delete(key);
        },
      });

      this.notifications.set(key, {
        id: newId,
        message: message,
        count: 1,
      });
    }
  }
}

export const notificationManager = new NotificationManager();
