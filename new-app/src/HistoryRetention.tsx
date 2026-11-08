import {useEffect,useRef,useState} from 'react';
import {archiveOldHistoryRecords} from './gateway';
import {oldHistory,historyCutoff} from './history-policy';
export default function HistoryRetention({actor,records,tab}:any){
 const current=useRef(records),running=useRef(false),[notice,setNotice]=useState(''),[error,setError]=useState('');current.current=records;
 useEffect(()=>{if(!actor?.isSuperAdmin)return;let live=true;
  async function sweep(){if(running.current||!current.current.some((r:any)=>oldHistory(r)))return;running.current=true;try{const result=await archiveOldHistoryRecords(current.current);if(live&&result.archived){setError('');setNotice('Đã chuyển '+result.archived+' mục điểm danh/học phí quá 3 tháng vào thùng rác. Các mục này sẽ được giữ thêm 15 ngày.')}}catch(e:any){if(live)setError(e.message)}finally{running.current=false}}
  void sweep();const timer=setInterval(sweep,60*60*1000);window.addEventListener('focus',sweep);return()=>{live=false;clearInterval(timer);window.removeEventListener('focus',sweep)};
 },[actor?.identityId,actor?.isSuperAdmin]);
 if(!['attendance','tuition','reports','trash'].includes(tab)&&!notice&&!error)return null;
 if(!notice&&!error)return <details className="history-retention-note"><summary>Lịch sử giữ trong 3 tháng</summary><p>Giữ tháng hiện tại và 2 tháng trước, từ {historyCutoff().split('-').reverse().join('/')}. Lịch sử cũ vào thùng rác 15 ngày; hồ sơ võ sinh và lớp được giữ nguyên.</p></details>;
 return <div className={'alert '+(error?'warning':'info')} role={error?'alert':'status'}><div>{error||notice||'Chỉ giữ điểm danh và học phí của tháng hiện tại cùng 2 tháng trước (từ '+historyCutoff().split('-').reverse().join('/')+'). Lịch sử cũ chuyển vào thùng rác 15 ngày; hồ sơ võ sinh và lớp vẫn giữ nguyên.'}</div></div>
}
