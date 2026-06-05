from datetime import date

def fv(s):
    d=date.fromisoformat(s); m=d.month+2; y=d.year+(m-1)//12; m=((m-1)%12)+1
    try: return date(y,m,d.day)
    except: return date(y,m+1,1)

TASAS={(2025,11):0.2499,(2025,12):0.2502,(2026,1):0.2436,(2026,2):0.2523,
       (2026,3):0.2552,(2026,4):0.2676,(2026,5):0.2817,(2026,6):0.2879}

def tasa(venc, pago):
    vy=venc.year; py=date.fromisoformat(pago).year
    if py > vy:
        e=TASAS.get((py,1)); return e if e else None
    return TASAS.get((venc.year, venc.month))

def mora(b,d,r): return round(b*(r/365)*d/1000)*1000

casos = [
    ("Res.1048", "2025-09-16", "2026-06-05", 233500, 60200, 324700),
    ("Res.1144", "2025-10-06", "2026-06-05", 233500, 60200, 321700),
    ("Don.231",  "2025-12-01", "2026-06-05", 31800,  54200, None),
]
for name, esc, pago, trib, orip, exp in casos:
    v=fv(esc); d=(date.fromisoformat(pago)-v).days; t=tasa(v,pago)
    m=mora(trib,d,t)
    total=trib+orip+m
    print(f"{name}: dias={d}, tasa={t*100:.2f}%, mora={m:,}, total={total:,}", f"(exp:{exp:,})" if exp else "")