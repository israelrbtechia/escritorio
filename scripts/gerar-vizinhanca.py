#!/usr/bin/env python3
"""Gera js/vizinhanca-dados.js: o bairro real em volta da loja (casas, ruas, rios, mata e morros), já na posição do prédio 3D.

Fontes (todas abertas):
  - OpenStreetMap (ruas, rios, mata, poucos prédios): api.openstreetmap.org/api/0.6/map?bbox=...  © OpenStreetMap contributors (ODbL)
  - Microsoft Global ML Building Footprints (contorno das casas): minedbuildings.z5.web.core.windows.net (ODbL)
  - Relevo SRTM 30 m: api.opentopodata.org/v1/srtm30m
Uso: baixe os 4 arquivos na pasta indicada (area.osm, casas.json, relevo.json) e rode:
  python3 scripts/gerar-vizinhanca.py <pasta-com-os-dados>

Endereço: Rodovia SC-281 (Rodovia Eugênio Raulino Koerich), 7955, Colônia Santana, São José (SC).
O número 7955 foi estimado pelo traçado: o trecho de Colônia Santana começa no número 6001 (CEP 88123-001),
e a numeração cresce de leste para oeste. Número ímpar fica do lado esquerdo no sentido crescente.
Para ajustar com o ponto exato (Google Maps), troque LOJA abaixo e rode de novo.
"""
import json, math, re, sys, hashlib, random

LOJA = {'lat': -27.585159, 'lon': -48.714624, 'rumo_graus': 127.3, 'lado': 'esquerda'}  # rumo: direção da rodovia no sentido crescente (0 = leste, 90 = norte)
Z_RUA = 16.6        # no 3D, o centro da rodovia passa em z = 16,6 (em frente ao prédio)
CHAO = -0.62        # altura do terreno embaixo do prédio
RAIO_DADOS = 470    # casas e ruas até essa distância (m)

pasta = sys.argv[1] if len(sys.argv) > 1 else '.'
lat0, lon0 = LOJA['lat'], LOJA['lon']
kx = 111320 * math.cos(math.radians(lat0)); ky = 110540
r = math.radians(LOJA['rumo_graus'])
# frente da loja (da loja para a rodovia), no plano da cena (x = leste, z = -norte)
lado = 1 if LOJA['lado'] == 'esquerda' else -1
fx, fz = lado * math.sin(r), lado * math.cos(r)
phi = -math.atan2(fx, fz)  # gira a cena para a frente da loja apontar para +z
cphi, sphi = math.cos(phi), math.sin(phi)

def cena(lon, lat):
    x, z = (lon - lon0) * kx, -(lat - lat0) * ky
    return x * cphi + z * sphi, -x * sphi + z * cphi + Z_RUA

def enu(xs, zs):  # cena -> (leste, norte)
    zs -= Z_RUA
    x = xs * cphi - zs * sphi; z = xs * sphi + zs * cphi
    return x, -z

# ---------- relevo ----------
rel = json.load(open(f'{pasta}/relevo.json'))
N, R, H = rel['N'], rel['R'], rel['alturas']
def altura_enu(e, n):
    gi = (e + R) / (2 * R) * (N - 1); gj = (n + R) / (2 * R) * (N - 1)
    gi = min(max(gi, 0), N - 1.001); gj = min(max(gj, 0), N - 1.001)
    i, j = int(gi), int(gj); a, b = gi - i, gj - j
    h = lambda ii, jj: H[jj * N + ii]
    return (h(i, j) * (1 - a) + h(i + 1, j) * a) * (1 - b) + (h(i, j + 1) * (1 - a) + h(i + 1, j + 1) * a) * b
e0, n0 = enu(0, 0)
H0 = altura_enu(e0, n0)
def y_cena(xs, zs):
    e, n = enu(xs, zs)
    bruto = altura_enu(e, n) - H0
    d = math.hypot(xs, zs - 4)
    t = min(max((d - 45) / 110, 0), 1); t = t * t * (3 - 2 * t)  # plano em volta do prédio, depois o relevo real
    return CHAO + bruto * t

hash01 = lambda s: int(hashlib.md5(s.encode()).hexdigest()[:8], 16) / 0xffffffff
dentro_predio = lambda x, z: abs(x) < 22 and -14 < z < 22.5  # prédio, pátio, calçada e rodovia na frente

