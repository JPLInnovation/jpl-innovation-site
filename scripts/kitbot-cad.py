"""
Reduce the KitBot Onshape export (.glb) to the light shape list behind the FRC page's 3D robot.

    python scripts/kitbot-cad.py ["CAD/Kitbot 2026 (1).glb"] [src/lib/three/models/frc-robot-cad.json]

Python 3, no packages. Run it after replacing the CAD in CAD/ (that folder stays out of git: the export is
~140 MB, over GitHub's 100 MB file limit). Takes about 30 seconds.

Every part except fasteners and bearings becomes one simple shape, built once per unique part, placed per instance:
  - round parts (wheels, rollers, motors, pulleys, gears, spacers): their real side profile, revolved
    (three.js LatheGeometry), coloured section by section by the CAD material on their outside
  - everything else (plates, panels, bumpers, belts, frame rails, hood): their real outline seen along the
    direction that encloses the least volume, extruded to their real depth (three.js ExtrudeGeometry)
Holes under 200 mm^2 are dropped; outlines are within about 1 mm of the CAD.

Output (read by src/lib/three/models/frc-robot.ts), site coordinates: metres, y up, the intake end towards +z,
centred on the frame, wheels on y = 0.
"""
import collections, json, math, re, struct, sys, time
from array import array

GLB = sys.argv[1] if len(sys.argv) > 1 else "CAD/Kitbot 2026 (1).glb"
OUT = sys.argv[2] if len(sys.argv) > 2 else "src/lib/three/models/frc-robot-cad.json"

HARDWARE = re.compile(
    r"screw|\bnut\b|lock ?nut|nylock|bolt|washer|rivet|insert|shcs|fhts|hhcs|bhcs|\bclip\b|91290A|94459A|93075A|"
    r"bearing|klipring|snap ?ring|dowel|91831A|90631A|97431A|retaining", re.I)
# Names that promise a round part even when teeth, flanges or a clamp slit make the outline less than circular
ROUNDISH = re.compile(r"gear|pulley|wheel|sprocket|hub|collar|spacer|motor|roller|flywheel|tread|signal light|\d+T\b", re.I)
SKIP = {"Robot Battery"}  # a second, identical battery box in the export: drawing both would flicker
ROUNDED = re.compile(r"^(Left|Right) Bumper$")  # pool-noodle bumpers: round the top and bottom edges
# The hopper (side, back and floor panels; polycarbonate on the real robot): drawn see-through so the FUEL shows
CLEAR = re.compile(r"^KB-260(04|05|06|14)\b")
CENTRE_Y = -0.299  # CAD y of the frame centre (the CAD's intake end is towards -y, z is up)
E3 = [(1.0, 0.0, 0.0), (0.0, 1.0, 0.0), (0.0, 0.0, 1.0)]
t_start = time.time()

# ------------------------------------------------------------------ read the .glb
with open(GLB, "rb") as f:
    f.read(12)
    jlen, _ = struct.unpack("<I4s", f.read(8))
    G = json.loads(f.read(jlen))
    blen, _ = struct.unpack("<I4s", f.read(8))
    BIN = memoryview(f.read(blen))


def accessor(index):
    acc = G["accessors"][index]
    view = G["bufferViews"][acc["bufferView"]]
    start = view.get("byteOffset", 0) + acc.get("byteOffset", 0)
    code, size = {5126: ("f", 4), 5125: ("I", 4), 5123: ("H", 2), 5121: ("B", 1)}[acc["componentType"]]
    n = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}[acc["type"]]
    out = array(code)
    stride = view.get("byteStride", 0)
    if stride and stride != size * n:
        for i in range(acc["count"]):
            out.frombytes(BIN[start + i * stride: start + i * stride + size * n])
    else:
        out.frombytes(BIN[start: start + acc["count"] * size * n])
    return out


def rgb_of(mi):
    c = G["materials"][mi].get("pbrMetallicRoughness", {}).get("baseColorFactor") if mi is not None and mi >= 0 else None
    return tuple(c[:3]) if c else (1.0, 1.0, 1.0)  # glTF default: white


def mat_mul(a, b):  # 4x4, column-major
    return [sum(a[r + 4 * k] * b[k + 4 * c] for k in range(4)) for c in range(4) for r in range(4)]


