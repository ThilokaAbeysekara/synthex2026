const { readPublicConfig } = require('../public-config.cjs');
module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    return res.status(200).json(readPublicConfig(process.env));
  } catch {
    return res.status(503).json({ error: 'Submission service is not configured. Please contact the organizers.' });
  }
};
