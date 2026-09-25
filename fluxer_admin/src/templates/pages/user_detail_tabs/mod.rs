// SPDX-License-Identifier: AGPL-3.0-or-later

use crate::api::types::AdminResolvedUser;

pub mod account;
pub mod applications;
pub mod archives;
pub mod dm_history;
pub mod group_dm;
pub mod guilds;
pub mod moderation;
pub mod overview;
pub mod relationships;
pub mod reports;
pub mod settings;

pub(super) fn resolved_user_display(user: &AdminResolvedUser) -> String {
    match &user.global_name {
        Some(gn) if !gn.trim().is_empty() => format!("{} ({})", gn, user.username),
        _ => user.username.clone(),
    }
}
