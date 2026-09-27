// SPDX-License-Identifier: AGPL-3.0-or-later

use crate::{
    api::client::AdminApiClient,
    middleware::{
        auth::AuthContext,
        csrf::CsrfToken,
        flash::{self, FlashData},
    },
    state::AppState,
    templates,
};
use axum::{
    Form, Router,
    extract::{DefaultBodyLimit, FromRequest, Query, Request, State},
    response::{Html, IntoResponse, Response},
    routing::get,
};
use serde::Deserialize;

use super::ActionQuery;

// A 2 MiB image is about 2.8 MB once base64-encoded, plus the other form fields.
const UPLOAD_BODY_LIMIT: usize = 4 * 1024 * 1024;

#[derive(Deserialize)]
struct CosmeticForm {
    #[serde(default)]
    _csrf: Option<String>,
    #[serde(default)]
    kind: Option<String>,
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    image: Option<String>,
    #[serde(default)]
    cosmetic_id: Option<String>,
}

pub fn router() -> Router<AppState> {
    Router::new().route(
        "/cosmetics",
        get(cosmetics_page)
            .post(cosmetics_post)
            .layer(DefaultBodyLimit::max(UPLOAD_BODY_LIMIT)),
    )
}

async fn cosmetics_page(
    State(state): State<AppState>,
    auth: axum::Extension<AuthContext>,
    csrf: axum::Extension<CsrfToken>,
) -> Response {
    let config = state.config();
    let client = AdminApiClient::new(state.http_client(), config, &auth.0.session);
    let (cosmetics, error) = match client.list_cosmetics().await {
        Ok(response) => (response.cosmetics, None),
        Err(error) => {
            tracing::warn!(%error, "admin API request failed: list cosmetics");
            (Vec::new(), Some("Could not load cosmetics"))
        }
    };
    let markup =
        templates::pages::cosmetics::cosmetics_page(config, &auth.0, &csrf.0.0, &cosmetics, error);
    Html(markup.into_string()).into_response()
}

async fn cosmetics_post(
    State(state): State<AppState>,
    auth: axum::Extension<AuthContext>,
    Query(query): Query<ActionQuery>,
    request: Request,
) -> Response {
    let config = state.config();
    let redirect = format!("{}/cosmetics", config.base_path);
    let secure_cookies = config.secure_cookies();
    let form: CosmeticForm = match Form::from_request(request, &state).await {
        Ok(Form(form)) => form,
        Err(_) => {
            return flash::redirect_with_flash(
                &redirect,
                FlashData::error("Invalid form data"),
                secure_cookies,
            );
        }
    };
    let client = AdminApiClient::new(state.http_client(), config, &auth.0.session);
    let flash = match query.action.as_deref() {
        Some("create") => {
            let (Some(kind), Some(name), Some(image)) = (&form.kind, &form.name, &form.image)
            else {
                return flash::redirect_with_flash(
                    &redirect,
                    FlashData::error("Pick a kind, a name and an image"),
                    secure_cookies,
                );
            };
            match client.create_cosmetic(kind, name.trim(), image).await {
                Ok(created) => FlashData::success(format!("Uploaded {}", created.name)),
                Err(error) => {
                    tracing::warn!(%error, "admin API request failed: create cosmetic");
                    FlashData::error(format!("Upload failed: {error}"))
                }
            }
        }
        Some("delete") => {
            let Some(cosmetic_id) = &form.cosmetic_id else {
                return flash::redirect_with_flash(
                    &redirect,
                    FlashData::error("Invalid form data"),
                    secure_cookies,
                );
            };
            match client.delete_cosmetic(cosmetic_id).await {
                Ok(response) if response.deleted => FlashData::success("Cosmetic deleted"),
                Ok(_) => FlashData::error("That cosmetic no longer exists"),
                Err(error) => {
                    tracing::warn!(%error, "admin API request failed: delete cosmetic");
                    FlashData::error("Failed to delete the cosmetic")
                }
            }
        }
        _ => FlashData::error("Unknown action"),
    };
    flash::redirect_with_flash(&redirect, flash, secure_cookies)
}
