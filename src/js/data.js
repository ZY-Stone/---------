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
  manager:   { name: '主管',    avatar: '主', badge: '主管',   color: '#ea580c', perms: '组级管理' }
};

// ===== 组织架构: 部门列表 =====
App.DEPT_LIST = ['客户销售一部', '客户销售二部', '大客户销售部', '场景数字化销售部', '行业二部', '行业一部'];

// ===== 模拟用户数据库（来自Excel权限设置清单） =====
App.MOCK_USERS = [
  { id:101, username:'高巍', name:'高巍', role:'director', dept:'客户销售一部', group:'-', ld:'-' },
  { id:102, username:'翁焕植', name:'翁焕植', role:'interface', dept:'客户销售一部', group:'-', ld:'高巍' },
  { id:103, username:'简刚平', name:'简刚平', role:'interface', dept:'客户销售一部', group:'-', ld:'高巍' },
  { id:105, username:'张栋柱', name:'张栋柱', role:'manager', dept:'客户销售一部', group:'客户销售一组', ld:'高巍' },
  { id:111, username:'陈刚', name:'陈刚', role:'manager', dept:'客户销售一部', group:'客户销售二组', ld:'高巍' },
  { id:121, username:'刘文宇', name:'刘文宇', role:'manager', dept:'客户销售一部', group:'客户销售四组', ld:'高巍' },
  { id:130, username:'赵志强', name:'赵志强', role:'manager', dept:'客户销售一部', group:'客户销售五组', ld:'高巍' },
  { id:131, username:'吴正豪', name:'吴正豪', role:'director', dept:'客户销售二部', group:'-', ld:'-' },
  { id:132, username:'刘辉55', name:'刘辉55', role:'interface', dept:'客户销售二部', group:'-', ld:'吴正豪' },
  { id:136, username:'朱迪', name:'朱迪', role:'manager', dept:'客户销售二部', group:'客户销售七组', ld:'吴正豪' },
  { id:142, username:'邓畅', name:'邓畅', role:'manager', dept:'客户销售二部', group:'客户销售八组', ld:'吴正豪' },
  { id:148, username:'李拥政', name:'李拥政', role:'manager', dept:'客户销售二部', group:'客户销售九组', ld:'吴正豪' },
  { id:155, username:'韩杰', name:'韩杰', role:'director', dept:'大客户销售部', group:'-', ld:'-' },
  { id:213, username:'谢彬18', name:'谢彬18', role:'interface', dept:'大客户销售部', group:'-', ld:'韩杰' },
  { id:164, username:'明良斌', name:'明良斌', role:'director', dept:'场景数字化销售部', group:'-', ld:'-' },
  { id:167, username:'房伟建', name:'房伟建', role:'director', dept:'行业二部', group:'-', ld:'-' },
  { id:168, username:'詹凯玲', name:'詹凯玲', role:'interface', dept:'行业二部', group:'-', ld:'房伟建' },
  { id:171, username:'王魁', name:'王魁', role:'manager', dept:'行业二部', group:'交通行业组', ld:'房伟建' },
  { id:177, username:'刘冬', name:'刘冬', role:'manager', dept:'行业二部', group:'司法行业组', ld:'房伟建' },
  { id:179, username:'廖北宸', name:'廖北宸', role:'manager', dept:'行业二部', group:'政府行业组', ld:'房伟建' },
  { id:183, username:'王茜', name:'王茜', role:'manager', dept:'行业二部', group:'文教卫组', ld:'房伟建' },
  { id:189, username:'卫玉昌', name:'卫玉昌', role:'director', dept:'行业一部', group:'-', ld:'-' },
  { id:190, username:'姚金成', name:'姚金成', role:'interface', dept:'行业一部', group:'-', ld:'卫玉昌' },
  { id:191, username:'潘仲楠', name:'潘仲楠', role:'manager', dept:'行业一部', group:'工业企业一组', ld:'卫玉昌' },
  { id:201, username:'朱绪浩', name:'朱绪浩', role:'manager', dept:'行业一部', group:'智慧建筑组', ld:'卫玉昌' },
  { id:206, username:'李耀东', name:'李耀东', role:'manager', dept:'行业一部', group:'智慧商贸组', ld:'卫玉昌' },
  { id:210, username:'admin', name:'管理员', role:'admin', dept:'管理部', group:'-', ld:'-' },
  { id:211, username:'jiangying', name:'江英', role:'operation', dept:'运营部', group:'-', ld:'-' },
  { id:212, username:'guchengcheng', name:'顾城成', role:'gm', dept:'深圳业务中心', group:'-', ld:'-' },
];

// ===== DEPTS =====
App.DEPTS = [
  { n: '客户销售一部', ld: '高巍', cw: 285, aw: 3.52, mw: 8, cov: 65.4, yoy: '+3.1%' },
  { n: '客户销售二部', ld: '吴正豪', cw: 256, aw: 3.28, mw: 7, cov: 60.3, yoy: '+1.8%' },
  { n: '大客户销售部', ld: '韩杰', cw: 187, aw: 3.14, mw: 6, cov: 58.7, yoy: '-0.5%' },
  { n: '场景数字化销售部', ld: '明良斌', cw: 168, aw: 3.42, mw: 7, cov: 62.5, yoy: '+4.2%' },
  { n: '行业二部', ld: '房伟建', cw: 437, aw: 4.28, mw: 10, cov: 76.5, yoy: '+8.2%' },
  { n: '行业一部', ld: '卫玉昌', cw: 312, aw: 3.85, mw: 9, cov: 68.2, yoy: '+5.6%' },
];

// ===== GROUPS =====
App.GROUPS = [
  { n: '客户销售一组', dept: '客户销售一部', ld: '张栋柱', cw: 82, aw: 3.65, mw: 7, cov: 68.4, yoy: '+4.1%' },
  { n: '客户销售二组', dept: '客户销售一部', ld: '陈刚', cw: 72, aw: 3.42, mw: 7, cov: 64.2, yoy: '+2.8%' },
  { n: '客户销售三组', dept: '客户销售一部', ld: '高巍(兼)', cw: 68, aw: 3.45, mw: 6, cov: 63.5, yoy: '+3.0%' },
  { n: '客户销售四组', dept: '客户销售一部', ld: '刘文宇', cw: 63, aw: 3.35, mw: 6, cov: 61.2, yoy: '+1.8%' },
  { n: '客户销售五组', dept: '客户销售一部', ld: '赵志强', cw: 58, aw: 3.28, mw: 6, cov: 60.5, yoy: '+2.5%' },
  { n: '客户销售六组', dept: '客户销售二部', ld: '吴正豪(兼)', cw: 68, aw: 3.28, mw: 6, cov: 60.5, yoy: '+2.0%' },
  { n: '客户销售七组', dept: '客户销售二部', ld: '朱迪', cw: 66, aw: 3.18, mw: 6, cov: 60.0, yoy: '+1.5%' },
  { n: '客户销售八组', dept: '客户销售二部', ld: '邓畅', cw: 62, aw: 3.15, mw: 5, cov: 58.8, yoy: '+1.2%' },
  { n: '客户销售九组', dept: '客户销售二部', ld: '李拥政', cw: 60, aw: 3.10, mw: 5, cov: 57.5, yoy: '+0.8%' },
  { n: '工业企业一组', dept: '行业一部', ld: '潘仲楠', cw: 88, aw: 3.95, mw: 9, cov: 72.5, yoy: '+7.2%' },
  { n: '工业企业二组', dept: '行业一部', ld: '未指定', cw: 76, aw: 3.78, mw: 8, cov: 68.8, yoy: '+5.5%' },
  { n: '智慧商贸组', dept: '行业一部', ld: '李耀东', cw: 74, aw: 3.65, mw: 7, cov: 66.2, yoy: '+4.8%' },
  { n: '智慧建筑组', dept: '行业一部', ld: '朱绪浩', cw: 74, aw: 3.72, mw: 8, cov: 66.3, yoy: '+3.5%' },
  { n: '交通行业组', dept: '行业二部', ld: '王魁', cw: 82, aw: 4.05, mw: 9, cov: 74.5, yoy: '+6.8%' },
  { n: '公安交警行业组', dept: '行业二部', ld: '房伟建(兼)', cw: 90, aw: 4.18, mw: 9, cov: 76.2, yoy: '+7.5%' },
  { n: '司法行业组', dept: '行业二部', ld: '刘冬', cw: 68, aw: 3.85, mw: 8, cov: 70.2, yoy: '+4.5%' },
  { n: '文教卫组', dept: '行业二部', ld: '王茜', cw: 92, aw: 4.20, mw: 8, cov: 73.8, yoy: '+6.2%' },
  { n: '政府行业组', dept: '行业二部', ld: '廖北宸', cw: 105, aw: 4.52, mw: 10, cov: 78.2, yoy: '+9.1%' },
];

// ===== PERSONS =====
App.PERSONS = [
  { n: '段金君', dept: '客户销售一部', grp: '-', cw: 16, aw: 4.42, mw: 8, cov: 64.6, yoy: '+0.3%' },
  { n: '彭威12', dept: '客户销售一部', grp: '客户销售一组', cw: 49, aw: 4.71, mw: 3, cov: 72.2, yoy: '-2.5%' },
  { n: '张振德', dept: '客户销售一部', grp: '客户销售一组', cw: 29, aw: 2.78, mw: 7, cov: 72.4, yoy: '+5.4%' },
  { n: '王嘉恺5', dept: '客户销售一部', grp: '客户销售一组', cw: 49, aw: 4.65, mw: 6, cov: 63.3, yoy: '+5.8%' },
  { n: '沙坤', dept: '客户销售一部', grp: '客户销售一组', cw: 15, aw: 4.93, mw: 4, cov: 74.8, yoy: '+2.1%' },
  { n: '黄燕滨', dept: '客户销售一部', grp: '客户销售一组', cw: 36, aw: 2.97, mw: 3, cov: 60.2, yoy: '-1.5%' },
  { n: '孙天6', dept: '客户销售一部', grp: '客户销售二组', cw: 53, aw: 5.04, mw: 5, cov: 77.4, yoy: '+7.9%' },
  { n: '罗肖福', dept: '客户销售一部', grp: '客户销售二组', cw: 39, aw: 4.11, mw: 3, cov: 71.2, yoy: '+9.4%' },
  { n: '陈伟添', dept: '客户销售一部', grp: '客户销售二组', cw: 38, aw: 4.36, mw: 7, cov: 62.6, yoy: '-2.0%' },
  { n: '蔡均鑫', dept: '客户销售一部', grp: '客户销售二组', cw: 33, aw: 4.48, mw: 3, cov: 78.5, yoy: '+10.0%' },
  { n: '罗兴华', dept: '客户销售一部', grp: '客户销售三组', cw: 44, aw: 3.64, mw: 8, cov: 78.0, yoy: '-0.6%' },
  { n: '王鹏旭', dept: '客户销售一部', grp: '客户销售三组', cw: 32, aw: 3.57, mw: 8, cov: 80.5, yoy: '+6.7%' },
  { n: '熊佳豪', dept: '客户销售一部', grp: '客户销售三组', cw: 25, aw: 4.33, mw: 7, cov: 75.5, yoy: '-0.5%' },
  { n: '陈春11', dept: '客户销售一部', grp: '客户销售三组', cw: 55, aw: 3.64, mw: 8, cov: 71.4, yoy: '+7.3%' },
  { n: '赵鑫阳5', dept: '客户销售一部', grp: '客户销售三组', cw: 18, aw: 5.03, mw: 4, cov: 77.7, yoy: '+9.1%' },
  { n: '徐志伟8', dept: '客户销售一部', grp: '客户销售四组', cw: 19, aw: 3.7, mw: 4, cov: 79.9, yoy: '+5.5%' },
  { n: '张宜军8', dept: '客户销售一部', grp: '客户销售四组', cw: 28, aw: 4.65, mw: 8, cov: 70.0, yoy: '+10.3%' },
  { n: '胡鹏17', dept: '客户销售一部', grp: '客户销售四组', cw: 24, aw: 4.43, mw: 5, cov: 61.4, yoy: '+8.2%' },
  { n: '陈宁8', dept: '客户销售一部', grp: '客户销售四组', cw: 52, aw: 4.12, mw: 6, cov: 79.5, yoy: '+3.0%' },
  { n: '范富山', dept: '客户销售一部', grp: '客户销售四组', cw: 23, aw: 3.16, mw: 7, cov: 69.8, yoy: '+8.3%' },
  { n: '梁资航5', dept: '客户销售一部', grp: '客户销售四组', cw: 24, aw: 5.08, mw: 8, cov: 61.8, yoy: '+7.2%' },
  { n: '雷昊明6', dept: '客户销售一部', grp: '客户销售四组', cw: 39, aw: 4.29, mw: 6, cov: 72.3, yoy: '+4.0%' },
  { n: '徐兴强', dept: '客户销售一部', grp: '客户销售四组', cw: 50, aw: 3.25, mw: 3, cov: 74.3, yoy: '-1.3%' },
  { n: '龙招军', dept: '客户销售二部', grp: '客户销售六组', cw: 32, aw: 5.15, mw: 8, cov: 66.2, yoy: '+1.4%' },
  { n: '牛璐', dept: '客户销售二部', grp: '客户销售六组', cw: 15, aw: 2.97, mw: 8, cov: 79.0, yoy: '+1.0%' },
  { n: '张如玮5', dept: '客户销售二部', grp: '客户销售六组', cw: 26, aw: 4.0, mw: 7, cov: 79.9, yoy: '+10.1%' },
  { n: '蒋宪正', dept: '客户销售二部', grp: '客户销售七组', cw: 55, aw: 3.4, mw: 7, cov: 72.6, yoy: '-0.7%' },
  { n: '汤瑞生', dept: '客户销售二部', grp: '客户销售七组', cw: 49, aw: 4.79, mw: 7, cov: 80.0, yoy: '+6.0%' },
  { n: '陈博锋', dept: '客户销售二部', grp: '客户销售七组', cw: 22, aw: 3.97, mw: 5, cov: 79.1, yoy: '+9.5%' },
  { n: '王海滨8', dept: '客户销售二部', grp: '客户销售七组', cw: 18, aw: 3.42, mw: 4, cov: 79.1, yoy: '+11.2%' },
  { n: '叶德庆', dept: '客户销售二部', grp: '客户销售七组', cw: 46, aw: 2.76, mw: 3, cov: 81.5, yoy: '+5.0%' },
  { n: '张云川', dept: '客户销售二部', grp: '客户销售八组', cw: 45, aw: 2.88, mw: 7, cov: 62.0, yoy: '+4.9%' },
  { n: '徐添寒', dept: '客户销售二部', grp: '客户销售八组', cw: 28, aw: 4.32, mw: 7, cov: 76.1, yoy: '+7.3%' },
  { n: '何建新6', dept: '客户销售二部', grp: '客户销售八组', cw: 40, aw: 4.64, mw: 8, cov: 73.6, yoy: '+3.6%' },
  { n: '吴思聪', dept: '客户销售二部', grp: '客户销售八组', cw: 22, aw: 4.05, mw: 4, cov: 63.4, yoy: '+2.1%' },
  { n: '王宇龙25', dept: '客户销售二部', grp: '客户销售八组', cw: 29, aw: 4.26, mw: 7, cov: 63.3, yoy: '-1.9%' },
  { n: '黎毅刚', dept: '客户销售二部', grp: '客户销售九组', cw: 29, aw: 4.39, mw: 3, cov: 79.7, yoy: '+9.9%' },
  { n: '胡程6', dept: '客户销售二部', grp: '客户销售九组', cw: 30, aw: 2.71, mw: 5, cov: 74.1, yoy: '+0.2%' },
  { n: '贾贺翔', dept: '客户销售二部', grp: '客户销售九组', cw: 51, aw: 2.9, mw: 7, cov: 69.3, yoy: '+8.8%' },
  { n: '许金迪', dept: '客户销售二部', grp: '客户销售九组', cw: 27, aw: 4.92, mw: 3, cov: 60.3, yoy: '+3.5%' },
  { n: '蒋国江', dept: '客户销售二部', grp: '客户销售九组', cw: 44, aw: 3.77, mw: 8, cov: 59.3, yoy: '+6.8%' },
  { n: '曹政11', dept: '客户销售二部', grp: '客户销售九组', cw: 18, aw: 4.44, mw: 6, cov: 75.5, yoy: '+9.0%' },
  { n: '刘爱红', dept: '大客户销售部', grp: '-', cw: 27, aw: 2.83, mw: 4, cov: 70.9, yoy: '-0.9%' },
  { n: '李玉', dept: '大客户销售部', grp: '-', cw: 44, aw: 3.05, mw: 4, cov: 79.0, yoy: '-1.9%' },
  { n: '刘璞', dept: '大客户销售部', grp: '-', cw: 50, aw: 4.92, mw: 3, cov: 59.2, yoy: '+12.0%' },
  { n: '马玉薪', dept: '大客户销售部', grp: '-', cw: 20, aw: 5.01, mw: 4, cov: 62.0, yoy: '+4.3%' },
  { n: '邓贝额', dept: '大客户销售部', grp: '-', cw: 40, aw: 3.14, mw: 3, cov: 62.0, yoy: '-3.0%' },
  { n: '张辉99', dept: '大客户销售部', grp: '-', cw: 44, aw: 3.67, mw: 5, cov: 68.2, yoy: '+11.4%' },
  { n: '郑飞13', dept: '大客户销售部', grp: '-', cw: 50, aw: 5.49, mw: 8, cov: 75.2, yoy: '-0.7%' },
  { n: '谢彬18', dept: '大客户销售部', grp: '-', cw: 18, aw: 3.39, mw: 7, cov: 75.7, yoy: '-2.1%' },
  { n: '王俊杰', dept: '场景数字化销售部', grp: '-', cw: 18, aw: 3.44, mw: 7, cov: 69.4, yoy: '+10.8%' },
  { n: '张永仁', dept: '场景数字化销售部', grp: '-', cw: 18, aw: 4.09, mw: 7, cov: 59.9, yoy: '-0.2%' },
  { n: '林若驹', dept: '行业二部', grp: '-', cw: 30, aw: 4.29, mw: 6, cov: 60.9, yoy: '+10.4%' },
  { n: '陈志杰8', dept: '行业二部', grp: '-', cw: 53, aw: 3.24, mw: 3, cov: 72.9, yoy: '+3.3%' },
  { n: '肖力', dept: '行业二部', grp: '交通行业组', cw: 48, aw: 4.25, mw: 5, cov: 80.4, yoy: '+0.1%' },
  { n: '文波5', dept: '行业二部', grp: '交通行业组', cw: 30, aw: 4.65, mw: 5, cov: 67.5, yoy: '+7.1%' },
  { n: '郭庆3', dept: '行业二部', grp: '公安交警行业组', cw: 35, aw: 3.4, mw: 3, cov: 58.2, yoy: '+6.3%' },
  { n: '徐云鹏1', dept: '行业二部', grp: '公安交警行业组', cw: 21, aw: 4.19, mw: 3, cov: 70.9, yoy: '+4.6%' },
  { n: '张腾辉6', dept: '行业二部', grp: '公安交警行业组', cw: 37, aw: 2.9, mw: 3, cov: 79.1, yoy: '+2.5%' },
  { n: '柯俊鑫', dept: '行业二部', grp: '司法行业组', cw: 49, aw: 2.97, mw: 8, cov: 65.3, yoy: '+11.8%' },
  { n: '陶文杰', dept: '行业二部', grp: '政府行业组', cw: 48, aw: 4.92, mw: 3, cov: 74.0, yoy: '+5.3%' },
  { n: '唐勇10', dept: '行业二部', grp: '政府行业组', cw: 21, aw: 5.3, mw: 4, cov: 64.3, yoy: '+10.3%' },
  { n: '刘骏86', dept: '行业二部', grp: '政府行业组', cw: 24, aw: 4.73, mw: 5, cov: 64.8, yoy: '+0.2%' },
  { n: '李功', dept: '行业二部', grp: '文教卫组', cw: 55, aw: 3.53, mw: 5, cov: 70.1, yoy: '+0.8%' },
  { n: '刘羽欣', dept: '行业二部', grp: '文教卫组', cw: 18, aw: 5.22, mw: 3, cov: 73.2, yoy: '+9.4%' },
  { n: '张岩27', dept: '行业二部', grp: '文教卫组', cw: 36, aw: 2.63, mw: 4, cov: 73.3, yoy: '+0.9%' },
  { n: '黄子懿', dept: '行业二部', grp: '文教卫组', cw: 50, aw: 4.72, mw: 8, cov: 68.3, yoy: '-2.9%' },
  { n: '刘向文5', dept: '行业二部', grp: '文教卫组', cw: 24, aw: 2.73, mw: 7, cov: 58.9, yoy: '+2.5%' },
  { n: '杨永光', dept: '行业一部', grp: '工业企业一组', cw: 42, aw: 4.16, mw: 4, cov: 59.0, yoy: '+2.5%' },
  { n: '周丹3', dept: '行业一部', grp: '工业企业一组', cw: 17, aw: 5.3, mw: 5, cov: 63.0, yoy: '+0.7%' },
  { n: '刘超27', dept: '行业一部', grp: '工业企业一组', cw: 50, aw: 2.81, mw: 6, cov: 81.4, yoy: '+8.2%' },
  { n: '张星19', dept: '行业一部', grp: '工业企业一组', cw: 30, aw: 5.28, mw: 4, cov: 81.4, yoy: '+9.2%' },
  { n: '洪峰泉', dept: '行业一部', grp: '工业企业二组', cw: 16, aw: 5.14, mw: 4, cov: 75.7, yoy: '+2.0%' },
  { n: '高扬23', dept: '行业一部', grp: '工业企业二组', cw: 30, aw: 5.29, mw: 5, cov: 61.8, yoy: '+7.5%' },
  { n: '唐明翔', dept: '行业一部', grp: '工业企业二组', cw: 17, aw: 3.65, mw: 6, cov: 63.3, yoy: '+9.2%' },
  { n: '胡鑫11', dept: '行业一部', grp: '工业企业二组', cw: 34, aw: 3.88, mw: 4, cov: 63.4, yoy: '+6.9%' },
  { n: '陈仲都', dept: '行业一部', grp: '工业企业二组', cw: 32, aw: 3.7, mw: 3, cov: 81.2, yoy: '+1.2%' },
  { n: '杨秀敏', dept: '行业一部', grp: '智慧建筑组', cw: 40, aw: 4.42, mw: 8, cov: 81.5, yoy: '+5.0%' },
  { n: '吴泽民6', dept: '行业一部', grp: '智慧建筑组', cw: 22, aw: 5.32, mw: 5, cov: 62.3, yoy: '+11.4%' },
  { n: '何亮12', dept: '行业一部', grp: '智慧建筑组', cw: 21, aw: 3.3, mw: 7, cov: 68.4, yoy: '+7.9%' },
  { n: '戴哲5', dept: '行业一部', grp: '智慧建筑组', cw: 53, aw: 3.44, mw: 7, cov: 60.8, yoy: '+10.5%' },
  { n: '孙德成', dept: '行业一部', grp: '智慧商贸组', cw: 17, aw: 3.07, mw: 8, cov: 68.5, yoy: '+4.8%' },
  { n: '曾强弘', dept: '行业一部', grp: '智慧商贸组', cw: 27, aw: 4.92, mw: 5, cov: 68.4, yoy: '+11.2%' },
  { n: '刘佳豪26', dept: '行业一部', grp: '智慧商贸组', cw: 54, aw: 5.26, mw: 5, cov: 73.9, yoy: '-1.1%' },
];

