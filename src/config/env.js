function parsePort(value) {
  if (!/^\d+$/.test(value)) {
    throw new Error('PORT must be an integer between 0 and 65535');
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error('PORT must be an integer between 0 and 65535');
  }

  return port;
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parsePort(process.env.PORT || '3000'),
};

module.exports = {
  env,
};
