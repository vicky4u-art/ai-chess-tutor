/** Three-minute-per-side assessment against approximate-strength Stockfish.
 * Training estimate only; not official Chess.com/FIDE/USCF Elo. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import type { RatingSummary } from '@chesstutor/shared';
import { engine } from '../chess/engine';
import { ChessboardView } from '../components/Chessboard';
import { api, ChessApiError } from '../api';
import { Btn, Card, Loading, SectionTitle } from '../components/ui';
const CLOCK=180000;
const LEVELS=[600,800,1000,1200] as const;
const SKILL:Record<number,number>={600:0,800:2,1000:5,1200:9};
const stamp=(milliseconds:number)=>{
  const s=Math.ceil(Math.max(0,milliseconds)/1000);
  return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');
};
type Status='setup'|'loading'|'playing'|'finished'|'engine-error';
type Result='win'|'loss'|'draw';
type Termination='checkmate'|'draw'|'timeout'|'resign';

export function RatingMatch() {
  const [summary,setSummary]=useState<RatingSummary|null>(null);
  const [level,setLevel]=useState(800);
  const [status,setStatus]=useState<Status>('setup');
  const statusRef=useRef<Status>('setup');
  const [fen,setFen]=useState(()=>new Chess().fen());
  const board=useRef(new Chess());
  const [moves,setMoves]=useState<string[]>([]);
  const [clock,setClock]=useState<[number,number]>([CLOCK,CLOCK]);
  const remaining=useRef<[number,number]>([CLOCK,CLOCK]);
  const startedAt=useRef(Date.now());
  const [thinking,setThinking]=useState(false);
  const [outcome,setOutcome]=useState<Result|null>(null);
  const [reason,setReason]=useState<Termination|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [saving,setSaving]=useState(false);
  const generation=useRef(0);

  useEffect(()=>{
    api.ratingSummary().then(s=>{setSummary(s);setLevel(s.recommendedBotLevel);})
      .catch(e=>setError(e instanceof ChessApiError?e.message:'Could not load rating history.'));
    return ()=>{generation.current++;engine.stop();};
  },[]);

  const sync=()=>{setFen(board.current.fen());setMoves(board.current.history());};
  const chargeClock=()=>{
    if(statusRef.current!=='playing')return;
    const now=Date.now(),side=board.current.turn()==='w'?0:1;
    const elapsed=Math.max(0,now-startedAt.current);
    remaining.current[side]=Math.max(0,remaining.current[side]-elapsed);
    startedAt.current=now;
    setClock([...remaining.current] as [number,number]);
  };
  const end=useCallback(async(result:Result,termination:Termination)=>{
    if(statusRef.current!=='playing')return;
    statusRef.current='finished';setStatus('finished');setThinking(false);
    setOutcome(result);setReason(termination);setError(null);
    generation.current++;
    setSaving(true);
    const played=board.current.history({verbose:true}).map(m=>m.from+m.to+(m.promotion??''));
    try {
      const resultData=await api.recordRatingGame({
        botLevel:level,movesUci:played,result,termination,
        playerMs:Math.round(remaining.current[0]),botMs:Math.round(remaining.current[1]),
      });
      setSummary(resultData);
    }catch(e){setError(e instanceof ChessApiError?e.message:'Match completed, but the estimate could not be saved.');}
    finally{setSaving(false);}
  },[level]);

  useEffect(()=>{
    if(status!=='playing')return;
    const id=setInterval(()=>{
      chargeClock();
      if(remaining.current[0]<=0){void end('loss','timeout');}
      else if(remaining.current[1]<=0){void end('win','timeout');}
    },120);
    return ()=>clearInterval(id);
  },[status,end]);

  const start=async()=>{
    setError(null);setStatus('loading');statusRef.current='loading';
    try {
      await engine.init(18000);
      engine.setSkill(SKILL[level]);
      board.current=new Chess();
      remaining.current=[CLOCK,CLOCK];setClock([CLOCK,CLOCK]);
      setFen(board.current.fen());setMoves([]);setOutcome(null);setReason(null);
      setThinking(false);startedAt.current=Date.now();
      generation.current++;statusRef.current='playing';setStatus('playing');
    }catch(e){
      setError('The chess engine could not start. A timed rating assessment requires a working engine. '+String((e as Error).message));
      statusRef.current='engine-error';setStatus('engine-error');
    }
  };
  const respond=async(token:number)=>{
    setThinking(true);
    try {
      // Bot strength uses Stockfish's skill control. These are practice bands,
      // not calibrated official Elo opponents.
      engine.setSkill(SKILL[level]);
      const choice=await engine.analyze(board.current.fen(),{depth:12,timeMs:450});
      if(token!==generation.current||statusRef.current!=='playing')return;
      chargeClock();
      if(remaining.current[1]<=0){void end('win','timeout');return;}
      if(!choice?.bestUci)throw Error('Engine returned no playable move.');
      const move=choice.bestUci;
      board.current.move({from:move.slice(0,2),to:move.slice(2,4),promotion:move[4]});
      startedAt.current=Date.now();sync();
      if(board.current.isGameOver())void end(board.current.isCheckmate()?'loss':'draw',board.current.isCheckmate()?'checkmate':'draw');
    }catch(e){
      if(token!==generation.current)return;
      statusRef.current='engine-error';setStatus('engine-error');
      setError('Engine analysis stopped. This incomplete match will not affect your rating estimate. '+String((e as Error).message));
    }finally{if(token===generation.current)setThinking(false);}
  };
  const play=(from:string,to:string,promotion?:string):boolean=>{
    if(statusRef.current!=='playing'||board.current.turn()!=='w'||thinking)return false;
    chargeClock();
    if(remaining.current[0]<=0){void end('loss','timeout');return false;}
    try{
      board.current.move({from,to,promotion});
    }catch{return false;}
    startedAt.current=Date.now();
    sync();
    if(board.current.isGameOver()){
      void end(board.current.isCheckmate()?'win':'draw',board.current.isCheckmate()?'checkmate':'draw');
    }else{void respond(generation.current);}
    return true;
  };
  const resign=()=>{if(statusRef.current==='playing'&&moves.length>=2){chargeClock();void end('loss','resign');}};
  const reset=()=>{
    generation.current++;engine.stop();statusRef.current='setup';setStatus('setup');
    setError(null);setThinking(false);setOutcome(null);setReason(null);
    board.current=new Chess();setFen(board.current.fen());setMoves([]);
    remaining.current=[CLOCK,CLOCK];setClock([CLOCK,CLOCK]);
  };
  if(!summary&&status==='setup')return <div className="p-4 pb-24"><Loading label="Loading your chess goal"/></div>;
  return <div className="p-4 pb-24 space-y-4">
    <Card>
      <p className="text-xs uppercase tracking-wider text-amber-300 mb-2">Your target</p>
      <div className="flex items-end justify-between">
        <div><p className="text-3xl font-semibold">1,200</p><p className="text-xs text-slate-400">Goal rating</p></div>
        <div className="text-right"><p className="text-2xl text-amber-300 font-semibold">{summary?.estimate??'—'}</p><p className="text-xs text-slate-400">Provisional training estimate</p></div>
      </div>
      {summary?.estimate!==null&&summary?.estimate!==undefined&&<p className="text-xs text-slate-400 mt-3">
        Approximate uncertainty ±{summary.margin} · {summary.gamesPlayed} assessed game{summary.gamesPlayed===1?'':'s'}
      </p>}
      <p className="text-xs text-slate-400 mt-2">{summary?.note??'A single game cannot establish an official rating.'}</p>
    </Card>
    {status==='setup'||status==='loading'||status==='engine-error'?<>
      <Card>
        <SectionTitle>Three-minute rating check</SectionTitle>
        <p className="text-sm text-slate-300 mb-4">Play White against a computer. Each side gets 3:00, with no increment. The bot's approximate level adjusts as you improve.</p>
        <p className="text-sm text-slate-400 mb-2">Opponent difficulty (practice level, not certified Elo)</p>
        <div className="grid grid-cols-4 gap-2 mb-4">
          {LEVELS.map(x=><button key={x} disabled={status==='loading'} onClick={()=>setLevel(x)}
            className={'rounded-xl border min-h-[48px] text-sm '+(x===level?'bg-amber-400 text-slate-950 border-amber-400':'text-slate-300 border-slate-700')}>{x}</button>)}
        </div>
        <Btn className="w-full" disabled={status==='loading'} onClick={start}>{status==='loading'?'Starting chess engine…':'Start 3:00 game'}</Btn>
        {status==='engine-error'&&<Btn className="w-full mt-2" variant="ghost" onClick={reset}>Reset</Btn>}
      </Card>
    </>:<>
      <Card>
        <div className="flex justify-between items-center text-sm mb-3">
          <span className="text-slate-300">Black · approx. {level} bot</span>
          <span className={'font-mono font-semibold text-xl tabular-nums '+(clock[1]<30000?'text-red-300':'text-slate-100')}>{stamp(clock[1])}</span>
        </div>
        <div className="flex justify-center"><ChessboardView id="rating-assessment-board"
          fen={fen} onMove={play} allowMoves={status==='playing'&&!thinking} orientation="white"/></div>
        <div className="flex justify-between items-center text-sm mt-3">
          <span className="text-slate-300">You · White</span>
          <span className={'font-mono font-semibold text-xl tabular-nums '+(clock[0]<30000?'text-red-300':'text-slate-100')}>{stamp(clock[0])}</span>
        </div>
        <p className="text-center text-sm text-slate-400 mt-2">{thinking?'Computer thinking…':status==='playing'?'Your move':('Game '+(reason??'finished'))}</p>
        <div className="text-sm text-slate-400 mt-3 max-h-24 overflow-y-auto">Moves: {moves.join(' ')||'—'}</div>
        {status==='playing'&&<Btn variant="danger" disabled={moves.length<2} className="w-full mt-3" onClick={resign}>Resign game</Btn>}
      </Card>
      {status==='finished'&&<Card>
        <SectionTitle>{outcome==='win'?'You won':outcome==='draw'?'Draw':'You lost'}</SectionTitle>
        <p className="text-sm text-slate-300 mb-3">Result: {reason} · Opponent practice level {level}.</p>
        {saving?<Loading label="Recording your practice estimate"/>:<p className="text-sm text-slate-300 mb-3">Updated training estimate: <strong className="text-amber-300">{summary?.estimate??'Unavailable'}</strong>. Keep playing and practicing to improve the estimate.</p>}
        <Btn className="w-full" onClick={reset}>Play another game</Btn>
        <Btn className="w-full mt-2" variant="ghost" onClick={()=>window.location.hash='#/course'}>Continue lessons →</Btn>
      </Card>}
    </>}
    {error&&<p role="alert" className="text-sm text-red-300">{error}</p>}
    {(summary?.recentGames.length??0)>0&&status==='setup'&&<Card>
      <SectionTitle>Recent assessment games</SectionTitle>
      {summary!.recentGames.slice(0,5).map(g=><p key={g.id} className="flex justify-between text-sm text-slate-300 py-1">
        <span>{g.result} vs {g.botLevel} bot</span>
        <span className="text-slate-400">{g.estimate} estimate</span>
      </p>)}
    </Card>}
  </div>;
}
