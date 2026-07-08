import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { backup, DatabaseSync } from 'node:sqlite';

export interface AppDataStoreOptions {
  databaseFile: string;
  backupRoot: string;
  legacyJsonFile?: string;
  backupRetention: number;
}

export class AppDataStore<T> {
  private database: DatabaseSync;
  private readonly options: AppDataStoreOptions;

  constructor(options: AppDataStoreOptions) {
    this.options = options;
    fs.mkdirSync(path.dirname(options.databaseFile), { recursive: true });
    fs.mkdirSync(options.backupRoot, { recursive: true });

    this.database = this.openWithRecovery();
    this.initializeSchema();
  }

  private initializeSchema() {
    this.database.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = FULL;
      PRAGMA foreign_keys = ON;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS app_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        schema_version INTEGER NOT NULL,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  }

  load(): T | null {
    const row = this.database
      .prepare('SELECT payload FROM app_state WHERE id = 1')
      .get() as { payload?: string } | undefined;

    if (row?.payload) {
      return JSON.parse(row.payload) as T;
    }

    return this.loadLegacyJson();
  }

  save(data: T) {
    const payload = JSON.stringify(data);
    const now = new Date().toISOString();

    this.database.exec('BEGIN IMMEDIATE');
    try {
      this.database
        .prepare(`
          INSERT INTO app_state (id, schema_version, payload, updated_at)
          VALUES (1, 1, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            schema_version = excluded.schema_version,
            payload = excluded.payload,
            updated_at = excluded.updated_at
        `)
        .run(payload, now);
      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  async createBackup() {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const destination = path.resolve(
      this.options.backupRoot,
      `facturador-${stamp}-${crypto.randomUUID().slice(0, 8)}.sqlite`
    );
    await backup(this.database, destination);
    await this.pruneBackups();
    return destination;
  }

  close() {
    this.database.close();
  }

  private loadLegacyJson(): T | null {
    const legacyFile = this.options.legacyJsonFile;
    if (!legacyFile || !fs.existsSync(legacyFile)) {
      return null;
    }

    const parsed = JSON.parse(fs.readFileSync(legacyFile, 'utf8')) as T;
    this.save(parsed);
    fs.copyFileSync(legacyFile, `${legacyFile}.migrated.bak`);
    return parsed;
  }

  private openWithRecovery() {
    let candidate: DatabaseSync | null = null;
    try {
      candidate = new DatabaseSync(this.options.databaseFile);
      const result = candidate.prepare('PRAGMA integrity_check').get() as {
        integrity_check?: string;
      };
      if (result.integrity_check !== 'ok') {
        candidate.close();
        candidate = null;
        throw new Error(`SQLite integrity_check: ${result.integrity_check || 'sin resultado'}`);
      }
      return candidate;
    } catch (error) {
      candidate?.close();
      const latestBackup = this.findLatestBackup();
      if (!latestBackup) {
        throw error;
      }

      const corruptFile = `${this.options.databaseFile}.corrupt-${Date.now()}`;
      if (fs.existsSync(this.options.databaseFile)) {
        fs.renameSync(this.options.databaseFile, corruptFile);
      }
      fs.rmSync(`${this.options.databaseFile}-wal`, { force: true });
      fs.rmSync(`${this.options.databaseFile}-shm`, { force: true });
      fs.copyFileSync(latestBackup, this.options.databaseFile);
      return new DatabaseSync(this.options.databaseFile);
    }
  }

  private findLatestBackup() {
    const backup = fs
      .readdirSync(this.options.backupRoot, { withFileTypes: true })
      .filter((entry) => entry.isFile() && /^facturador-.*\.sqlite$/.test(entry.name))
      .map((entry) => entry.name)
      .sort()
      .reverse()[0];
    return backup ? path.resolve(this.options.backupRoot, backup) : null;
  }

  private async pruneBackups() {
    const backups = (await fs.promises.readdir(this.options.backupRoot, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && /^facturador-.*\.sqlite$/.test(entry.name))
      .map((entry) => entry.name)
      .sort()
      .reverse();

    await Promise.all(
      backups.slice(this.options.backupRetention).map((name) =>
        fs.promises.rm(path.resolve(this.options.backupRoot, name), { force: true })
      )
    );
  }
}
