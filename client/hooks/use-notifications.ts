import { useState, useEffect, useCallback } from "react";

export interface NotificationPreferences {
  enabled: boolean;
  readingReminders: boolean;
  dailyGoalReminders: boolean;
  newBooksNotifications: boolean;
  reminderTime: string; // HH:mm format
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  enabled: false,
  readingReminders: true,
  dailyGoalReminders: true,
  newBooksNotifications: true,
  reminderTime: "20:00",
};

const STORAGE_KEY = "luma_notification_prefs";

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported("Notification" in window);
    
    if ("Notification" in window) {
      setPermission(Notification.permission);
    }

    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setPreferences(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse notification preferences:", e);
      }
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      console.warn("Notifications are not supported in this browser");
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result === "granted") {
        updatePreferences({ enabled: true });
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error requesting notification permission:", error);
      return false;
    }
  }, [isSupported]);

  const updatePreferences = useCallback((updates: Partial<NotificationPreferences>) => {
    setPreferences((prev) => {
      const updated = { ...prev, ...updates };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const showNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (!isSupported || permission !== "granted" || !preferences.enabled) {
      console.log("Notification not shown:", { isSupported, permission, enabled: preferences.enabled });
      return null;
    }

    try {
      const notification = new Notification(title, {
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        ...options,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      return notification;
    } catch (error) {
      console.error("Error showing notification:", error);
      return null;
    }
  }, [isSupported, permission, preferences.enabled]);

  const showReadingReminder = useCallback(() => {
    if (!preferences.readingReminders) return null;
    
    return showNotification("Time to read!", {
      body: "Continue where you left off in your current book.",
      tag: "reading-reminder",
    });
  }, [preferences.readingReminders, showNotification]);

  const showDailyGoalReminder = useCallback((currentPages: number, goalPages: number) => {
    if (!preferences.dailyGoalReminders) return null;
    
    const remaining = goalPages - currentPages;
    if (remaining <= 0) return null;
    
    return showNotification("Daily Reading Goal", {
      body: `You're ${remaining} pages away from your daily goal!`,
      tag: "daily-goal",
    });
  }, [preferences.dailyGoalReminders, showNotification]);

  const showNewBookNotification = useCallback((bookTitle: string) => {
    if (!preferences.newBooksNotifications) return null;
    
    return showNotification("New Book Added", {
      body: `"${bookTitle}" has been added to your library.`,
      tag: "new-book",
    });
  }, [preferences.newBooksNotifications, showNotification]);

  return {
    isSupported,
    permission,
    preferences,
    requestPermission,
    updatePreferences,
    showNotification,
    showReadingReminder,
    showDailyGoalReminder,
    showNewBookNotification,
  };
}