def trs(node):
    if "matrix" in node:
        return node["matrix"]
    tx, ty, tz = node.get("translation", [0, 0, 0])
    x, y, z, w = node.get("rotation", [0, 0, 0, 1])
    sx, sy, sz = node.get("scale", [1, 1, 1])
    r = [1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0,
         2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0,
         2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0, 0, 0, 0, 1]
    return mat_mul([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, tx, ty, tz, 1], mat_mul(r, [sx, 0, 0, 0, 0, sy, 0, 0, 0, 0, sz, 0, 0, 0, 0, 1]))


def part_name(path):
    for n in reversed(path):
        n = re.sub(r"^occurrence of ", "", n).strip()
        if n and not re.fullmatch(r"node\d+", n):
            return n
    return path[-1]


instances = []


def walk(ni, parent, path):
    node = G["nodes"][ni]
    m = mat_mul(parent, trs(node))
    path = path + [node.get("name", f"node{ni}")]
    if "mesh" in node:
        name = part_name(path)
        prims = G["meshes"][node["mesh"]]["primitives"]
        lo = [min(G["accessors"][p["attributes"]["POSITION"]]["min"][i] for p in prims) for i in range(3)]
        hi = [max(G["accessors"][p["attributes"]["POSITION"]]["max"][i] for p in prims) for i in range(3)]
        if not HARDWARE.search(name) and name not in SKIP and max(h - l for l, h in zip(lo, hi)) >= 0.012:
            instances.append({"name": name, "mesh": node["mesh"], "m": m})
    for c in node.get("children", []):
        walk(c, m, path)


for ni in G["scenes"][G.get("scene", 0)]["nodes"]:
    walk(ni, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], [])
NAMES = {i["mesh"]: i["name"] for i in instances}
print(f"{len(instances)} parts, {len(NAMES)} unique shapes")


# ------------------------------------------------------------------ 2D helpers
def fill_tri(grid, W, H, x0, y0, x1, y1, x2, y2):
    """Rasterise a triangle (cell-centre rule); its vertices always mark their own cell."""
    for j in range(max(0, math.ceil(min(y0, y1, y2) - 0.5)), min(H - 1, math.floor(max(y0, y1, y2) - 0.5)) + 1):
        yc = j + 0.5
        xs = [ax + (yc - ay) * (bx - ax) / (by - ay) for ax, ay, bx, by in ((x0, y0, x1, y1), (x1, y1, x2, y2), (x2, y2, x0, y0))
              if (ay <= yc < by) or (by <= yc < ay)]
        if len(xs) >= 2:
            i0, i1 = max(0, math.ceil(min(xs) - 0.5)), min(W - 1, math.floor(max(xs) - 0.5))
            if i1 >= i0:
                grid[j * W + i0: j * W + i1 + 1] = b"\x01" * (i1 - i0 + 1)
    for x, y in ((x0, y0), (x1, y1), (x2, y2)):
        if 0 <= int(x) < W and 0 <= int(y) < H:
            grid[int(y) * W + int(x)] = 1


def trace(grid, W, H):
    """Boundary loops of the filled cells, filled on the left: outlines anticlockwise, holes clockwise."""
    out = collections.defaultdict(list)
    for j in range(H):
        row = j * W
        for i in range(W):
            if grid[row + i]:
                if j == 0 or not grid[row - W + i]:
                    out[(i, j)].append((i + 1, j))
                if i == W - 1 or not grid[row + i + 1]:
                    out[(i + 1, j)].append((i + 1, j + 1))
                if j == H - 1 or not grid[row + W + i]:
                    out[(i + 1, j + 1)].append((i, j + 1))
                if i == 0 or not grid[row + i - 1]:
                    out[(i, j + 1)].append((i, j))
    loops = []
    while out:
        start = cur = next(iter(out))
        loop, prev = [start], None
        while True:
            cands = out[cur]
            if len(cands) > 1 and prev:  # where two regions touch diagonally, turn left: keeps them as one
                cands.sort(key=lambda e: {(-prev[1], prev[0]): 0, prev: 1}.get((e[0] - cur[0], e[1] - cur[1]), 2))
            nxt = cands.pop(0)
            if not cands:
                del out[cur]
            prev, cur = (nxt[0] - cur[0], nxt[1] - cur[1]), nxt
            if cur == start:
                break
            loop.append(cur)
        loops.append(loop)
    return loops


