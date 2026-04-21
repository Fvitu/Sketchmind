interface GoogleTokenResponse {
  credential?: string;
  select_by?: string;
}

interface GoogleIdPromptMomentNotification {
  isNotDisplayed: () => boolean;
  isSkippedMoment: () => boolean;
  isDismissedMoment: () => boolean;
  getNotDisplayedReason?: () => string;
  getSkippedReason?: () => string;
  getDismissedReason?: () => string;
}

interface Window {
  google?: {
    accounts: {
      id: {
        initialize: (options: {
          client_id: string;
          callback: (response: GoogleTokenResponse) => void;
          auto_select?: boolean;
          cancel_on_tap_outside?: boolean;
        }) => void;
        prompt: (momentListener?: (notification: GoogleIdPromptMomentNotification) => void) => void;
        disableAutoSelect: () => void;
      };
    };
  };
}
