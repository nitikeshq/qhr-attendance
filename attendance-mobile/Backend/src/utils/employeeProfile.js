'use strict';

const crypto = require('node:crypto');

/**
 * Employee profile field catalogue.
 *
 * A company needs somewhere to record everything HR normally keeps, so the
 * schema is deliberately broad and almost entirely optional — the company
 * decides what it actually collects. Only the fields the product depends on
 * (identity, email, work location) are enforced elsewhere.
 */
const PROFILE_TEXT_FIELDS = [
  // Personal
  'middleName',
  'preferredName',
  'gender',
  'maritalStatus',
  'bloodGroup',
  'nationality',
  'personalEmail',
  'alternatePhone',
  // Government identifiers
  'aadhaarLast4',
  'panNumber',
  'passportNumber',
  'drivingLicenceNumber',
  // Current address
  'addressLine1',
  'addressLine2',
  'city',
  'state',
  'pincode',
  'country',
  // Permanent address
  'permanentAddressLine1',
  'permanentAddressLine2',
  'permanentCity',
  'permanentState',
  'permanentPincode',
  'permanentCountry',
  // Emergency contact
  'emergencyContactName',
  'emergencyContactRelation',
  'emergencyContactPhone',
  'emergencyContactAltPhone',
  // Employment context
  'probationEndDate',
  'confirmationDate',
  'noticePeriodDays',
  'shiftName',
  'costCenter',
  'employeeGrade',
  'previousEmployer',
  'highestQualification',
  'notes',
];

const GENDERS = ['female', 'male', 'non_binary', 'prefer_not_to_say', 'other'];
const MARITAL_STATUSES = ['single', 'married', 'divorced', 'widowed', 'other'];

function trimmed(value) {
  return String(value === undefined || value === null ? '' : value).trim();
}

function isIsoDate(value) {
  const text = trimmed(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const parsed = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text;
}

/**
 * Builds the stored profile object from a request body, merging over whatever is
 * already there so a partial update never wipes untouched fields.
 */
function buildEmployeeProfile(body = {}, existing = {}) {
  const profile = { ...existing };

  for (const field of PROFILE_TEXT_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(body, field)) continue;
    profile[field] = trimmed(body[field]);
  }

  if (Object.prototype.hasOwnProperty.call(body, 'gender')) {
    const gender = trimmed(body.gender).toLowerCase().replace(/[\s-]+/g, '_');
    if (gender && !GENDERS.includes(gender)) {
      return { error: `Gender must be one of ${GENDERS.join(', ')}` };
    }
    profile.gender = gender;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'maritalStatus')) {
    const status = trimmed(body.maritalStatus).toLowerCase().replace(/[\s-]+/g, '_');
    if (status && !MARITAL_STATUSES.includes(status)) {
      return { error: `Marital status must be one of ${MARITAL_STATUSES.join(', ')}` };
    }
    profile.maritalStatus = status;
  }

  for (const field of ['probationEndDate', 'confirmationDate']) {
    if (!Object.prototype.hasOwnProperty.call(body, field)) continue;
    const value = trimmed(body[field]);
    if (value && !isIsoDate(value)) return { error: `${field} must be formatted YYYY-MM-DD` };
    profile[field] = value;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'noticePeriodDays')) {
    const value = trimmed(body.noticePeriodDays);
    if (value) {
      const days = Number(value);
      if (!Number.isInteger(days) || days < 0 || days > 365) {
        return { error: 'Notice period must be a whole number of days between 0 and 365' };
      }
      profile.noticePeriodDays = String(days);
    } else {
      profile.noticePeriodDays = '';
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, 'aadhaarLast4')) {
    const digits = trimmed(body.aadhaarLast4).replace(/\D/g, '');
    if (digits && digits.length !== 4) {
      // Only the last four are ever stored: the full number is not needed and
      // holding it would create an avoidable liability.
      return { error: 'Store only the last 4 digits of the Aadhaar number' };
    }
    profile.aadhaarLast4 = digits;
  }

  // Convenience: copy the current address to the permanent one.
  if (body.permanentSameAsCurrent === true || body.permanentSameAsCurrent === 'true') {
    profile.permanentAddressLine1 = profile.addressLine1 || '';
    profile.permanentAddressLine2 = profile.addressLine2 || '';
    profile.permanentCity = profile.city || '';
    profile.permanentState = profile.state || '';
    profile.permanentPincode = profile.pincode || '';
    profile.permanentCountry = profile.country || '';
  }

  return { profile };
}

/** Human-readable single-line current address, used in lists and exports. */
function formatEmployeeAddress(profile = {}) {
  return [profile.addressLine1, profile.addressLine2, profile.city, profile.state, profile.pincode, profile.country]
    .map(trimmed)
    .filter(Boolean)
    .join(', ');
}

// Ambiguous characters removed so a password read off a screen or a printout
// cannot be mistyped as a different one.
const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const PASSWORD_SYMBOLS = '!@#$%&*?';

/**
 * Generates a one-time password that satisfies the product password policy
 * (10+ characters, mixed case, a digit and a symbol) using a CSPRNG.
 */
function generateOneTimePassword(length = 12) {
  const size = Math.max(10, Math.min(32, Math.floor(length)));
  const pick = (alphabet) => alphabet[crypto.randomInt(0, alphabet.length)];

  const required = [
    pick('ABCDEFGHJKLMNPQRSTUVWXYZ'),
    pick('abcdefghijkmnopqrstuvwxyz'),
    pick('23456789'),
    pick(PASSWORD_SYMBOLS),
  ];
  const rest = Array.from({ length: size - required.length }, () => pick(PASSWORD_ALPHABET));
  const characters = [...required, ...rest];

  // Fisher-Yates with crypto randomness so the required characters are not
  // always in the first four positions.
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swap = crypto.randomInt(0, index + 1);
    [characters[index], characters[swap]] = [characters[swap], characters[index]];
  }
  return characters.join('');
}

module.exports = {
  GENDERS,
  MARITAL_STATUSES,
  PROFILE_TEXT_FIELDS,
  buildEmployeeProfile,
  formatEmployeeAddress,
  generateOneTimePassword,
  isIsoDate,
};
