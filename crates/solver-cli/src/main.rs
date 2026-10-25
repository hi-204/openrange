//! `solver-cli`: batch solving, chart generation and the validation runner.
//!
//! Subcommands grow milestone by milestone (docs/PLAN.md). Argument parsing is kept
//! dependency-free until it becomes non-trivial.

mod calibrate_eqr;
mod gen_charts;
mod gen_equity;
mod goldens;
mod provenance;
mod solve;
mod validate;

use std::process::ExitCode;

const USAGE: &str = "\
usage: solver-cli <command> [options]

commands:
  version                      print the solver-core version
  solve <spot.json> [--iterations N] [--target PCT]
                               solve a spot (default 1000 iterations or 0.1% of pot)
  gen-equity [--out <file>]    exact 169x169 preflop equity table
                               (default: data/equity/preflop-169.json)
  gen-goldens [--out <file>]   regression goldens (default: data/goldens/river.json)
  gen-charts pushfold-hu [--stacks 2,3,...]
  gen-charts pushfold-multi --players N [--stacks 5,10] [--iterations N] [--samples N]
  gen-charts cash [--stacks 100] [--iterations N] [--samples N] [--eqr data/eqr/eqr-v2.json]
                               preflop chart files in data/charts/
  calibrate-eqr [--charts <cash chart file>] [--flops 60] [--raises 0] [--target 1]
                               measure equity realization from postflop solves
                               (default output: data/eqr/eqr-v2.json)
  validate [--quick] [--out <file>]
                               run the validation suite and write the report
                               (default: docs/VALIDATION.md)
  help                         show this message";

/// Value following `--name`, if present.
fn opt<'a>(args: &'a [String], name: &str) -> Option<&'a str> {
    args.iter()
        .position(|a| a == name)
        .and_then(|i| args.get(i + 1))
        .map(String::as_str)
}

fn number<T: std::str::FromStr>(args: &[String], name: &str, default: T) -> Result<T, String> {
    match opt(args, name) {
        None => Ok(default),
        Some(v) => v
            .parse()
            .map_err(|_| format!("{name}: '{v}' is not a number")),
    }
}

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let result = match args.first().map(String::as_str) {
        Some("version") => {
            println!("solver-core {}", solver_core::VERSION);
            Ok(())
        }
        Some("solve") => match args.get(1) {
            None => Err(format!("solve needs a spot file\n\n{USAGE}")),
            Some(path) => number(&args, "--iterations", 1000u32).and_then(|it| {
                number(&args, "--target", 0.1f64).and_then(|target| solve::run(path, it, target))
            }),
        },
        Some("gen-equity") => {
            gen_equity::run(opt(&args, "--out").unwrap_or("data/equity/preflop-169.json"))
        }
        Some("gen-charts") => gen_charts_cmd(&args),
        Some("calibrate-eqr") => (|| {
            calibrate_eqr::run(
                opt(&args, "--charts").unwrap_or("data/charts/cash-6max-100bb.json"),
                number(&args, "--flops", 60usize)?,
                number(&args, "--raises", 0u8)?,
                number(&args, "--target", 1.0f64)?,
                number(&args, "--max-iterations", 400u32)?,
                number(&args, "--memory-gb", 24.0f64)?,
                number(&args, "--seed", 2026u64)?,
                opt(&args, "--out").unwrap_or(calibrate_eqr::OUT),
            )
        })(),
        Some("gen-goldens") => goldens::run(opt(&args, "--out").unwrap_or(goldens::PATH)),
        Some("validate") => validate::run(
            args.iter().any(|a| a == "--quick"),
            opt(&args, "--out").unwrap_or("docs/VALIDATION.md"),
        ),
        None | Some("help" | "--help" | "-h") => {
            println!("{USAGE}");
            Ok(())
        }
        Some(other) => Err(format!("unknown command: {other}\n\n{USAGE}")),
    };
    match result {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            eprintln!("solver-cli: {e}");
            ExitCode::FAILURE
        }
    }
}

fn list(args: &[String], name: &str, default: &[f64]) -> Result<Vec<f64>, String> {
    match opt(args, name) {
        None => Ok(default.to_vec()),
        Some(v) => v
            .split(',')
            .map(|x| {
                x.trim()
                    .parse::<f64>()
                    .map_err(|_| format!("{name}: '{x}' is not a number"))
            })
            .collect(),
    }
}

fn gen_charts_cmd(args: &[String]) -> Result<(), String> {
    let seed = number(args, "--seed", 2026u64)?;
    match args.get(1).map(String::as_str) {
        Some("pushfold-hu") => {
            let default: Vec<f64> = (2..=25).map(f64::from).collect();
            gen_charts::pushfold_hu(
                "data/charts/pushfold-hu.json",
                &list(args, "--stacks", &default)?,
            )
        }
        Some("pushfold-multi") => {
            let players = number(args, "--players", 6usize)?;
            gen_charts::pushfold_multi(
                &format!("data/charts/pushfold-{players}max.json"),
                players,
                &list(args, "--stacks", &[5.0, 10.0, 15.0, 20.0])?,
                number(args, "--iterations", 2_000_000u64)?,
                number(args, "--samples", 2_000_000u64)?,
                seed,
            )
        }
        Some("cash") => gen_charts::cash_family(
            "data/charts",
            &list(args, "--stacks", &[100.0])?,
            number(args, "--iterations", 2_000_000u64)?,
            number(args, "--samples", 2_000_000u64)?,
            seed,
            opt(args, "--eqr"),
        ),
        _ => Err(format!(
            "gen-charts needs a family: pushfold-hu, pushfold-multi or cash

{USAGE}"
        )),
    }
}