// ===== 全局存储初始化（必须在 app.js 的 initAll() 之前） =====
App.charts = {};

// ===== 产品宽度 Demo 数据 =====
App.Data = {};

// 总览页 KPI 基础值
var BASE_OVERVIEW = {
  customers: 1247, users: 386, custWidth: 3.96, userWidth: 5.20,
  avgWidth: 3.96, potentialRate: '34.6%', potentialAmount: 9830,
  customersMoM: '+62'
};

// KPI 目标值（用于红黄绿灯判断）
var BASE_KPI_TARGETS = {
  potential:      { label: '潜力销售额',   target:  12000, unit: '万',  desc: '¥ 1.20亿' },
  customers:      { label: '覆盖客户数',   target:   1300, unit: '个',  desc: '1,300' },
  users:          { label: '覆盖用户数',   target:    400, unit: '个',  desc: '400' },
  avgWidth:       { label: '平均产品宽度', target:    4.0, unit: '',    desc: '4.00' },
  scaleCustomers: { label: '规上客户数',   target:    920, unit: '个',  desc: '920' },
  scaleRate:      { label: '规上客户率',   target:     75, unit: '%',   desc: '75%' }
};

// 红绿灯判断: >= 95% 绿色 / >= 80% 黄色 / < 80% 红色
function kpiTrafficLight(current, target) {
  if (!target || target === 0) return { cls: 'green', pct: 100 };
  var pct = Math.round(current / target * 100);
  var cls = pct >= 95 ? 'green' : (pct >= 80 ? 'yellow' : 'red');
  return { cls: cls, pct: Math.min(pct, 100) };
}

// 总览页 部门维度: 产品宽度
var BASE_OVERVIEW_DEPT_WIDTH = [
  { dept: '政府行业组', width: 4.28 },
  { dept: '公安交警行业组', width: 3.76 },
  { dept: '工业企业一组', width: 3.48 },
  { dept: '智慧建筑组', width: 3.24 }
];

// 总览页 部门维度: 潜力产品销售额 (万元)
var BASE_OVERVIEW_DEPT_POTENTIAL = [
  { dept: '政府行业组', sales: 3850, yoy: '+15.2%' },
  { dept: '公安交警行业组', sales: 2620, yoy: '+10.8%' },
  { dept: '工业企业一组', sales: 1740, yoy: '+6.5%'  },
  { dept: '智慧建筑组', sales: 1320, yoy: '-3.2%'  }
];

// 总览页销售人员宽度排名
var BASE_WIDTH_RANK = [
  ['陈思源', 18, 5.8, 10, '政府行业组'],
  ['王志强', 15, 5.2, 9, '政府行业组'],
  ['张伟',   12, 4.8, 8, '公安交警行业组'],
  ['李梦琪', 10, 4.3, 7, '政府行业组'],
  ['陈伟杰',  9, 4.1, 6, '政府行业组'],
  ['罗兴华',  8, 3.9, 6, '工业企业一组'],
  ['张继成',  8, 3.6, 5, '公安交警行业组'],
  ['赵启超',  7, 3.4, 5, '智慧建筑组'],
  ['李金富',  7, 3.2, 4, '智慧建筑组'],
  ['徐宏源',  6, 3.0, 4, '工业企业一组']
];

// 总览页潜力产品贡献排名
var BASE_POTENTIAL_RANK = [
  { name: '陈思源', amount: 1850, yoy: '+35%', share: '18.8%', team: '政府行业组' },
  { name: '王志强', amount: 1420, yoy: '+22%', share: '14.4%', team: '政府行业组' },
  { name: '张伟',   amount: 980,  yoy: '+18%', share: '10.0%', team: '公安交警行业组' },
  { name: '陈伟杰', amount: 850,  yoy: '+85%', share: '8.6%',  team: '政府行业组' },
  { name: '李梦琪', amount: 720,  yoy: '+12%', share: '7.3%',  team: '政府行业组' },
  { name: '罗兴华', amount: 650,  yoy: '+28%', share: '6.6%',  team: '工业企业一组' },
  { name: '黄燕滨', amount: 580,  yoy: '+92%', share: '5.9%',  team: '工业企业一组' },
  { name: '赵启超', amount: 480,  yoy: '+15%', share: '4.9%',  team: '智慧建筑组' },
  { name: '张继成', amount: 420,  yoy: '+42%', share: '4.3%',  team: '公安交警行业组' },
  { name: '李金富', amount: 360,  yoy: '+8%',  share: '3.7%',  team: '智慧建筑组' }
];

// 总览页潜力产品销售排名
var BASE_POTENTIAL_PRODUCT = [
  { product: 'NVR',      sales: 3210, yoy: '+58.3%', qty: '+42.1%', type: '量价齐升' },
  { product: '智能计算', sales: 2180, yoy: '新增',   qty: '+100%',  type: '新增' },
  { product: 'IPC',      sales: 1890, yoy: '+22.4%', qty: '+15.2%', type: '量价齐升' },
  { product: '平台软件', sales: 1420, yoy: '+18.7%', qty: '-3.2%',  type: '量跌价增' },
  { product: '门禁',     sales: 980,  yoy: '-23.5%', qty: '-18.6%', type: '量价齐跌' },
  { product: '智能交通', sales: 850,  yoy: '-11.2%', qty: '-5.4%',  type: '量价齐跌' },
  { product: '存储',     sales: 720,  yoy: '+8.4%',  qty: '+12.3%', type: '量价齐升' },
  { product: 'LCD与解码', sales: 610, yoy: '+5.2%',  qty: '+8.7%',  type: '量价齐升' }
];

// 产品宽度页 KPI 基础值
var BASE_WIDTH = {
  customers: 1247, scaleUp: 888, scaleUsers: 285, nonScale: 359,
  avgWidth: 3.96, maxWidth: 10, maxCust: '深圳市政府',
  coverage: '71.2%', widthYoY: '+0.42',
  customersMoM: 62, coverageYoY: '+3.5%'
};

// 产品宽度页缺失分析
var BASE_MISSING = [
  { product: '智能计算',  covered: 45,  missing: 843, rate: '5.1%',  bar: 5 },
  { product: '专网摄像机', covered: 62,  missing: 826, rate: '7.0%',  bar: 7 },
  { product: '行业软件',  covered: 78,  missing: 810, rate: '8.8%',  bar: 9 },
  { product: '服务',      covered: 95,  missing: 793, rate: '10.7%', bar: 11 },
  { product: '门禁',      covered: 120, missing: 768, rate: '13.5%', bar: 14 }
];

// 产品覆盖热力图 - 27 品类（来源：凯玲产品宽度分析）
var BASE_HEATMAP_TOTAL = 471;
var BASE_HEATMAP_PRODS = [
  { name: 'IPC',              rate: 53.1, count: 250 },
  { name: 'NVR',              rate: 36.7, count: 173 },
  { name: '门禁',             rate: 27.8, count: 131 },
  { name: '球机',             rate: 24.6, count: 116 },
  { name: 'LCD与解码',        rate: 17.6, count: 83  },
  { name: '新业务',           rate: 17.4, count: 82  },
  { name: '通用软件',         rate: 16.3, count: 77  },
  { name: '网络产品',         rate: 14.6, count: 69  },
  { name: '存储',             rate: 11.5, count: 54  },
  { name: '专用摄像机',       rate: 9.3,  count: 44  },
  { name: '服务器',           rate: 8.9,  count: 42  },
  { name: '行业软件',         rate: 8.5,  count: 40  },
  { name: '智能计算',         rate: 7.9,  count: 37  },
  { name: '对讲',             rate: 7.6,  count: 36  },
  { name: '报警',             rate: 7.4,  count: 35  },
  { name: '出入口停车',       rate: 7.4,  count: 35  },
  { name: '人员通道',         rate: 6.4,  count: 30  },
  { name: '音频产品',         rate: 5.9,  count: 28  },
  { name: 'PCP产品',          rate: 4.5,  count: 21  },
  { name: 'LED与拼控',        rate: 4.5,  count: 21  },
  { name: '移动终端产品',     rate: 4.2,  count: 20  },
  { name: '智能交通',         rate: 4.0,  count: 19  },
  { name: '智慧屏与视频会议', rate: 3.6,  count: 17  },
  { name: '综合布线与机柜',   rate: 3.6,  count: 17  },
  { name: '基础软件',         rate: 1.9,  count: 9   },
  { name: '网络安全',         rate: 1.7,  count: 8   },
  { name: '传感产品',         rate: 0.8,  count: 4   }
];

// 产品宽度页 客户 TOP 列表（带产品明细，参考简刚平版）
var BASE_CUST_GOOD = [
  { name: '广东源水智能科技有限公司深圳分公司', avgW: 23.00, gsCnt: '1/1', soldCnt: 23, sold: ['IPC','球机','专用摄像机','监控器','网络产品','NVR','存储','LCD与解码','智能交通','出入口停车','门禁','对讲','人员通道','报警','音频产品','智慧屏与视频会议','通用软件','行业软件','基础软件','新业务','专网摄像机','服务器','智能计算'], person: '高峰10' },
  { name: '深圳市苍景科技有限公司',             avgW: 21.00, gsCnt: '1/1', soldCnt: 21, sold: ['IPC','NVR','门禁','球机','LCD与解码','监控器','智能交通','网络产品','存储','出入口停车','对讲','人员通道','报警','通用软件','行业软件','基础软件','智慧屏与视频会议','音频产品','服务器','新业务','智能计算'], person: '陈伟杰' },
  { name: '深圳市青葱互联网技术服务有限公司',   avgW: 20.00, gsCnt: '1/1', soldCnt: 20, sold: ['IPC','NVR','门禁','球机','LCD与解码','网络产品','存储','出入口停车','对讲','人员通道','报警','通用软件','行业软件','基础软件','智慧屏与视频会议','音频产品','服务器','新业务','专网摄像机','智能计算'], person: '罗兴华' },
  { name: '深圳市光敏互联智能有限公司',         avgW: 18.00, gsCnt: '1/1', soldCnt: 18, sold: ['IPC','NVR','门禁','球机','LCD与解码','网络产品','存储','出入口停车','对讲','人员通道','报警','通用软件','行业软件','基础软件','智慧屏与视频会议','音频产品','服务器','新业务'], person: '王志强' },
  { name: '顺丰科技有限公司',                   avgW: 17.00, gsCnt: '1/1', soldCnt: 17, sold: ['IPC','NVR','门禁','球机','LCD与解码','网络产品','存储','出入口停车','对讲','人员通道','报警','通用软件','行业软件','基础软件','智慧屏与视频会议','音频产品','服务器'], person: '彭城12' },
  { name: '深圳市洪创科技有限公司',             avgW: 16.00, gsCnt: '1/1', soldCnt: 16, sold: ['IPC','NVR','门禁','球机','LCD与解码','网络产品','存储','出入口停车','对讲','人员通道','报警','通用软件','行业软件','基础软件','智慧屏','音频产品'], person: '罗兴华' },
  { name: '深圳市南粤实业有限公司',             avgW: 16.00, gsCnt: '1/1', soldCnt: 16, sold: ['IPC','NVR','门禁','球机','LCD与解码','网络产品','存储','出入口停车','对讲','人员通道','报警','通用软件','行业软件','基础软件','智慧屏','音频产品'], person: '罗兴华' },
  { name: '深圳市方联仕业科技有限公司',         avgW: 16.00, gsCnt: '1/1', soldCnt: 16, sold: ['IPC','NVR','门禁','球机','LCD与解码','网络产品','存储','出入口停车','对讲','人员通道','报警','通用软件','行业软件','基础软件','智慧屏','音频产品'], person: '罗兴华' },
  { name: '深圳市鑫天网网络科技有限公司',       avgW: 16.00, gsCnt: '1/1', soldCnt: 16, sold: ['IPC','NVR','门禁','球机','LCD与解码','网络产品','存储','出入口停车','对讲','人员通道','报警','通用软件','行业软件','基础软件','智慧屏','音频产品'], person: '彭城12' },
  { name: '维语技术有限公司',                   avgW: 15.00, gsCnt: '1/1', soldCnt: 15, sold: ['IPC','NVR','门禁','球机','LCD与解码','网络产品','存储','出入口停车','对讲','人员通道','报警','通用软件','行业软件','基础软件','智慧屏'], person: '陈伟杰' },
  { name: '深圳市华腾科技发展有限公司',         avgW: 14.50, gsCnt: '1/1', soldCnt: 14, sold: ['IPC','NVR','门禁','球机','LCD与解码','网络产品','存储','出入口停车','对讲','人员通道','报警','通用软件','行业软件','音频产品','服务器'], person: '陈思源' },
  { name: '东方世纪科技（深圳）有限公司',       avgW: 14.00, gsCnt: '1/1', soldCnt: 14, sold: ['IPC','NVR','门禁','球机','LCD与解码','网络产品','存储','出入口停车','对讲','报警','通用软件','行业软件','音频产品','服务器'], person: '王志强' },
  { name: '广州市政数科技股份有限公司',         avgW: 13.50, gsCnt: '1/1', soldCnt: 13, sold: ['IPC','NVR','门禁','球机','LCD与解码','网络产品','存储','出入口停车','对讲','报警','通用软件','行业软件','服务器'], person: '陈思源' },
  { name: '深圳市智慧星云科技有限公司',         avgW: 13.00, gsCnt: '1/1', soldCnt: 13, sold: ['IPC','NVR','门禁','球机','LCD与解码','网络产品','存储','对讲','人员通道','报警','通用软件','行业软件','服务器'], person: '李梦琪' },
  { name: '广州市腾飞安防技术有限公司',         avgW: 12.50, gsCnt: '1/1', soldCnt: 12, sold: ['IPC','NVR','门禁','球机','LCD与解码','网络产品','存储','对讲','人员通道','报警','通用软件','行业软件'], person: '陈伟杰' },
  { name: '深圳市科锐信息技术有限公司',         avgW: 12.00, gsCnt: '1/1', soldCnt: 12, sold: ['IPC','NVR','门禁','球机','LCD与解码','网络产品','存储','出入口停车','对讲','报警','通用软件','行业软件'], person: '张伟' },
  { name: '东莞市恒信数码科技有限公司',         avgW: 11.50, gsCnt: '1/1', soldCnt: 11, sold: ['IPC','NVR','门禁','球机','LCD与解码','网络产品','存储','出入口停车','报警','通用软件','行业软件'], person: '张继成' },
  { name: '惠州大亚湾智慧城市运营有限公司',     avgW: 11.00, gsCnt: '1/1', soldCnt: 11, sold: ['IPC','NVR','门禁','球机','LCD与解码','网络产品','存储','对讲','报警','通用软件','行业软件'], person: '罗兴华' },
  { name: '中山市安信通电子科技有限公司',       avgW: 10.50, gsCnt: '1/1', soldCnt: 10, sold: ['IPC','NVR','门禁','球机','LCD与解码','网络产品','存储','报警','通用软件','行业软件'], person: '黄燕滨' },
  { name: '珠海横琴粤澳深度合作区科技有限公司', avgW: 10.00, gsCnt: '1/1', soldCnt: 10, sold: ['IPC','NVR','门禁','球机','LCD与解码','网络产品','存储','通用软件','行业软件','服务器'], person: '赵启超' }
];
var BASE_CUST_BAD = [
  { name: '深圳市瑞图同创科技有限公司',         avgW: 0.00, gsCnt: '0/1', soldCnt: 0,  sold: [], person: '彭城12' },
  { name: '深圳市汇蒙山科技有限公司',           avgW: 0.00, gsCnt: '0/1', soldCnt: 0,  sold: [], person: '王鹏组' },
  { name: '广东联泰恒昌物业管理有限公司深圳分公司', avgW: 0.00, gsCnt: '0/1', soldCnt: 0, sold: [], person: '段金春' },
  { name: '深圳优控泰森科技开发有限公司',       avgW: 0.00, gsCnt: '0/1', soldCnt: 0,  sold: [], person: '段金春' },
  { name: '深圳信易立信信息技术有限公司',       avgW: 0.00, gsCnt: '0/1', soldCnt: 0,  sold: [], person: '段金春' },
  { name: '深圳芯鸿星通讯有限公司',             avgW: 0.00, gsCnt: '0/1', soldCnt: 0,  sold: [], person: '段金春' },
  { name: '智谋翼飞科技（深圳）有限公司',       avgW: 0.00, gsCnt: '0/1', soldCnt: 0,  sold: [], person: '段金春' },
  { name: '深圳市鹏华汇汽车服务有限公司',       avgW: 0.00, gsCnt: '0/1', soldCnt: 0,  sold: [], person: '童亮泽' },
  { name: '顺新鑫（广州）供应链管理服务有限公司厦门分公司', avgW: 0.00, gsCnt: '0/1', soldCnt: 0, sold: [], person: '孙天6' },
  { name: '深圳金蓝科技有限公司',               avgW: 0.00, gsCnt: '0/1', soldCnt: 0,  sold: [], person: '段金春' },
  { name: '深圳市德丰盛业科技有限公司',         avgW: 0.00, gsCnt: '0/1', soldCnt: 0,  sold: [], person: '沙婷' },
  { name: '广东粤港供应链管理有限公司',         avgW: 0.00, gsCnt: '0/1', soldCnt: 0,  sold: [], person: '唐伟宗' },
  { name: '深圳市微光互联技术有限公司',         avgW: 0.00, gsCnt: '0/1', soldCnt: 0,  sold: [], person: '蔡月青' },
  { name: '深圳市睿思达信息技术有限公司',       avgW: 1.00, gsCnt: '0/1', soldCnt: 1,  sold: ['IPC'], person: '沙婷' },
  { name: '广州市盈科信息技术有限公司',         avgW: 1.00, gsCnt: '0/1', soldCnt: 1,  sold: ['通用软件'], person: '唐伟宗' },
  { name: '深圳市科汇达智能科技有限公司',       avgW: 1.00, gsCnt: '0/1', soldCnt: 1,  sold: ['NVR'], person: '蔡月青' },
  { name: '广东博思云创科技有限公司',           avgW: 1.00, gsCnt: '0/1', soldCnt: 1,  sold: ['门禁'], person: '王思伍5' },
  { name: '深圳市易通达电子科技有限公司',       avgW: 1.00, gsCnt: '0/1', soldCnt: 1,  sold: ['LCD与解码'], person: '张振凌' },
  { name: '深圳市宏芯微科技有限公司',           avgW: 1.00, gsCnt: '0/1', soldCnt: 1,  sold: ['球机'], person: '罗育福' },
  { name: '深圳市鑫鼎盛科技有限公司',           avgW: 1.00, gsCnt: '0/1', soldCnt: 1,  sold: ['存储'], person: '陈天6' }
];

