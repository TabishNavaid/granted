/** The product name, defined once. Change it here and nowhere else. */
export const PRODUCT_NAME = "FundFellows";

/** The domain the product lives on. Canonical links, sitemaps, and social cards use it. */
export const PRODUCT_DOMAIN = "fundfellows.com";
export const CANONICAL_URL = `https://${PRODUCT_DOMAIN}`;

/** Addresses at the domain. Outbound mail never comes from a personal mailbox. */
export const EMAIL = {
  hello: `hello@${PRODUCT_DOMAIN}`,
  support: `support@${PRODUCT_DOMAIN}`,
  privacy: `privacy@${PRODUCT_DOMAIN}`,
  security: `security@${PRODUCT_DOMAIN}`,
  /** Sender for transactional mail: sign-in links, invites, reminders, digests. */
  noReply: `no-reply@${PRODUCT_DOMAIN}`,
} as const;

/** The From header for transactional mail when EMAIL_FROM is not set. */
export const DEFAULT_EMAIL_FROM = `${PRODUCT_NAME} <${EMAIL.noReply}>`;

export const PRODUCT_TAGLINE = "Win the grants, bids, and awards you qualify for.";

export const PRODUCT_DESCRIPTION = `${PRODUCT_NAME} finds the grants, public bids, research funding, and scholarships you qualify for, drafts each application from your own documents, and plans every deadline. You review everything, and nothing is sent or submitted without you.`;
