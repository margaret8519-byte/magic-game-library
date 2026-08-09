(() => {
  'use strict';
  const groups=WORLD_DATA.facts.reduce((result,fact)=>{result[fact.category]??=[];if(!result[fact.category].includes(fact.subtopic))result[fact.category].push(fact.subtopic);return result},{});
  const mechanics=['hotspot','map-select','drag-sort','timeline','matching','classification','drag-to-scene','find-the-mistake','safe-route','situation-choice','cause-effect','sequence','image-mission'];
  const curriculum=Object.entries(groups).flatMap(([category,subtopics])=>subtopics.map(subtopic=>{const facts=WORLD_DATA.facts.filter(item=>item.category===category&&item.subtopic===subtopic);return{category,subtopic,learningObjectives:facts.map(item=>item.id),difficultyRange:[Math.min(...facts.map(item=>item.level)),Math.max(...facts.map(item=>item.level))],mechanics:[...new Set(facts.flatMap(item=>item.mechanics))],targetSkills:['узнавание','объяснение','применение'],entities:facts.map(item=>item.id)}}));
  window.WORLD_GRADE4_CURRICULUM=Object.freeze({groups:Object.freeze(groups),subtopics:Object.freeze(curriculum),mechanics:Object.freeze(mechanics)});
})();
