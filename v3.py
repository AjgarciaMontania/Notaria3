from datetime import date

def fv(s):
    d=date.fromisoformat(s); m=d.month+2; y=d.year+(m-1)//12; m=((m-1)%12)+1
    return date(y,m,1)

TASAS={(2025,11):0.2499,(2025,12):0.2502,(2026,1):0.2436,(2026,2):0.2523,(2026,6):0.2879}

def t(v): return TASAS.get((v.year,v.month),0.2879)
def mora(b,d,r): return round(b*(r/365)*d/1000)*1000

v1=fv("2025-09-16"); d1=(date(2026,6,5)-v1).days; m1=mora(233500,d1,t(v1))
print("1048: venc",v1,"dias",d1,"tasa",round(t(v1)*100,2),"mora",m1,"total",233500+60200+m1,"(exp 324700)")

v2=fv("2025-10-06"); d2=(date(2026,6,5)-v2).days; m2=mora(233500,d2,t(v2))
print("1144: venc",v2,"dias",d2,"tasa",round(t(v2)*100,2),"mora",m2,"total",233500+60200+m2)

v3=fv("2025-12-01"); d3=(date(2026,6,5)-v3).days; m3=mora(31800,d3,t(v3))
print("Don231: venc",v3,"dias",d3,"tasa",round(t(v3)*100,2),"mora",m3,"(doc 3000)")