def area(loop):
    return sum(loop[k][0] * loop[(k + 1) % len(loop)][1] - loop[(k + 1) % len(loop)][0] * loop[k][1] for k in range(len(loop))) / 2


def dp(points, tol):
    """Douglas-Peucker on an open polyline."""
    if len(points) < 3:
        return points[:]
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        a, b = stack.pop()
        (ax, ay), (bx, by) = points[a], points[b]
        L = math.hypot(bx - ax, by - ay)
        best, bi = -1.0, -1
        for k in range(a + 1, b):
            px, py = points[k]
            d = abs((by - ay) * (px - ax) - (bx - ax) * (py - ay)) / L if L > 1e-12 else math.hypot(px - ax, py - ay)
            if d > best:
                best, bi = d, k
        if best > tol:
            keep[bi] = True
            stack += [(a, bi), (bi, b)]
    return [p for p, k in zip(points, keep) if k]


def simplify_closed(loop, tol):
    if len(loop) < 6:
        return loop
    far = max(range(len(loop)), key=lambda k: (loop[k][0] - loop[0][0]) ** 2 + (loop[k][1] - loop[0][1]) ** 2)
    return dp(loop[: far + 1], tol)[:-1] + dp(loop[far:] + [loop[0]], tol)[:-1]


# ------------------------------------------------------------------ one unique part -> one shape
def analyse(mi):
    X, Y, Z, M = [], [], [], []  # triangle corners (3 per triangle) and per-triangle material
    for prim in G["meshes"][mi]["primitives"]:
        pos = accessor(prim["attributes"]["POSITION"])
        idx = accessor(prim["indices"]) if "indices" in prim else range(len(pos) // 3)
        for k in range(0, len(idx) - 2, 3):
            for v in idx[k: k + 3]:
                X.append(pos[3 * v]); Y.append(pos[3 * v + 1]); Z.append(pos[3 * v + 2])
            M.append(prim.get("material", -1))
    P, ntri = (X, Y, Z), len(M)
    lo, hi = [min(c) for c in P], [max(c) for c in P]
    ext = [h - l for l, h in zip(lo, hi)]
    crosses, mat_area = [], collections.Counter()
    for t in range(ntri):
        k = 3 * t
        ux, uy, uz = X[k + 1] - X[k], Y[k + 1] - Y[k], Z[k + 1] - Z[k]
        vx, vy, vz = X[k + 2] - X[k], Y[k + 2] - Y[k], Z[k + 2] - Z[k]
        cr = (uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx)
        crosses.append(cr)
        mat_area[M[t]] += math.sqrt(cr[0] ** 2 + cr[1] ** 2 + cr[2] ** 2)

    def silhouette(a, basis=None):
        """The part's outline seen along local axis a, or along basis[2] (a tilted plate)."""
        if basis is None:
            b, c = (a + 1) % 3, (a + 2) % 3
            basis, PB, PC, PN = (E3[b], E3[c], E3[a]), P[b], P[c], P[a]
        else:
            PB, PC, PN = ([X[i] * e[0] + Y[i] * e[1] + Z[i] * e[2] for i in range(len(X))] for e in basis)
        n = basis[2]
        blo, clo = min(PB), min(PC)
        span = max(max(PB) - blo, max(PC) - clo)
        cs = min(0.002, max(0.0003, span / 300))  # raster cell: 0.3-2 mm
        W, H = int((max(PB) - blo) / cs) + 3, int((max(PC) - clo) / cs) + 3
        b0, c0 = blo - cs, clo - cs
        grid = bytearray(W * H)
        for t in range(ntri):
            cr = crosses[t]
            if abs(cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2]) < 1e-9 * (abs(cr[0]) + abs(cr[1]) + abs(cr[2]) + 1e-30):
                continue  # seen edge-on
            k = 3 * t
            fill_tri(grid, W, H, *((PB[k + i] - b0) / cs if j == 0 else (PC[k + i] - c0) / cs for i in range(3) for j in range(2)))
        loops = []
        for lp in trace(grid, W, H):
            A = area(lp) * cs * cs
            s = simplify_closed(lp, max(0.9, min(1.6, 0.0012 / cs)))  # ~1 mm
            if abs(A) >= 2e-5 and len(s) >= 3:  # drop specks under 20 mm^2
                loops.append((A, [(b0 + x * cs, c0 + y * cs) for x, y in s]))
        outers = [l for A, l in loops if A > 0]
        if not outers:
            return None
        main = max(outers, key=lambda l: abs(area(l)))
        xs, ys = [p[0] for p in main], [p[1] for p in main]
        wb, wc = max(xs) - min(xs), max(ys) - min(ys)
        fill = abs(area(main)) / (math.pi / 4 * wb * wc) if wb * wc > 0 else 0
        cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
        radii = [math.hypot(x - cx, y - cy) for x, y in main]
        spread = (max(radii) - min(radii)) / (sum(radii) / len(radii))
        one = len(outers) == 1 and a is not None
        return {"axis": a, "basis": basis, "from": min(PN), "depth": max(PN) - min(PN), "outers": outers,
                "holes": [l for A, l in loops if A <= -2e-4],  # keep holes of 200 mm^2 and up
                "filled": sum(grid) * cs * cs, "fill": fill, "centre": (cx, cy),
                # round: one outline, all its points about the same distance from the centre (a hexagon passes)
                "round": one and abs(wb - wc) < 0.16 * max(wb, wc) and 0.84 < fill < 1.08 and spread < 0.18,
                "loose": one and abs(wb - wc) < 0.2 * max(wb, wc) and 0.68 < fill < 1.1}

    sils = [silhouette(a) for a in range(3) if ext[a] > 1e-6]
    # a flat plate tilted inside its own part frame (the intake guides): also look along its real face normal
    buckets = collections.defaultdict(lambda: [0.0, 0.0, 0.0, 0.0])
    for cr in crosses:
        L = math.sqrt(cr[0] ** 2 + cr[1] ** 2 + cr[2] ** 2)
        if L > 1e-15:
            n = [v / L for v in cr]
            if n[max(range(3), key=lambda i: abs(n[i]))] < 0:
                n = [-v for v in n]
            bk = buckets[tuple(round(v * 12) for v in n)]
            bk[0] += n[0] * L; bk[1] += n[1] * L; bk[2] += n[2] * L; bk[3] += L
    s3 = buckets[max(buckets, key=lambda k: buckets[k][3])][:3]
    n = [v / math.sqrt(sum(w * w for w in s3)) for v in s3]
    if max(abs(v) for v in n) < 0.995:
        ref = E3[min(range(3), key=lambda i: abs(n[i]))]
        u = [ref[1] * n[2] - ref[2] * n[1], ref[2] * n[0] - ref[0] * n[2], ref[0] * n[1] - ref[1] * n[0]]
        u = [v / math.sqrt(sum(w * w for w in u)) for v in u]
        sils.append(silhouette(None, (u, [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]], n)))
    sils = [s for s in sils if s]
    if not sils:
        return None
    rounds = [s for s in sils if s["round"]]
    name = NAMES.get(mi, "")
    if not rounds and ROUNDISH.search(name) and "belt" not in name.lower():
        rounds = [s for s in sils if s["loose"]]
    # a round view wins (motors, wheels, rollers); otherwise extrude along the direction enclosing the least
    # volume (plates: their thickness; bent sheets: their bend line; rails: their length)
    best = min(rounds, key=lambda s: abs(1 - s["fill"])) if rounds else min(sils, key=lambda s: s["filled"] * s["depth"])
    rgb = rgb_of(max(mat_area, key=mat_area.get))
    if not rounds:
        return {"kind": "extrude", "basis": best["basis"], "from": best["from"], "depth": best["depth"],
                "outers": best["outers"], "holes": best["holes"], "rgb": rgb}

    # lathe: the largest radius in each slice along the axis, and the material on the outside there
    a = best["axis"]
    PB, PC, PA = P[(a + 1) % 3], P[(a + 2) % 3], P[a]
    cb, cc = best["centre"]
    res = max(0.0003, ext[a] / 160)
    nb = int(ext[a] / res) + 2
    rmax, rmat, seen = [0.0] * nb, [-1] * nb, [False] * nb
    for t in range(ntri):
        k = 3 * t
        for e0, e1 in ((k, k + 1), (k + 1, k + 2), (k + 2, k)):
            t0, t1 = PA[e0], PA[e1]
            r0, r1 = math.hypot(PB[e0] - cb, PC[e0] - cc), math.hypot(PB[e1] - cb, PC[e1] - cc)
            if t0 > t1:
                t0, t1, r0, r1 = t1, t0, r1, r0
            for i in range(int((t0 - lo[a]) / res), int((t1 - lo[a]) / res) + 1):
                if t1 - t0 > 1e-12:  # the radius along an edge is convex: its max is at the slice ends
                    fa = (max(t0, lo[a] + i * res) - t0) / (t1 - t0)
                    fb = (min(t1, lo[a] + (i + 1) * res) - t0) / (t1 - t0)
                    r = max(r0 + (r1 - r0) * fa, r0 + (r1 - r0) * fb)
                else:
                    r = max(r0, r1)
                if r > rmax[i] + 1e-7:
                    rmax[i], rmat[i] = r, M[t]
                seen[i] = True
    runs = []  # slices with the same outside material -> one coloured section (tread vs hub, dome vs base)
    for i in range(nb):
        if seen[i]:
            if runs and runs[-1][0] == rmat[i]:
                runs[-1][1].append((lo[a] + (i + 0.5) * res, rmax[i]))
            else:
                runs.append([rmat[i], [(lo[a] + (i + 0.5) * res, rmax[i])]])
    merged = []
    for run in runs:  # sections under 3 slices join their neighbour
        if merged and len(run[1]) < 3:
            merged[-1][1].extend(run[1])
        else:
            merged.append(run)
    if len(merged) > 1 and len(merged[0][1]) < 3:
        merged[1][1][:0] = merged.pop(0)[1]
    segments = []
    for k, (m, pts) in enumerate(merged):
        t0 = lo[a] if k == 0 else pts[0][0] - res / 2
        t1 = hi[a] if k == len(merged) - 1 else pts[-1][0] + res / 2
        prof = dp([(t0, pts[0][1])] + pts + [(t1, pts[-1][1])], 0.0004)
        segments.append({"profile": [(prof[0][0], 0.0)] + prof + [(prof[-1][0], 0.0)], "rgb": rgb_of(m)})
    return {"kind": "lathe", "axis": a, "centre": [cb, cc], "segments": segments}


