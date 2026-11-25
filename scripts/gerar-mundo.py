#!/usr/bin/env python3
"""Gera mundo/: São José (SC) inteira para o mundo aberto do prédio 3D (ruas, casas, prédios, rios, mar e mata).

O mundo é cortado em quadrados de 500 m (mundo/c_<i>_<j>.json); o navegador carrega só os quadrados perto de você.
mundo/indice.json leva o relevo (grade de ~150 m), a conversão de coordenadas, o mar e a SC-281 inteira (trânsito).
A loja fica na origem, com a rodovia SC-281 paralela ao eixo x, em z = 16,6 (igual ao prédio 3D).

Fontes (todas abertas):
  - OpenStreetMap (ruas, rios, água, mata, prédios com andares): api.openstreetmap.org/api/0.6/map  © OpenStreetMap contributors (ODbL)
  - Microsoft Global ML Building Footprints (contorno das casas) (ODbL)
  - Relevo SRTM 30 m: api.opentopodata.org/v1/srtm30m
Uso: python3 scripts/gerar-mundo.py <pasta-com-os-dados> [pasta-de-saida]
  A pasta precisa de: osm_*.json (ladrilhos baixados da API do OSM), ms.csv.gz (Microsoft) e relevo_sj.json.
"""
import json, math, gzip, glob, hashlib, random, sys, os

LOJA = {'lat': -27.585159, 'lon': -48.714624, 'rumo_graus': 127.3, 'lado': 'esquerda'}
Z_RUA, CHAO, CHUNK = 16.6, -0.62, 500
OESTE, LESTE, SUL, NORTE = -48.785, -48.585, -27.665, -27.525

pasta = sys.argv[1] if len(sys.argv) > 1 else '.'
saida = sys.argv[2] if len(sys.argv) > 2 else 'mundo'
os.makedirs(saida, exist_ok=True)
lat0, lon0 = LOJA['lat'], LOJA['lon']
kx = 111320 * math.cos(math.radians(lat0)); ky = 110540
r = math.radians(LOJA['rumo_graus'])
lado = 1 if LOJA['lado'] == 'esquerda' else -1
fx, fz = lado * math.sin(r), lado * math.cos(r)
phi = -math.atan2(fx, fz)
cphi, sphi = math.cos(phi), math.sin(phi)

def cena(lon, lat):
    x, z = (lon - lon0) * kx, -(lat - lat0) * ky
    return x * cphi + z * sphi, -x * sphi + z * cphi + Z_RUA

# ---------- relevo ----------
rel = json.load(open(f'{pasta}/relevo_sj.json'))
NX, NY, DLON, DLAT, R_OESTE, R_SUL, ALT = rel['nx'], rel['ny'], rel['dlon'], rel['dlat'], rel['oeste'], rel['sul'], rel['alturas']
def altura_ll(lon, lat):
    gi = min(max((lon - R_OESTE) / DLON, 0), NX - 1.001); gj = min(max((lat - R_SUL) / DLAT, 0), NY - 1.001)
    i, j = int(gi), int(gj); a, b = gi - i, gj - j
    h = lambda ii, jj: ALT[jj * NX + ii]
    return (h(i, j) * (1 - a) + h(i + 1, j) * a) * (1 - b) + (h(i, j + 1) * (1 - a) + h(i + 1, j + 1) * a) * b
H0 = altura_ll(lon0, lat0)
MAR = CHAO - H0 + 0.3  # nível do mar na cena
def y_grade(lon, lat):
    h = altura_ll(lon, lat)
    if h <= 0.5: return MAR - 3  # mar: o fundo fica embaixo da água
    x, z = cena(lon, lat)
    d = math.hypot(x, z - 4)
    t = min(max((d - 230) / 260, 0), 1); t = t * t * (3 - 2 * t)  # plano em volta da loja, depois o relevo real
    return CHAO + (h - H0) * t
alturas = [round(y_grade(R_OESTE + i * DLON, R_SUL + j * DLAT), 2) for j in range(NY) for i in range(NX)]

hash01 = lambda s: int(hashlib.md5(s.encode()).hexdigest()[:8], 16) / 0xffffffff
dentro_predio = lambda x, z: abs(x) < 22 and -14 < z < 22.5
chave = lambda x, z: f'{int(math.floor(x / CHUNK))}_{int(math.floor(z / CHUNK))}'
chunks = {}
def ch(k): return chunks.setdefault(k, {'vias': [], 'rios': [], 'agua': [], 'casas': [], 'arvores': []})

