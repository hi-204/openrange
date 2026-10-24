//! `solver-cli`: batch solving, chart generation and the validation runner.
//!
//! Subcommands grow milestone by milestone (docs/PLAN.md). Argument parsing is kept
//! dependency-free until it becomes non-trivial.

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