shapes = {mi: analyse(mi) for mi in sorted(NAMES)}
print(f"shapes done in {time.time() - t_start:.0f}s")


# ------------------------------------------------------------------ place every part in site coordinates
def apply(m, p, w=1.0):
    return tuple(m[i] * p[0] + m[4 + i] * p[1] + m[8 + i] * p[2] + m[12 + i] * w for i in range(3))


def frame(u, v, n, t):
    return [*u, 0, *v, 0, *n, 0, *t, 1]


def shape_frame(s):
    if s["kind"] == "extrude":  # outline in (u, v), extruded along n from s["from"]
        u, v, n = s["basis"]
        return frame(u, v, n, [c * s["from"] for c in n])
    a = s["axis"]; b = (a + 1) % 3; c = (a + 2) % 3
    t = [0.0, 0.0, 0.0]; t[b], t[c] = s["centre"]
    return frame(E3[c], E3[a], E3[b], t)  # LatheGeometry: X -> c, Y (the axis) -> a, Z -> b


def canon_box(s):
    if s["kind"] == "extrude":
        pts = [p for l in s["outers"] for p in l]
        return (min(p[0] for p in pts), min(p[1] for p in pts), 0.0), (max(p[0] for p in pts), max(p[1] for p in pts), s["depth"])
    pts = [pt for seg in s["segments"] for pt in seg["profile"]]
    R = max(r for t, r in pts)
    return (-R, min(t for t, r in pts), -R), (R, max(t for t, r in pts), R)


