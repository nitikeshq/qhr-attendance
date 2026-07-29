function ok(res, data = {}, status = 200) {
  return res.status(status).json({
    success: true,
    data,
  });
}

function created(res, data = {}) {
  return ok(res, data, 201);
}

function fail(res, status, message, details) {
  return res.status(status).json({
    success: false,
    message,
    ...(res.locals.requestId ? { requestId: res.locals.requestId } : {}),
    ...(details ? { details } : {}),
  });
}

module.exports = {
  created,
  fail,
  ok,
};
