process.env.TZ = 'Europe/Warsaw';
const assert = require('assert');
const solver = require('javascript-lp-solver');
const engine = require('../scheduler-engine');

function baseConfig() {
  return {
    current: '2026-02',
    settings: { recoveryDays: 2 },
    minimumRestHours: 8,
    shifts: {
      day: { label: 'Day', start: '08:00', end: '20:00', activeDays: [1], coverage: 1, category: 'General', period: 'day', manager: false },
      night: { label: 'Night', start: '20:00', end: '08:00', activeDays: [1], coverage: 1, category: 'General', period: 'night', manager: false }
    },
    pairings: [{ id: 'p', name: '08 → 08', firstShiftId: 'day', secondShiftId: 'night', dayOffset: 0, enabled: true }],
    workers: [
      { id: 'a', name: 'A', target: 24, preference: 'day', pair24: 'p', categories: ['General'], managerQualified: false, defaultManager: false },
      { id: 'b', name: 'B', target: 24, preference: 'night', pair24: 'none', categories: ['General'], managerQualified: false, defaultManager: false }
    ],
    availability: [], assignments: {}, locks: {}, randomRanks: { a: 0.1, b: 0.2 }
  };
}

const continuity = engine.pairingContinuity(baseConfig().pairings[0], baseConfig().shifts);
assert.equal(continuity.valid, true, 'continuous 24h pair should validate');
assert.equal(engine.pairingContinuity({firstShiftId:'early',secondShiftId:'late',dayOffset:0},{early:{start:'06:00',end:'18:00'},late:{start:'18:00',end:'06:00'}}).valid,true,'custom continuous 24h patterns validate independently of fixed start times');
assert.equal(engine.intervalFor('2026-10-25',{start:'00:00',end:'08:00'}).minutes,540,'DST fall-back uses exact elapsed time');

const result = engine.solve(baseConfig(), solver);
assert.equal(result.feasible, true, result.error);
assert.equal(result.exact, true);
assert.equal(Object.keys(result.assignments).length, 8, 'four Mondays with day and night coverage');
assert.equal(result.unfilled.length, 0);
const assignmentCounts = Object.values(result.assignments).reduce((counts, workerId) => (counts[workerId]=(counts[workerId]||0)+1,counts),{});
assert.equal(assignmentCounts.a,4,'squared-error optimum balances equal workers');
assert.equal(assignmentCounts.b,4,'squared-error optimum balances equal workers');

const unavailable = baseConfig();
unavailable.availability.push({ workerId: 'a', date: '2026-02-02', period: 'all' });
unavailable.availability.push({ workerId: 'b', date: '2026-02-02', period: 'all' });
const gap = engine.solve(unavailable, solver);
assert.equal(gap.feasible, true);
assert.equal(gap.unfilled.length, 2, 'infeasible coverage is returned with exact explanations');

const locked = baseConfig();
locked.assignments['2026-02-02|day-0'] = 'a';
locked.locks['2026-02-02|day-0'] = true;
const lockedResult = engine.solve(locked, solver);
assert.equal(lockedResult.assignments['2026-02-02|day-0'], 'a');

const overlap = baseConfig();
overlap.shifts.secondDay = {...overlap.shifts.day,label:'Overlapping day'};
const overlapResult = engine.solve(overlap,solver);
['2026-02-02','2026-02-09','2026-02-16','2026-02-23'].forEach(date=>assert.notEqual(overlapResult.assignments[date+'|day-0'],overlapResult.assignments[date+'|secondDay-0'],'overlapping duties require different workers'));

const fallback = {
  current:'2026-02',settings:{recoveryDays:2},minimumRestHours:8,
  shifts:{
    day:{label:'12h day',start:'08:00',end:'20:00',activeDays:[1],coverage:1,category:'General',period:'day',manager:false},
    night:{label:'12h night',start:'20:00',end:'08:00',activeDays:[1],coverage:1,category:'General',period:'night',manager:false},
    support:{label:'Support',start:'08:00',end:'16:00',activeDays:[1],coverage:1,category:'General',period:'day',manager:false},
    manager:{label:'Manager',start:'08:00',end:'16:00',activeDays:[1],coverage:1,category:'Manager',period:'day',manager:true}
  },
  pairings:[{id:'pair',name:'08→08',firstShiftId:'day',secondShiftId:'night',dayOffset:0,enabled:true}],
  workers:[
    {id:'pairWorker',name:'Pair worker',target:96,preference:'either',pair24:'pair',categories:['General'],managerQualified:false,defaultManager:false},
    {id:'supportWorker',name:'Support worker',target:32,preference:'day',pair24:'none',categories:['General'],managerQualified:false,defaultManager:false}
  ],availability:[],assignments:{},locks:{},randomRanks:{pairWorker:0.1,supportWorker:0.2}
};
const fallbackResult=engine.solve(fallback,solver);
assert.equal(fallbackResult.unfilled.length,0,'24h manager fallback plus support provides complete coverage');
assert.equal(Object.keys(fallbackResult.managerFallbacks).length,4,'fallback is recorded on each active manager day');
Object.entries(fallbackResult.managerFallbacks).forEach(([date,workerId])=>{assert.equal(workerId,'pairWorker');assert.equal(fallbackResult.assignments[date+'|support-0'],'supportWorker');});

const boundary = {
  current:'2026-03',settings:{recoveryDays:2},minimumRestHours:8,
  shifts:{
    day:{label:'Day',start:'08:00',end:'16:00',activeDays:[0],coverage:1,category:'General',period:'day',manager:false},
    previousDay:{label:'Previous day',start:'08:00',end:'20:00',activeDays:[],coverage:1,category:'General',period:'day',manager:false},
    previousNight:{label:'Previous night',start:'20:00',end:'08:00',activeDays:[],coverage:1,category:'General',period:'night',manager:false}
  },pairings:[],workers:[
    {id:'a',name:'A',target:40,preference:'day',pair24:'none',categories:['General'],managerQualified:false,defaultManager:false},
    {id:'b',name:'B',target:40,preference:'day',pair24:'none',categories:['General'],managerQualified:false,defaultManager:false}
  ],availability:[],assignments:{'2026-02-27|previousDay-0':'a','2026-02-27|previousNight-0':'a'},locks:{},randomRanks:{a:0.1,b:0.2},
  twentyFourPairs:[{workerId:'a',startDate:'2026-02-27',keys:['2026-02-27|previousDay-0','2026-02-27|previousNight-0']}]
};
const boundaryResult=engine.solve(boundary,solver);
assert.equal(boundaryResult.assignments['2026-03-01|day-0'],'b','24h recovery is enforced across month boundaries');

const boundaryRest={...boundary,settings:{recoveryDays:0},assignments:{'2026-02-28|previousNight-0':'a'},twentyFourPairs:[]};
const boundaryRestResult=engine.solve(boundaryRest,solver);
assert.equal(boundaryRestResult.assignments['2026-03-01|day-0'],'b','minimum rest is enforced across month boundaries');

console.log('scheduler-engine tests passed');
