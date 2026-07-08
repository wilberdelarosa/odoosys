import fs from 'node:fs';
import path from 'node:path';

/**
 * Auditoria append-only para trazabilidad e-CF.
 *
 * Cada evento se guarda como una linea JSON (formato JSONL) en
 * `storage/audit/audit-YYYY-MM-DD.jsonl`. Es 100% local, no usa red, y nunca
 * lanza una excepcion que tumbe el flujo principal: si la auditoria falla,
 * solo deja un aviso en consola.
 *
 * Esto da una bitacora confiable de:
 * - emision de e-CF (encf, trackId, total, cliente),
 * - recepcion de comprobantes,
 * - aprobaciones comerciales,
 * - envios desde Odoo,
 * - y errores con contexto.
 */

export type AuditOutcome = 'ok' | 'error';

export interface AuditEvent {
  event: string;
  outcome: AuditOutcome;
  source?: string;
  encf?: string;
  trackId?: string;
  securityCode?: string;
  externalId?: string;
  customerRnc?: string;
  amount?: number;
  message?: string;
  detail?: Record<string, unknown>;
}

let auditRoot = '';

export function configureAudit(storageRoot: string): void {
  auditRoot = path.resolve(storageRoot, 'audit');
  try {
    fs.mkdirSync(auditRoot, { recursive: true });
  } catch (error) {
    console.warn('[audit] No se pudo crear el directorio de auditoria:', error);
  }
}

function currentFile(): string {
  const day = new Date().toISOString().slice(0, 10);
  return path.resolve(auditRoot, `audit-${day}.jsonl`);
}

export function recordAudit(event: AuditEvent): void {
  if (!auditRoot) {
    return;
  }

  const entry = {
    ts: new Date().toISOString(),
    ...event,
  };

  try {
    fs.appendFileSync(currentFile(), JSON.stringify(entry) + '\n', 'utf8');
  } catch (error) {
    console.warn('[audit] No se pudo escribir el evento de auditoria:', error);
  }
}

export interface AuditQuery {
  limit?: number;
  event?: string;
  outcome?: AuditOutcome;
}

export function readRecentAudit(query: AuditQuery = {}): AuditEvent[] {
  if (!auditRoot || !fs.existsSync(auditRoot)) {
    return [];
  }

  const limit = query.limit && query.limit > 0 ? query.limit : 100;
  const files = fs
    .readdirSync(auditRoot)
    .filter((name) => name.startsWith('audit-') && name.endsWith('.jsonl'))
    .sort()
    .reverse();

  const collected: AuditEvent[] = [];
  for (const file of files) {
    const lines = fs
      .readFileSync(path.resolve(auditRoot, file), 'utf8')
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .reverse();

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line) as AuditEvent;
        if (query.event && parsed.event !== query.event) {
          continue;
        }
        if (query.outcome && parsed.outcome !== query.outcome) {
          continue;
        }
        collected.push(parsed);
        if (collected.length >= limit) {
          return collected;
        }
      } catch {
        // Linea corrupta: se ignora para no romper la lectura del resto.
      }
    }
  }

  return collected;
}
