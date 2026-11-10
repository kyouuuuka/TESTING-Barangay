// Role → modules it may open. Change who sees what here.
export const ROLES = {
  admin: ['admin', 'residents', 'certificates', 'cedula', 'receipts', 'blotter', 'accounting', 'procurement', 'inventory', 'officials', 'reports'],
  secretary: ['residents', 'certificates', 'blotter', 'officials', 'reports'],
  treasurer: ['cedula', 'receipts', 'accounting', 'procurement', 'inventory', 'reports'],
  encoder: ['residents'],
};

export const isRole = (role) => Object.hasOwn(ROLES, role);

export const requireLogin = (req, res, next) =>
  req.session.user ? next() : res.status(401).json({ error: 'Please log in' });

export const requireModule = (module) => (req, res, next) => {
  const user = req.session.user;
  if (!user) return res.status(401).json({ error: 'Please log in' });
  if (!ROLES[user.role]?.includes(module)) return res.status(403).json({ error: 'Not allowed' });
  next();
};
