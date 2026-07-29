"""
backend/seed.py — 完整虚拟数据生成器
覆盖所有角色、部门、团队、产品，确保每个交互场景都有数据支撑
"""
import random
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

from database import SessionLocal, init_db, engine, Base
from models.tenant import Tenant
from models.department import Department
from models.group import Group
from models.user import User
from models.product_dict import ProductDict
from models.sales_data import SalesWidth, SalesPotential
from models.import_record import ImportRecord
from models.audit_log import AuditLog
from models.permission import RolePermission
from utils.security import hash_password

random.seed(42)


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    if db.query(Tenant).count() > 0:
        print("[seed] 数据库已有数据，跳过种子填充")
        db.close()
        return

    print("[seed] 开始生成虚拟数据...")

    # 1. 租户
    t1 = Tenant(name="深圳业务中心", code="shenzhen", status="active")
    db.add(t1)
    db.flush()
    print(f"  ✓ 租户: {t1.name}")

    # 2. 部门
    DEPT_NAMES = [
        ("客户销售一部",     "高巍",   1),
        ("客户销售二部",     "吴正豪", 2),
        ("大客户销售部",     "韩杰",   3),
        ("场景数字化销售部", "明良斌", 4),
        ("行业二部",         "房伟建", 5),
        ("行业一部",         "卫玉昌", 6),
    ]
    dept_map = {}
    for name, leader, order in DEPT_NAMES:
        d = Department(tenant_id=t1.id, name=name, leader=leader, sort_order=order)
        db.add(d)
        db.flush()
        dept_map[name] = d
    print(f"  ✓ 部门: {len(DEPT_NAMES)} 个")

    # 3. 团队小组
    GROUP_DATA = [
        ("交通行业组",     "行业二部",     "王魁"),
        ("公安交警行业组", "行业二部",     "房伟建(兼)"),
        ("司法行业组",     "行业二部",     "刘冬"),
        ("客户销售一组",   "客户销售一部", "张栋柱"),
        ("客户销售七组",   "客户销售二部", "朱迪"),
        ("客户销售三组",   "客户销售一部", "高巍(兼)"),
        ("客户销售九组",   "客户销售二部", "李拥政"),
        ("客户销售二组",   "客户销售一部", "陈刚"),
        ("客户销售五组",   "客户销售一部", "赵志强"),
        ("客户销售八组",   "客户销售二部", "邓畅"),
        ("客户销售六组",   "客户销售二部", "吴正豪(兼)"),
        ("客户销售四组",   "客户销售一部", "刘文宇"),
        ("工业企业一组",   "行业一部",     "潘仲楠"),
        ("工业企业二组",   "行业一部",     "未指定"),
        ("政府行业组",     "行业二部",     "廖北宸"),
        ("文教卫组",       "行业二部",     "王茜"),
        ("智慧商贸组",     "行业一部",     "李耀东"),
        ("智慧建筑组",     "行业一部",     "朱绪浩"),
    ]
    group_map = {}
    for gname, dept_name, leader in GROUP_DATA:
        g = Group(tenant_id=t1.id, name=gname, dept_id=dept_map[dept_name].id, leader=leader)
        db.add(g)
        db.flush()
        group_map[gname] = g
    print(f"  ✓ 团队小组: {len(GROUP_DATA)} 个")

    # 4. 用户
    USER_DATA = [
        (101, "高巍",         "高巍",    "director",  "客户销售一部",     None),
        (102, "翁焕植",       "翁焕植",  "interface", "客户销售一部",     None),
        (103, "简刚平",       "简刚平",  "interface", "客户销售一部",     None),
        (104, "段金君",       "段金君",  "person",    "客户销售一部",     None),
        (105, "张栋柱",       "张栋柱",  "manager",   "客户销售一部",     "客户销售一组"),
        (106, "彭威12",       "彭威12",  "person",    "客户销售一部",     "客户销售一组"),
        (107, "张振德",       "张振德",  "person",    "客户销售一部",     "客户销售一组"),
        (108, "王嘉恺5",      "王嘉恺5", "person",    "客户销售一部",     "客户销售一组"),
        (109, "沙坤",         "沙坤",    "person",    "客户销售一部",     "客户销售一组"),
        (110, "黄燕滨",       "黄燕滨",  "person",    "客户销售一部",     "客户销售一组"),
        (111, "陈刚",         "陈刚",    "manager",   "客户销售一部",     "客户销售二组"),
        (112, "孙天6",        "孙天6",   "person",    "客户销售一部",     "客户销售二组"),
        (113, "罗肖福",       "罗肖福",  "person",    "客户销售一部",     "客户销售二组"),
        (114, "陈伟添",       "陈伟添",  "person",    "客户销售一部",     "客户销售二组"),
        (115, "蔡均鑫",       "蔡均鑫",  "person",    "客户销售一部",     "客户销售二组"),
        (116, "罗兴华",       "罗兴华",  "person",    "客户销售一部",     "客户销售三组"),
        (117, "王鹏旭",       "王鹏旭",  "person",    "客户销售一部",     "客户销售三组"),
        (118, "熊佳豪",       "熊佳豪",  "person",    "客户销售一部",     "客户销售三组"),
        (119, "陈春11",       "陈春11",  "person",    "客户销售一部",     "客户销售三组"),
        (120, "赵鑫阳5",      "赵鑫阳5", "person",    "客户销售一部",     "客户销售三组"),
        (121, "刘文宇",       "刘文宇",  "manager",   "客户销售一部",     "客户销售四组"),
        (122, "徐志伟8",      "徐志伟8", "person",    "客户销售一部",     "客户销售四组"),
        (123, "张宜军8",      "张宜军8", "person",    "客户销售一部",     "客户销售四组"),
        (124, "胡鹏17",       "胡鹏17",  "person",    "客户销售一部",     "客户销售四组"),
        (125, "陈宁8",        "陈宁8",   "person",    "客户销售一部",     "客户销售四组"),
        (126, "范富山",       "范富山",  "person",    "客户销售一部",     "客户销售四组"),
        (127, "梁资航5",      "梁资航5", "person",    "客户销售一部",     "客户销售四组"),
        (128, "雷昊明6",      "雷昊明6", "person",    "客户销售一部",     "客户销售四组"),
        (129, "徐兴强",       "徐兴强",  "person",    "客户销售一部",     "客户销售四组"),
        (130, "赵志强",       "赵志强",  "manager",   "客户销售一部",     "客户销售五组"),
        (131, "吴正豪",       "吴正豪",  "director",  "客户销售二部",     None),
        (132, "刘辉55",       "刘辉55",  "interface", "客户销售二部",     None),
        (133, "龙招军",       "龙招军",  "person",    "客户销售二部",     "客户销售六组"),
        (134, "牛璐",         "牛璐",    "person",    "客户销售二部",     "客户销售六组"),
        (135, "张如玮5",      "张如玮5", "person",    "客户销售二部",     "客户销售六组"),
        (136, "朱迪",         "朱迪",    "manager",   "客户销售二部",     "客户销售七组"),
        (137, "蒋宪正",       "蒋宪正",  "person",    "客户销售二部",     "客户销售七组"),
        (138, "汤瑞生",       "汤瑞生",  "person",    "客户销售二部",     "客户销售七组"),
        (139, "陈博锋",       "陈博锋",  "person",    "客户销售二部",     "客户销售七组"),
        (140, "王海滨8",      "王海滨8", "person",    "客户销售二部",     "客户销售七组"),
        (141, "叶德庆",       "叶德庆",  "person",    "客户销售二部",     "客户销售七组"),
        (142, "邓畅",         "邓畅",    "manager",   "客户销售二部",     "客户销售八组"),
        (143, "张云川",       "张云川",  "person",    "客户销售二部",     "客户销售八组"),
        (144, "徐添寒",       "徐添寒",  "person",    "客户销售二部",     "客户销售八组"),
        (145, "何建新6",      "何建新6", "person",    "客户销售二部",     "客户销售八组"),
        (146, "吴思聪",       "吴思聪",  "person",    "客户销售二部",     "客户销售八组"),
        (147, "王宇龙25",     "王宇龙25","person",    "客户销售二部",     "客户销售八组"),
        (148, "李拥政",       "李拥政",  "manager",   "客户销售二部",     "客户销售九组"),
        (149, "黎毅刚",       "黎毅刚",  "person",    "客户销售二部",     "客户销售九组"),
        (150, "胡程6",        "胡程6",   "person",    "客户销售二部",     "客户销售九组"),
        (151, "贾贺翔",       "贾贺翔",  "person",    "客户销售二部",     "客户销售九组"),
        (152, "许金迪",       "许金迪",  "person",    "客户销售二部",     "客户销售九组"),
        (153, "蒋国江",       "蒋国江",  "person",    "客户销售二部",     "客户销售九组"),
        (154, "曹政11",       "曹政11",  "person",    "客户销售二部",     "客户销售九组"),
        (155, "韩杰",         "韩杰",    "director",  "大客户销售部",     None),
        (156, "刘爱红",       "刘爱红",  "person",    "大客户销售部",     None),
        (157, "李玉",         "李玉",    "person",    "大客户销售部",     None),
        (158, "刘璞",         "刘璞",    "person",    "大客户销售部",     None),
        (159, "马玉薪",       "马玉薪",  "person",    "大客户销售部",     None),
        (160, "邓贝额",       "邓贝额",  "person",    "大客户销售部",     None),
        (161, "张辉99",       "张辉99",  "person",    "大客户销售部",     None),
        (162, "郑飞13",       "郑飞13",  "person",    "大客户销售部",     None),
        (213, "谢彬18",       "谢彬18",  "interface", "大客户销售部",     None),
        (164, "明良斌",       "明良斌",  "director",  "场景数字化销售部", None),
        (165, "王俊杰",       "王俊杰",  "person",    "场景数字化销售部", None),
        (166, "张永仁",       "张永仁",  "person",    "场景数字化销售部", None),
        (167, "房伟建",       "房伟建",  "director",  "行业二部",         None),
        (168, "詹凯玲",       "詹凯玲",  "interface", "行业二部",         None),
        (169, "林若驹",       "林若驹",  "person",    "行业二部",         None),
        (170, "陈志杰8",      "陈志杰8", "person",    "行业二部",         None),
        (171, "王魁",         "王魁",    "manager",   "行业二部",         "交通行业组"),
        (172, "肖力",         "肖力",    "person",    "行业二部",         "交通行业组"),
        (173, "文波5",        "文波5",   "person",    "行业二部",         "交通行业组"),
        (174, "郭庆3",        "郭庆3",   "person",    "行业二部",         "公安交警行业组"),
        (175, "徐云鹏1",      "徐云鹏1", "person",    "行业二部",         "公安交警行业组"),
        (176, "张腾辉6",      "张腾辉6", "person",    "行业二部",         "公安交警行业组"),
        (177, "刘冬",         "刘冬",    "manager",   "行业二部",         "司法行业组"),
        (178, "柯俊鑫",       "柯俊鑫",  "person",    "行业二部",         "司法行业组"),
        (179, "廖北宸",       "廖北宸",  "manager",   "行业二部",         "政府行业组"),
        (180, "陶文杰",       "陶文杰",  "person",    "行业二部",         "政府行业组"),
        (181, "唐勇10",       "唐勇10",  "person",    "行业二部",         "政府行业组"),
        (182, "刘骏86",       "刘骏86",  "person",    "行业二部",         "政府行业组"),
        (183, "王茜",         "王茜",    "manager",   "行业二部",         "文教卫组"),
        (184, "李功",         "李功",    "person",    "行业二部",         "文教卫组"),
        (185, "刘羽欣",       "刘羽欣",  "person",    "行业二部",         "文教卫组"),
        (186, "张岩27",       "张岩27",  "person",    "行业二部",         "文教卫组"),
        (187, "黄子懿",       "黄子懿",  "person",    "行业二部",         "文教卫组"),
        (188, "刘向文5",      "刘向文5", "person",    "行业二部",         "文教卫组"),
        (189, "卫玉昌",       "卫玉昌",  "director",  "行业一部",         None),
        (190, "姚金成",       "姚金成",  "interface", "行业一部",         None),
        (191, "潘仲楠",       "潘仲楠",  "manager",   "行业一部",         "工业企业一组"),
        (192, "杨永光",       "杨永光",  "person",    "行业一部",         "工业企业一组"),
        (193, "周丹3",        "周丹3",   "person",    "行业一部",         "工业企业一组"),
        (194, "刘超27",       "刘超27",  "person",    "行业一部",         "工业企业一组"),
        (195, "张星19",       "张星19",  "person",    "行业一部",         "工业企业一组"),
        (196, "洪峰泉",       "洪峰泉",  "person",    "行业一部",         "工业企业二组"),
        (197, "高扬23",       "高扬23",  "person",    "行业一部",         "工业企业二组"),
        (198, "唐明翔",       "唐明翔",  "person",    "行业一部",         "工业企业二组"),
        (199, "胡鑫11",       "胡鑫11",  "person",    "行业一部",         "工业企业二组"),
        (200, "陈仲都",       "陈仲都",  "person",    "行业一部",         "工业企业二组"),
        (201, "朱绪浩",       "朱绪浩",  "manager",   "行业一部",         "智慧建筑组"),
        (202, "杨秀敏",       "杨秀敏",  "person",    "行业一部",         "智慧建筑组"),
        (203, "吴泽民6",      "吴泽民6", "person",    "行业一部",         "智慧建筑组"),
        (204, "何亮12",       "何亮12",  "person",    "行业一部",         "智慧建筑组"),
        (205, "戴哲5",        "戴哲5",   "person",    "行业一部",         "智慧建筑组"),
        (206, "李耀东",       "李耀东",  "manager",   "行业一部",         "智慧商贸组"),
        (207, "孙德成",       "孙德成",  "person",    "行业一部",         "智慧商贸组"),
        (208, "曾强弘",       "曾强弘",  "person",    "行业一部",         "智慧商贸组"),
        (209, "刘佳豪26",     "刘佳豪26","person",    "行业一部",         "智慧商贸组"),
        (210, "admin",        "管理员",  "admin",     "管理部",           None),
        (211, "jiangying",    "江英",    "operation", "运营部",           None),
        (212, "guchengcheng", "顾城成",  "gm",        "深圳业务中心",     None),
    ]
    user_map = {}
    for uid, uname, name, role, dept_name, group_name in USER_DATA:
        pw = hash_password("123456")
        d_id = dept_map[dept_name].id if dept_name in dept_map else None
        g_id = group_map[group_name].id if group_name and group_name in group_map else None
        u = User(id=uid, tenant_id=t1.id, username=uname, password_hash=pw,
                 name=name, role=role, dept_id=d_id, group_id=g_id, status="active",
                 must_change_pwd=True)
        db.add(u)
        db.flush()
        user_map[uid] = u
    print(f"  ✓ 用户: {len(USER_DATA)} 个")

    # 5. 产品字典
    WIDTH_PRODS = [
        "IPC", "NVR", "门禁", "球机", "LCD与解码", "新业务", "通用软件",
        "网络产品", "存储", "专用摄像机", "服务器", "行业软件", "智能计算",
        "对讲", "报警", "出入口停车", "人员通道", "音频产品", "PCP产品",
        "LED与拼控", "移动终端产品", "智能交通", "智慧屏与视频会议",
        "综合布线与机柜", "基础软件", "网络安全", "传感产品",
        "平台软件", "专网摄像机",
    ]
    POTENTIAL_PRODS = [
        "NVR", "智能计算", "IPC", "平台软件", "门禁", "智能交通",
        "存储", "LCD与解码", "服务器", "行业软件", "网络产品",
        "专网摄像机", "通用软件", "新业务", "出入口停车", "音频产品",
    ]
    potential_set = set(POTENTIAL_PRODS)
    prod_map = {}
    for i, pname in enumerate(WIDTH_PRODS):
        p = ProductDict(tenant_id=t1.id, name=pname, alias="",
                        category="安防" if i < 15 else "IT基础设施",
                        is_potential=(pname in potential_set),
                        sort_order=i)
        db.add(p)
        db.flush()
        prod_map[pname] = p
    print(f"  ✓ 产品: {len(WIDTH_PRODS)} 个 (其中潜力产品 {len(POTENTIAL_PRODS)} 个)")

    # 6. 销售宽度数据
    OWNER_GROUPS = {
        "客户销售一组":     [105, 101],
        "客户销售二组":     [111, 101],
        "客户销售三组":     [116, 101],
        "客户销售四组":     [121, 101],
        "客户销售五组":     [130, 101],
        "客户销售六组":     [133, 131],
        "客户销售七组":     [136, 131],
        "客户销售八组":     [142, 131],
        "客户销售九组":     [148, 131],
        "工业企业一组":     [191, 189],
        "工业企业二组":     [196, 189],
        "智慧商贸组":       [206, 189],
        "智慧建筑组":       [201, 189],
        "交通行业组":       [171, 167],
        "公安交警行业组":   [174, 167],
        "司法行业组":       [177, 167],
        "政府行业组":       [179, 167],
        "文教卫组":         [183, 167],
    }
    CUSTOMERS = [
        ("广东源水智能科技有限公司深圳分公司", "深圳市政府", True),
        ("深圳市苍景科技有限公司", "深圳市公安局", True),
        ("深圳市青葱互联网技术服务有限公司", "宝安教育局", True),
        ("深圳市光敏互联智能有限公司", "罗湖区政府", True),
        ("顺丰科技有限公司", "顺丰集团", True),
        ("深圳市洪创科技有限公司", "龙华区政府", True),
        ("深圳市南粤实业有限公司", "深圳市交通局", True),
        ("深圳市方联仕业科技有限公司", "福田区政府", False),
        ("深圳市鑫天网网络科技有限公司", "南山区政府", False),
        ("维语技术有限公司", "深圳市公安局", True),
        ("深圳市华腾科技发展有限公司", "深圳教育局", True),
        ("东方世纪科技（深圳）有限公司", "光明区政府", False),
        ("广州市政数科技股份有限公司", "广州市政府", True),
        ("深圳市智慧星云科技有限公司", "深圳市卫健委", True),
        ("广州市腾飞安防技术有限公司", "广东省公安厅", True),
        ("深圳市科锐信息技术有限公司", "深圳市城管局", False),
        ("东莞市恒信数码科技有限公司", "东莞市政府", True),
        ("惠州大亚湾智慧城市运营有限公司", "惠州大亚湾管委会", True),
        ("中山市安信通电子科技有限公司", "中山市公安局", False),
        ("珠海横琴粤澳深度合作区科技有限公司", "横琴管委会", True),
        ("深圳云天励飞技术股份有限公司", "深圳市科创委", True),
        ("广东省电信规划设计院有限公司", "广东省通管局", False),
        ("中通服咨询设计研究院有限公司", "深圳市工信局", True),
        ("深圳市广电信义科技有限公司", "深圳广播电视台", False),
        ("广州汇智通信技术有限公司", "广州市工信局", True),
        ("深圳太极云软技术有限公司", "深圳市政务云", True),
        ("深圳市中电数通智慧科技有限公司", "深圳市应急局", True),
        ("深圳市博安达信息技术股份有限公司", "广东省环保厅", False),
        ("广东飞企互联科技股份有限公司", "珠海高新区", False),
        ("深圳市明源云科技有限公司", "深圳市住建局", False),
        ("深圳左邻永佳科技有限公司", "深圳市商务局", True),
        ("深圳市华傲数据技术有限公司", "深圳市数据局", True),
        ("广东中科实数科技有限公司", "中科院深圳", False),
        ("深圳中科金证科技有限公司", "深圳金融局", True),
        ("深圳太极华青信息系统有限公司", "深圳市财政局", True),
    ]
    PERIOD = "2026-07"
    PERIOD_PREV = "2025-07"

    width_records = []
    for group_name, owner_ids in OWNER_GROUPS.items():
        g = group_map[group_name]
        d_id = g.dept_id
        for cust_name, user_name, is_gs in CUSTOMERS:
            owner_id = random.choice(owner_ids)
            covered_count = random.randint(3, min(22, len(WIDTH_PRODS)))
            covered_prods = random.sample(WIDTH_PRODS, covered_count)
            for pname in covered_prods:
                p = prod_map[pname]
                amt = round(random.uniform(5, 280), 1)
                prev_amt = round(amt * random.uniform(0.6, 1.5), 1)
                qty = round(random.uniform(1, 80), 1)
                prev_qty = round(qty * random.uniform(0.5, 1.6), 1)
                width_records.append(SalesWidth(
                    tenant_id=t1.id, period=PERIOD,
                    customer_name=cust_name, user_name=user_name,
                    dept_id=d_id, group_id=g.id, owner_id=owner_id,
                    product_id=p.id, amount=amt, amount_prev=prev_amt,
                    qty=qty, qty_prev=prev_qty, is_regulated=is_gs,
                ))
    db.add_all(width_records)
    db.flush()
    print(f"  ✓ 销售宽度数据: {len(width_records)} 条")

    # 7. 潜力产品销售数据
    potential_records = []
    for group_name, owner_ids in OWNER_GROUPS.items():
        g = group_map[group_name]
        d_id = g.dept_id
        for cust_name, user_name, is_gs in CUSTOMERS:
            owner_id = random.choice(owner_ids)
            covered_count = random.randint(1, min(8, len(POTENTIAL_PRODS)))
            covered_prods = random.sample(POTENTIAL_PRODS, covered_count)
            for pname in covered_prods:
                p = prod_map[pname]
                amt = round(random.uniform(10, 450), 1)
                prev_amt = round(amt * random.uniform(0.5, 1.8), 1)
                qty = round(random.uniform(2, 120), 1)
                prev_qty = round(qty * random.uniform(0.4, 1.7), 1)
                opps = random.randint(0, 15)
                prev_opps = random.randint(0, 12)
                potential_records.append(SalesPotential(
                    tenant_id=t1.id, period=PERIOD,
                    customer_name=cust_name, user_name=user_name,
                    dept_id=d_id, group_id=g.id, owner_id=owner_id,
                    product_id=p.id, amount=amt, amount_prev=prev_amt,
                    qty=qty, qty_prev=prev_qty, opps=opps, opps_prev=prev_opps,
                ))
    db.add_all(potential_records)
    db.flush()
    print(f"  ✓ 潜力产品销售数据: {len(potential_records)} 条")

    # 8. 导入记录
    import_data = [
        ("2026-07-15 09:30", 210, "规上用户产品宽度-202607.xlsx", "width_user",     "规上用户产品宽度", 346, "success"),
        ("2026-07-15 09:32", 210, "客户产品线覆盖-202607.xlsx",   "width_cust",     "客户产品线覆盖",   288, "success"),
        ("2026-07-14 14:20", 211, "潜力产品-客户-0714.xlsx",      "potential_cust", "潜力产品-客户",    215, "success"),
        ("2026-07-14 14:22", 211, "潜力产品-用户-0714.xlsx",      "potential_user", "潜力产品-用户",    196, "success"),
        ("2026-07-13 10:15", 210, "产品宽度基线-0612.xlsx",       "width_user",     "规上用户产品宽度", 320, "success"),
        ("2026-07-12 16:45", 101, "客户销售一部宽度-0712.xlsx",   "width_cust",     "客户产品线覆盖",   95,  "success"),
        ("2026-07-11 08:00", 167, "行业二部潜力产品-0711.xlsx",   "potential_cust", "潜力产品-客户",    78,  "success"),
        ("2026-07-10 11:30", 210, "全量数据导入-0710.xlsx",       "width_user",     "规上用户产品宽度", 412, "failed"),
    ]
    for imp_time, uid, fname, dtype, dsrc, rows, status in import_data:
        db.add(ImportRecord(tenant_id=t1.id, user_id=uid, file_name=fname,
                           data_type=dtype, data_source=dsrc, row_count=rows, status=status))
    print(f"  ✓ 导入记录: {len(import_data)} 条")

    # 9. 审计日志
    audit_data = [
        (210, "用户登录",   "系统",           "管理员登录系统"),
        (211, "数据导入",   "数据管理",       "导入规上用户产品宽度 346条"),
        (210, "用户管理",   "权限设置",       "新增用户: 廖北宸"),
        (101, "数据查看",   "产品宽度-团队维度","查看客户销售一部数据"),
        (167, "切换分析维度","潜力产品-客户维度","当前Tab: p-customer"),
        (210, "修改密码",   "个人中心",       "管理员修改密码"),
        (179, "用户登录",   "系统",           "廖北宸登录系统"),
        (212, "导出报告",   "数据总览",       "导出PDF总览报告"),
        (210, "权限变更",   "用户管理",       "修改吴正豪角色: director"),
        (211, "数据导入",   "数据管理",       "导入潜力产品数据 215条"),
    ]
    for uid, action, target, detail in audit_data:
        db.add(AuditLog(tenant_id=t1.id, user_id=uid, action=action, target=target, detail=detail))
    print(f"  ✓ 审计日志: {len(audit_data)} 条")

    db.commit()
    db.close()

    print("\n[seed] ===== 虚拟数据生成完成 =====")
    print(f"  租户: 1")
    print(f"  部门: {len(DEPT_NAMES)}")
    print(f"  小组: {len(GROUP_DATA)}")
    print(f"  用户: {len(USER_DATA)}")
    print(f"  产品: {len(WIDTH_PRODS)}")
    print(f"  销售宽度记录: {len(width_records)}")
    print(f"  潜力产品记录: {len(potential_records)}")
    print(f"  导入记录: {len(import_data)}")
    print(f"  审计日志: {len(audit_data)}")
    print(f"  API 文档: http://localhost:8800/docs")


