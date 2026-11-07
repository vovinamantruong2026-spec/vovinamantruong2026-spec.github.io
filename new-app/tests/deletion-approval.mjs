import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,updateDoc,writeBatch,serverTimestamp,getDocs,collection,query,where} from 'firebase/firestore';
const env=await initializeTestEnvironment({projectId:'demo-antruong-v2',firestore:{host:'127.0.0.1',port:8088,rules:readFileSync('firestore.rules','utf8')}});
const base='clubs/antruong-v2';
const db=id=>env.authenticatedContext(id,{email:id+'@test.local',email_verified:true}).firestore();
const staff=db('staff'),reviewer=db('reviewer'),outside=db('outside'),owner=db('owner');
const student={kind:'student',id:'S1',data:{name:'Võ sinh',id:'VVN.0001',classId:'C1'},version:1,updatedAt:serverTimestamp()};
const req={studentUid:'S1',studentName:'Võ sinh',classId:'C1',targetVersion:1,requestedBy:'staff',requesterName:'staff',status:'pending',createdAt:serverTimestamp()};
const ref=(d,p)=>doc(d,base+'/'+p);
function decision(d,id,approve=true,extra={}){const batch=writeBatch(d);batch.update(ref(d,'deletionRequests/S1_1'),{status:approve?'approved':'rejected',reviewedBy:id,reviewerName:id,reviewedAt:serverTimestamp()});if(approve){batch.set(ref(d,'records/student--S1'),{...student,data:{...student.data,deleted:true,deletedAt:new Date().toISOString(),deletedBy:id,deletionRequestId:'S1_1',...extra},version:2,updatedAt:serverTimestamp(),auditId:'test-'+id});batch.set(ref(d,'audit/test-'+id),{actor:id,actorUid:id,action:'approve-delete',kind:'student',record_id:'S1',at:serverTimestamp()})}return batch.commit()}
try{
 await env.clearFirestore();await env.withSecurityRulesDisabled(async ctx=>{const d=ctx.firestore();await setDoc(ref(d,'meta/import'),{status:'ready'});for(const [id,classes,perms] of [['staff',['C1'],{students_direct:true}],['reviewer',['C1'],{approvals_manage:true}],['outside',['C2'],{approvals_manage:true}],['owner',[],{}]])await setDoc(ref(d,'members/'+id+'@test.local'),{id,name:id,status:'active',isSuperAdmin:id==='owner',allClasses:id==='owner',classIds:classes,permissions:perms});await setDoc(ref(d,'records/student--S1'),student);await setDoc(ref(d,'studentCodes/code-vvn.0001'),{studentUid:'S1'})});
 await assertSucceeds(getDoc(ref(staff,'deletionRequests/S1_1')));
 await assertFails(setDoc(ref(staff,'deletionRequests/S1_1'),{...req,targetVersion:2}));
 await assertFails(setDoc(ref(outside,'deletionRequests/S1_1'),{...req,requestedBy:'outside',requesterName:'outside'}));
 await assertSucceeds(setDoc(ref(staff,'deletionRequests/S1_1'),req));
 await assertSucceeds(getDocs(query(collection(reviewer,base+'/deletionRequests'),where('classId','in',['C1']))));
 await assertFails(getDocs(collection(reviewer,base+'/deletionRequests')));
 await assertFails(setDoc(ref(staff,'deletionRequests/S1_1'),req));
 await assertFails(updateDoc(ref(owner,'records/student--S1'),{'data.deleted':true,version:2,updatedAt:serverTimestamp()}));
 await assertFails(decision(staff,'staff'));await assertFails(decision(outside,'outside'));
 await assertFails(updateDoc(ref(reviewer,'deletionRequests/S1_1'),{status:'approved',reviewedBy:'reviewer',reviewerName:'reviewer',reviewedAt:serverTimestamp()}));
 await assertFails(decision(reviewer,'reviewer',true,{name:'Changed while deleting'}));
 await assertSucceeds(decision(reviewer,'reviewer'));
 assert.equal((await getDoc(ref(owner,'records/student--S1'))).data().data.deleted,true);
 await assertFails(decision(reviewer,'reviewer',false));
 await env.withSecurityRulesDisabled(async ctx=>{await setDoc(ref(ctx.firestore(),'records/student--S1'),{...student,version:2});await setDoc(ref(ctx.firestore(),'deletionRequests/S1_1'),req)});
 await assertFails(decision(reviewer,'reviewer'));
 await assertSucceeds(decision(reviewer,'reviewer',false));
 assert.equal((await getDoc(ref(owner,'records/student--S1'))).data().data.deleted,undefined);
 console.log('PASS: scoped request creation, duplicate prevention, direct deletion denial, unauthorized/out-of-scope denial, atomic approval, payload integrity and one-time decision.');
}finally{await env.cleanup()}
