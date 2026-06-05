def r100(x): return round(round(x)/100)*100
RATE = 1.02

h = r100((80000000*0.00911 + 17300) * RATE)
print("Hipoteca 80M ORIP:", h, " doc:761000", "OK" if h==761000 else "FAIL")

d = r100(53100 * RATE)
print("Donacion 6.36M ORIP:", d, " doc:54200", "OK" if d==54200 else "FAIL")

c = r100(29500*2 * RATE)
print("Cancelacion 2 actos ORIP:", c, " doc:60200", "OK" if c==60200 else "FAIL")

def mora(base, dias, tasa): return r100(base*(tasa/365)*dias)
m1 = mora(233500, 201, 0.2436)
print("Mora 1048 (201d,24.36%):", m1, " doc:31000")
m2 = mora(233500, 181, 0.2436)
print("Mora 1144 (181d,24.36%):", m2, " doc:28000")
