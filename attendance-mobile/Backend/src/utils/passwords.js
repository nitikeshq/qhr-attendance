const crypto = require('crypto');

const ITERATIONS = 120000;
const KEY_LENGTH = 32;
const DIGEST = 'sha256';

function hashSecret(secret, salt = crypto.randomBytes(16).toString('hex')) {
  const value = String(secret || '');
  const hash = crypto.pbkdf2Sync(value, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString('hex');
  return `pbkdf2$${ITERATIONS}$${salt}$${hash}`;
}

function verifySecret(secret, storedHash) {
  if (!storedHash) return false;

  if (!String(storedHash).startsWith('pbkdf2$')) {
    return String(secret || '') === String(storedHash);
  }

  const [, iterations, salt, originalHash] = storedHash.split('$');
  if (!iterations || !salt || !originalHash) return false;

  const candidate = crypto
    .pbkdf2Sync(String(secret || ''), salt, Number(iterations), Buffer.from(originalHash, 'hex').length, DIGEST)
    .toString('hex');

  const candidateBuffer = Buffer.from(candidate, 'hex');
  const originalBuffer = Buffer.from(originalHash, 'hex');
  return candidateBuffer.length === originalBuffer.length && crypto.timingSafeEqual(candidateBuffer, originalBuffer);
}

module.exports = {
  hashSecret,
  verifySecret,
};