// 产品交叉销售关联矩阵 (10个核心品类 × 10, 半矩阵, Lift值)
var BASE_CROSS_SELL_PRODS = ['IPC','NVR','门禁','球机','LCD与解码','存储','网络产品','智能交通','出入口停车','通用软件'];
var BASE_CROSS_SELL_MATRIX = [
  [ 0,   4.2, 2.8, 3.5, 2.1, 1.9, 1.6, 1.2, 1.8, 1.3 ], // IPC →
  [ 0,    0,  2.1, 2.8, 1.7, 3.8, 2.2, 1.0, 1.4, 1.5 ], // NVR →
  [ 0,    0,   0,  1.5, 1.2, 1.3, 1.1, 2.5, 4.3, 0.9 ], // 门禁 →
  [ 0,    0,   0,   0,  1.8, 1.4, 1.3, 1.6, 1.1, 1.0 ], // 球机 →
  [ 0,    0,   0,   0,   0,  1.5, 1.8, 1.0, 1.3, 1.7 ], // LCD与解码 →
  [ 0,    0,   0,   0,   0,   0,  2.1, 1.2, 1.5, 1.4 ], // 存储 →
  [ 0,    0,   0,   0,   0,   0,   0,  1.1, 1.3, 2.0 ], // 网络产品 →
  [ 0,    0,   0,   0,   0,   0,   0,   0,  2.8, 1.1 ], // 智能交通 →
  [ 0,    0,   0,   0,   0,   0,   0,   0,   0,  1.2 ], // 出入口停车 →
  [ 0,    0,   0,   0,   0,   0,   0,   0,   0,   0  ]  // 通用软件
];

// 自动识别的产品套包 (含提升度评分)
var BASE_CROSS_BUNDLES = [
  { name: '安防前端套包',    prods: ['IPC','NVR','存储','网络产品'],      score: 3.8, rate: '86%', desc: '买了IPC的客户中86%同时覆盖了NVR+存储，高度捆绑' },
  { name: '出入口一体化',    prods: ['门禁','出入口停车','IPC'],           score: 3.2, rate: '52%', desc: '门禁类项目天然需要出入口配合，52%客户同时覆盖' },
  { name: '交通智能套包',    prods: ['智能交通','球机','NVR'],             score: 2.5, rate: '38%', desc: '交通项目标配: 智能交通+球机+后端存储' },
  { name: '显示控制套包',    prods: ['LCD与解码','网络产品','通用软件'],   score: 2.1, rate: '28%', desc: 'LCD大屏项目通常搭配网络传输和平台软件' }
];

// 健康度评分卡数据
var BASE_HEALTH_SCORES = {
  customer: [
    { name: '深圳市政府',   score: 92, width: 10, sales: 3210, trend: '+18%', stable: 'A', profit: '高', detail: '宽度:10 + 增速+18% + 稳定A级 + 高利润' },
    { name: '宝安公安局',   score: 87, width: 8,  sales: 2450, trend: '+12%', stable: 'A', profit: '高', detail: '宽度:8 + 增速+12% + 稳定A级 + 高利润' },
    { name: '罗湖教育局',   score: 78, width: 7,  sales: 1880, trend: '+5%',  stable: 'B', profit: '中', detail: '宽度:7 + 增速+5% + 稳定B级 + 中利润' },
    { name: '招商17',       score: 75, width: 6,  sales: 1540, trend: '+8%',  stable: 'B', profit: '中', detail: '宽度:6 + 增速+8% + 稳定B级 + 中利润' },
    { name: '广东省交通厅', score: 68, width: 5,  sales: 1320, trend: '-2%',  stable: 'C', profit: '中', detail: '宽度:5 + 增速-2% + 稳定C级 + 中利润' },
    { name: '龙岗分局',     score: 62, width: 3,  sales: 1120, trend: '-5%',  stable: 'C', profit: '低', detail: '宽度:3 + 增速-5% + 稳定C级 + 低利润' },
    { name: '沙头派出所',   score: 55, width: 3,  sales: 980,  trend: '-8%',  stable: 'D', profit: '低', detail: '宽度:3 + 增速-8% + 稳定D级 + 低利润' },
    { name: '东方电子',     score: 72, width: 4,  sales: 890,  trend: '+10%', stable: 'B', profit: '中', detail: '宽度:4 + 增速+10% + 稳定B级 + 中利润' },
    { name: '南山教育局',   score: 80, width: 5,  sales: 1680, trend: '+15%', stable: 'A', profit: '中', detail: '宽度:5 + 增速+15% + 稳定A级 + 中利润' },
    { name: '广州市公安局', score: 82, width: 7,  sales: 2100, trend: '+8%',  stable: 'A', profit: '高', detail: '宽度:7 + 增速+8% + 稳定A级 + 高利润' },
    { name: '珠海市卫健局', score: 65, width: 4,  sales: 1050, trend: '+3%',  stable: 'B', profit: '中', detail: '宽度:4 + 增速+3% + 稳定B级 + 中利润' },
    { name: '东莞市交通局', score: 58, width: 3,  sales: 920,  trend: '-10%', stable: 'D', profit: '低', detail: '宽度:3 + 增速-10% + 稳定D级 + 低利润' },
    { name: '中山市教体局', score: 70, width: 5,  sales: 1220, trend: '+5%',  stable: 'B', profit: '中', detail: '宽度:5 + 增速+5% + 稳定B级 + 中利润' },
    { name: '惠州市大数据局', score: 45, width: 2, sales: 680, trend: '-15%', stable: 'D', profit: '低', detail: '宽度:2 + 增速-15% + 稳定D级 + 低利润' },
    { name: '佛山市顺德区', score: 73, width: 4, sales: 1350, trend: '+9%',  stable: 'B', profit: '中', detail: '宽度:4 + 增速+9% + 稳定B级 + 中利润' }
  ],
  product: [
    { name: 'IPC',          score: 94, cov: '53.1%', yoy: '+12.3%', margin: '高', bundles: 3, detail: '覆盖率53.1% + 增速+12.3% + 高利润 + 3个套包' },
    { name: 'NVR',          score: 88, cov: '36.7%', yoy: '+18.5%', margin: '高', bundles: 3, detail: '覆盖率36.7% + 增速+18.5% + 高利润 + 3个套包' },
    { name: '智能计算',     score: 85, cov: '7.9%',  yoy: '+85%',  margin: '中', bundles: 1, detail: '覆盖率7.9% + 增速+85% + 中利润 + 1个套包' },
    { name: '存储',         score: 82, cov: '11.5%', yoy: '+8.4%', margin: '中', bundles: 2, detail: '覆盖率11.5% + 增速+8.4% + 中利润 + 2个套包' },
    { name: 'LCD与解码',    score: 76, cov: '17.6%', yoy: '+5.2%', margin: '中', bundles: 1, detail: '覆盖率17.6% + 增速+5.2% + 中利润 + 1个套包' },
    { name: '出入口停车',   score: 70, cov: '7.4%',  yoy: '+15.2%',margin: '中', bundles: 1, detail: '覆盖率7.4% + 增速+15.2% + 中利润 + 1个套包' },
    { name: '球机',         score: 70, cov: '24.6%', yoy: '+5.1%', margin: '低', bundles: 0, detail: '覆盖率24.6% + 增速+5.1% + 低利润 + 0个套包' },
    { name: '门禁',         score: 48, cov: '27.8%', yoy: '-8.2%', margin: '中', bundles: 2, detail: '覆盖率27.8% + 增速-8.2% + 中利润 + 2个套包' },
    { name: '专用摄像机',   score: 68, cov: '9.3%',  yoy: '+3.2%', margin: '低', bundles: 0, detail: '覆盖率9.3% + 增速+3.2% + 低利润 + 0个套包' },
    { name: '通用软件',     score: 78, cov: '16.3%', yoy: '+7.5%', margin: '高', bundles: 1, detail: '覆盖率16.3% + 增速+7.5% + 高利润 + 1个套包' },
    { name: '网络产品',     score: 72, cov: '14.6%', yoy: '+2.1%', margin: '中', bundles: 1, detail: '覆盖率14.6% + 增速+2.1% + 中利润 + 1个套包' },
    { name: '新业务',       score: 65, cov: '17.4%', yoy: '+25%',  margin: '中', bundles: 0, detail: '覆盖率17.4% + 增速+25% + 中利润 + 0个套包' },
    { name: '行业软件',     score: 62, cov: '8.5%',  yoy: '-3.5%', margin: '中', bundles: 1, detail: '覆盖率8.5% + 增速-3.5% + 中利润 + 1个套包' },
    { name: '对讲',         score: 58, cov: '7.6%',  yoy: '-2.8%', margin: '低', bundles: 0, detail: '覆盖率7.6% + 增速-2.8% + 低利润 + 0个套包' },
    { name: '报警',         score: 55, cov: '7.4%',  yoy: '-5.1%', margin: '低', bundles: 0, detail: '覆盖率7.4% + 增速-5.1% + 低利润 + 0个套包' }
  ],
  team: [
    { name: '政府行业组',   score: 88, members: 4, avgW: 4.28, yoy: '+8.2%', cust: 437, detail: '4人 + 宽度4.28 + '+8.2%' + 437客户' },
    { name: '公安交警行业组',   score: 72, members: 3, avgW: 3.76, yoy: '+3.5%', cust: 374, detail: '3人 + 宽度3.76 + '+3.5%' + 374客户' },
    { name: '工业企业一组',   score: 60, members: 2, avgW: 3.48, yoy: '-1.2%', cust: 249, detail: '2人 + 宽度3.48 + '-1.2%' + 249客户' },
    { name: '智慧建筑组',   score: 45, members: 2, avgW: 3.24, yoy: '-5.4%', cust: 187, detail: '2人 + 宽度3.24 + '-5.4%' + 187客户' },
    { name: '客户销售一组', score: 75, members: 3, avgW: 3.92, yoy: '+2.8%', cust: 312, detail: '3人 + 宽度3.92 + '+2.8%' + 312客户' },
    { name: '客户销售二组', score: 68, members: 3, avgW: 3.65, yoy: '+1.5%', cust: 289, detail: '3人 + 宽度3.65 + '+1.5%' + 289客户' },
    { name: '客户销售三组', score: 55, members: 3, avgW: 3.21, yoy: '-3.2%', cust: 254, detail: '3人 + 宽度3.21 + '-3.2%' + 254客户' },
    { name: '客户销售四组', score: 42, members: 2, avgW: 2.98, yoy: '-7.5%', cust: 203, detail: '2人 + 宽度2.98 + '-7.5%' + 203客户' }
  ],
  person: [
    { name: '陈思源',       score: 95, team: '政府行业组', cust: 18, avgW: 5.8, yoy: '+35%',  detail: '18客户 + 宽度5.8 + '+35%'' },
    { name: '王志强',       score: 88, team: '政府行业组', cust: 15, avgW: 5.2, yoy: '+22%',  detail: '15客户 + 宽度5.2 + '+22%'' },
    { name: '陈伟杰',       score: 85, team: '政府行业组', cust: 9,  avgW: 4.1, yoy: '+85%',  detail: '9客户 + 宽度4.1 + '+85%'' },
    { name: '张伟',         score: 72, team: '公安交警行业组', cust: 12, avgW: 4.8, yoy: '+18%',  detail: '12客户 + 宽度4.8 + '+18%'' },
    { name: '黄燕滨',       score: 65, team: '工业企业一组', cust: 8,  avgW: 3.9, yoy: '+92%',  detail: '8客户 + 宽度3.9 + '+92%'' },
    { name: '罗兴华',       score: 60, team: '工业企业一组', cust: 10, avgW: 4.3, yoy: '+12%',  detail: '10客户 + 宽度4.3 + '+12%'' },
    { name: '赵启超',       score: 48, team: '智慧建筑组', cust: 7,  avgW: 3.4, yoy: '-15%',  detail: '7客户 + 宽度3.4 + '-15%'' },
    { name: '李金富',       score: 35, team: '智慧建筑组', cust: 5,  avgW: 2.1, yoy: '-22%',  detail: '5客户 + 宽度2.1 + '-22%'' },
    { name: '李梦琪',       score: 78, team: '政府行业组', cust: 10, avgW: 4.3, yoy: '+12%',  detail: '10客户 + 宽度4.3 + '+12%'' },
    { name: '张继成',       score: 55, team: '公安交警行业组', cust: 8,  avgW: 3.6, yoy: '+42%',  detail: '8客户 + 宽度3.6 + '+42%'' },
    { name: '朱绪浩',       score: 50, team: '工业企业一组', cust: 6,  avgW: 3.1, yoy: '-8%',   detail: '6客户 + 宽度3.1 + '-8%'' },
    { name: '潘仲楠',       score: 40, team: '智慧建筑组', cust: 4,  avgW: 2.5, yoy: '-18%',  detail: '4客户 + 宽度2.5 + '-18%'' }
  ]
};

// 客户分层分析数据 (销售额万元 × 产品宽度, 20个典型客户)
var BASE_CUST_SEGMENT = [
  { name: '深圳市政府',     sales: 3210, width: 10, person: '陈思源' },
  { name: '宝安公安局',     sales: 2450, width: 8,  person: '王志强' },
  { name: '罗湖教育局',     sales: 1880, width: 7,  person: '李梦琪' },
  { name: '招商17',         sales: 1540, width: 6,  person: '陈伟杰' },
  { name: '广东省交通厅',   sales: 1320, width: 5,  person: '张伟'   },
  { name: '南山区教育局',   sales: 720,  width: 4,  person: '罗兴华' },
  { name: '龙岗分局',       sales: 1120, width: 3,  person: '张继成' },
  { name: '沙头派出所',     sales: 980,  width: 3,  person: '赵启超' },
  { name: '彭城12',         sales: 650,  width: 7,  person: '黄燕滨' },
  { name: '高峰10',         sales: 580,  width: 8,  person: '李金富' },
  { name: '天眼监控',       sales: 18,   width: 1,  person: '陈思源' },
  { name: '江河电子',       sales: 22,   width: 1,  person: '王志强' },
  { name: '源动力科技',     sales: 25,   width: 2,  person: '张伟'   },
  { name: '皓月安防',       sales: 28,   width: 1,  person: '李梦琪' },
  { name: '力涵智能',       sales: 32,   width: 2,  person: '陈伟杰' },
  { name: '磐石科技',       sales: 560,  width: 2,  person: '张继成' },
  { name: '智慧城建设',     sales: 420,  width: 3,  person: '罗兴华' },
  { name: '东方电子',       sales: 890,  width: 4,  person: '黄燕滨' },
  { name: '金盾安防',       sales: 210,  width: 6,  person: '赵启超' },
  { name: '信达科技',       sales: 145,  width: 5,  person: '李金富' },
  { name: '广州政务云',     sales: 2850, width: 9,  person: '陈思源' },
  { name: '珠海横琴智慧',   sales: 2100, width: 8,  person: '王志强' },
  { name: '东莞市公安局',   sales: 1650, width: 6,  person: '张伟'   },
  { name: '佛山教育局',     sales: 920,  width: 4,  person: '罗兴华' },
  { name: '惠州大数据中心', sales: 45,   width: 1,  person: '李梦琪' },
  { name: '中山市政务局',   sales: 380,  width: 3,  person: '陈伟杰' },
  { name: '汕头市交通局',   sales: 95,   width: 2,  person: '赵启超' },
  { name: '江门市卫健局',   sales: 260,  width: 4,  person: '黄燕滨' },
  { name: '湛江市教育局',   sales: 180,  width: 3,  person: '张继成' },
  { name: '肇庆市规划局',   sales: 55,   width: 1,  person: '李金富' }
];

// 产品宽度页 用户 TOP 列表（关联客户 + 产品明细）
var BASE_USER_GOOD = [
  { name: '深圳市公安局',       avgW: 6.20, custCnt: 12, soldCnt: 18, sold: ['IPC','NVR','门禁','球机','智能交通','LCD与解码','存储','出入口停车','对讲','人员通道','报警','通用软件','行业软件','基础软件','网络产品','服务器','新业务','专用摄像机'], custs: '深圳市政府、宝安公安局、龙岗分局、南山分局、福田分局、罗湖分局' },
  { name: '深圳市教育局',       avgW: 5.10, custCnt: 8,  soldCnt: 14, sold: ['IPC','NVR','LCD与解码','平台软件','门禁','球机','存储','对讲','人员通道','通用软件','行业软件','基础软件','智慧屏','音频产品'], custs: '罗湖教育局、南山区教育局、福田区教育局、宝安区教育局、龙华区教育局' },
  { name: '广东省交通厅',       avgW: 4.50, custCnt: 6,  soldCnt: 11, sold: ['智能交通','IPC','存储','NVR','球机','门禁','LCD与解码','网络产品','通用软件','行业软件','服务器'], custs: '广东省高速、广州市交委、深圳市交通局、东莞市交通局、珠海市交通局' },
  { name: '深圳市卫健委',       avgW: 3.80, custCnt: 5,  soldCnt: 9,  sold: ['IPC','门禁','通用','存储','NVR','球机','对讲','人员通道','报警'], custs: '市人民医院、宝安医院、罗湖医院、南山医院、龙岗中心医院' },
  { name: '深圳市文体局',       avgW: 3.20, custCnt: 4,  soldCnt: 8,  sold: ['LCD','新业务','通用','IPC','NVR','门禁','平台软件','智慧屏'], custs: '市图书馆、市体育馆、市博物馆、市文化馆' },
  { name: '广州市公安局',       avgW: 5.80, custCnt: 10, soldCnt: 16, sold: ['IPC','NVR','门禁','球机','智能交通','LCD与解码','存储','出入口停车','对讲','报警','通用软件','行业软件','服务器','新业务','专用摄像机'], custs: '广州市政府、天河分局、海珠分局、越秀分局、白云分局' },
  { name: '佛山市教育局',       avgW: 3.50, custCnt: 5,  soldCnt: 9,  sold: ['IPC','NVR','LCD与解码','平台软件','门禁','球机','存储','通用软件','行业软件'], custs: '佛山市教育局、南海区教育局、禅城区教育局、顺德区教育局' },
  { name: '东莞市卫健局',       avgW: 2.80, custCnt: 3,  soldCnt: 7,  sold: ['IPC','门禁','存储','NVR','对讲','人员通道','报警'], custs: '东莞市卫健局、东城医院、南城医院' },
  { name: '珠海市政务局',       avgW: 4.20, custCnt: 6,  soldCnt: 12, sold: ['IPC','NVR','LCD与解码','平台软件','门禁','球机','存储','对讲','通用软件','行业软件','基础软件','服务器'], custs: '珠海市政务局、横琴新区、金湾区、斗门区' },
  { name: '惠州市大数据局',     avgW: 3.00, custCnt: 4,  soldCnt: 8,  sold: ['IPC','NVR','存储','LCD与解码','门禁','通用软件','行业软件','新业务'], custs: '惠州市大数据局、惠城区、惠阳区、大亚湾区' }
];
var BASE_USER_BAD = [
  { name: '深圳市气象局',       avgW: 0.40, custCnt: 1,  soldCnt: 1,  sold: ['IPC'], custs: '深圳市气象局' },
  { name: '深圳市水务集团',     avgW: 0.60, custCnt: 2,  soldCnt: 1,  sold: ['对讲'], custs: '深圳水务集团、深圳清源水务' },
  { name: '深圳市城管局',       avgW: 0.80, custCnt: 1,  soldCnt: 2,  sold: ['IPC','通用软件'], custs: '深圳市城管局' },
  { name: '深圳市规划与自然资源局', avgW: 0.50, custCnt: 1, soldCnt: 1, sold: ['IPC'], custs: '深圳市规划与自然资源局' },
  { name: '深圳市审计局',       avgW: 0.30, custCnt: 1,  soldCnt: 1,  sold: ['IPC'], custs: '深圳市审计局' },
  { name: '广州市气象局',       avgW: 0.50, custCnt: 1,  soldCnt: 1,  sold: ['IPC'], custs: '广州市气象局' },
  { name: '东莞市农业农村局',   avgW: 0.70, custCnt: 1,  soldCnt: 1,  sold: ['门禁'], custs: '东莞市农业农村局' },
  { name: '佛山市生态环境局',   avgW: 0.40, custCnt: 1,  soldCnt: 1,  sold: ['IPC'], custs: '佛山市生态环境局' },
  { name: '珠海市海洋局',       avgW: 0.60, custCnt: 1,  soldCnt: 1,  sold: ['对讲'], custs: '珠海市海洋局' },
  { name: '中山市林业局',       avgW: 0.30, custCnt: 1,  soldCnt: 1,  sold: ['IPC'], custs: '中山市林业局' }
];

// 潜力产品页 KPI 基础值
var BASE_POTENTIAL = {
  sales: 9830, share: '34.6%',
  upCount: 5, upAmount: 5200,
  downCount: 2, downAmount: 1800,
  newCount: 3, newAmount: 480
};

// 潜力产品页 客户矩阵
var BASE_MATRIX = [
  ['深圳市政府', '+125%', '新增', '+45%', '+18%', '未覆盖', '未覆盖', '+22%'],
  ['宝安公安局', '+68%',  '未覆盖', '+22%', '-5%', '-32%', '+12%', '+8%'],
  ['罗湖教育局', '+42%',  '新增', '+15%', '未覆盖', '未覆盖', '未覆盖', '+5%'],
  ['招商17',    '+38%',  '未覆盖', '+8%', '-2%', '-15%', '未覆盖', '未覆盖'],
  ['高峰10',    '+85%',  '新增', '+25%', '+12%', '未覆盖', '未覆盖', '+18%'],
  ['沙头',      '+52%',  '未覆盖', '+10%', '+3%', '-8%', '未覆盖', '未覆盖']
];

