import initSqlJs from 'sql.js/dist/sql-asm.js';
import type { Database } from 'sql.js';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { validateEvent } from '../shared/rules';
import type { EventRecord } from '../shared/model';

export class TicketStore {
  private constructor(
    private db: Database,
    private path: string,
    readonly recoveredFromBackup = false,
  ) {
    db.run('CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, body TEXT NOT NULL)');
    db.run(
      'CREATE TABLE IF NOT EXISTS reminders (opportunity_id TEXT NOT NULL, starts_at TEXT NOT NULL, lead TEXT NOT NULL, PRIMARY KEY (opportunity_id, starts_at, lead))',
    );
  }

  static async open(path: string): Promise<TicketStore> {
    const SQL = await initSqlJs();
    const candidates = [path, `${path}.bak`].filter(existsSync);
    if (!candidates.length) return new TicketStore(new SQL.Database(), path);
    let lastError: unknown;
    for (const candidate of candidates) {
      let db: Database | undefined;
      try {
        db = new SQL.Database(readFileSync(candidate));
        const check = db.exec('PRAGMA integrity_check');
        if (check[0]?.values[0]?.[0] !== 'ok') throw new Error('SQLite 完整性检查失败');
        return new TicketStore(db, path, candidate !== path);
      } catch (error) {
        db?.close();
        lastError = error;
      }
    }
    throw new Error('本地任务数据库和备份均无法读取；请先保留原文件以便恢复', {
      cause: lastError,
    });
  }

  list(): EventRecord[] {
    const query = this.db.exec('SELECT body FROM events');
    return (query[0]?.values ?? [])
      .map((row) => JSON.parse(String(row[0])) as EventRecord)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  save(input: EventRecord): EventRecord {
    const item = validateEvent(input);
    this.db.run('INSERT OR REPLACE INTO events (id, body) VALUES (?, ?)', [
      item.id,
      JSON.stringify(item),
    ]);
    this.persist();
    return item;
  }

  remove(id: string): void {
    this.db.run('DELETE FROM events WHERE id = ?', [id]);
    this.persist();
  }

  hasReminder(id: string, at: string, lead: string): boolean {
    const seen = this.db.exec(
      'SELECT 1 FROM reminders WHERE opportunity_id = ? AND starts_at = ? AND lead = ?',
      [id, at, lead],
    );
    return seen.length > 0;
  }

  markReminder(id: string, at: string, lead: string): boolean {
    if (this.hasReminder(id, at, lead)) return false;
    this.db.run('INSERT INTO reminders VALUES (?, ?, ?)', [id, at, lead]);
    this.persist();
    return true;
  }

  private persist(): void {
    const bytes = Buffer.from(this.db.export());
    const temporary = `${this.path}.tmp`;
    writeFileSync(temporary, bytes);
    renameSync(temporary, this.path);
    const backupTemporary = `${this.path}.bak.tmp`;
    try {
      writeFileSync(backupTemporary, bytes);
      renameSync(backupTemporary, `${this.path}.bak`);
    } catch (error) {
      console.error('无法更新本地任务数据库备份', error);
    }
  }

  close(): void {
    this.db.close();
  }
}
