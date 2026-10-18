import { describe, it, expect, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('non-destructive SQLite upgrade to adaptive journey',()=>{
  it('migrates schema v1 to v2 while retaining profile and mastery', async()=>{
    const dir=mkdtempSync(join(tmpdir(),'chess-journey-upgrade-'));
    const legacy=new DatabaseSync(join(dir,'chesstutor.sqlite'));
    legacy.exec(readFileSync(join(process.cwd(),'src/db/schema.sql'),'utf8'));
    legacy.exec("INSERT INTO meta (key,value) VALUES ('schema_version','1')");
    legacy.exec("INSERT INTO profile (id,display_name,created_at) VALUES (1,'Existing player','2026-01-01')");
    legacy.exec("INSERT INTO mastery (concept_id,mastery,attempts,independent_successes,streak) VALUES ('development',0.72,12,8,3)");
    legacy.close();
    vi.resetModules();
    process.env.DATA_DIR=dir;
    const { getDb } = await import('../src/db/index.js');
    const updated=getDb();
    expect((updated.prepare("SELECT value FROM meta WHERE key='schema_version'").get() as {value:string}).value).toBe('2');
    expect((updated.prepare("SELECT mastery, attempts FROM mastery WHERE concept_id='development'").get() as {mastery:number;attempts:number}))
      .toEqual({mastery:0.72,attempts:12});
    expect((updated.prepare('SELECT display_name FROM profile WHERE id=1').get() as {display_name:string}).display_name).toBe('Existing player');
    for(const table of ['journey_rounds','journey_answers','rating_games']){
      expect((updated.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table) as {name:string})?.name).toBe(table);
    }
    updated.close();
  });
});
