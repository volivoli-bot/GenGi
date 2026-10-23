#!/bin/bash
# v4d: niebla v2 vs v4b, minuto 12, 3 rondas intercaladas (normal y estrés)
K='gengi.v4d().cfg.RANGED.autoFire=true'
for r in 1 2 3; do
  node perf12.mjs http://localhost:4179/ v4b-normal 0 0 0 | tail -1
  node perf12.mjs http://localhost:4178/ v4d-normal 0 0 0 | tail -1
  node perf12.mjs http://localhost:4179/ v4b-estres 1 0 1 | tail -1
  node perf12.mjs http://localhost:4178/ v4d-estres 1 0 1 1234 "$K" | tail -1
done
