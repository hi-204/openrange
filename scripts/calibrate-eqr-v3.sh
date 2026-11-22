#!/usr/bin/env bash
# EQR v3 protocol (D-085, D-086): three rounds of calibrate-eqr then gen-charts at 100 bb, each
# round starting from the previous round's charts; round 3's factors make every cash depth.
# Run from the repo root (bash). About 4 hours per round on a 12-core PC, with the PC awake.
# The last step installs round 3's factors as data/eqr/eqr-v3.json and writes data/charts from
# that file with the same solver settings as the earlier committed charts (4M iterations, 1M
# evaluation samples; rounds use the faster defaults), so the provenance names the committed
# file. Intermediate rounds stay in target/.
set -e
R=target/eqr-v3
mkdir -p $R
cargo build --release --locked -p solver-cli
BIN=target/release/solver-cli
input=data/charts/cash-6max-100bb.json
for r in 1 2 3; do
  echo "=== round $r: calibrate from $input ($(date))"
  $BIN calibrate-eqr --model v3 --charts "$input" --memory-gb 14 --out $R/eqr-v3-r$r.json 2>&1 | grep -v "^calibrate-eqr: [0-9]*/[0-9]* " || true
  test -f $R/eqr-v3-r$r.json
  mkdir -p $R/r$r
  echo "=== round $r: charts ($(date))"
  $BIN gen-charts cash --stacks 100 --eqr $R/eqr-v3-r$r.json --out-dir $R/r$r 2>&1 | tail -2
  input=$R/r$r/cash-6max-100bb.json
done
echo "=== final: all depths from round 3 factors ($(date))"
cp $R/eqr-v3-r3.json data/eqr/eqr-v3.json
$BIN gen-charts cash --stacks 20,40,60,100 --iterations 4000000 --samples 1000000 --eqr data/eqr/eqr-v3.json --out-dir data/charts 2>&1 | grep "gen-charts cash:"
echo "=== done ($(date))"
