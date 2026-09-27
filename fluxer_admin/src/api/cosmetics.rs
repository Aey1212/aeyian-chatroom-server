// SPDX-License-Identifier: AGPL-3.0-or-later

use super::client::{AdminApiClient, ApiResult};
use super::types::{
    CosmeticCreateRequest, CosmeticDeleteResponse, CosmeticEntry, CosmeticsResponse,
};

impl AdminApiClient {
    pub async fn list_cosmetics(&self) -> ApiResult<CosmeticsResponse> {
        self.get("/admin/cosmetics", None).await
    }

    pub async fn create_cosmetic(
        &self,
        kind: &str,
        name: &str,
        image: &str,
    ) -> ApiResult<CosmeticEntry> {
        self.post_typed(
            "/admin/cosmetics",
            &CosmeticCreateRequest { kind, name, image },
        )
        .await
    }

    pub async fn delete_cosmetic(&self, cosmetic_id: &str) -> ApiResult<CosmeticDeleteResponse> {
        self.delete_with_reason(&format!("/admin/cosmetics/{cosmetic_id}"), None, None)
            .await
    }
}
