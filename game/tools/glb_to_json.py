"""Convert a GLB into a self-contained JSON glTF (buffer embedded as base64) for hosts that do not serve .glb."""
import base64, json, struct, sys
src, dst = sys.argv[1], sys.argv[2]
b = open(src, 'rb').read()
assert b[:4] == b'glTF'
off = 12
js, binc = None, None
while off < len(b):
    ln, typ = struct.unpack('<II', b[off:off + 8])
    chunk = b[off + 8:off + 8 + ln]
    if typ == 0x4E4F534A:
        js = json.loads(chunk)
    elif typ == 0x004E4942:
        binc = chunk
    off += 8 + ln
js['buffers'][0]['uri'] = 'data:application/octet-stream;base64,' + base64.b64encode(binc).decode()
open(dst, 'w').write(json.dumps(js, separators=(',', ':')))
print(dst, len(open(dst).read()) // 1024, 'KB')
