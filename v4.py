from datetime import date

def fv(s):  # exactamente fecha + 2 meses calendario
    d=date.fromisoformat(s)
    m=d.month+2; y=d.year+(m-1)//12; m=((m-1)%12)+1
    try: return date(y,m,d.day)
    except: return date(y,m+1,1)

def mes_anterior(d):  # mes previo al vencimiento
    m=d.month-1; y=d.year
    if m==0: m=12; y-=1
    return (y,m)

TASAS={(2025,9):0.2501,(2025,10):0.2436,(2025,11):0.2499,(2025,12):0.2502,
       (2026,1):0.2436,(2026,2):0.2523,(2026,3):0.2552,(2026,4):0.2676,
       (2026,5):0.2817,(2026,6):0.2879}

def mora(b,d,r): return round(b*(r/365)*d/1000)*1000

# 1048: esc 16/09/2025, pago 05/06/2026
v1=fv("2025-09-16"); d1=(date(2026,6,5)-v1).days; t1=TASAS[mes_anterior(v1)]
m1=mora(233500,d1,t1)
print(f"1048: venc={v1}, dias={d1}, tasa={t1*100:.2f}%, mora={m1:,} (doc:31.000) {'OK' if m1==31000 else 'FAIL'}")
print(f"      total={233500+60200+m1:,} (exp:324.700) {'OK' if 233500+60200+m1==324700 else 'FAIL'}")

# 1144: esc 06/10/2025, pago 05/06/2026
v2=fv("2025-10-06"); d2=(date(2026,6,5)-v2).days; t2=TASAS[mes_anterior(v2)]
m2=mora(233500,d2,t2)
print(f"1144: venc={v2}, dias={d2}, tasa={t2*100:.2f}%, mora={m2:,} (doc:28.000) {'OK' if m2==28000 else 'FAIL'}")

# Donacion 231: esc 01/12/2025, trib=31800, pago 05/06/2026
v3=fv("2025-12-01"); d3=(date(2026,6,5)-v3).days; t3=TASAS[mes_anterior(v3)]
m3=mora(31800,d3,t3)
print(f"Don231: venc={v3}, dias={d3}, tasa={t3*100:.2f}%, mora={m3:,} (doc:3.000) {'OK' if m3==3000 else 'FAIL'}")