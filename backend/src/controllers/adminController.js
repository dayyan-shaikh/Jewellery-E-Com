const getAdminAccess = (req, res) => res.status(200).json({
  success: true,
  data: { allowed: true, user: req.user },
});

module.exports = { getAdminAccess };
