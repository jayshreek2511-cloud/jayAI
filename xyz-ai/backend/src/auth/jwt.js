import { createHmac, timingSafeEqual } from 'node:crypto';

const algorithm = 'HS256';

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function decode(value) {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}

function signature(input, secret) {
  return createHmac('sha256', secret).update(input).digest('base64url');
}

export function signJwt(payload, secret, expiresInSeconds = 60 * 60) {
  const now = Math.floor(Date.now() / 1000);
  const header = encode({ alg: algorithm, typ: 'JWT' });
  const body = encode({ ...payload, iat: now, exp: now + expiresInSeconds });
  const unsignedToken = `${header}.${body}`;
  return `${unsignedToken}.${signature(unsignedToken, secret)}`;
}

export function verifyJwt(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed token');

  const [header, body, receivedSignature] = parts;
  const decodedHeader = decode(header);
  if (decodedHeader.alg !== algorithm || decodedHeader.typ !== 'JWT') {
    throw new Error('Unsupported token');
  }

  const expectedSignature = signature(`${header}.${body}`, secret);
  const received = Buffer.from(receivedSignature);
  const expected = Buffer.from(expectedSignature);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new Error('Invalid token signature');
  }

  const payload = decode(body);
  if (!payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) {
    throw new Error('Expired token');
  }
  return payload;
}

export function requireAuthentication({ jwtSecret }) {
  return (request, response, next) => {
    const authorization = request.get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return response.status(401).json({ error: 'A valid bearer token is required.' });
    }

    try {
      const payload = verifyJwt(authorization.slice('Bearer '.length), jwtSecret);
      request.auth = Object.freeze({
        userId: payload.userId,
        role: payload.role,
        linkedStudentId: payload.linkedStudentId,
        linkedClassId: payload.linkedClassId,
      });
      return next();
    } catch {
      return response.status(401).json({ error: 'Invalid or expired bearer token.' });
    }
  };
}
