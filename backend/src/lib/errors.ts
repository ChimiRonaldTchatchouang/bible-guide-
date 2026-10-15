export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code = 'error',
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (msg: string, details?: unknown) => new HttpError(400, msg, 'bad_request', details);
export const unauthorized = (msg = 'Authentification requise') => new HttpError(401, msg, 'unauthorized');
export const forbidden = (msg = 'Accès refusé') => new HttpError(403, msg, 'forbidden');
export const notFound = (msg = 'Ressource introuvable') => new HttpError(404, msg, 'not_found');
export const conflict = (msg: string) => new HttpError(409, msg, 'conflict');
