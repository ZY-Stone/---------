import { useState } from 'react';

const tabs = [
  { id: 'users', label: '👥 用户管理' },{ id: 'roles', label: '🔐 角色权限' },{ id: 'products', label: '📦 产品字典' },
  { id: 'audit', label: '📋 审计日志' },{ id: 'backup', label: '💾 数据备份与导出' },
];
const users = [{id:210,username:'admin',name:'管理员',role:'admin',dept:'管理部',group:'-',ld:'-'},{id:212,username:'guchengcheng',name:'顾城成',role:'gm',dept:'深圳业务中心',group:'-',ld:'-'}];
const roles: Record<string,{badge:string;color:string;name:string}> = {admin:{badge:'管理员',color:'#2563eb',name:'管理员'},gm:{badge:'总经理',color:'#1e40af',name:'总经理'},director:{badge:'总监',color:'#0891b2',name:'总监'},manager:{badge:'主管',color:'#ea580c',name:'主管'},interface:{badge:'接口人',color:'#64748b',name:'接口人'},sales:{badge:'销售',color:'#2563eb',name:'一线销售'}};
const prodDict = [{id:1,name:'IPC',alias:'网络摄像机',cat:'前端',pot:true},{id:2,name:'NVR',alias:'网络录像机',cat:'后端',pot:true},{id:3,name:'门禁',alias:'门禁系统',cat:'通行',pot:true},{id:4,name:'球机',alias:'PTZ摄像机',cat:'前端',pot:true},{id:5,name:'出入口停车',alias:'停车管理',cat:'通行',pot:true},{id:6,name:'会议平板',alias:'会议系统',cat:'协作',pot:true},{id:7,name:'LED屏',alias:'LED显示屏',cat:'显示',pot:true},{id:8,name:'服务器',alias:'服务器',cat:'基础设施',pot:true},{id:9,name:'平台软件',alias:'管理平台',cat:'软件',pot:true},{id:10,name:'智能交通',alias:'交通管理',cat:'行业',pot:true},{id:11,name:'热成像',alias:'热成像摄像机',cat:'前端',pot:true},{id:12,name:'执法记录仪',alias:'执法记录',cat:'终端',pot:false},{id:13,name:'人员通道',alias:'闸机通道',cat:'通行',pot:false}];
const auditLogs = [{time:'2026-07-24 14:32',user:'admin',name:'管理员',action:'数据导入',target:'产品宽度Excel',detail:'导入规上用户285条,客户888条',ip:'10.195.5.46'},{time:'2026-07-24 10:15',user:'gaowei',name:'高巍',action:'查看报表',target:'总览分析',ip:'192.168.1.100'}];