// 潜力产品页销售排名
var BASE_SALES_RANK = [
  ['陈思源', 1850, '+35%', '18.8%', '政府行业组'],
  ['王志强', 1420, '+22%', '14.4%', '政府行业组'],
  ['张伟',    980, '+18%', '10.0%', '公安交警行业组'],
  ['陈伟杰',  850, '+85%', '8.6%',  '政府行业组'],
  ['李梦琪',  720, '+12%', '7.3%',  '政府行业组'],
  ['罗兴华',  650, '+28%', '6.6%',  '工业企业一组'],
  ['黄燕滨',  580, '+92%', '5.9%',  '工业企业一组'],
  ['赵启超',  480, '+15%', '4.9%',  '智慧建筑组'],
  ['张继成',  420, '+42%', '4.3%',  '公安交警行业组'],
  ['李金富',  360, '+8%',  '3.7%',  '智慧建筑组'],
  ['朱绪浩',  320, '+5%',  '3.3%',  '智慧建筑组'],
  ['潘仲楠',  290, '+18%', '2.9%',  '工业企业一组'],
  ['廖贝贝',  260, '+12%', '2.6%',  '政府行业组'],
  ['刘文宇',  240, '-3%',  '2.4%',  '客户销售一部'],
  ['邓畅',    220, '+8%',  '2.2%',  '客户销售二部']
];

// 经营概览 (整合自乔梦杰版): 团队小组 × 8 潜力产品
// 列: 团队\小组 / NVR / 智能计算 / IPC / 平台软件 / 门禁 / 智能交通 / 存储 / LCD与解码 / 本期合计 / 同期合计 / 整体同比
var BASE_TEAM_PROD_MATRIX = [
  { team: '政府行业组-陈思源组',   nvr: 850,  ai: 480, ipc: 580, sw: 420, ac: 180, it: 90,  st: 220, lcd: 150, prev: 2480, yoy: '+25.8%' },
  { team: '政府行业组-王志强组',   nvr: 720,  ai: 380, ipc: 420, sw: 320, ac: 130, it: 60,  st: 180, lcd: 110, prev: 1900, yoy: '+22.1%' },
  { team: '政府行业组-李梦琪组',   nvr: 480,  ai: 220, ipc: 280, sw: 180, ac: 90,  it: 40,  st: 130, lcd: 80,  prev: 1280, yoy: '+15.3%' },
  { team: '政府行业组-廖贝贝组',   nvr: 380,  ai: 180, ipc: 220, sw: 150, ac: 70,  it: 30,  st: 100, lcd: 60,  prev: 1050, yoy: '+11.4%' },
  { team: '公安交警行业组-张伟组',     nvr: 380,  ai: 60,  ipc: 250, sw: 130, ac: 240, it: 120, st: 95,  lcd: 60,  prev: 1180, yoy: '+12.5%' },
  { team: '公安交警行业组-张继成组',   nvr: 280,  ai: 40,  ipc: 180, sw: 90,  ac: 180, it: 80,  st: 70,  lcd: 45,  prev: 850,  yoy: '+8.2%'  },
  { team: '工业企业一组-罗兴华组',   nvr: 220,  ai: 30,  ipc: 130, sw: 220, ac: 50,  it: 25,  st: 55,  lcd: 75,  prev: 720,  yoy: '+12.5%' },
  { team: '工业企业一组-黄燕滨组',   nvr: 180,  ai: 25,  ipc: 95,  sw: 180, ac: 40,  it: 20,  st: 40,  lcd: 50,  prev: 510,  yoy: '+23.5%' },
  { team: '工业企业一组-潘仲楠组',   nvr: 150,  ai: 20,  ipc: 80,  sw: 140, ac: 30,  it: 15,  st: 35,  lcd: 40,  prev: 440,  yoy: '+15.9%' },
  { team: '智慧建筑组-赵启超组',   nvr: 130,  ai: 15,  ipc: 80,  sw: 65,  ac: 35,  it: 380, st: 50,  lcd: 30,  prev: 690,  yoy: '-8.5%'  },
  { team: '智慧建筑组-李金富组',   nvr: 95,   ai: 8,   ipc: 55,  sw: 45,  ac: 25,  it: 250, st: 30,  lcd: 20,  prev: 480,  yoy: '+5.2%'  },
  { team: '智慧建筑组-朱绪浩组',   nvr: 80,   ai: 5,   ipc: 45,  sw: 35,  ac: 20,  it: 200, st: 25,  lcd: 15,  prev: 380,  yoy: '+11.8%'  },
  { team: '客户销售一部-张栋柱组', nvr: 200,  ai: 15,  ipc: 120, sw: 80,  ac: 60,  it: 25,  st: 90,  lcd: 45,  prev: 580,  yoy: '+9.4%'  },
  { team: '客户销售一部-陈刚组',   nvr: 170,  ai: 10,  ipc: 100, sw: 65,  ac: 45,  it: 20,  st: 75,  lcd: 35,  prev: 480,  yoy: '+8.3%'  },
  { team: '客户销售二部-朱迪组',   nvr: 150,  ai: 8,   ipc: 90,  sw: 55,  ac: 35,  it: 15,  st: 60,  lcd: 30,  prev: 410,  yoy: '+7.3%'  }
];

// 经营概览: 二级部门销售排名 (政府行业组/公安交警行业组/工业企业一组/智慧建筑组)
var BASE_DEPT_RANK = [
  { dept: '政府行业组',    sales: 3850, yoy: 15.2 },
  { dept: '公安交警行业组',    sales: 2620, yoy: 10.8 },
  { dept: '工业企业一组',    sales: 1740, yoy:  6.5 },
  { dept: '智慧建筑组',    sales: 1320, yoy: -3.2 },
  { dept: '客户销售一部',  sales: 1120, yoy:  4.5 },
  { dept: '客户销售二部',  sales:  950, yoy:  2.8 },
  { dept: '大客户销售部',  sales:  780, yoy:  7.2 },
  { dept: '行业一部',      sales: 2100, yoy:  3.8 },
  { dept: '行业二部',      sales: 1850, yoy:  5.5 }
];

// 经营概览: 销售量构成 (按产品, 12 潜力产品)
var BASE_PROD_COMPOSITION = [
  { product: 'NVR',          sales: 3210, color: '#1a56db' },
  { product: '智能计算',      sales: 2180, color: '#7c3aed' },
  { product: 'IPC',          sales: 1890, color: '#10b981' },
  { product: '平台软件',      sales: 1420, color: '#f59e0b' },
  { product: '门禁',          sales:  980, color: '#ef4444' },
  { product: '智能交通',      sales:  850, color: '#06b6d4' },
  { product: '存储',          sales:  720, color: '#3b82f6' },
  { product: 'LCD与解码',     sales:  610, color: '#84cc16' },
  { product: '出入口停车',     sales:  420, color: '#a855f7' },
  { product: '音频产品',      sales:  320, color: '#ec4899' },
  { product: '人员通道',      sales:  180, color: '#14b8a6' },
  { product: '行业软件',      sales:  150, color: '#f97316' },
  { product: '通用软件',      sales:  280, color: '#6366f1' },
  { product: '网络产品',      sales:  350, color: '#0ea5e9' },
  { product: '新业务',        sales:  200, color: '#e11d48' },
  { product: '专网摄像机',     sales:  130, color: '#ca8a04' }
];
App.BASE_PROD_COMPOSITION_REF = BASE_PROD_COMPOSITION;

// 经营概览: 本期 vs 同期 + 产品同比趋势 (按月, 近 12 月)
var BASE_PROD_YOY_MONTHS = ['08', '09', '10', '11', '12', '01', '02', '03', '04', '05', '06', '07'];
// 4 个核心潜力产品的本期/同期数据 (单位: 万元)
var BASE_PROD_YOY_DATA = [
  { prod: 'NVR',      curr: [1200,1320,1410,1380,1500,1620,1750,1880,2050,2280,2780,3210], prev: [800, 850, 880, 920, 960, 1010,1080,1150,1220,1300,1680,2030] },
  { prod: '智能计算',   curr: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1200, 2180], prev: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { prod: 'IPC',      curr: [1100,1180,1220,1280,1320,1380,1420,1500,1580,1650,1780,1890], prev: [950, 980, 1010, 1050, 1090, 1130, 1170, 1230, 1290, 1350, 1430, 1540] },
  { prod: '门禁',      curr: [1650,1620,1580,1520,1450,1400,1350,1280,1200,1100,1020, 980], prev: [1250,1280,1310,1340,1370,1400,1430,1440,1450,1440,1430,1280] }
];

// 经营概览: 量价四象限 (X=数量同比%, Y=金额同比%, 颜色=分类)
var BASE_QUADRANT = [
  { product: 'NVR',        qtyYoY:  42.1, amtYoY:  58.3, type: '量价齐升' },
  { product: '智能计算',    qtyYoY: 100.0, amtYoY: 100.0, type: '新增' },
  { product: 'IPC',        qtyYoY:  15.2, amtYoY:  22.4, type: '量价齐升' },
  { product: '平台软件',    qtyYoY:  -3.2, amtYoY:  18.7, type: '量跌价增' },
  { product: '门禁',        qtyYoY: -18.6, amtYoY: -23.5, type: '量价齐跌' },
  { product: '智能交通',    qtyYoY:  -5.4, amtYoY: -11.2, type: '量价齐跌' },
  { product: '存储',        qtyYoY:  12.3, amtYoY:   8.4, type: '量价齐升' },
  { product: 'LCD与解码',   qtyYoY:   8.7, amtYoY:   5.2, type: '量价齐升' },
  { product: '出入口停车',   qtyYoY:  18.5, amtYoY:  15.2, type: '量价齐升' },
  { product: '音频产品',    qtyYoY:   6.3, amtYoY:   2.8, type: '量价齐升' },
  { product: '人员通道',    qtyYoY:  -2.5, amtYoY:  -1.8, type: '量价齐跌' },
  { product: '行业软件',    qtyYoY:  25.0, amtYoY:  32.5, type: '量价齐升' }
];

// 经营概览: 大部门 × 产品 差距热图数据 (整合自乔梦杰版)
// 12 个潜力产品 × 4 团队 销售额(万元)
var BASE_GAP_HEATMAP_PRODS = [
  'NVR', '智能计算', 'IPC', '平台软件', '门禁', '智能交通',
  '存储', 'LCD与解码', '出入口停车', '音频产品', '人员通道', '行业软件'
];
var BASE_GAP_HEATMAP_TEAMS = [
  { team: '政府行业组',    data: [ 850, 480, 580, 420, 180,  90, 220, 150,  60,  45,  35,  80] },
  { team: '公安交警行业组',    data: [ 660, 100, 430, 220, 420, 200, 165, 105,  40,  30,  25,  35] },
  { team: '工业企业一组',    data: [ 400,  55, 225, 400,  90,  45,  95, 125,  30,  20,  15,  40] },
  { team: '智慧建筑组',    data: [ 225,  23, 135, 110,  60, 630,  80,  50,  20,  10,  10,  15] },
  { team: '客户销售一部',  data: [ 320,  85, 200, 180, 120,  55, 130,  90,  35,  25,  20,  50] },
  { team: '客户销售二部',  data: [ 280,  60, 170, 150,  95,  40, 110,  75,  25,  18,  15,  35] },
  { team: '大客户销售部',  data: [ 450, 150, 300, 250, 100,  70, 160, 110,  45,  35,  25,  60] }
];

// 产品宽度分布-团队统计 (凯玲版弹窗数据)
// 每个宽度桶下各团队的客户数
var BASE_WIDTH_BUCKET_TEAM_STATS = {
  '0':    { total: 42,  teams: [ {team:'罗育福',count:7},{team:'段金钊',count:6},{team:'张振凌',count:5},{team:'陈备11',count:4},{team:'陈天6',count:4},{team:'王鹏组',count:3},{team:'罗兴华',count:2},{team:'蔡月青',count:2},{team:'王思伍5',count:2},{team:'沙婷',count:2},{team:'唐伟宗',count:1},{team:'陈伟杰',count:1},{team:'高通10',count:1},{team:'黄燕滨',count:1},{team:'李梦琪',count:1} ] },
  '1-3':  { total: 302, teams: [ {team:'陈天6',count:71},{team:'段金钊',count:66},{team:'张振凌',count:23},{team:'陈备11',count:21},{team:'唐伟宗',count:17},{team:'沙婷',count:15},{team:'陈伟杰',count:14},{team:'黄燕滨',count:13},{team:'王思伍5',count:12},{team:'蔡月青',count:12},{team:'王鹏组',count:10},{team:'罗兴华',count:9},{team:'高通10',count:7},{team:'罗育福',count:4} ] },
  '4-6':  { total: 66,  teams: [ {team:'罗兴华',count:18},{team:'陈伟杰',count:11},{team:'黄燕滨',count:9},{team:'王鹏组',count:7},{team:'陈备11',count:5},{team:'李梦琪',count:4},{team:'蔡月青',count:4},{team:'沙婷',count:3},{team:'张振凌',count:2},{team:'陈天6',count:2},{team:'唐伟宗',count:1}] },
  '7-10': { total: 34,  teams: [ {team:'王鹏组',count:9},{team:'陈天6',count:6},{team:'罗兴华',count:5},{team:'陈伟杰',count:4},{team:'黄燕滨',count:3},{team:'段金钊',count:3},{team:'陈备11',count:2},{team:'唐伟宗',count:2}] },
  '11-15':{ total: 18,  teams: [ {team:'陈天6',count:6},{team:'罗兴华',count:3},{team:'王鹏组',count:3},{team:'黄燕滨',count:2},{team:'陈备11',count:2},{team:'陈伟杰',count:1},{team:'张振凌',count:1}] },
  '16+':  { total: 9,   teams: [ {team:'陈天6',count:3},{team:'王鹏组',count:2},{team:'罗兴华',count:1},{team:'段金钊',count:1},{team:'陈备11',count:1},{team:'张振凌',count:1}] }
};

// 团队平均产品宽度 - 完整版 (凯玲版, 13 个条目)
var BASE_TEAM_AVG_WIDTH = [
  { name: '政府组',         avg: 10.5 },
  { name: '罗湖组',         avg: 7 },
  { name: '陈天6',          avg: 6 },
  { name: '高峰10',         avg: 5.4 },
  { name: '沙头',           avg: 5.2 },
  { name: '王鹏组',         avg: 4.8 },
  { name: '彭城12',         avg: 4 },
  { name: '招商17',         avg: 4 },
  { name: '熊佳豪',         avg: 3.9 },
  { name: '陈思源',         avg: 3.4 },
  { name: '段金春',         avg: 1.5 }
];

// 产品覆盖率 TOP 15 - 完整版 (凯玲版)
var BASE_COVERAGE_TOP15 = [
  { name: 'IPC',              rate: 53.1 },
  { name: 'NVR',              rate: 36.7 },
  { name: '门禁',             rate: 27.8 },
  { name: '球机',             rate: 24.6 },
  { name: 'LCD与解码',        rate: 17.6 },
  { name: '新业务',           rate: 17.4 },
  { name: '通用软件',         rate: 16.3 },
  { name: '网络产品',         rate: 14.6 },
  { name: '存储',             rate: 11.5 },
  { name: '专网摄像机',       rate: 9.3 },
  { name: '服务',             rate: 8.9 },
  { name: '行业软件',         rate: 8.5 },
  { name: '智能计算',         rate: 7.9 },
  { name: '对讲',             rate: 7.6 },
  { name: '报警',             rate: 7.4 }
];

// 团队维度 (凯玲版) - 18 团队/个人 × 27 产品覆盖
// 列: 团队 / 客户数 / 平均宽度 / 最大宽度 / 规上 / 非规上 / [27产品计数]
var BASE_TEAM_DIMENSION = [
  { name: '陈思源',     count:  4, avg: 10.5, max: 21, guishang: 0, nonguishang:  4, prodCnt: [4,2,4,1,2,1,2,1,1,1,0,1,0,2,1,0,1,1,0,1,0,1,0,1,0,0,0] },
  { name: '宝安区8',    count:  2, avg:  7,   max: 12, guishang: 0, nonguishang:  2, prodCnt: [2,1,2,0,1,0,1,1,0,0,0,1,0,0,1,0,0,1,0,0,0,1,0,0,0,0,0] },
  { name: '罗湖组',     count: 13, avg:  7,   max: 16, guishang: 0, nonguishang: 13, prodCnt: [9,6,4,3,6,7,5,2,2,1,0,1,0,3,2,1,2,1,1,0,1,1,0,1,0,0,0] },
  { name: '招商17',     count:  1, avg:  6,   max:  6, guishang: 0, nonguishang:  1, prodCnt: [1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0] },
  { name: '高峰10',     count: 10, avg:  5.4, max: 23, guishang: 0, nonguishang: 10, prodCnt: [7,4,2,1,8,2,1,3,2,0,0,1,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0] },
  { name: '沙迪',       count: 29, avg:  5.2, max: 21, guishang: 0, nonguishang: 29, prodCnt: [23,9,8,7,3,10,8,5,2,1,0,0,0,1,0,0,1,0,0,1,0,0,0,0,0,1,0] },
  { name: '王鹏组',     count: 21, avg:  4.8, max: 12, guishang: 0, nonguishang: 21, prodCnt: [14,7,5,4,4,3,13,4,1,1,0,0,0,1,0,0,1,0,0,1,0,0,0,0,0,0,0] },
  { name: '彭城12',     count: 10, avg:  4.3, max: 16, guishang: 0, nonguishang: 10, prodCnt: [4,5,1,1,0,0,3,4,2,0,0,1,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0] },
  { name: '刘文平5',   count:  1, avg:  4,   max:  4, guishang: 0, nonguishang:  1, prodCnt: [1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] },
  { name: '唐伟宗',     count: 28, avg:  4,   max: 10, guishang: 0, nonguishang: 28, prodCnt: [15,15,6,3,3,1,18,2,1,5,1,1,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0] },
  { name: '王备国5',   count: 30, avg:  4,   max: 13, guishang: 0, nonguishang: 30, prodCnt: [19,11,5,5,1,1,11,5,1,7,1,1,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0] },
  { name: '陈备11',     count: 31, avg:  3.9, max: 13, guishang: 0, nonguishang: 31, prodCnt: [18,13,3,5,8,2,14,4,2,9,5,1,2,1,0,0,1,0,0,0,0,0,0,0,0,0,0] },
  { name: '唐怀春',     count: 21, avg:  3.7, max: 14, guishang: 0, nonguishang: 21, prodCnt: [14,7,4,1,1,2,11,3,1,2,1,1,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0] },
  { name: '陈伟杰',     count: 17, avg:  3.4, max: 22, guishang: 0, nonguishang: 17, prodCnt: [9,5,2,1,4,1,4,2,1,4,2,1,2,1,0,0,1,0,0,0,0,0,0,0,0,0,0] },
  { name: '张家添',     count: 32, avg:  3.3, max: 13, guishang: 0, nonguishang: 32, prodCnt: [19,7,2,4,5,1,10,7,2,8,2,1,2,1,0,0,1,0,0,0,0,0,0,0,0,0,0] },
  { name: '罗兴华',     count: 13, avg:  3.2, max: 16, guishang: 0, nonguishang: 13, prodCnt: [7,3,2,1,1,1,5,2,0,3,1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0] },
  { name: '张继任',     count:  5, avg:  3,   max:  7, guishang: 0, nonguishang:  5, prodCnt: [3,2,1,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] },
  { name: '黄燕滨',     count: 19, avg:  2.5, max:  9, guishang: 0, nonguishang: 19, prodCnt: [6,6,1,0,2,1,3,1,1,2,1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0] }
];

// 分组对比 (凯玲版) - 团队列表 + 个人列表 + 全部团队均值
var BASE_COMPARE_TEAMS = ['政府行业组', '公安交警行业组', '工业企业一组', '智慧建筑组'];
var BASE_COMPARE_PERSONS = [
  { name: '陈思源', team: '政府行业组' },
  { name: '王志强', team: '政府行业组' },
  { name: '李梦琪', team: '政府行业组' },
  { name: '陈伟杰', team: '政府行业组' },
  { name: '张伟',   team: '公安交警行业组' },
  { name: '张继成', team: '公安交警行业组' },
  { name: '罗兴华', team: '工业企业一组' },
  { name: '黄燕滨', team: '工业企业一组' },
  { name: '赵启超', team: '智慧建筑组' },
  { name: '李金富', team: '智慧建筑组' }
];

// 分组对比 - 27 品类 (凯玲版: 15 主类 + 12 细分)
var BASE_COMPARE_PRODS = ['IPC','NVR','门禁','球机','LCD与解码','新业务','通用软件','网络产品','存储','专网摄像机','服务器','行业软件','智能计算','对讲','报警','音频产品','人员通道','PCP产品','LED与拼控','综合布线','出入口停车','移动终端','基础软件','传感产品','网络安全','智慧屏','新业务'];

// 分组对比 - 团队 27 品类覆盖率 (单位: %)
var BASE_COMPARE_TEAM_PROD = {
  '政府行业组': [85,75,60,55,40,38,35,32,30,28,25,22,40,20,18,15,12,10,8,5,30,15,8,3,2,5,15],
  '公安交警行业组': [70,55,75,50,30,25,28,20,25,18,15,12,15,25,22,18,15,5,8,12,40,10,5,2,5,8,10],
  '工业企业一组': [60,40,35,30,45,30,25,18,20,8,5,30,20,12,8,5,5,3,2,1,12,8,3,2,1,2,5],
  '智慧建筑组': [50,30,15,12,8,8,10,15,15,5,3,5,5,8,5,5,3,2,1,2,55,5,2,1,1,2,3]
};

