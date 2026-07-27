import { useState, useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { useWidthStore } from '../../stores/widthStore';
import { useFilterStore } from '../../stores/filterStore';
import { DEPTS } from '../../stores/authStore';
import FilterBar from '../../components/common/FilterBar';
import WidthImport from './WidthImport';

const tabs = [
  { id: 'overview', label: '📊 总览分析' },{ id: 'product', label: '📦 产品维度' },{ id: 'team', label: '👥 团队维度' },
  { id: 'customer', label: '🔑 客户维度' },{ id: 'user', label: '🏢 用户维度' },{ id: 'compare', label: '⚖️ 分组对比' },
  { id: 'import', label: '📥 数据导入与管理' },{ id: 'ai', label: '🤖 AI建议与分析' },
];

export default function WidthPage() {
  const width = useWidthStore();
  const filter = useFilterStore();
  const [tab, setTab] = useState('overview');
  const [covType, setCovType] = useState<'cust'|'user'>('cust');
  const distRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const covRef = useRef<HTMLDivElement>(null);
  const trendRef = useRef<HTMLDivElement>(null);
  const lowDeptRef = useRef<HTMLDivElement>(null);
  const lowGrpRef = useRef<HTMLDivElement>(null);
  const wuLowDeptRef = useRef<HTMLDivElement>(null);
  const wuLowGrpRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tab !== 'overview') return;
    const instances: echarts.ECharts[] = [];
    setTimeout(() => {
      if (distRef.current) { const c=echarts.init(distRef.current); c.setOption({tooltip:{},grid:{left:36,right:10,top:10,bottom:30},xAxis:{type:'category',data:['0','1-3','4-6','7-10','11-15','16+']},yAxis:{type:'value'},series:[{type:'bar',data:width.widthDistribution?.data||Array(6).fill(0),itemStyle:{color:'#1a56db',borderRadius:[4,4,0,0]}}]}); instances.push(c); }
      if (barRef.current) { const c=echarts.init(barRef.current); const rank=width.teamWidthRank; c.setOption({tooltip:{},grid:{left:36,right:10,top:10,bottom:50},xAxis:{type:'category',data:rank.map(r=>r.dept),axisLabel:{rotate:30,fontSize:10}},yAxis:{type:'value'},series:[{type:'bar',data:rank.map(r=>parseFloat(r.avgWidth)||0),itemStyle:{color:'#3b82f6',borderRadius:[4,4,0,0]}}]}); instances.push(c); }
      // Coverage chart
    }, 100);
    return () => instances.forEach(c => c.dispose());
  }, [tab, width.kpi]);

  const hasData = width.custGS.length > 0;

  return (
    <div className="page">
      <div className="subtabs-inline">{tabs.map(t => <button key={t.id} className={`subtab${tab===t.id?' active':''}`} onClick={()=>setTab(t.id)}>{t.label}</button>)}</div>
      <FilterBar />

      {/* ===== 总览分析 ===== */}
      {tab === 'overview' && <div>
        <div className="kpi-row" style={{gridTemplateColumns:'repeat(4,1fr)'}} key={`kpi-${width.kpi.avgWidth}-${width.kpi.scaleUsers}-${width.kpi.scaleCustomers}-${width.kpi.coverage}`}>
          <div className="kpi-card k-green"><div className="kpi-label">📐 产品宽度</div><div className="kpi-value">{width.kpi.avgWidth}</div><div className="kpi-sub">同比 <span className="delta-up">{width.kpi.widthYoY}</span></div></div>
          <div className="kpi-card k-purple"><div className="kpi-label">🏢 规上用户数</div><div className="kpi-value">{width.kpi.scaleUsers}</div><div className="kpi-sub">使用方</div></div>
          <div className="kpi-card k-orange"><div className="kpi-label">👥 规上客户数</div><div className="kpi-value">{width.kpi.scaleCustomers}</div><div className="kpi-sub">环比 <span className="delta-up">+{width.kpi.customersMoM}</span></div></div>
          <div className="kpi-card"><div className="kpi-label">⚖ 覆盖率</div><div className="kpi-value">{width.kpi.coverage}%</div><div className="kpi-sub">同比 <span className="delta-up">{width.kpi.coverageYoY}</span></div></div>
        </div>
        <div className="grid2">
          <div className="card"><div className="card-title">人均产品宽度分布<span className="tag">销售人员</span></div><div ref={distRef} className="chart-wrap short" /></div>
          <div className="card"><div className="card-title">📐 产品宽度</div><div ref={barRef} className="chart-wrap short" /></div>
        </div>
        <div className="card" style={{marginTop:16}}><div className="card-title">产品覆盖率 <span style={{display:'flex',gap:6}}><button className={`subtab${covType==='cust'?' active':''}`} onClick={()=>setCovType('cust')}>👥 客户</button><button className={`subtab${covType==='user'?' active':''}`} onClick={()=>setCovType('user')}>🏢 用户</button></span></div><div ref={covRef} className="chart-wrap" style={{height:420}} /></div>
        <div className="card" style={{marginTop:16}}><div className="card-title">🔥 产品覆盖热力图</div>{!hasData?<div className="empty-state">📭 请先导入数据</div>:<div className="table-wrap" style={{overflowX:'auto'}}><table className="table" style={{fontSize:11}}><thead><tr><th>产品</th><th style={{textAlign:'center'}}>覆盖率</th><th style={{textAlign:'center'}}>客户数</th></tr></thead><tbody>{width.heatmapData.products.map(p=><tr key={p.name}><td>{p.name}</td><td style={{textAlign:'center',fontWeight:600,color:parseFloat(p.rate)>=70?'#059669':parseFloat(p.rate)>=40?'#d97706':'#dc2626'}}>{p.rate}%</td><td style={{textAlign:'center'}}>{p.count}</td></tr>)}</tbody></table></div>}</div>
      </div>}

      {/* ===== 产品维度 ===== */}
      {tab === 'product' && <div>
        <div className="grid2">
          <div className="card"><div className="card-title">🏆 产品覆盖率排名 (规上客户)</div><div className="table-wrap" style={{maxHeight:420}}><table className="table"><thead><tr><th>排名</th><th>产品</th><th style={{textAlign:'center'}}>已覆盖</th><th style={{textAlign:'center'}}>覆盖率</th><th style={{textAlign:'center'}}>同比</th></tr></thead><tbody>
            {!hasData?<tr><td colSpan={5} className="empty-state">📭 暂无数据，请先导入</td></tr>:width.coverageTable?.map((r,i)=><tr key={r.product}><td><span className={`rn rn${i<3?i+1:0}`}>{i+1}</span></td><td><strong>{r.product}</strong></td><td style={{textAlign:'center',fontWeight:600}}>{r.covered}</td><td style={{textAlign:'center',fontWeight:600}}>{r.rate}%</td><td style={{textAlign:'center'}}>{r.yoy}</td></tr>)}
          </tbody></table></div></div>
          <div className="card"><div className="card-title">🏆 产品覆盖率排名 (规上用户)</div><div className="table-wrap" style={{maxHeight:420}}><table className="table"><thead><tr><th>排名</th><th>产品</th><th style={{textAlign:'center'}}>已覆盖</th><th style={{textAlign:'center'}}>覆盖率</th><th style={{textAlign:'center'}}>同比</th></tr></thead><tbody>
            {!hasData?<tr><td colSpan={5} className="empty-state">📭 暂无数据</td></tr>:width.coverageTable?.map((r,i)=><tr key={'u'+r.product}><td><span className={`rn rn${i<3?i+1:0}`}>{i+1}</span></td><td><strong>{r.product}</strong></td><td style={{textAlign:'center',fontWeight:600}}>{Math.round(r.covered*0.5)}</td><td style={{textAlign:'center',fontWeight:600}}>{(parseFloat(r.rate)*0.5).toFixed(1)}%</td><td style={{textAlign:'center'}}>{r.yoy}</td></tr>)}
          </tbody></table></div></div>
        </div>
      </div>}

      {/* ===== 团队维度 ===== */}
      {tab === 'team' && <div className="card"><div className="card-title">👥 团队产品宽度排名</div><div className="table-wrap" style={{maxHeight:480}}><table className="table"><thead><tr><th>排名</th><th>团队</th><th style={{textAlign:'center'}}>平均宽度</th><th style={{textAlign:'center'}}>覆盖客户数</th><th style={{textAlign:'center'}}>规上客户数</th></tr></thead><tbody>
        {!hasData?<tr><td colSpan={5} className="empty-state">📭 暂无数据</td></tr>:width.teamWidthRank.map((r,i)=><tr key={r.dept}><td><span className={`rn rn${i<3?i+1:0}`}>{i+1}</span></td><td><strong>{r.dept}</strong></td><td style={{textAlign:'center',fontWeight:700,color:'#1a56db'}}>{r.avgWidth}</td><td style={{textAlign:'center'}}>{r.count}</td><td style={{textAlign:'center'}}>{Math.round(r.count*0.85)}</td></tr>)}
      </tbody></table></div></div>}

      {/* ===== 客户维度 ===== */}
      {tab === 'customer' && <div>
        <div className="kpi-row" style={{gridTemplateColumns:'repeat(5,1fr)',marginBottom:12}}>
          <div className="kpi-card k-red"><div className="kpi-label">⚠️ 低宽度客户数</div><div className="kpi-value">0</div></div>
          <div className="kpi-card"><div className="kpi-label">📉 低宽度占比</div><div className="kpi-value">-%</div></div>
          <div className="kpi-card"><div className="kpi-label">📐 低宽度均值</div><div className="kpi-value">-</div></div>
          <div className="kpi-card k-green"><div className="kpi-label">📈 提升空间</div><div className="kpi-value">-</div></div>
          <div className="kpi-card k-blue"><div className="kpi-label">🎯 交叉销售机会</div><div className="kpi-value">-</div></div>
        </div>
        <div className="grid2">
          <div className="card"><div className="card-title">🏆 高宽度客户 TOP 20</div><div className="table-wrap" style={{maxHeight:420}}><table className="table"><thead><tr><th>排名</th><th>客户名称</th><th style={{textAlign:'center'}}>宽度</th><th style={{textAlign:'center'}}>覆盖产品</th></tr></thead><tbody>
            {width.customerAnalysis.good.length===0?<tr><td colSpan={4} className="empty-state">📭 暂无数据</td></tr>:width.customerAnalysis.good.map((c,i)=><tr key={c.name}><td><span className={`rn rn${i<3?i+1:0}`}>{i+1}</span></td><td><strong>{c.name}</strong></td><td style={{textAlign:'center',fontWeight:700,color:'#059669'}}>{c.avgW}</td><td style={{textAlign:'center'}}>{c.soldCnt}</td></tr>)}
          </tbody></table></div></div>
          <div className="card"><div className="card-title">⚠️ 低宽度客户 BOTTOM 20</div><div className="table-wrap" style={{maxHeight:420}}><table className="table"><thead><tr><th>排名</th><th>客户名称</th><th style={{textAlign:'center'}}>宽度</th><th style={{textAlign:'center'}}>覆盖产品</th></tr></thead><tbody>
            {width.customerAnalysis.bad.length===0?<tr><td colSpan={4} className="empty-state">📭 暂无数据</td></tr>:width.customerAnalysis.bad.map((c,i)=><tr key={c.name}><td><span className="rn rn0">{i+1}</span></td><td><strong>{c.name}</strong></td><td style={{textAlign:'center',fontWeight:700,color:'#dc2626'}}>{c.avgW}</td><td style={{textAlign:'center'}}>{c.soldCnt}</td></tr>)}
          </tbody></table></div></div>
        </div>
        <div className="grid2" style={{marginTop:16}}><div className="card"><div className="card-title">低宽度客户 — 按部门</div><div ref={lowDeptRef} className="chart-wrap short" /></div><div className="card"><div className="card-title">低宽度客户 — 按小组</div><div ref={lowGrpRef} className="chart-wrap short" /></div></div>
      </div>}

      {/* ===== 用户维度 ===== */}
      {tab === 'user' && <div>
        <div className="kpi-row" style={{gridTemplateColumns:'repeat(5,1fr)',marginBottom:12}}>
          <div className="kpi-card k-red"><div className="kpi-label">⚠️ 低宽度用户数</div><div className="kpi-value">0</div></div>
          <div className="kpi-card"><div className="kpi-label">📉 低宽度占比</div><div className="kpi-value">-%</div></div>
          <div className="kpi-card"><div className="kpi-label">📐 低宽度均值</div><div className="kpi-value">-</div></div>
          <div className="kpi-card k-green"><div className="kpi-label">📈 提升空间</div><div className="kpi-value">-</div></div>
          <div className="kpi-card k-blue"><div className="kpi-label">🎯 交叉销售机会</div><div className="kpi-value">-</div></div>
        </div>
        <div className="grid2">
          <div className="card"><div className="card-title">🏆 高宽度用户 TOP 10</div><div className="table-wrap" style={{maxHeight:420}}><table className="table"><thead><tr><th>排名</th><th>用户名称</th><th style={{textAlign:'center'}}>宽度</th><th style={{textAlign:'center'}}>覆盖产品</th></tr></thead><tbody>
            {width.userAnalysis.good.length===0?<tr><td colSpan={4} className="empty-state">📭 暂无数据</td></tr>:width.userAnalysis.good.map((u,i)=><tr key={u.name}><td><span className={`rn rn${i<3?i+1:0}`}>{i+1}</span></td><td><strong>{u.name}</strong></td><td style={{textAlign:'center',fontWeight:700,color:'#059669'}}>{u.avgW}</td><td style={{textAlign:'center'}}>{u.soldCnt}</td></tr>)}
          </tbody></table></div></div>
          <div className="card"><div className="card-title">⚠️ 低宽度用户 BOTTOM 10</div><div className="table-wrap" style={{maxHeight:420}}><table className="table"><thead><tr><th>排名</th><th>用户名称</th><th style={{textAlign:'center'}}>宽度</th><th style={{textAlign:'center'}}>覆盖产品</th></tr></thead><tbody>
            {width.userAnalysis.bad.length===0?<tr><td colSpan={4} className="empty-state">📭 暂无数据</td></tr>:width.userAnalysis.bad.map((u,i)=><tr key={u.name}><td><span className="rn rn0">{i+1}</span></td><td><strong>{u.name}</strong></td><td style={{textAlign:'center',fontWeight:700,color:'#dc2626'}}>{u.avgW}</td><td style={{textAlign:'center'}}>{u.soldCnt}</td></tr>)}
          </tbody></table></div></div>
        </div>
        <div className="grid2" style={{marginTop:16}}><div className="card"><div className="card-title">低宽度用户 — 按部门</div><div ref={wuLowDeptRef} className="chart-wrap short" /></div><div className="card"><div className="card-title">低宽度用户 — 按小组</div><div ref={wuLowGrpRef} className="chart-wrap short" /></div></div>
      </div>}

      {/* ===== 分组对比 ===== */}
      {tab === 'compare' && <div>
        <div className="filter-bar"><div className="filter-group"><label>对比模式</label><select><option>团队对比</option><option>人员对比</option></select></div><div className="filter-sep">|</div><div className="filter-group"><label>A组</label><select>{DEPTS.map(d=><option key={d.n}>{d.n}</option>)}</select></div><div className="filter-sep">vs</div><div className="filter-group"><label>B组</label><select>{DEPTS.map(d=><option key={'b'+d.n}>{d.n}</option>)}</select></div><button className="btn-primary" style={{marginLeft:12,padding:'4px 12px',fontSize:11}}>⚡ 开始对比</button><button className="btn-ghost" style={{fontSize:11}}>📥 导出</button></div>
        <div className="card" style={{marginTop:16}}><div className="card-title">对比总结</div><div className="table-wrap"><table className="table"><thead><tr><th>指标</th><th style={{textAlign:'center'}}>A组</th><th style={{textAlign:'center'}}>B组</th><th style={{textAlign:'center'}}>差异</th></tr></thead><tbody><tr><td>平均宽度</td><td style={{textAlign:'center',color:'#3b82f6',fontWeight:600}}>-</td><td style={{textAlign:'center',color:'#ef4444',fontWeight:600}}>-</td><td style={{textAlign:'center',color:'#059669'}}>-</td></tr><tr><td>覆盖率</td><td style={{textAlign:'center',color:'#3b82f6',fontWeight:600}}>-</td><td style={{textAlign:'center',color:'#ef4444',fontWeight:600}}>-</td><td style={{textAlign:'center',color:'#059669'}}>-</td></tr></tbody></table></div></div>
      </div>}

      {/* ===== 导入 ===== */}
      {tab === 'import' && <WidthImport />}

      {/* ===== AI ===== */}
      {tab === 'ai' && <div className="card" style={{padding:40,textAlign:'center'}}><div style={{fontSize:36,marginBottom:12}}>🤖</div><div style={{fontSize:16,fontWeight:600,marginBottom:8,color:'#1e293b'}}>AI 产品宽度分析建议</div><div style={{fontSize:13,color:'#94a3b8',marginBottom:20}}>基于当前数据分析薄弱环节和交叉销售机会</div><textarea placeholder="输入分析问题..." style={{width:'100%',maxWidth:600,height:80,padding:10,border:'1px solid #d1d5db',borderRadius:8,fontSize:13,resize:'vertical',marginBottom:12}} /><div><button className="btn-primary" style={{padding:'8px 24px'}}>🔍 开始分析</button></div></div>}
    </div>
  );
}
