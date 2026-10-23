#!/bin/bash
export GENGI_BASE=http://localhost:4178/ GENGI_DIST=/workspace/gengi/dist-v42
for t in ${SUITES:-qa offscreen fog v2 sigilo prueba v3 v31 v32 v4 levels v42 v4b v4c v4d}; do timeout 1200 node $t.mjs http://localhost:4178/ > o42_$t.log 2>&1; echo "=== $t exit $? $(grep -E 'PASS,|[0-9]+ PASS' o42_$t.log | tail -1)"; grep -E "^FAIL|FAIL " o42_$t.log | head -8; done
echo ALLDONE
