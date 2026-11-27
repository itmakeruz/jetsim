const fs=require('node:fs/promises');
const path=require('node:path');
(async()=>{
 const source=path.resolve('uploads/qr'), destination=path.resolve('private/qr');
 await fs.mkdir(destination,{recursive:true,mode:0o700});
 let entries; try { entries=await fs.readdir(source,{withFileTypes:true}); } catch(e) { if(e.code==='ENOENT') return; throw e; }
 let moved=0;
 for(const entry of entries){
  if(!entry.isFile() || !/^qr_content_\d+\.png$/.test(entry.name)) throw new Error('Unexpected entry: review QR directory manually');
  const from=path.join(source,entry.name),to=path.join(destination,entry.name);
  try { await fs.copyFile(from,to,require('node:fs').constants.COPYFILE_EXCL); }
  catch(e){ if(e.code!=='EEXIST') throw e; const [a,b]=await Promise.all([fs.readFile(from),fs.readFile(to)]); if(!a.equals(b)) throw new Error('QR file conflict'); }
  await fs.chmod(to,0o600); await fs.unlink(from); moved++;
 }
 await fs.rmdir(source); console.log({moved});
})().catch(()=>{console.error('QR migration stopped; inspect protected storage before retry');process.exitCode=1;});
