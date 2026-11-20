import {useRef, useState} from 'react';
import {Upload} from 'lucide-react';
import {createWorkbook, saveDownload} from './xlsx-export';
import {importColumns, previewStudentExcel, readStudentExcel, type ImportItem} from './student-excel-import';

type Props = {
 records: Parameters<typeof previewStudentExcel>[1];
 classes: Parameters<typeof previewStudentExcel>[2];
 today: string;
 busy: boolean;
 onBusy: (value: boolean) => void;
 onSave: (write: NonNullable<ImportItem['write']>) => Promise<void>;
};

export default function StudentExcelImport({records, classes, today, busy, onBusy, onSave}: Props) {
 const [open, setOpen] = useState(false);
 const [working, setWorking] = useState(false);
 const [error, setError] = useState('');
 const [items, setItems] = useState<ImportItem[] | null>(null);
 const [results, setResults] = useState<Record<number,string | null>>({});
 const locked = useRef(false);

 async function run(action: () => Promise<void>) {
  if (locked.current || busy) return;
  locked.current = true;
  setWorking(true);
  setError('');
  try { await action(); }
  catch (e) { setError(e instanceof Error ? e.message : 'Không xử lý được tệp Excel.'); }
  finally { locked.current = false; setWorking(false); }
 }

 function template() {
  void run(async () => {
   const {className, ...columns} = importColumns;
   const file = await createWorkbook([
    {name:'Võ sinh',headers:Object.values(columns),rows:[]},
    {name:'Mã lớp',headers:['Mã lớp','Tên lớp'],rows:classes.map(c => [c.id,c.data.name])},
   ]);
   saveDownload(file,'Mau_nhap_vo_sinh.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  });
 }

 function choose(file?: File) {
  if (!file) return;
  void run(async () => {
   setItems(null);
   setResults({});
   const rows = await readStudentExcel(file);
   setItems(previewStudentExcel(rows, records, classes, today));
  });
 }

 function save() {
  if (!items || items.some(item => !item.write) || Object.keys(results).length) return;
  void run(async () => {
   onBusy(true);
   try {
    for (const item of items) {
     let error = null;
     try { await onSave(item.write!); }
     catch (e) { error = e instanceof Error ? e.message : 'Chưa xác nhận được kết quả lưu.'; }
     setResults(previous => ({...previous,[item.row]:error}));
    }
   } finally { onBusy(false); }
  });
 }

 const complete = items && Object.keys(results).length === items.length;
 return <>
  <button className="primary" disabled={busy} aria-expanded={open} onClick={() => setOpen(value => !value)}>
   <Upload size={16}/> Nhập từ Excel
  </button>
  {open && <section className="panel student-excel-panel" aria-label="Nhập võ sinh từ Excel">
   <div className="panel-heading"><div><h2>Nhập võ sinh từ Excel</h2>
    <p>Để trống mã võ sinh khi thêm mới. Điền mã hiện có để cập nhật. Mỗi tệp tối đa 200 dòng.</p>
   </div></div>
   <div className="student-excel-body">
    <div className="student-excel-controls">
     <button className="secondary" disabled={busy || working} onClick={template}>Tải mẫu Excel</button>
     <label>Chọn tệp .xlsx <input type="file" accept=".xlsx" disabled={busy || working} onChange={event => {
      choose(event.currentTarget.files?.[0]);
      event.currentTarget.value = '';
     }}/></label>
    </div>
    {error && <p role="alert">{error}</p>}
    {items && <><div className="table-wrap"><table>
     <thead><tr><th>Dòng Excel</th><th>Võ sinh</th><th>Kết quả</th></tr></thead>
     <tbody>{items.map(item => <tr key={item.row}><td>{item.row}</td><td>{item.name || '—'}</td>
      <td>{item.row in results ? results[item.row] ?? 'Đã lưu' : item.error || (item.write?.version ? 'Cập nhật' : 'Thêm mới')}</td></tr>)}</tbody>
    </table></div>
    {!complete && <button className="primary" disabled={busy || working || items.some(item => !item.write)} onClick={save}>Xác nhận nhập</button>}
    {complete && <p role="status">Đã xác nhận lưu {Object.values(results).filter(result => result === null).length}/{items.length} hồ sơ. Kiểm tra danh sách trước khi nhập lại các dòng chưa xác nhận.</p>}
    </>}
    {working && <p role="status">{busy ? 'Đang lưu từng hồ sơ…' : 'Đang xử lý Excel…'}</p>}
   </div>
  </section>}
 </>;
}
