'use client';

import {useState} from 'react';
type Rec={kind:string;id:string;data:any;version:number};

const money = (amount: number) => amount.toLocaleString('vi-VN') + ' đ';
type Entry = {studentUid:string; name:string; code:string; fee:number; paid:boolean; result:string};
type Save = (kind:string,id:string,data:unknown,version:number,onError:(message:string,conflict:boolean)=>void)=>Promise<Rec|null>;

export default function Exams({records,students,save,pending,sync}:{
 records:Rec[]; students:Rec[]; sync?:(ids:string[], name:string)=>Promise<{saved:number;failures:string[]}>; save:Save; pending:boolean;
}) {
 const exams=records.filter(r=>r.kind==='tournament'&&r.data.category==='rank-exam'&&!r.data.deleted);
 const classes=records.filter(r=>r.kind==='class'&&!r.data.deleted);
 const [examId,setExamId]=useState('');
 const [classId,setClassId]=useState('');
 const [error,setError]=useState('');
 const [settings,setSettings]=useState<{id:string;version:number;name:string;date:string;location:string;fee:number}|null>(null);
 const group=classes.find(r=>r.id===classId)??classes[0];
 const available=exams.filter(r=>r.data.classId===group?.id);
 const exam=available.find(r=>r.id===examId)??available[0];
 const id=exam?.id??'';
 const roster=exam;
 const [draft,setDraft]=useState<{id:string;version:number;entries:Entry[]}|null>(null);
 const entries=draft?.id===id?draft.entries:(roster?.data.entries??[]) as Entry[];
 const [query,setQuery]=useState('');
 const [syncing,setSyncing]=useState(false);
 const rosterData=(key:string)=>exams.find(r=>r.id===key)?.data??{entries:[]};
 const candidates=students.filter(r=>r.data.classId===group?.id&&
   !entries.some(e=>e.studentUid===r.id)&&(r.data.name+' '+r.data.id).toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi')));
 function update(next:Entry[]) {
  setDraft({id,version:draft?.id===id?draft.version:roster?.version??0,entries:next});
 }
 function clearDraft(){
  if(draft&&!window.confirm('Bỏ các thay đổi chưa lưu trong danh sách này?'))return false;
  setDraft(null);
  setError('');
  return true;
 }
 return <section className="panel exam-panel"><div className="panel-heading"><div><h2>Khóa thi đẳng cấp</h2></div>
 {group&&<button className="secondary" onClick={()=>setSettings({id:crypto.randomUUID(),version:0,name:'',date:'',location:'',fee:0})}>Tạo khóa thi</button>}</div>
 {error&&<p className="padded" role="alert">{error}</p>}
 {settings&&<form className="padded" onSubmit={async e=>{
   e.preventDefault();
   if(!group||!settings.name.trim()||!Number.isSafeInteger(settings.fee)||settings.fee<0)return;
   setError('');
   const {id:settingId,version,...data}=settings;
   const saved=await save('tournament',settingId,{...rosterData(settingId),...data,name:data.name.trim(),category:'rank-exam',classId:group?.id},version,setError);
   if(saved){if(!draft)setExamId(saved.id);setSettings(null)}
 }}>
  <h3>Cài đặt khóa thi</h3>
  <div className="form-row"><label>Tên khóa thi<input required maxLength={120} value={settings.name} onChange={e=>setSettings({...settings,name:e.target.value})}/></label>
  <label>Ngày thi<input type="date" value={settings.date} onChange={e=>setSettings({...settings,date:e.target.value})}/></label></div>
  <div className="form-row"><label>Địa điểm<input maxLength={200} value={settings.location} onChange={e=>setSettings({...settings,location:e.target.value})}/></label>
  <label>Lệ phí mặc định (đ)<input type="number" min="0" step="1" required value={Number.isNaN(settings.fee)?'':settings.fee} onChange={e=>setSettings({...settings,fee:e.target.valueAsNumber})}/></label></div>
  <button className="primary" disabled={pending}>Lưu cài đặt</button>{' '}
  <button type="button" className="secondary" disabled={pending} onClick={()=>setSettings(null)}>Đóng</button>
 </form>}
 <div className="padded"><label className="field">Lớp phụ trách<select disabled={pending||!!settings} value={group?.id??''} onChange={e=>{if(clearDraft())setClassId(e.target.value)}}>{classes.map(r=><option key={r.id} value={r.id}>{r.data.name}</option>)}</select></label></div>
 {!exam&&<p className="padded muted">Lớp này chưa có khóa thi.</p>}
 {exam&&<div className="padded">
  <label className="field">Khóa thi<select disabled={pending||!!settings} value={exam.id} onChange={e=>{if(clearDraft())setExamId(e.target.value)}}>{available.map(r=><option key={r.id} value={r.id}>{r.data.name}</option>)}</select></label>
  <p>{[exam.data.date?.split('-').reverse().join('/'),exam.data.location,'Lệ phí mặc định: '+money(exam.data.fee)].filter(Boolean).join(' · ')}</p>
  {<button className="secondary" onClick={()=>setSettings({...exam.data,id:exam.id,version:exam.version})}>Sửa cài đặt khóa thi</button>}
  {group&&<form onSubmit={async e=>{
   e.preventDefault();
   if(!draft||entries.some(row=>!Number.isSafeInteger(row.fee)||row.fee<0))return;
   setError('');
   if(await save('tournament',id,{...exam.data,entries},draft.version,setError))setDraft(null);
  }}>
   <fieldset disabled={pending||!!settings||syncing}>
   <legend>Danh sách tham gia</legend>
   <details><summary>Chọn võ sinh</summary>
    <label>Tìm theo tên hoặc mã<input value={query} onChange={e=>setQuery(e.target.value)}/></label>
    <div style={{maxHeight:230,overflowY:'auto'}}>{candidates.map(s=><div key={s.id}><button className="text-btn" type="button" onClick={()=>update([...entries,{studentUid:s.id,name:s.data.name,code:s.data.id,fee:exam.data.fee,paid:false,result:'pending'}])}>Thêm {s.data.name} · {s.data.id}</button></div>)}</div>
   </details>
   <div className="table-wrap"><table><thead><tr><th>Võ sinh</th><th>Kết quả</th><th>Lệ phí (đ)</th><th>Đóng lệ phí</th><th/></tr></thead>
   <tbody>{entries.map((row,i)=>{
    const edit=(patch:Partial<Entry>)=>update(entries.map((r,j)=>i===j?{...r,...patch}:r));
    return <tr key={row.studentUid}><td>{row.name}<small className="subtext">{row.code}</small></td>
    <td><select aria-label={'Kết quả '+row.name} value={row.result} onChange={e=>edit({result:e.target.value})}><option value="pending">Chưa có kết quả</option><option value="pass">Đạt</option><option value="fail">Trượt</option></select></td>
    <td><input aria-label={'Lệ phí '+row.name} type="number" min="0" step="1" required value={Number.isNaN(row.fee)?'':row.fee} onChange={e=>edit({fee:e.target.valueAsNumber})}/></td>
    <td><select aria-label={'Đóng lệ phí '+row.name} value={String(row.paid)} onChange={e=>edit({paid:e.target.value==='true'})}><option value="false">Chưa đóng</option><option value="true">Đã đóng</option></select></td>
    <td>{!roster?.data.entries.some((r:Entry)=>r.studentUid===row.studentUid)&&<button type="button" className="text-btn" onClick={()=>update(entries.filter((_,j)=>i!==j))}>Bỏ chọn</button>}</td></tr>;
   })}</tbody></table></div>
   {!entries.length&&<p className="muted">Chưa chọn võ sinh.</p>}
   <button className="primary" disabled={!draft||!entries.length}>Lưu danh sách</button>{' '}
   {draft&&<button className="secondary" type="button" onClick={clearDraft}>Bỏ thay đổi</button>}
   {sync&&<button className="secondary" type="button" disabled={!!draft||!entries.length} onClick={async()=>{
    setSyncing(true);
    setError('');
    try{
     const result=await sync(entries.map(row=>row.studentUid),exam.data.name);
     setError(result.failures.length?'Đã đồng bộ '+result.saved+' hồ sơ. '+result.failures.join(' '):'Đã đồng bộ khóa thi với hồ sơ và thẻ đẳng cấp.');
    }catch(error){setError(error instanceof Error?error.message:'Chưa đồng bộ được khóa thi.')}
    finally{setSyncing(false)}
   }}>Đồng bộ với hồ sơ và thẻ</button>}
   </fieldset>
  </form>}
 </div>}</section>;
}