# ---------- OpenStreetMap ----------
ways, vistos = [], set()
for arq in sorted(glob.glob(f'{pasta}/osm_*.json')):
    for w in json.load(open(arq)):
        if w['id'] in vistos: continue
        vistos.add(w['id']); ways.append(w)
print('ways do OSM:', len(ways))

LARG = {'motorway': 22, 'trunk': 14, 'primary': 11, 'secondary': 9.5, 'tertiary': 7.5, 'unclassified': 6, 'residential': 6,
        'living_street': 5, 'service': 3.6, 'track': 3.2, 'motorway_link': 7, 'trunk_link': 7, 'primary_link': 6.5, 'secondary_link': 6, 'tertiary_link': 6, 'pedestrian': 4}
TERRA = {'unpaved', 'dirt', 'gravel', 'ground', 'earth', 'compacted', 'sand', 'grass', 'fine_gravel'}
def adensar(pts, passo):
    out = [pts[0]]
    for (x1, z1), (x2, z2) in zip(pts, pts[1:]):
        n = max(1, int(math.hypot(x2 - x1, z2 - z1) / passo))
        out += [(x1 + (x2 - x1) * k / n, z1 + (z2 - z1) * k / n) for k in range(1, n + 1)]
    return out
def repartir(pts, cada):
    """Corta uma linha nos quadrados por onde passa (com 1 ponto de sobra para emendar)."""
    atual, run = None, []
    for i, (x, z) in enumerate(pts):
        k = chave(x, z)
        if k != atual:
            if run:
                run.append((x, z)); cada(atual, run)
            atual, run = k, ([pts[i - 1]] if i else []) + [(x, z)]
        else: run.append((x, z))
    if len(run) >= 2: cada(atual, run)
plano = lambda pts: [v for x, z in pts for v in (round(x, 1), round(z, 1))]

