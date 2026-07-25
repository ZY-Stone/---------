"""Migrate old sales data to new tables via ORM"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from database import SessionLocal
from sqlalchemy import text
from models.sales_data import PotentialCust

db = SessionLocal()

print('Migrating sales_potential -> potential_cust...')
rows = db.execute(text("""
  SELECT sp.period, d.name as dept3, g.name as dept4,
         u.name as sales, p.name as product, p.id as product_id,
         sp.customer_name as cust_name, sp.user_name,
         sp.amount, sp.amount_prev,
         CAST(sp.qty AS INTEGER) as qty, CAST(sp.qty_prev AS INTEGER) as qty_prev,
         sp.opps, sp.opps_prev,
         CASE WHEN g.name IS NULL OR g.name = '' THEN d.name ELSE g.name END as group_name,
         d.name as dept_name
  FROM sales_potential sp
  JOIN departments d ON sp.dept_id = d.id
  LEFT JOIN groups g ON sp.group_id = g.id
  LEFT JOIN users u ON sp.owner_id = u.id
  LEFT JOIN products p ON sp.product_id = p.id
  WHERE sp.amount > 0 LIMIT 500
""")).fetchall()

count = 0
for r in rows:
    db.add(PotentialCust(
        tenant_id=1, period=r[0] or '2026-07',
        dept2='', dept3=r[1] or '', dept4=r[2] or '', dept5='',
        group_name=r[14] or '', dept_name=r[15] or '',
        sales=r[3] or '', contact='',
        product=r[4] or '', product_id=r[5],
        cust_name=r[6] or '', user_name=r[7],
        amount=float(r[8] or 0), amount_prev=float(r[9] or 0),
        qty=int(r[10] or 0), qty_prev=int(r[11] or 0),
        opps=int(r[12] or 0), opps_prev=int(r[13] or 0),
    ))
    count += 1

db.commit()
print(f'Migrated {count} rows')

for t in ['potential_cust', 'potential_user', 'width_records', 'sales_width', 'sales_potential', 'periods']:
    rc = db.execute(text(f'SELECT COUNT(*) FROM [{t}]')).scalar()
    print(f'  {t}: {rc} rows')
db.close()
