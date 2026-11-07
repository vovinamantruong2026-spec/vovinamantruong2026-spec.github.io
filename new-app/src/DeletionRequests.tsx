import {deletionReason,deletionStatus} from './deletion-policy';
import {useEffect,useState} from 'react';
import {collection,doc,onSnapshot,query,where,runTransaction,serverTimestamp} from 'firebase/firestore';
import {db,clubId} from './firebase';
import {getActor} from './gateway';
const base='clubs/'+clubId;
export async function requestStudentDeletion(student:any,reason:string){
 const validatedReason=deletionReason(reason);const actor=await getActor();const id=student.id+'_'+student.version;
 await runTransaction(db,async tx=>{
  const ref=doc(db,base+'/deletionRequests/'+id),target=doc(db,base+'/records/student--'+student.id);
  const [previous,current]=await Promise.all([tx.get(ref),tx.get(target)]);
  if(previous.exists()){const old=previous.data();if(old.status==='pending'&&old.requestedBy===actor.identityId&&old.reason===validatedReason)return;throw new Error('Hồ sơ này đã có yêu cầu. Nếu bị từ chối, hãy cập nhật hồ sơ trước khi gửi lại.');}
  if(!current.exists()||current.data().version!==student.version||current.data().data.deleted)throw new Error('Hồ sơ đã thay đổi. Tải lại trước khi gửi.');
  tx.set(ref,{studentUid:student.id,studentName:current.data().data.name,classId:current.data().data.classId,targetVersion:student.version,requestedBy:actor.identityId,requesterName:actor.name,status:'pending',reason:validatedReason,createdAt:serverTimestamp()});
 });
}
export async function decideDeletion(id:string,approve:boolean,reviewNote=''){
 if(reviewNote.length>500)throw new Error('Ghi chú tối đa 500 ký tự.');const actor=await getActor();
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
  tx.update(ref,{status:approve?'approved':'rejected',reviewedBy:actor.identityId,reviewerName:actor.name,reviewNote:reviewNote.trim(),reviewedAt:serverTimestamp()});
 });
}
export default function DeletionRequests({actor,ownOnly=false}:any){
 const [rows,setRows]=useState<any[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[notes,setNotes]=useState<Record<string,string>>({});
 useEffect(()=>{
  const col=collection(db,base+'/deletionRequests');const scopes=actor.classIds||[];
  const queries=actor.isSuperAdmin||actor.allClasses?[query(col)]:Array.from({length:Math.ceil(scopes.length/30)},(_,i)=>query(col,where('classId','in',scopes.slice(i*30,i*30+30))));
  const chunks=new Map<number,any[]>();setRows([]);setError('');
  const stops=queries.map((q,i)=>onSnapshot(q,s=>{chunks.set(i,s.docs.map(d=>({id:d.id,...d.data()})));setRows(Array.from(chunks.values()).flat())},()=>setError('Chưa tải được yêu cầu xóa. Cần cập nhật Firestore Rules rồi tải lại trang.')));
  return()=>stops.forEach(stop=>stop());
 },[actor.identityId,actor.isSuperAdmin,actor.allClasses,JSON.stringify(actor.classIds),actor.permissions?.approvals_manage]);
 async function decide(id:string,approve:boolean){if(!window.confirm(approve?'Chấp nhận xóa và chuyển võ sinh vào thùng rác?':'Từ chối yêu cầu xóa?'))return;setBusy(true);setError('');try{await decideDeletion(id,approve,notes[id]||'')}catch(e:any){setError(e.message)}finally{setBusy(false)}}
 const visible=rows.filter(r=>!ownOnly||r.requestedBy===actor.identityId);
 const canReview=!ownOnly&&(actor.isSuperAdmin||actor.permissions?.approvals_manage);
 const when=(v:any)=>v?.toDate?.().toLocaleString('vi-VN')||'—';
 return <section className="panel"><div className="panel-heading"><div><h2>{ownOnly?'Yêu cầu xóa của tôi':'Phê duyệt xóa võ sinh'}</h2><p>{ownOnly?'Theo dõi trạng thái, lý do và kết quả xử lý':'Chỉ xóa sau khi được duyệt · Hồ sơ đã duyệt được chuyển vào thùng rác'}</p></div></div>{error&&<div className="alert error" role="alert">{error}</div>}<div className="table-wrap"><table><thead><tr><th>Võ sinh / lý do</th><th>Người yêu cầu</th><th>Trạng thái</th><th>Kết quả / xử lý</th></tr></thead><tbody>{[...visible].sort((a,b)=>Number(b.status==='pending')-Number(a.status==='pending')||(b.createdAt?.toMillis?.()||0)-(a.createdAt?.toMillis?.()||0)).map(r=><tr key={r.id}><td><strong>{r.studentName}</strong><small className="subtext">{r.reason||'Yêu cầu cũ chưa có lý do'}</small></td><td>{r.requesterName}<small className="subtext">{when(r.createdAt)}</small></td><td>{deletionStatus[r.status]||r.status}</td><td>{r.status==='pending'&&canReview?<><textarea aria-label={'Ghi chú xử lý '+r.studentName} maxLength={500} placeholder="Ghi chú xử lý (không bắt buộc)" value={notes[r.id]||''} disabled={busy} onChange={e=>setNotes({...notes,[r.id]:e.target.value})}/><div className="ops-actions"><button className="text-btn danger" disabled={busy} onClick={()=>decide(r.id,true)}>Chấp nhận xóa</button><button className="text-btn" disabled={busy} onClick={()=>decide(r.id,false)}>Từ chối</button></div></>:r.status==='pending'?'Đang chờ xử lý':<>{r.reviewerName}<small className="subtext">{when(r.reviewedAt)} · {r.reviewNote||'Không có ghi chú'}</small></>}</td></tr>)}</tbody></table>{!visible.length&&<p className="padded">Chưa có yêu cầu xóa võ sinh.</p>}</div></section>;
}
export function StudentDeleteDialog({targets,onClose,onSent}:any){
 const [reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[completed,setCompleted]=useState<string[]>([]);
 async function send(e:any){e.preventDefault();if(busy)return;setError('');setBusy(true);let sent=[...completed];try{const valid=deletionReason(reason);for(const target of targets.filter((r:any)=>!sent.includes(r.id))){await requestStudentDeletion(target,valid);sent.push(target.id);setCompleted([...sent]);onSent(target.id)}onClose(sent.length)}catch(e:any){setError('Đã gửi '+sent.length+'/'+targets.length+' yêu cầu. '+(e.code==='permission-denied'?'Chưa có quyền hoặc cần cập nhật Firestore Rules mới.':e.message))}finally{setBusy(false)}}
 return <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="delete-request-title"><div className="modal-heading"><h2 id="delete-request-title">Gửi yêu cầu xóa {targets.length} võ sinh</h2></div><form onSubmit={send}><div className="modal-body"><p>Hồ sơ được giữ nguyên cho đến khi có người có quyền phê duyệt chấp nhận.</p><label className="field"><span>Lý do xóa *</span><textarea autoFocus required minLength={5} maxLength={500} value={reason} disabled={busy||completed.length>0} onChange={e=>setReason(e.target.value)} placeholder="Nhập lý do để người phê duyệt kiểm tra"/></label>{error&&<div className="alert error" role="alert">{error}</div>}</div><div className="modal-actions"><button type="button" className="secondary" disabled={busy} onClick={()=>onClose(completed.length)}>Đóng</button><button className="primary" disabled={busy}>{busy?'Đang gửi…':completed.length?'Gửi tiếp hồ sơ còn lại':'Gửi yêu cầu'}</button></div></form></section></div>;
}
