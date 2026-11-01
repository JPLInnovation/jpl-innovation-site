"""Bake the robot CAD into material batches. No simplification or quantization.

Requires numpy. Run: python scripts/robot-exact.py
The gzip payload is decompressed in a web worker, never during a scroll handler.

CAD/10951_robot-2026.glb has 57M triangles against the previous export's 13.5M, with only the hopper moved: the same
parts, tessellated about 4x finer. So a part the new file proves unchanged (same place, same area, same surface) keeps
the previous export's mesh, and only what changed comes from the new file. Both files are needed to run this.
"""
import gzip, hashlib, json, mmap, re, struct
from pathlib import Path
import numpy as np

source = Path('CAD/10951_robot-2026.glb')
previous = Path('CAD/10951_robot.glb')

# The 2026 export lost the hopper assembly's names ("Part N"). Matched to the previous export by shape and place, so the
# showcase's tags keep working.
NAMES = {3:'Hopper Floor', 31:'Hopper Floor upper layer', 58:'Hopper bottom plate', 26:'Left Side', 32:'Right Side hopper', 9:'Left side bracket',
    20:'Right hopper bracket', 16:'Extended hopper side LEFT (outside the fixed side)', 81:'Extended hopper side RIGHT (outside the fixed side)',
    56:'Extended Back Hopper (widened to the new sides)', 67:'Back Hopper (widened to the new sides)',
    34:'Pivot block left (3D print)', 38:'Pivot block right (3D print)', 43:'Bolt 1/4-20 SHCS - left pivot', 35:'Bolt 1/4-20 SHCS - right pivot',
    39:'Spacer 1/2 OD for 1/4 bolt - left (rides in the slot)', 4:'Spacer 1/2 OD for 1/4 bolt - right (rides in the slot)',
    10:'Washer 1/4 - left', 1:'Washer 1/4 - right', 30:'Nyloc nut 1/4-20 - left', 44:'Nyloc nut 1/4-20 - right',
    40:'#6 screw - left pivot block 1', 48:'#6 screw - left pivot block 2', 65:'#6 screw - left pivot block 3', 19:'#6 screw - left pivot block 4',
    36:'#6 screw - right pivot block 1', 59:'#6 screw - right pivot block 2', 2:'#6 screw - right pivot block 3', 41:'#6 screw - right pivot block 4',
    110:'Sticker - gear (white)', 111:'Sticker - gear (white)'}
NAMES |= {n:'Sticker - dragon (black)' for n in range(83,110)} | {n:'Sticker - DRAGONS (yellow)' for n in range(49,56)}
NAMES |= {n:'Sticker - 10951 (black)' for n in range(60,65)} | {n:'Sticker - SAIGON SOUTH (blue)' for n in range(69,80)}
NAMES |= {part:f'Zip tie {n} (hopper)' for n,part in {1:15,2:42,3:21,4:33,5:23,6:8,7:5,8:22,9:14,10:47,11:12,12:46,13:11,14:18,15:29,16:24,
    17:13,18:37,19:7,20:25,21:27,22:28,23:57,24:80,25:17,26:6,27:66,28:45,29:68,30:82}.items()}
ALIASES = {'Modified Kitbot 2026 Copy 1':'Modified Kitbot 2026'}
# Their colours came through sRGB-encoded twice (black stickers as #424247): undone here, to stay the colours they were.
srgb_to_linear = lambda c: c/12.92 if c <= .04045 else ((c+.055)/1.055)**2.4

def matrix(n):
    if 'matrix' in n: return np.array(n['matrix']).reshape(4,4,order='F')
    x,y,z,w = n.get('rotation',[0,0,0,1])
    m = np.eye(4)
    m[:3,:3] = np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],
        [2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],
        [2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]]) @ np.diag(n.get('scale',[1,1,1]))
    m[:3,3] = n.get('translation',[0,0,0])
    return m

