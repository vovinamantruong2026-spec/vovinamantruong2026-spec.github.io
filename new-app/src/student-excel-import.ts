import {duplicateStudents} from './student-duplicates';
import {SELF_DEFENSE_BELT, VOVINAM_BELTS} from './vovinam';

export const importColumns = {
 code: 'Mã võ sinh', name: 'Họ và tên', classId: 'Mã lớp', className: 'Lớp',
 dob: 'Ngày sinh', belt: 'Cấp đai', phone: 'Điện thoại', parent: 'Phụ huynh', address: 'Địa chỉ',
};
type Column = keyof typeof importColumns;
type Row = Partial<Record<Column,string>> & {row: number};
type RecordRow = {kind: string; id: string; data: any; version: number};
export type ImportItem = {
 row: number; name: string; error?: string;
 write?: {id: string; data: any; version: number};
};
const textKey = (value: string) => value.trim().normalize('NFC').toLocaleLowerCase('vi');
const headers = new Map<string, Column>(Object.entries(importColumns).map(([key, label]) => [textKey(label), key as Column]));
headers.set('lớp học', 'className');
headers.set('số điện thoại', 'phone');
export const studentImportLimit = 200;

export async function readStudentExcel(file: Pick<File,'name'|'size'|'arrayBuffer'>): Promise<Row[]> {
 if (!/\.xlsx$/i.test(file.name) || file.size > 8 * 1024 * 1024) throw new Error('Chọn tệp .xlsx tối đa 8 MB.');
 const {default: ExcelJS} = await import('exceljs');
 const book = new ExcelJS.Workbook();
 await book.xlsx.load(await file.arrayBuffer() as Parameters<typeof book.xlsx.load>[0]);
 const sheet = book.getWorksheet('Võ sinh') ?? book.worksheets[0];
 if (!sheet) throw new Error('Tệp Excel chưa có bảng dữ liệu.');
 const columns = new Map<number, Column>();
 sheet.getRow(1).eachCell((cell, index) => {
  const column = headers.get(textKey(cell.text));
  if (!column) return;
  if ([...columns.values()].includes(column)) throw new Error('Cột bị lặp: ' + cell.text);
  columns.set(index, column);
 });
 const found = [...columns.values()];
 if (!found.includes('name') || (!found.includes('className') && !found.includes('classId'))) throw new Error('Thiếu cột Họ và tên hoặc Lớp / Mã lớp. Hãy tải mẫu Excel.');
 const rows: Row[] = [];
 sheet.eachRow((row, index) => {
  if (index === 1) return;
  const data: Row = {row: index};
  for (const [position, key] of columns) {
   const cell = row.getCell(position);
   if (cell.formula || cell.type === ExcelJS.ValueType.Formula) throw new Error('Dòng '+index+' có công thức. Hãy dán giá trị vào tệp rồi nhập lại.');
   data[key] = cell.value instanceof Date ? cell.value.toISOString().slice(0,10) : cell.text.trim();
  }
  if (Object.values(data).some(value => typeof value === 'string' && value)) rows.push(data);
  if (rows.length > studentImportLimit) throw new Error('Tệp chỉ được có tối đa '+studentImportLimit+' dòng võ sinh.');
 });
 if (!rows.length) throw new Error('Tệp chưa có dòng võ sinh.');
 return rows;
}

export function previewStudentExcel(rows: Row[], records: RecordRow[], classes: RecordRow[], today: string): ImportItem[] {
 const students = records.filter(r => r.kind === 'student' && !r.data.deleted && classes.some(c => c.id === r.data.classId));
 const seen = new Set<string>();
 const staged: RecordRow[] = [];
 return rows.map(row => {
  const name = row.name?.trim().replace(/\s+/g,' ') || '';
  const fail = (error: string) => ({row: row.row, name, error});
  if (!name || name.length > 200) return fail('Họ và tên bắt buộc, tối đa 200 ký tự.');
  const targets = classes.filter(c => row.classId ? textKey(c.id) === textKey(row.classId) :
   !!row.className && textKey(c.data.name ?? '') === textKey(row.className));
  if (targets.length !== 1) return fail('Lớp không xác định trong phạm vi quản lý. Hãy điền mã lớp.');
  const target = targets[0];
  const matches = row.code ? students.filter(s => textKey(String(s.data.id ?? '')) === textKey(row.code!)) : [];
  if (row.code && matches.length !== 1) return fail('Không tìm thấy một hồ sơ duy nhất theo mã trong các lớp được cấp.');
  const current = matches[0];
  if (current && seen.has(current.id)) return fail('Mã võ sinh xuất hiện nhiều lần trong tệp.');
  const id = current?.id ?? crypto.randomUUID();
  const data = {...(current?.data ?? {id:'',type:'official',enrollmentStatus:'active',belt:SELF_DEFENSE_BELT,joinDate:today}),
   name, classId:target.id, className:target.data.name};
  if (row.dob && row.dob !== data.dob) {
   const local = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(row.dob);
   const iso = local ? local[3]+'-'+local[2].padStart(2,'0')+'-'+local[1].padStart(2,'0') : row.dob;
   const date = new Date(iso);
   if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== iso || iso > today) {
    return fail('Ngày sinh phải hợp lệ theo YYYY-MM-DD hoặc DD/MM/YYYY.');
   }
   data.dob = iso;
  }
  if (row.belt && row.belt !== data.belt) {
   const belt = VOVINAM_BELTS.find(label => textKey(label) === textKey(row.belt!));
   if (!belt) return fail('Cấp đai chưa có trong danh mục của CLB.');
   data.belt = belt;
  }
  for (const key of ['phone','parent','address'] as const) {
   const value = row[key];
   if (value && value.length > 200) return fail(importColumns[key]+' vượt 200 ký tự.');
   if (value) data[key] = value;
  }
  const alreadyDuplicate = current && duplicateStudents(students,current.data,id).some(r => duplicateStudents(students,data,id).includes(r));
  if ((!alreadyDuplicate && duplicateStudents(students,data,id).length) || duplicateStudents(staged,data,id).length) {
   return fail('Trùng họ tên và năm sinh. Kiểm tra lại hồ sơ trước khi nhập.');
  }
  seen.add(id);
  staged.push({kind:'student',id,data,version:current?.version ?? 0});
  return {row:row.row,name,write:{id,data,version:current?.version ?? 0}};
 });
}
