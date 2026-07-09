# Hash-pinned Python requirements

These files pin the Python packages installed in CI and container images by
exact version **and** sha256 hash (`pip install --require-hashes`), so a
compromised or substituted package on PyPI cannot slip into a build
(OpenSSF Scorecard Pinned-Dependencies).

Each file lists every published wheel + sdist hash for its package, so one
file serves Linux, Windows, and macOS installs alike.

## Updating a pin

1. Pick the new version on PyPI.
2. Regenerate the hash list:

   ```bash
   python -c "
   import json, urllib.request
   pkg, ver = 'debugpy', '<NEW VERSION>'
   with urllib.request.urlopen(f'https://pypi.org/pypi/{pkg}/{ver}/json') as r:
       files = json.load(r)['urls']
   print(f'{pkg}=={ver} \\\\')
   print(' \\\\\n'.join(f\"    --hash=sha256:{f['digests']['sha256']}\" for f in files))
   "
   ```

3. Replace the package block in the corresponding `.txt` file.

Both `pip.txt` and `debugpy.txt` are dependency-free packages, so no
transitive resolution is needed. If you add a package *with* dependencies,
generate its file with `pip-compile --generate-hashes` instead — with
`--require-hashes`, pip refuses to install anything whose transitive
closure is not fully hashed.