def read(path):
    f = open(path,'rb'); raw = mmap.mmap(f.fileno(),0,access=mmap.ACCESS_READ)
    jl = struct.unpack_from('<I',raw,12)[0]
    g = json.loads(raw[20:20+jl])
    base = 28+jl
    def acc(i):
        a = g['accessors'][i]; v = g['bufferViews'][a['bufferView']]
        dtype = np.dtype({5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']])
        width = {'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
        return np.ndarray((a['count'],width), dtype=dtype, buffer=raw,
            offset=base+v.get('byteOffset',0)+a.get('byteOffset',0),
            strides=(v.get('byteStride',width*dtype.itemsize),dtype.itemsize))
    instances = []
    def walk(i,parent,path):
        n=g['nodes'][i]; m=parent@matrix(n); path=path+[n.get('name','')]
        if 'mesh' in n:
            names=[re.sub('^occurrence of ','',s).strip() for s in path]
            name=next((s for s in reversed(names) if s and not re.fullmatch(r'node\d+',s)),str(i))
            instances.append((name,n['mesh'],m))
        for c in n.get('children',[]): walk(c,m,path)
    for i in g['scenes'][g.get('scene',0)]['nodes']: walk(i,np.eye(4),[])
    return g,acc,instances

old = read(previous); new = read(source)
FILES = {0:old, 1:new}

# Rigid change of coordinates only: metres, Y up, intake toward +Z.
site=np.array([[1,0,0,0],[0,0,1,0],[0,-1,0,-.299],[0,0,0,1.]])

def triangles_of(which,mi):
    g,acc,_=FILES[which]; out=[]
    for p in g['meshes'][mi]['primitives']:
        pos=acc(p['attributes']['POSITION']).astype('f8')
        idx=acc(p['indices']).reshape(-1) if 'indices' in p else np.arange(len(pos))
        out.append(pos[idx.astype(int)].reshape(-1,3,3))
    return np.concatenate(out)

def bounds(which,mi,m):
    g,_,_=FILES[which]; w=site@m; lo=np.full(3,np.inf); hi=-lo
    for p in g['meshes'][mi]['primitives']:
        a=g['accessors'][p['attributes']['POSITION']]
        corners=np.array(np.meshgrid(*zip(a['min'],a['max']))).T.reshape(-1,3)@w[:3,:3].T+w[:3,3]
        lo=np.minimum(lo,corners.min(0)); hi=np.maximum(hi,corners.max(0))
    return lo,hi

def samples(which,mi,m,count=30000):
    """Evenly spread points on the part's surface, in site space, and its area."""
    t=triangles_of(which,mi); w=site@m; t=t@w[:3,:3].T+w[:3,3]
    area=np.linalg.norm(np.cross(t[:,1]-t[:,0],t[:,2]-t[:,0]),axis=1)/2
    rng=np.random.default_rng(1); pick=rng.choice(len(t),count,p=area/area.sum()); u,v=rng.random((2,count)); f=u+v>1; u[f],v[f]=1-u[f],1-v[f]
    s=t[pick]; return s[:,0]+(s[:,1]-s[:,0])*u[:,None]+(s[:,2]-s[:,0])*v[:,None],area.sum()

def strays(a,b,cell):
    """Share of the points in `a` with none of `b` within about a cell."""
    cells={tuple(c) for c in np.floor(b/cell).astype(int).tolist()}
    near={(x+i,y+j,z+k) for x,y,z in cells for i in (-1,0,1) for j in (-1,0,1) for k in (-1,0,1)}
    return np.mean([tuple(c) not in near for c in np.floor(a/cell).astype(int).tolist()])

def unchanged(a,b):
    """Same part in both files? a, b = (file, mesh, matrix). Any feature larger than about 3% of the part fails it."""
    la,ha=bounds(*a); lb,hb=bounds(*b)
    if max(np.abs(la-lb).max(),np.abs(ha-hb).max())>.0005: return False
    sa,aa=samples(*a); sb,ab=samples(*b)
    if abs(aa-ab)>.015*ab: return False
    cell=max(.0015,np.linalg.norm(hb-lb)/70)
    return strays(sa,sb,cell)<.002 and strays(sb,sa,cell)<.002

# Each new instance: the previous mesh if it's proven the same part, otherwise its own.
by_name={}
for name,mi,m in old[2]: by_name.setdefault(name,[]).append((mi,m))
verdicts={}; placed=[]; kept=fresh=0; changed=[]
for name,mi,m in new[2]:
    part=re.fullmatch(r'Part (\d+)',name)
    if part:
        placed.append((NAMES[int(part[1])],1,mi,m)); continue
    name=ALIASES.get(name,name)
    centre=sum(bounds(1,mi,m))/2
    same=by_name.get(name,[])
    if same:
        omi,om=min(same,key=lambda c:np.abs(sum(bounds(0,*c))/2-centre).max())
        key=(mi,omi)
        if key not in verdicts: verdicts[key]=unchanged((1,mi,m),(0,omi,om))
        if verdicts[key]:
            placed.append((name,0,omi,om)); kept+=1; continue
        changed.append(name)
    placed.append((name,1,mi,m)); fresh+=1
print(f'{kept} instances keep the previous mesh, {fresh} use the new one. Differ from the previous file:', sorted(set(changed)))

# The real lowest vertex, not the corners of a rotated part's box: those sit below the part and would float the robot.
def lowest(which,mi,m):
    g,acc,_=FILES[which]; w=site@m
    return min(float((acc(p['attributes']['POSITION']) @ w[:3,:3].T + w[:3,3])[:,1].min())
        for p in g['meshes'][mi]['primitives'])
floor=min(lowest(w,mi,m) for _,w,mi,m in placed)
site[1,3]=-floor

# Previous materials first, so unchanged parts keep their payload's file name.
offset=len(old[0]['materials'])
materials=list(old[0]['materials'])
for m in new[0]['materials']:
    m=json.loads(json.dumps(m)); pbr=m.setdefault('pbrMetallicRoughness',{})
    if 'baseColorFactor' in pbr: pbr['baseColorFactor']=[srgb_to_linear(c) for c in pbr['baseColorFactor'][:3]]+pbr['baseColorFactor'][3:]
    materials.append(m)

# Merge primitive fragments once per source mesh/material, then instance the original nodes.
out=Path('public/assets/robot'); out.mkdir(parents=True,exist_ok=True)
meta={'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'materials':materials,
    'parts':[],'batches':[],'siteMatrix':site.flatten(order='F').tolist()}
triangles=0; files=set()
for which,mi in sorted({(w,mi) for _,w,mi,_ in placed}):
    g,acc,_=FILES[which]
    groups={}
    for p in g['meshes'][mi]['primitives']:
        assert p.get('mode',4)==4
        b=groups.setdefault(p.get('material',0),{'p':[],'n':[],'i':[],'count':0})
        pos=acc(p['attributes']['POSITION']).astype('<f4')
        nor=acc(p['attributes']['NORMAL']).astype('<f4')
        idx=acc(p['indices']).reshape(-1).astype('<u4') if 'indices' in p else np.arange(len(pos),dtype='<u4')
        b['p'].append(pos); b['n'].append(nor); b['i'].append(idx+b['count']); b['count']+=len(pos)
    for material,b in groups.items():
        pos=np.concatenate(b['p']); nor=np.concatenate(b['n']); idx=np.concatenate(b['i']).astype('<u4')
        material+=offset*which
        data=pos.tobytes()+nor.tobytes()+idx.tobytes()
        digest=hashlib.sha256(data).hexdigest()[:12]; filename=f'{mi}-{material}-{digest}.bin.gz'; files.add(filename)
        if not (out/filename).exists(): (out/filename).write_bytes(gzip.compress(data,compresslevel=6,mtime=0))
        instances=[]
        for name,w,mesh,m in placed:
            if (w,mesh)!=(which,mi): continue
            world=site@m
            assert np.linalg.det(world[:3,:3])>0, 'Mirrored instance requires winding correction'
            transformed=pos @ world[:3,:3].T + world[:3,3]
            color=materials[material].get('pbrMetallicRoughness',{}).get('baseColorFactor',[1,1,1,1])
            part={'name':name,'color':'#'+''.join(f'{round(c*255):02x}' for c in color[:3]),
                'clear':materials[material].get('alphaMode','OPAQUE')!='OPAQUE',
                'rotor':-1,'lo':transformed.min(axis=0).tolist(),'hi':transformed.max(axis=0).tolist()}
            instances.append({'matrix':world.flatten(order='F').tolist(),'part':len(meta['parts'])})
            meta['parts'].append(part)
            triangles+=len(idx)//3
        meta['batches'].append({'material':material,'file':filename,'vertices':len(pos),'indices':len(idx),
            'instances':instances,'lo':pos.min(axis=0).tolist(),'hi':pos.max(axis=0).tolist()})
meta['triangles']=triangles; meta['instances']=len(placed)
(out/'manifest.json').write_text(json.dumps(meta,separators=(',',':')))
# Only remove stale generated payloads inside this explicit output directory.
for p in out.glob('*.bin.gz'):
    if p.name not in files: p.unlink()
print(f'{len(placed)} instances, {triangles:,} triangles, {len(meta["batches"])} shared batches')
print(f'Compressed payload: {sum(p.stat().st_size for p in out.glob("*.gz"))/1e6:.1f} MB')
print('floor',-floor)
