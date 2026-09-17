export interface Account {
  username: string;
  /** SHA-256 hex digest of the password — never store plaintext here. */
  passwordHash: string;
}

/**
 * Client-side account list. This is NOT real security: the app is a static bundle,
 * so a determined visitor can read the source or bypass this gate via devtools. It only
 * deters casual/accidental access (search engines, a shared link falling into the
 * wrong hands). To add or change an account, compute a new SHA-256 hex hash of the
 * password (see src/auth/hash.ts) and add/edit an entry below.
 */
export const ACCOUNTS: Account[] = [
  {
    username: 'admin',
    passwordHash: 'ad3f6b58e553b16002d37e0fce201ba8921342218854d3b1c6a5db5f07bec8a8',
  },
  {
    username: 'marc',
    passwordHash: 'c79195c98f90ba9f03b6972e6e7e99c39c85670bda33e6411cbf05ae8ee9bdcb',
  },
];
