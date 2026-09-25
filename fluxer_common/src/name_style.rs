// SPDX-License-Identifier: AGPL-3.0-or-later

use serde::{Deserialize, Serialize};

/// Font, colors and effect of a display name. The users row stores it as JSON text; the API
/// validates it on write, so this only has to carry it through.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct NameStyle {
    pub font: Option<String>,
    pub effect: String,
    pub primary_color: Option<i32>,
    pub secondary_color: Option<i32>,
}

impl NameStyle {
    /// Reads the stored JSON text. Empty or unreadable values mean the default style.
    pub fn parse_stored(stored: Option<&str>) -> Option<Self> {
        let text = stored?.trim();
        if text.is_empty() {
            return None;
        }
        serde_json::from_str(text).ok()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_stored_json() {
        let style = NameStyle::parse_stored(Some(
            r#"{"font":"bangers","effect":"gradient","primary_color":16711680,"secondary_color":255}"#,
        ))
        .expect("style");
        assert_eq!(style.font.as_deref(), Some("bangers"));
        assert_eq!(style.effect, "gradient");
        assert_eq!(style.primary_color, Some(0xff0000));
        assert_eq!(style.secondary_color, Some(0xff));
    }

    #[test]
    fn empty_or_broken_values_are_the_default_style() {
        assert_eq!(NameStyle::parse_stored(None), None);
        assert_eq!(NameStyle::parse_stored(Some("")), None);
        assert_eq!(NameStyle::parse_stored(Some("{not json")), None);
    }
}
