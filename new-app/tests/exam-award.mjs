import assert from 'node:assert/strict';
import {test} from 'node:test';
import {examAwardPatch} from '../src/exam-award.ts';

const first={name:'Khóa tháng 5',date:'2026-05-01',organization:'CLB',location:'',fee:0};
const second={...first,name:'Khóa tháng 9',date:'2026-09-01'};
const original={belt:'Tự vệ nhập môn',examSession:'Khóa cũ',examDate:'2025-11-01',organization:'Đơn vị cũ',phone:'0123'};
const passing={result:'pass',belt:'Lam đai'};
const failing={result:'fail',revokedBelt:passing.belt};
const apply=(profile,id,exam,entry)=>({...profile,...examAwardPatch(profile,id,exam,entry)});

test('restores the previous belt and exam fields after a pass is corrected',()=>{
 const promoted=apply(original,'may',first,passing);
 assert.equal(promoted.examSession,first.name);
 assert.equal(promoted.belt,passing.belt);
 assert.equal(examAwardPatch(promoted,'may',first,passing),null);
 for(const result of ['fail','pending']){
  const reversal={...failing,result};
  const corrected=apply(promoted,'may',first,reversal);
  assert.deepEqual(corrected,{...original,examAwards:[]});
  assert.equal(examAwardPatch(corrected,'may',first,reversal),null);
 }
});

test('preserves the newer award and skips the cancelled award on a later reversal',()=>{
 const promoted=apply(original,'may',first,passing);
 const advanced=apply(promoted,'sep',second,{...passing,belt:'Lam đai nhất'});
 const corrected=apply(advanced,'may',first,failing);
 assert.equal(corrected.examSession,second.name);
 assert.equal(corrected.belt,advanced.belt);
 assert.deepEqual(apply(corrected,'sep',second,{...failing,revokedBelt:advanced.belt}),{...original,examAwards:[]});
});

test('honors direct profile edits and independently saved fields',()=>{
 const promoted=apply(original,'may',first,passing);
 const edited={...promoted,belt:'Cấp đai đã chỉnh tay',phone:'0456'};
 assert.deepEqual(apply(edited,'may',first,failing),{...edited,examAwards:[]});
});

test('requires an explicit previous belt for a matching legacy award',()=>{
 const old={...original,belt:passing.belt,examSession:first.name,examDate:first.date,organization:first.organization};
 assert.throws(()=>examAwardPatch(old,'may',first,failing),/Nhập cấp đai trước khóa thi/);
 const corrected=apply(old,'may',first,{...failing,previousBelt:original.belt});
 assert.deepEqual(corrected,{...original,examSession:'',examDate:'',organization:'',examAwards:[]});
 assert.equal(examAwardPatch({...old,examDate:second.date},'may',first,failing),null);
});

test('updating the same promotion keeps its original restoration snapshot',()=>{
 const promoted=apply(original,'may',first,passing);
 const changed=apply(promoted,'may',first,{...passing,belt:'Lam đai nhất'});
 assert.equal(changed.examAwards.length,1);
 assert.deepEqual(apply(changed,'may',first,{...failing,revokedBelt:changed.belt}),{...original,examAwards:[]});
});
