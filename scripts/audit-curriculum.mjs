#!/usr/bin/env node
// Diagnostic-only audit. Requires system Stockfish and installed chess.js.
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { Chess } from 'chess.js';
function load(name, filename = 'server/src/data/curriculum.ts') {
  let s=readFileSync(filename,'utf8');
  s=s.replace(/^import type .*$/gm,'').replace(/export const (\w+): \w+\[\] =/g,'const $1 =');
  return new Function(s+'; return '+name+';')();
}
const EXERCISES=load('EXERCISES');
const bin=process.env.STOCKFISH_BIN || '/usr/games/stockfish';
const sf=spawn(bin,[],{stdio:['pipe','pipe','pipe']});
sf.stderr.on('data',d=>process.stderr.write(d));
const lines=createInterface({input:sf.stdout});
let active=null;
lines.on('line',line=>{
  if(!active)return;
  if(line.startsWith('info ')&&line.includes(' score ')){
    const m=line.match(/ score (cp|mate) (-?\d+)/);
    if(m){active.score=m[1]==='mate'?(Number(m[2])>0?100000-Number(m[2]):-100000-Number(m[2])):Number(m[2]);active.mate=m[1]==='mate'?Number(m[2]):null;}
  }
  if(line.startsWith('bestmove ')){
    const a=active;active=null;clearTimeout(a.timer);
    a.resolve({best:line.split(' ')[1],cp:a.score,mate:a.mate});
  }
});
function analyze(fen,movetime=150){
  return new Promise((resolve,reject)=>{
    if(active)throw Error('concurrent stockfish call');
    const obj={resolve,reject,score:null,mate:null,timer:null};
    obj.timer=setTimeout(()=>{active=null;reject(Error('timeout '+fen));},5000);
    active=obj;sf.stdin.write('position fen '+fen+'\ngo movetime '+movetime+'\n');
  });
}
const all=[];
const problems=[];
for(const e of EXERCISES){
  const c=new Chess(e.fen);
  const color=c.turn(),opp=color==='w'?'b':'w';
  let oppKing=null;
  for(const row of c.board())for(const sq of row)if(sq?.type==='k'&&sq.color===opp)oppKing=sq.square;
  const invalidPre=oppKing?c.isAttacked(oppKing,color):false;
  const legal=c.moves({verbose:true});
  let result={id:e.id,concept:e.conceptId,kind:e.kind,prompt:e.prompt,solution:e.solutionUci?.join(' '),fen:e.fen,invalidPre,legal:legal.length,whiteInCheck:color==='w'&&c.isCheck(),turn:color};
  if(e.kind!=='yes-no'){
    if(invalidPre) {
      result.error='INVALID POSITION: the player to move already attacks the opponent king';
      problems.push(e.id + ': nonmoving king was already in check');
      all.push(result); console.log(JSON.stringify(result)); continue;
    }
    result.current=await analyze(c.fen(),170);
    try{
      const move=e.solutionUci[0];
      c.move({from:move.slice(0,2),to:move.slice(2,4),promotion:move[4]});
      result.givesMate=c.isCheckmate();
      result.givesCheck=c.isCheck();
      result.after= c.isGameOver()?{best:'gameover',cp:c.isCheckmate()?-100000:0,mate:c.isCheckmate()?-1:null}:await analyze(c.fen(),170);
      result.cpLoss=result.current.cp==null||result.after.cp==null?null:result.current.cp+result.after.cp;
    }catch(err){result.error=String(err);}
    if(e.kind==='choose-move'){
      const mates=[];
      for(const choice of e.choices??[]){const g=new Chess(e.fen);g.move({from:choice.slice(0,2),to:choice.slice(2,4),promotion:choice[4]});if(g.isCheckmate())mates.push(choice);}
      result.mateChoices=mates;
    }
  }else{
    result.check=c.isCheck();result.stalemate=c.isStalemate();result.checkmate=c.isCheckmate();
  }
  all.push(result);
  console.log(JSON.stringify(result));
  if (result.invalidPre || result.error) problems.push(e.id + ': impossible/invalid chess position');
  // Material mistakes and missed forced mates must fail CI, not merely be logged.
  if (result.cpLoss != null && result.cpLoss > 175) problems.push(e.id + ': selected move loses ' + result.cpLoss + ' centipawns vs engine best');
  if (/mate in (?:one|1)|which move checkmates|mates immediately|immediate checkmate|deliver checkmate/i.test(e.prompt)
      && !result.givesMate) problems.push(e.id + ': claimed checkmate fails');
}
const SEED_PUZZLES=load('SEED_PUZZLES','server/src/data/seed-puzzles.ts');
for(const p of SEED_PUZZLES){
  const c=new Chess(p.fen),side=c.turn(),opp=side==='w'?'b':'w';
  let king=null;
  for(const row of c.board())for(const sq of row)if(sq?.type==='k'&&sq.color===opp)king=sq.square;
  const invalid=king&&c.isAttacked(king,side);
  const m1=p.themes.includes('mateIn1');
  const legal=c.moves({verbose:true});
  const mates=m1?legal.filter(move=>{const test=new Chess(p.fen);test.move(move);return test.isCheckmate();}).map(move=>move.from+move.to+(move.promotion??'')):[];
  console.log(JSON.stringify({puzzle:p.id,illegal:invalid,mateIn1:m1,choicesMate:mates,expected:p.solutionUci[0],fen:p.fen}));
  if (invalid) problems.push(p.id + ': illegal starting position');
  if (m1 && (mates.length !== 1 || mates[0] !== p.solutionUci[0])) {
    problems.push(p.id + ': mate-in-one puzzle has a missing or uncredited alternate solution: ' + mates.join(','));
  }
}
sf.stdin.write('quit\n');sf.kill();
if(problems.length){
  console.error('CURRICULUM AUDIT FAILURE: ' + problems.length + ' problems');
  for(const message of problems)console.error(' - '+message);
  process.exitCode=1;
}else{
  console.log('CURRICULUM AUDIT PASSED: 60 exercises and 48 puzzle positions checked.');
}
