//! Independent Chip Model (Malmuth–Harville): a player's chance of finishing first is their
//! share of the chips; given who finished first, the rest of the order follows the same rule
//! among the remaining players. A player's $EV is Σ over places of P(place) × prize.
//!
//! Exact by recursion over subsets of still-unplaced players (2ⁿ states), fine for the ≤ 10
//! players of a table.

/// $EV of each player. `stacks` in chips (any unit), `payouts[k]` = prize for place k+1
/// (missing places pay 0). Players with 0 chips have busted: they take the lowest places,
/// sharing those prizes equally if several bust together (a simplification of the real
/// tie-break by starting stack).
pub fn icm_equity(stacks: &[f64], payouts: &[f64]) -> Vec<f64> {
    let n = stacks.len();
    assert!(n <= 16, "ICM supports at most 16 players");
    let alive: Vec<usize> = (0..n).filter(|&i| stacks[i] > 0.0).collect();
    let mut out = vec![0.0; n];
    if alive.is_empty() {
        return out;
    }
    let m = alive.len();
    let busted = n - m;
    if busted > 0 {
        let low: f64 = (m..n)
            .map(|k| payouts.get(k).copied().unwrap_or(0.0))
            .sum::<f64>()
            / busted as f64;
        for i in 0..n {
            if stacks[i] <= 0.0 {
                out[i] = low;
            }
        }
    }
    let full = (1usize << m) - 1;
    // prob[mask] = probability that exactly the players in `mask` are still unplaced after
    // the top (m − |mask|) places have been handed out.
    let mut prob = vec![0.0f64; 1 << m];
    prob[full] = 1.0;
    // Process masks from largest to smallest population.
    let mut order: Vec<usize> = (1..=full).collect();
    order.sort_by_key(|&mask| std::cmp::Reverse(mask.count_ones()));
    for &mask in &order {
        let p = prob[mask];
        if p == 0.0 {
            continue;
        }
        let place = m - mask.count_ones() as usize; // 0-based place being decided
        let total: f64 = (0..m)
            .filter(|&k| mask & (1 << k) != 0)
            .map(|k| stacks[alive[k]])
            .sum();
        for k in 0..m {
            if mask & (1 << k) == 0 {
                continue;
            }
            let pk = p * stacks[alive[k]] / total;
            out[alive[k]] += pk * payouts.get(place).copied().unwrap_or(0.0);
            prob[mask & !(1 << k)] += pk;
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn close(a: &[f64], b: &[f64]) -> bool {
        a.iter().zip(b).all(|(x, y)| (x - y).abs() < 1e-12)
    }

    #[test]
    fn two_players_is_linear_in_chips() {
        // With two players left, P(first) = chip share, so $EV = 2nd + (1st − 2nd)·share.
        let ev = icm_equity(&[3000.0, 1000.0], &[70.0, 30.0]);
        assert!(close(&ev, &[30.0 + 40.0 * 0.75, 30.0 + 40.0 * 0.25]));
    }

    #[test]
    fn equal_stacks_get_equal_shares_and_prizes_are_conserved() {
        let ev = icm_equity(&[1500.0; 4], &[50.0, 30.0, 20.0]);
        assert!(ev.iter().all(|x| (x - 25.0).abs() < 1e-12), "{ev:?}");
        let ev = icm_equity(&[5000.0, 3000.0, 1500.0, 500.0], &[50.0, 30.0, 20.0]);
        assert!((ev.iter().sum::<f64>() - 100.0).abs() < 1e-9);
        // Bigger stacks are worth more, but less than proportionally.
        assert!(ev[0] > ev[1] && ev[1] > ev[2] && ev[2] > ev[3]);
        assert!(ev[0] / 100.0 < 0.5);
    }

    #[test]
    fn three_player_hand_computation() {
        // Stacks 50/30/20, payouts 1st only (winner-take-all): equity = chip share.
        let ev = icm_equity(&[50.0, 30.0, 20.0], &[100.0]);
        assert!(close(&ev, &[50.0, 30.0, 20.0]));
        // Payouts 60/40: P(A 1st)=.5; P(A 2nd) = .3·(50/70) + .2·(50/80) = .339285714…
        let ev = icm_equity(&[50.0, 30.0, 20.0], &[60.0, 40.0]);
        let a = 0.5 * 60.0 + (0.3 * 50.0 / 70.0 + 0.2 * 50.0 / 80.0) * 40.0;
        assert!((ev[0] - a).abs() < 1e-12, "{} vs {a}", ev[0]);
    }

    #[test]
    fn busted_players_take_the_lowest_places() {
        let ev = icm_equity(&[0.0, 100.0, 100.0], &[50.0, 30.0, 20.0]);
        assert_eq!(ev[0], 20.0);
        assert!((ev[1] - 40.0).abs() < 1e-12 && (ev[2] - 40.0).abs() < 1e-12);
        // Two bust together: they share 3rd and 4th.
        let ev = icm_equity(&[0.0, 0.0, 100.0, 300.0], &[50.0, 30.0, 15.0, 5.0]);
        assert_eq!((ev[0], ev[1]), (10.0, 10.0));
        assert!((ev.iter().sum::<f64>() - 100.0).abs() < 1e-12);
    }
}
