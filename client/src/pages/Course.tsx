/** Goal-driven, prerequisite-aware chess lessons with one guided example and
 * a four-question adaptive mastery check per concept. */
import { useEffect, useState } from 'react';
import { Chess } from 'chess.js';
import type { Exercise, JourneyOverview, JourneyRound, Lesson } from '@chesstutor/shared';
import { api, type LessonDetail, ChessApiError } from '../api';
import { ChessboardView } from '../components/Chessboard';
import { ExerciseRunner, type AttemptResult } from '../components/ExerciseRunner';
import { Btn, Card, ErrorBox, Loading, Markdown, SectionTitle } from '../components/ui';
import { uciParts } from '../chess/useChessGame';

type Stage = 'read' | 'demo' | 'practice' | 'result';
function demoFen(ex:Exercise):string {
  if(ex.kind==='yes-no')return ex.fen;
  try {
    const game=new Chess(ex.fen), u=uciParts(ex.solutionUci[0]);
    game.move(u);
    return game.fen();
  } catch { return ex.fen; }
}
function demoMove(ex:Exercise):string {
  if(ex.kind==='yes-no')return 'Answer: '+(ex.solutionUci[0]==='yes'?'Yes':'No');
  try {
    const g=new Chess(ex.fen);
    return g.move(uciParts(ex.solutionUci[0])).san;
  } catch {return 'Review the explanation';}
}
export function Course({conceptId,onOpen}:{
  conceptId?:string;onOpen:(concept?:string)=>void
}) {
  const [overview,setOverview]=useState<JourneyOverview|null>(null);
  const [detail,setDetail]=useState<LessonDetail|null>(null);
  const [round,setRound]=useState<JourneyRound|null>(null);
  const [stage,setStage]=useState<Stage>('read');
  const [demoShown,setDemoShown]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const [viewedAnswer,setViewedAnswer]=useState(false);
  const [lessonIndex,setLessonIndex]=useState(0);
  useEffect(()=>{
    let canceled=false;
    setOverview(null);setDetail(null);setRound(null);setError(null);
    setStage('read');setDemoShown(false);setViewedAnswer(false);setLessonIndex(0);
    api.journey().then(v=>{if(!canceled)setOverview(v);})
      .catch(e=>{if(!canceled)setError(e instanceof ChessApiError?e.message:'Could not load your course.');});
    if(conceptId){
      Promise.all([api.getLesson('lesson-'+conceptId),api.journeyRound(conceptId)])
        .then(([d,r])=>{
          if(canceled)return;
          setDetail(d);setRound(r);
          if(r?.status==='active'){setLessonIndex(r.answers.length);setStage('practice');}
          else if(r?.status==='passed'||r?.status==='retry')setStage('result');
        }).catch(e=>{if(!canceled)setError(e instanceof ChessApiError?e.message:'Could not load this lesson.');});
    }
    return()=>{canceled=true};
  },[conceptId]);

  const start=async()=>{
    if(!conceptId)return;
    setBusy(true);setError(null);
    try{
      const r=await api.startJourneyRound(conceptId);
      setRound(r);setStage('practice');setLessonIndex(r.answers.length);setViewedAnswer(false);
    }catch(e){setError(e instanceof ChessApiError?e.message:'Could not start practice.');}
    finally{setBusy(false);}
  };
  const submit=async(ex:Exercise,result:AttemptResult)=>{
    if(!conceptId||!round)return;
    setBusy(true);setError(null);
    try{
      const next=await api.answerJourney(conceptId,round.id,ex.id,result.playedUci,result.hintsUsed,result.outcome==='shown');
      setRound(next);setViewedAnswer(true);
      if(next.status!=='active'){
        const ov=await api.journey();
        setOverview(ov);
      }
    }catch(e){
      setError(e instanceof ChessApiError?e.message:'Could not save your move. Reload to retry.');
    }finally{setBusy(false);}
  };
  if(error&&!overview)return <div className="p-4"><ErrorBox message={error}/></div>;
  if(!overview)return <div className="p-4"><Loading label="Loading your 1,200 rating path"/></div>;
  const done=overview.lessons.filter(x=>x.status==='completed').length;
  if(!conceptId){
    return <div className="p-4 pb-24 space-y-4">
      <Card>
        <p className="text-xs font-semibold text-amber-300 uppercase tracking-wide">Your learning path</p>
        <h1 className="text-2xl font-semibold mt-2 mb-2">Road to 1,200</h1>
        <p className="text-sm text-slate-300 mb-3">Learn a concept, follow an interactive demonstration, then solve four positions. Your answers determine whether you repeat, review or advance.</p>
        <div className="flex justify-between text-sm text-slate-300 mb-2"><span>{done} of {overview.totalCount} lessons mastered</span><span>{Math.round(100*done/overview.totalCount)}%</span></div>
        <div className="bg-slate-800 rounded-full h-2 overflow-hidden"><div className="bg-amber-400 h-2" style={{width:(100*done/overview.totalCount)+'%'}}/></div>
        {overview.recommendedConceptId&&<Btn className="w-full mt-4" onClick={()=>onOpen(overview.recommendedConceptId!)}>Continue recommended lesson</Btn>}
      </Card>
      <SectionTitle>Lessons and tutorials</SectionTitle>
      <div className="space-y-2">
        {overview.lessons.map((l,i)=>{
          const locked=l.status==='locked';
          return <button key={l.conceptId} disabled={locked} onClick={()=>onOpen(l.conceptId)}
            className={'w-full text-left rounded-xl border p-4 flex items-center gap-3 min-h-[76px] '+(locked?'opacity-50 border-slate-800 bg-slate-900':'border-slate-700 bg-slate-900 hover:border-amber-400')}>
            <span className={'rounded-full w-9 h-9 shrink-0 flex items-center justify-center font-semibold '+(l.status==='completed'?'bg-emerald-950 text-emerald-300':locked?'bg-slate-800 text-slate-500':'bg-amber-400 text-slate-950')}>{l.status==='completed'?'✓':i+1}</span>
            <span className="flex-1"><span className="block text-slate-100 font-medium">{l.title}</span>
              <span className="text-xs text-slate-400">{l.status==='completed'?'Mastered — review any time':locked?'Complete prerequisite lessons':l.status==='active'?'Practice in progress':l.bestScore>0?'Review and retry':'Ready to learn'}</span>
            </span>
            {!locked&&<span className="text-amber-300 text-xs">{l.conceptId===overview.recommendedConceptId?'Next →':'Open →'}</span>}
          </button>
        })}
      </div>
    </div>;
  }
  const item=overview.lessons.find(x=>x.conceptId===conceptId);
  if(!item)return <div className="p-4"><Card>Unknown lesson.</Card></div>;
  if(item.status==='locked')return <div className="p-4 pb-24 space-y-3"><Btn variant="ghost" onClick={()=>onOpen()}>← Learning path</Btn><Card>Complete prerequisite lessons before opening this topic.</Card></div>;
  if(!detail)return <div className="p-4"><Loading label="Loading lesson and tutorial"/></div>;
  const {lesson,exercises}=detail;
  const current=exercises[Math.min(lessonIndex,exercises.length-1)];
  const demo=exercises[0];
  const next=()=>{
    if(round?.status!=='active'){setStage('result');return;}
    setLessonIndex(x=>Math.min(exercises.length,x+1));setViewedAnswer(false);
  };
  return <div className="p-4 pb-24 space-y-4">
    <Btn variant="ghost" onClick={()=>onOpen()}>← Learning path</Btn>
    <div className="flex justify-between items-center text-xs text-slate-400">
      <span>Lesson {overview.lessons.findIndex(x=>x.conceptId===conceptId)+1} of {overview.totalCount}</span>
      <span>{stage==='read'?'1 · Learn':stage==='demo'?'2 · Guided tutorial':stage==='practice'?'3 · Practice':'4 · Progress'}</span>
    </div>
    <Card><p className="text-xs uppercase tracking-wider text-amber-300 mb-1">{lesson.level===1?'Foundations':'Advanced skill'}</p>
      <h1 className="text-xl font-semibold mb-1">{lesson.title}</h1>
      <p className="text-sm text-slate-400">{lesson.objective}</p>
    </Card>
    {stage==='read'&&<>
      <Card><SectionTitle>Understand the principle</SectionTitle><Markdown text={lesson.contentMd}/></Card>
      <Btn className="w-full" onClick={()=>setStage('demo')}>Next: Guided tutorial →</Btn>
    </>}
    {stage==='demo'&&<>
      <Card><SectionTitle>Watch it on the board</SectionTitle>
        <p className="text-sm text-slate-300 mb-3">{demo.prompt}</p>
        <div className="flex justify-center mb-4"><ChessboardView id={'guided-'+demo.id} fen={demoShown?demoFen(demo):demo.fen} allowMoves={false}
          arrows={!demoShown&&demo.kind!=='yes-no'?[{from:demo.solutionUci[0].slice(0,2),to:demo.solutionUci[0].slice(2,4)}]:[]}/></div>
        {!demoShown?<Btn className="w-full" onClick={()=>setDemoShown(true)}>Show the move and explanation</Btn>:<>
          <p className="font-semibold text-emerald-300 mb-2">{demoMove(demo)}</p>
          <p className="text-sm text-slate-300 leading-relaxed">{demo.explanation}</p>
          <p className="text-sm text-slate-400 mt-2">Tip: {demo.hints[0]}</p>
        </>}
      </Card>
      <Btn className="w-full" disabled={!demoShown||busy} onClick={start}>Start four-position practice →</Btn>
    </>}
    {stage==='practice'&&round&&<>
      <Card>
        <SectionTitle>Demonstrate the skill</SectionTitle>
        <p className="text-sm text-slate-300 mb-2">{round.feedback}</p>
        <p className="text-sm text-amber-300">{round.correctCount} correct · {round.independentCount} without hints · {round.answers.length}/{round.total} answered</p>
        <div className="bg-slate-800 rounded-full h-2 mt-2"><div className="bg-amber-400 rounded-full h-2" style={{width:Math.round(round.answers.length/round.total*100)+'%'}}/></div>
      </Card>
      {round.status!=='active'?<Btn className="w-full" onClick={()=>setStage('result')}>See results →</Btn>:current&&
        <div>
          <p className="text-sm text-slate-400 mb-2">Practice {Math.min(lessonIndex+1,round.total)} of {round.total}</p>
          <ExerciseRunner key={round.id+'-'+current.id} exercise={current} onDone={r=>submit(current,r)}/>
          {error&&<p className="text-sm text-red-300 mt-2">{error}</p>}
          {viewedAnswer&&<Btn className="w-full mt-3" disabled={busy} onClick={next}>Next position →</Btn>}
        </div>}
    </>}
    {stage==='result'&&round&&<Card>
      <SectionTitle>{round.passed?'Lesson mastered':'Practice review'}</SectionTitle>
      <p className="text-slate-300 mb-3">{round.feedback}</p>
      <p className="text-2xl text-amber-300 font-semibold mb-2">{round.correctCount}/{round.total} correct</p>
      <p className="text-sm text-slate-400 mb-4">{round.independentCount} solved without hints · Need at least 3 correct and 2 independent to pass.</p>
      {round.passed?<>
        <Btn className="w-full" onClick={()=>onOpen(overview.recommendedConceptId&&overview.recommendedConceptId!==conceptId?overview.recommendedConceptId:undefined)}>Continue learning →</Btn>
        <Btn className="w-full mt-2" variant="ghost" onClick={()=>onOpen()}>All lessons</Btn>
      </>:<>
        <Btn className="w-full" onClick={()=>{setStage('demo');setDemoShown(false);setViewedAnswer(false);setLessonIndex(0);}}>Review tutorial and retry</Btn>
        <Btn variant="ghost" className="w-full mt-2" onClick={()=>onOpen()}>Learning path</Btn>
      </>}
    </Card>}
    {error&&stage!=='practice'&&<p className="text-red-300 text-sm">{error}</p>}
  </div>;
}
