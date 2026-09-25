// SPDX-License-Identifier: AGPL-3.0-or-later

pub fn format_user_display(global_name: Option<&str>, username: Option<&str>) -> String {
    match (global_name.filter(|name| !name.trim().is_empty()), username) {
        (Some(gn), Some(un)) => format!("{gn} (@{un})"),
        (Some(gn), None) => gn.to_owned(),
        (None, Some(un)) => format!("@{un}"),
        (None, None) => "Unknown".to_owned(),
    }
}
