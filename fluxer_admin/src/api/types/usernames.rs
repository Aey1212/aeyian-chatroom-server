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
