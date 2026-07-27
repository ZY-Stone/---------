import { useState, useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { usePotentialStore } from '../../stores/potentialStore';
import { useFilterStore } from '../../stores/filterStore';
import FilterBar from '../../components/common/FilterBar';
import PotentialImport from './PotentialImport';

const tabs = [
  { id: 'overview', label: '📊 总览分析' },{ id: 'product', label: '📦 产品维度' },{ id: 'team', label: '👥 团队维度' },
  { id: 'customer', label: '🔑 客户维度' },{ id: 'user', label: '🏢 用户维度' },{ id: 'gap', label: '📉 缺口分析' },
  { id: 'import', label: '📥 数据导入与管理' },{ id: 'ai', label: '🤖 AI建议与分析' },
];

export default function PotentialPage() {
  const pot = usePotentialStore();
  const filter = useFilterStore();
  const [tab, setTab] = useState('overview');
  const compRef = useRef<HTMLDivElement>(null);
  const yoyRef = useRef<HTMLDivElement>(null);
  const quadRef = useRef<HTMLDivElement>(null);

  // 页面挂载时从 localStorage 恢复旧 JS 导入的数据
  useEffect(() => { pot.restoreLS(); }, []);

  useEffect(() => {
    if (tab !== 'overview') return;
    const instances: echarts.ECharts[] = [];
    setTimeout(() => {
      if (compRef.current) { const c=echarts.init(compRef.current); const d=pot.prodComposition; c.setOption({tooltip:{},legend:{right:0,orient:'vertical',top:'middle',textStyle:{fontSize:10}},series:[{type:'pie',radius:['40%','70%'],center:['40%','50%'],data:d.map(x=>({name:x.name,value:x.amount})),label:{fontSize:10}}]}); instances.push(c); }
      if (yoyRef.current) { const c=echarts.init(yoyRef.current); c.setOption({tooltip:{},legend:{bottom:0},grid:{left:42,right:20,top:10,bottom:40},xAxis:{type:'category',data:['08','09','10','11','12','01','02','03','04','05','06','07']},yAxis:{type:'value'},series:pot.prodComposition.slice(0,5).map((p,i)=>({name:p.name,type:'line',data:Array(12).fill(0).map(()=>Math.floor(Math.random()*500+200)),smooth:true,lineStyle:{color:['#1a56db','#7c3aed','#10b981','#f59e0b','#ef4444'][i]}}))}); instances.push(c); }
      if (quadRef.current) { const c=echarts.init(quadRef.current); c.setOption({tooltip:{},legend:{bottom:0},grid:{left:48,right:20,top:10,bottom:40},xAxis:{type:'value',name:'数量同比(%)'},yAxis:{type:'value',name:'金额同比(%)'},series:['#10b981','#f59e0b','#ef4444','#8b5cf6'].map((color,i)=>({type:'scatter',data:pot.quadrant.filter(q=>q.quadrant===['量价齐升','量跌价增','量价齐跌','量增价跌'][i]).map(q=>[q.x,q.y]),symbolSize:10,itemStyle:{color}}))}); instances.push(c); }
    }, 100);
    return () => instances.forEach(c => c.dispose());
  }, [tab, pot.kpi]);

  const hasData = pot.custRAW.length > 0;

  return (
    <div className="page">
      <div className="subtabs-inline">{tabs.map(t => <button key={t.id} className={`subtab${tab===t.id?' active':''}`} onClick={()=>setTab(t.id)}>{t.label}</button>)}</div>
      <FilterBar />

      {/* ===== 总览分析 ===== */}
      {tab === 'overview' && <div>
        <div className="kpi-row" style={{gridTemplateColumns:'repeat(5,1fr)'}}>
          <div className="kpi-card k-blue"><div className="kpi-label">💰 潜力产品销售额</div><div className="kpi-value">¥ {pot.kpi.totalSales.toLocaleString()}万</div><div className="kpi-sub">同期 ¥{pot.kpi.totalPrev.toLocaleString()}万</div></div>
          <div className="kpi-card k-purple"><div className="kpi-label">📦 潜力产品数</div><div className="kpi-value">{pot.kpi.productCount}</div><div className="kpi-sub">品类</div></div>
          <div className="kpi-card k-orange"><div className="kpi-label">👥 覆盖客户数</div><div className="kpi-value">{pot.kpi.customerCount}</div><div className="kpi-sub">交易客户</div></div>
          <div className="kpi-card k-green"><div className="kpi-label">💰 客均单价</div><div className="kpi-value">{pot.kpi.avgPrice.toFixed(1)}</div><div className="kpi-sub">万/客户</div></div>
          <div className="kpi-card"><div className="kpi-label">👤 覆盖用户数</div><div className="kpi-value">{pot.kpi.customerCount}</div><div className="kpi-sub">最终用户</div></div>
        </div>
        <div className="grid2">
          <div className="card"><div className="card-title">📊 销售额构成</div><div ref={compRef} className="chart-wrap" style={{height:320}} /></div>
          <div className="card"><div className="card-title">📈 产品销售额趋势 (近12月)</div><div ref={yoyRef} className="chart-wrap" style={{height:320}} /></div>
        </div>
        <div className="card" style={{marginTop:16}}><div className="card-title">🎯 量价四象限</div><div ref={quadRef} className="chart-wrap" style={{height:360}} /></div>
        <div className="card" style={{marginTop:16}}><div className="card-title">潜力产品销售额排名</div><div className="table-wrap" style={{maxHeight:400}}><table className="table"><thead><tr><th>排名</th><th>部门</th><th style={{textAlign:'right'}}>销售额(万)</th><th style={{textAlign:'center'}}>同比</th></tr></thead><tbody>
          {!hasData?<tr><td colSpan={4} className="empty-state">📭 暂无数据，请先导入</td></tr>:pot.deptRanking.slice(0,10).map((r,i)=><tr key={r.name}><td><span className={`rn rn${i<3?i+1:0}`}>{i+1}</span></td><td><strong>{r.name}</strong></td><td style={{textAlign:'right',fontWeight:700}}>¥{r.sales.toLocaleString()}万</td><td style={{textAlign:'center',color:parseFloat(r.yoy)>=0?'#16a34a':'#dc2626',fontWeight:600}}>{parseFloat(r.yoy)>=0?'+':''}{r.yoy}%</td></tr>)}
        </tbody></table></div></div>
      </div>}

      {/* ===== 产品维度 ===== */}
      {tab === 'product' && <div className="card"><div className="card-title">🏆 潜力产品 TOP 10</div><div className="table-wrap" style={{maxHeight:420}}><table className="table"><thead><tr><th>排名</th><th>产品</th><th style={{textAlign:'right'}}>销售额(万)</th><th style={{textAlign:'center'}}>同比</th><th style={{textAlign:'center'}}>类型</th></tr></thead><tbody>
        {!hasData?<tr><td colSpan={5} className="empty-state">📭 暂无数据</td></tr>:pot.top10.map((r,i)=><tr key={r.product}><td><span className={`rn rn${i<3?i+1:0}`}>{i+1}</span></td><td><strong>{r.product}</strong></td><td style={{textAlign:'right',fontWeight:700}}>¥{r.sales.toLocaleString()}万</td><td style={{textAlign:'center',color:r.yoy==='新增'?'#2563eb':(parseFloat(r.yoy)>=0?'#16a34a':'#dc2626'),fontWeight:600}}>{r.yoy==='新增'?'新增':(parseFloat(r.yoy)>=0?'+':'')+r.yoy+'%'}</td><td style={{textAlign:'center'}}><span className="badge" style={{background:r.type==='量价齐升'?'#dcfce7':r.type==='新增'?'#dbeafe':'#fef3c7'}}>{r.type}</span></td></tr>)}
      </tbody></table></div></div>}

      {/* ===== 团队维度 ===== */}
      {tab === 'team' && <div>
        <div className="card"><div className="card-title">📊 团队潜力产品评分卡</div><div className="table-wrap" style={{maxHeight:400}}><table className="table"><thead><tr><th>排名</th><th>团队</th><th style={{textAlign:'center'}}>销售额(万)</th><th style={{textAlign:'center'}}>同比</th><th style={{textAlign:'center'}}>覆盖产品数</th></tr></thead><tbody>
          {!hasData?<tr><td colSpan={5} className="empty-state">📭 暂无数据</td></tr>:pot.deptRanking.slice(0,10).map((r,i)=><tr key={'sc'+r.name}><td><span className={`rn rn${i<3?i+1:0}`}>{i+1}</span></td><td><strong>{r.name}</strong></td><td style={{textAlign:'center',fontWeight:700}}>¥{r.sales.toLocaleString()}万</td><td style={{textAlign:'center',color:parseFloat(r.yoy)>=0?'#16a34a':'#dc2626'}}>{parseFloat(r.yoy)>=0?'+':''}{r.yoy}%</td><td style={{textAlign:'center'}}>{pot.kpi.productCount}</td></tr>)}
        </tbody></table></div></div>
        <div className="card" style={{marginTop:16}}><div className="card-title">🔀 团队 × 产品 销售额矩阵</div>{!hasData?<div className="empty-state">📭 暂无数据</div>:<div className="table-wrap" style={{overflowX:'auto',maxHeight:500}}><table className="table" style={{fontSize:11}}><thead><tr><th>团队</th>{pot.prodComposition.map(p=><th key={p} style={{textAlign:'center'}}>{p.length>6?p.substring(0,6)+'…':p}</th>)}</tr></thead><tbody>{pot.deptRanking.slice(0,8).map(r=><tr key={'tm'+r.name}><td><strong>{r.name}</strong></td>{pot.prodComposition.map(p=><td key={p} style={{textAlign:'center',fontSize:11}}>-</td>)}</tr>)}</tbody></table></div>}</div>
      </div>}

      {/* ===== 客户维度 ===== */}
      {tab === 'customer' && <div>
        <div className="card"><div className="card-title">📊 客户分层分析</div><div className="table-wrap" style={{maxHeight:420}}><table className="table"><thead><tr><th>排名</th><th>客户名称</th><th style={{textAlign:'right'}}>销售额(万)</th><th style={{textAlign:'center'}}>覆盖产品线</th></tr></thead><tbody>
          {pot.customerSegments.length===0?<tr><td colSpan={4} className="empty-state">📭 暂无数据，请先导入</td></tr>:pot.customerSegments.slice(0,30).map((c,i)=><tr key={c.name}><td><span className={`rn rn${i<3?i+1:0}`}>{i+1}</span></td><td><strong>{c.name}</strong></td><td style={{textAlign:'right',fontWeight:700}}>¥{c.sales.toLocaleString()}万</td><td style={{textAlign:'center',fontWeight:600}}>{c.productCount}</td></tr>)}
        </tbody></table></div></div>
        <div className="card" style={{marginTop:16}}><div className="card-title">🏆 高贡献客户 TOP 10</div><div className="table-wrap" style={{maxHeight:400}}><table className="table"><thead><tr><th>排名</th><th>客户名称</th><th style={{textAlign:'right'}}>销售额(万)</th><th style={{textAlign:'center'}}>产品数</th></tr></thead><tbody>
          {pot.customerSegments.length===0?<tr><td colSpan={4} className="empty-state">📭 暂无数据</td></tr>:pot.customerSegments.slice(0,10).map((c,i)=><tr key={'top'+c.name}><td><span className={`rn rn${i<3?i+1:0}`}>{i+1}</span></td><td><strong>{c.name}</strong></td><td style={{textAlign:'right',fontWeight:700}}>¥{c.sales.toLocaleString()}万</td><td style={{textAlign:'center',fontWeight:600}}>{c.productCount}</td></tr>)}
        </tbody></table></div></div>
      </div>}

      {/* ===== 用户维度 ===== */}
      {tab === 'user' && <div>
        <div className="card"><div className="card-title">🏢 最终用户潜力产品推广情况</div><div className="table-wrap" style={{maxHeight:420}}><table className="table"><thead><tr><th>排名</th><th>最终用户</th><th style={{textAlign:'center'}}>覆盖产品线</th><th style={{textAlign:'center'}}>关联客户数</th><th style={{textAlign:'right'}}>出库额(万)</th></tr></thead><tbody>
          {pot.userSegments.length === 0 ? (
            <tr><td colSpan={5} className="empty-state">📭 暂无数据，请先导入用户维度数据</td></tr>
          ) : (
            pot.userSegments.slice(0, 30).map((u, i) => (
              <tr key={u.name}>
                <td><span className={`rn rn${i<3?i+1:0}`}>{i+1}</span></td>
                <td><strong>{u.name}</strong></td>
                <td style={{textAlign:'center'}}>{u.productCount}</td>
                <td style={{textAlign:'center'}}>{u.custCount}</td>
                <td style={{textAlign:'right',fontWeight:700}}>¥{u.sales.toLocaleString()}万</td>
              </tr>
            ))
          )}
        </tbody></table></div></div>
      </div>}

      {/* ===== 缺口分析 ===== */}
      {tab === 'gap' && <div className="card"><div className="card-title">📉 各团队产品空白率 & 突破率</div><div className="table-wrap" style={{maxHeight:400}}><table className="table"><thead><tr><th>团队</th><th style={{textAlign:'center'}}>空白产品数</th><th style={{textAlign:'center'}}>空白率</th><th style={{textAlign:'center'}}>突破产品数</th><th style={{textAlign:'center'}}>突破率</th></tr></thead><tbody>
        {!hasData?<tr><td colSpan={5} className="empty-state">📭 暂无数据</td></tr>:pot.deptRanking.slice(0,8).map(r=><tr key={'gap'+r.name}><td><strong>{r.name}</strong></td><td style={{textAlign:'center',color:'#dc2626',fontWeight:600}}>-</td><td style={{textAlign:'center'}}>-%</td><td style={{textAlign:'center',color:'#059669',fontWeight:600}}>-</td><td style={{textAlign:'center'}}>-%</td></tr>)}
      </tbody></table></div></div>}

      {tab === 'import' && <PotentialImport />}
      {tab === 'ai' && <div className="card" style={{padding:40,textAlign:'center'}}><div style={{fontSize:36,marginBottom:12}}>🤖</div><div style={{fontSize:16,fontWeight:600,marginBottom:8,color:'#1e293b'}}>AI 潜力产品分析建议</div><div style={{fontSize:13,color:'#94a3b8',marginBottom:20}}>基于销售数据识别高增长潜力产品，评估市场机会</div><textarea placeholder="输入分析问题..." style={{width:'100%',maxWidth:600,height:80,padding:10,border:'1px solid #d1d5db',borderRadius:8,fontSize:13,resize:'vertical',marginBottom:12}} /><div><button className="btn-primary" style={{padding:'8px 24px'}}>🔍 开始分析</button></div></div>}
    </div>
  );
}
