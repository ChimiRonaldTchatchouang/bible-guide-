import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../lib/errors.js';

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: { code: 'not_found', message: `Route inconnue : ${req.method} ${req.path}` } });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  // JSON mal formé envoyé par le client
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: { code: 'bad_json', message: 'Corps JSON invalide' } });
    return;
  }
  // Violations de contraintes PostgreSQL
  const pgCode = (err as { code?: string; cause?: { code?: string } })?.cause?.code ?? (err as { code?: string })?.code;
  if (pgCode === '23505') {
    res.status(409).json({ error: { code: 'conflict', message: 'Cette valeur existe déjà' } });
    return;
  }
  if (pgCode === '23503') {
    res.status(400).json({ error: { code: 'bad_reference', message: 'Référence vers un élément inexistant' } });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { code: 'internal', message: 'Erreur interne du serveur' } });
}
