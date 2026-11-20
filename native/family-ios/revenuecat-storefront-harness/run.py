#!/usr/bin/env python3
"""Actual pinned SDK public-product fixtures; no SDK config/accounts/network."""
import argparse
import json
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

HERE = Path(__file__).resolve().parent
FAMILY = HERE.parent
ROOT = FAMILY.parents[1]
REVISION = '8969bf1feaca2cc9efaa7630cd148cec5005f2f8'
parser = argparse.ArgumentParser()
parser.add_argument('--sdk-stage', required=True, type=Path, help='Existing verified revenuecat-identity-harness stage')
parser.add_argument('--modules', required=True, type=Path, help='Built storefront package Products/Debug directory')
parser.add_argument('--output', type=Path)
args = parser.parse_args()
out = (args.output or Path(tempfile.mkdtemp(prefix='sona-storefront-sdk-', dir='/private/tmp'))).resolve()
assert out.is_relative_to(Path('/private/tmp')), 'Synthetic output must stay in /private/tmp'
out.mkdir(parents=True, exist_ok=True)
origin = json.loads((args.sdk_stage / 'sdk-origin.json').read_text())
assert origin == {'revision': REVISION, 'version': '5.80.3'}, 'Use the verified pinned SDK stage'
sdk = args.sdk_stage / 'build/out/Products/Debug'
modules = args.modules.resolve()
# This key is publishable configuration. Compare without printing it.
shipping = re.search(r'const IAP_KEY = "([^"]+)"', (ROOT / 'public/sona.js').read_text()).group(1)
adapter = FAMILY / 'adapters/RevenueCatFamilyStorefrontClient.swift'
assert ('existingPublicAPIKey == "' + shipping + '"') in adapter.read_text(), 'Canonical project key drifted'
for name, base in [('RevenueCat_RevenueCat.bundle', sdk), ('SonaFamilyAccess_SonaFamilyAccess.bundle', modules)]:
    shutil.copytree(base / name, out / name, dirs_exist_ok=True)
command = ['xcrun', 'swiftc', '-target', 'arm64-apple-macos13.0', '-I', str(modules), '-I', str(sdk),
           str(FAMILY / 'adapters/RevenueCatFamilyPurchaseClient.swift'), str(adapter), str(HERE / 'ProjectionProbe.swift'),
           str(sdk / 'RevenueCat.o')]
command += [str(modules / (name + '.o')) for name in ['SonaFamilyMigration', 'SonaFamilyAccess', 'SonaFamilyStorefront']]
command += ['-o', str(out / 'ProjectionProbe')]
with (out / 'build.log').open('w') as log:
    built = subprocess.run(command, stdout=log, stderr=subprocess.STDOUT)
assert built.returncode == 0, 'Compile failed; see build.log'
with (out / 'checks.log').open('w') as log:
    checked = subprocess.run(['/usr/bin/sandbox-exec', '-p', '(version 1)(allow default)(deny network-outbound)', str(out / 'ProjectionProbe')], stdout=log, stderr=subprocess.STDOUT)
print((out / 'checks.log').read_text().strip())
print('Exit:', checked.returncode)
raise SystemExit(checked.returncode)
