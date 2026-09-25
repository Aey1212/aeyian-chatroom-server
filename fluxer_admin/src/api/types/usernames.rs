// SPDX-License-Identifier: AGPL-3.0-or-later

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct UsernameChangeRequestEntry {
    pub user_id: String,
    pub current_username: Option<String>,
    pub requested_username: String,
    pub created_at: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct UsernameChangeRequestsResponse {
    pub requests: Vec<UsernameChangeRequestEntry>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct UsernameDecisionResponse {
    pub applied: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct LockedUsernameEntry {
    pub username: String,
    pub user_id: String,
    pub locked_at: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct LockedUsernamesResponse {
    pub usernames: Vec<LockedUsernameEntry>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct ReleaseUsernameResponse {
    pub released: bool,
}

/// User trait set while a password reset is open for the account (see the API's
/// PASSWORD_RESET_OPEN_TRAIT).
pub const PASSWORD_RESET_OPEN_TRAIT: &str = "password_reset_open";

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct PasswordResetModeResponse {
    pub open: bool,
}
