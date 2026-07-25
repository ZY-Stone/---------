import { useFilterStore } from '../../stores/filterStore';

export default function FilterBar({ onChange }: { onChange?: () => void }) {
  const f = useFilterStore();

  return (
    <div className="filter-bar">
      <div className="filter-group"><label>日期</label><span style={{ display:'flex',alignItems:'center',gap:4,border:'1px solid #d1d5db',borderRadius:6,padding:'5px 10px',fontSize:12,background:'#fff' }}>{f.dateStart} ~ {f.dateEnd} 📅</span></div>
      <div className="filter-sep">|</div>
      <div className="filter-group"><label>对比期</label><select onChange={e => onChange?.()}><option>同比(去年同期)</option><option>环比(上月)</option></select></div>
      <div className="filter-sep">|</div>
      <div className="filter-group"><label>👥 部门</label><select value={f.dept} onChange={e => { f.setDept(e.target.value); onChange?.(); }}>
        <option value="all">全部部门</option>
        {f.deptOptions.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
      </select></div>
      <span className="filter-sep">→</span>
      <div className="filter-group"><label>小组</label><select value={f.group} onChange={e => { f.setGroup(e.target.value); onChange?.(); }}>
        <option value="all">全部小组</option>
        {f.groupOptions.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
      </select></div>
      <span className="filter-sep">→</span>
      <div className="filter-group"><label>个人</label><select value={f.person} onChange={e => { f.setPerson(e.target.value); onChange?.(); }}>
        <option value="all">全部成员</option>
      </select></div>
      <button className="btn-ghost" onClick={() => { f.resetAll(); onChange?.(); }}>🔄 重置</button>
    </div>
  );
}
