import {useEffect,useState} from 'react';
import {collection,doc,onSnapshot,query,where,runTransaction,serverTimestamp} from 'firebase/firestore';
import {db,clubId} from './firebase';
import {getActor} from './gateway';
const base='clubs/'+clubId;
export async function requestStudentDeletion(student:any){
 const actor=await getActor();const id=student.id+'_'+student.version;
 await runTransaction(db,async tx=>{
  const ref=doc(db,base+'/deletionRequests/'+id),target=doc(db,base+'/records/student--'+student.id);
  const [previous,current]=await Promise.all([tx.get(ref),tx.get(target)]);
  if(previous.exists())throw new Error('Hồ sơ này đã có yêu cầu. Nếu bị từ chối, hãy cập nhật hồ sơ trước khi gửi lại.');
  if(!current.exists()||current.data().version!==student.version||current.data().data.deleted)throw new Error('Hồ sơ đã thay đổi. Tải lại trước khi gửi.');
  tx.set(ref,{studentUid:student.id,studentName:current.data().data.name,classId:current.data().data.classId,targetVersion:student.version,requestedBy:actor.identityId,requesterName:actor.name,status:'pending',createdAt:serverTimestamp()});
 });
}
export async function decideDeletion(id:string,approve:boolean){
 const actor=await getActor();
 await runTransaction(db,async tx=>{
  const ref=doc(db,base+'/deletionRequests/'+id),snap=await tx.get(ref);
  if(!snap.exists()||snap.data().status!=='pending')throw new Error('Yêu cầu đã được xử lý.');
  const req=snap.data(),target=doc(db,base+'/records/student--'+req.studentUid),student=await tx.get(target);
  if(approve&&(!student.exists()||student.data().version!==req.targetVersion||student.data().data.deleted))throw new Error('Hồ sơ đã thay đổi. Từ chối yêu cầu này và gửi lại sau khi kiểm tra.');
  if(approve){
   const row=student.data()!,audit=doc(collection(db,base+'/audit'));
   tx.set(target,{...row,data:{...row.data,deleted:true,deletedAt:new Date().toISOString(),deletedBy:actor.name,deletionRequestId:id},version:row.version+1,updatedAt:serverTimestamp(),auditId:audit.id});
   tx.set(audit,{actor:actor.name,actorUid:actor.identityId,action:'approve-delete',kind:'student',record_id:req.studentUid,at:serverTimestamp()});
  }
  tx.update(ref,{status:approve?'approved':'rejected',reviewedBy:actor.identityId,reviewerName:actor.name,reviewedAt:serverTimestamp()});
 });
}
export default function DeletionRequests({actor}:any){
 const [rows,setRows]=useState<any[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{
  const col=collection(db,base+'/deletionRequests');const scopes=actor.classIds||[];
  const queries=actor.isSuperAdmin||actor.allClasses?[query(col)]:Array.from({length:Math.ceil(scopes.length/30)},(_,i)=>query(col,where('classId','in',scopes.slice(i*30,i*30+30))));
  const chunks=new Map<number,any[]>();setRows([]);setError('');
  const stops=queries.map((q,i)=>onSnapshot(q,s=>{chunks.set(i,s.docs.map(d=>({id:d.id,...d.data()})));setRows(Array.from(chunks.values()).flat())},()=>setError('Chưa tải được yêu cầu xóa. Cần cập nhật Firestore Rules rồi tải lại trang.')));
  return()=>stops.forEach(stop=>stop());
 },[actor.identityId,actor.isSuperAdmin,actor.allClasses,JSON.stringify(actor.classIds)]);
 async function decide(id:string,approve:boolean){if(!window.confirm(approve?'Chấp nhận xóa và chuyển võ sinh vào thùng rác?':'Từ chối yêu cầu xóa?'))return;setBusy(true);setError('');try{await decideDeletion(id,approve)}catch(e:any){setError(e.message)}finally{setBusy(false)}}
 return <section className="panel"><div className="panel-heading"><div><h2>Phê duyệt xóa võ sinh</h2><p>Chỉ xóa sau khi được duyệt · Hồ sơ đã duyệt được chuyển vào thùng rác</p></div></div>{error&&<div className="alert error" role="alert">{error}</div>}<div className="table-wrap"><table><thead><tr><th>Võ sinh</th><th>Người yêu cầu</th><th>Trạng thái</th><th>Xử lý</th></tr></thead><tbody>{[...rows].sort((a,b)=>Number(b.status==='pending')-Number(a.status==='pending')).map(r=><tr key={r.id}><td>{r.studentName}</td><td>{r.requesterName}</td><td>{{pending:'Chờ phê duyệt',approved:'Đã duyệt xóa',rejected:'Đã từ chối'}[r.status as string]}</td><td>{r.status==='pending'?<><button className="text-btn danger" disabled={busy} onClick={()=>decide(r.id,true)}>Chấp nhận xóa</button><button className="text-btn" disabled={busy} onClick={()=>decide(r.id,false)}>Từ chối</button></>:r.reviewerName}</td></tr>)}</tbody></table>{!rows.length&&<p className="padded">Chưa có yêu cầu xóa võ sinh.</p>}</div></section>;
}
