/**
 * data.js — Demo 数据集
 * 按页面 + 筛选维度预置多套数据，切换筛选时动态加载
 */
window.App = window.App || {};

// ===== 团队数据缩放系数 =====
var SCALE = {
  'all':           { sales: 1.00, customers: 1.00, width: 1.00 },
  '政府行业组':     { sales: 0.40, customers: 0.35, width: 1.08 },
  '公安交警行业组': { sales: 0.28, customers: 0.30, width: 1.05 },
  '工业企业一组':   { sales: 0.22, customers: 0.25, width: 0.95 },
  '智慧建筑组':     { sales: 0.18, customers: 0.20, width: 0.88 },
  '交通行业组':     { sales: 0.16, customers: 0.18, width: 0.92 },
  '客户销售一组':   { sales: 0.20, customers: 0.22, width: 0.90 }
};

// ===== 用户角色定义 =====
App.USER_ROLES = {
  admin:     { name: '管理员',  avatar: '管', badge: '管理员', color: '#2563eb', perms: '全部权限' },
  gm:        { name: '总经理',  avatar: '总', badge: '总经理', color: '#1e40af', perms: '全局查看' },
  operation: { name: '运营',    avatar: '运', badge: '运营',   color: '#7c3aed', perms: '全局查看' },
  director:  { name: '总监',    avatar: '总', badge: '总监',   color: '#0891b2', perms: '部门管理' },
  manager:   { name: '主管',    avatar: '主', badge: '主管',   color: '#ea580c', perms: '组级管理' },
  interface: { name: '接口人',  avatar: '接', badge: '接口人', color: '#64748b', perms: '数据对接' },
  sales:     { name: '一线销售', avatar: '销', badge: '销售',  color: '#2563eb', perms: '本人数据' }
};

// ===== 组织架构: 部门列表 =====
App.DEPT_LIST = ['客户销售一部', '客户销售二部', '大客户销售部', '场景数字化销售部', '行业一部', '行业二部'];

// ===== 模拟用户数据库（来自Excel权限设置清单） =====
App.MOCK_USERS = [
  { id:101, username:'gaowei', name:'高巍', role:'director', dept:'客户销售一部', group:'-', ld:'-' },
  { id:102, username:'wenghuanzhi', name:'翁焕植', role:'interface', dept:'客户销售一部', group:'-', ld:'高巍' },
  { id:103, username:'jiangangping', name:'简刚平', role:'interface', dept:'客户销售一部', group:'-', ld:'高巍' },
  { id:105, username:'zhangdongzhu', name:'张栋柱', role:'manager', dept:'客户销售一部', group:'客户销售一组', ld:'高巍' },
  { id:111, username:'chengang', name:'陈刚', role:'manager', dept:'客户销售一部', group:'客户销售二组', ld:'高巍' },
  { id:121, username:'liuwenyu', name:'刘文宇', role:'manager', dept:'客户销售一部', group:'客户销售四组', ld:'高巍' },
  { id:130, username:'zhaozhiqiang', name:'赵志强', role:'manager', dept:'客户销售一部', group:'客户销售五组', ld:'高巍' },
  { id:131, username:'wuzenghao', name:'吴正豪', role:'director', dept:'客户销售二部', group:'-', ld:'-' },
  { id:132, username:'liuhui55', name:'刘辉55', role:'interface', dept:'客户销售二部', group:'-', ld:'吴正豪' },
  { id:136, username:'zhudi', name:'朱迪', role:'manager', dept:'客户销售二部', group:'客户销售七组', ld:'吴正豪' },
  { id:142, username:'dengchang', name:'邓畅', role:'manager', dept:'客户销售二部', group:'客户销售八组', ld:'吴正豪' },
  { id:148, username:'liyongzheng', name:'李拥政', role:'manager', dept:'客户销售二部', group:'客户销售九组', ld:'吴正豪' },
  { id:155, username:'hanjie', name:'韩杰', role:'director', dept:'大客户销售部', group:'-', ld:'-' },
  { id:213, username:'xiebin18', name:'谢彬18', role:'interface', dept:'大客户销售部', group:'-', ld:'韩杰' },
  { id:164, username:'mingliangbin', name:'明良斌', role:'director', dept:'场景数字化销售部', group:'-', ld:'-' },
  { id:167, username:'fangweijian', name:'房伟建', role:'director', dept:'行业二部', group:'-', ld:'-' },
  { id:168, username:'zhankailing', name:'詹凯玲', role:'interface', dept:'行业二部', group:'-', ld:'房伟建' },
  { id:171, username:'wangkui', name:'王魁', role:'manager', dept:'行业二部', group:'交通行业组', ld:'房伟建' },
  { id:177, username:'liudong', name:'刘冬', role:'manager', dept:'行业二部', group:'司法行业组', ld:'房伟建' },
  { id:179, username:'liaobeichen', name:'廖北宸', role:'manager', dept:'行业二部', group:'政府行业组', ld:'房伟建' },
  { id:183, username:'wangqian', name:'王茜', role:'manager', dept:'行业二部', group:'文教卫组', ld:'房伟建' },
  { id:189, username:'weiyuchang', name:'卫玉昌', role:'director', dept:'行业一部', group:'-', ld:'-' },
  { id:190, username:'yaojincheng', name:'姚金成', role:'interface', dept:'行业一部', group:'-', ld:'卫玉昌' },
  { id:191, username:'panzhongnan', name:'潘仲楠', role:'manager', dept:'行业一部', group:'工业企业一组', ld:'卫玉昌' },
  { id:201, username:'zhuxuhao', name:'朱绪浩', role:'manager', dept:'行业一部', group:'智慧建筑组', ld:'卫玉昌' },
  { id:206, username:'liyaodong', name:'李耀东', role:'manager', dept:'行业一部', group:'智慧商贸组', ld:'卫玉昌' },
  { id:210, username:'admin', name:'管理员', role:'admin', dept:'管理部', group:'-', ld:'-' },
  { id:211, username:'jiangying', name:'江英', role:'operation', dept:'运营部', group:'-', ld:'-' },
  { id:212, username:'guchengcheng', name:'顾城成', role:'gm', dept:'深圳业务中心', group:'-', ld:'-' },
];

