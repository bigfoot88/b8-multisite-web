class AdminExpectedError extends Error {
  constructor(statusCode, message, code = 'admin-expected-error') {
    super(message);
    this.name = code;
    this.statusCode = statusCode;
    this.code = code;
  }
}

function createAdminValidationError(message, code = 'admin-validation-error') {
  return new AdminExpectedError(400, message, code);
}

function createAdminNotFoundError(message, code = 'admin-not-found') {
  return new AdminExpectedError(404, message, code);
}

function createAdminConflictError(message, code = 'admin-conflict') {
  return new AdminExpectedError(409, message, code);
}

function isExpectedAdminError(error) {
  return error instanceof AdminExpectedError;
}

module.exports = {
  AdminExpectedError,
  createAdminConflictError,
  createAdminNotFoundError,
  createAdminValidationError,
  isExpectedAdminError,
};
