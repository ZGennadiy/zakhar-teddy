import { STORAGE_KEY } from './config.js';
const integer = (n, low, high) => Number.isInteger(n) && n >= low && n <= high;
export function initialProgress() {
  return { schemaVersion:2, unlockedLevel:1, completedLevels:[], bestStarsByLevel:{}, skillStats:{},
    lastAttemptSeedByLevel:{}, lastAttemptSignatureByLevel:{}, records:{}, currentLevel:1,
    settings:{animations:true,sound:false} };
}
export function normalizeProgress(data) {
  const p = initialProgress();
  if (!data || data.schemaVersion !== 2) return p;
  for (let id=1;id<=30;id++) {
    if (integer(data.bestStarsByLevel?.[id],1,3)) p.bestStarsByLevel[id]=data.bestStarsByLevel[id];
    if (integer(data.lastAttemptSeedByLevel?.[id],0,4294967295)) p.lastAttemptSeedByLevel[id]=data.lastAttemptSeedByLevel[id];
    if (typeof data.lastAttemptSignatureByLevel?.[id] === 'string' && data.lastAttemptSignatureByLevel[id].length < 12000) p.lastAttemptSignatureByLevel[id]=data.lastAttemptSignatureByLevel[id];
    const r = data.records?.[id];
    if(r && integer(r.attempts,0,1000000) && integer(r.completions,0,r.attempts)) p.records[id]={attempts:r.attempts,completions:r.completions};
  }
  p.completedLevels=Object.keys(p.bestStarsByLevel).map(Number);
  while(p.unlockedLevel<30 && p.bestStarsByLevel[p.unlockedLevel]) p.unlockedLevel++;
  p.currentLevel=integer(data.currentLevel,1,p.unlockedLevel)?data.currentLevel:p.unlockedLevel;
  for(const [skill,s] of Object.entries(data.skillStats ?? {})) {
    if(/^[a-zA-Z]+$/.test(skill) && integer(s?.correct,0,10000000) && integer(s?.wrong,0,10000000)) p.skillStats[skill]={correct:s.correct,wrong:s.wrong};
  }
  for(const key of ['animations','sound']) if(typeof data.settings?.[key] === 'boolean') p.settings[key]=data.settings[key];
  return p;
}
function browserStorage() { try { return globalThis.localStorage; } catch { return null; } }
export function loadProgress(storage = browserStorage()) {
  try { return normalizeProgress(JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null')); } catch { return initialProgress(); }
}
export function saveProgress(progress, storage = browserStorage()) {
  try { if(!storage) return false; storage.setItem(STORAGE_KEY,JSON.stringify(progress)); return true; } catch { return false; }
}
export function recordAttempt(progress, level, seed, signature) {
  const p=structuredClone(progress), r=p.records[level]??{attempts:0,completions:0};
  p.currentLevel=level; p.lastAttemptSeedByLevel[level]=seed; p.lastAttemptSignatureByLevel[level]=signature;
  p.records[level]={...r,attempts:r.attempts+1}; return p;
}
export function recordAnswer(progress, skill, correct) {
  const p=structuredClone(progress), s=p.skillStats[skill]??{correct:0,wrong:0};
  p.skillStats[skill]={correct:s.correct+(correct?1:0),wrong:s.wrong+(correct?0:1)}; return p;
}
export function completeLevel(progress, level, stars) {
  if(!integer(stars,1,3) || !integer(level,1,progress.unlockedLevel)) return progress;
  const p=structuredClone(progress);
  p.bestStarsByLevel[level]=Math.max(stars,p.bestStarsByLevel[level]??0);
  p.completedLevels=[...new Set([...p.completedLevels,level])].sort((a,b)=>a-b);
  p.unlockedLevel=Math.min(30,Math.max(p.unlockedLevel,level+1)); p.currentLevel=p.unlockedLevel;
  const r=p.records[level]??{attempts:1,completions:0};p.records[level]={...r,completions:r.completions+1}; return p;
}
export function resetProgress(storage = browserStorage()) {
  const progress=initialProgress(); let saved=false;
  try { if(storage) { storage.removeItem(STORAGE_KEY); saved=saveProgress(progress,storage); } } catch { /* Current in-memory game still resets. */ }
  return {progress,saved};
}
export const totalStars = p => Object.values(p.bestStarsByLevel).reduce((sum,n)=>sum+n,0);
