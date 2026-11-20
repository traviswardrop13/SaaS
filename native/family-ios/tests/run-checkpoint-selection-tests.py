#!/usr/bin/env python3
"""Check native selection against real source output, with no audio or network."""
from pathlib import Path
import os
import subprocess
import sys
import tempfile


def main():
    root = Path(__file__).resolve().parents[3]
    with tempfile.TemporaryDirectory(prefix="sona-checkpoint-selection-") as folder:
        target = Path(folder)
        generator = target / "fixture.mjs"
        generator.write_text('''import vm from "node:vm";
import {readFileSync,writeFileSync} from "node:fs";
const root=process.argv[2], output=process.argv[3], ROOT=root+"/public";
const suite=readFileSync(root+"/tests/trophytest.mjs","utf8");
const boot=suite.slice(suite.indexOf("function boot(opts = {})"),suite.indexOf("const DAY ="));
const harness=vm.createContext({vm,readFileSync,ROOT,console,setTimeout,clearTimeout,setInterval,clearInterval});
vm.runInContext(boot+";this.boot=boot;",harness);
const p=harness.boot({profile:{childName:"Synthetic",childAge:"7",focusSounds:["R"],ladderStart:"word",volume:0.8,voiceOn:true}});
vm.runInContext(readFileSync(ROOT+"/gamecontent.js","utf8"),p.ctx);
vm.runInContext(readFileSync(root+"/native/family-ios/modules/SonaFamilyRules/Sources/SonaFamilyRules/Rules/arcade-checkpoint-selection.js","utf8"),p.ctx);
const values=[];
for(const game of ["slice","tiles","stack","run","glide","rise"])for(const card of [0,1,2]){
 values.push(p.ctx.nativeArcadeCheckpoint({game,sound:"R",card,boostLevel:"word",boostAsk:"rabbit",boostPosition:"i"}));
}
writeFileSync(output,JSON.stringify(values));
''')
        result = subprocess.run(["node", str(generator), str(root), str(target / "fixture.json")], check=False)
        if result.returncode:
            return result.returncode
        source = (root / "native/family-ios/SonaNativePreview/Sources/NativeArcadeCheckpointSelection.swift").read_text()
        if os.environ.get("SONA_CHECKPOINT_NEGATIVE_CONTROL") == "ignore-model-playback":
            pin = "desired.requiresPreparedModel && (!played || text != desired.modelText) ? bare : desired"
            assert source.count(pin) == 1
            source = source.replace(pin, "desired", 1)
        (target / "Selection.swift").write_text(source)
        result = subprocess.run(["swiftc", str(target / "Selection.swift"), str(Path(__file__).with_name("ArcadeCheckpointSelectionContract.swift")),
                                 "-o", str(target / "check")], check=False)
        if result.returncode:
            return result.returncode
        return subprocess.run([str(target / "check"), str(target / "fixture.json")], check=False).returncode


if __name__ == "__main__":
    sys.exit(main())
