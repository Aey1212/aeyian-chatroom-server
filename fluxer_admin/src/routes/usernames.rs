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
    extract::{FromRequest, Query, Request, State},
    response::{Html, IntoResponse, Response},
    routing::get,
};
use serde::Deserialize;

use super::ActionQuery;

#[derive(Deserialize)]
struct UserIdForm {
    #[serde(default)]
    _csrf: Option<String>,
    user_id: String,
}

#[derive(Deserialize)]
struct UsernameForm {
    #[serde(default)]
    _csrf: Option<String>,
    username: String,
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/username-requests",
            get(username_requests_page).post(username_requests_post),
        )
        .route(
            "/locked-usernames",
            get(locked_usernames_page).post(locked_usernames_post),
        )
}

async fn username_requests_page(
    State(state): State<AppState>,
    auth: axum::Extension<AuthContext>,
    csrf: axum::Extension<CsrfToken>,
) -> Response {
    let config = state.config();
    let client = AdminApiClient::new(state.http_client(), config, &auth.0.session);
    let (requests, error) = match client.list_username_change_requests().await {
        Ok(response) => (response.requests, None),
        Err(error) => {
            tracing::warn!(%error, "admin API request failed: list rename requests");
            (Vec::new(), Some("Could not load rename requests"))
        }
    };
    let markup = templates::pages::usernames::username_requests_page(
        config, &auth.0, &csrf.0.0, &requests, error,
    );
    Html(markup.into_string()).into_response()
}

async fn username_requests_post(
    State(state): State<AppState>,
    auth: axum::Extension<AuthContext>,
    Query(query): Query<ActionQuery>,
    request: Request,
) -> Response {
    let config = state.config();
    let redirect = format!("{}/username-requests", config.base_path);
    let secure_cookies = config.secure_cookies();
    let form: UserIdForm = match Form::from_request(request, &state).await {
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
    let (result, done, failed) = match query.action.as_deref() {
        Some("approve") => (
            client.approve_username_change_request(&form.user_id).await,
            "Rename approved",
            "Failed to approve the rename",
        ),
        Some("reject") => (
            client.reject_username_change_request(&form.user_id).await,
            "Rename rejected",
            "Failed to reject the rename",
        ),
        _ => {
            return flash::redirect_with_flash(
                &redirect,
                FlashData::error("Unknown action"),
                secure_cookies,
            );
        }
    };
    let flash = match result {
        Ok(decision) if decision.applied => FlashData::success(done),
        Ok(_) => FlashData::error("That request is no longer pending"),
        Err(error) => {
            tracing::warn!(%error, "admin API request failed: decide rename request");
            FlashData::error(failed)
        }
    };
    flash::redirect_with_flash(&redirect, flash, secure_cookies)
}

async fn locked_usernames_page(
    State(state): State<AppState>,
    auth: axum::Extension<AuthContext>,
    csrf: axum::Extension<CsrfToken>,
) -> Response {
    let config = state.config();
    let client = AdminApiClient::new(state.http_client(), config, &auth.0.session);
    let (usernames, error) = match client.list_locked_usernames().await {
        Ok(response) => (response.usernames, None),
        Err(error) => {
            tracing::warn!(%error, "admin API request failed: list locked usernames");
            (Vec::new(), Some("Could not load locked usernames"))
        }
    };
    let markup = templates::pages::usernames::locked_usernames_page(
        config, &auth.0, &csrf.0.0, &usernames, error,
    );
    Html(markup.into_string()).into_response()
}

async fn locked_usernames_post(
    State(state): State<AppState>,
    auth: axum::Extension<AuthContext>,
    request: Request,
) -> Response {
    let config = state.config();
    let redirect = format!("{}/locked-usernames", config.base_path);
    let secure_cookies = config.secure_cookies();
    let form: UsernameForm = match Form::from_request(request, &state).await {
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
    let flash = match client.release_locked_username(&form.username).await {
        Ok(response) if response.released => {
            FlashData::success(format!("{} can be registered again", form.username))
        }
        Ok(_) => FlashData::error("That name is not locked"),
        Err(error) => {
            tracing::warn!(%error, "admin API request failed: release locked username");
            FlashData::error("Failed to release the name")
        }
    };
    flash::redirect_with_flash(&redirect, flash, secure_cookies)
}