def place(ground):
    site = [1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, ground, CENTRE_Y, 1]  # site = (X, Z + ground, CENTRE_Y - Y)
    out = []
    for inst in instances:
        s = shapes[inst["mesh"]]
        if s:
            M = mat_mul(site, mat_mul(inst["m"], shape_frame(s)))
            lo, hi = canon_box(s)
            corners = [apply(M, (x, y, z)) for x in (lo[0], hi[0]) for y in (lo[1], hi[1]) for z in (lo[2], hi[2])]
            out.append({**inst, "shape": s, "M": M, "lo": [min(c[i] for c in corners) for i in range(3)],
                        "hi": [max(c[i] for c in corners) for i in range(3)]})
    return out


placed = place(-min(p["lo"][1] for p in place(0.0)))  # lift so the wheels sit on y = 0


def axis_and_centre(p):
    s, M = p["shape"], p["M"]
    if s["kind"] == "lathe":
        hs = [t for seg in s["segments"] for t, r in seg["profile"]]
        return apply(M, (0, 1, 0), 0), apply(M, (0, (min(hs) + max(hs)) / 2, 0))
    pts = [pt for l in s["outers"] for pt in l]
    centre = ((min(x for x, y in pts) + max(x for x, y in pts)) / 2, (min(y for x, y in pts) + max(y for x, y in pts)) / 2)
    return apply(M, (0, 0, 1), 0), apply(M, (*centre, s["depth"] / 2))


