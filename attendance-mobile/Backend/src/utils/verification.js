'use strict';

/**
 * Company email verification.
 *
 * This used to be theatre: the code was generated, stored in plaintext on the
 * company record, and returned in the registration response. Anyone could
 * register against an email address they did not own and activate it from the
 * same reply. A company with no code stored was also verified by *any* code,
 * because the comparison was skipped when the field was empty.
 *
 * The code is now hashed, expires, counts attempts, and is only ever delivered
 * out of band.
 */

const crypto = require('crypto');

const { hashSecret, verifySecret } = require('./passwords');
const { nowIso } = require('./records');

const CODE_TTL_MINUTES = 30;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 60;

/** Six digits from a CSPRNG, not Math.random. */
function generateCode() {
  return String(100000 + (crypto.randomInt(0, 900000)));
}

/**
 * Exposing the code in the API response is a test-only affordance. Production
 * must never return it, which is the whole point of verifying an address.
 */
function exposeVerificationCode() {
  return process.env.NODE_ENV === 'test' || process.env.QHR_EXPOSE_VERIFICATION_CODE === 'true';
}

function issueVerification(company) {
  const code = generateCode();
  company.verification = {
    codeHash: hashSecret(code),
    expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60000).toISOString(),
    attempts: 0,
    sentAt: nowIso(),
    resendCount: Number(company.verification?.resendCount || 0),
  };
  // The plaintext field is gone for good.
  delete company.verificationCode;
  return code;
}

function canResend(company) {
  const sentAt = company.verification?.sentAt;
  if (!sentAt) return { allowed: true };
  const elapsed = (Date.now() - Date.parse(sentAt)) / 1000;
  if (elapsed < RESEND_COOLDOWN_SECONDS) {
    return { allowed: false, retryAfter: Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed) };
  }
  return { allowed: true };
}

/**
 * Checks a submitted code. Returns `{ ok: true }` or a reason. Attempts are
 * counted on the company record, so guessing is bounded even across restarts.
 */
function checkVerification(company, provided) {
  const code = String(provided || '').trim();
  if (!code) return { error: 'Verification code is required', status: 400 };

  const state = company.verification;
  // No outstanding code must never mean "anything is accepted".
  if (!state?.codeHash) {
    return { error: 'No verification code is outstanding. Request a new one.', status: 400 };
  }
  if (Number(state.attempts || 0) >= MAX_ATTEMPTS) {
    return { error: 'Too many incorrect attempts. Request a new verification code.', status: 429 };
  }
  if (state.expiresAt && Date.parse(state.expiresAt) < Date.now()) {
    return { error: 'This verification code has expired. Request a new one.', status: 400 };
  }
  if (!verifySecret(code, state.codeHash)) {
    state.attempts = Number(state.attempts || 0) + 1;
    const left = Math.max(0, MAX_ATTEMPTS - state.attempts);
    return {
      error: left ? `Verification code is incorrect. ${left} attempt(s) left.` : 'Verification code is incorrect. Request a new code.',
      status: 400,
    };
  }
  return { ok: true };
}

/** Clears the code once it has served its purpose. */
function consumeVerification(company) {
  delete company.verification;
  delete company.verificationCode;
}

function verificationEmail(company, code) {
  return {
    subject: `Your QHR verification code: ${code}`,
    body: [
      `Use this code to activate ${company.name}:`,
      '',
      `    ${code}`,
      '',
      `The code expires in ${CODE_TTL_MINUTES} minutes and can be used once.`,
      'If you did not request this, no account has been activated and you can ignore this message.',
    ].join('\n'),
  };
}

/**
 * One-time backfill. Companies registered before this change hold a plaintext
 * code; verified ones no longer need it, and unverified ones must not keep a
 * readable copy.
 */
function migrateVerificationCodes(data) {
  let changed = false;
  for (const company of data.companies || []) {
    if (!company.verificationCode) continue;
    if (company.isVerified || company.verificationStatus === 'verified') {
      delete company.verificationCode;
      changed = true;
      continue;
    }
    company.verification = {
      codeHash: hashSecret(String(company.verificationCode)),
      // Treated as already expired: the old code was exposed, so it must not
      // remain usable. The tenant requests a fresh one.
      expiresAt: new Date(0).toISOString(),
      attempts: 0,
      sentAt: null,
      resendCount: 0,
    };
    delete company.verificationCode;
    changed = true;
  }
  return changed;
}

module.exports = {
  CODE_TTL_MINUTES,
  MAX_ATTEMPTS,
  RESEND_COOLDOWN_SECONDS,
  canResend,
  checkVerification,
  consumeVerification,
  exposeVerificationCode,
  issueVerification,
  migrateVerificationCodes,
  verificationEmail,
};
