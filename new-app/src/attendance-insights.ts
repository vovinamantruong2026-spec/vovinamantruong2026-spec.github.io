// Read-only calculations: never infer absence from missing/unmarked records.
export function attendanceInsights(student:any,sessions:any[],period='',today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())){
 const entries=sessions.filter(s=>!s.data.deleted&&s.data.status==='final'&&/^\d{4}-\d{2}-\d{2}$/.test(s.data.date)&&s.data.date<=today&&(!student.data.joinDate||s.data.date>=student.data.joinDate))
  .flatMap(s=>(s.data.rows||[]).filter((r:any)=>r.studentUid===student.id&&!r.makeup&&['present','absent','excused'].includes(r.status)).map((r:any)=>({date:s.data.date,classId:s.data.classId,status:r.status,id:s.id})))
  .sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
 const selected=entries.filter(e=>e.date.startsWith(period));
 const present=selected.filter(e=>e.status==='present').length,absent=selected.filter(e=>e.status==='absent').length,excused=selected.filter(e=>e.status==='excused').length;
 let streak:typeof entries=[];
 for(const e of entries){if(e.status==='absent')streak.push(e);else streak=[];}
 return {total:selected.length,present,absent,excused,rate:selected.length?Math.round(present/selected.length*1000)/10:null,streak:streak.length,streakDates:streak};
}
