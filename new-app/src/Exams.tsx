import {useState} from 'react';

type Rec={kind:string;id:string;data:any;version:number};
type Entry={studentUid:string;name:string;code:string;fee:number;paid:boolean;result:'pending'|'pass'|'fail';belt?:string};
export type ExamDetails={name:string;date:string;location:string;organization:string;belt:string;fee:number};
type Sync=(entries:Entry[],exam:ExamDetails)=>Promise<{saved:number;failures:string[]}>;
type Save=(kind:string,id:string,data:unknown,version:number)=>Promise<Rec|null>;
type Settings=ExamDetails&{key:string;classIds:string[]};
const examKey=(record:Rec)=>record.data.examGroup||record.id;

export default function Exams({records,students,save,pending,sync}:{
 records:Rec[];students:Rec[];save:Save;pending:boolean;sync?:Sync;
}) {
 const classes=records.filter(r=>r.kind==='class'&&!r.data.deleted);
 const exams=records.filter(r=>r.kind==='tournament'&&r.data.category==='rank-exam'&&!r.data.deleted);
 const groups=[...new Map(exams.map(record=>[examKey(record),record])).values()];
 const [selected,setSelected]=useState('');
 const exam=groups.find(r=>examKey(r)===selected)??groups[0];
 const key=exam?examKey(exam):'';
 const rosters=exams.filter(r=>examKey(r)===key);
 const [settings,setSettings]=useState<Settings|null>(null);
 const [draft,setDraft]=useState<Record<string,{entries:Entry[];version:number}>>({});
 const [filter,setFilter]=useState('');
 const [query,setQuery]=useState('');
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [retry,setRetry]=useState(false);
 const locked=pending||busy;
 const dirty=Object.keys(draft).length>0;
 const rows=rosters.flatMap(r=>(draft[r.id]?.entries??r.data.entries??[]).map((entry:Entry)=>({r,entry})));
 const className=(id:string)=>classes.find(c=>c.id===id)?.data.name??'Lớp cũ';
 const candidateRoster=new Map(rosters.map(r=>[r.data.classId,r]));
 const candidates=students.filter(s=>candidateRoster.has(s.data.classId)&&(!filter||filter===s.data.classId)&&
  !rows.some(({entry})=>entry.studentUid===s.id)&&
  (s.data.name+' '+s.data.id).toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi')));
 function update(roster:Rec,entries:Entry[]){
  setDraft(current=>({...current,[roster.id]:{entries,version:current[roster.id]?.version??roster.version}}));
 }
 async function saveSettings(){
  if(!settings||!settings.name.trim()||!settings.organization.trim()||!settings.belt.trim()||
    !settings.classIds.length||!Number.isSafeInteger(settings.fee)||settings.fee<0)return;
  const {key:group,classIds,name,date,location,organization,belt,fee}=settings;
  const data={name:name.trim(),date,location,organization:organization.trim(),belt:belt.trim(),fee};
  setBusy(true);
  setMessage('');
  try{
   const failures:string[]=[];
   for(const classId of classIds){
    const old=exams.find(r=>examKey(r)===group&&r.data.classId===classId);
    const saved=await save('tournament',old?.id??group+'_'+classId,{
     ...old?.data,...data,
     classId,category:'rank-exam',examGroup:group,entries:old?.data.entries??[],
    },old?.version??0);
    if(!saved)failures.push(className(classId));
   }
   setSelected(group);
   setFilter('');
   if(failures.length)setMessage('Chưa lưu được lớp: '+failures.join(', ')+'. Kiểm tra thông báo rồi lưu lại.');
   else setSettings(null);
  }finally{setBusy(false)}
 }
 async function confirmResults(){
  if(!exam)return;
  setBusy(true);
  setMessage('');
  const failures:string[]=[];
  const passed:Entry[]=[];
  try{
   for(const r of rosters){
    const edit=draft[r.id];
    const entries:Entry[]=edit?.entries??r.data.entries??[];
    const valid=entries.every(row=>Number.isSafeInteger(row.fee)&&row.fee>=0&&
     (row.result!=='pass'||Boolean((row.belt||r.data.belt)?.trim())));
    if(!valid){failures.push(className(r.data.classId)+': kiểm tra lệ phí và cấp đai đạt.');continue}
    const saved=edit?await save('tournament',r.id,{...r.data,entries},edit.version):r;
    if(!saved){failures.push(className(r.data.classId)+': chưa lưu được danh sách.');continue}
    if(edit)setDraft(current=>{const next={...current};delete next[r.id];return next});
    passed.push(...entries.filter(row=>row.result==='pass').map(row=>({...row,belt:row.belt||r.data.belt})));
   }
   let profileFailures=false;
   if(passed.length&&sync){
    try{
     const result=await sync(passed,exam.data);
     profileFailures=result.failures.length>0;
     failures.push(...result.failures);
     if(!failures.length)setMessage('Đã xác nhận kết quả và cập nhật hồ sơ, thẻ đẳng cấp.');
    }catch(error){profileFailures=true;failures.push(error instanceof Error?error.message:'Chưa cập nhật được hồ sơ.')}
   }else if(!failures.length)setMessage('Đã lưu danh sách.');
   setRetry(profileFailures);
   if(failures.length)setMessage(failures.join(' '));
  }finally{setBusy(false)}
 }
 return <section className="panel exam-panel">
  <div className="panel-heading"><h2>Khóa thi đẳng cấp</h2>
   <button className="secondary" disabled={locked||dirty||!classes.length} onClick={()=>setSettings({key:crypto.randomUUID(),name:'',date:'',location:'',organization:'',belt:'',fee:0,classIds:[]})}>Tạo khóa thi</button>
  </div>
  {message&&<p className="padded" role="status">{message}</p>}
  {settings&&<form className="padded" onSubmit={event=>{event.preventDefault();void saveSettings()}}>
   <fieldset disabled={locked}><legend>Cài đặt khóa thi</legend>
    <div className="form-row"><label>Tên khóa thi<input required maxLength={120} value={settings.name} onChange={e=>setSettings({...settings,name:e.target.value})}/></label>
    <label>Ngày thi<input type="date" required value={settings.date} onChange={e=>setSettings({...settings,date:e.target.value})}/></label></div>
    <div className="form-row"><label>Đơn vị<input required maxLength={120} value={settings.organization} onChange={e=>setSettings({...settings,organization:e.target.value})}/></label>
    <label>Cấp đai đạt mặc định<input required maxLength={80} value={settings.belt} onChange={e=>setSettings({...settings,belt:e.target.value})}/></label></div>
    <div className="form-row"><label>Địa điểm<input maxLength={200} value={settings.location} onChange={e=>setSettings({...settings,location:e.target.value})}/></label>
    <label>Lệ phí mặc định (đ)<input type="number" min="0" step="1" required value={Number.isNaN(settings.fee)?'':settings.fee} onChange={e=>setSettings({...settings,fee:e.target.valueAsNumber})}/></label></div>
    <fieldset><legend>Lớp dự thi</legend>
     <button type="button" className="secondary" onClick={()=>setSettings({...settings,classIds:classes.map(c=>c.id)})}>Chọn tất cả lớp</button>
     {classes.map(c=>{
      const fixed=exams.some(r=>examKey(r)===settings.key&&r.data.classId===c.id);
      return <label key={c.id} className="exam-choice"><input type="checkbox" disabled={fixed} checked={settings.classIds.includes(c.id)} onChange={e=>setSettings({...settings,classIds:e.target.checked?[...settings.classIds,c.id]:settings.classIds.filter(id=>id!==c.id)})}/>{c.data.name}</label>;
     })}
    </fieldset>
    <button className="primary" disabled={!settings.classIds.length}>Lưu cài đặt</button>{' '}
    <button type="button" className="secondary" onClick={()=>setSettings(null)}>Đóng</button>
   </fieldset>
  </form>}
  {!exam&&<p className="padded muted">Chưa có khóa thi.</p>}
  {exam&&<form className="padded" onSubmit={event=>{event.preventDefault();void confirmResults()}}>
   <fieldset disabled={locked||!!settings}><legend>Danh sách dự thi</legend>
    <div className="form-row"><label>Khóa thi<select value={key} onChange={e=>{
     if(dirty&&!window.confirm('Bỏ thay đổi chưa lưu?'))return;
     setDraft({});setFilter('');setSelected(e.target.value);setMessage('');setRetry(false);
    }}>{groups.map(r=><option value={examKey(r)} key={examKey(r)}>{r.data.name}</option>)}</select></label>
    <label>Lọc theo lớp<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="">Tất cả lớp của khóa thi</option>{rosters.map(r=><option key={r.id} value={r.data.classId}>{className(r.data.classId)}</option>)}</select></label></div>
    <button type="button" className="secondary" disabled={dirty} onClick={()=>setSettings({
     ...exam.data,key,classIds:rosters.map(r=>r.data.classId),organization:exam.data.organization??'',belt:exam.data.belt??'',
    })}>Sửa cài đặt khóa thi</button>
    <details><summary>Chọn võ sinh đủ điều kiện</summary>
     <label>Tìm theo tên hoặc mã<input value={query} onChange={e=>setQuery(e.target.value)}/></label>
     <div style={{maxHeight:230,overflowY:'auto'}}>{candidates.map(s=>{
      const r=candidateRoster.get(s.data.classId)!;
      return <div key={s.id}><button type="button" className="text-btn" onClick={()=>update(r,[
       ...(draft[r.id]?.entries??r.data.entries??[]),
       {studentUid:s.id,name:s.data.name,code:s.data.id,fee:r.data.fee,paid:false,result:'pending'},
      ])}>Thêm {s.data.name} · {s.data.id} · {className(s.data.classId)}</button></div>;
     })}{!candidates.length&&<p>Không có võ sinh phù hợp.</p>}</div>
    </details>
    <div className="table-wrap"><table><thead><tr><th>Võ sinh</th><th>Lớp</th><th>Kết quả</th><th>Cấp đai đạt</th><th>Lệ phí (đ)</th><th>Đóng lệ phí</th><th/></tr></thead><tbody>{rows.filter(({r})=>!filter||r.data.classId===filter).map(({r,entry})=>{
     const list:Entry[]=draft[r.id]?.entries??r.data.entries??[];
     const edit=(patch:Partial<Entry>)=>update(r,list.map(row=>row.studentUid===entry.studentUid?{...row,...patch}:row));
     return <tr key={entry.studentUid}><td>{entry.name}<small className="subtext">{entry.code}</small></td><td>{className(r.data.classId)}</td>
      <td><select aria-label={'Kết quả '+entry.name} value={entry.result} onChange={e=>edit({result:e.target.value as Entry['result']})}>
       <option value="pending">Chưa có kết quả</option><option value="pass" disabled={!sync}>Đỗ</option><option value="fail">Trượt</option>
      </select></td>
      <td><input aria-label={'Cấp đai đạt '+entry.name} maxLength={80} placeholder={r.data.belt||'Nhập cấp đai'} value={entry.belt??''} onChange={e=>edit({belt:e.target.value})}/></td>
      <td><input aria-label={'Lệ phí '+entry.name} type="number" min="0" step="1" required value={Number.isNaN(entry.fee)?'':entry.fee} onChange={e=>edit({fee:e.target.valueAsNumber})}/></td>
      <td><select aria-label={'Đóng lệ phí '+entry.name} value={String(entry.paid)} onChange={e=>edit({paid:e.target.value==='true'})}><option value="false">Chưa đóng</option><option value="true">Đã đóng</option></select></td>
      <td>{!(r.data.entries??[]).some((row:Entry)=>row.studentUid===entry.studentUid)&&<button type="button" onClick={()=>update(r,list.filter(row=>row.studentUid!==entry.studentUid))}>Bỏ chọn</button>}</td>
     </tr>;
    })}</tbody></table></div>
    {!sync&&<p>Cần quyền quản lý hồ sơ võ sinh để xác nhận đỗ và cập nhật thẻ.</p>}
    <button className="primary" disabled={!dirty&&!retry}>{retry&&!dirty?'Thử cập nhật lại hồ sơ':'Lưu và xác nhận kết quả'}</button>
    {sync&&!dirty&&!retry&&rows.some(({entry})=>entry.result==='pass')&&<button type="button" className="secondary" onClick={()=>void confirmResults()}>Cập nhật lại hồ sơ đã đỗ</button>}{' '}
    {dirty&&<button type="button" className="secondary" onClick={()=>setDraft({})}>Bỏ thay đổi</button>}
   </fieldset>
  </form>}
 </section>;
}
