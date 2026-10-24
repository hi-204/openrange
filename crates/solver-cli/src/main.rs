//! `solver-cli`: batch solving, chart generation and the validation runner.
//!
//! Subcommands grow milestone by milestone (docs/PLAN.md). Argument parsing is kept
//! dependency-free until it becomes non-trivial.

use std::process::ExitCode;

const USAGE: &str = "\
usage: solver-cli <command>

commands:
  version     print the solver-core version
  help        show this message";

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    match args.first().map(String::as_str) {
        Some("version") => {
            println!("solver-core {}", solver_core::VERSION);
            ExitCode::SUCCESS
        }
        None | Some("help" | "--help" | "-h") => {
            println!("{USAGE}");
            ExitCode::SUCCESS
        }
        Some(other) => {
            eprintln!("unknown command: {other}\n\n{USAGE}");
            ExitCode::from(2)
        }
    }
}
