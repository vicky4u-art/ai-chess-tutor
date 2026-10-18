/** Adaptive course and provisional three-minute game assessment. */
import { randomUUID } from 'node:crypto';
import { Chess } from 'chess.js';
import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { CONCEPTS, type AttemptOutcome, type ConceptId, type JourneyOverview, type JourneyRound, type RatingSummary } from '@chesstutor/shared';
import { updateMastery } from './learning.js';
import { transaction } from './db/index.js';

type R = Record<string, any>;
const now = () => new Date().toISOString();
const error = (message: string, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const parse = (s: unknown): string[] => JSON.parse(String(s)) as string[];
const valid = (id: string): id is ConceptId => CONCEPTS.some(c=>c.id===id);
function latestRound(db: DatabaseSync, id: string): R | undefined {
  return db.prepare('SELECT * FROM journey_rounds WHERE concept_id=? ORDER BY started_at DESC, rowid DESC LIMIT 1').get(id) as R | undefined;
}
function passedConcepts(db: DatabaseSync): Set<string> {
  return new Set((db.prepare("SELECT DISTINCT concept_id FROM journey_rounds WHERE status='passed'").all() as R[]).map(x=>String(x.concept_id)));
}
function correctMove(fen: string, prompt: string, primary: string[], alternatives: string[][], played?: string): boolean {
  if (!played) return false;
  const move = played.toLowerCase();
  if (primary[0]?.toLowerCase()===move || alternatives.some(a=>a[0]?.toLowerCase()===move)) return true;
  if (!/(?:mate in (?:one|1)|which move checkmates|immediate checkmate|find a checkmate in one)/i.test(prompt)) return false;
  try {
    const g=new Chess(fen);
    g.move({from:move.slice(0,2),to:move.slice(2,4),promotion:move[4]});
    return g.isCheckmate();
  } catch { return false; }
}
export function journeyOverview(db: DatabaseSync): JourneyOverview {
  const completed=passedConcepts(db);
  const lessons=db.prepare('SELECT id,concept_id,title FROM lessons').all() as R[];
  const byConcept=new Map(lessons.map(x=>[x.concept_id,x]));
  const mastery=new Map((db.prepare('SELECT concept_id,mastery FROM mastery').all() as R[]).map(x=>[x.concept_id,Number(x.mastery)]));
  const items=CONCEPTS.map((c,i)=>{
    const latest=latestRound(db,c.id);
    const best=db.prepare('SELECT MAX(score) AS score FROM (SELECT round_id,SUM(correct) AS score FROM journey_answers WHERE round_id IN (SELECT id FROM journey_rounds WHERE concept_id=?) GROUP BY round_id)').get(c.id) as R;
    const eligible=c.prerequisites.every(p=>completed.has(p));
    return {
      conceptId:c.id,title:String(byConcept.get(c.id)?.title??c.name),
      lessonId:String(byConcept.get(c.id)?.id??('lesson-'+c.id)),
      status:completed.has(c.id)?'completed' as const:!eligible?'locked' as const:latest?.status==='active'?'active' as const:'ready' as const,
      mastery:mastery.get(c.id)??0.2,prerequisites:c.prerequisites,
      bestScore:Number(best?.score??0),roundId:latest?.status==='active'?String(latest.id):undefined,
      reviewSuggested:completed.has(c.id)&&(mastery.get(c.id)??0.2)<0.45,order:i,
    };
  });
  const choices=items.filter(x=>x.status==='active'||x.status==='ready');
  choices.sort((a,b)=>(a.status==='active'?0:a.bestScore>0?1:2)-(b.status==='active'?0:b.bestScore>0?1:2)||a.order-b.order);
  const review=items.filter(x=>x.reviewSuggested).sort((a,b)=>a.mastery-b.mastery)[0];
  const active=choices.find(x=>x.status==='active');
  // A shaky pass unlocks prerequisites but recommends immediate reinforcement.
  // Already-active practice takes precedence so a learner can finish a round.
  return {goal:1200,lessons:items.map(({order,...rest})=>rest),
    recommendedConceptId:active?.conceptId??review?.conceptId??choices[0]?.conceptId??null,
    completedCount:completed.size,totalCount:CONCEPTS.length};
}
function readRound(db:DatabaseSync,round:R):JourneyRound {
  const answers=(db.prepare('SELECT exercise_id,correct,outcome FROM journey_answers WHERE round_id=? ORDER BY rowid').all(round.id) as R[])
    .map(x=>({exerciseId:String(x.exercise_id),correct:Boolean(x.correct),outcome:x.outcome as AttemptOutcome}));
  const lesson=db.prepare('SELECT exercise_ids FROM lessons WHERE concept_id=? ORDER BY level LIMIT 1').get(round.concept_id) as R;
  const total=parse(lesson.exercise_ids).length;
  const correctCount=answers.filter(x=>x.correct).length;
  const independentCount=answers.filter(x=>x.correct&&x.outcome==='independent').length;
  const passed=round.status==='passed';
  return {
    id:String(round.id),conceptId:round.concept_id,status:round.status,answers,
    correctCount,independentCount,total,passed,
    feedback:round.status==='active'
      ? 'Solve at least 3 of 4 exercises correctly, including 2 independently, to unlock the next lesson.'
      : passed?'Lesson mastered. The next lesson is unlocked.':'Review the demonstration, then retry this lesson to build mastery.'
  };
}
function ensureUnlocked(db:DatabaseSync,id:ConceptId):void {
  if(!CONCEPTS.find(c=>c.id===id)!.prerequisites.every(p=>passedConcepts(db).has(p)))
    throw error('Complete prerequisite lessons first.',403);
}
export function ratingSummary(db:DatabaseSync):RatingSummary {
  const rows=db.prepare('SELECT * FROM rating_games ORDER BY played_at DESC, rowid DESC LIMIT 20').all() as R[];
  const latest=rows[0];
  const count=Number((db.prepare('SELECT COUNT(*) AS n FROM rating_games').get() as R).n);
  const estimate=latest?Number(latest.training_estimate):null;
  const recommended=estimate===null?800:estimate<700?600:estimate<900?800:estimate<1100?1000:1200;
  return {
    target:1200,estimate,
    confidence:count===0?'unassessed':count===1?'very-low':count<5?'low':'developing',
    margin:estimate===null?null:count===1?350:count<5?280:220,
    gamesPlayed:count,recommendedBotLevel:recommended,
    recentGames:rows.slice(0,8).map(x=>({id:String(x.id),botLevel:Number(x.bot_level),
      botLabel:String(x.bot_label),result:x.result,termination:x.termination,
      estimate:Number(x.training_estimate),playedAt:String(x.played_at)})),
    note:'Provisional practice-strength estimate using approximate Stockfish bot strengths, not official Elo. One 3-minute game cannot determine an accurate Chess.com/FIDE rating.'
  };
}
export function registerJourneyRoutes(app:FastifyInstance,db:DatabaseSync):void {
  app.get('/api/journey',async()=>journeyOverview(db));
  app.get<{Params:{conceptId:string}}>('/api/journey/:conceptId/round',async(req)=>{
    if(!valid(req.params.conceptId))throw error('Unknown lesson',404);
    const round=latestRound(db,req.params.conceptId);
    return round?readRound(db,round):null;
  });
  app.post<{Params:{conceptId:string}}>('/api/journey/:conceptId/start',async(req)=>{
    const id=req.params.conceptId;
    if(!valid(id))throw error('Unknown lesson',404);
    ensureUnlocked(db,id);
    const prior=latestRound(db,id);
    if(prior?.status==='active')return readRound(db,prior);
    const uuid=randomUUID(),at=now();
    db.prepare("INSERT INTO journey_rounds (id,concept_id,status,started_at) VALUES (?,?,'active',?)").run(uuid,id,at);
    return readRound(db,{id:uuid,concept_id:id,status:'active'});
  });
  app.post<{Params:{conceptId:string};Body:{roundId?:string;exerciseId?:string;playedUci?:string;hintsUsed?:number;shown?:boolean}}>('/api/journey/:conceptId/answer',async(req)=>{
    const id=req.params.conceptId;
    if(!valid(id))throw error('Unknown lesson',404);
    ensureUnlocked(db,id);
    const b=req.body??{},round=latestRound(db,id);
    if(!round||round.status!=='active'||round.id!==b.roundId)throw error('No matching active practice round',409);
    const lesson=db.prepare('SELECT exercise_ids FROM lessons WHERE concept_id=? ORDER BY level LIMIT 1').get(id) as R;
    const ids=parse(lesson.exercise_ids);
    if(!b.exerciseId||!ids.includes(b.exerciseId))throw error('Exercise does not belong to this lesson');
    if(db.prepare('SELECT exercise_id FROM journey_answers WHERE round_id=? AND exercise_id=?').get(round.id,b.exerciseId))
      throw error('Exercise already answered this round',409);
    const ex=db.prepare('SELECT * FROM exercises WHERE id=?').get(b.exerciseId) as R;
    const hints=Number.isFinite(b.hintsUsed)?Math.max(0,Math.min(3,Math.round(Number(b.hintsUsed)))):0;
    const correct=!b.shown&&correctMove(ex.fen,ex.prompt,parse(ex.solution_uci),ex.acceptable_uci?JSON.parse(ex.acceptable_uci):[],b.playedUci);
    const outcome:AttemptOutcome=!correct?'shown':hints?'hinted':'independent';
    transaction(db,()=>{
      db.prepare('INSERT INTO journey_answers (round_id,exercise_id,played_uci,correct,outcome,hints_used,created_at) VALUES (?,?,?,?,?,?,?)')
        .run(round.id,String(b.exerciseId),b.playedUci??null,correct?1:0,outcome,hints,now());
      const prior=db.prepare('SELECT * FROM mastery WHERE concept_id=?').get(id) as R;
      const updated=updateMastery({
        conceptId:id,mastery:Number(prior.mastery),attempts:Number(prior.attempts),
        independentSuccesses:Number(prior.independent_successes),
        lastSeenAt:prior.last_seen_at,nextReviewAt:prior.next_review_at
      },Number(prior.streak),outcome);
      db.prepare('UPDATE mastery SET mastery=?,attempts=?,independent_successes=?,streak=?,last_seen_at=?,next_review_at=? WHERE concept_id=?')
        .run(updated.record.mastery,updated.record.attempts,updated.record.independentSuccesses,
          updated.streak,updated.record.lastSeenAt,updated.record.nextReviewAt,id);
      const answers=db.prepare('SELECT correct,outcome FROM journey_answers WHERE round_id=?').all(round.id) as R[];
      if(answers.length===ids.length){
        const wins=answers.filter(x=>x.correct).length, independent=answers.filter(x=>x.correct&&x.outcome==='independent').length;
        db.prepare('UPDATE journey_rounds SET status=?,finished_at=? WHERE id=?')
          .run(wins>=3&&independent>=2?'passed':'retry',now(),round.id);
      }
    });
    return readRound(db,db.prepare('SELECT * FROM journey_rounds WHERE id=?').get(round.id) as R);
  });
  app.get('/api/rating',async()=>ratingSummary(db));
  app.post<{Body:{botLevel?:number;movesUci?:string[];result?:string;termination?:string;playerMs?:number;botMs?:number}}>('/api/rating/game',async(req)=>{
    const b=req.body??{};
    if(![600,800,1000,1200].includes(Number(b.botLevel)))throw error('Choose a supported training bot');
    if(!Array.isArray(b.movesUci)||b.movesUci.length<2||b.movesUci.length>350)throw error('Invalid game move history');
    if(!['win','loss','draw'].includes(String(b.result)))throw error('Invalid game result');
    if(!['checkmate','draw','timeout','resign'].includes(String(b.termination)))throw error('Invalid game ending');
    const pms=Number(b.playerMs),bms=Number(b.botMs);
    if(!Number.isFinite(pms)||!Number.isFinite(bms)||pms<0||pms>180000||bms<0||bms>180000)throw error('Invalid three-minute clocks');
    const game=new Chess();
    try {
      for(const u of b.movesUci){
        if(typeof u!=='string'||!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(u))throw Error('invalid');
        game.move({from:u.slice(0,2),to:u.slice(2,4),promotion:u[4]});
      }
    }catch{throw error('Move history contains an illegal chess move');}
    let actual:'win'|'loss'|'draw';
    if(b.termination==='checkmate'){
      if(!game.isCheckmate())throw error('Position is not checkmate');
      actual=game.turn()==='b'?'win':'loss';
    }else if(b.termination==='draw'){
      if(!game.isDraw())throw error('Position is not drawn');
      actual='draw';
    }else if(b.termination==='timeout'){
      if(pms>0&&bms>0)throw error('Neither clock has expired');
      actual=pms===0?'loss':'win';
    }else actual='loss';
    if(actual!==b.result)throw error('Game result does not match the position or clock');
    const previous=ratingSummary(db),bot=Number(b.botLevel);
    const performance=bot+(actual==='win'?165:actual==='loss'?-165:0);
    const estimate=Math.max(300,Math.min(1800,Math.round(previous.estimate===null?performance:previous.estimate*0.7+performance*0.3)));
    db.prepare('INSERT INTO rating_games (id,bot_level,bot_label,result,termination,pgn,moves_uci,player_ms,bot_ms,training_estimate,played_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
      .run(randomUUID(),bot,'Approx. '+bot+' training bot',actual,String(b.termination),game.pgn(),JSON.stringify(b.movesUci),pms,bms,estimate,now());
    return ratingSummary(db);
  });
}
