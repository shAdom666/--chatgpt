"""Refine our own Cubism mouth keyform while retaining the native texture atlas.

The result must be reopened and exported by official Cubism Editor.
"""
from pathlib import Path
import re
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'third_party/stretchystudio/docs/live2d-export/scripts'))
from cmo3_decrypt import CaffReader, inflate_zip
from caff_packer import pack_caff

source = ROOT / 'live2d/model/GPTDragon.cmo3'
target = ROOT / 'live2d/model/GPTDragon.refined.cmo3'
reader = CaffReader(source.read_bytes())
assert reader.read_bytes(4) == b'CAFF'
reader.skip(10)
key = reader.read_int32()
reader.skip(36)
entries = []
for _ in range(reader.read_int32(key)):
    entry = dict(path=reader.read_string(key), tag=reader.read_string(key),
                 start=reader.read_int64(key), size=reader.read_int32(key),
                 obfuscated=reader.read_bool(key), compress=reader.read_byte(key))
    reader.skip(8)
    entries.append(entry)
files = []
for entry in entries:
    reader.pos = entry['start']
    content = reader.read_bytes(entry['size'], key if entry['obfuscated'] else 0)
    if entry['compress'] != 16:
        content = inflate_zip(content)
    if entry['path'] == 'main.xml':
        xml = content.decode('utf-8')
        tree = ET.fromstring(xml)
        mouth = next(e for e in tree.iter('CWarpDeformerSource')
                     if any(c.attrib.get('idstr') == 'RigWarp_mouth' for c in e.iter('CDeformerId')))
        mouth_id = mouth.attrib['xs.id']
        pattern = r'<CWarpDeformerSource xs.id="' + re.escape(mouth_id) + r'".*?</CWarpDeformerSource>'
        block = re.search(pattern, xml, re.S).group()
        arrays = list(re.finditer(r'(<float-array xs.n="positions"[^>]*>)(.*?)(</float-array>)', block, re.S))
        assert len(arrays) == 2
        closed = [float(v) for v in arrays[0][2].split()]
        center = (min(closed[1::2]) + max(closed[1::2])) / 2
        for i in range(1, len(closed), 2):
            closed[i] = center + (closed[i] - center) * 0.10
        updated = arrays[0][1] + ' '.join(f'{v:.8f}' for v in closed) + arrays[0][3]
        block = block[:arrays[0].start()] + updated + block[arrays[0].end():]
        xml = re.sub(pattern, lambda _: block, xml, count=1, flags=re.S)
        ET.fromstring(xml)
        content = xml.encode('utf-8')
    files.append({**entry, 'content': content})
target.write_bytes(pack_caff(files, obfuscate_key=key))
print('Refined one closed-mouth keyform; preserved', len(files), 'archive entries:', target)
