import { useState, useRef } from 'react';
import { usePotentialStore } from '../../stores/potentialStore';

export default function PotentialImport() {
  const pot = usePotentialStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [view, setView] = useState<'cust'|'user'>('cust');
  const pageSize = 20;

  const data = view === 'cust' ? pot.custRAW : pot.userRAW;
  let filtered = [...data];
  if (search) { const q = search.toLowerCase(); filtered = filtered.filter(r => ((r.product||'').toLowerCase().includes(q)) || ((r.custName||r.userName||'').toLowerCase().includes(q))); }
  filtered.sort((a,b)=>(b.amount||0)-(a.amount||0));
  const paged = filtered.slice((page-1)*pageSize, page*pageSize);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    setMsg('解析中...');
    try { const r = await pot.importExcel(f); setMsg(`✅ 导入完成 — 新增${r.n} / 更新${r.u}`); setPage(1); } catch (err: unknown) { setMsg('❌ ' + (err as Error).message); }
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <div>
      <div style={{display:'flex',gap:12,alignItems:'center',marginBottom:16,flexWrap:'wrap'}}>
        <input type="file" ref={fileRef} accept=".xlsx,.xls" onChange={handleUpload} style={{display:'none'}} />
        <button className="btn-primary" onClick={()=>fileRef.current?.click()} disabled={pot.loading}>{pot.loading?'⏳ 解析中...':'📤 上传潜力产品 Excel'}</button>
        <button className="btn-ghost" style={{color:'#dc2626'}} onClick={()=>{if(confirm('确定清空？'))pot.resetAll();}}>⚠️ 重置全部数据</button>
        <div style={{display:'flex',gap:4,marginLeft:'auto'}}>
          <span className="badge" style={{opacity:view==='cust'?1:.5,background:view==='cust'?'#1a56db':'#dbeafe',color:view==='cust'?'#fff':'#1e40af',cursor:'pointer'}} onClick={()=>setView('cust')}>👥 客户: {pot.custRAW.length}</span>
          <span className="badge" style={{opacity:view==='user'?1:.5,background:view==='user'?'#1a56db':'#dcfce7',color:view==='user'?'#fff':'#166534',cursor:'pointer'}} onClick={()=>setView('user')}>🏢 用户: {pot.userRAW.length}</span>
        </div>
      </div>
      {msg && <div style={{marginBottom:12,padding:'8px 12px',background:'#f0f9ff',border:'1px solid #bae6fd',borderRadius:6,fontSize:13}}>{msg}</div>}
      <div style={{display:'flex',gap:8,marginBottom:12,alignItems:'center'}}>
        <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜索产品/客户..." style={{padding:'6px 10px',border:'1px solid #d1d5db',borderRadius:6,fontSize:12,width:200}} />
        <span style={{fontSize:12,color:'#94a3b8'}}>{filtered.length} 条</span>
      </div>
      <div className="table-wrap" style={{maxHeight:500,overflow:'auto'}}><table className="table"><thead><tr><th>序号</th><th>产品</th><th>客户/用户</th><th>销售</th><th>部门</th><th style={{textAlign:'right'}}>销售额(万)</th><th style={{textAlign:'right'}}>同期</th></tr></thead><tbody>
        {paged.length===0?<tr><td colSpan={7} className="empty-state">{data.length===0?'📭 请上传潜力产品数据文件':'无匹配记录'}</td></tr>:paged.map((r,ri)=><tr key={ri}><td style={{fontSize:11,color:'#94a3b8'}}>{(page-1)*pageSize+ri+1}</td><td><strong>{r.product||'-'}</strong></td><td>{r.custName||r.userName||'-'}</td><td>{r.sales||'-'}</td><td>{r.dept3||r.dept4||'-'}</td><td style={{textAlign:'right',fontWeight:600}}>¥{(r.amount||0).toLocaleString()}</td><td style={{textAlign:'right',color:'#94a3b8'}}>¥{(r.amountPrev||0).toLocaleString()}</td></tr>)}
      </tbody></table></div>
      {pot.history.length > 0 && <div className="card" style={{marginTop:20}}><div className="card-title">📋 导入历史</div><div className="table-wrap" style={{maxHeight:300}}><table className="table"><thead><tr><th>#</th><th>文件</th><th>时间</th><th style={{textAlign:'center'}}>记录数</th><th style={{textAlign:'center'}}>操作</th></tr></thead><tbody>
        {pot.history.map((h,i)=><tr key={h.id}><td>{i+1}</td><td><strong>{h.file}</strong></td><td style={{fontSize:11}}>{h.time}</td><td style={{textAlign:'center',fontWeight:600}}>{h.custCount}</td><td style={{textAlign:'center'}}><button className="btn-ghost" style={{padding:'2px 6px',fontSize:10}} onClick={()=>pot.restoreHistory(i)}>🔄</button><button className="btn-ghost" style={{padding:'2px 6px',fontSize:10,color:'#dc2626'}} onClick={()=>pot.deleteHistory(i)}>✕</button></td></tr>)}
      </tbody></table></div></div>}
    </div>
  );
}
