import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, getLevel, STORAGE_KEY } from '../public/js/config.js';
import { createAttempt, createFreshAttempt, attemptSignature, validateProblem, practiceConfig } from '../public/js/generators.js';
import { binary, evaluateAst, formatAst, inspectAst } from '../public/js/math.js';
import { normalizeAnswer, editAnswer, validateAnswer } from '../public/js/validation.js';
import { createGame, currentTask, submitAnswer, advance, starsForGame } from '../public/js/game-state.js';
import { initialProgress, loadProgress, saveProgress, recordAttempt, recordAnswer, completeLevel, resetProgress } from '../public/js/storage.js';

function memoryStorage(){const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};}
function answerFor(p){return p.kind==='remainder'?{answer:String(p.answer.quotient),remainder:String(p.answer.remainder)}:p.choices?{choice:p.answer}:{answer:String(p.answer)};}
function finishedGame(lives=3){let g=createGame(getLevel(1),createAttempt(1,35),35);g={...g,lives};while(g.phase!=='completed'){g=advance(submitAnswer(g,answerFor(currentTask(g))).state);}return g;}
// An independent expression parser, separate from production AST evaluation.
function parseMath(text){const tokens=text.match(/\d+|[()+×:−]/g);let i=0;
  const atom=()=>{if(tokens[i]==='('){i++;const v=sum();assert.equal(tokens[i++],')');return v;}return Number(tokens[i++]);};
  const product=()=>{let v=atom();while(['×',':'].includes(tokens[i])){const op=tokens[i++],right=atom();v=op==='×'?v*right:v/right;}return v;};
  const sum=()=>{let v=product();while(['+','−'].includes(tokens[i])){const op=tokens[i++],right=product();v=op==='+'?v+right:v-right;}return v;};
  const result=sum();assert.equal(i,tokens.length);return result;
}

