import { useState, useRef } from 'react';
import { useWidthStore } from '../../stores/widthStore';

export default function WidthImport() {
  const width = useWidthStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('width_desc');
  const [page, setPage] = useState(1);
  const [view, setView] = useState<'user'|'cust'>('user');
  const pageSize = 20;

  const data = view === 'user' ? width.userGS : width.custGS;
  let filtered = [...data];
  if (search) { const q = search.toLowerCase(); filtered = filtered.filter(r => ((r.user||r.name||'').toLowerCase().includes(q)) || ((r.sales||'').toLowerCase().includes(q))); }
  if (sort === 'width_desc') filtered.sort((a,b) => (b.width||0)-(a.width||0));
  else filtered.sort((a,b) => (a.width||0)-(b.width||0));
  const total = filtered.length;
  const paged = filtered.slice((page-1)*pageSize, page*pageSize);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    setMsg('解析中...');
    try { const r = await width.importExcel(f); setMsg(`✅ 导入完成 — 用户${r.nu} / 客户${r.nc}`); setPage(1); } catch (err: unknown) { setMsg('❌ ' + (err as Error).message); }
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <div>
      <div style={{display:'flex',gap:12,alignItems:'center',marginBottom:16,flexWrap:'wrap'}}>
        <input type="file" ref={fileRef} accept=".xlsx,.xls" onChange={handleUpload} style={{display:'none'}} />
        <button className="btn-primary" onClick={()=>fileRef.current?.click()} disabled={width.loading}>{width.loading?'⏳ 解析中...':'📤 上传 Excel'}</button>
        <button className="btn-ghost" style={{color:'#dc2626'}} onClick={()=>{if(confirm('确定清空？'))width.resetAll();}}>⚠️ 重置全部数据</button>
        <div style={{display:'flex',gap:4,marginLeft:'auto'}}>
          <span className="badge" style={{opacity:view==='user'?1:.5,background:view==='user'?'#1a56db':'#dbeafe',color:view==='user'?'#fff':'#1e40af',cursor:'pointer'}} onClick={()=>setView('user')}>🏢 用户: {width.userGS.length}</span>
          <span className="badge" style={{opacity:view==='cust'?1:.5,background:view==='cust'?'#1a56db':'#dcfce7',color:view==='cust'?'#fff':'#166534',cursor:'pointer'}} onClick={()=>setView('cust')}>👥 客户: {width.custGS.length}</span>
        </div>
      </div>
      {msg && <div style={{marginBottom:12,padding:'8px 12px',background:'#f0f9ff',border:'1px solid #bae6fd',borderRadius:6,fontSize:13}}>{msg}</div>}
      <div style={{display:'flex',gap:8,marginBottom:12,alignItems:'center'}}>
        <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜索..." style={{padding:'6px 10px',border:'1px solid #d1d5db',borderRadius:6,fontSize:12,width:180}} />
        <select value={sort} onChange={e=>setSort(e.target.value)} style={{padding:'6px 10px',border:'1px solid #d1d5db',borderRadius:6,fontSize:12}}><option value="width_desc">宽度 ↓</option><option value="width_asc">宽度 ↑</option></select>
        <span style={{fontSize:12,color:'#94a3b8'}}>{total} 条</span>
      </div>
      <div className="table-wrap" style={{maxHeight:500,overflow:'auto'}}><table className="table"><thead><tr><th style={{width:44}}>序号</th><th>{view==='user'?'最终用户':'客户名称'}</th><th>销售</th><th>部门</th><th style={{textAlign:'center'}}>规上</th><th style={{textAlign:'center'}}>宽度</th></tr></thead><tbody>
        {paged.length===0?<tr><td colSpan={6} className="empty-state">{data.length===0?'📭 请上传总表文件':'无匹配记录'}</td></tr>:paged.map((r,ri)=><tr key={r.user||r.name}><td style={{textAlign:'center',fontSize:11,color:'#94a3b8'}}>{(page-1)*pageSize+ri+1}</td><td><strong>{view==='user'?r.user:r.name}</strong></td><td>{r.sales||'-'}</td><td>{r.dept||'-'}</td><td style={{textAlign:'center'}}><span className="badge badge-on">{r.guishang||'是'}</span></td><td style={{textAlign:'center',fontWeight:700,color:'#2563eb'}}>{r.width}</td></tr>)}
      </tbody></table></div>
      {width.history.length > 0 && <div className="card" style={{marginTop:20}}><div className="card-title">📋 导入历史</div><div className="table-wrap" style={{maxHeight:300}}><table className="table"><thead><tr><th>#</th><th>文件</th><th>时间</th><th style={{textAlign:'center'}}>用户</th><th style={{textAlign:'center'}}>客户</th><th style={{textAlign:'center'}}>操作</th></tr></thead><tbody>
        {width.history.map((h,i)=><tr key={h.id}><td>{i+1}</td><td><strong>{h.file}</strong></td><td style={{fontSize:11}}>{h.time}</td><td style={{textAlign:'center',color:'#1e40af',fontWeight:600}}>{h.userCount}</td><td style={{textAlign:'center',color:'#166534',fontWeight:600}}>{h.custCount}</td><td style={{textAlign:'center'}}><button className="btn-ghost" style={{padding:'2px 6px',fontSize:10}} onClick={()=>width.restoreHistory(i)}>🔄</button><button className="btn-ghost" style={{padding:'2px 6px',fontSize:10,color:'#dc2626'}} onClick={()=>width.deleteHistory(i)}>✕</button></td></tr>)}
      </tbody></table></div></div>}
    </div>
  );
}
