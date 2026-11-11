import {useState} from 'react';
import {Plus} from 'lucide-react';

const legacyStatuses:Record<string,string>={pending:'Chờ xử lý',done:'Hoàn tất',approved:'Đã duyệt',rejected:'Từ chối'};

type Row = {id:string; data:any};
type Registration = {studentUid:string; name:string; code:string; paid:boolean; received:boolean; note:string};

export function gearRegistrations(data:any):Registration[] {
  return Array.isArray(data.registrations) ? data.registrations : [];
}

export function GearOrders({orders,className,onAdd,onEdit}:{
  orders:Row[]; className:(id:string)=>string; onAdd:()=>void; onEdit:(id:string)=>void;
}) {
  return <section className="panel">
    <div className="panel-heading">
      <h2>Đơn võ phục & dụng cụ</h2>
      <button className="primary" onClick={onAdd}><Plus size={17}/>Tạo đơn hàng</button>
    </div>
    {orders.length ? <div className="gear-orders padded">{orders.map(order=>{
      const {data}=order;
      const registrations=gearRegistrations(data);
      return <article className="gear-order" key={order.id}>
        <div className="gear-order-heading">
          <div><h3>{data.name||'Đơn hàng'}</h3><small>{className(data.classId)} · {registrations.length} võ sinh</small></div>
          <button className="row-action" onClick={()=>onEdit(order.id)}>Cập nhật</button>
        </div>
        {data.description&&<p className="gear-note">{data.description}</p>}
        {registrations.length ? <ul className="gear-registrations">{registrations.map(row=><li key={row.studentUid}>
          <strong>{row.name}{row.code&&<small> · {row.code}</small>}</strong>
          <div className="gear-status">
            <span className={'badge '+(row.paid?'green':'amber')}>{row.paid?'Đã đóng tiền':'Chưa đóng tiền'}</span>
            <span className={'badge '+(row.received?'green':'amber')}>{row.received?'Đã nhận':'Chưa nhận'}</span>
          </div>
          {row.note&&<p className="gear-note">{row.note}</p>}
        </li>)}</ul> : <p className="muted">Chưa có danh sách võ sinh{data.status&&' · '+(legacyStatuses[String(data.status)]||data.status)}</p>}
      </article>;
    })}</div> : <p className="padded muted">Chưa có đơn hàng.</p>}
  </section>;
}

export function GearOrderFields({form,onChange,classes,students,disabled}:{
  form:any; onChange:(data:any)=>void; classes:Row[]; students:Row[]; disabled:boolean;
}) {
  const [query,setQuery]=useState('');
  const registrations=gearRegistrations(form);
  const candidates=students.filter(s=>s.data.classId===form.classId);
  const normalize=(s:string)=>s.toLowerCase().normalize('NFD').replace(/\p{M}/gu,'').replace(/đ/g,'d');
  const matches=candidates.filter(s=>normalize(`${s.data.name||''} ${s.data.id||''}`).includes(normalize(query.trim())));
  const update=(id:string,patch:Partial<Registration>)=>onChange({
    ...form, registrations:registrations.map(row=>row.studentUid===id?{...row,...patch}:row),
  });
  return <fieldset className="gear-fields" disabled={disabled}>
    <label className="field"><span>Mặt hàng *</span><input autoFocus required value={form.name||''} onChange={e=>onChange({...form,name:e.target.value})}/></label>
    <label className="field"><span>Lớp *</span><select required value={form.classId||''} onChange={e=>{
      if(registrations.length&&!window.confirm('Đổi lớp sẽ bỏ các võ sinh đã chọn trong đơn này. Tiếp tục?'))return;
      setQuery('');
      onChange({...form,classId:e.target.value,registrations:[]});
    }}>
      <option value="">Chọn lớp</option>
      {form.classId&&!classes.some(c=>c.id===form.classId)&&<option value={form.classId}>Lớp đã lưu trong đơn</option>}
      {classes.map(c=><option key={c.id} value={c.id}>{c.data.name}</option>)}
    </select></label>
    <label className="field"><span>Tìm võ sinh theo tên hoặc mã</span><input type="search" value={query} onChange={e=>setQuery(e.target.value)}/></label>
    <div className="gear-picker" role="group" aria-label="Chọn võ sinh đăng ký">
      {matches.length ? matches.map(s=>{
        const selected=registrations.some(row=>row.studentUid===s.id);
        return <label className="checkbox" key={s.id}><input type="checkbox" checked={selected} onChange={e=>onChange({
          ...form, registrations:e.target.checked
            ? [...registrations,{studentUid:s.id,name:s.data.name||'',code:s.data.id||'',paid:false,received:false,note:''}]
            : registrations.filter(row=>row.studentUid!==s.id),
        })}/>{s.data.name}{s.data.id&&' · '+s.data.id}</label>;
      }) : <small>{candidates.length?'Không tìm thấy võ sinh phù hợp.':'Chưa có võ sinh đang học trong lớp này.'}</small>}
    </div>
    <h3>Võ sinh đăng ký ({registrations.length})</h3>
    <div className="gear-orders">{registrations.map(row=><div className="gear-order" key={row.studentUid}>
      <div className="gear-order-heading"><strong>{row.name}{row.code&&' · '+row.code}</strong>
        <button type="button" className="text-btn" onClick={()=>onChange({...form,registrations:registrations.filter(item=>item.studentUid!==row.studentUid)})}>Bỏ chọn</button>
      </div>
      <div className="gear-status">
        <label className="checkbox"><input type="checkbox" checked={row.paid} onChange={e=>update(row.studentUid,{paid:e.target.checked})}/>Đã đóng tiền</label>
        <label className="checkbox"><input type="checkbox" checked={row.received} onChange={e=>update(row.studentUid,{received:e.target.checked})}/>Đã nhận</label>
      </div>
      <label className="field"><span>Ghi chú cho {row.name}</span><input value={row.note} onChange={e=>update(row.studentUid,{note:e.target.value})}/></label>
    </div>)}</div>
    {!registrations.length&&form.status&&<label className="field"><span>Trạng thái đơn cũ</span><select value={form.status} onChange={e=>onChange({...form,status:e.target.value})}>
      {!legacyStatuses[form.status]&&<option value={form.status}>{form.status}</option>}
      {Object.entries(legacyStatuses).map(([value,label])=><option key={value} value={value}>{label}</option>)}
    </select></label>}
    <label className="field"><span>Ghi chú chung</span><textarea value={form.description||''} onChange={e=>onChange({...form,description:e.target.value})}/></label>
  </fieldset>;
}