# ---------- OpenStreetMap ----------
osm = open(f'{pasta}/area.osm', encoding='utf-8').read()
nos = {m.group(1): (float(m.group(3)), float(m.group(2))) for m in re.finditer(r'<node id="(\d+)"[^>]*lat="([-\d.]+)" lon="([-\d.]+)"', osm)}
ways = []
for m in re.finditer(r'<way id="(\d+)"[^>]*>(.*?)</way>', osm, re.S):
    refs = re.findall(r'<nd ref="(\d+)"', m.group(2))
    tags = dict(re.findall(r'<tag k="([^"]+)" v="([^"]*)"', m.group(2)))
    pts = [nos[i] for i in refs if i in nos]
    if len(pts) >= 2: ways.append((tags, pts))

LARG = {'trunk': 12, 'primary': 11, 'secondary': 9.5, 'tertiary': 7.5, 'unclassified': 6, 'residential': 6, 'living_street': 5, 'service': 3.6, 'track': 3.2}
TERRA = {'unpaved', 'dirt', 'gravel', 'ground', 'earth', 'compacted', 'sand', 'grass', 'fine_gravel'}
def adensar(pts_cena, passo):
    out = [pts_cena[0]]
    for (x1, z1), (x2, z2) in zip(pts_cena, pts_cena[1:]):
        n = max(1, int(math.hypot(x2 - x1, z2 - z1) / passo))
        out += [(x1 + (x2 - x1) * k / n, z1 + (z2 - z1) * k / n) for k in range(1, n + 1)]
    return out

vias, rios, matas, pontos_ocupados = [], [], [], []
for tags, pts in ways:
    pc = [cena(lon, lat) for lon, lat in pts]
    if all(math.hypot(x, z) > RAIO_DADOS for x, z in pc): continue
    hw, ww = tags.get('highway'), tags.get('waterway')
    if hw in LARG:
        terra = tags.get('surface') in TERRA or hw == 'track'
        sobe = 0.07 if hw in ('secondary', 'primary', 'trunk') else 0.05 if hw != 'service' else 0.04
        dens = adensar(pc, 7)
        vias.append({'l': LARG[hw], 't': 1 if terra else 0, 'faixa': 1 if hw in ('secondary', 'primary', 'trunk') else 0,
                     'p': [v for x, z in dens for v in (round(x, 1), round(y_cena(x, z) + sobe, 2), round(z, 1))]})
        pontos_ocupados += dens
    elif ww in ('stream', 'river', 'canal', 'ditch', 'drain'):
        dens = adensar(pc, 8)
        rios.append({'l': 8 if ww == 'river' else 2.6, 'p': [v for x, z in dens for v in (round(x, 1), round(y_cena(x, z) + 0.03, 2), round(z, 1))]})
    elif tags.get('natural') == 'wood' or tags.get('landuse') == 'forest':
        matas.append(pc)

# ---------- casas (Microsoft) + os poucos prédios do OSM ----------
def retangulo(poly):
    """Menor retângulo em volta do contorno: (cx, cz, angulo, largura, profundidade)."""
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
TELHADOS = ['b4532a', 'a8442a', '9b3b26', 'c0643a', '8e8e8a', 'b4532a', 'a8442a']
contornos = [(f['geometry']['coordinates'][0], 'ms') for f in json.load(open(f'{pasta}/casas.json'))]
for tags, pts in ways:
    if 'building' in tags and pts[0] == pts[-1]: contornos.append((pts, tags.get('building')))
casas = []
for coords, fonte in contornos:
    poly = [cena(lon, lat) for lon, lat in coords]
    if poly[0] == poly[-1]: poly = poly[:-1]
    if len(poly) < 3: continue
    cx, cz, ang, w, d = retangulo(poly)
    if math.hypot(cx, cz) > RAIO_DADOS or dentro_predio(cx, cz) or w * d < 14: continue
    k = f'{cx:.1f},{cz:.1f}'
    area = w * d; sorteio = hash01(k)
    if fonte == 'church': tipo, h = 3, 9
    elif area > 260: tipo, h = 2, 5.5          # galpão / comércio grande: telhado de metal, plano
    elif area > 90 and sorteio < 0.3: tipo, h = 1, 6.2   # sobrado
    else: tipo, h = 0, 3.1                      # casa térrea
    parede = PAREDES[int(hash01(k + 'p') * len(PAREDES))]
    telhado = '9a9c9b' if tipo == 2 else TELHADOS[int(hash01(k + 't') * len(TELHADOS))]
    base = min(y_cena(x, z) for x, z in poly)
    casas.append([round(cx, 1), round(cz, 1), round(-ang, 3), round(w, 1), round(d, 1), h, round(base, 2), parede, telhado, tipo])
    pontos_ocupados.append((cx, cz))

