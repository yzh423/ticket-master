import initSqlJs from 'sql.js/dist/sql-asm.js';
import type { Database } from 'sql.js';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { validateEvent } from '../shared/rules';
import type { EventRecord } from '../shared/model';

export class TicketStore {
  private constructor(
    private db: Database,
    private path: string,
  ) {
    db.run('CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, body TEXT NOT NULL)');
    db.run(
      'CREATE TABLE IF NOT EXISTS reminders (opportunity_id TEXT NOT NULL, starts_at TEXT NOT NULL, lead TEXT NOT NULL, PRIMARY KEY (opportunity_id, starts_at, lead))',
    );
  }

  static async open(path: string): Promise<TicketStore> {
    const SQL = await initSqlJs();
    const db = existsSync(path) ? new SQL.Database(readFileSync(path)) : new SQL.Database();
    return new TicketStore(db, path);
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

  markReminder(id: string, at: string, lead: string): boolean {
    const seen = this.db.exec(
      'SELECT 1 FROM reminders WHERE opportunity_id = ? AND starts_at = ? AND lead = ?',
      [id, at, lead],
    );
    if (seen.length) return false;
    this.db.run('INSERT INTO reminders VALUES (?, ?, ?)', [id, at, lead]);
    this.persist();
    return true;
  }

  private persist(): void {
    const temporary = `${this.path}.tmp`;
    writeFileSync(temporary, Buffer.from(this.db.export()));
    renameSync(temporary, this.path);
  }

  close(): void {
    this.db.close();
  }
}
