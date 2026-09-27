// SPDX-License-Identifier: AGPL-3.0-or-later

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct CosmeticEntry {
    pub id: String,
    pub kind: String,
    pub name: String,
    pub animated: bool,
    pub creator_id: String,
    pub created_at: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct CosmeticsResponse {
    pub cosmetics: Vec<CosmeticEntry>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct CosmeticDeleteResponse {
    pub deleted: bool,
}

#[derive(Clone, Debug, Serialize)]
pub struct CosmeticCreateRequest<'a> {
    pub kind: &'a str,
    pub name: &'a str,
    pub image: &'a str,
}