# the four roller shafts (KB-26002), intake end first: everything mounted on one spins with it
rotors = sorted({(round(axis_and_centre(p)[1][1], 4), round(axis_and_centre(p)[1][2], 4))
                 for p in placed if p["name"].startswith("KB-26002")}, key=lambda r: -r[1])

q = lambda v: round(v, 5)
shape_ids, shape_list, mat_ids, mat_list, clear_list, parts = {}, [], {}, [], [], []


def shape_id(key, d):
    if key not in shape_ids:
        shape_ids[key] = len(shape_list)
        shape_list.append(d)
    return shape_ids[key]


def mat_id(rgb, clear=False):
    key = (tuple(round(c, 3) for c in rgb), clear)
    if key not in mat_ids:  # Onshape's colour numbers are what it shows: treat them as sRGB
        mat_ids[key] = len(mat_list)
        mat_list.append("#%02x%02x%02x" % tuple(round(c * 255) for c in rgb))
        if clear:
            clear_list.append(mat_ids[key])
    return mat_ids[key]


for p in placed:
    d, c = axis_and_centre(p)
    rotor = next((i for i, (ry, rz) in enumerate(rotors) if abs(d[0]) > 0.999 and math.hypot(c[1] - ry, c[2] - rz) < 0.006), -1)
    s, M = p["shape"], [q(p["M"][i]) for i in (0, 1, 2, 4, 5, 6, 8, 9, 10, 12, 13, 14)]
    if s["kind"] == "lathe":
        pieces = [(shape_id((p["mesh"], k), {"p": [q(v) for t, r in seg["profile"] for v in (r, t)]}), mat_id(seg["rgb"]))
                  for k, seg in enumerate(s["segments"])]
    else:
        d = {"o": [[q(c) for pt in l for c in pt] for l in s["outers"]], "h": [[q(c) for pt in l for c in pt] for l in s["holes"]],
             "d": q(s["depth"]), **({"r": 0.02} if ROUNDED.search(p["name"]) else {})}
        pieces = [(shape_id(p["mesh"], d), mat_id(s["rgb"], bool(CLEAR.search(p["name"]))))]
    for sid, mid in pieces:
        parts.append({"s": sid, "c": mid, "m": M, **({"g": rotor} if rotor >= 0 else {})})


def centre_of(pattern):
    found = [p for p in placed if re.search(pattern, p["name"])]
    return [round((min(p["lo"][i] for p in found) + max(p["hi"][i] for p in found)) / 2, 3) for i in range(3)]


launcher_cim = max((p for p in placed if p["name"] == "CIM Motor"), key=lambda p: p["hi"][1])
anchors = {
    "intake": [0.0, *rotors[0]], "launcher": [0.0, *rotors[2]], "hood": centre_of(r"^KB-26008"),
    "hopper": [0.0, round(max(p["hi"][1] for p in placed if p["name"].startswith("KB-26005")), 3), centre_of(r"^KB-26005")[2]],
    "cim": [round((a + b) / 2, 3) for a, b in zip(launcher_cim["lo"], launcher_cim["hi"])],
    "battery": centre_of(r"^battery$"),
}
data = {"source": f"{GLB.replace(chr(92), '/').split('/')[-1]}, reduced by scripts/kitbot-cad.py", "materials": mat_list,
        "clear": clear_list, "shapes": shape_list, "rotors": rotors, "anchors": anchors, "parts": parts}
text = json.dumps(data, separators=(",", ":"))
with open(OUT, "w") as f:
    f.write(text)
print(f"wrote {OUT}: {len(text) // 1024} KB, {len(parts)} pieces, rotors {rotors}, in {time.time() - t_start:.0f}s")