ocupado = {}
def ocupar(x, z): ocupado.setdefault((int(x // 12), int(z // 12)), []).append((x, z))
def livre(x, z, raio=7):
    for i in (-1, 0, 1):
        for j in (-1, 0, 1):
            for px, pz in ocupado.get((int(x // 12) + i, int(z // 12) + j), []):
                if (px - x) ** 2 + (pz - z) ** 2 < raio * raio: return False
    return True

rodovia, matas, contornos_osm = [], [], []
for w in ways:
    t, pc = w['t'], [cena(lon, lat) for lon, lat in w['p']]
    hw, ww = t.get('highway'), t.get('waterway')
    if hw in LARG:
        terra = t.get('surface') in TERRA or hw == 'track'
        principal = hw in ('motorway', 'trunk', 'primary', 'secondary') or 'SC' in t.get('ref', '') or 'BR' in t.get('ref', '')
        dens = adensar(pc, 8)
        for x, z in dens[::2]: ocupar(x, z)
        info = {'l': LARG[hw], 't': 1 if terra else 0, 'faixa': 1 if principal else 0}
        if hw.startswith('motorway') or hw.startswith('trunk'): info['pista'] = 1
        repartir(dens, lambda k, run: ch(k)['vias'].append({**info, 'p': plano(run)}))
        if '281' in t.get('ref', '') or 'Koerich' in t.get('name', ''): rodovia.append(dens)
    elif ww in ('stream', 'river', 'canal', 'ditch', 'drain'):
        dens = adensar(pc, 10)
        info = {'l': 10 if ww == 'river' else 3}
        repartir(dens, lambda k, run: ch(k)['rios'].append({**info, 'p': plano(run)}))
    elif t.get('natural') == 'wood' or t.get('landuse') == 'forest':
        matas.append(pc)
    elif t.get('natural') == 'water' and pc[0] == pc[-1] and len(pc) > 3:
        cx = sum(p[0] for p in pc) / len(pc); cz = sum(p[1] for p in pc) / len(pc)
        ch(chave(cx, cz))['agua'].append(plano(pc[:-1][:200]))
    if 'building' in t and len(pc) > 3 and pc[0] == pc[-1]:
        contornos_osm.append((pc[:-1], t))

# ---------- casas e prédios ----------
def retangulo(poly):
    melhor = None
    for (x1, z1), (x2, z2) in zip(poly, poly[1:] + poly[:1]):
        a = math.atan2(z2 - z1, x2 - x1); c, s = math.cos(a), math.sin(a)
        us = [x * c + z * s for x, z in poly]; vs = [-x * s + z * c for x, z in poly]
        area = (max(us) - min(us)) * (max(vs) - min(vs))
        if melhor is None or area < melhor[0]:
            u, v = (max(us) + min(us)) / 2, (max(vs) + min(vs)) / 2
            melhor = (area, u * c - v * s, u * s + v * c, a, max(us) - min(us), max(vs) - min(vs))
    return melhor[1:]
PAREDES = ['f4f1ea', 'efe6d2', 'f2e3b3', 'dfe9ef', 'f1d3c2', 'e3ecd9', 'd9d9d6', 'f6efe2', 'e8d7c0']
PREDIOS = ['e9ecef', 'd8dde3', 'c9d6df', 'f2efe8', 'b8c4cc', 'e4ddd3', 'a9b8c2']
TELHADOS = ['b4532a', 'a8442a', '9b3b26', 'c0643a', '8e8e8a', 'b4532a', 'a8442a']

brutas = []  # (poly, tags ou None)
for poly, t in contornos_osm: brutas.append((poly, t))
centros_osm = {}
for poly, t in contornos_osm:
    cx = sum(p[0] for p in poly) / len(poly); cz = sum(p[1] for p in poly) / len(poly)
    centros_osm.setdefault((int(cx // 6), int(cz // 6)), []).append((cx, cz))
def tem_osm(x, z):
    for i in (-1, 0, 1):
        for j in (-1, 0, 1):
            for px, pz in centros_osm.get((int(x // 6) + i, int(z // 6) + j), []):
                if (px - x) ** 2 + (pz - z) ** 2 < 36: return True
    return False
n_ms = 0
with gzip.open(f'{pasta}/ms.csv.gz', 'rt') as f:
    for linha in f:
        if '"Polygon"' not in linha: continue
        try: geo = json.loads(linha)['geometry']['coordinates'][0]
        except Exception: continue
        lon, lat = geo[0]
        if not (OESTE <= lon <= LESTE and SUL <= lat <= NORTE): continue
        poly = [cena(a, b) for a, b in geo]
        if poly[0] == poly[-1]: poly = poly[:-1]
        cx = sum(p[0] for p in poly) / len(poly); cz = sum(p[1] for p in poly) / len(poly)
        if tem_osm(cx, cz): continue
        brutas.append((poly, None)); n_ms += 1
print('casas: Microsoft', n_ms, '+ OSM', len(contornos_osm))

densidade = {}
for poly, _ in brutas:
    densidade[chave(poly[0][0], poly[0][1])] = densidade.get(chave(poly[0][0], poly[0][1]), 0) + 1
total_casas = 0
for poly, t in brutas:
    if len(poly) < 3: continue
    cx, cz, ang, w, d = retangulo(poly)
    if dentro_predio(cx, cz) or w * d < 14 or w > 300 or d > 300: continue
    k = f'{cx:.1f},{cz:.1f}'; area = w * d; sorteio = hash01(k)
    denso = densidade.get(chave(cx, cz), 0) > 450
    andares = None
    try: andares = int(float((t or {}).get('building:levels', '')))
    except ValueError: pass
    if andares: tipo, h = (2 if andares >= 3 else 1 if andares == 2 else 0), max(3.1, andares * 3.0)
    elif area > 1500: tipo, h = 2, 7.5                              # galpão, mercado, indústria
    elif denso and area > 180 and sorteio < 0.4: tipo, h = 2, 3.0 * (3 + int(hash01(k + 'a') * 10))  # prédio de apartamentos
    elif area > 260: tipo, h = 2, 5.5                               # comércio
    elif area > 90 and sorteio < 0.3: tipo, h = 1, 6.2              # sobrado
    else: tipo, h = 0, 3.1                                          # casa térrea
    if (t or {}).get('building') == 'church': tipo, h = 3, 9
    alto = h >= 9 and tipo == 2
    parede = (PREDIOS if alto else PAREDES)[int(hash01(k + 'p') * (len(PREDIOS) if alto else len(PAREDES)))]
    telhado = ('9a9c9b' if not alto else '6f7378') if tipo == 2 else TELHADOS[int(hash01(k + 't') * len(TELHADOS))]
    ch(chave(cx, cz))['casas'].append([round(cx, 1), round(cz, 1), round(-ang, 3), round(w, 1), round(d, 1), round(h, 1), parede, telhado, tipo])
    ocupar(cx, cz); total_casas += 1

# ---------- árvores ----------
random.seed(7)
def dentro(poly, x, z):
    c = False; j = len(poly) - 1
    for i in range(len(poly)):
        xi, zi = poly[i]; xj, zj = poly[j]
        if (zi > z) != (zj > z) and x < (xj - xi) * (z - zi) / (zj - zi + 1e-12) + xi: c = not c
        j = i
    return c
arv_por_chunk = {}
def plantar(x, z):
    k = chave(x, z)
    if arv_por_chunk.get(k, 0) >= 500 or dentro_predio(x, z) or not livre(x, z): return
    arv_por_chunk[k] = arv_por_chunk.get(k, 0) + 1
    ch(k)['arvores'] += [round(x), round(z), random.choice((5, 6, 7, 8, 9))]
for poly in matas:
    xs, zs = [p[0] for p in poly], [p[1] for p in poly]
    passo = 14 if (max(xs) - min(xs)) * (max(zs) - min(zs)) < 4e6 else 22
    for x in range(int(min(xs)), int(max(xs)), passo):
        for z in range(int(min(zs)), int(max(zs)), passo):
            px, pz = x + random.uniform(-5, 5), z + random.uniform(-5, 5)
            if dentro(poly, px, pz): plantar(px, pz)
# morros: mata atlântica onde o terreno sobe
for j in range(NY):
    for i in range(NX):
        h = ALT[j * NX + i] - H0
        if h < 25 or ALT[j * NX + i] <= 0.5: continue
        lon, lat = R_OESTE + i * DLON, R_SUL + j * DLAT
        x0, z0 = cena(lon, lat)
        for _ in range(int(min(18, h / 4))):
            plantar(x0 + random.uniform(-75, 75), z0 + random.uniform(-75, 75))

# ---------- SC-281 inteira (para o trânsito): emenda os pedaços pela ordem ----------
linha = []
if rodovia:
    pedacos = sorted(rodovia, key=len, reverse=True)
    linha = pedacos.pop(0)
    perto = lambda a, b: math.hypot(a[0] - b[0], a[1] - b[1]) < 15
    mudou = True
    while mudou and pedacos:
        mudou = False
        for p in list(pedacos):
            if perto(linha[-1], p[0]): linha += p[1:]
            elif perto(linha[-1], p[-1]): linha += p[-2::-1]
            elif perto(linha[0], p[-1]): linha = p[:-1] + linha
            elif perto(linha[0], p[0]): linha = p[:0:-1] + linha
            else: continue
            pedacos.remove(p); mudou = True
    linha = linha[::2]

# ---------- grava ----------
for k, c in chunks.items():
    with open(f'{saida}/c_{k}.json', 'w') as f: json.dump(c, f, separators=(',', ':'))
indice = {
    'versao': 1,
    'fonte': 'Mapa: © OpenStreetMap contributors (ODbL) · casas: Microsoft Global ML Building Footprints (ODbL) · relevo: SRTM',
    'loja': {'lat': lat0, 'lon': lon0, 'endereco': 'Rodovia SC-281, 7955, Colônia Santana, São José (SC)'},
    'chunk': CHUNK, 'chunks': sorted(chunks.keys()), 'mar': round(MAR, 2), 'chao': CHAO,
    'conversao': {'lat0': lat0, 'lon0': lon0, 'kx': kx, 'ky': ky, 'cphi': cphi, 'sphi': sphi, 'zRua': Z_RUA},
    'relevo': {'oeste': R_OESTE, 'sul': R_SUL, 'dlon': DLON, 'dlat': DLAT, 'nx': NX, 'ny': NY, 'y': alturas},
    'sc281': plano(linha),
}
with open(f'{saida}/indice.json', 'w') as f: json.dump(indice, f, separators=(',', ':'))
tam = sum(os.path.getsize(f'{saida}/{a}') for a in os.listdir(saida))
print(f'{saida}: {len(chunks)} quadrados, {total_casas} casas, {sum(len(c["vias"]) for c in chunks.values())} trechos de rua, '
      f'{sum(len(c["arvores"]) // 3 for c in chunks.values())} árvores, SC-281 com {len(linha)} pontos, {tam / 1e6:.1f} MB; altitude da loja {H0:.0f} m')
x, z = cena(-48.62, -27.597)
print('Kobrasol fica em (x, z) =', round(x), round(z))
