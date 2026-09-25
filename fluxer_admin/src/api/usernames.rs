// SPDX-License-Identifier: AGPL-3.0-or-later

use crate::api::generated::{snowflake, types as generated_types};

use super::client::{AdminApiClient, ApiResult};
use super::types::{
    LockedUsernamesResponse, PasswordResetModeResponse, ReleaseUsernameResponse,
    UsernameChangeRequestsResponse, UsernameDecisionResponse,
};

impl AdminApiClient {
    pub async fn list_username_change_requests(&self) -> ApiResult<UsernameChangeRequestsResponse> {
        let response = self
            .generated()
            .list_admin_username_change_requests()
            .await
            .map_err(|e| self.generated_error(e))?;
        self.generated_value(response.into_inner())
    }

    pub async fn approve_username_change_request(
        &self,
        user_id: &str,
    ) -> ApiResult<UsernameDecisionResponse> {
        let response = self
            .generated()
            .approve_admin_username_change_request(&snowflake(user_id))
            .await
            .map_err(|e| self.generated_error(e))?;
        self.generated_value(response.into_inner())
    }

    pub async fn reject_username_change_request(
        &self,
        user_id: &str,
    ) -> ApiResult<UsernameDecisionResponse> {
        let response = self
            .generated()
            .reject_admin_username_change_request(&snowflake(user_id))
            .await
            .map_err(|e| self.generated_error(e))?;
        self.generated_value(response.into_inner())
    }

    pub async fn list_locked_usernames(&self) -> ApiResult<LockedUsernamesResponse> {
        let response = self
            .generated()
            .list_admin_locked_usernames()
            .await
            .map_err(|e| self.generated_error(e))?;
        self.generated_value(response.into_inner())
    }

    pub async fn release_locked_username(
        &self,
        username: &str,
    ) -> ApiResult<ReleaseUsernameResponse> {
        let username = generated_types::UsernameLookupType(username.to_owned());
        let response = self
            .generated()
            .release_admin_locked_username(&username)
            .await
            .map_err(|e| self.generated_error(e))?;
        self.generated_value(response.into_inner())
    }

    pub async fn set_password_reset_mode(
        &self,
        user_id: &str,
        open: bool,
    ) -> ApiResult<PasswordResetModeResponse> {
        let body = generated_types::AdminPasswordResetModeRequest { open };
        let response = self
            .generated()
            .set_admin_user_password_reset_mode(&snowflake(user_id), &body)
            .await
            .map_err(|e| self.generated_error(e))?;
        self.generated_value(response.into_inner())
    }
}