# ---------- árvores: mata do OSM + morros (Mata Atlântica) ----------
random.seed(7)
grade = {}
for x, z in pontos_ocupados: grade.setdefault((int(x // 12), int(z // 12)), []).append((x, z))
def livre(x, z, raio=7):
    for i in (-1, 0, 1):
        for j in (-1, 0, 1):
            for px, pz in grade.get((int(x // 12) + i, int(z // 12) + j), []):
                if (px - x) ** 2 + (pz - z) ** 2 < raio * raio: return False
    return True
def dentro(poly, x, z):
    c = False; j = len(poly) - 1
    for i in range(len(poly)):
        xi, zi = poly[i]; xj, zj = poly[j]
        if (zi > z) != (zj > z) and x < (xj - xi) * (z - zi) / (zj - zi + 1e-12) + xi: c = not c
        j = i
    return c
arvores = []
for poly in matas:
    xs, zs = [p[0] for p in poly], [p[1] for p in poly]
    for x in range(int(min(xs)), int(max(xs)), 11):
        for z in range(int(min(zs)), int(max(zs)), 11):
            px, pz = x + random.uniform(-4, 4), z + random.uniform(-4, 4)
            if math.hypot(px, pz) < 1900 and dentro(poly, px, pz) and livre(px, pz) and not dentro_predio(px, pz):
                arvores.append((px, pz))
for x in range(-1950, 1951, 30):
    for z in range(-1950, 1951, 30):
        px, pz = x + random.uniform(-12, 12), z + random.uniform(-12, 12)
        if math.hypot(px, pz) > 1950 or dentro_predio(px, pz): continue
        subida = y_cena(px, pz) - CHAO
        perto = math.hypot(px, pz) < RAIO_DADOS
        chance = 0.85 if subida > 45 else 0.55 if subida > 22 else (0.06 if perto else 0.25)
        if random.random() < chance and livre(px, pz): arvores.append((px, pz))
random.shuffle(arvores)
arvores = arvores[:4500]
lista_arv = [v for x, z in arvores for v in (round(x), round(y_cena(x, z), 1), round(z), random.choice((5, 6, 7, 8, 9)))]

# ---------- terreno (grade 49 x 49 em 4 km, girada para a cena) ----------
M = 49
terreno = []
for j in range(M):
    for i in range(M):
        e = -R + 2 * R * i / (M - 1); n = -R + 2 * R * j / (M - 1)
        lon, lat = lon0 + e / kx, lat0 + n / ky
        x, z = cena(lon, lat)
        terreno += [round(x, 1), round(y_cena(x, z) - 0.05, 2), round(z, 1)]

dados = {
    'fonte': 'Mapa: © OpenStreetMap contributors (ODbL) · casas: Microsoft Global ML Building Footprints (ODbL) · relevo: SRTM',
    'loja': {'lat': lat0, 'lon': lon0, 'endereco': 'Rodovia SC-281, 7955, Colônia Santana, São José (SC)'},
    'terreno': {'n': M, 'p': terreno},
    'casas': casas, 'vias': vias, 'rios': rios, 'arvores': lista_arv,
}
saida = 'js/vizinhanca-dados.js'
with open(saida, 'w', encoding='utf-8') as f:
    f.write('// Gerado por scripts/gerar-vizinhanca.py (não edite à mão). ' + dados['fonte'] + '\n')
    f.write('export const VIZINHANCA = ' + json.dumps(dados, separators=(',', ':'), ensure_ascii=False) + ';\n')
print(f'{saida}: {len(casas)} casas, {len(vias)} vias, {len(rios)} rios, {len(arvores)} árvores; '
      f'giro {math.degrees(phi):.1f}°, altitude da loja {H0:.0f} m')
# conferência: a rodovia perto da loja deve ficar paralela ao eixo x, em z ~ 16,6
for v in vias:
    if v['faixa']:
        p = v['p']; pts = [(p[i], p[i + 1], p[i + 2]) for i in range(0, len(p), 3) if abs(p[i]) < 90]
        if pts: print('SC-281 perto da loja (x, z):', pts[:6])
