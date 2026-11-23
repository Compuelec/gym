import { t } from '@/i18n';

/** Maps Better Auth and API error codes to Spanish messages. */
export function authErrorMessage(error: { code?: string; status?: number; message?: string } | null | undefined): string {
  if (!error) return t('auth.errors.generic');
  if (error.status === 429) return t('auth.errors.rateLimited');
  switch (error.code) {
    case 'INVITE_REQUIRED':
      return t('auth.errors.inviteRequired');
    case 'USER_ALREADY_EXISTS':
    case 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL':
      return t('auth.errors.userExists');
    case 'INVALID_EMAIL_OR_PASSWORD':
      return t('auth.errors.invalidCredentials');
    case 'PASSWORD_TOO_SHORT':
      return t('auth.errors.passwordTooShort');
    case 'INVALID_EMAIL':
      return t('auth.errors.invalidEmail');
    case 'INVALID_TOKEN':
      return t('auth.errors.invalidToken');
    case 'ACCOUNT_DISABLED':
      return t('auth.errors.accountDisabled');
    default:
      return t('auth.errors.generic');
  }
}
