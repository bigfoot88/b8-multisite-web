async function loginAsAdmin(agent) {
  const response = await agent
    .post('/admin/login')
    .type('form')
    .send({ username: 'admin', password: 'ChangeMe123!' });

  return response;
}

module.exports = {
  loginAsAdmin,
};