// 分组对比 - 个人 27 品类覆盖率 (单位: %)
var BASE_COMPARE_PERSON_PROD = {
  '陈思源': [95,90,75,70,50,45,40,38,35,32,30,28,45,25,22,18,15,12,10,8,35,18,10,5,3,8,20],
  '王志强': [90,80,65,60,40,35,32,28,30,25,22,20,38,20,18,15,12,10,8,6,30,15,8,3,2,6,15],
  '李梦琪': [80,65,50,45,30,28,25,22,22,18,15,15,28,15,12,10,8,5,4,3,22,10,5,2,1,4,10],
  '陈伟杰': [70,60,45,40,55,40,30,25,20,12,8,32,25,12,8,5,3,2,1,1,15,8,3,2,1,3,5],
  '张伟':   [75,65,80,55,25,20,30,22,28,18,12,10,15,25,20,18,15,5,8,12,45,10,5,2,5,8,10],
  '张继成': [60,50,70,40,20,15,22,15,18,12,8,8,10,18,15,12,10,3,5,8,35,8,3,2,3,5,8],
  '罗兴华': [55,35,30,25,40,28,20,15,15,5,3,28,18,10,5,3,3,1,1,1,8,5,2,1,1,2,3],
  '黄燕滨': [65,45,40,30,30,22,18,12,12,8,5,25,15,8,5,3,2,1,1,1,10,5,2,1,1,2,3],
  '赵启超': [50,30,15,12,8,8,10,15,15,5,3,5,5,8,5,5,3,2,1,2,60,5,2,1,1,2,3],
  '李金富': [45,25,12,10,5,5,8,10,12,3,2,3,3,5,3,3,2,1,1,1,50,3,1,1,1,1,2]
};

// 分组对比 - 团队汇总指标 (凯玲版 4 项)
var BASE_COMPARE_TEAM_STATS = {
  '政府行业组': { count: 437, avgWidth: 4.28, maxWidth: 10, guishang: 311, guishangRate: 71.2 },
  '公安交警行业组': { count: 374, avgWidth: 3.76, maxWidth: 8,  guishang: 266, guishangRate: 71.1 },
  '工业企业一组': { count: 249, avgWidth: 3.48, maxWidth: 7,  guishang: 178, guishangRate: 71.5 },
  '智慧建筑组': { count: 187, avgWidth: 3.24, maxWidth: 6,  guishang: 133, guishangRate: 71.1 }
};

// 分组对比 - 个人汇总指标
var BASE_COMPARE_PERSON_STATS = {
  '陈思源': { count: 18, avgWidth: 5.8, maxWidth: 10, guishang: 18, guishangRate: 100 },
  '王志强': { count: 15, avgWidth: 5.2, maxWidth: 9,  guishang: 15, guishangRate: 100 },
  '李梦琪': { count: 10, avgWidth: 4.3, maxWidth: 7,  guishang: 10, guishangRate: 100 },
  '陈伟杰': { count: 9,  avgWidth: 4.1, maxWidth: 6,  guishang: 9,  guishangRate: 100 },
  '张伟':   { count: 12, avgWidth: 4.8, maxWidth: 8,  guishang: 12, guishangRate: 100 },
  '张继成': { count: 8,  avgWidth: 3.6, maxWidth: 5,  guishang: 8,  guishangRate: 100 },
  '罗兴华': { count: 8,  avgWidth: 3.9, maxWidth: 6,  guishang: 8,  guishangRate: 100 },
  '黄燕滨': { count: 19, avgWidth: 2.5, maxWidth: 9,  guishang: 19, guishangRate: 100 },
  '赵启超': { count: 7,  avgWidth: 3.4, maxWidth: 5,  guishang: 7,  guishangRate: 100 },
  '李金富': { count: 7,  avgWidth: 3.2, maxWidth: 4,  guishang: 7,  guishangRate: 100 }
};

// 全部团队均值 (凯玲版 groupStats 公式: allTotal/allAccounts)
var BASE_COMPARE_ALL_MEAN = {
  count: 1247, avgWidth: 3.96, maxWidth: 10, guishang: 888, guishangRate: 71.2
};

// 团队维度显示用的 27 品类 (顺序与 prodCnt 一致)
var BASE_TEAM_DIM_PRODS = ['IPC','球机','专用摄像机','服务器','网络产品','NVR','存储','LCD与解码','智能交通','移动终端','出入口停车','门禁','行业软件','对讲','报警','音频产品','人员通道','PCP产品','LED与拼控','网络产品','综合布线','智慧屏','服务器','基础软件','新业务','传感产品','网络安全'];
// 注: 上面 27 个中前 15 是宽分类 + 12 细分, 这里简化为 18 系列产品, 适配 凯玲版主区

// 经营概览: 销售人员潜力产品排名 (整合自乔梦杰版)
// 12 潜力产品, 每个销售员标注覆盖/未覆盖
var BASE_SALES_POTENTIAL_RANK = [
  { rank: 1, name: '陈思源', team: '政府行业组', sales: 1850, prev: 1370, yoy: '+35%',  covered: ['NVR','智能计算','IPC','平台软件','门禁','存储','LCD与解码','出入口停车'], uncovered: ['智能交通','音频产品','人员通道','行业软件'] },
  { rank: 2, name: '王志强', team: '政府行业组', sales: 1420, prev: 1164, yoy: '+22%',  covered: ['NVR','IPC','平台软件','门禁','存储','LCD与解码','出入口停车'], uncovered: ['智能计算','智能交通','音频产品','人员通道','行业软件'] },
  { rank: 3, name: '张伟',   team: '公安交警行业组', sales:  980, prev:  831, yoy: '+18%',  covered: ['NVR','IPC','门禁','智能交通','存储','出入口停车','音频产品'], uncovered: ['智能计算','平台软件','LCD与解码','人员通道','行业软件'] },
  { rank: 4, name: '陈伟杰', team: '政府行业组', sales:  850, prev:  459, yoy: '+85%',  covered: ['智能计算','NVR','IPC','平台软件','LCD与解码','存储'], uncovered: ['门禁','智能交通','出入口停车','音频产品','人员通道','行业软件'] },
  { rank: 5, name: '李梦琪', team: '政府行业组', sales:  720, prev:  643, yoy: '+12%',  covered: ['NVR','LCD与解码','存储','IPC','平台软件'], uncovered: ['智能计算','门禁','智能交通','出入口停车','音频产品','人员通道','行业软件'] },
  { rank: 6, name: '罗兴华', team: '工业企业一组', sales:  650, prev:  508, yoy: '+28%',  covered: ['平台软件','LCD与解码','行业软件','NVR','存储'], uncovered: ['智能计算','门禁','智能交通','出入口停车','音频产品','人员通道','IPC'] },
  { rank: 7, name: '黄燕滨', team: '工业企业一组', sales:  580, prev:  302, yoy: '+92%',  covered: ['智能计算','平台软件','NVR','LCD与解码','行业软件','存储','IPC'], uncovered: ['门禁','智能交通','出入口停车','音频产品','人员通道'] },
  { rank: 8, name: '赵启超', team: '智慧建筑组', sales:  480, prev:  417, yoy: '+15%',  covered: ['智能交通','NVR','存储','IPC'], uncovered: ['智能计算','平台软件','门禁','LCD与解码','出入口停车','音频产品','人员通道','行业软件'] },
  { rank: 9, name: '张继成', team: '公安交警行业组', sales:  420, prev:  296, yoy: '+42%',  covered: ['门禁','NVR','IPC','出入口停车','人员通道'], uncovered: ['智能计算','平台软件','智能交通','LCD与解码','存储','音频产品','行业软件'] },
  { rank: 10, name: '李金富', team: '智慧建筑组', sales:  360, prev:  333, yoy: '+8%',  covered: ['智能交通','存储','IPC','出入口停车'], uncovered: ['NVR','智能计算','平台软件','门禁','LCD与解码','音频产品','人员通道','行业软件'] },
  { rank: 11, name: '朱绪浩', team: '智慧建筑组', sales:  320, prev:  305, yoy: '+5%',  covered: ['智能交通','IPC','存储'], uncovered: ['NVR','智能计算','平台软件','门禁','LCD与解码','音频产品','出入口停车','人员通道','行业软件'] },
  { rank: 12, name: '潘仲楠', team: '工业企业一组', sales:  290, prev:  246, yoy: '+18%',  covered: ['平台软件','行业软件','IPC'], uncovered: ['NVR','智能计算','门禁','智能交通','LCD与解码','存储','出入口停车','音频产品','人员通道'] },
  { rank: 13, name: '廖贝贝', team: '政府行业组', sales:  260, prev:  232, yoy: '+12%',  covered: ['NVR','IPC','存储'], uncovered: ['智能计算','平台软件','门禁','智能交通','LCD与解码','出入口停车','音频产品','人员通道','行业软件'] },
  { rank: 14, name: '刘文宇', team: '客户销售一部', sales:  240, prev:  247, yoy: '-3%',  covered: ['IPC','门禁','球机'], uncovered: ['NVR','智能计算','平台软件','智能交通','LCD与解码','存储','出入口停车','音频产品','人员通道','行业软件'] },
  { rank: 15, name: '邓畅',   team: '客户销售二部', sales:  220, prev:  204, yoy: '+8%',  covered: ['IPC','存储','LCD与解码'], uncovered: ['NVR','智能计算','平台软件','门禁','智能交通','出入口停车','音频产品','人员通道','行业软件'] }
];

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
  var s = scaleKpi;

  return {
    kpi: {
      customers:      s(BASE_WIDTH.customers, f.customers),
      scaleUp:        s(BASE_WIDTH.scaleUp, f.customers),
      scaleUsers:     s(BASE_WIDTH.scaleUsers, f.customers),
      nonScale:       s(BASE_WIDTH.nonScale, f.customers),
      avgWidth:       s(BASE_WIDTH.avgWidth, f.width).toFixed(2),
      coverage:       (s(parseFloat(BASE_WIDTH.coverage), f.width).toFixed(1)) + '%',
      widthYoY:       scaleYoY(BASE_WIDTH.widthYoY, f.width),
      customersMoM:   s(BASE_WIDTH.customersMoM, f.customers),
      coverageYoY:    BASE_WIDTH.coverageYoY
    },
    missing: BASE_MISSING.map(function(m) {
      return {
        product: m.product,
        covered: s(m.covered, f.customers),
        missing: s(m.missing, f.customers),
        rate: (s(parseFloat(m.rate), 1 / f.customers) + 2).toFixed(1) + '%',
        bar: Math.min(100, Math.round(s(m.bar, 1 / f.customers) + 2))
      };
    }),
    // 宽度分布图表数据
    chartDist: {
      labels: ['0', '1-3', '4-6', '7-10', '11-15', '16+'],
      data: [s(42,1/f.customers), s(302,f.customers), s(66,f.customers), s(34,f.customers), s(18,f.customers), s(9,f.customers)]
    },
    // 团队宽度排名图表
    chartTeam: {
      labels: team === 'all'
        ? ['政府组','罗湖组','高峰10','沙头','王鹏组','彭城12','招商17','熊佳豪','陈思源','段金春']
        : ['一组','二组','三组'],
      data: team === 'all'
        ? [10.5, 7, 6, 5.4, 5.2, 4.8, 4, 4, 3.9, 3.4]
        : [s(8,f.width).toFixed(1), s(6,f.width).toFixed(1), s(5,f.width).toFixed(1)]
    },
    // 覆盖率图表
    chartCov: {
      labels: ['IPC','NVR','门禁','球机','LCD'],
      data: [s(53.1, f.width).toFixed(0), s(36.7, f.width).toFixed(0), s(27.8, f.width).toFixed(0), s(24.6, f.width).toFixed(0), s(17.6, f.width).toFixed(0)]
    },
    // 规上 vs 非规上
    chartReg: {
      customers: s(471, f.customers),
      avgWidth: s(3.2, f.width).toFixed(1)
    },
    // 产品覆盖热力图 (27 品类)
    heatmap: (function() {
      var total = s(BASE_HEATMAP_TOTAL, f.customers);
      var products = BASE_HEATMAP_PRODS.map(function(p) {
        var cnt = s(p.count, f.customers);
        return {
          name:  p.name,
          count: cnt,
          rate:  parseFloat(((cnt / total) * 100).toFixed(1))
        };
      });
      return { total: total, products: products };
    })(),
    // 客户产品宽度覆盖 TOP 10 / 后 10
    custGood: BASE_CUST_GOOD,
    custBad:  BASE_CUST_BAD,
    // 客户分层 (20个客户)
    custSegment: BASE_CUST_SEGMENT,
    // 交叉销售关联矩阵
    crossSell: {
      prods: BASE_CROSS_SELL_PRODS,
      matrix: BASE_CROSS_SELL_MATRIX,
      bundles: BASE_CROSS_BUNDLES
    },
    // 用户产品宽度覆盖 TOP / 后 5
    userGood: BASE_USER_GOOD,
    userBad:  BASE_USER_BAD,
    // 团队维度 (凯玲版)
    teamDimension: {
      prods: ['IPC','球机','专用摄像机','服务器','网络产品','NVR','存储','LCD与解码','智能交通','移动终端','出入口停车','门禁','行业软件','对讲','报警','音频产品','人员通道','PCP产品','LED与拼控','综合布线','智慧屏','基础软件','新业务','传感产品','网络安全','智能计算','网络产品'],
      teams: BASE_TEAM_DIMENSION
    }
  };
};

/**
 * 生成 Potential 页某个团队的数据切片
 */
App.Data.getPotential = function(team) {
  var f = SCALE[team] || SCALE['all'];
  var s = scaleKpi;

  return {
    kpi: {
      sales: '¥ ' + s(BASE_POTENTIAL.sales, f.sales).toLocaleString() + '万',
      share: (s(parseFloat(BASE_POTENTIAL.share), 1) + (f.sales - 1) * 2).toFixed(1) + '%',
      upCount: Math.max(1, s(BASE_POTENTIAL.upCount, f.sales)),
      upAmount: '¥ ' + s(BASE_POTENTIAL.upAmount, f.sales).toLocaleString() + '万',
      downCount: s(BASE_POTENTIAL.downCount, 1),
      downAmount: '¥ ' + s(BASE_POTENTIAL.downAmount, f.sales).toLocaleString() + '万',
      newCount: s(BASE_POTENTIAL.newCount, f.sales),
      newAmount: '¥ ' + s(BASE_POTENTIAL.newAmount, f.sales).toLocaleString() + '万'
    },
    top10: BASE_POTENTIAL_PRODUCT.map(function(p) {
      return { product: p.product, sales: '¥ ' + s(p.sales, f.sales).toLocaleString() + '万', yoy: p.yoy, qty: p.qty, type: p.type };
    }),
    matrix: team === 'all' ? BASE_MATRIX : BASE_MATRIX.slice(0, 3),
    salesRank: BASE_SALES_RANK.filter(function(r) {
      return team === 'all' || r[4] === team;
    }).slice(0, team === 'all' ? 10 : 5),
    // ===== 经营概览 (整合自乔梦杰版) =====
    // 5 KPI 卡片
    overview: {
      sales:        s(BASE_POTENTIAL.sales, f.sales),                                  // 万元
      salesPrev:    s(Math.round(BASE_POTENTIAL.sales * 0.78), f.sales),               // 同期 (模拟 78% base)
      productCount: 12,                                                                 // 潜力产品数
      customerCount: s(386, f.customers),                                               // 客户数
      customerPrev:  s(312, f.customers),                                               // 同期客户数
      avgPrice:     parseFloat((s(BASE_POTENTIAL.sales, f.sales) / s(386, f.customers)).toFixed(1)),
      deptCount:    4                                                                    // 二级部门数
    },
    // 团队 × 产品矩阵
    teamProdMatrix: BASE_TEAM_PROD_MATRIX,
    // 部门销售排名
    deptRank: BASE_DEPT_RANK,
    // 销售量构成
    prodComposition: BASE_PROD_COMPOSITION,
    // 产品同比趋势
    prodYoY: { months: BASE_PROD_YOY_MONTHS, data: BASE_PROD_YOY_DATA },
    // 量价四象限
    quadrant: BASE_QUADRANT,
    // 大部门 x 产品 差距热图 (整合自乔梦杰版)
    gapHeatmap: {
      prods: BASE_GAP_HEATMAP_PRODS,
      teams: BASE_GAP_HEATMAP_TEAMS
    },
    // 销售人员潜力产品排名 (整合自乔梦杰版)
    salesPotentialRank: BASE_SALES_POTENTIAL_RANK
  };
};

// ===== 客户维度 — 产品宽度明细数据（团队分析） =====
// 字段: team(团队), account(CRM账号), user(最终用户), width(产品宽度合计), guishang(是否规上 1/0), prods(产品覆盖对象)
App.WidthCustomer = {};
App.WidthCustomer.PRODUCTS = ['IPC','NVR','门禁','球机','LCD与解码','新业务','通用软件','网络产品','存储','专用摄像机','服务器','智能交通','移动终端','出入口停车','行业软件','对讲','报警','音频产品','人员通道','LED与拼控','综合布线','智慧屏','基础软件','传感产品','网络安全','智能计算','消防'];

App.WidthCustomer.RAW = [
  { team:'政府行业组', account:'liaobeibei',  user:'深圳市政府',    width:10, guishang:1, prods:{IPC:1,NVR:1,门禁:1,球机:1,'LCD与解码':1,新业务:1,通用软件:1,网络产品:1,存储:1,专用摄像机:1} },
  { team:'政府行业组', account:'liaobeibei',  user:'宝安区政府',    width:8,  guishang:1, prods:{IPC:1,NVR:1,门禁:1,球机:1,'LCD与解码':1,新业务:1,通用软件:1,存储:1} },
  { team:'政府行业组', account:'wangzhiqiang',user:'深圳市公安',    width:7,  guishang:1, prods:{IPC:1,NVR:1,门禁:1,球机:1,智能交通:1,移动终端:1,出入口停车:1} },
  { team:'政府行业组', account:'wangzhiqiang',user:'龙岗公安分局',  width:6,  guishang:1, prods:{IPC:1,NVR:1,门禁:1,球机:1,智能交通:1,报警:1} },
  { team:'政府行业组', account:'chensiyuan',  user:'深圳市教育局',  width:5,  guishang:0, prods:{IPC:1,NVR:1,'LCD与解码':1,通用软件:1,智慧屏:1} },
  { team:'政府行业组', account:'chensiyuan',  user:'南山区教育局',  width:4,  guishang:0, prods:{IPC:1,NVR:1,'LCD与解码':1,存储:1} },
  { team:'政府行业组', account:'limengqi',    user:'深圳市卫健委',  width:4,  guishang:0, prods:{IPC:1,门禁:1,通用软件:1,对讲:1} },
  { team:'政府行业组', account:'limengqi',    user:'深圳市文体局',  width:3,  guishang:0, prods:{'LCD与解码':1,新业务:1,通用软件:1} },
  { team:'公安交警行业组', account:'fangweijian', user:'深圳市交警支队',width:9,  guishang:1, prods:{IPC:1,NVR:1,球机:1,智能交通:1,移动终端:1,出入口停车:1,服务器:1,存储:1,报警:1} },
  { team:'公安交警行业组', account:'fangweijian', user:'广东省交通厅',  width:7,  guishang:1, prods:{智能交通:1,IPC:1,球机:1,移动终端:1,服务器:1,存储:1,网络安全:1} },
  { team:'公安交警行业组', account:'zhangwei',    user:'深圳市车管所',  width:5,  guishang:0, prods:{IPC:1,球机:1,智能交通:1,移动终端:1,出入口停车:1} },
  { team:'公安交警行业组', account:'zhangwei',    user:'宝安交警大队',  width:4,  guishang:0, prods:{IPC:1,球机:1,智能交通:1,移动终端:1} },
  { team:'公安交警行业组', account:'zhangjicheng',user:'龙华交警大队',  width:3,  guishang:0, prods:{IPC:1,球机:1,报警:1} },
  { team:'公安交警行业组', account:'zhangjicheng',user:'高速公路管理处',width:3,  guishang:0, prods:{智能交通:1,出入口停车:1,移动终端:1} },
  { team:'工业企业一组', account:'panzhongnan', user:'深圳大学',      width:8,  guishang:1, prods:{IPC:1,NVR:1,门禁:1,球机:1,'LCD与解码':1,通用软件:1,网络产品:1,存储:1} },
  { team:'工业企业一组', account:'panzhongnan', user:'南方科技大学',  width:6,  guishang:1, prods:{IPC:1,NVR:1,门禁:1,'LCD与解码':1,智慧屏:1,基础软件:1} },
  { team:'工业企业一组', account:'luoxinghua',  user:'深圳市图书馆',  width:4,  guishang:0, prods:{IPC:1,NVR:1,门禁:1,通用软件:1} },
  { team:'工业企业一组', account:'luoxinghua',  user:'深圳市博物馆',  width:3,  guishang:0, prods:{IPC:1,门禁:1,报警:1} },
  { team:'工业企业一组', account:'huangyanbin', user:'罗湖教育局',    width:5,  guishang:0, prods:{IPC:1,NVR:1,'LCD与解码':1,通用软件:1,智慧屏:1} },
  { team:'工业企业一组', account:'huangyanbin', user:'龙岗区教育局',  width:3,  guishang:0, prods:{IPC:1,NVR:1,'LCD与解码':1} },
  { team:'智慧建筑组', account:'zhuxuhao',    user:'深圳地铁集团',  width:6,  guishang:1, prods:{IPC:1,智能交通:1,移动终端:1,出入口停车:1,门禁:1,存储:1} },
  { team:'智慧建筑组', account:'zhuxuhao',    user:'深圳机场集团',  width:5,  guishang:0, prods:{IPC:1,门禁:1,智能交通:1,出入口停车:1,报警:1} },
  { team:'智慧建筑组', account:'zhaoqichao',  user:'深圳巴士集团',  width:4,  guishang:0, prods:{IPC:1,智能交通:1,移动终端:1,出入口停车:1} },
  { team:'智慧建筑组', account:'zhaoqichao',  user:'东部公交公司',  width:3,  guishang:0, prods:{IPC:1,智能交通:1,移动终端:1} },
  { team:'智慧建筑组', account:'lijinfu',     user:'西部公交公司',  width:3,  guishang:0, prods:{IPC:1,智能交通:1,移动终端:1} },
  { team:'智慧建筑组', account:'lijinfu',     user:'深圳港口集团',  width:4,  guishang:0, prods:{IPC:1,出入口停车:1,门禁:1,存储:1} },
  { team:'客户销售一组',account:'zhangdongzhu',user:'天眼监控科技', width:2,  guishang:0, prods:{IPC:1,NVR:1} },
  { team:'客户销售一组',account:'zhangdongzhu',user:'江河电子有限公司',width:2,guishang:0, prods:{IPC:1,门禁:1} },
  { team:'客户销售二组',account:'chengangsz', user:'鹏城科技集团',  width:3,  guishang:0, prods:{IPC:1,NVR:1,存储:1} },
  { team:'客户销售三组',account:'liuwenyu',   user:'华润万象城',    width:4,  guishang:0, prods:{IPC:1,门禁:1,出入口停车:1,报警:1} },
  { team:'客户销售四组',account:'zhudi7',     user:'招商局地产',    width:3,  guishang:0, prods:{IPC:1,门禁:1,'LCD与解码':1} },
  { team:'客户销售五组',account:'dengchang',  user:'沙头派出所',    width:2,  guishang:0, prods:{IPC:1,报警:1} }
];