export default function Admin() {
  const [tab, setTab] = useState('users');
  return (
    <div className="page">
      <div className="subtabs-inline">{tabs.map(t => <button key={t.id} className={`subtab${tab===t.id?' active':''}`} onClick={()=>setTab(t.id)}>{t.label}</button>)}</div>

      {tab === 'users' && <div>
        <div style={{display:'flex',gap:8,marginBottom:12,alignItems:'center'}}><button className="btn-primary" style={{padding:'5px 14px',fontSize:12}}>➕ 新增用户</button><span style={{fontSize:13,color:'#6b7280'}}>共 <strong style={{color:'#1e293b'}}>{users.length}</strong> 个用户</span><input type="text" placeholder="搜索用户..." style={{marginLeft:'auto',padding:'5px 10px',border:'1px solid #d1d5db',borderRadius:6,fontSize:12,width:180}} /></div>
        <div className="table-wrap" style={{maxHeight:500}}><table className="table"><thead><tr><th>ID</th><th>用户名</th><th>姓名</th><th>角色</th><th>部门</th><th>小组</th><th>上级</th><th style={{textAlign:'center'}}>操作</th></tr></thead><tbody>
          {users.map(u => <tr key={u.id}><td style={{fontSize:11,color:'#94a3b8'}}>{u.id}</td><td><strong>{u.username}</strong></td><td>{u.name}</td><td><span className="badge" style={{background:(roles[u.role]||{}).color||'#f1f5f9',color:'#fff'}}>{(roles[u.role]||{}).badge||u.role}</span></td><td>{u.dept}</td><td>{u.group}</td><td style={{fontSize:11,color:'#6b7280'}}>{u.ld}</td><td style={{textAlign:'center'}}><button className="btn-ghost" style={{padding:'2px 8px',fontSize:10}}>✏️</button><button className="btn-ghost" style={{padding:'2px 8px',fontSize:10,color:'#dc2626'}}>🗑</button></td></tr>)}
        </tbody></table></div>
      </div>}

      {tab === 'roles' && <div className="table-wrap" style={{maxHeight:500}}><table className="table"><thead><tr><th>角色</th><th>名称</th><th>权限范围</th><th>模块权限</th><th style={{textAlign:'center'}}>操作</th></tr></thead><tbody>
        {Object.entries(roles).map(([k,r]) => <tr key={k}><td><span className="badge" style={{background:r.color,color:'#fff'}}>{r.badge}</span></td><td><strong>{r.name}</strong></td><td style={{fontSize:12}}>{k==='admin'?'全部数据':k==='gm'?'全局查看':k==='director'?'部门管理':'有限查看'}</td><td style={{fontSize:11,color:'#6b7280'}}>{k==='admin'?'全部模块':k==='gm'?'总览/宽度/潜力':k==='director'?'本部门':'本人数据'}</td><td style={{textAlign:'center'}}><button className="btn-ghost" style={{padding:'2px 8px',fontSize:10}}>✏️ 配置</button></td></tr>)}
      </tbody></table></div>}

      {tab === 'products' && <div className="grid2">
        <div className="card"><div className="card-title">🚀 潜力产品清单 <span style={{fontSize:11,color:'#6b7280'}}>共 {prodDict.filter(p=>p.pot).length} 个</span></div><div className="table-wrap" style={{maxHeight:400}}><table className="table"><thead><tr><th>ID</th><th>产品</th><th>别名</th><th>品类</th></tr></thead><tbody>{prodDict.filter(p=>p.pot).map(p=><tr key={p.id}><td>{p.id}</td><td><strong>{p.name}</strong></td><td>{p.alias}</td><td>{p.cat}</td></tr>)}</tbody></table></div></div>
        <div className="card"><div className="card-title">📦 全量产品字典 <span style={{fontSize:11,color:'#6b7280'}}>共 {prodDict.length} 个</span></div><div className="table-wrap" style={{maxHeight:400}}><table className="table"><thead><tr><th>ID</th><th>产品</th><th>别名</th><th>品类</th><th>潜力</th></tr></thead><tbody>{prodDict.map(p=><tr key={'a'+p.id}><td>{p.id}</td><td><strong>{p.name}</strong></td><td>{p.alias}</td><td>{p.cat}</td><td style={{color:p.pot?'#059669':'#d1d5db',fontWeight:600}}>{p.pot?'✓':'-'}</td></tr>)}</tbody></table></div></div>
      </div>}

      {tab === 'audit' && <div>
        <div className="filter-bar" style={{marginBottom:12}}><div className="filter-group"><label>操作用户</label><select><option value="all">全部</option></select></div><div className="filter-sep">|</div><div className="filter-group"><label>操作类型</label><select><option value="all">全部</option><option>数据导入</option><option>查看报表</option></select></div><div className="filter-sep">|</div><div className="filter-group"><label>日期从</label><input type="date" defaultValue="2026-07-01" style={{padding:'4px 8px',border:'1px solid #d1d5db',borderRadius:4,fontSize:11}} /></div><div className="filter-group"><label>至</label><input type="date" defaultValue="2026-07-24" style={{padding:'4px 8px',border:'1px solid #d1d5db',borderRadius:4,fontSize:11}} /></div><button className="btn-ghost" style={{marginLeft:'auto'}}>📥 导出日志</button></div>
        <div className="table-wrap" style={{maxHeight:450}}><table className="table"><thead><tr><th>时间</th><th>用户</th><th>姓名</th><th>操作</th><th>目标</th><th>详情</th><th>IP</th></tr></thead><tbody>
          {auditLogs.map(log => <tr key={log.time}><td style={{fontSize:11}}>{log.time}</td><td><strong>{log.user}</strong></td><td>{log.name}</td><td><span className="badge" style={{background:log.action==='数据导入'?'#dbeafe':log.action==='查看报表'?'#dcfce7':'#fef3c7'}}>{log.action}</span></td><td>{log.target}</td><td style={{fontSize:11,color:'#6b7280',maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{log.detail}</td><td style={{fontSize:10,color:'#94a3b8'}}>{log.ip}</td></tr>)}
        </tbody></table></div>
      </div>}

      {tab === 'backup' && <div className="grid2">
        <div className="card"><div className="card-title">💾 数据备份</div><div style={{display:'flex',gap:8,marginBottom:16}}><button className="btn-primary" style={{padding:'6px 16px',fontSize:12}}>📦 创建完整备份</button></div><div className="empty-state">暂无备份记录</div></div>
        <div className="card"><div className="card-title">📥 数据导出</div><div style={{display:'flex',flexDirection:'column',gap:8,padding:'8px 0'}}><button className="btn-primary" style={{justifyContent:'flex-start',padding:'10px 16px',width:'100%',textAlign:'left'}}>📊 导出产品宽度数据 (Excel)</button><button className="btn-primary" style={{justifyContent:'flex-start',padding:'10px 16px',width:'100%',textAlign:'left'}}>🚀 导出潜力产品数据 (Excel)</button><button className="btn-ghost" style={{justifyContent:'flex-start',padding:'10px 16px',width:'100%',textAlign:'left'}}>📋 导出审计日志 (Excel)</button></div></div>
      </div>}
    </div>
  );
}