test('30 levels, six worlds, 8 tasks / 10-task trials',()=>{
  assert.equal(LEVELS.length,30);assert.equal(new Set(LEVELS.map(l=>l.chapter)).size,6);
  for(const l of LEVELS){assert.equal(l.problemCount,l.id%5===0?10:8);assert.equal(l.lives,3);}
});
for(const level of LEVELS)test(`level ${level.id}: 5000 problems, safe mathematics and unique rounds`,()=>{
  let count=0;const modes=new Set();
  for(let seed=0;count<5000;seed++){
    const tasks=createAttempt(level,seed);assert.equal(new Set(tasks.map(p=>p.signature)).size,tasks.length);
    for(const p of tasks){count++;assert.equal(validateProblem(p),true);modes.add(p.metadata.generatorKind);
      if(p.ast){const x=p.kind==='missingNumber'?p.answer:undefined;
        for(const {node,value} of inspectAst(p.ast,x)){
          assert.ok(Number.isSafeInteger(value)&&value>=0&&value<=1000);
          if(node.operator==='divide'){
            const divisor=evaluateAst(node.right,x),dividend=evaluateAst(node.left,x);assert.ok(divisor>0);assert.equal(dividend%divisor,0);
            // The explicitly requested ÷10 / ÷100 cases are the sole large-divisor exception.
            if(p.skill!=='special')assert.ok(divisor<=9);
          }
        }
        const display=formatAst(p.ast),result=parseMath(display.replaceAll('?',String(x)));
        assert.equal(result,p.kind==='missingNumber'?p.metadata.right:p.answer);
        assert.ok(p.prompt.includes(display));
      }
      if(p.kind==='remainder'){const m=p.metadata;assert.ok(p.answer.remainder>0&&p.answer.remainder<m.divisor);assert.equal(m.dividend,m.divisor*p.answer.quotient+p.answer.remainder);assert.ok(m.dividend<=100);}
      if(p.skill==='outside')assert.ok(p.metadata.dividend<=100&&p.metadata.quotient>9);
      if(p.skill==='bigDivision')assert.ok(p.metadata.dividend>=100&&p.metadata.dividend<=999);
      if(p.skill==='remainderProperty'&&p.choices){const valid=p.choices.filter(c=>p.metadata.property==='possible'?Number(c.value)<p.metadata.divisor:Number(c.value)>=p.metadata.divisor);assert.equal(valid.length,1);assert.equal(valid[0].value,p.answer);}
      if(p.skill==='trueFalse'){assert.equal(p.answer==='yes',p.metadata.a*p.metadata.c===p.metadata.other);}
      if(p.skill==='missingSign'){
        const {left:a,right:b,result}=p.metadata;
        const possibilities={add:a+b,subtract:a-b,multiply:a*b,divide:a/b};
        assert.deepEqual(Object.keys(possibilities).filter(k=>possibilities[k]===result),[p.answer]);
      }
    }
  }
  for(const mode of level.allowedProblemKinds)assert.ok(modes.has(mode));
});
test('AST refuses invalid intermediate results, even if final result could be valid',()=>{
  assert.throws(()=>evaluateAst(binary('multiply',binary('divide',6,4),2)));
  assert.throws(()=>evaluateAst(binary('add',binary('subtract',5,20),30)));
  assert.throws(()=>evaluateAst(binary('divide',0,0)));
  assert.throws(()=>evaluateAst(binary('add',999,2)));
});
test('displayed precedence and parentheses match mathematics',()=>{
  const ast=binary('subtract',20,binary('subtract',8,3));assert.equal(formatAst(ast),'20 − (8 − 3)');assert.equal(parseMath(formatAst(ast)),15);
  assert.equal(parseMath('40 − 16 : 4 + 7'),43);assert.equal(parseMath('(40 − 16) : 3 + 7'),15);
});
test('fixed seed reproducible; new seeds and replay sets differ',()=>{
  for(const l of LEVELS){const first=createAttempt(l,1234);assert.deepEqual(createAttempt(l,1234),first);assert.notEqual(attemptSignature(createAttempt(l,1235)),attemptSignature(first));
    const fresh=createFreshAttempt(l,1234,attemptSignature(first));assert.notEqual(fresh.seed,1234);assert.notEqual(fresh.signature,attemptSignature(first));}
});
test('boss levels cover all configured preceding skills in every run',()=>{
  for(const l of LEVELS.filter(l=>l.isBoss))for(let seed=0;seed<40;seed++)assert.deepEqual(new Set(createAttempt(l,seed).map(p=>p.metadata.generatorKind)),new Set(l.allowedProblemKinds));
});
test('free practice uses selected table, 8 distinct tasks',()=>{
  for(const mode of ['multiply','divide'])for(let factor=2;factor<=9;factor++){
    const tasks=createAttempt(practiceConfig(mode,factor),79);assert.equal(tasks.length,8);assert.equal(new Set(tasks.map(t=>t.signature)).size,8);
    for(const p of tasks)assert.equal(evaluateAst(mode==='multiply'?p.ast.left:p.ast.right),factor);
  }
});
test('numeric input: 1 → 5 → 3 preserves order; physical + keypad share state',()=>{
  let s='';for(const digit of '153')s=editAnswer(s,{type:'append',digit});assert.equal(s,'153');
  s=editAnswer('',{type:'native',value:'1'});s=editAnswer(s,{type:'append',digit:'5'});assert.equal(s,'15');
  s=editAnswer(s,{type:'backspace'});assert.equal(s,'1');assert.equal(editAnswer(s,{type:'clear'}),'');
  assert.equal(editAnswer('1234',{type:'append',digit:'5'}),'1234');
});
test('invalid / empty input does not become a different valid number',()=>{
  for(const raw of ['','  ','e','abc','42a','4.2','4,2','+4','-3','1e3','12345'])assert.equal(normalizeAnswer(raw).ok,false);
  assert.equal(normalizeAnswer(' 42 ').value,42);assert.equal(normalizeAnswer('0').value,0);
  for(const raw of ['1e','1.5','+1','-1','1,5','1a'])assert.equal(editAnswer('1',{type:'native',value:raw}),'1');
});
test('empty answers and partial remainder answers do not cost hearts',()=>{
  let g=createGame(getLevel(21),createAttempt(21,1),1);const before=g;
  assert.strictEqual(submitAnswer(g,{answer:''}).state,before);
  const half=submitAnswer(g,{answer:String(currentTask(g).answer.quotient),remainder:''});assert.equal(half.invalid,'remainder');assert.strictEqual(half.state,before);
});
test('submission is counted once, incorrect response stays on same task',()=>{
  let g=createGame(getLevel(1),createAttempt(1,1),1);
  const first=currentTask(g).id;g=submitAnswer(g,{answer:'999'}).state;assert.equal(g.lives,2);assert.equal(g.phase,'wrong');
  assert.strictEqual(submitAnswer(g,{answer:'999'}).state,g);assert.equal(currentTask(g).id,first);
  g=advance(g);assert.equal(g.phase,'answer');assert.equal(currentTask(g).id,first);
  g=submitAnswer(g,answerFor(currentTask(g))).state;assert.equal(g.correct,1);assert.strictEqual(submitAnswer(g,{answer:'999'}).state,g);
  g=advance(g);assert.equal(g.index,1);assert.equal(g.phase,'answer');
});
test('third wrong answer fails the level and never awards stars',()=>{
  let g=createGame(getLevel(1),createAttempt(1,1),1);for(let i=0;i<3;i++){g=submitAnswer(g,{answer:'999'}).state;if(i<2)g=advance(g);}
  assert.equal(g.phase,'failed');assert.equal(g.lives,0);assert.equal(starsForGame(g),0);assert.strictEqual(advance(g),g);
});
test('stars depend on remaining hearts only after completing the whole level',()=>{
  for(const n of [1,2,3])assert.equal(starsForGame(finishedGame(n)),n);
  assert.equal(starsForGame(createGame(getLevel(1),createAttempt(1,1),1)),0);
});
test('free practice never loses hearts and is separate from story progress',()=>{
  let g=createGame(practiceConfig('multiply',7),createAttempt(practiceConfig('multiply',7),1),1,true);
  for(let i=0;i<12;i++)g=advance(submitAnswer(g,{answer:'999'}).state);
  assert.equal(g.lives,3);assert.equal(g.phase,'answer');assert.equal(starsForGame(g),0);
});
test('complete → unlock; best stars survive worse replay and reload',()=>{
  const storage=memoryStorage();let p=initialProgress();p=recordAttempt(p,1,1,'signature');p=completeLevel(p,1,2);assert.equal(p.unlockedLevel,2);
  p=recordAttempt(p,1,2,'new');p=completeLevel(p,1,1);assert.equal(p.bestStarsByLevel[1],2);
  p=recordAttempt(p,1,3,'newer');p=completeLevel(p,1,3);assert.equal(p.bestStarsByLevel[1],3);
  assert.equal(saveProgress(p,storage),true);const reloaded=loadProgress(storage);assert.deepEqual(reloaded.bestStarsByLevel,{1:3});assert.equal(reloaded.unlockedLevel,2);
});
test('reset removes all game data, preserves unrelated local/session records',()=>{
  const storage=memoryStorage();storage.setItem('other-game','keep');let p=recordAttempt(initialProgress(),1,42,'old tasks');p=completeLevel(p,1,3);p=recordAnswer(p,'multiply',false);saveProgress(p,storage);
  const {progress,saved}=resetProgress(storage);assert.equal(saved,true);assert.deepEqual(progress,initialProgress());assert.deepEqual(loadProgress(storage),initialProgress());assert.equal(storage.getItem('other-game'),'keep');
  for(const key of ['completedLevels','bestStarsByLevel','skillStats','lastAttemptSeedByLevel','lastAttemptSignatureByLevel','records'])assert.equal(Object.keys(progress[key]).length,0);
});
test('malformed / unknown storage recovers without a crash',()=>{
  const storage=memoryStorage();for(const value of ['{broken','null','42','{"schemaVersion":999}','{"schemaVersion":2,"bestStarsByLevel":{"1":999}}']){storage.setItem(STORAGE_KEY,value);assert.equal(loadProgress(storage).unlockedLevel,1);}
  const blocked={getItem(){throw new Error('blocked')},setItem(){throw new Error('blocked')},removeItem(){throw new Error('blocked')}};
  assert.deepEqual(loadProgress(blocked),initialProgress());assert.equal(saveProgress(initialProgress(),blocked),false);assert.equal(resetProgress(blocked).saved,false);
});
test('structured validator checks both fields and choices',()=>{
  const p=createAttempt(21,1)[0];assert.equal(validateAnswer(p,answerFor(p)).correct,true);assert.equal(validateAnswer(p,{answer:String(p.answer.quotient),remainder:'999'}).correct,false);
  const q=createAttempt(24,1).find(t=>t.choices);assert.equal(validateAnswer(q,{choice:q.answer}).correct,true);assert.equal(validateAnswer(q,{choice:''}).valid,false);
});
