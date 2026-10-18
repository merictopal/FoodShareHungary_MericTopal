// Maps failed API calls to translation keys, so alerts never show the backend's English `message`.
// The backend's stable short `error` titles (API contract: {success, error, message}) select the key.

type Translate = (key: string, params?: Record<string, string | number>) => string;

// Mirrors the `error` titles returned by backend/app/services/{auth,qr}_service.py and utils/decorators.py
const ERROR_TITLE_KEYS: Record<string, string> = {
  'Invalid Credentials': 'err_invalid_credentials',
  'Account Suspended': 'err_account_suspended',
  'Account Pending': 'err_account_pending',
  'Application Rejected': 'err_application_rejected',
  Conflict: 'err_email_in_use',
  'Already Claimed': 'err_offer_claimed',
  'Sold Out': 'err_offer_sold_out',
  'Offer Expired': 'err_offer_expired',
  'Verification Required': 'verification_required_msg',
  'Already Used': 'err_qr_used',
  'Wrong Restaurant': 'err_qr_wrong_restaurant',
  'Invalid Code': 'scanner_invalid_qr',
  'Validation Error': 'err_check_input',
};

/**
 * Translation key for a failed request. `overrides` lets a screen give a title its own meaning
 * (e.g. 'Invalid Code' on the reset screen, 'Not Found' for a claimed offer); `fallbackKey` covers the rest.
 */
export const apiErrorKey = (
  error: any,
  fallbackKey: string,
  overrides: Record<string, string> = {},
): string => {
  if (error?.isAxiosError && !error.response) {
    return 'err_network';
  }
  const title: string | undefined = error?.response?.data?.error;
  if (title && overrides[title]) {
    return overrides[title];
  }
  if (error?.response?.status === 429) {
    return 'err_rate_limited';
  }
  if (title && ERROR_TITLE_KEYS[title]) {
    return ERROR_TITLE_KEYS[title];
  }
  return fallbackKey;
};

// Mirrors the success body of POST /api/claims/verify (student_xp, restaurant_points, new_level)
export const verifySuccessMessage = (data: any, t: Translate): string => {
  if (data?.new_level) {
    return t('verify_success_level', { level: data.new_level });
  }
  if (data?.student_xp != null && data?.restaurant_points != null) {
    return t('verify_success_points', { xp: data.student_xp, points: data.restaurant_points });
  }
  return t('scanner_verify_success');
};
