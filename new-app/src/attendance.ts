import {isStudying} from './student-policy';
// Keep marks and makeup students; reconcile only an unfinished class roster.
export function reconcileAttendance(att:any,students:any[]){
 if(!att||att.status==='final')return att;
 const byId=new Map(students.map(s=>[s.id,s]));
 const rows=(att.rows||[]).filter((r:any)=>{const s=byId.get(r.studentUid);return s&&!s.data.deleted&&(isStudying(s)||r.status!=='unmarked'||String(r.note||'').trim()!=='')&&(r.makeup||s.data.classId===att.classId)});
 const ids=new Set(rows.map((r:any)=>r.studentUid));
 for(const s of students)if(isStudying(s)&&s.data.classId===att.classId&&!ids.has(s.id))rows.push({studentUid:s.id,status:'unmarked',note:'',makeup:false});
 return JSON.stringify(rows)===JSON.stringify(att.rows)?att:{...att,rows};
}

export function matchesAttendance(att:any,date:string,classId:string){return !!att&&att.date===date&&att.classId===classId;}
export function restoredAttendanceDraft(current:any,local:any){
 if(!local||local.version!==current.version||!matchesAttendance(local,current.date,current.classId)||!Array.isArray(local.rows)||local.rows.some((r:any)=>!r||typeof r.studentUid!=='string'||!['present','absent','excused','unmarked'].includes(r.status)))return null;
 // Local edits to a finalized session stay official when saved again.
 return {...local,status:current.status==='final'?'final':'draft'};
}
export function attendanceSaveInput(att:any,date:string,classId:string,final:boolean){
 if(!matchesAttendance(att,date,classId))throw new Error('Đang tải buổi điểm danh. Hãy chờ trước khi lưu.');
 if(!Number.isInteger(att.version)||att.version<0)throw new Error('Phiên bản điểm danh không hợp lệ. Tải lại buổi tập.');
 if(!Array.isArray(att.rows)||!att.rows.length)throw new Error('Buổi tập chưa có võ sinh.');
 const isFinal=final||att.status==='final';
 const unmarked=att.rows.filter((r:any)=>r.status==='unmarked').length;
 if(isFinal&&unmarked)throw new Error('Còn '+unmarked+' võ sinh chưa điểm danh. Chọn Có mặt, Vắng hoặc Có phép trước khi chốt.');
 const {version,...data}=att;
 return {kind:'attendance',id:date+'_'+classId,version,data:{...data,status:isFinal?'final':'draft'}};
}
