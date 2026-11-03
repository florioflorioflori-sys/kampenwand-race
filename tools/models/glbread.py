import json,struct,numpy as np
CT={5126:np.float32,5123:np.uint16,5125:np.uint32,5121:np.uint8}
NC={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def load(f):
    b=open(f,'rb').read(); l=struct.unpack('<I',b[12:16])[0]; j=json.loads(b[20:20+l]); bin_=b[20+l+8:]
    def acc(i):
        a=j['accessors'][i]; bv=j['bufferViews'][a['bufferView']]; o=bv.get('byteOffset',0)+a.get('byteOffset',0)
        n=NC[a['type']]; arr=np.frombuffer(bin_,CT[a['componentType']],a['count']*n,o)
        return arr.reshape(a['count'],n) if n>1 else arr
    return j,acc