// 返回所有团队列表
App.WidthCustomer.getTeams = function() {
  var set = {};
  App.WidthCustomer.RAW.forEach(function(r) { set[r.team] = true; });
  return Object.keys(set).sort();
};

// ===== 团队维度 — 团队小组 × 潜力产品 · 本期 vs 同期对照表（乔梦杰版） =====
App.WidthTeamMatrix = {};
App.WidthTeamMatrix.PRODUCTS = ['NVR','智能计算','IPC','平台软件','门禁','智能交通','存储','LCD与解码'];

// 颗粒化数据: 每条记录 = 一个团队小组 × 一个产品 的本期/同期销售额（万元）
// ===== 团队维度 — 大部门 × 产品 差距热图数据 =====
App.WidthTeamGap = {};
App.WidthTeamGap.PRODUCTS = ['IPC','NVR','门禁','球机','LCD与解码','存储','网络产品','智能交通'];
App.WidthTeamGap.TEAMS = [
  { name: '行业二部',     data: [472, 326, 195, 178, 142, 108, 82, 55] },
  { name: '行业一部',     data: [398, 252, 168, 138, 198, 95, 65, 48] },
  { name: '客户销售一部', data: [345, 210, 142, 125, 95, 78, 72, 38] },
  { name: '客户销售二部', data: [312, 185, 128, 108, 82, 68, 55, 32] },
  { name: '大客户销售部', data: [258, 145, 108, 85, 65, 48, 42, 28] }
];

