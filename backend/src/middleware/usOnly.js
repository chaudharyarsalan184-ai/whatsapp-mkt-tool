const US_PHONE_REGEX = /^\+1[2-9]\d{9}$/;

export function validateUSPhone(phone) {
  if (!phone || typeof phone !== 'string') {
    return false;
  }
  return US_PHONE_REGEX.test(phone.trim());
}

export function usOnlyBody(req, res, next) {
  const phone = req.body?.phone;
  if (phone !== undefined && phone !== null && phone !== '') {
    if (!validateUSPhone(String(phone).trim())) {
      return res.status(400).json({ error: 'Only US phone numbers (+1) are supported' });
    }
  }
  next();
}

export function usOnlyParam(req, res, next) {
  const phone = req.params?.phone;
  if (phone !== undefined) {
    const normalized = decodeURIComponent(phone).trim();
    if (!validateUSPhone(normalized)) {
      return res.status(400).json({ error: 'Only US phone numbers (+1) are supported' });
    }
    req.params.phone = normalized;
  }
  next();
}
