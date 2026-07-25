import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { useWidthStore } from '../stores/widthStore';
import { usePotentialStore } from '../stores/potentialStore';
import { useFilterStore } from '../stores/filterStore';
import FilterBar from '../components/common/FilterBar';
import KpiCard from '../components/common/KpiCard';

export default function Overview() {
  const width = useWidthStore();
  const potential = usePotentialStore();
  const filter = useFilterStore();
  const deptRef = useRef<HTMLDivElement>(null);
  const trendRef = useRef<HTMLDivElement>(null);
  const potRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const c1 = deptRef.current, c2 = trendRef.current, c3 = potRef.current;
    const instances: echarts.ECharts[] = [];

    if (c1) {
      const chart = echarts.init(c1);
      const rank = width.teamWidthRank;
      chart.setOption({ tooltip:{}, grid:{left:40,right:20,top:10,bottom:50}, xAxis:{type:'category',data:rank.map(r=>r.dept),axisLabel:{rotate:30,fontSize:10}}, yAxis:{type:'value'}, series:[{type:'bar',data:rank.map(r=>parseFloat(r.avgWidth)||0),itemStyle:{color:'#3b82f6',borderRadius:[4,4,0,0]}}] });
      instances.push(chart);
    }
    if (c2) {
      const chart = echarts.init(c2);
      const aw = parseFloat(width.kpi.avgWidth)||0;
      chart.setOption({ tooltip:{}, legend:{bottom:0}, grid:{left:40,right:20,top:10,bottom:40}, xAxis:{type:'category',data:['08','09','10','11','12','01','02','03','04','05','06','07']}, yAxis:{type:'value'}, series:[
        {name:'平均宽度',type:'line',data:Array(12).fill(aw),smooth:true,lineStyle:{color:'#3b82f6'}},
        {name:'规上客户',type:'line',data:Array(12).fill(width.kpi.scaleCustomers*0.01),smooth:true,lineStyle:{color:'#10b981'}},
        {name:'规上用户',type:'line',data:Array(12).fill(width.kpi.scaleUsers*0.01),smooth:true,lineStyle:{color:'#f59e0b'}},
      ] });
      instances.push(chart);
    }
    if (c3) {
      const chart = echarts.init(c3);
      const rank = potential.deptRanking;
      chart.setOption({ tooltip:{}, grid:{left:50,right:20,top:10,bottom:50}, xAxis:{type:'category',data:rank.map(r=>r.name),axisLabel:{rotate:30,fontSize:10}}, yAxis:{type:'value'}, series:[{type:'bar',data:rank.map(r=>r.sales),itemStyle:{color:'#3b82f6',borderRadius:[4,4,0,0]}}] });
      instances.push(chart);
    }
    return () => instances.forEach(c => c.dispose());
  }, [width.kpi, width.teamWidthRank, potential.deptRanking]);

  const hasData = width.custGS.length > 0 || potential.custRAW.length > 0;

  return (
    <div className="page">
      <FilterBar />
      <div className="kpi-row" style={{ gridTemplateColumns: 'repeat(6,1fr)', gap: 8 }}>
        <KpiCard label="📐 产品宽度" value={width.kpi.avgWidth} sub="平均宽度" />
        <KpiCard label="🧑 用户产品宽度" value={width.kpi.avgWidth} sub={`规上用户数 ${width.kpi.scaleUsers}`} />
        <KpiCard label="👥 客户产品宽度" value={width.kpi.avgWidth} sub={`规上客户数 ${width.kpi.scaleCustomers}`} />
        <KpiCard label="🚀 潜力产品销售额" value={`¥ ${potential.overview.sales.toLocaleString()}万`} />
        <KpiCard label="🧑 覆盖用户数" value={width.kpi.scaleUsers} />
        <KpiCard label="👥 覆盖客户数" value={width.kpi.scaleCustomers.toLocaleString()} />
      </div>
      <div className="grid2">
        <div className="card"><div className="card-title">📐 产品宽度</div><div ref={deptRef} className="chart-wrap short" /></div>
        <div className="card"><div className="card-title">📐 产品宽度历史趋势 (近12月)</div><div ref={trendRef} className="chart-wrap tall" /></div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title">🚀 潜力产品<span className="tag">按筛选</span></div>
        {hasData ? <div ref={potRef} className="chart-wrap" style={{ height: 360 }} /> : <div className="empty-state">📭 暂无数据，请先导入数据</div>}
        {potential.deptRanking.length > 0 && (
          <div className="table-wrap" style={{ maxHeight: 300, marginTop: 8 }}>
            <table className="table"><thead><tr><th>排名</th><th>部门</th><th style={{textAlign:'right'}}>销售额(万)</th><th style={{textAlign:'center'}}>同比</th></tr></thead><tbody>
              {potential.deptRanking.slice(0,5).map((r,i) => <tr key={r.name}><td><span className={`rn rn${i<3?i+1:0}`}>{i+1}</span></td><td><strong>{r.name}</strong></td><td style={{textAlign:'right',fontWeight:700}}>¥{r.sales.toLocaleString()}万</td><td style={{textAlign:'center',color:parseFloat(r.yoy)>=0?'#16a34a':'#dc2626',fontWeight:600}}>{parseFloat(r.yoy)>=0?'+':''}{r.yoy}%</td></tr>)}
            </tbody></table>
          </div>
        )}
      </div>
    </div>
  );
}