def seed_role_permissions():
    """初始化所有角色权限配置 — 每次启动都执行以确保配置是最新的"""
    from models.permission import RolePermission
    from database import SessionLocal
    db = SessionLocal()

    configs = [
        # (role, role_name, overview, width, potential, users_mgmt, roles_mgmt,
        #  products_mgmt, audit_log, backup, import_data, export_data, data_scope)
        ("admin",     "管理员",  True,  True,  True,  True,  True,  True,  True,  True,  True,  True,  "all"),
        ("gm",        "总经理",  True,  True,  True,  False, False, False, True,  False, True,  True,  "all"),
        ("operation", "运营",    True,  True,  True,  False, False, False, True,  True,  True,  True,  "all"),
        ("director",  "总监",    True,  True,  True,  False, False, False, False, False, True,  True,  "dept"),
        ("manager",   "主管",    True,  True,  True,  True,  False, False, False, False, True,  True,  "group"),
        ("interface", "接口人",  True,  True,  True,  True,  False, False, False, False, False, False, "dept"),
        ("sales",     "一线销售",True,  True,  True,  False, False, False, False, False, False, False, "self"),
    ]

    for (role, role_name, overview, width, potential, users_mgmt, roles_mgmt,
         products_mgmt, audit_log, backup, import_data, export_data, data_scope) in configs:

        existing = db.query(RolePermission).filter(RolePermission.role == role).first()
        if existing:
            # 更新已有配置
            existing.role_name = role_name
            existing.overview = overview
            existing.width = width
            existing.potential = potential
            existing.users_mgmt = users_mgmt
            existing.roles_mgmt = roles_mgmt
            existing.products_mgmt = products_mgmt
            existing.audit_log = audit_log
            existing.backup = backup
            existing.import_data = import_data
            existing.export_data = export_data
            existing.data_scope = data_scope
        else:
            db.add(RolePermission(
                tenant_id=1,
                role=role,
                role_name=role_name,
                overview=overview,
                width=width,
                potential=potential,
                users_mgmt=users_mgmt,
                roles_mgmt=roles_mgmt,
                products_mgmt=products_mgmt,
                audit_log=audit_log,
                backup=backup,
                import_data=import_data,
                export_data=export_data,
                data_scope=data_scope,
            ))

    db.commit()
    db.close()
    print("  ✓ 角色权限配置已初始化")


if __name__ == "__main__":
    seed()
