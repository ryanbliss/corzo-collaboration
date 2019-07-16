import jwt from 'jsonwebtoken';

export default function parseJwt(accessToken) {
  try {
    return jwt.verify(accessToken, 'secret');
  } catch (err) {
    throw err;
  }
}
