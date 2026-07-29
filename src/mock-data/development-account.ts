/**
 * Stable local identity used only by the development authentication adapter.
 * This record contains no credential, token, or production data.
 */
export const developmentAccount = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Padma Developer",
  email: "developer@padma.local",
  emailVerified: true,
  image: null,
  twoFactorEnabled: false,
} as const;
