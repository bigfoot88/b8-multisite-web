function mapAdmin(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    username: row.username,
    email: row.email,
    passwordHash: row.password_hash,
    displayName: row.display_name,
    role: row.role,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function createAdminRepository(db) {
  const insertAdmin = db.prepare(`
    INSERT INTO admins (username, email, password_hash, display_name, role, is_active)
    VALUES (@username, @email, @passwordHash, @displayName, @role, @isActive)
  `);
  const selectByEmail = db.prepare('SELECT * FROM admins WHERE email = ?');
  const selectById = db.prepare('SELECT * FROM admins WHERE id = ?');
  const selectByUsername = db.prepare('SELECT * FROM admins WHERE username = ?');
  const selectAll = db.prepare('SELECT * FROM admins ORDER BY username ASC');

  return {
    createAdmin({ username, email = null, passwordHash, displayName, role = 'superadmin', isActive = true }) {
      const info = insertAdmin.run({
        username,
        email,
        passwordHash,
        displayName,
        role,
        isActive: isActive ? 1 : 0,
      });
      return mapAdmin(db.prepare('SELECT * FROM admins WHERE id = ?').get(info.lastInsertRowid));
    },
    findByEmail(email) {
      return mapAdmin(selectByEmail.get(email));
    },
    findById(id) {
      return mapAdmin(selectById.get(id));
    },
    findByUsername(username) {
      return mapAdmin(selectByUsername.get(username));
    },
    listAdmins() {
      return selectAll.all().map(mapAdmin);
    },
  };
}

module.exports = {
  createAdminRepository,
};
