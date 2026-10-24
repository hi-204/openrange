//! `solver-cli`: batch solving, chart generation and the validation runner.
//!
//! Subcommands grow milestone by milestone (docs/PLAN.md). Argument parsing is kept
//! dependency-free until it becomes non-trivial.

mod gen_equity;
mod provenance;

use std::process::ExitCode;

const USAGE: &str = "\
usage: solver-cli <command> [options]

commands:
  version                      print the solver-core version
  gen-equity [--out <file>]    exact 169x169 preflop equity table
                               (default: data/equity/preflop-169.json)
  help                         show this message";

/// Value following `--name`, if present.
fn opt<'a>(args: &'a [String], name: &str) -> Option<&'a str> {
    args.iter()
        .position(|a| a == name)
        .and_then(|i| args.get(i + 1))
        .map(String::as_str)
}

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let result = match args.first().map(String::as_str) {
        Some("version") => {
            println!("solver-core {}", solver_core::VERSION);
            Ok(())
        }
        Some("gen-equity") => {
            gen_equity::run(opt(&args, "--out").unwrap_or("data/equity/preflop-169.json"))
        }
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
