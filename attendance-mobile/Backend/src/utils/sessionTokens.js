const crypto = require('crypto');

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token || ''), 'utf8').digest('hex');
}

function setSessionToken(session, type, token) {
  session[`${type}TokenHash`] = hashToken(token);
  delete session[`${type}Token`];
}

function sessionTokenMatches(session, type, token) {
  if (!token) return false;
  const storedHash = session[`${type}TokenHash`];
  if (storedHash && storedHash === hashToken(token)) return true;
  return Boolean(session[`${type}Token`] && session[`${type}Token`] === token);
}

module.exports = {
  hashToken,
  sessionTokenMatches,
  setSessionToken,
};
