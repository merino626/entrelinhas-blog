// Access token SOMENTE em memória (nunca em localStorage — mitiga roubo por XSS).
// O refresh token vive em cookie httpOnly gerenciado pela API.

let accessToken: string | null = null;
let expiresAt = 0; // epoch em segundos

export function setToken(token: string | null, exp = 0) {
  accessToken = token;
  expiresAt = exp;
}

export function getToken(): string | null {
  return accessToken;
}

export function getExpiresAt(): number {
  return expiresAt;
}

export function isTokenFresh(): boolean {
  return accessToken !== null && Date.now() / 1000 < expiresAt - 30;
}
