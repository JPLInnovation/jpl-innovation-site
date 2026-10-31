"""Bake every source GLB triangle into material batches. No simplification or quantization.

Requires numpy. Run: python scripts/robot-exact.py
The gzip payload is decompressed in a web worker, never during a scroll handler.
"""
import gzip, hashlib, json, re, struct
from pathlib import Path
import numpy as np

source = Path('CAD/10951_robot.glb')
raw = source.read_bytes()
jl = struct.unpack_from('<I', raw, 12)[0]
g = json.loads(raw[20:20+jl])
binary = memoryview(raw)[28+jl:]

def acc(i):
    a = g['accessors'][i]; v = g['bufferViews'][a['bufferView']]
    dtype = np.dtype({5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']])
    width = {'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
    return np.ndarray((a['count'],width), dtype=dtype, buffer=binary,
        offset=v.get('byteOffset',0)+a.get('byteOffset',0),
        strides=(v.get('byteStride',width*dtype.itemsize),dtype.itemsize))

def matrix(n):
    if 'matrix' in n: return np.array(n['matrix']).reshape(4,4,order='F')
    x,y,z,w = n.get('rotation',[0,0,0,1])
    m = np.eye(4)
    m[:3,:3] = np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],
        [2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],
        [2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]]) @ np.diag(n.get('scale',[1,1,1]))
    m[:3,3] = n.get('translation',[0,0,0])
    return m

instances = []
def walk(i,parent,path):
    n=g['nodes'][i]; m=parent@matrix(n); path=path+[n.get('name','')]
    if 'mesh' in n:
        names=[re.sub('^occurrence of ','',s).strip() for s in path]
        name=next((s for s in reversed(names) if s and not re.fullmatch(r'node\d+',s)),str(i))
        instances.append((name,n['mesh'],m))
    for c in n.get('children',[]): walk(c,m,path)
for i in g['scenes'][g.get('scene',0)]['nodes']: walk(i,np.eye(4),[])

# Rigid change of coordinates only: metres, Y up, intake toward +Z.
site=np.array([[1,0,0,0],[0,0,1,0],[0,-1,0,-.299],[0,0,0,1.]])
floor=min(float((acc(p['attributes']['POSITION']) @ (site@m)[:3,:3].T + (site@m)[:3,3])[:,1].min())
    for _,mi,m in instances for p in g['meshes'][mi]['primitives'])
site[1,3]=-floor
# Merge primitive fragments once per source mesh/material, then instance the original nodes.
out=Path('public/assets/robot'); out.mkdir(parents=True,exist_ok=True)
meta={'sourceSha256':hashlib.sha256(raw).hexdigest(),'materials':g['materials'],
    'parts':[],'batches':[],'siteMatrix':site.flatten(order='F').tolist()}
triangles=0; files=set()
for mi in sorted({mi for _,mi,_ in instances}):
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
        data=pos.tobytes()+nor.tobytes()+idx.tobytes()
        digest=hashlib.sha256(data).hexdigest()[:12]; filename=f'{mi}-{material}-{digest}.bin.gz'; files.add(filename)
        (out/filename).write_bytes(gzip.compress(data,compresslevel=6,mtime=0))
        placed=[]
        for name,mesh,m in instances:
            if mesh!=mi: continue
            world=site@m
            assert np.linalg.det(world[:3,:3])>0, 'Mirrored instance requires winding correction'
            transformed=pos @ world[:3,:3].T + world[:3,3]
            color=g['materials'][material].get('pbrMetallicRoughness',{}).get('baseColorFactor',[1,1,1,1])
            part={'name':name,'color':'#'+''.join(f'{round(c*255):02x}' for c in color[:3]),
                'clear':g['materials'][material].get('alphaMode','OPAQUE')!='OPAQUE',
                'rotor':-1,'lo':transformed.min(axis=0).tolist(),'hi':transformed.max(axis=0).tolist()}
            placed.append({'matrix':world.flatten(order='F').tolist(),'part':len(meta['parts'])})
            meta['parts'].append(part)
            triangles+=len(idx)//3
        meta['batches'].append({'material':material,'file':filename,'vertices':len(pos),'indices':len(idx),
            'instances':placed,'lo':pos.min(axis=0).tolist(),'hi':pos.max(axis=0).tolist()})
meta['triangles']=triangles; meta['instances']=len(instances)
(out/'manifest.json').write_text(json.dumps(meta,separators=(',',':')))
# Only remove stale generated payloads inside this explicit output directory.
for p in out.glob('*.bin.gz'):
    if p.name not in files: p.unlink()
print(f'{len(instances)} instances, {triangles:,} original triangles, {len(meta["batches"])} shared batches')
print(f'Compressed payload: {sum(p.stat().st_size for p in out.glob("*.gz"))/1e6:.1f} MB')
