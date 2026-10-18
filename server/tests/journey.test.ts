import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { seed } from '../src/db/seed.js';
import { registerJourneyRoutes } from '../src/journey.js';
import { EXERCISES } from '../src/data/curriculum.js';
import { CONCEPTS } from '@chesstutor/shared';

let db:DatabaseSync;
let app:ReturnType<typeof Fastify>;
beforeEach(async()=>{
  db=new DatabaseSync(':memory:');
  db.exec(readFileSync(join(process.cwd(),'src/db/schema.sql'),'utf8'));
  db.exec(
    "CREATE TABLE journey_rounds (id TEXT PRIMARY KEY,concept_id TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'active',started_at TEXT NOT NULL,finished_at TEXT);"+
    "CREATE TABLE journey_answers (round_id TEXT,exercise_id TEXT,played_uci TEXT,correct INTEGER,outcome TEXT,hints_used INTEGER,created_at TEXT,PRIMARY KEY(round_id,exercise_id));"+
    "CREATE TABLE rating_games (id TEXT PRIMARY KEY,bot_level INTEGER,bot_label TEXT,result TEXT,termination TEXT,pgn TEXT,moves_uci TEXT,player_ms INTEGER,bot_ms INTEGER,training_estimate INTEGER,played_at TEXT);"
  );
  seed(db);
  app=Fastify();
  registerJourneyRoutes(app,db);
  await app.ready();
});
afterEach(async()=>{await app.close();db.close()});
function data(id:string){const e=EXERCISES.find(e=>e.id===id);if(!e)throw Error('missing '+id);return e}
async function start(id:string){
  return (await app.inject({method:'POST',url:'/api/journey/'+id+'/start'})).json();
}
async function answer(id:string,roundId:string,exId:string,playedUci?:string,hintsUsed=0,shown=false){
  return app.inject({method:'POST',url:'/api/journey/'+id+'/answer',
    payload:{roundId,exerciseId:exId,playedUci,hintsUsed,shown}});
}
describe('adaptive lesson unlocks',()=>{
  it('starts with just prerequisite-free concepts and a 1,200 goal',async()=>{
    const r=(await app.inject({method:'GET',url:'/api/journey'})).json();
    expect(r.goal).toBe(1200);
    expect(r.totalCount).toBe(CONCEPTS.length);
    expect(r.recommendedConceptId).toBe('rules-checkmates');
    expect(r.lessons.find((x:any)=>x.conceptId==='development').status).toBe('locked');
    expect((await app.inject({method:'POST',url:'/api/journey/development/start'})).statusCode).toBe(403);
  });
  it('unlocks the next lesson only after three correct with two independently solved',async()=>{
    const round=await start('rules-checkmates');
    const ids=['ex-rules-1','ex-rules-2','ex-rules-3','ex-rules-4'];
    let last:any;
    for(const id of ids){
      const e=data(id);
      const res=await answer('rules-checkmates',round.id,id,e.solutionUci[0]);
      expect(res.statusCode).toBe(200);
      last=res.json();
    }
    expect(last.status).toBe('passed');
    expect(last.correctCount).toBe(4);
    const overview=(await app.inject({method:'GET',url:'/api/journey'})).json();
    expect(overview.completedCount).toBe(1);
    expect(overview.lessons.find((x:any)=>x.conceptId==='development').status).toBe('ready');
    expect(overview.recommendedConceptId).toBe('development');
  });
  it('rejects mismatched lessons and repeated answers',async()=>{
    const round=await start('rules-checkmates');
    const wrong=await answer('rules-checkmates',round.id,'ex-dev-1','b1c3');
    expect(wrong.statusCode).toBe(400);
    const first=await answer('rules-checkmates',round.id,'ex-rules-1','a1a8');
    expect(first.json().correctCount).toBe(1);
    const repeat=await answer('rules-checkmates',round.id,'ex-rules-1','a1a8');
    expect(repeat.statusCode).toBe(409);
  });
  it('wrong answers and revealed solutions do not advance, and can retry',async()=>{
    const round=await start('rules-checkmates');
    let last:any;
    for(const id of ['ex-rules-1','ex-rules-2','ex-rules-3','ex-rules-4']){
      const res=await answer('rules-checkmates',round.id,id,data(id).solutionUci[0],0,true);
      last=res.json();
    }
    expect(last.status).toBe('retry');
    expect(last.correctCount).toBe(0);
    const overview=(await app.inject({method:'GET',url:'/api/journey'})).json();
    expect(overview.lessons.find((x:any)=>x.conceptId==='development').status).toBe('locked');
    const redo=await start('rules-checkmates');
    expect(redo.id).not.toBe(round.id);
    expect(redo.answers).toEqual([]);
  });
  it('hinted solves still require at least two independent answers',async()=>{
    const r=await start('rules-checkmates');
    let last:any;
    for(const id of ['ex-rules-1','ex-rules-2','ex-rules-3','ex-rules-4']){
      last=(await answer('rules-checkmates',r.id,id,data(id).solutionUci[0],1)).json();
    }
    expect(last.correctCount).toBe(4);
    expect(last.independentCount).toBe(0);
    expect(last.status).toBe('retry');
  });
});
describe('three minute rating training',()=>{
  it('distinguishes unassessed from a provisional estimate',async()=>{
    const first=(await app.inject({method:'GET',url:'/api/rating'})).json();
    expect(first.estimate).toBeNull();
    expect(first.target).toBe(1200);
    expect(first.confidence).toBe('unassessed');
  });
  it('accepts a checkmated loss only when verified by the board',async()=>{
    const body={botLevel:800,movesUci:['f2f3','e7e5','g2g4','d8h4'],result:'loss',
      termination:'checkmate',playerMs:130000,botMs:150000};
    const result=await app.inject({method:'POST',url:'/api/rating/game',payload:body});
    expect(result.statusCode).toBe(200);
    expect(result.json().estimate).toBe(635);
    expect(result.json().confidence).toBe('very-low');
    const dup=await app.inject({method:'POST',url:'/api/rating/game',payload:{...body,result:'win'}});
    expect(dup.statusCode).toBe(400);
    const count=(await app.inject({method:'GET',url:'/api/rating'})).json();
    expect(count.gamesPlayed).toBe(1);
  });
  it('does not credit impossible moves or an unexpired timeout',async()=>{
    const base={botLevel:1000,movesUci:['e2e4','e7e5'],result:'win',termination:'timeout',playerMs:178000,botMs:130000};
    expect((await app.inject({method:'POST',url:'/api/rating/game',payload:base})).statusCode).toBe(400);
    expect((await app.inject({method:'POST',url:'/api/rating/game',payload:{...base,botMs:0,movesUci:['e2e5','e7e5']}})).statusCode).toBe(400);
  });
});
