import {recoveryPlan} from './recovery-plan';
export const PACKAGE_LIMIT=200*1024*1024;
const decoder=new TextDecoder(),encoder=new TextEncoder();
export async function sha256(data:Uint8Array){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(data)))).map(v=>v.toString(16).padStart(2,'0')).join('')}
export function attachedFiles(source:any){return (source.records||[]).filter((r:any)=>r.kind==='student').flatMap((r:any)=>[r.data.avatarFile,...(r.data.studentFiles||[])].filter(Boolean).map((file:any)=>({studentId:r.id,file,path:'files/'+r.id+'/'+file.id})));}
// Inspect central-directory sizes before asking JSZip to inflate uploaded content.
export function inspectZip(bytes:Uint8Array){
 if(bytes.byteLength>PACKAGE_LIMIT||bytes.byteLength<22)throw new Error('ZIP trống hoặc vượt quá 200 MB.');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let end=-1;
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(view.getUint32(i,true)===0x06054b50&&i+22+view.getUint16(i+20,true)===bytes.length){end=i;break}
 if(end<0||view.getUint16(end+4,true)!==0||view.getUint16(end+6,true)!==0)throw new Error('ZIP không hợp lệ hoặc gồm nhiều phần.');
 const count=view.getUint16(end+10,true),size=view.getUint32(end+12,true);let pos=view.getUint32(end+16,true),total=0;const start=pos,names=new Set<string>();
 if(count>3000||count===65535||pos+size!==end)throw new Error('ZIP quá nhiều tệp hoặc dùng định dạng không hỗ trợ.');
 for(let i=0;i<count;i++){
  if(pos+46>end||view.getUint32(pos,true)!==0x02014b50)throw new Error('Danh mục ZIP hỏng.');
  const flags=view.getUint16(pos+8,true),method=view.getUint16(pos+10,true),raw=view.getUint32(pos+24,true),nameLen=view.getUint16(pos+28,true),extra=view.getUint16(pos+30,true),comment=view.getUint16(pos+32,true);
  if(pos+46+nameLen+extra+comment>end||flags&1||![0,8].includes(method)||raw>20*1024*1024)throw new Error('ZIP có tệp quá lớn hoặc mã hóa không hỗ trợ.');
  const name=decoder.decode(bytes.subarray(pos+46,pos+46+nameLen));
  if(!name||name.startsWith('/')||name.includes('\\')||name.split('/').some(v=>v==='..'||v==='.')||names.has(name))throw new Error('ZIP có đường dẫn không an toàn hoặc trùng lặp.');
  names.add(name);total+=raw;if(total>PACKAGE_LIMIT)throw new Error('Dữ liệu giải nén vượt quá 200 MB.');pos+=46+nameLen+extra+comment;
 }if(pos!==start+size)throw new Error('Danh mục ZIP không khớp.');return {total,names};
}
function validAttachment(entry:any){return typeof entry.studentId==='string'&&entry.studentId.length>0&&!/[\/\\\u0000-\u001f]/.test(entry.studentId)&&/^[a-f0-9-]{36}$/.test(entry.file?.id)&&['avatar','cccd-front','cccd-back','certificate'].includes(entry.file.category)&&['image/jpeg','image/png','image/webp','application/pdf'].includes(entry.file.mime)&&Number.isInteger(entry.file.bytes)&&entry.file.bytes>0&&entry.file.bytes<=5*1024*1024;}
export async function buildBackupPackage(source:any,fetchFile:(studentId:string,id:string)=>Promise<Blob>,onProgress:(s:string)=>void=()=>{}){
 recoveryPlan(source);const {default:JSZip}=await import('jszip');const zip=new JSZip(),data=encoder.encode(JSON.stringify(source)),files=attachedFiles(source),manifest:any={format:'antruong-package-v1',createdAt:new Date().toISOString(),data:{path:'data.json',bytes:data.length,sha256:await sha256(data)},files:[]};
 if(data.length>20*1024*1024)throw new Error('Dữ liệu JSON vượt quá 20 MB, cần chia nhỏ trước khi tạo bản đầy đủ.');
 let total=data.length;zip.file('data.json',data);const seen=new Set<string>();
 for(const [index,entry] of files.entries()){
  if(!validAttachment(entry)||seen.has(entry.path))throw new Error('Liên kết tệp trong hồ sơ không hợp lệ hoặc bị trùng.');seen.add(entry.path);
  onProgress('Đang tải tệp '+(index+1)+' / '+files.length);const bytes=new Uint8Array(await (await fetchFile(entry.studentId,entry.file.id)).arrayBuffer());
  if(bytes.length!==entry.file.bytes)throw new Error('Dung lượng tệp không khớp hồ sơ: '+entry.studentId);total+=bytes.length;if(total>PACKAGE_LIMIT-1024*1024)throw new Error('Bản đầy đủ vượt quá 200 MB. Cần chia nhỏ kho trước khi xuất.');
  zip.file(entry.path,bytes);manifest.files.push({path:entry.path,studentId:entry.studentId,id:entry.file.id,category:entry.file.category,mime:entry.file.mime,bytes:bytes.length,sha256:await sha256(bytes)});
 }
 zip.file('manifest.json',JSON.stringify(manifest));zip.file('README.txt','Bản sao CLB gồm dữ liệu và tệp giấy tờ riêng tư. Giữ ở nơi an toàn. Mở mục Cài đặt & sao lưu > Bản sao đầy đủ để kiểm tra khôi phục cục bộ. Không có mật khẩu Firebase.');
 return {bytes:await zip.generateAsync({type:'uint8array',compression:'STORE'}),manifest};
}
async function readBounded(member:any,limit:number):Promise<Uint8Array>{
 return new Promise((resolve,reject)=>{const chunks:Uint8Array[]=[];let size=0,failed=false;const stream=member.internalStream('uint8array');
  stream.on('data',(chunk:Uint8Array)=>{if(failed)return;size+=chunk.length;if(size>limit){failed=true;stream.pause();chunks.length=0;reject(new Error('Tệp giải nén vượt quá kích thước được phép.'));return}chunks.push(chunk)}).on('error',(e:any)=>{failed=true;chunks.length=0;reject(e)}).on('end',()=>{if(failed)return;const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}resolve(bytes)}).resume();
 });
}
export async function rehearseBackupPackage(bytes:Uint8Array){
 const inspected=inspectZip(bytes),{default:JSZip}=await import('jszip'),zip=await JSZip.loadAsync(bytes);const manifestFile=zip.file('manifest.json'),dataFile=zip.file('data.json');
 if(!manifestFile||!dataFile)throw new Error('Thiếu manifest hoặc dữ liệu JSON.');const manifest=JSON.parse(decoder.decode(await readBounded(manifestFile,1024*1024)));
 if(manifest.format!=='antruong-package-v1'||manifest.data?.path!=='data.json'||!Array.isArray(manifest.files)||manifest.files.length>3000)throw new Error('Định dạng bản đầy đủ không hợp lệ.');
 const data=await readBounded(dataFile,Math.min(Number(manifest.data.bytes)||0,20*1024*1024));if(data.length!==manifest.data.bytes||await sha256(data)!==manifest.data.sha256)throw new Error('Dữ liệu JSON hỏng hoặc đã bị thay đổi.');
 const source=JSON.parse(decoder.decode(data)),plan=recoveryPlan(source),expected=attachedFiles(source),paths=new Set<string>();
 if(expected.length!==manifest.files.length)throw new Error('Số tệp không khớp hồ sơ.');
 const restored=new Map<string,Uint8Array>();
 for(const file of manifest.files){
  const entry=expected.find((e:any)=>e.path===file.path);if(!entry||!validAttachment(entry)||paths.has(file.path)||file.id!==entry.file.id||file.studentId!==entry.studentId||file.category!==entry.file.category||file.mime!==entry.file.mime||file.bytes!==entry.file.bytes)throw new Error('Thông tin tệp không khớp dữ liệu.');paths.add(file.path);
  const member=zip.file(file.path);if(!member)throw new Error('Bản sao thiếu tệp giấy tờ hoặc ảnh.');const binary=await readBounded(member,Math.min(Number(file.bytes)||0,5*1024*1024));
  if(binary.length!==file.bytes||await sha256(binary)!==file.sha256)throw new Error('Tệp ảnh hoặc giấy tờ bị hỏng.');restored.set(file.path,binary);
 }
 if([...inspected.names].some(name=>!name.endsWith('/')&&!['manifest.json','data.json','README.txt'].includes(name)&&!paths.has(name)))throw new Error('ZIP chứa tệp không thuộc bản sao.');
 // Reconstruct records and binary objects in an isolated in-memory destination.
 const sandbox={records:structuredClone(plan.rows),members:structuredClone(plan.members),profiles:structuredClone(plan.profiles),files:restored};
 return {source,plan,sandbox,summary:{students:plan.counts.students,classes:plan.counts.classes,records:sandbox.records.length,files:restored.size,bytes:inspected.total,verifiedAt:new Date().toISOString(),hash:await sha256(bytes)}};
}
