"""Read the authorized game artifact without executing or extracting its files."""
import hashlib
import io
import json
from pathlib import Path
import tarfile
import zipfile

root = Path(__file__).resolve().parents[1]
folder = root / 'docs/artifacts/coastal-art-39930857079'
provenance = json.loads((folder / 'provenance.json').read_text())
archive = (folder / 'pages.zip').read_bytes()
archive_hash = hashlib.sha256(archive).hexdigest()
assert 'sha256:' + archive_hash == provenance['digest'], 'Artifact digest differs'
expected = json.loads((root / 'docs/coastal-art-relative-production-files.json').read_text())
local_files = {f['path']: f for f in expected['files']}
results = []
with zipfile.ZipFile(io.BytesIO(archive)) as zipped:
    assert zipped.namelist() == ['artifact.tar']
    with tarfile.open(fileobj=io.BytesIO(zipped.read('artifact.tar'))) as tar:
        for member in tar:
            if member.isdir():
                continue
            assert member.isfile(), 'Unexpected symlink or special file'
            name = member.name.removeprefix('./')
            assert name in local_files, 'Unexpected artifact path: ' + name
            data = tar.extractfile(member).read()
            actual = hashlib.sha256(data).hexdigest()
            kind = 'exact' if actual == local_files[name]['sha256'] else 'mismatch'
            if kind == 'mismatch' and name.endswith(('.html', '.json')):
                local = (root / 'dist' / name).read_bytes()
                if data.replace(b'\r', b'') == local.replace(b'\r', b''):
                    if name.endswith('.json'):
                        assert json.loads(data) == json.loads(local)
                    kind = 'CRLF-only'
            results.append({'path': name, 'sha256': actual, 'bytes': len(data), 'kind': kind})
assert set(r['path'] for r in results) == set(local_files)
report = {'artifact': provenance, 'digestVerified': archive_hash,
          'files': len(results), 'exact': sum(r['kind'] == 'exact' for r in results),
          'lineEndingsOnly': [r['path'] for r in results if r['kind'] == 'CRLF-only'],
          'results': sorted(results, key=lambda r:r['path']),
          'pass': all(r['kind'] != 'mismatch' for r in results)}
(root / 'docs/coastal-art-cloud-comparison.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({k:v for k,v in report.items() if k != 'results'}, indent=2))
assert report['pass']
