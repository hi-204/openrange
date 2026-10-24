//! Provenance block attached to every generated artifact (docs/ARCHITECTURE.md §6).

use serde_json::{Value, json};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

pub enum Source {
    SolverExact,
    /// Not used until M5 (approximate solver pipelines).
    #[allow(dead_code)]
    SolverApprox,
}

impl Source {
    fn as_str(&self) -> &'static str {
        match self {
            Source::SolverExact => "solver_exact",
            Source::SolverApprox => "solver_approx",
        }
    }
}

fn git(args: &[&str]) -> Option<String> {
    let out = Command::new("git").args(args).output().ok()?;
    out.status
        .success()
        .then(|| String::from_utf8_lossy(&out.stdout).trim().to_string())
}

/// Short commit hash, with " (uncommitted changes)" when the working tree is dirty.
pub fn git_commit_label() -> String {
    let commit = git(&["rev-parse", "--short=12", "HEAD"]).unwrap_or_else(|| "unknown".into());
    match git(&["status", "--porcelain"]) {
        Some(s) if !s.is_empty() => format!("{commit} (uncommitted changes)"),
        _ => commit,
    }
}

/// Current UTC time as `YYYY-MM-DDTHH:MM:SSZ` (civil-from-days, H. Hinnant's algorithm).
pub fn utc_now() -> String {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |d| d.as_secs()) as i64;
    let (days, rem) = (secs.div_euclid(86_400), secs.rem_euclid(86_400));
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = yoe + era * 400 + i64::from(m <= 2);
    format!(
        "{y:04}-{m:02}-{d:02}T{:02}:{:02}:{:02}Z",
        rem / 3600,
        rem % 3600 / 60,
        rem % 60
    )
}

/// Build the provenance object. `solver` and `model` are `null` for non-CFR artifacts.
pub fn provenance(source: Source, generator: &str, solver: Value, notes: &str) -> Value {
    let commit = git(&["rev-parse", "--short=12", "HEAD"]).unwrap_or_else(|| "unknown".into());
    let dirty = git(&["status", "--porcelain"]).map(|s| !s.is_empty());
    json!({
        "schema": "openrange.provenance/1",
        "source": source.as_str(),
        "generator": generator,
        "solverCoreVersion": solver_core::VERSION,
        "solver": solver,
        "model": null,
        "abstraction": null,
        "seed": null,
        "generatedAt": utc_now(),
        "gitCommit": commit,
        "gitDirty": dirty,
        "notes": notes,
    })
}

#[cfg(test)]
mod tests {
    #[test]
    fn utc_now_has_iso_shape() {
        let s = super::utc_now();
        assert_eq!(s.len(), 20);
        assert!(s.starts_with("20") && s.ends_with('Z'));
    }
}
