// Client-side form checks shared by the auth screens (the backend still validates everything).

// Same pattern RegisterScreen used before it was shared; deliberately no trim(), so the
// check sees exactly the value that is sent.
export const isValidEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// Same minimum as the backend (auth_service.MIN_PASSWORD_LENGTH) for registration and password reset
export const MIN_PASSWORD_LENGTH = 6;