// 团队维度 — 团队小组 × 潜力产品 · 本期 vs 同期对照表
App.WidthTeamMatrix = {};
App.WidthTeamMatrix.PRODUCTS = ['NVR','智能计算','IPC','平台软件','门禁','智能交通','存储','LCD与解码'];
App.WidthTeamMatrix.RAW = [
  // 政府行业组-陈思源组
  { team:'政府行业组-陈思源组', product:'NVR',       amount: 850, amountPrev: 620 },
  { team:'政府行业组-陈思源组', product:'智能计算',  amount: 480, amountPrev:   0 },
  { team:'政府行业组-陈思源组', product:'IPC',       amount: 580, amountPrev: 450 },
  { team:'政府行业组-陈思源组', product:'平台软件',  amount: 420, amountPrev: 350 },
  { team:'政府行业组-陈思源组', product:'门禁',      amount: 180, amountPrev: 210 },
  { team:'政府行业组-陈思源组', product:'智能交通',  amount:  90, amountPrev:  70 },
  { team:'政府行业组-陈思源组', product:'存储',      amount: 220, amountPrev: 180 },
  { team:'政府行业组-陈思源组', product:'LCD与解码', amount: 150, amountPrev: 120 },
  // 政府行业组-王志强组
  { team:'政府行业组-王志强组', product:'NVR',       amount: 720, amountPrev: 550 },
  { team:'政府行业组-王志强组', product:'智能计算',  amount: 380, amountPrev:   0 },
  { team:'政府行业组-王志强组', product:'IPC',       amount: 420, amountPrev: 380 },
  { team:'政府行业组-王志强组', product:'平台软件',  amount: 320, amountPrev: 280 },
  { team:'政府行业组-王志强组', product:'门禁',      amount: 130, amountPrev: 160 },
  { team:'政府行业组-王志强组', product:'智能交通',  amount:  60, amountPrev:  50 },
  { team:'政府行业组-王志强组', product:'存储',      amount: 180, amountPrev: 150 },
  { team:'政府行业组-王志强组', product:'LCD与解码', amount: 110, amountPrev:  95 },
  // 政府行业组-李梦琪组
  { team:'政府行业组-李梦琪组', product:'NVR',       amount: 480, amountPrev: 380 },
  { team:'政府行业组-李梦琪组', product:'智能计算',  amount: 220, amountPrev:   0 },
  { team:'政府行业组-李梦琪组', product:'IPC',       amount: 280, amountPrev: 250 },
  { team:'政府行业组-李梦琪组', product:'平台软件',  amount: 180, amountPrev: 160 },
  { team:'政府行业组-李梦琪组', product:'门禁',      amount:  90, amountPrev: 120 },
  { team:'政府行业组-李梦琪组', product:'智能交通',  amount:  40, amountPrev:  35 },
  { team:'政府行业组-李梦琪组', product:'存储',      amount: 130, amountPrev: 110 },
  { team:'政府行业组-李梦琪组', product:'LCD与解码', amount:  80, amountPrev:  70 },
  // 政府行业组-廖贝贝组
  { team:'政府行业组-廖贝贝组', product:'NVR',       amount: 380, amountPrev: 310 },
  { team:'政府行业组-廖贝贝组', product:'智能计算',  amount: 180, amountPrev:   0 },
  { team:'政府行业组-廖贝贝组', product:'IPC',       amount: 220, amountPrev: 200 },
  { team:'政府行业组-廖贝贝组', product:'平台软件',  amount: 150, amountPrev: 135 },
  { team:'政府行业组-廖贝贝组', product:'门禁',      amount:  70, amountPrev:  85 },
  { team:'政府行业组-廖贝贝组', product:'智能交通',  amount:  30, amountPrev:  25 },
  { team:'政府行业组-廖贝贝组', product:'存储',      amount: 100, amountPrev:  85 },
  { team:'政府行业组-廖贝贝组', product:'LCD与解码', amount:  60, amountPrev:  55 },
  // 公安交警行业组-张伟组
  { team:'公安交警行业组-张伟组',   product:'NVR',       amount: 380, amountPrev: 340 },
  { team:'公安交警行业组-张伟组',   product:'智能计算',  amount:  60, amountPrev:   0 },
  { team:'公安交警行业组-张伟组',   product:'IPC',       amount: 250, amountPrev: 280 },
  { team:'公安交警行业组-张伟组',   product:'平台软件',  amount: 130, amountPrev: 180 },
  { team:'公安交警行业组-张伟组',   product:'门禁',      amount: 240, amountPrev: 220 },
  { team:'公安交警行业组-张伟组',   product:'智能交通',  amount: 120, amountPrev:  90 },
  { team:'公安交警行业组-张伟组',   product:'存储',      amount:  95, amountPrev:  80 },
  { team:'公安交警行业组-张伟组',   product:'LCD与解码', amount:  60, amountPrev:  55 },
  // 公安交警行业组-张继成组
  { team:'公安交警行业组-张继成组', product:'NVR',       amount: 280, amountPrev: 250 },
  { team:'公安交警行业组-张继成组', product:'智能计算',  amount:  40, amountPrev:   0 },
  { team:'公安交警行业组-张继成组', product:'IPC',       amount: 180, amountPrev: 210 },
  { team:'公安交警行业组-张继成组', product:'平台软件',  amount:  90, amountPrev: 130 },
  { team:'公安交警行业组-张继成组', product:'门禁',      amount: 180, amountPrev: 155 },
  { team:'公安交警行业组-张继成组', product:'智能交通',  amount:  80, amountPrev:  65 },
  { team:'公安交警行业组-张继成组', product:'存储',      amount:  70, amountPrev:  60 },
  { team:'公安交警行业组-张继成组', product:'LCD与解码', amount:  45, amountPrev:  40 },
  // 工业企业一组-罗兴华组
  { team:'工业企业一组-罗兴华组', product:'NVR',       amount: 220, amountPrev: 195 },
  { team:'工业企业一组-罗兴华组', product:'智能计算',  amount:  30, amountPrev:   0 },
  { team:'工业企业一组-罗兴华组', product:'IPC',       amount: 130, amountPrev: 180 },
  { team:'工业企业一组-罗兴华组', product:'平台软件',  amount: 220, amountPrev: 180 },
  { team:'工业企业一组-罗兴华组', product:'门禁',      amount:  50, amountPrev:  70 },
  { team:'工业企业一组-罗兴华组', product:'智能交通',  amount:  25, amountPrev:  20 },
  { team:'工业企业一组-罗兴华组', product:'存储',      amount:  55, amountPrev:  50 },
  { team:'工业企业一组-罗兴华组', product:'LCD与解码', amount:  75, amountPrev:  60 },
  // 工业企业一组-黄燕滨组
  { team:'工业企业一组-黄燕滨组', product:'NVR',       amount: 180, amountPrev: 140 },
  { team:'工业企业一组-黄燕滨组', product:'智能计算',  amount:  25, amountPrev:   0 },
  { team:'工业企业一组-黄燕滨组', product:'IPC',       amount:  95, amountPrev: 120 },
  { team:'工业企业一组-黄燕滨组', product:'平台软件',  amount: 180, amountPrev: 140 },
  { team:'工业企业一组-黄燕滨组', product:'门禁',      amount:  40, amountPrev:  55 },
  { team:'工业企业一组-黄燕滨组', product:'智能交通',  amount:  20, amountPrev:  15 },
  { team:'工业企业一组-黄燕滨组', product:'存储',      amount:  40, amountPrev:  35 },
  { team:'工业企业一组-黄燕滨组', product:'LCD与解码', amount:  50, amountPrev:  42 },
  // 工业企业一组-潘仲楠组
  { team:'工业企业一组-潘仲楠组', product:'NVR',       amount: 150, amountPrev: 125 },
  { team:'工业企业一组-潘仲楠组', product:'智能计算',  amount:  20, amountPrev:   0 },
  { team:'工业企业一组-潘仲楠组', product:'IPC',       amount:  80, amountPrev: 105 },
  { team:'工业企业一组-潘仲楠组', product:'平台软件',  amount: 140, amountPrev: 120 },
  { team:'工业企业一组-潘仲楠组', product:'门禁',      amount:  30, amountPrev:  45 },
  { team:'工业企业一组-潘仲楠组', product:'智能交通',  amount:  15, amountPrev:  12 },
  { team:'工业企业一组-潘仲楠组', product:'存储',      amount:  35, amountPrev:  30 },
  { team:'工业企业一组-潘仲楠组', product:'LCD与解码', amount:  40, amountPrev:  35 },
  // 智慧建筑组-赵启超组
  { team:'智慧建筑组-赵启超组', product:'NVR',       amount: 130, amountPrev: 155 },
  { team:'智慧建筑组-赵启超组', product:'智能计算',  amount:  15, amountPrev:  30 },
  { team:'智慧建筑组-赵启超组', product:'IPC',       amount:  80, amountPrev:  95 },
  { team:'智慧建筑组-赵启超组', product:'平台软件',  amount:  65, amountPrev:  70 },
  { team:'智慧建筑组-赵启超组', product:'门禁',      amount:  35, amountPrev:  50 },
  { team:'智慧建筑组-赵启超组', product:'智能交通',  amount: 380, amountPrev: 420 },
  { team:'智慧建筑组-赵启超组', product:'存储',      amount:  50, amountPrev:  55 },
  { team:'智慧建筑组-赵启超组', product:'LCD与解码', amount:  30, amountPrev:  35 },
  // 智慧建筑组-李金富组
  { team:'智慧建筑组-李金富组', product:'NVR',       amount:  95, amountPrev: 115 },
  { team:'智慧建筑组-李金富组', product:'智能计算',  amount:   8, amountPrev:  15 },
  { team:'智慧建筑组-李金富组', product:'IPC',       amount:  55, amountPrev:  65 },
  { team:'智慧建筑组-李金富组', product:'平台软件',  amount:  45, amountPrev:  50 },
  { team:'智慧建筑组-李金富组', product:'门禁',      amount:  25, amountPrev:  35 },
  { team:'智慧建筑组-李金富组', product:'智能交通',  amount: 250, amountPrev: 280 },
  { team:'智慧建筑组-李金富组', product:'存储',      amount:  30, amountPrev:  35 },
  { team:'智慧建筑组-李金富组', product:'LCD与解码', amount:  20, amountPrev:  25 },
  // 智慧建筑组-朱绪浩组
  { team:'智慧建筑组-朱绪浩组', product:'NVR',       amount:  80, amountPrev:  95 },
  { team:'智慧建筑组-朱绪浩组', product:'智能计算',  amount:   5, amountPrev:  10 },
  { team:'智慧建筑组-朱绪浩组', product:'IPC',       amount:  45, amountPrev:  55 },
  { team:'智慧建筑组-朱绪浩组', product:'平台软件',  amount:  35, amountPrev:  40 },
  { team:'智慧建筑组-朱绪浩组', product:'门禁',      amount:  20, amountPrev:  25 },
  { team:'智慧建筑组-朱绪浩组', product:'智能交通',  amount: 200, amountPrev: 215 },
  { team:'智慧建筑组-朱绪浩组', product:'存储',      amount:  25, amountPrev:  30 },
  { team:'智慧建筑组-朱绪浩组', product:'LCD与解码', amount:  15, amountPrev:  18 },
  // 客户销售一部-张栋柱组
  { team:'客户销售一部-张栋柱组', product:'NVR',     amount: 200, amountPrev: 175 },
  { team:'客户销售一部-张栋柱组', product:'智能计算',amount:  15, amountPrev:   0 },
  { team:'客户销售一部-张栋柱组', product:'IPC',     amount: 120, amountPrev: 130 },
  { team:'客户销售一部-张栋柱组', product:'平台软件',amount:  80, amountPrev:  70 },
  { team:'客户销售一部-张栋柱组', product:'门禁',    amount:  60, amountPrev:  65 },
  { team:'客户销售一部-张栋柱组', product:'智能交通',amount:  25, amountPrev:  20 },
  { team:'客户销售一部-张栋柱组', product:'存储',    amount:  90, amountPrev:  80 },
  { team:'客户销售一部-张栋柱组', product:'LCD与解码',amount: 45, amountPrev:  40 },
  // 客户销售一部-陈刚组
  { team:'客户销售一部-陈刚组',   product:'NVR',     amount: 170, amountPrev: 150 },
  { team:'客户销售一部-陈刚组',   product:'智能计算',amount:  10, amountPrev:   0 },
  { team:'客户销售一部-陈刚组',   product:'IPC',     amount: 100, amountPrev: 115 },
  { team:'客户销售一部-陈刚组',   product:'平台软件',amount:  65, amountPrev:  55 },
  { team:'客户销售一部-陈刚组',   product:'门禁',    amount:  45, amountPrev:  50 },
  { team:'客户销售一部-陈刚组',   product:'智能交通',amount:  20, amountPrev:  18 },
  { team:'客户销售一部-陈刚组',   product:'存储',    amount:  75, amountPrev:  68 },
  { team:'客户销售一部-陈刚组',   product:'LCD与解码',amount: 35, amountPrev:  32 },
  // 客户销售二部-朱迪组
  { team:'客户销售二部-朱迪组',   product:'NVR',     amount: 150, amountPrev: 135 },
  { team:'客户销售二部-朱迪组',   product:'智能计算',amount:   8, amountPrev:   0 },
  { team:'客户销售二部-朱迪组',   product:'IPC',     amount:  90, amountPrev: 100 },
  { team:'客户销售二部-朱迪组',   product:'平台软件',amount:  55, amountPrev:  50 },
  { team:'客户销售二部-朱迪组',   product:'门禁',    amount:  35, amountPrev:  40 },
  { team:'客户销售二部-朱迪组',   product:'智能交通',amount:  15, amountPrev:  12 },
  { team:'客户销售二部-朱迪组',   product:'存储',    amount:  60, amountPrev:  55 },
  { team:'客户销售二部-朱迪组',   product:'LCD与解码',amount: 30, amountPrev:  28 }
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
App.ImportData.UserGS = [
  { industry:'政府',      siebel:'1-1GXJNYG', user:'深圳市政府',    sales:'廖贝贝', dept:'政府行业组', guishang:'是', width:25, prods:{IPC:1,球机:1,专用摄像机:1,服务器:1,网络产品:1,NVR:1,存储:1,'LED与拼控':1,'LCD与解码':1,智能交通:1,门禁:1,对讲:1,人员通道:1,报警:1,音频产品:1,传感产品:1,'智慧屏与视频会议':1,通用软件:1,行业软件:1,基础软件:1,'新业务（热成像/睿影/消防等）':1,网络安全:1,'综合布线与机柜机房':1,智能计算:1,'移动终端产品':1}, contact:'廖贝贝', level:'头部用户' },
  { industry:'政府',      siebel:'1-28SVB2T', user:'宝安区政府',    sales:'廖贝贝', dept:'政府行业组', guishang:'是', width:22, prods:{IPC:1,球机:1,NVR:1,存储:1,'LCD与解码':1,智能交通:1,门禁:1,对讲:1,人员通道:1,报警:1,音频产品:1,通用软件:1,行业软件:1,基础软件:1,'新业务（热成像/睿影/消防等）':1,网络安全:1,智能计算:1,服务器:1,网络产品:1,'移动终端产品':1,'LED与拼控':1,专用摄像机:1}, contact:'廖贝贝', level:'头部用户' },
  { industry:'公安',      siebel:'119807',    user:'深圳市公安局',  sales:'王志强', dept:'政府行业组', guishang:'是', width:20, prods:{IPC:1,球机:1,专用摄像机:1,服务器:1,网络产品:1,NVR:1,存储:1,'LCD与解码':1,智能交通:1,'移动终端产品':1,出入口停车:1,门禁:1,对讲:1,报警:1,音频产品:1,通用软件:1,行业软件:1,智能计算:1,'智慧屏与视频会议':1,网络安全:1}, contact:'王志强', level:'头部用户' },
  { industry:'公安',      siebel:'1-1XPIF9D', user:'龙岗公安分局',  sales:'王志强', dept:'政府行业组', guishang:'是', width:18, prods:{IPC:1,球机:1,NVR:1,存储:1,智能交通:1,门禁:1,报警:1,音频产品:1,通用软件:1,行业软件:1,服务器:1,网络产品:1,'LED与拼控':1,'LCD与解码':1,'移动终端产品':1,出入口停车:1,对讲:1,人员通道:1}, contact:'王志强', level:'头部用户' },
  { industry:'教育',      siebel:'1-5ABCDEF', user:'深圳市教育局',  sales:'陈思源', dept:'政府行业组', guishang:'是', width:16, prods:{IPC:1,NVR:1,'LCD与解码':1,通用软件:1,'智慧屏与视频会议':1,球机:1,存储:1,网络产品:1,门禁:1,行业软件:1,基础软件:1,服务器:1,对讲:1,音频产品:1,人员通道:1,'新业务（热成像/睿影/消防等）':1}, contact:'陈思源', level:'头部用户' },
  { industry:'交通',      siebel:'1-6GHIJKL', user:'广东省交通厅',  sales:'房伟建', dept:'公安交警行业组', guishang:'是', width:15, prods:{智能交通:1,IPC:1,球机:1,'移动终端产品':1,服务器:1,存储:1,NVR:1,门禁:1,出入口停车:1,报警:1,网络产品:1,'LCD与解码':1,通用软件:1,行业软件:1,网络安全:1}, contact:'房伟建', level:'头部用户' },
  { industry:'教育',      siebel:'1-7MNOPQR', user:'深圳大学',      sales:'潘仲楠', dept:'工业企业一组', guishang:'是', width:14, prods:{IPC:1,NVR:1,门禁:1,球机:1,'LCD与解码':1,通用软件:1,网络产品:1,存储:1,'智慧屏与视频会议':1,'新业务（热成像/睿影/消防等）':1,行业软件:1,服务器:1,对讲:1,音频产品:1}, contact:'潘仲楠', level:'头部用户' },
  { industry:'教育',      siebel:'1-8STUVWX', user:'南方科技大学',  sales:'潘仲楠', dept:'工业企业一组', guishang:'是', width:12, prods:{IPC:1,NVR:1,门禁:1,'LCD与解码':1,'智慧屏与视频会议':1,通用软件:1,网络产品:1,存储:1,球机:1,'新业务（热成像/睿影/消防等）':1,基础软件:1,服务器:1}, contact:'潘仲楠', level:'腰部用户' },
  { industry:'交通',      siebel:'1-9YZABCD', user:'深圳地铁集团',  sales:'朱绪浩', dept:'智慧建筑组', guishang:'是', width:12, prods:{IPC:1,智能交通:1,'移动终端产品':1,出入口停车:1,门禁:1,存储:1,NVR:1,球机:1,报警:1,'LCD与解码':1,网络产品:1,通用软件:1}, contact:'朱绪浩', level:'头部用户' },
  { industry:'公安',      siebel:'1-10EFGHI', user:'深圳市交警支队',sales:'房伟建', dept:'公安交警行业组', guishang:'是', width:12, prods:{IPC:1,NVR:1,球机:1,智能交通:1,'移动终端产品':1,出入口停车:1,服务器:1,存储:1,报警:1,门禁:1,网络产品:1,通用软件:1}, contact:'房伟建', level:'头部用户' },
  { industry:'卫健',      siebel:'1-11JKLMN', user:'深圳市卫健委',  sales:'李梦琪', dept:'政府行业组', guishang:'是', width:10, prods:{IPC:1,门禁:1,通用软件:1,对讲:1,NVR:1,球机:1,存储:1,'LCD与解码':1,网络产品:1,行业软件:1}, contact:'李梦琪', level:'腰部用户' },
  { industry:'教育',      siebel:'1-12OPQRS', user:'罗湖教育局',    sales:'黄燕滨', dept:'工业企业一组', guishang:'是', width:10, prods:{IPC:1,NVR:1,'LCD与解码':1,通用软件:1,'智慧屏与视频会议':1,门禁:1,存储:1,球机:1,网络产品:1,行业软件:1}, contact:'黄燕滨', level:'腰部用户' },
  { industry:'公安',      siebel:'1-13TUVWX', user:'深圳市车管所',  sales:'张伟',   dept:'公安交警行业组', guishang:'是', width:9,  prods:{IPC:1,球机:1,智能交通:1,'移动终端产品':1,出入口停车:1,NVR:1,门禁:1,存储:1,报警:1}, contact:'张伟', level:'腰部用户' },
  { industry:'交通',      siebel:'1-14YZABC', user:'深圳机场集团',  sales:'朱绪浩', dept:'智慧建筑组', guishang:'是', width:8,  prods:{IPC:1,门禁:1,智能交通:1,出入口停车:1,报警:1,存储:1,NVR:1,球机:1}, contact:'朱绪浩', level:'腰部用户' },
  { industry:'文体',      siebel:'1-15DEFGH', user:'深圳市文体局',  sales:'李梦琪', dept:'政府行业组', guishang:'是', width:8,  prods:{'LCD与解码':1,'新业务（热成像/睿影/消防等）':1,通用软件:1,IPC:1,NVR:1,门禁:1,'智慧屏与视频会议':1,球机:1}, contact:'李梦琪', level:'腰部用户' },
  { industry:'文体',      siebel:'1-16IJKLM', user:'深圳市图书馆',  sales:'罗兴华', dept:'工业企业一组', guishang:'是', width:7,  prods:{IPC:1,NVR:1,门禁:1,通用软件:1,存储:1,'LCD与解码':1,球机:1}, contact:'罗兴华', level:'长尾用户' },
  { industry:'交通',      siebel:'1-17NOPQR', user:'深圳巴士集团',  sales:'赵启超', dept:'智慧建筑组', guishang:'是', width:7,  prods:{IPC:1,智能交通:1,'移动终端产品':1,出入口停车:1,NVR:1,门禁:1,存储:1}, contact:'赵启超', level:'长尾用户' },
  { industry:'公安',      siebel:'1-18STUVW', user:'宝安交警大队',  sales:'张伟',   dept:'公安交警行业组', guishang:'是', width:7,  prods:{IPC:1,球机:1,智能交通:1,'移动终端产品':1,NVR:1,报警:1,存储:1}, contact:'张伟', level:'长尾用户' },
  { industry:'教育',      siebel:'1-19XYZAB', user:'龙岗区教育局',  sales:'黄燕滨', dept:'工业企业一组', guishang:'是', width:7,  prods:{IPC:1,NVR:1,'LCD与解码':1,通用软件:1,门禁:1,存储:1,球机:1}, contact:'黄燕滨', level:'长尾用户' },
  { industry:'交通',      siebel:'1-20CDEFG', user:'深圳港口集团',  sales:'李金富', dept:'智慧建筑组', guishang:'是', width:6,  prods:{IPC:1,出入口停车:1,门禁:1,存储:1,智能交通:1,NVR:1}, contact:'李金富', level:'长尾用户' }
];

// 数据源2: 客户产品线覆盖
App.ImportData.CustGS = [
  { siebel:'1-1GXJNYG', name:'深圳市政府',      sales:'廖贝贝', dept:'政府行业组', guishang:'是', width:25, prods:{IPC:1,球机:1,专用摄像机:1,服务器:1,网络产品:1,NVR:1,存储:1,'LED与拼控':1,'LCD与解码':1,智能交通:1,门禁:1,对讲:1,人员通道:1,报警:1,音频产品:1,传感产品:1,'智慧屏与视频会议':1,通用软件:1,行业软件:1,基础软件:1,'新业务（热成像/睿影/消防等）':1,网络安全:1,'综合布线与机柜机房':1,智能计算:1}, contact:'廖贝贝', level:'A' },
  { siebel:'1-28SVB2T', name:'宝安区政府',      sales:'廖贝贝', dept:'政府行业组', guishang:'是', width:22, prods:{IPC:1,球机:1,NVR:1,存储:1,'LCD与解码':1,智能交通:1,门禁:1,对讲:1,人员通道:1,报警:1,音频产品:1,通用软件:1,行业软件:1,基础软件:1,'新业务（热成像/睿影/消防等）':1,网络安全:1,智能计算:1,服务器:1,网络产品:1,'移动终端产品':1,'LED与拼控':1}, contact:'廖贝贝', level:'A' },
  { siebel:'119807',    name:'深圳市公安局',    sales:'王志强', dept:'政府行业组', guishang:'是', width:20, prods:{IPC:1,球机:1,专用摄像机:1,服务器:1,网络产品:1,NVR:1,存储:1,'LCD与解码':1,智能交通:1,'移动终端产品':1,出入口停车:1,门禁:1,对讲:1,报警:1,音频产品:1,通用软件:1,行业软件:1,智能计算:1,'智慧屏与视频会议':1}, contact:'王志强', level:'A' },
  { siebel:'1-1XPIF9D', name:'龙岗公安分局',    sales:'王志强', dept:'政府行业组', guishang:'是', width:18, prods:{IPC:1,球机:1,NVR:1,存储:1,智能交通:1,门禁:1,报警:1,音频产品:1,通用软件:1,行业软件:1,服务器:1,网络产品:1,'LED与拼控':1,'LCD与解码':1,'移动终端产品':1,出入口停车:1,对讲:1}, contact:'王志强', level:'A' },
  { siebel:'1-5ABCDEF', name:'深圳市教育局',    sales:'陈思源', dept:'政府行业组', guishang:'是', width:16, prods:{IPC:1,NVR:1,'LCD与解码':1,通用软件:1,'智慧屏与视频会议':1,球机:1,存储:1,网络产品:1,门禁:1,行业软件:1,基础软件:1,服务器:1,对讲:1,音频产品:1,人员通道:1,'新业务（热成像/睿影/消防等）':1}, contact:'陈思源', level:'A' },
  { siebel:'1-6GHIJKL', name:'广东省交通厅',    sales:'房伟建', dept:'公安交警行业组', guishang:'是', width:15, prods:{智能交通:1,IPC:1,球机:1,'移动终端产品':1,服务器:1,存储:1,NVR:1,门禁:1,出入口停车:1,报警:1,网络产品:1,'LCD与解码':1,通用软件:1,行业软件:1}, contact:'房伟建', level:'A' },
  { siebel:'1-7MNOPQR', name:'深圳大学',        sales:'潘仲楠', dept:'工业企业一组', guishang:'是', width:14, prods:{IPC:1,NVR:1,门禁:1,球机:1,'LCD与解码':1,通用软件:1,网络产品:1,存储:1,'智慧屏与视频会议':1,'新业务（热成像/睿影/消防等）':1,行业软件:1,服务器:1,对讲:1}, contact:'潘仲楠', level:'B' },
  { siebel:'1-8STUVWX', name:'南方科技大学',    sales:'潘仲楠', dept:'工业企业一组', guishang:'是', width:12, prods:{IPC:1,NVR:1,门禁:1,'LCD与解码':1,'智慧屏与视频会议':1,通用软件:1,网络产品:1,存储:1,球机:1,'新业务（热成像/睿影/消防等）':1,基础软件:1}, contact:'潘仲楠', level:'B' },
  { siebel:'1-9YZABCD', name:'深圳地铁集团',    sales:'朱绪浩', dept:'智慧建筑组', guishang:'是', width:12, prods:{IPC:1,智能交通:1,'移动终端产品':1,出入口停车:1,门禁:1,存储:1,NVR:1,球机:1,报警:1,'LCD与解码':1,网络产品:1}, contact:'朱绪浩', level:'B' },
  { siebel:'1-10EFGHI', name:'深圳市交警支队',  sales:'房伟建', dept:'公安交警行业组', guishang:'是', width:12, prods:{IPC:1,NVR:1,球机:1,智能交通:1,'移动终端产品':1,出入口停车:1,服务器:1,存储:1,报警:1,门禁:1,网络产品:1}, contact:'房伟建', level:'B' },
  { siebel:'1-11JKLMN', name:'深圳市卫健委',    sales:'李梦琪', dept:'政府行业组', guishang:'是', width:10, prods:{IPC:1,门禁:1,通用软件:1,对讲:1,NVR:1,球机:1,存储:1,'LCD与解码':1,网络产品:1,行业软件:1}, contact:'李梦琪', level:'B' },
  { siebel:'1-12OPQRS', name:'罗湖教育局',      sales:'黄燕滨', dept:'工业企业一组', guishang:'是', width:10, prods:{IPC:1,NVR:1,'LCD与解码':1,通用软件:1,'智慧屏与视频会议':1,门禁:1,存储:1,球机:1,网络产品:1,行业软件:1}, contact:'黄燕滨', level:'B' },
  { siebel:'1-13TUVWX', name:'深圳市车管所',    sales:'张伟',   dept:'公安交警行业组', guishang:'是', width:9,  prods:{IPC:1,球机:1,智能交通:1,'移动终端产品':1,出入口停车:1,NVR:1,门禁:1,存储:1,报警:1}, contact:'张伟', level:'B' },
  { siebel:'1-14YZABC', name:'深圳机场集团',    sales:'朱绪浩', dept:'智慧建筑组', guishang:'是', width:8,  prods:{IPC:1,门禁:1,智能交通:1,出入口停车:1,报警:1,存储:1,NVR:1,球机:1}, contact:'朱绪浩', level:'C' },
  { siebel:'1-15DEFGH', name:'深圳市文体局',    sales:'李梦琪', dept:'政府行业组', guishang:'是', width:8,  prods:{'LCD与解码':1,'新业务（热成像/睿影/消防等）':1,通用软件:1,IPC:1,NVR:1,门禁:1,'智慧屏与视频会议':1,球机:1}, contact:'李梦琪', level:'C' },
  { siebel:'1-16IJKLM', name:'深圳市图书馆',    sales:'罗兴华', dept:'工业企业一组', guishang:'是', width:7,  prods:{IPC:1,NVR:1,门禁:1,通用软件:1,存储:1,'LCD与解码':1,球机:1}, contact:'罗兴华', level:'C' },
  { siebel:'1-17NOPQR', name:'深圳巴士集团',    sales:'赵启超', dept:'智慧建筑组', guishang:'是', width:7,  prods:{IPC:1,智能交通:1,'移动终端产品':1,出入口停车:1,NVR:1,门禁:1,存储:1}, contact:'赵启超', level:'C' },
  { siebel:'1-18STUVW', name:'宝安交警大队',    sales:'张伟',   dept:'公安交警行业组', guishang:'是', width:7,  prods:{IPC:1,球机:1,智能交通:1,'移动终端产品':1,NVR:1,报警:1,存储:1}, contact:'张伟', level:'C' },
  { siebel:'1-19XYZAB', name:'龙岗区教育局',    sales:'黄燕滨', dept:'工业企业一组', guishang:'是', width:7,  prods:{IPC:1,NVR:1,'LCD与解码':1,通用软件:1,门禁:1,存储:1,球机:1}, contact:'黄燕滨', level:'C' },
  { siebel:'1-20CDEFG', name:'深圳港口集团',    sales:'李金富', dept:'智慧建筑组', guishang:'是', width:6,  prods:{IPC:1,出入口停车:1,门禁:1,存储:1,智能交通:1,NVR:1}, contact:'李金富', level:'C' }
];

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
App.ImportPotential.PRODUCTS = ['NVR','智能计算','IPC','平台软件','门禁','智能交通','存储','LCD与解码','出入口停车','音频产品','人员通道','行业软件','通用软件','网络产品','新业务','专网摄像机'];

// 数据源1: 潜力产品-客户 (20条模拟)
App.ImportPotential.CustRAW = [
  { dept2:'场景数字化销售部', dept3:'场景数字化销售部', dept4:'场景数字化销售部', dept5:'场景数字化销售部', sales:'姚华3', product:'出入口停车', custName:'深圳市万佳安防科技有限公司', userName:'姚华3', amount:380, amountPrev:310, yoy:'+22.6%', qty:42, qtyPrev:35, qtyYoy:'+20.0%', opps:12, oppsPrev:10, oppsYoy:'+20.0%', users:8, usersPrev:6, usersYoy:'+33.3%', contact:'姚华3', level:'A/B/C' },
  { dept2:'场景数字化销售部', dept3:'场景数字化销售部', dept4:'场景数字化销售部', dept5:'场景数字化销售部', sales:'姚华3', product:'前端大模型', custName:'深圳市万佳安防科技有限公司', userName:'姚华3', amount:250, amountPrev:0, yoy:'新增', qty:0, qtyPrev:0, qtyYoy:'新增', opps:0, oppsPrev:0, oppsYoy:'新增', users:0, usersPrev:0, usersYoy:'新增', contact:'姚华3', level:'A/B/C' },
  { dept2:'深圳业务中心', dept3:'行业一部', dept4:'工业企业一组', dept5:'工业企业一组', sales:'潘仲楠', product:'NVR', custName:'深圳市政府采购中心', userName:'深圳市政府', amount:850, amountPrev:620, yoy:'+37.1%', qty:120, qtyPrev:95, qtyYoy:'+26.3%', opps:28, oppsPrev:22, oppsYoy:'+27.3%', users:15, usersPrev:12, usersYoy:'+25.0%', contact:'潘仲楠', level:'A' },
  { dept2:'深圳业务中心', dept3:'行业一部', dept4:'工业企业一组', dept5:'工业企业一组', sales:'潘仲楠', product:'智能计算', custName:'深圳市政府采购中心', userName:'深圳市政府', amount:480, amountPrev:0, yoy:'新增', qty:25, qtyPrev:0, qtyYoy:'新增', opps:10, oppsPrev:0, oppsYoy:'新增', users:6, usersPrev:0, usersYoy:'新增', contact:'潘仲楠', level:'A' },
  { dept2:'深圳业务中心', dept3:'行业一部', dept4:'智慧建筑组', dept5:'智慧建筑组', sales:'朱绪浩', product:'智能交通', custName:'深圳地铁集团有限公司', userName:'深圳地铁集团', amount:380, amountPrev:420, yoy:'-9.5%', qty:55, qtyPrev:62, qtyYoy:'-11.3%', opps:15, oppsPrev:18, oppsYoy:'-16.7%', users:8, usersPrev:10, usersYoy:'-20.0%', contact:'朱绪浩', level:'B' },
  { dept2:'深圳业务中心', dept3:'行业一部', dept4:'智慧建筑组', dept5:'智慧建筑组', sales:'朱绪浩', product:'出入口停车', custName:'深圳机场集团有限公司', userName:'深圳机场集团', amount:220, amountPrev:195, yoy:'+12.8%', qty:32, qtyPrev:28, qtyYoy:'+14.3%', opps:9, oppsPrev:7, oppsYoy:'+28.6%', users:5, usersPrev:4, usersYoy:'+25.0%', contact:'朱绪浩', level:'B' },
  { dept2:'深圳业务中心', dept3:'行业二部', dept4:'政府行业组', dept5:'政府行业组', sales:'廖贝贝', product:'IPC', custName:'深圳市宝安区政府', userName:'宝安区政府', amount:580, amountPrev:450, yoy:'+28.9%', qty:85, qtyPrev:70, qtyYoy:'+21.4%', opps:22, oppsPrev:18, oppsYoy:'+22.2%', users:12, usersPrev:10, usersYoy:'+20.0%', contact:'廖贝贝', level:'A' },
  { dept2:'深圳业务中心', dept3:'行业二部', dept4:'政府行业组', dept5:'政府行业组', sales:'廖贝贝', product:'平台软件', custName:'深圳市宝安区政府', userName:'宝安区政府', amount:420, amountPrev:350, yoy:'+20.0%', qty:18, qtyPrev:15, qtyYoy:'+20.0%', opps:8, oppsPrev:6, oppsYoy:'+33.3%', users:5, usersPrev:4, usersYoy:'+25.0%', contact:'廖贝贝', level:'A' },
  { dept2:'深圳业务中心', dept3:'行业二部', dept4:'公安交警行业组', dept5:'公安交警行业组', sales:'张伟', product:'门禁', custName:'深圳市车管所', userName:'深圳市车管所', amount:240, amountPrev:220, yoy:'+9.1%', qty:48, qtyPrev:42, qtyYoy:'+14.3%', opps:14, oppsPrev:12, oppsYoy:'+16.7%', users:7, usersPrev:6, usersYoy:'+16.7%', contact:'张伟', level:'B' },
  { dept2:'深圳业务中心', dept3:'行业二部', dept4:'公安交警行业组', dept5:'公安交警行业组', sales:'张伟', product:'智能交通', custName:'广东省交通厅', userName:'广东省交通厅', amount:120, amountPrev:90, yoy:'+33.3%', qty:15, qtyPrev:12, qtyYoy:'+25.0%', opps:6, oppsPrev:4, oppsYoy:'+50.0%', users:3, usersPrev:2, usersYoy:'+50.0%', contact:'张伟', level:'A' },
  { dept2:'深圳业务中心', dept3:'行业一部', dept4:'工业企业一组', dept5:'工业企业一组', sales:'罗兴华', product:'LCD与解码', custName:'深圳大学信息中心', userName:'深圳大学', amount:220, amountPrev:180, yoy:'+22.2%', qty:35, qtyPrev:30, qtyYoy:'+16.7%', opps:10, oppsPrev:8, oppsYoy:'+25.0%', users:6, usersPrev:5, usersYoy:'+20.0%', contact:'罗兴华', level:'B' },
  { dept2:'深圳业务中心', dept3:'行业一部', dept4:'工业企业一组', dept5:'工业企业一组', sales:'黄燕滨', product:'平台软件', custName:'罗湖区教育局', userName:'罗湖教育局', amount:180, amountPrev:140, yoy:'+28.6%', qty:22, qtyPrev:18, qtyYoy:'+22.2%', opps:8, oppsPrev:6, oppsYoy:'+33.3%', users:4, usersPrev:3, usersYoy:'+33.3%', contact:'黄燕滨', level:'B' },
  { dept2:'深圳业务中心', dept3:'行业一部', dept4:'智慧建筑组', dept5:'智慧建筑组', sales:'赵启超', product:'智能交通', custName:'深圳巴士集团股份有限公司', userName:'深圳巴士集团', amount:380, amountPrev:420, yoy:'-9.5%', qty:58, qtyPrev:65, qtyYoy:'-10.8%', opps:16, oppsPrev:20, oppsYoy:'-20.0%', users:9, usersPrev:11, usersYoy:'-18.2%', contact:'赵启超', level:'C' },
  { dept2:'深圳业务中心', dept3:'行业一部', dept4:'智慧建筑组', dept5:'智慧建筑组', sales:'李金富', product:'智能交通', custName:'深圳港口集团有限公司', userName:'深圳港口集团', amount:250, amountPrev:280, yoy:'-10.7%', qty:40, qtyPrev:45, qtyYoy:'-11.1%', opps:12, oppsPrev:14, oppsYoy:'-14.3%', users:6, usersPrev:7, usersYoy:'-14.3%', contact:'李金富', level:'C' },
  { dept2:'深圳业务中心', dept3:'客户销售一部', dept4:'客户销售一组', dept5:'客户销售一组', sales:'张栋柱', product:'NVR', custName:'天眼监控科技有限公司', userName:'天眼监控', amount:200, amountPrev:175, yoy:'+14.3%', qty:28, qtyPrev:24, qtyYoy:'+16.7%', opps:8, oppsPrev:7, oppsYoy:'+14.3%', users:5, usersPrev:4, usersYoy:'+25.0%', contact:'张栋柱', level:'C' },
  { dept2:'深圳业务中心', dept3:'客户销售一部', dept4:'客户销售二组', dept5:'客户销售二组', sales:'陈刚', product:'存储', custName:'鹏城科技集团有限公司', userName:'鹏城科技', amount:170, amountPrev:150, yoy:'+13.3%', qty:30, qtyPrev:26, qtyYoy:'+15.4%', opps:7, oppsPrev:6, oppsYoy:'+16.7%', users:4, usersPrev:3, usersYoy:'+33.3%', contact:'陈刚', level:'C' },
  { dept2:'深圳业务中心', dept3:'行业二部', dept4:'政府行业组', dept5:'政府行业组', sales:'陈思源', product:'智能计算', custName:'广州市公安局', userName:'广州市公安局', amount:380, amountPrev:0, yoy:'新增', qty:18, qtyPrev:0, qtyYoy:'新增', opps:6, oppsPrev:0, oppsYoy:'新增', users:4, usersPrev:0, usersYoy:'新增', contact:'陈思源', level:'A' },
  { dept2:'深圳业务中心', dept3:'行业二部', dept4:'政府行业组', dept5:'政府行业组', sales:'李梦琪', product:'存储', custName:'深圳市卫健委信息中心', userName:'深圳市卫健委', amount:130, amountPrev:110, yoy:'+18.2%', qty:20, qtyPrev:17, qtyYoy:'+17.6%', opps:5, oppsPrev:4, oppsYoy:'+25.0%', users:3, usersPrev:2, usersYoy:'+50.0%', contact:'李梦琪', level:'B' },
  { dept2:'深圳业务中心', dept3:'行业一部', dept4:'工业企业一组', dept5:'工业企业一组', sales:'罗兴华', product:'行业软件', custName:'南方科技大学', userName:'南方科技大学', amount:150, amountPrev:125, yoy:'+20.0%', qty:8, qtyPrev:7, qtyYoy:'+14.3%', opps:4, oppsPrev:3, oppsYoy:'+33.3%', users:3, usersPrev:2, usersYoy:'+50.0%', contact:'罗兴华', level:'B' },
  { dept2:'深圳业务中心', dept3:'客户销售一部', dept4:'客户销售四组', dept5:'客户销售四组', sales:'朱迪', product:'门禁', custName:'招商局地产控股有限公司', userName:'招商局地产', amount:150, amountPrev:135, yoy:'+11.1%', qty:25, qtyPrev:22, qtyYoy:'+13.6%', opps:6, oppsPrev:5, oppsYoy:'+20.0%', users:3, usersPrev:3, usersYoy:'0.0%', contact:'朱迪', level:'C' }
];

// 数据源2: 潜力产品-用户 (16条模拟)
App.ImportPotential.UserRAW = [
  { center:'深圳业务中心', dept3:'行业一部', dept4:'工业企业一组', sales:'潘仲楠', contact:'潘仲楠', userName:'深圳市政府', industry:'政府', product:'NVR', outAmt:520, outAmtPrev:420, outYoy:'+23.8%', outQty:85, outQtyPrev:70, outQtyYoy:'+21.4%', opps:18, oppsPrev:14, oppsYoy:'+28.6%', users:10, usersPrev:8, usersYoy:'+25.0%', custs:6, custsPrev:5, custsYoy:'+20.0%', level:'头部用户' },
  { center:'深圳业务中心', dept3:'行业一部', dept4:'工业企业一组', sales:'潘仲楠', contact:'潘仲楠', userName:'深圳市政府', industry:'政府', product:'智能计算', outAmt:320, outAmtPrev:0, outYoy:'新增', outQty:18, outQtyPrev:0, outQtyYoy:'新增', opps:6, oppsPrev:0, oppsYoy:'新增', users:4, usersPrev:0, usersYoy:'新增', custs:4, custsPrev:0, custsYoy:'新增', level:'头部用户' },
  { center:'深圳业务中心', dept3:'行业一部', dept4:'工业企业一组', sales:'姚华3', contact:'姚华3', userName:'深圳市万佳安防科技有限公司', industry:'工业制造', product:'出入口停车', outAmt:280, outAmtPrev:220, outYoy:'+27.3%', outQty:35, outQtyPrev:28, outQtyYoy:'+25.0%', opps:10, oppsPrev:8, oppsYoy:'+25.0%', users:6, usersPrev:5, usersYoy:'+20.0%', custs:4, custsPrev:3, custsYoy:'+33.3%', level:'头部用户' },
  { center:'深圳业务中心', dept3:'行业一部', dept4:'工业企业一组', sales:'姚华3', contact:'姚华3', userName:'深圳市万佳安防科技有限公司', industry:'工业制造', product:'前端大模型', outAmt:180, outAmtPrev:0, outYoy:'新增', outQty:12, outQtyPrev:0, outQtyYoy:'新增', opps:5, oppsPrev:0, oppsYoy:'新增', users:3, usersPrev:0, usersYoy:'新增', custs:2, custsPrev:0, custsYoy:'新增', level:'头部用户' },
  { center:'深圳业务中心', dept3:'行业二部', dept4:'政府行业组', sales:'廖贝贝', contact:'廖贝贝', userName:'宝安区政府', industry:'政府', product:'IPC', outAmt:420, outAmtPrev:350, outYoy:'+20.0%', outQty:65, outQtyPrev:55, outQtyYoy:'+18.2%', opps:15, oppsPrev:12, oppsYoy:'+25.0%', users:8, usersPrev:7, usersYoy:'+14.3%', custs:5, custsPrev:4, custsYoy:'+25.0%', level:'头部用户' },
  { center:'深圳业务中心', dept3:'行业二部', dept4:'政府行业组', sales:'廖贝贝', contact:'廖贝贝', userName:'宝安区政府', industry:'政府', product:'平台软件', outAmt:300, outAmtPrev:260, outYoy:'+15.4%', outQty:14, outQtyPrev:12, outQtyYoy:'+16.7%', opps:6, oppsPrev:5, oppsYoy:'+20.0%', users:4, usersPrev:3, usersYoy:'+33.3%', custs:3, custsPrev:2, custsYoy:'+50.0%', level:'头部用户' },
  { center:'深圳业务中心', dept3:'行业一部', dept4:'智慧建筑组', sales:'朱绪浩', contact:'朱绪浩', userName:'深圳地铁集团', industry:'交通', product:'智能交通', outAmt:280, outAmtPrev:320, outYoy:'-12.5%', outQty:42, outQtyPrev:50, outQtyYoy:'-16.0%', opps:12, oppsPrev:15, oppsYoy:'-20.0%', users:6, usersPrev:8, usersYoy:'-25.0%', custs:4, custsPrev:5, custsYoy:'-20.0%', level:'头部用户' },
  { center:'深圳业务中心', dept3:'行业一部', dept4:'智慧建筑组', sales:'朱绪浩', contact:'朱绪浩', userName:'深圳机场集团', industry:'交通', product:'出入口停车', outAmt:180, outAmtPrev:160, outYoy:'+12.5%', outQty:25, outQtyPrev:22, outQtyYoy:'+13.6%', opps:7, oppsPrev:6, oppsYoy:'+16.7%', users:4, usersPrev:3, usersYoy:'+33.3%', custs:3, custsPrev:2, custsYoy:'+50.0%', level:'腰部用户' },
  { center:'深圳业务中心', dept3:'行业二部', dept4:'公安交警行业组', sales:'张伟', contact:'张伟', userName:'广东省交通厅', industry:'交通', product:'智能交通', outAmt:220, outAmtPrev:190, outYoy:'+15.8%', outQty:18, outQtyPrev:15, outQtyYoy:'+20.0%', opps:5, oppsPrev:4, oppsYoy:'+25.0%', users:3, usersPrev:3, usersYoy:'0.0%', custs:2, custsPrev:2, custsYoy:'0.0%', level:'腰部用户' },
  { center:'深圳业务中心', dept3:'行业一部', dept4:'工业企业一组', sales:'罗兴华', contact:'罗兴华', userName:'深圳大学', industry:'教育', product:'LCD与解码', outAmt:180, outAmtPrev:150, outYoy:'+20.0%', outQty:28, outQtyPrev:24, outQtyYoy:'+16.7%', opps:8, oppsPrev:7, oppsYoy:'+14.3%', users:5, usersPrev:4, usersYoy:'+25.0%', custs:3, custsPrev:3, custsYoy:'0.0%', level:'腰部用户' },
  { center:'深圳业务中心', dept3:'行业一部', dept4:'工业企业一组', sales:'黄燕滨', contact:'黄燕滨', userName:'罗湖教育局', industry:'教育', product:'平台软件', outAmt:150, outAmtPrev:120, outYoy:'+25.0%', outQty:18, outQtyPrev:15, outQtyYoy:'+20.0%', opps:6, oppsPrev:5, oppsYoy:'+20.0%', users:3, usersPrev:3, usersYoy:'0.0%', custs:2, custsPrev:2, custsYoy:'0.0%', level:'腰部用户' },
  { center:'深圳业务中心', dept3:'行业一部', dept4:'智慧建筑组', sales:'赵启超', contact:'赵启超', userName:'深圳巴士集团', industry:'交通', product:'智能交通', outAmt:280, outAmtPrev:330, outYoy:'-15.2%', outQty:44, outQtyPrev:52, outQtyYoy:'-15.4%', opps:13, oppsPrev:16, oppsYoy:'-18.8%', users:7, usersPrev:9, usersYoy:'-22.2%', custs:4, custsPrev:5, custsYoy:'-20.0%', level:'腰部用户' },
  { center:'深圳业务中心', dept3:'行业一部', dept4:'智慧建筑组', sales:'李金富', contact:'李金富', userName:'深圳港口集团', industry:'交通', product:'智能交通', outAmt:200, outAmtPrev:230, outYoy:'-13.0%', outQty:32, outQtyPrev:38, outQtyYoy:'-15.8%', opps:9, oppsPrev:11, oppsYoy:'-18.2%', users:5, usersPrev:6, usersYoy:'-16.7%', custs:3, custsPrev:4, custsYoy:'-25.0%', level:'长尾用户' },
  { center:'深圳业务中心', dept3:'行业二部', dept4:'政府行业组', sales:'陈思源', contact:'陈思源', userName:'广州市公安局', industry:'公安', product:'智能计算', outAmt:250, outAmtPrev:0, outYoy:'新增', outQty:14, outQtyPrev:0, outQtyYoy:'新增', opps:5, oppsPrev:0, oppsYoy:'新增', users:3, usersPrev:0, usersYoy:'新增', custs:3, custsPrev:0, custsYoy:'新增', level:'头部用户' },
  { center:'深圳业务中心', dept3:'客户销售一部', dept4:'客户销售一组', sales:'张栋柱', contact:'张栋柱', userName:'天眼监控', industry:'安防', product:'NVR', outAmt:150, outAmtPrev:135, outYoy:'+11.1%', outQty:22, outQtyPrev:20, outQtyYoy:'+10.0%', opps:6, oppsPrev:5, oppsYoy:'+20.0%', users:4, usersPrev:3, usersYoy:'+33.3%', custs:2, custsPrev:2, custsYoy:'0.0%', level:'长尾用户' },
  { center:'深圳业务中心', dept3:'客户销售一部', dept4:'客户销售四组', sales:'朱迪', contact:'朱迪', userName:'招商局地产', industry:'地产', product:'门禁', outAmt:120, outAmtPrev:110, outYoy:'+9.1%', outQty:20, outQtyPrev:18, outQtyYoy:'+11.1%', opps:5, oppsPrev:4, oppsYoy:'+25.0%', users:3, usersPrev:2, usersYoy:'+50.0%', custs:2, custsPrev:2, custsYoy:'0.0%', level:'长尾用户' }
];

// ===== 角色权限数据 =====
App.ROLE_PERMISSIONS = [
  { role: 'admin',     name: '管理员',     modules: { overview:1, width:1, potential:1, admin:1, users:1, roles:1, products:1, params:1, audit:1, tenant:1, backup:1, export:1 }, desc: '全部功能 + 用户管理' },
  { role: 'gm',        name: '总经理',     modules: { overview:1, width:1, potential:1, admin:1, users:1, roles:0, products:0, params:0, audit:1, tenant:0, backup:1, export:1 }, desc: '全局查看 + 导出备份' },
  { role: 'operation', name: '运营',       modules: { overview:1, width:1, potential:1, admin:0, users:0, roles:0, products:0, params:0, audit:1, tenant:0, backup:0, export:1 }, desc: '全局查看 + 导出' },
  { role: 'director',  name: '总监',       modules: { overview:1, width:1, potential:1, admin:0, users:0, roles:0, products:0, params:0, audit:0, tenant:0, backup:0, export:1 }, desc: '本部门数据查看' },
  { role: 'manager',   name: '主管',       modules: { overview:1, width:1, potential:1, admin:0, users:0, roles:0, products:0, params:0, audit:0, tenant:0, backup:0, export:0 }, desc: '本组数据查看' },
  { role: 'sales',     name: '一线销售',   modules: { overview:1, width:1, potential:1, admin:0, users:0, roles:0, products:0, params:0, audit:0, tenant:0, backup:0, export:0 }, desc: '本人数据查看' }
];

// ===== 产品字典数据 =====
App.PRODUCT_DICT = [
  { id:1,  name:'IPC',              alias:'网络摄像机',      category:'前端',  is_potential:1, sort:1  },
  { id:2,  name:'NVR',              alias:'网络录像机',      category:'后端',  is_potential:1, sort:2  },
  { id:3,  name:'门禁',             alias:'门禁系统',        category:'前端',  is_potential:1, sort:3  },
  { id:4,  name:'球机',             alias:'球型摄像机',      category:'前端',  is_potential:0, sort:4  },
  { id:5,  name:'LCD与解码',        alias:'大屏显示',        category:'显示',  is_potential:1, sort:5  },
  { id:6,  name:'新业务',           alias:'热成像/消防等',   category:'创新',  is_potential:0, sort:6  },
  { id:7,  name:'通用软件',         alias:'通用平台软件',    category:'软件',  is_potential:0, sort:7  },
  { id:8,  name:'网络产品',         alias:'交换机/路由器',   category:'网络',  is_potential:0, sort:8  },
  { id:9,  name:'存储',             alias:'存储设备',        category:'后端',  is_potential:1, sort:9  },
  { id:10, name:'专用摄像机',       alias:'专网摄像机',      category:'前端',  is_potential:0, sort:10 },
  { id:11, name:'服务器',           alias:'服务器设备',      category:'后端',  is_potential:0, sort:11 },
  { id:12, name:'行业软件',         alias:'行业应用软件',    category:'软件',  is_potential:1, sort:12 },
  { id:13, name:'智能计算',         alias:'AI计算设备',      category:'后端',  is_potential:1, sort:13 },
  { id:14, name:'对讲',             alias:'对讲设备',        category:'前端',  is_potential:0, sort:14 },
  { id:15, name:'报警',             alias:'报警设备',        category:'前端',  is_potential:0, sort:15 },
  { id:16, name:'出入口停车',       alias:'停车管理',        category:'前端',  is_potential:1, sort:16 },
  { id:17, name:'人员通道',         alias:'通道管理',        category:'前端',  is_potential:0, sort:17 },
  { id:18, name:'音频产品',         alias:'音频设备',        category:'前端',  is_potential:1, sort:18 },
  { id:19, name:'PCP产品',          alias:'PC产品',          category:'后端',  is_potential:0, sort:19 },
  { id:20, name:'LED与拼控',        alias:'LED显示屏',       category:'显示',  is_potential:0, sort:20 },
  { id:21, name:'移动终端产品',     alias:'移动终端',        category:'前端',  is_potential:0, sort:21 },
  { id:22, name:'智慧屏与视频会议', alias:'智慧屏',          category:'显示',  is_potential:0, sort:22 },
  { id:23, name:'综合布线与机柜',   alias:'综合布线',        category:'网络',  is_potential:0, sort:23 },
  { id:24, name:'基础软件',         alias:'基础平台软件',    category:'软件',  is_potential:0, sort:24 },
  { id:25, name:'网络安全',         alias:'安全设备',        category:'网络',  is_potential:0, sort:25 },
  { id:26, name:'传感产品',         alias:'传感器',          category:'前端',  is_potential:0, sort:26 },
  { id:27, name:'智能交通',         alias:'交通管理',        category:'前端',  is_potential:1, sort:27 },
  { id:28, name:'专网摄像机',       alias:'专用网络摄像机',  category:'前端',  is_potential:0, sort:28 },
  { id:29, name:'平台软件',         alias:'平台管理软件',    category:'软件',  is_potential:1, sort:29 }
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
  { time:'2026-07-21 09:15:32', user:'admin',     name:'管理员', action:'用户登录',      target:'系统',           detail:'管理员通过密码登录系统',                                    ip:'192.168.1.100' },
  { time:'2026-07-21 09:22:18', user:'wangzhiqiang',name:'王志强',action:'数据导出',      target:'产品宽度数据',   detail:'导出产品宽度Excel报表（888条规上客户）',                    ip:'192.168.1.105' },
  { time:'2026-07-21 09:30:05', user:'chensiyuan', name:'陈思源', action:'查看页面',      target:'潜力产品分析',   detail:'进入潜力产品-总览分析页面',                                   ip:'192.168.1.108' },
  { time:'2026-07-21 09:35:42', user:'admin',     name:'管理员', action:'创建备份',      target:'全量数据备份',   detail:'手动创建全量数据备份 backup_20260721_093542.json (3.9MB)', ip:'192.168.1.100' },
  { time:'2026-07-21 09:45:11', user:'limengqi',  name:'李梦琪', action:'查看页面',      target:'产品宽度分析',   detail:'进入产品宽度-客户维度页面，查看低宽度客户筛选',           ip:'192.168.1.110' },
  { time:'2026-07-21 10:02:33', user:'zhangwei',  name:'张伟',   action:'数据导入',      target:'产品宽度数据',   detail:'上传文件 规上用户宽度_202607.xlsx (285条)',               ip:'192.168.1.112' },
  { time:'2026-07-21 10:15:08', user:'admin',     name:'管理员', action:'修改用户',      target:'用户-刘洋',      detail:'修改用户角色：一线销售 → 分析师',                          ip:'192.168.1.100' },
  { time:'2026-07-21 10:28:55', user:'huangyanbin',name:'黄燕滨',action:'查看页面',      target:'数据总览',       detail:'进入数据总览页面，查看部门对比',                             ip:'192.168.1.115' },
  { time:'2026-07-21 10:42:17', user:'guchengcheng',name:'顾城成',action:'用户登录',     target:'系统',           detail:'总经理通过密码登录系统',                                     ip:'192.168.1.120' },
  { time:'2026-07-21 11:05:44', user:'zhaoqichao', name:'赵启超',action:'查看页面',      target:'潜力产品分析',   detail:'进入潜力产品-差距分析页面',                                   ip:'192.168.1.118' },
  { time:'2026-07-21 11:18:22', user:'admin',     name:'管理员', action:'删除备份',      target:'备份文件',       detail:'删除过期备份 backup_20260701_000000.json',                ip:'192.168.1.100' },
  { time:'2026-07-21 11:30:09', user:'liaobeibei',name:'廖贝贝', action:'数据导出',      target:'潜力产品数据',   detail:'导出潜力产品Excel报表',                                      ip:'192.168.1.122' },
  { time:'2026-07-20 14:22:35', user:'admin',     name:'管理员', action:'新增用户',      target:'用户-姚华3',    detail:'新增用户：姚华3（一线销售 / 场景数字化销售部）',           ip:'192.168.1.100' },
  { time:'2026-07-20 15:10:48', user:'luoxinghua', name:'罗兴华', action:'查看页面',      target:'产品宽度分析',   detail:'进入产品宽度-用户维度页面',                                   ip:'192.168.1.125' },
  { time:'2026-07-20 16:05:12', user:'panzhongnan',name:'潘仲楠',action:'修改密码',      target:'个人账户',       detail:'修改个人登录密码',                                           ip:'192.168.1.130' },
  { time:'2026-07-20 16:42:33', user:'fangweijian',name:'房伟建',action:'查看页面',      target:'潜力产品分析',   detail:'进入潜力产品-产品维度页面，查看TOP10排名',                 ip:'192.168.1.132' },
  { time:'2026-07-20 17:08:15', user:'admin',     name:'管理员', action:'恢复备份',      target:'数据恢复',       detail:'从备份 backup_20260719_020000.json 恢复数据',             ip:'192.168.1.100' },
  { time:'2026-07-19 09:05:22', user:'zhangdongzhu',name:'张栋柱',action:'用户登录',    target:'系统',           detail:'主管通过密码登录系统',                                       ip:'192.168.1.140' },
  { time:'2026-07-19 10:33:09', user:'zhudi7',    name:'朱迪',   action:'查看页面',      target:'产品宽度分析',   detail:'进入产品宽度-数据导入与管理页面',                           ip:'192.168.1.142' },
  { time:'2026-07-19 14:18:45', user:'admin',     name:'管理员', action:'系统配置',      target:'系统参数',       detail:'修改规上客户标准阈值：2 → 3',                                ip:'192.168.1.100' }
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
