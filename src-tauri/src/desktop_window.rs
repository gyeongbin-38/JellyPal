/// Place the store card inside the usable desktop, in physical coordinates.
/// Window dimensions stay logical so Retina density does not shrink the UI.
pub fn card_placement(work: [i32; 4], scale: f64) -> ([f64; 2], [i32; 2]) {
    let scale = if scale.is_finite() && scale > 0.0 {
        scale
    } else {
        1.0
    };
    let margin = 16.0;
    let width = 480.0_f64.min((work[2] as f64 / scale - margin * 2.0).max(1.0));
    let height = 560.0_f64.min((work[3] as f64 / scale - margin * 2.0).max(1.0));
    let x = work[0] + ((work[2] as f64 - width * scale) / 2.0).round() as i32;
    let y = work[1] + ((work[3] as f64 - height * scale) / 2.0).round() as i32;
    ([width, height], [x, y])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fits_small_and_retina_work_areas_including_negative_origins() {
        for (work, scale) in [
            ([0, 25, 1280, 700], 1.0),
            ([0, 50, 2560, 1500], 2.0),
            ([-1920, -1080, 1920, 1000], 1.0),
            ([0, 24, 800, 516], 1.0),
            ([0, 50, 2048, 1050], 2.0),
        ] {
            let (size, pos) = card_placement(work, scale);
            assert!(size[0] <= 480.0 && size[1] <= 560.0);
            assert!(pos[0] >= work[0] && pos[1] >= work[1]);
            assert!(pos[0] as f64 + size[0] * scale <= (work[0] + work[2]) as f64);
            assert!(pos[1] as f64 + size[1] * scale <= (work[1] + work[3]) as f64);
        }
    }

    #[test]
    fn retina_keeps_the_same_logical_card_size() {
        assert_eq!(card_placement([0, 50, 2560, 1500], 2.0).0, [480.0, 560.0]);
        assert_eq!(card_placement([0, 25, 1280, 750], 1.0).0, [480.0, 560.0]);
    }
}
