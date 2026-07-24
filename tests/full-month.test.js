const engine = require('../scheduler-engine');

const shifts = {
  '8d': {label:'8h day',start:'08:00',end:'16:00',activeDays:[0,1,2,3,4,5,6],coverage:1,category:'General',period:'day',manager:false},
  '8n': {label:'8h night',start:'16:00',end:'00:00',activeDays:[1,2,3,4,5],coverage:1,category:'General',period:'night',manager:false},
  '12d': {label:'12h day',start:'08:00',end:'20:00',activeDays:[0,1,2,3,4,5,6],coverage:1,category:'General',period:'day',manager:false},
  '12n': {label:'12h night',start:'20:00',end:'08:00',activeDays:[0,1,2,3,4,5,6],coverage:1,category:'General',period:'night',manager:false},
  manager: {label:'Manager',start:'08:00',end:'16:00',activeDays:[1,2,3,4,5],coverage:1,category:'Manager',period:'day',manager:true}
};
const workers = Array.from({length:10},(_,index)=>({id:'w'+index,name:'Worker '+index,target:index<8?160:144,preference:index%3===0?'day':index%3===1?'night':'either',pair24:index===0?'pair8':index===3?'pair20':'none',categories:['General'],managerQualified:index===1||index===4,defaultManager:index===1}));
const config={current:'2026-07',settings:{recoveryDays:2},minimumRestHours:8,shifts,pairings:[{id:'pair8',name:'08→08',firstShiftId:'12d',secondShiftId:'12n',dayOffset:0,enabled:true},{id:'pair20',name:'20→20',firstShiftId:'12n',secondShiftId:'12d',dayOffset:1,enabled:true}],workers,availability:[],assignments:{},locks:{},randomRanks:Object.fromEntries(workers.map((worker,index)=>[worker.id,index/10]))};
(async()=>{const highs=await require('highs')(),start=Date.now(),result=engine.solve(config,engine.highsAdapter(highs)),elapsed=Date.now()-start;if(!result.feasible)throw new Error(result.error);console.log(JSON.stringify({elapsed,assignments:Object.keys(result.assignments).length,unfilled:result.unfilled.length,variables:result.diagnostics.modelVariables,constraints:result.diagnostics.modelConstraints,objective:result.objective}));})();
