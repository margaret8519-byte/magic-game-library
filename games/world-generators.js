(() => {
  'use strict';
  const WORLD_CONTENT_VERSION=4;
  const read=(key,fallback)=>{try{const raw=localStorage.getItem(key);return raw===null?fallback:JSON.parse(raw)}catch(_){return fallback}};
  const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch(_){}};
  const hash=value=>{let result=2166136261;for(const char of String(value)){result^=char.charCodeAt(0);result=Math.imul(result,16777619)}return(result>>>0).toString(36)};
  const unique=values=>[...new Set(values)];
  const imageRequiredMechanics=new Set(['image-mission','hotspot','map-select','find-the-mistake']);
  const setFrom=(key,fallback=[])=>new Set(read(key,fallback));
  function normalizeWorldQuestion(text){return String(text||'').toLocaleLowerCase('ru-RU').replace(/\b(российская федерация|рф)\b/g,'россия').replace(/[.,!?;:«»“”„()—–-]/g,' ').replace(/\s+/g,' ').trim()}
  function shuffle(values){const result=[...values];for(let index=result.length-1;index>0;index-=1){const target=Math.floor(Math.random()*(index+1));[result[index],result[target]]=[result[target],result[index]]}return result}
  function payloadFor(task){const ordered=task.answer.includes('→')?task.answer.split('→').map(item=>item.trim()):[];if(['drag-sort','timeline','sequence'].includes(task.mechanic)&&ordered.length>1)return{mode:'order',items:shuffle(ordered),correctOrder:ordered};if(['classification','drag-to-scene'].includes(task.mechanic))return{mode:'classify',item:task.answer,buckets:['Подходит','Не подходит'],correctBucket:'Подходит'};if(['matching','cause-effect'].includes(task.mechanic))return{mode:'match',options:shuffle(task.answers),correct:task.answer};return{mode:'choice',options:shuffle(task.answers),correct:task.answer}}
  function taskFromFact(fact){
    const mechanic=fact.mechanics[0],conceptKey=`${fact.category}.${fact.subtopic}.${fact.id}`,taskKey=`${conceptKey}.001`,answers=[fact.correct,...fact.wrong];
    const task={id:`world-${fact.id}`,taskKey,conceptKey,category:fact.category,subtopic:fact.subtopic,levelGroup:fact.level,learningObjective:`Проверить знание: ${fact.subtopic.replaceAll('_',' ')}`,requiredAction:mechanic,mechanic,difficulty:fact.level,entityId:fact.id,mainEntityId:fact.id,additionalEntityIds:[],templateId:'curated',templateFamily:'curated',relationType:fact.subtopic,question:fact.prompt,instruction:['drag-sort','timeline','sequence'].includes(mechanic)?'Расположи элементы в правильном порядке.':['matching','cause-effect'].includes(mechanic)?'Найди верное соответствие.':['classification','drag-to-scene'].includes(mechanic)?'Выбери подходящую группу.':'Выбери правильный ответ.',answer:fact.correct,correct:fact.correct,answers,explanation:fact.explanation,image:fact.image?`../assets/world-missions/${fact.image}`:null,imageAlt:fact.imageAlt||'',imageId:fact.image||null};
    task.payload=payloadFor(task);task.questionHash=hash(`${normalizeWorldQuestion(task.question)}|${normalizeWorldQuestion(task.answer)}`);task.conceptFingerprint=hash(conceptKey);task.signature=[taskKey,task.answer,...task.answers.filter(item=>item!==task.answer).sort()].join('|');return Object.freeze(task)
  }
  let cachedDeck;
  function buildWorldCurriculumDeck(){if(cachedDeck)return cachedDeck;cachedDeck=Object.freeze(WORLD_DATA.facts.map(taskFromFact));return cachedDeck}
  function loadWorldSeenTaskKeys(){const stored=read('worldSeenTaskKeys',null);if(Array.isArray(stored))return new Set(stored);const legacy=setFrom('worldUsedTaskKeys');write('worldSeenTaskKeys',[...legacy]);return legacy}
  const loadSeenConceptKeys=()=>setFrom('worldSeenConceptKeys');
  const loadSeenQuestions=()=>setFrom('worldSeenNormalizedQuestions');
  const loadSeenQuestionHashes=()=>{const stored=read('worldSeenQuestionHashes',null);const hashes=new Set(Array.isArray(stored)?stored:read('worldRecentQuestionHashes',[]));if(!Array.isArray(stored))write('worldSeenQuestionHashes',[...hashes]);return hashes};
  function loadPersistentWorldHistory(){return{worldSeenTaskKeys:loadWorldSeenTaskKeys(),worldSeenConceptKeys:loadSeenConceptKeys(),worldSeenQuestionHashes:loadSeenQuestionHashes(),worldSeenNormalizedQuestions:loadSeenQuestions()}}
  function seenBy(mission,history=loadPersistentWorldHistory()){const normalized=normalizeWorldQuestion(mission?.question);return history.worldSeenTaskKeys.has(mission?.taskKey)||history.worldSeenConceptKeys.has(mission?.conceptKey)||history.worldSeenQuestionHashes.has(mission?.questionHash)||history.worldSeenNormalizedQuestions.has(normalized)}
  function getUnseenWorldTasks(){const history=loadPersistentWorldHistory();return buildWorldCurriculumDeck().filter(task=>!seenBy(task,history))}
  function updateDeckProgress(){const deck=buildWorldCurriculumDeck(),history=loadPersistentWorldHistory(),remaining=getUnseenWorldTasks().length,progress={totalTasks:deck.length,seenTasks:history.worldSeenTaskKeys.size,remainingTasks:remaining,cycle:Number(localStorage.getItem('worldTaskCycle'))||1,completed:remaining===0};write('worldCurriculumDeckProgress',progress);if(remaining===0)localStorage.setItem('worldCurriculumCycleCompleted','true');return progress}
  function beginNextCycle(){
    ['worldSeenTaskKeys','worldUsedTaskKeys','worldSeenConceptKeys','worldSeenQuestionHashes','worldSeenNormalizedQuestions','worldRecentMissionSignatures','worldRecentQuestionHashes','worldRecentConceptFingerprints','worldAllocatedTaskKeys','worldLastAdventureTaskKeys','worldCurrentAdventurePlan','worldLevelProgress','worldLevelRunStats'].forEach(key=>localStorage.removeItem(key));
    localStorage.setItem('worldTaskCycle',String((Number(localStorage.getItem('worldTaskCycle'))||1)+1));localStorage.setItem('worldCurriculumCycleCompleted','false');updateDeckProgress()
  }
  function chooseLevelTasks(unseen,level,excluded,allocated){
    const eligible=unseen.filter(task=>task.levelGroup===level&&!excluded.has(task.taskKey));
    const fresh=shuffle(eligible.filter(task=>!allocated.has(task.taskKey))),reusable=shuffle(eligible.filter(task=>allocated.has(task.taskKey))),ordered=[...fresh,...reusable],chosen=[],topics=new Set(),mechanics=new Set();
    while(chosen.length<10&&ordered.length){let bestIndex=0,bestScore=-1;ordered.forEach((task,index)=>{const score=(topics.has(task.subtopic)?0:2)+(mechanics.has(task.mechanic)?0:1);if(score>bestScore){bestScore=score;bestIndex=index}});const [task]=ordered.splice(bestIndex,1);chosen.push(task);topics.add(task.subtopic);mechanics.add(task.mechanic)}
    return chosen
  }
  function buildAdventurePlan(){
    const allUnseen=getUnseenWorldTasks();if(allUnseen.length===0){const error=new Error('Все уникальные задания курса пройдены');error.code='WORLD_CURRICULUM_COMPLETE';throw error}const missingImages=allUnseen.filter(task=>imageRequiredMechanics.has(task.mechanic)&&!task.image);missingImages.forEach(task=>console.error(`IMAGE REQUIRED FOR MISSION: ${task.taskKey}`));const unseen=allUnseen.filter(task=>!imageRequiredMechanics.has(task.mechanic)||Boolean(task.image));
    const excluded=setFrom('worldLastAdventureTaskKeys'),allocated=setFrom('worldAllocatedTaskKeys'),levels={};
    for(let level=1;level<=4;level+=1){levels[level]=chooseLevelTasks(unseen,level,excluded,allocated);if(levels[level].length!==10){const error=new Error(`Недостаточно непройденных заданий для экспедиции ${level}: ${levels[level].length}/10`);error.code='WORLD_INCOMPLETE_LEVEL_BANK';throw error}}
    const all=Object.values(levels).flat(),keys=all.map(task=>task.taskKey),hashes=all.map(task=>task.questionHash),normalized=all.map(task=>normalizeWorldQuestion(task.question));
    if(new Set(keys).size!==all.length||new Set(hashes).size!==all.length||new Set(normalized).size!==all.length){console.error('WORLD DUPLICATE TASK SELECTED',{keys,hashes});throw new Error('В одно приключение попали повторяющиеся задания')}
    write('worldLastAdventureTaskKeys',keys);write('worldAllocatedTaskKeys',unique([...allocated,...keys]));
    const fingerprint=hash(keys.join('|')),plan={levels,fingerprint,cycle:Number(localStorage.getItem('worldTaskCycle'))||1,contentVersion:WORLD_CONTENT_VERSION,createdAt:Date.now()};write('worldAdventureFingerprints',unique([...read('worldAdventureFingerprints',[]),fingerprint]).slice(-100));return plan
  }
  function validateMission(mission){return Boolean(mission?.taskKey&&mission?.conceptKey&&mission?.questionHash&&mission?.question&&mission?.answer&&mission?.explanation&&(!imageRequiredMechanics.has(mission.mechanic)||mission.image)&&buildWorldCurriculumDeck().some(task=>task.taskKey===mission.taskKey)&&WORLD_GRADE4_CURRICULUM.mechanics.includes(mission.mechanic))}
  function validateAdventurePlan(plan){const all=Object.values(plan?.levels||{}).flat();return plan?.contentVersion===WORLD_CONTENT_VERSION&&all.length===40&&[1,2,3,4].every(level=>plan.levels[level]?.length===10)&&new Set(all.map(task=>task.taskKey)).size===40&&new Set(all.map(task=>task.questionHash)).size===40&&all.every(validateMission)}
  function recordMissionShown(mission){
    const history=loadPersistentWorldHistory(),normalized=normalizeWorldQuestion(mission.question);if(seenBy(mission,history)){console.error('[WORLD DUPLICATE BLOCKED]',mission.taskKey);return false}
    history.worldSeenTaskKeys.add(mission.taskKey);history.worldSeenConceptKeys.add(mission.conceptKey);history.worldSeenQuestionHashes.add(mission.questionHash);history.worldSeenNormalizedQuestions.add(normalized);
    write('worldSeenTaskKeys',[...history.worldSeenTaskKeys]);write('worldUsedTaskKeys',[...history.worldSeenTaskKeys]);write('worldSeenConceptKeys',[...history.worldSeenConceptKeys]);write('worldSeenQuestionHashes',[...history.worldSeenQuestionHashes]);write('worldSeenNormalizedQuestions',[...history.worldSeenNormalizedQuestions]);write('worldRecentMissionSignatures',unique([...read('worldRecentMissionSignatures',[]),mission.signature]).slice(-1000));write('worldRecentQuestionHashes',unique([...read('worldRecentQuestionHashes',[]),mission.questionHash]).slice(-1000));write('worldRecentConceptFingerprints',unique([...read('worldRecentConceptFingerprints',[]),mission.conceptFingerprint]).slice(-1000));updateDeckProgress();return true
  }
  function wasMissionSeen(mission){return mission?seenBy(mission):false}
  function getCoverage(){return read('worldCurriculumCoverage',{})}
  function recordResult(mission,correct){const coverage=getCoverage(),entry=coverage[mission.subtopic]||{seen:0,correct:0,incorrect:0,lastSeenAt:0};entry.seen+=1;entry[correct?'correct':'incorrect']+=1;entry.lastSeenAt=Date.now();coverage[mission.subtopic]=entry;write('worldCurriculumCoverage',coverage)}
  function findSubtopicsWithoutTasks(){const covered=new Set(buildWorldCurriculumDeck().map(task=>task.subtopic));return WORLD_GRADE4_CURRICULUM.subtopics.map(item=>item.subtopic).filter(topic=>!covered.has(topic))}
  function getDebugStats(){
    const deck=buildWorldCurriculumDeck(),history=loadPersistentWorldHistory(),plan=read('worldCurrentAdventurePlan',null),current=Object.values(plan?.levels||{}).flat(),taskKeys=deck.map(task=>task.taskKey),hashes=deck.map(task=>task.questionHash),questions=deck.map(task=>normalizeWorldQuestion(task.question)),duplicates=[];
    const collect=(values,label)=>{const seen=new Set();values.forEach(value=>{if(seen.has(value))duplicates.push(`${label}: ${value}`);seen.add(value)})};collect(taskKeys,'taskKey');collect(hashes,'questionHash');collect(current.map(task=>task.taskKey),'currentAdventure taskKey');collect(current.map(task=>task.questionHash),'currentAdventure questionHash');
    if(deck.length!==WORLD_DATA.facts.length)duplicates.push(`deck содержит ${deck.length} из ${WORLD_DATA.facts.length} facts`);duplicates.forEach(item=>console.error('[WORLD QA DUPLICATE]',item));
    const stats={totalTasks:deck.length,seenTasks:history.worldSeenTaskKeys.size,remainingTasks:getUnseenWorldTasks().length,uniqueQuestions:new Set(questions).size,uniqueConcepts:new Set(deck.map(task=>task.conceptKey)).size,currentAdventureTasks:current.length,duplicatesDetected:duplicates.length};console.table(stats);return{...stats,duplicates}
  }
  function testWorldContent(){const stats=getDebugStats(),counts={};buildWorldCurriculumDeck().forEach(task=>counts[task.subtopic]=(counts[task.subtopic]||0)+1);return{...stats,uniqueSubtopics:Object.keys(counts).length,subtopicsWithoutTasks:findSubtopicsWithoutTasks(),tasksPerSubtopic:counts}}
  const unavailable=()=>{throw new Error('Random-first generators удалены; используйте curated curriculum deck')};
  window.WorldMissionEngine={WORLD_CONTENT_VERSION,buildWorldCurriculumDeck,getUnseenWorldTasks,buildAdventurePlan,beginNextCycle,validateMission,validateAdventurePlan,normalizeWorldQuestion,loadWorldSeenTaskKeys,loadPersistentWorldHistory,recordMissionShown,wasMissionSeen,recordResult,getCoverage,updateDeckProgress,getDebugStats,findSubtopicsWithoutTasks,testWorldContent,testWorldCurriculumDeck:testWorldContent,testWorldReplayDiversity:testWorldContent,testWorldMissionGeneration:testWorldContent,generateMapMission:unavailable,generateTimelineMission:unavailable,generateMatchingMission:unavailable,generateClassificationMission:unavailable,generateNatureZoneMission:unavailable,generateSafeRouteMission:unavailable,generateFindMistakeMission:unavailable,generateCauseEffectMission:unavailable,generateImageMission:unavailable,generateSituationMission:unavailable};
})();