// ===== DEPTS =====
App.DEPTS = [
  { n: '管理部', ld: 'admin', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '深圳业务中心', ld: '顾城成', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '运营部', ld: '江英', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '客户销售一部', ld: '高巍', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '客户销售二部', ld: '吴正豪', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '大客户销售部', ld: '韩杰', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '场景数字化销售部', ld: '明良斌', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '行业一部', ld: '卫玉昌', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '行业二部', ld: '房伟建', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
];

// ===== GROUPS =====
App.GROUPS = [
  { n: '客户销售一组', dept: '客户销售一部', ld: '张栋柱', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '客户销售二组', dept: '客户销售一部', ld: '陈刚', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '客户销售三组', dept: '客户销售一部', ld: '高巍(兼)', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '客户销售四组', dept: '客户销售一部', ld: '刘文宇', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '客户销售五组', dept: '客户销售一部', ld: '赵志强', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '客户销售六组', dept: '客户销售二部', ld: '吴正豪(兼)', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '客户销售七组', dept: '客户销售二部', ld: '朱迪', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '客户销售八组', dept: '客户销售二部', ld: '邓畅', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '客户销售九组', dept: '客户销售二部', ld: '李拥政', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '工业企业一组', dept: '行业一部', ld: '潘仲楠', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '工业企业二组', dept: '行业一部', ld: '未指定', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '智慧商贸组', dept: '行业一部', ld: '李耀东', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '智慧建筑组', dept: '行业一部', ld: '朱绪浩', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '交通行业组', dept: '行业二部', ld: '王魁', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '公安交警行业组', dept: '行业二部', ld: '房伟建(兼)', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '司法行业组', dept: '行业二部', ld: '刘冬', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '文教卫组', dept: '行业二部', ld: '王茜', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '政府行业组', dept: '行业二部', ld: '廖北宸', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
];

// ===== PERSONS =====
App.PERSONS = [
  { n: '段金君', dept: '客户销售一部', grp: '-', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '彭威12', dept: '客户销售一部', grp: '客户销售一组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '张振德', dept: '客户销售一部', grp: '客户销售一组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '王嘉急5', dept: '客户销售一部', grp: '客户销售一组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '沙坤', dept: '客户销售一部', grp: '客户销售一组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '黄燕滨', dept: '客户销售一部', grp: '客户销售一组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '孙天6', dept: '客户销售一部', grp: '客户销售二组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '罗肖福', dept: '客户销售一部', grp: '客户销售二组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '陈伟添', dept: '客户销售一部', grp: '客户销售二组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '蔡均鑫', dept: '客户销售一部', grp: '客户销售二组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '罗兴华', dept: '客户销售一部', grp: '客户销售三组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '王鹏旭', dept: '客户销售一部', grp: '客户销售三组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '熊佳豪', dept: '客户销售一部', grp: '客户销售三组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '陈春11', dept: '客户销售一部', grp: '客户销售三组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '赵鑫阳5', dept: '客户销售一部', grp: '客户销售三组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '徐志伟8', dept: '客户销售一部', grp: '客户销售四组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '张宜军8', dept: '客户销售一部', grp: '客户销售四组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '胡鹏17', dept: '客户销售一部', grp: '客户销售四组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '陈宁8', dept: '客户销售一部', grp: '客户销售四组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '范富山', dept: '客户销售一部', grp: '客户销售四组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '梁资航5', dept: '客户销售一部', grp: '客户销售四组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '雷昊明6', dept: '客户销售一部', grp: '客户销售四组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '徐兴强', dept: '客户销售一部', grp: '客户销售四组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '龙招军', dept: '客户销售二部', grp: '客户销售六组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '牛璐', dept: '客户销售二部', grp: '客户销售六组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '张如玮5', dept: '客户销售二部', grp: '客户销售六组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '蒋宪正', dept: '客户销售二部', grp: '客户销售七组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '汤瑞生', dept: '客户销售二部', grp: '客户销售七组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '陈博锋', dept: '客户销售二部', grp: '客户销售七组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '王海滨8', dept: '客户销售二部', grp: '客户销售七组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '叶德庆', dept: '客户销售二部', grp: '客户销售七组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '张云川', dept: '客户销售二部', grp: '客户销售八组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '徐添寒', dept: '客户销售二部', grp: '客户销售八组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '何建新6', dept: '客户销售二部', grp: '客户销售八组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '吴思聪', dept: '客户销售二部', grp: '客户销售八组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '王宇龙25', dept: '客户销售二部', grp: '客户销售八组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '黎毅刚', dept: '客户销售二部', grp: '客户销售九组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '胡程6', dept: '客户销售二部', grp: '客户销售九组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '贾贺翔', dept: '客户销售二部', grp: '客户销售九组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '许金迪', dept: '客户销售二部', grp: '客户销售九组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '蒋国江', dept: '客户销售二部', grp: '客户销售九组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '曹政11', dept: '客户销售二部', grp: '客户销售九组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '刘爱红', dept: '大客户销售部', grp: '-', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '李玉', dept: '大客户销售部', grp: '-', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '刘璞', dept: '大客户销售部', grp: '-', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '马玉薪', dept: '大客户销售部', grp: '-', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '邓贝额', dept: '大客户销售部', grp: '-', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '张辉99', dept: '大客户销售部', grp: '-', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '郑飞13', dept: '大客户销售部', grp: '-', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '谢彬18', dept: '大客户销售部', grp: '-', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '王俊杰', dept: '场景数字化销售部', grp: '-', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '张永仁', dept: '场景数字化销售部', grp: '-', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '林若驹', dept: '行业二部', grp: '-', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '陈志杰8', dept: '行业二部', grp: '-', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '肖力', dept: '行业二部', grp: '交通行业组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '文波5', dept: '行业二部', grp: '交通行业组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '郭庆3', dept: '行业二部', grp: '公安交警行业组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '徐云鹏1', dept: '行业二部', grp: '公安交警行业组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '张腾辉6', dept: '行业二部', grp: '公安交警行业组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '柯俊鑫', dept: '行业二部', grp: '司法行业组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '陶文杰', dept: '行业二部', grp: '政府行业组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '唐勇10', dept: '行业二部', grp: '政府行业组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '刘骏86', dept: '行业二部', grp: '政府行业组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '李功', dept: '行业二部', grp: '文教卫组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '刘羽欣', dept: '行业二部', grp: '文教卫组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '张岩27', dept: '行业二部', grp: '文教卫组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '黄子懿', dept: '行业二部', grp: '文教卫组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '刘向文5', dept: '行业二部', grp: '文教卫组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '杨永光', dept: '行业一部', grp: '工业企业一组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '周丹3', dept: '行业一部', grp: '工业企业一组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '刘超27', dept: '行业一部', grp: '工业企业一组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '张星19', dept: '行业一部', grp: '工业企业一组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '洪峰泉', dept: '行业一部', grp: '工业企业二组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '高扬23', dept: '行业一部', grp: '工业企业二组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '唐明翔', dept: '行业一部', grp: '工业企业二组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '胡鑫11', dept: '行业一部', grp: '工业企业二组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '陈仲都', dept: '行业一部', grp: '工业企业二组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '杨秀敏', dept: '行业一部', grp: '智慧建筑组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '吴泽民6', dept: '行业一部', grp: '智慧建筑组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '何亮12', dept: '行业一部', grp: '智慧建筑组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '戴哲5', dept: '行业一部', grp: '智慧建筑组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '孙德成', dept: '行业一部', grp: '智慧商贸组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '曾强弘', dept: '行业一部', grp: '智慧商贸组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' },
  { n: '刘佳豪26', dept: '行业一部', grp: '智慧商贸组', cw: 0, aw: 0, mw: 0, cov: 0, yoy: '-' }
];

// ===== 全局存储初始化（必须在 app.js 的 initAll() 之前） =====
App.charts = {};

// ===== 产品宽度 Demo 数据 =====
App.Data = {};

// 总览页 KPI 基础值
var BASE_OVERVIEW = {};

// KPI 目标值（用于红黄绿灯判断）
var BASE_KPI_TARGETS = {};

// 红绿灯判断: >= 95% 绿色 / >= 80% 黄色 / < 80% 红色
function kpiTrafficLight(current, target) {
  if (!target || target === 0) return { cls: 'green', pct: 100 };
  var pct = Math.round(current / target * 100);
  var cls = pct >= 95 ? 'green' : (pct >= 80 ? 'yellow' : 'red');
  return { cls: cls, pct: Math.min(pct, 100) };
}

// 总览页 部门维度: 产品宽度
var BASE_OVERVIEW_DEPT_WIDTH = [];

// 总览页 部门维度: 潜力产品销售额 (万元)
var BASE_OVERVIEW_DEPT_POTENTIAL = [];

// 总览页销售人员宽度排名
var BASE_WIDTH_RANK = [];

// 总览页潜力产品贡献排名
var BASE_POTENTIAL_RANK = [];

// 总览页潜力产品销售排名
var BASE_POTENTIAL_PRODUCT = [];

// 产品宽度页 KPI 基础值
var BASE_WIDTH = {};

// 产品宽度页缺失分析
var BASE_MISSING = [];

// 产品覆盖热力图 - 27 品类（来源：凯玲产品宽度分析）
var BASE_HEATMAP_TOTAL = 0;
var BASE_HEATMAP_PRODS = [];

// 产品覆盖率 — 用户覆盖率（27品类，规上用户维度）
var BASE_HEATMAP_USER_PRODS = [];

// 产品宽度页 客户 TOP 列表（带产品明细，参考简刚平版）
var BASE_CUST_GOOD = [];
var BASE_CUST_BAD = [];

// 产品交叉销售关联矩阵 (10个核心品类 × 10, 半矩阵, Lift值)
var BASE_CROSS_SELL_PRODS = [];
var BASE_CROSS_SELL_MATRIX = [];

// 自动识别的产品套包 (含提升度评分)
var BASE_CROSS_BUNDLES = [];

// 健康度评分卡数据
var BASE_HEALTH_SCORES = {};

// 客户分层分析数据 (销售额万元 × 产品宽度, 20个典型客户)
var BASE_CUST_SEGMENT = [];

// 产品宽度页 用户 TOP 列表（关联客户 + 产品明细）
var BASE_USER_GOOD = [];
var BASE_USER_BAD = [];

// 潜力产品页 KPI 基础值
var BASE_POTENTIAL = {};

// 潜力产品页 客户矩阵
var BASE_MATRIX = [];

// 潜力产品页销售排名
var BASE_SALES_RANK = [];

// 经营概览 (整合自乔梦杰版): 团队小组 × 8 潜力产品
// 列: 团队\小组 / NVR / 智能计算 / IPC / 平台软件 / 门禁 / 智能交通 / 存储 / LCD与解码 / 本期合计 / 同期合计 / 整体同比
var BASE_TEAM_PROD_MATRIX = [];

// 经营概览: 二级部门销售排名 (政府行业组/公安交警行业组/工业企业一组/智慧建筑组)
var BASE_DEPT_RANK = [];

// 经营概览: 销售量构成 (按产品, 12 潜力产品)
var BASE_PROD_COMPOSITION = [];
App.BASE_PROD_COMPOSITION_REF = BASE_PROD_COMPOSITION;

// 经营概览: 本期 vs 同期 + 产品同比趋势 (按月, 近 12 月)
var BASE_PROD_YOY_MONTHS = [];
// 4 个核心潜力产品的本期/同期数据 (单位: 万元)
var BASE_PROD_YOY_DATA = [];

// 经营概览: 量价四象限 (X=数量同比%, Y=金额同比%, 颜色=分类)
var BASE_QUADRANT = [];

// 经营概览: 大部门 × 产品 差距热图数据 (整合自乔梦杰版)
// 11 个潜力产品 × 4 团队 销售额(万元)
var BASE_GAP_HEATMAP_PRODS = [];
var BASE_GAP_HEATMAP_TEAMS = [];

// 产品宽度分布-团队统计 (凯玲版弹窗数据)
// 每个宽度桶下各团队的客户数
var BASE_WIDTH_BUCKET_TEAM_STATS = {};

// 团队平均产品宽度 - 完整版 (凯玲版, 13 个条目)
var BASE_TEAM_AVG_WIDTH = [];

// 产品覆盖率 TOP 15 - 完整版 (凯玲版)
var BASE_COVERAGE_TOP15 = [];

// 团队维度 (凯玲版) - 18 团队/个人 × 27 产品覆盖
// 列: 团队 / 客户数 / 平均宽度 / 最大宽度 / 规上 / 非规上 / [27产品计数]
var BASE_TEAM_DIMENSION = [];

// 分组对比 (凯玲版) - 团队列表 + 个人列表 + 全部团队均值
var BASE_COMPARE_TEAMS = [];
var BASE_COMPARE_PERSONS = [];

// 分组对比 - 27 品类 (凯玲版: 15 主类 + 12 细分)
var BASE_COMPARE_PRODS = [];

// 分组对比 - 团队 27 品类覆盖率 (单位: %)
var BASE_COMPARE_TEAM_PROD = {};

// 分组对比 - 个人 27 品类覆盖率 (单位: %)
var BASE_COMPARE_PERSON_PROD = {};

// 分组对比 - 团队汇总指标 (凯玲版 4 项)
var BASE_COMPARE_TEAM_STATS = {};

// 分组对比 - 个人汇总指标
var BASE_COMPARE_PERSON_STATS = {};

// 全部团队均值 (凯玲版 groupStats 公式: allTotal/allAccounts)
var BASE_COMPARE_ALL_MEAN = {};

// 团队维度显示用的 27 品类 (顺序与 prodCnt 一致)
var BASE_TEAM_DIM_PRODS = ['IPC','球机','专用摄像机','服务器','网络产品','NVR','存储','LCD与解码','智能交通','移动终端','出入口停车','门禁','行业软件','对讲','报警','音频产品','人员通道','PCP产品','LED与拼控','网络产品','综合布线','智慧屏','服务器','基础软件','新业务','传感产品','网络安全'];
// 注: 上面 27 个中前 15 是宽分类 + 12 细分, 这里简化为 18 系列产品, 适配 凯玲版主区

// 经营概览: 销售人员潜力产品排名 (整合自乔梦杰版)
// 12 潜力产品, 每个销售员标注覆盖/未覆盖
var BASE_SALES_POTENTIAL_RANK = [];

// ===== 数据切片生成函数 =====
function scaleKpi(base, factor, decimals) {
  decimals = decimals || 0;
  return Math.round(base * factor * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

function scaleYoY(base, factor) {
  // 同比百分比随因子微调；若 base 不含 '%' 则为原始增量值，不追加百分号
  var num = parseFloat(base);
  var adjusted = num + (factor - 1) * 5;
  var isPercent = ('' + base).indexOf('%') !== -1;
return (adjusted > 0 ? '+' : '') + adjusted.toFixed(isPercent ? 1 : 2) + (isPercent ? '%' : '');
}

// ── 共享计算助手 ──
function calcYoy(cur, prev) {
  if (prev === 0) return cur > 0 ? '新增' : '-';
  return ((cur - prev) / prev * 100).toFixed(1) + '%';
}
function calcType(amtYoy, qtyYoy) {
  var a = parseFloat(amtYoy) || 0, q = parseFloat(qtyYoy) || 0;
  if (a > 0 && q > 0) return '量价齐升';
  if (a > 0 && q < 0) return '量跌价增';
  if (a < 0 && q < 0) return '量价齐跌';
  if (a < 0 && q > 0) return '量增价跌';
  if (amtYoy === '新增') return '新增';
  return '-';
}
function matchesTeam(row, team) {
  return row.dept2 === team || row.dept3 === team || row.dept4 === team || row.dept5 === team || row.dept === team;
}

/**
 * 生成 Overview 页某个团队的数据切片
 */
App.Data.getOverview = function(team) {
  var f = SCALE[team] || SCALE['all'];
  var s = scaleKpi;

  return {
    kpi: {
      width:          s(BASE_OVERVIEW.avgWidth, f.width).toFixed(2),
      userWidth:      s(BASE_OVERVIEW.userWidth, f.width).toFixed(2),
      custWidth:      s(BASE_OVERVIEW.custWidth, f.width).toFixed(2),
      customers:      s(BASE_OVERVIEW.customers, f.customers),
      users:          s(BASE_OVERVIEW.users, f.customers),
      potentialAmt:   '¥ ' + s(BASE_OVERVIEW.potentialAmount, f.sales).toLocaleString() + '万',
      potentialRate:  (s(parseFloat(BASE_OVERVIEW.potentialRate), 1, 1) + (f.sales - 1) * 2).toFixed(1) + '%',
      customersMoM:   '+' + s(62, f.customers)
    },
    // 部门维度对比: 产品宽度
    deptWidth: BASE_OVERVIEW_DEPT_WIDTH.map(function(d) {
      return { dept: d.dept, width: parseFloat((d.width * (team === 'all' ? 1 : f.width)).toFixed(2)) };
    }),
    // 部门维度对比: 潜力产品
    deptPotential: BASE_OVERVIEW_DEPT_POTENTIAL.map(function(d) {
      return { dept: d.dept, sales: s(d.sales, team === 'all' ? 1 : f.sales), yoy: d.yoy };
    }),
    // 健康度评分卡
    healthScores: BASE_HEALTH_SCORES,
    // KPI 红绿灯 (当前值 vs 目标值)
    trafficLights: (function() {
      var lights = {};
      var keys = ['potential','customers','users','avgWidth','scaleCustomers','scaleRate'];
      var vals  = [BASE_OVERVIEW.potentialAmount, BASE_OVERVIEW.customers,
                   BASE_OVERVIEW.users, BASE_OVERVIEW.avgWidth, BASE_OVERVIEW.scaleCustomers,
                   parseFloat((BASE_OVERVIEW.scaleCustomers / BASE_OVERVIEW.customers * 100).toFixed(1))];
      keys.forEach(function(k, i) {
        var t = BASE_KPI_TARGETS[k];
        var cur = vals[i];
        if (team !== 'all') {
          cur = s(cur, team === 'all' ? 1 : f.sales);
        }
        var tl = kpiTrafficLight(cur, t.target);
        lights[k] = { current: cur, target: t.target, pct: tl.pct, cls: tl.cls, desc: t.desc };
      });
      return lights;
    })()
  };
};

/**
 * 生成 Width 页某个团队的数据切片
 */
App.Data.getWidth = function(team) {
  var f = SCALE[team] || SCALE['all'];

  // 优先使用导入数据
  var importedUser = (App.ImportData.UserGS && App.ImportData.UserGS.length > 0) ? App.ImportData.UserGS : null;
  var importedCust = (App.ImportData.CustGS && App.ImportData.CustGS.length > 0) ? App.ImportData.CustGS : null;
  if (importedUser || importedCust) {
    var data = (importedCust || importedUser).slice();
    if (team && team !== 'all') {
      data = data.filter(function(r) { return matchesTeam(r, team); });
    }
    var totalCust = data.length;
    var guishang = data.filter(function(r) { return r.guishang === '是'; }).length;
    var totalWidth = data.reduce(function(s, r) { return s + (r.width || 0); }, 0);
    var avgW = totalCust > 0 ? (totalWidth / totalCust).toFixed(2) : '0';
    var allProds = App.ImportData.PRODS || [];
    var distBuckets = [0, 0, 0, 0, 0, 0];
    data.forEach(function(r) { var w = r.width || 0; if (w === 0) distBuckets[0]++; else if (w <= 3) distBuckets[1]++; else if (w <= 6) distBuckets[2]++; else if (w <= 10) distBuckets[3]++; else if (w <= 15) distBuckets[4]++; else distBuckets[5]++; });
    var teamMap = {};
    data.forEach(function(r) { var t = r.dept || '未分组'; if (!teamMap[t]) teamMap[t] = { total: 0, count: 0 }; teamMap[t].total += (r.width || 0); teamMap[t].count++; });
    var teamEntries = Object.entries(teamMap).sort(function(a,b) { return (b[1].total/b[1].count) - (a[1].total/a[1].count); });
    var teamDimData = teamEntries.map(function(e) { return { team: e[0], avgWidth: (e[1].total / e[1].count).toFixed(2), count: e[1].count }; });
    var prodCoverage = allProds.map(function(p) { var cnt = data.filter(function(r) { return r.prods && r.prods[p]; }).length; return { name: p, rate: totalCust > 0 ? parseFloat((cnt / totalCust * 100).toFixed(1)) : 0, count: cnt }; });
    var sorted = data.slice().sort(function(a,b) { return (b.width||0) - (a.width||0); });
    function custSummary(r) { var a = Object.keys(r.prods||{}).filter(function(k) { return r.prods[k]; }); return { name: r.user || r.name || '', avgW: r.width || 0, gsCnt: (r.guishang === '是' ? '1' : '0') + '/1', soldCnt: a.length, sold: a, person: r.sales || '' }; }
    function userSummary(r) { var a = Object.keys(r.prods||{}).filter(function(k) { return r.prods[k]; }); return { name: r.user || '', avgW: r.width || 0, custCnt: 1, soldCnt: a.length, sold: a, custs: r.sales || '' }; }
    var userData = importedUser || data;
    var userSorted = userData.slice().sort(function(a,b) { return (b.width||0) - (a.width||0); });
    var crossMatrix = allProds.slice(0, 10).map(function(pi, i) { return allProds.slice(0, 10).map(function(pj, j) { if (j <= i) return 0; var both = data.filter(function(r) { return r.prods && r.prods[pi] && r.prods[pj]; }).length; var base = data.filter(function(r) { return r.prods && r.prods[pi]; }).length; return base > 0 ? parseFloat((both / base).toFixed(1)) : 0; }); });
    return {
      kpi: { customers: totalCust, scaleUp: guishang, scaleUsers: Math.round(guishang * 0.32), nonScale: totalCust - guishang, avgWidth: avgW, coverage: totalCust > 0 ? (guishang / totalCust * 100).toFixed(1) + '%' : '0%', widthYoY: '-', customersMoM: 0, coverageYoY: '-' },
      missing: prodCoverage.slice().sort(function(a,b) { return a.rate - b.rate; }).slice(0, 10).map(function(p) { return { product: p.name, covered: p.count, missing: totalCust - p.count, rate: p.rate.toFixed(1) + '%', bar: Math.min(100, Math.round(p.rate)) }; }),
      chartDist: { labels: ['0','1-3','4-6','7-10','11-15','16+'], data: distBuckets },
      chartTeam: { labels: teamEntries.map(function(e) { return e[0]; }), data: teamEntries.map(function(e) { return parseFloat((e[1].total / e[1].count).toFixed(1)); }) },
      chartCov: { labels: prodCoverage.map(function(p) { return p.name; }), data: prodCoverage.map(function(p) { return p.rate; }) },
      chartReg: { customers: totalCust, avgWidth: parseFloat(avgW) },
      heatmap: { total: totalCust, products: prodCoverage },
      custGood: sorted.slice(0, 20).map(custSummary),
      custBad: sorted.slice(-20).reverse().map(custSummary),
      custSegment: sorted.slice(0, Math.min(30, sorted.length)).map(function(r) { return { name: r.user || r.name || '', sales: (r.width || 0) * 100, width: r.width || 0, person: r.sales || '' }; }),
      crossSell: { prods: allProds.slice(0, 10), matrix: crossMatrix, bundles: [] },
      userGood: userSorted.slice(0, 10).map(userSummary),
      userBad: userSorted.slice(-10).reverse().map(userSummary),
      teamDimension: { prods: allProds, teams: teamDimData },
      widthRank: sorted.slice(0, 10).map(function(r) { return [r.user || r.name || '', r.width || 0, (r.width || 0).toFixed(1), Math.min(10, r.width || 0), r.dept || '']; })
    };
  }

  // 无导入数据时返回空状态
  return {
    kpi: { customers: 0, scaleUp: 0, scaleUsers: 0, nonScale: 0, avgWidth: '0', coverage: '0%', widthYoY: '-', customersMoM: 0, coverageYoY: '-' },
    missing: [],
    chartDist: { labels: ['0','1-3','4-6','7-10','11-15','16+'], data: [0,0,0,0,0,0] },
    chartTeam: { labels: [], data: [] },
    chartCov: { labels: (App.ImportData.PRODS || []).slice(0, 27), data: [] },
    chartReg: { customers: 0, avgWidth: 0 },
    heatmap: { total: 0, products: [] },
    custGood: [],
    custBad: [],
    custSegment: [],
    crossSell: { prods: [], matrix: [], bundles: [] },
    userGood: [],
    userBad: [],
    teamDimension: { prods: (App.ImportData.PRODS || []), teams: [] },
    widthRank: []
  };
};

/**
 * 生成 Potential 页某个团队的数据切片
 */
App.Data.getPotential = function(team) {
  var f = SCALE[team] || SCALE['all'];

  // 优先使用导入数据
  var importedCust = (App.ImportPotential.CustRAW && App.ImportPotential.CustRAW.length > 0) ? App.ImportPotential.CustRAW : null;
  var importedUser = (App.ImportPotential.UserRAW && App.ImportPotential.UserRAW.length > 0) ? App.ImportPotential.UserRAW : null;
  var imported = importedCust || importedUser;
  if (imported) {
    var rawData = imported.slice();
    if (team && team !== 'all') {
      rawData = rawData.filter(function(r) { return matchesTeam(r, team); });
    }
    var totalSales = rawData.reduce(function(sum, r) { return sum + (r.amount || r.outAmt || 0); }, 0);
    var totalPrev = rawData.reduce(function(sum, r) { return sum + (r.amountPrev || r.outAmtPrev || 0); }, 0);
    var prodSet = {}; rawData.forEach(function(r) { var p = r.product || ''; if (p) prodSet[p] = (prodSet[p] || 0) + (r.amount || r.outAmt || 0); });
    var prodList = Object.keys(prodSet).sort(function(a,b) { return prodSet[b] - prodSet[a]; });
    var custCount = rawData.length;
    var top10 = prodList.slice(0, 10).map(function(p) {
      var pr = rawData.filter(function(r) { return r.product === p; });
      var pAmt = pr.reduce(function(s, r) { return s + (r.amount || r.outAmt || 0); }, 0);
      var pAmtPrev = pr.reduce(function(s, r) { return s + (r.amountPrev || r.outAmtPrev || 0); }, 0);
      var pQty = pr.reduce(function(s, r) { return s + (r.qty || r.outQty || 0); }, 0);
      var pQtyPrev = pr.reduce(function(s, r) { return s + (r.qtyPrev || r.outQtyPrev || 0); }, 0);
      var amtYoy = calcYoy(pAmt, pAmtPrev);
      var qtyYoy = (pQtyPrev === 0 && pQty > 0) ? '+100%' : (pQtyPrev > 0 ? ((pQty - pQtyPrev) / pQtyPrev * 100).toFixed(1) + '%' : '-');
      return { product: p, sales: '¥ ' + pAmt.toFixed(0) + '万', yoy: amtYoy, qty: qtyYoy, type: calcType(amtYoy, qtyYoy) };
    });
    var sharePct = totalPrev > 0 ? (totalSales / totalPrev * 100).toFixed(1) : '100.0';
    var deptMap = {};
    rawData.forEach(function(r) { var d = r.dept3 || r.dept4 || '未分组'; if (!deptMap[d]) deptMap[d] = 0; deptMap[d] += (r.amount || r.outAmt || 0); });
    var deptRank = Object.entries(deptMap).sort(function(a,b) { return b[1] - a[1]; }).slice(0, 8).map(function(e) { return [e[0], e[1], '+0%', '0%']; });
    var prodComposition = prodList.slice(0, 12).map(function(p) { return { name: p, amount: prodSet[p] || 0 }; });
    var quadrant = top10.map(function(p) {
      var yv = parseFloat(p.yoy) || 0, qv = parseFloat(p.qty) || 0;
      return { prodName: p.product, x: qv, y: yv, amount: parseFloat(String(p.sales).replace(/[^0-9.]/g, '')) || 0 };
    });
    return {
      kpi: { sales: '¥ ' + totalSales.toFixed(0) + '万', share: sharePct + '%', upCount: 0, upAmount: '¥ 0万', downCount: 0, downAmount: '¥ 0万', newCount: 0, newAmount: '¥ 0万' },
      top10: top10,
      matrix: [],
      salesRank: [],
      overview: { sales: totalSales, salesPrev: totalPrev || 0, productCount: prodList.length, customerCount: custCount, customerPrev: 0, avgPrice: parseFloat((totalSales / Math.max(1, custCount)).toFixed(1)), deptCount: Object.keys(deptMap).length },
      teamProdMatrix: [],
      deptRank: deptRank,
      prodComposition: prodComposition,
      prodYoY: { months: [], data: [] },
      quadrant: quadrant,
      gapHeatmap: { prods: [], teams: [] },
      salesPotentialRank: []
    };
  }

  // 无导入数据时返回空状态
  return {
    kpi: { sales: '¥ 0万', share: '0%', upCount: 0, upAmount: '¥ 0万', downCount: 0, downAmount: '¥ 0万', newCount: 0, newAmount: '¥ 0万' },
    top10: [],
    matrix: [],
    salesRank: [],
    overview: { sales: 0, salesPrev: 0, productCount: 0, customerCount: 0, customerPrev: 0, avgPrice: 0, deptCount: 0 },
    teamProdMatrix: [],
    deptRank: [],
    prodComposition: [],
    prodYoY: { months: [], data: [] },
    quadrant: [],
    gapHeatmap: { prods: [], teams: [] },
    salesPotentialRank: []
  };
};

// ===== 客户维度 — 产品宽度明细数据（团队分析） =====
// 字段: team(团队), account(CRM账号), user(最终用户), width(产品宽度合计), guishang(是否规上 1/0), prods(产品覆盖对象)
App.WidthCustomer = {};
App.WidthCustomer.PRODUCTS = ['IPC','NVR','门禁','球机','LCD与解码','新业务','通用软件','网络产品','存储','专用摄像机','服务器','智能交通','移动终端','出入口停车','行业软件','对讲','报警','音频产品','人员通道','LED与拼控','综合布线','智慧屏','基础软件','传感产品','网络安全','智能计算','消防'];

App.WidthCustomer.RAW = [];

// 账号 → 中文姓名映射（用于个人维度展示）
App.WidthCustomer.ACCOUNT_NAMES = {
  'liaobeibei': '廖贝贝', 'wangzhiqiang': '王志强', 'chensiyuan': '陈思源',
  'limengqi': '李梦琪', 'fangweijian': '房伟建', 'zhangwei': '张伟',
  'zhangjicheng': '张继成', 'panzhongnan': '潘仲楠', 'luoxinghua': '罗兴华',
  'huangyanbin': '黄燕滨', 'zhuxuhao': '朱绪浩', 'zhaoqichao': '赵启超',
  'lijinfu': '李金富', 'zhangdongzhu': '张栋柱', 'chengangsz': '陈刚',
  'liuwenyu': '刘文宇', 'zhudi7': '朱迪', 'dengchang': '邓畅'
};
App.WidthCustomer.getDisplayName = function(account) {
  return App.WidthCustomer.ACCOUNT_NAMES[account] || account;
};

// 返回所有团队列表
App.WidthCustomer.getTeams = function() {
  var set = {};
  App.WidthCustomer.RAW.forEach(function(r) { set[r.team] = true; });
  return Object.keys(set).sort();
};

// ===== 团队维度 — 团队小组 × 潜力产品 · 本期 vs 同期对照表（乔梦杰版） =====
App.WidthTeamMatrix = {};
App.WidthTeamMatrix.PRODUCTS = ['观澜编码产品（非大模型）','出入口停车','前端大模型','网络产品','后端大模型(文搜大模型）','人员通道','会议平板与视频会议','国密产品','执法记录仪','物联安全','音频产品'];

// 颗粒化数据: 每条记录 = 一个团队小组 × 一个产品 的本期/同期销售额（万元）
// ===== 团队维度 — 大部门 × 产品 差距热图数据 =====
App.WidthTeamGap = {};
App.WidthTeamGap.PRODUCTS = ['IPC','NVR','门禁','球机','LCD与解码','存储','网络产品','智能交通'];
App.WidthTeamGap.TEAMS = [];

// 团队维度 — 团队小组 × 潜力产品 · 本期 vs 同期对照表
App.WidthTeamMatrix = {};
App.WidthTeamMatrix.PRODUCTS = ['观澜编码产品（非大模型）','出入口停车','前端大模型','网络产品','后端大模型(文搜大模型）','人员通道','会议平板与视频会议','国密产品','执法记录仪','物联安全','音频产品'];
App.WidthTeamMatrix.RAW = [
  // === 行业二部 - 政府行业组 ===
  { team:'政府行业组-陈思源', product:'观澜编码产品（非大模型）', amount: 380, amountPrev: 290 },
  { team:'政府行业组-陈思源', product:'出入口停车', amount: 120, amountPrev: 100 },
  { team:'政府行业组-陈思源', product:'前端大模型', amount: 280, amountPrev: 0 },
  { team:'政府行业组-陈思源', product:'网络产品', amount: 180, amountPrev: 200 },
  { team:'政府行业组-陈思源', product:'后端大模型(文搜大模型）', amount: 340, amountPrev: 0 },
  { team:'政府行业组-陈思源', product:'人员通道', amount: 65, amountPrev: 55 },
  { team:'政府行业组-陈思源', product:'会议平板与视频会议', amount: 220, amountPrev: 180 },
  { team:'政府行业组-陈思源', product:'国密产品', amount: 150, amountPrev: 120 },
  { team:'政府行业组-陈思源', product:'执法记录仪', amount: 90, amountPrev: 70 },
  { team:'政府行业组-陈思源', product:'物联安全', amount: 160, amountPrev: 130 },
  { team:'政府行业组-陈思源', product:'音频产品', amount: 85, amountPrev: 95 },
  // === 行业二部 - 公安交警行业组 ===
  { team:'公安交警行业组-张伟', product:'观澜编码产品（非大模型）', amount: 280, amountPrev: 240 },
  { team:'公安交警行业组-张伟', product:'出入口停车', amount: 80, amountPrev: 70 },
  { team:'公安交警行业组-张伟', product:'前端大模型', amount: 60, amountPrev: 0 },
  { team:'公安交警行业组-张伟', product:'网络产品', amount: 150, amountPrev: 160 },
  { team:'公安交警行业组-张伟', product:'后端大模型(文搜大模型）', amount: 120, amountPrev: 0 },
  { team:'公安交警行业组-张伟', product:'人员通道', amount: 90, amountPrev: 85 },
  { team:'公安交警行业组-张伟', product:'会议平板与视频会议', amount: 180, amountPrev: 150 },
  { team:'公安交警行业组-张伟', product:'国密产品', amount: 200, amountPrev: 170 },
  { team:'公安交警行业组-张伟', product:'执法记录仪', amount: 240, amountPrev: 200 },
  { team:'公安交警行业组-张伟', product:'物联安全', amount: 130, amountPrev: 110 },
  { team:'公安交警行业组-张伟', product:'音频产品', amount: 60, amountPrev: 65 },
  // === 行业一部 - 工业企业一组 ===
  { team:'工业企业一组-潘仲楠', product:'观澜编码产品（非大模型）', amount: 250, amountPrev: 220 },
  { team:'工业企业一组-潘仲楠', product:'出入口停车', amount: 60, amountPrev: 50 },
  { team:'工业企业一组-潘仲楠', product:'前端大模型', amount: 180, amountPrev: 0 },
  { team:'工业企业一组-潘仲楠', product:'网络产品', amount: 120, amountPrev: 110 },
  { team:'工业企业一组-潘仲楠', product:'后端大模型(文搜大模型）', amount: 80, amountPrev: 0 },
  { team:'工业企业一组-潘仲楠', product:'人员通道', amount: 45, amountPrev: 40 },
  { team:'工业企业一组-潘仲楠', product:'会议平板与视频会议', amount: 140, amountPrev: 120 },
  { team:'工业企业一组-潘仲楠', product:'国密产品', amount: 70, amountPrev: 60 },
  { team:'工业企业一组-潘仲楠', product:'执法记录仪', amount: 55, amountPrev: 45 },
  { team:'工业企业一组-潘仲楠', product:'物联安全', amount: 100, amountPrev: 85 },
  { team:'工业企业一组-潘仲楠', product:'音频产品', amount: 80, amountPrev: 75 },
  // === 行业一部 - 智慧建筑组 ===
  { team:'智慧建筑组-赵启超', product:'观澜编码产品（非大模型）', amount: 180, amountPrev: 160 },
  { team:'智慧建筑组-赵启超', product:'出入口停车', amount: 150, amountPrev: 130 },
  { team:'智慧建筑组-赵启超', product:'前端大模型', amount: 100, amountPrev: 0 },
  { team:'智慧建筑组-赵启超', product:'网络产品', amount: 90, amountPrev: 95 },
  { team:'智慧建筑组-赵启超', product:'后端大模型(文搜大模型）', amount: 200, amountPrev: 0 },
  { team:'智慧建筑组-赵启超', product:'人员通道', amount: 55, amountPrev: 50 },
  { team:'智慧建筑组-赵启超', product:'会议平板与视频会议', amount: 110, amountPrev: 95 },
  { team:'智慧建筑组-赵启超', product:'国密产品', amount: 80, amountPrev: 70 },
  { team:'智慧建筑组-赵启超', product:'执法记录仪', amount: 40, amountPrev: 35 },
  { team:'智慧建筑组-赵启超', product:'物联安全', amount: 180, amountPrev: 150 },
  { team:'智慧建筑组-赵启超', product:'音频产品', amount: 50, amountPrev: 55 },
  // === 客户销售一部 - 客户销售一组 ===
  { team:'客户销售一组-张栋柱', product:'观澜编码产品（非大模型）', amount: 160, amountPrev: 140 },
  { team:'客户销售一组-张栋柱', product:'出入口停车', amount: 70, amountPrev: 60 },
  { team:'客户销售一组-张栋柱', product:'前端大模型', amount: 80, amountPrev: 0 },
  { team:'客户销售一组-张栋柱', product:'网络产品', amount: 100, amountPrev: 105 },
  { team:'客户销售一组-张栋柱', product:'后端大模型(文搜大模型）', amount: 60, amountPrev: 0 },
  { team:'客户销售一组-张栋柱', product:'人员通道', amount: 40, amountPrev: 38 },
  { team:'客户销售一组-张栋柱', product:'会议平板与视频会议', amount: 90, amountPrev: 80 },
  { team:'客户销售一组-张栋柱', product:'国密产品', amount: 50, amountPrev: 45 },
  { team:'客户销售一组-张栋柱', product:'执法记录仪', amount: 35, amountPrev: 30 },
  { team:'客户销售一组-张栋柱', product:'物联安全', amount: 70, amountPrev: 60 },
  { team:'客户销售一组-张栋柱', product:'音频产品', amount: 60, amountPrev: 58 },
  // === 客户销售二部 - 客户销售六组 ===
  { team:'客户销售六组-陈刚', product:'观澜编码产品（非大模型）', amount: 140, amountPrev: 125 },
  { team:'客户销售六组-陈刚', product:'出入口停车', amount: 55, amountPrev: 48 },
  { team:'客户销售六组-陈刚', product:'前端大模型', amount: 50, amountPrev: 0 },
  { team:'客户销售六组-陈刚', product:'网络产品', amount: 85, amountPrev: 90 },
  { team:'客户销售六组-陈刚', product:'后端大模型(文搜大模型）', amount: 40, amountPrev: 0 },
  { team:'客户销售六组-陈刚', product:'人员通道', amount: 35, amountPrev: 32 },
  { team:'客户销售六组-陈刚', product:'会议平板与视频会议', amount: 75, amountPrev: 68 },
  { team:'客户销售六组-陈刚', product:'国密产品', amount: 45, amountPrev: 40 },
  { team:'客户销售六组-陈刚', product:'执法记录仪', amount: 30, amountPrev: 25 },
  { team:'客户销售六组-陈刚', product:'物联安全', amount: 55, amountPrev: 48 },
  { team:'客户销售六组-陈刚', product:'音频产品', amount: 50, amountPrev: 52 }
];

// ===== 数据导入与管理 — 数据源（按导入模版表头设计） =====
App.ImportData = {};
App.ImportData.currentDS = 'user'; // user | cust

// 27产品列（与导入模版完全一致）
App.ImportData.PRODS = [
  'IPC','球机','专用摄像机','服务器','网络产品','PC产品',
  'NVR','存储','LED与拼控','LCD与解码','智能交通','移动终端产品',
  '出入口停车','门禁','对讲','人员通道','报警','音频产品',
  '传感产品','智慧屏与视频会议','通用软件','行业软件','基础软件',
  '新业务（热成像/睿影/消防等）','网络安全','综合布线与机柜机房','智能计算'
];
// 短标签映射（用于表头显示）
App.ImportData.shortProds = ['IPC','球机','专摄','服务器','网络','PC','NVR','存储','LED拼控','LCD解码','智交','移端','停车','门禁','对讲','通道','报警','音频','传感','智慧屏','通用','行软','基础','新业务','网安','布线','智算'];

// 数据源1: 规上用户-产品线宽度
App.ImportData.UserGS = [];

// 数据源2: 客户产品线覆盖
App.ImportData.CustGS = [];

// 返回已启用数据源的团队列表
App.ImportData.getTeams = function() {
  var data = App.ImportData.currentDS === 'user' ? App.ImportData.UserGS : App.ImportData.CustGS;
  var set = {};
  data.forEach(function(r) { set[r.dept] = true; });
  return Object.keys(set).sort();
};

// ===== 潜力产品 — 数据导入与管理（按导入模版表头设计） =====
App.ImportPotential = {};
App.ImportPotential.currentDS = 'cust'; // cust | user

// 潜力产品列表（用于筛选下拉）
App.ImportPotential.PRODUCTS = ['观澜编码产品（非大模型）','出入口停车','前端大模型','网络产品','后端大模型(文搜大模型）','人员通道','会议平板与视频会议','国密产品','执法记录仪','物联安全','音频产品'];

// 数据源1: 潜力产品-客户 (20条模拟)
App.ImportPotential.CustRAW = [];

// 数据源2: 潜力产品-用户 (16条模拟)
App.ImportPotential.UserRAW = [];

// ===== 角色权限数据 =====
App.ROLE_PERMISSIONS = [
  { role: 'admin',     name: '管理员',     modules: { overview:1, width:1, potential:1, users:1, roles:1, products:1, params:1, audit:1, backup:1, export:1, import:1 }, desc: '全部功能 + 用户管理' },
  { role: 'gm',        name: '总经理',     modules: { overview:1, width:1, potential:1, users:1, roles:0, products:0, params:0, audit:1, backup:1, export:1, import:1 }, desc: '全局查看 + 导出备份' },
  { role: 'operation', name: '运营',       modules: { overview:1, width:1, potential:1, admin:0, users:0, roles:0, products:0, params:0, audit:1, backup:0, export:1, import:1 }, desc: '全局查看 + 导出' },
  { role: 'director',  name: '总监',       modules: { overview:1, width:1, potential:1, admin:0, users:0, roles:0, products:0, params:0, audit:0, backup:0, export:1, import:1 }, desc: '本部门数据查看' },
  { role: 'manager',   name: '主管',       modules: { overview:1, width:1, potential:1, admin:0, users:0, roles:0, products:0, params:0, audit:0, backup:0, export:0, import:0 }, desc: '本组数据查看' },
  { role: 'interface', name: '接口人',     modules: { overview:1, width:1, potential:1, admin:0, users:0, roles:0, products:0, params:0, audit:0, backup:0, export:0, import:0 }, desc: '数据对接查看' },
  { role: 'sales',     name: '一线销售',   modules: { overview:1, width:1, potential:1, admin:0, users:0, roles:0, products:0, params:0, audit:0, backup:0, export:0, import:0 }, desc: '本人数据查看' }
];

// ===== 产品字典数据（涵盖产品宽度 + 潜力产品所有品类） =====
App.PRODUCT_DICT = [
  // === 潜力产品（11个） ===
  { id:1,  name:'观澜编码产品（非大模型）', alias:'观澜编码',        category:'软件',  is_potential:1, sort:1  },
  { id:2,  name:'出入口停车',             alias:'停车管理',        category:'前端',  is_potential:1, sort:2  },
  { id:3,  name:'前端大模型',             alias:'前端AI模型',      category:'软件',  is_potential:1, sort:3  },
  { id:4,  name:'网络产品',               alias:'交换机/路由器',   category:'网络',  is_potential:1, sort:4  },
  { id:5,  name:'后端大模型(文搜大模型）',alias:'后端AI模型',      category:'软件',  is_potential:1, sort:5  },
  { id:6,  name:'人员通道',               alias:'通道闸机',        category:'前端',  is_potential:1, sort:6  },
  { id:7,  name:'会议平板与视频会议',     alias:'会议平板',        category:'显示',  is_potential:1, sort:7  },
  { id:8,  name:'国密产品',               alias:'国密安全',        category:'网络',  is_potential:1, sort:8  },
  { id:9,  name:'执法记录仪',             alias:'执法仪',          category:'前端',  is_potential:1, sort:9  },
  { id:10, name:'物联安全',               alias:'物联网安全',      category:'网络',  is_potential:1, sort:10 },
  { id:11, name:'音频产品',               alias:'音频设备',        category:'前端',  is_potential:1, sort:11 },
  // === 产品宽度常规产品 ===
  { id:12, name:'IPC',              alias:'网络摄像机',      category:'前端',  is_potential:0, sort:12 },
  { id:13, name:'球机',             alias:'球型摄像机',      category:'前端',  is_potential:0, sort:13 },
  { id:14, name:'专用摄像机',       alias:'专网摄像机',      category:'前端',  is_potential:0, sort:14 },
  { id:15, name:'服务器',           alias:'服务器设备',      category:'后端',  is_potential:0, sort:15 },
  { id:16, name:'存储',             alias:'存储设备',        category:'后端',  is_potential:0, sort:16 },
  { id:17, name:'LCD与解码',        alias:'大屏显示',        category:'显示',  is_potential:0, sort:17 },
  { id:18, name:'LED与拼控',        alias:'LED显示屏',       category:'显示',  is_potential:0, sort:18 },
  { id:19, name:'移动终端产品',     alias:'移动终端',        category:'前端',  is_potential:0, sort:19 },
  { id:20, name:'对讲',             alias:'对讲设备',        category:'前端',  is_potential:0, sort:20 },
  { id:21, name:'报警',             alias:'报警设备',        category:'前端',  is_potential:0, sort:21 },
  { id:22, name:'PCP产品',          alias:'PC产品',          category:'后端',  is_potential:0, sort:22 },
  { id:23, name:'综合布线与机柜',   alias:'综合布线',        category:'网络',  is_potential:0, sort:23 },
  { id:24, name:'基础软件',         alias:'基础平台软件',    category:'软件',  is_potential:0, sort:24 },
  { id:25, name:'通用软件',         alias:'通用平台软件',    category:'软件',  is_potential:0, sort:25 },
  { id:26, name:'行业软件',         alias:'行业应用软件',    category:'软件',  is_potential:0, sort:26 },
  { id:27, name:'网络安全',         alias:'安全设备',        category:'网络',  is_potential:0, sort:27 },
  { id:28, name:'传感产品',         alias:'传感器',          category:'前端',  is_potential:0, sort:28 },
  { id:29, name:'智能交通',         alias:'交通管理',        category:'前端',  is_potential:0, sort:29 },
  { id:30, name:'平台软件',         alias:'平台管理软件',    category:'软件',  is_potential:0, sort:30 },
  { id:31, name:'新业务',           alias:'热成像/消防等',   category:'创新',  is_potential:0, sort:31 },
];

// ===== 业务参数数据 =====
App.BUSINESS_PARAMS = {
  guishang: { label:'规上客户标准', value:3, unit:'个产品品类', desc:'产品宽度 >= 此值的客户视为规上客户' },
  kpiSales: { label:'年度销售目标', value:28000, unit:'万元', desc:'全平台年度潜力产品销售目标额' },
  kpiWidth: { label:'平均宽度目标', value:4.0, unit:'品类', desc:'全平台客均产品宽度目标值' },
  kpiCoverage: { label:'覆盖率目标', value:75, unit:'%', desc:'规上客户覆盖率目标' },
  refreshInterval: { label:'数据刷新间隔', value:24, unit:'小时', desc:'后端数据自动刷新间隔' },
  alertThreshold: { label:'预警阈值', value:-10, unit:'%', desc:'同比跌幅超过此值触发预警（负值）' },
  retentionDays: { label:'审计日志保留', value:180, unit:'天', desc:'操作日志和审计日志保留天数' },
  backupAuto: { label:'自动备份', value:'启用', unit:'', desc:'是否每日凌晨自动生成全量备份' }
};

// ===== 审计日志数据 =====
App.AUDIT_LOGS = [
  { time:'2026-07-21 10:42:17', user:'guchengcheng',name:'顾城成',action:'用户登录',     target:'系统',           detail:'总经理通过密码登录系统',                                     ip:'192.168.1.120' },
  { time:'2026-07-20 15:10:48', user:'luoxinghua', name:'罗兴华', action:'查看页面',      target:'产品宽度分析',   detail:'进入产品宽度-用户维度页面',                                   ip:'192.168.1.125' },
  { time:'2026-07-19 09:05:22', user:'zhangdongzhu',name:'张栋柱',action:'用户登录',    target:'系统',           detail:'主管通过密码登录系统',                                       ip:'192.168.1.140' },
  { time:'2026-07-19 10:33:09', user:'zhudi7',    name:'朱迪',   action:'查看页面',      target:'产品宽度分析',   detail:'进入产品宽度-数据导入与管理页面',                           ip:'192.168.1.142' },
];

// ===== 租户信息数据 =====
App.TENANT_INFO = {
  name: '深圳业务中心',
  code: 'SZ_BIZ_001',
  fullName: '深圳市海信联创科技有限公司 · 深圳业务中心',
  industry: '安防/智能物联',
  createdAt: '2025-01-15',
  admin: '顾城成 (guchengcheng)',
  status: 'active',
  desc: '负责深圳市及周边区域的产品销售与客户管理，涵盖政府、公安、教育、交通等多个行业领域。'
};

App.TENANT_ORGS = [
  { type:'dept', name:'客户销售一部',     leader:'高巍',   groups:['客户销售一组','客户销售二组','客户销售三组'],          memberCount:38,  desc:'负责通用客户的产品销售与宽度覆盖' },
  { type:'dept', name:'客户销售二部',     leader:'吴正豪', groups:['客户销售四组','客户销售五组'],                          memberCount:28,  desc:'负责通用客户的产品销售与宽度覆盖' },
  { type:'dept', name:'大客户销售部',     leader:'韩杰',   groups:['政府行业组','公安交警行业组'],                              memberCount:32,  desc:'负责战略大客户的深度经营与关系维护' },
  { type:'dept', name:'场景数字化销售部', leader:'明良斌', groups:['场景数字化组'],                                          memberCount:22,  desc:'负责场景化解决方案的销售推广' },
  { type:'dept', name:'行业一部',         leader:'卫玉昌', groups:['工业企业一组','智慧建筑组','智慧商贸组','工业企业一组'], memberCount:45,  desc:'覆盖工业/建筑/商贸/教育等行业客户' },
  { type:'dept', name:'行业二部',         leader:'房伟建', groups:['政府行业组','文教卫组','交通行业组','司法行业组'],      memberCount:52,  desc:'覆盖政府/文教卫/交通/司法等行业客户' },
  { type:'dept', name:'运营部',           leader:'江英',   groups:[],                                                        memberCount:8,   desc:'运营数据分析与业务支撑' }
];

// ===== 差距分析-按维度数据 =====
App.GAP_DATA = {
  dept3: {  // 大部门维度 (复用已有)
    prods: BASE_GAP_HEATMAP_PRODS,
    teams: BASE_GAP_HEATMAP_TEAMS
  },
  dept4: {  // 团队小组维度
    prods: ['NVR','智能计算','IPC','平台软件','门禁','智能交通','存储','LCD与解码'],
    teams: [
      { team: '政府行业组-陈思源组', data: [850,480,580,420,180, 90,220,150] },
      { team: '政府行业组-王志强组', data: [720,380,420,320,130, 60,180,110] },
      { team: '政府行业组-李梦琪组', data: [480,220,280,180, 90, 40,130, 80] },
      { team: '政府行业组-廖贝贝组', data: [380,180,220,150, 70, 30,100, 60] },
      { team: '公安交警行业组-张伟组',   data: [380, 60,250,130,240,120, 95, 60] },
      { team: '公安交警行业组-张继成组', data: [280, 40,180, 90,180, 80, 70, 45] },
      { team: '工业企业一组-罗兴华组', data: [220, 30,130,220, 50, 25, 55, 75] },
      { team: '工业企业一组-黄燕滨组', data: [180, 25, 95,180, 40, 20, 40, 50] },
      { team: '工业企业一组-潘仲楠组', data: [150, 20, 80,140, 30, 15, 35, 40] },
      { team: '智慧建筑组-赵启超组', data: [130, 15, 80, 65, 35,380, 50, 30] },
      { team: '智慧建筑组-李金富组', data: [ 95,  8, 55, 45, 25,250, 30, 20] },
      { team: '智慧建筑组-朱绪浩组', data: [ 80,  5, 45, 35, 20,200, 25, 15] }
    ]
  },
  person: {  // 销售人员维度
    prods: ['NVR','智能计算','IPC','平台软件','门禁','智能交通','存储','LCD与解码'],
    teams: [
      { team: '陈思源', data: [850,480,580,420,180, 90,220,150] },
      { team: '王志强', data: [720,380,420,320,130, 60,180,110] },
      { team: '张伟',   data: [380, 60,250,130,240,120, 95, 60] },
      { team: '陈伟杰', data: [350,420,200,150, 60, 30, 90, 70] },
      { team: '李梦琪', data: [480,220,280,180, 90, 40,130, 80] },
      { team: '罗兴华', data: [220, 30,130,220, 50, 25, 55, 75] },
      { team: '黄燕滨', data: [180, 25, 95,180, 40, 20, 40, 50] },
      { team: '赵启超', data: [130, 15, 80, 65, 35,380, 50, 30] },
      { team: '张继成', data: [280, 40,180, 90,180, 80, 70, 45] },
      { team: '李金富', data: [ 95,  8, 55, 45, 25,250, 30, 20] },
      { team: '廖贝贝', data: [380,180,220,150, 70, 30,100, 60] },
      { team: '潘仲楠', data: [150, 20, 80,140, 30, 15, 35, 40] }
    ]
  }
};

App.ImportPotential.getDepts = function() {
  var data = App.ImportPotential.currentDS === 'cust' ? App.ImportPotential.CustRAW : App.ImportPotential.UserRAW;
  var set = {};
  data.forEach(function(r) { set[r.dept4 || r.dept3] = true; });
  return Object.keys(set).sort();
};

App.ImportPotential.getProducts = function() {
  var data = App.ImportPotential.currentDS === 'cust' ? App.ImportPotential.CustRAW : App.ImportPotential.UserRAW;
  var set = {};
  data.forEach(function(r) { set[r.product] = true; });
  return Object.keys(set).sort();
};

// ===== 导入后动态重建派生数据（所有硬编码 → 导入数据驱动）=====
App.Data.rebuildDerived = function() {
  var raw = App.ImportPotential.CustRAW || [];
  if (raw.length > 0) {
    // 重建 WidthTeamMatrix.RAW
    var agg = {};
    raw.forEach(function(r) {
      var team = r.dept4 || r.dept3 || '';
      var prod = r.product || '';
      if (!team || !prod) return;
      var key = team + '|' + prod;
      if (!agg[key]) agg[key] = { team: team, product: prod, amount: 0, amountPrev: 0 };
      agg[key].amount += r.amount || 0;
      agg[key].amountPrev += r.amountPrev || 0;
    });
    var result = Object.values(agg);
    if (result.length > 0) {
      App.WidthTeamMatrix.RAW = result;
      var ps = {}; result.forEach(function(r) { ps[r.product] = true; });
      App.WidthTeamMatrix.PRODUCTS = Object.keys(ps);
      App.ImportPotential.PRODUCTS = App.WidthTeamMatrix.PRODUCTS;
    }
    // 更新 ALL_POT_PRODUCTS
    var potSet = {};
    raw.forEach(function(r) { if (r.product) potSet[r.product] = true; });
    App.ALL_POT_PRODUCTS = Object.keys(potSet);
  }
  // 触发全平台刷新
  try { App.updateWidth(); } catch(e) {}
  try { App.updatePotential(); } catch(e) {}
  try { App.updateOverview(); } catch(e) {}
};
