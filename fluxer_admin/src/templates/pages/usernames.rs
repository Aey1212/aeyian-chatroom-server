// SPDX-License-Identifier: AGPL-3.0-or-later

use crate::{
    api::types::{LockedUsernameEntry, UsernameChangeRequestEntry},
    config::AdminConfig,
    middleware::auth::AuthContext,
    templates::{
        components::{
            form::csrf_input,
            page_container::{card, page_header},
        },
        layout::admin_layout,
    },
    utils::timestamps::format_admin_timestamp,
};
use maud::{Markup, html};

const TH_CLASS: &str = "px-4 py-3 text-left font-semibold text-neutral-600";
const TD_CLASS: &str = "px-4 py-3 align-top text-neutral-700";

fn row_button(label: &str, danger: bool) -> Markup {
    let variant_class = if danger {
        "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500/30"
    } else {
        "bg-neutral-900 text-white hover:bg-neutral-800 focus:ring-brand-primary/20"
    };
    html! {
        button type="submit"
            class={"inline-flex h-8 shrink-0 items-center justify-center rounded-lg px-3 text-xs font-medium transition-all focus:outline-none focus:ring-2 " (variant_class)} {
            (label)
        }
    }
}

fn load_error(error: Option<&str>) -> Markup {
    html! {
        @if let Some(error) = error {
            p class="text-sm text-red-600" { (error) }
        }
    }
}

pub fn username_requests_page(
    config: &AdminConfig,
    auth: &AuthContext,
    csrf_token: &str,
    requests: &[UsernameChangeRequestEntry],
    error: Option<&str>,
) -> Markup {
    let base = &config.base_path;
    let action = format!("{base}/username-requests");
    let content = html! {
        (page_header(
            "Rename Requests",
            Some("People ask for a new username; the name is held for them until you approve or reject the request."),
        ))
        (card(html! {
            (load_error(error))
            @if requests.is_empty() && error.is_none() {
                p class="text-sm text-neutral-500" { "No pending rename requests." }
            } @else if !requests.is_empty() {
                div class="overflow-x-auto rounded-lg border border-neutral-200" {
                    table class="min-w-[720px] divide-y divide-neutral-200 text-sm" {
                        thead class="bg-neutral-50" {
                            tr {
                                th scope="col" class=(TH_CLASS) { "Account" }
                                th scope="col" class=(TH_CLASS) { "Requested name" }
                                th scope="col" class=(TH_CLASS) { "Asked" }
                                th scope="col" class=(TH_CLASS) { "Decision" }
                            }
                        }
                        tbody class="divide-y divide-neutral-200 bg-white" {
                            @for request in requests {
                                tr {
                                    td class=(TD_CLASS) {
                                        a href={(base) "/users/" (request.user_id)}
                                            class="font-medium text-blue-600 hover:underline" {
                                            (request.current_username.as_deref().unwrap_or("(account gone)"))
                                        }
                                        p class="whitespace-nowrap text-xs text-neutral-500" { "ID: " (request.user_id) }
                                    }
                                    td class=(TD_CLASS) {
                                        span class="font-medium text-neutral-900" { (request.requested_username) }
                                    }
                                    td class={(TD_CLASS) " whitespace-nowrap"} {
                                        (format_admin_timestamp(&request.created_at))
                                    }
                                    td class="px-4 py-3 align-top" {
                                        div class="flex flex-nowrap gap-2" {
                                            form method="post" action={(action) "?action=approve"} {
                                                (csrf_input(csrf_token))
                                                input type="hidden" name="user_id" value=(request.user_id);
                                                (row_button("Approve", false))
                                            }
                                            form method="post" action={(action) "?action=reject"} {
                                                (csrf_input(csrf_token))
                                                input type="hidden" name="user_id" value=(request.user_id);
                                                (row_button("Reject", true))
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }))
    };
    admin_layout(
        config,
        auth,
        "Rename Requests",
        "username-requests",
        None,
        content,
    )
}

pub fn locked_usernames_page(
    config: &AdminConfig,
    auth: &AuthContext,
    csrf_token: &str,
    usernames: &[LockedUsernameEntry],
    error: Option<&str>,
) -> Markup {
    let base = &config.base_path;
    let content = html! {
        (page_header(
            "Locked Usernames",
            Some("Names that deleted or renamed accounts left behind. Nobody can register a locked name until you release it."),
        ))
        (card(html! {
            (load_error(error))
            @if usernames.is_empty() && error.is_none() {
                p class="text-sm text-neutral-500" { "No locked usernames." }
            } @else if !usernames.is_empty() {
                div class="overflow-x-auto rounded-lg border border-neutral-200" {
                    table class="min-w-[640px] divide-y divide-neutral-200 text-sm" {
                        thead class="bg-neutral-50" {
                            tr {
                                th scope="col" class=(TH_CLASS) { "Username" }
                                th scope="col" class=(TH_CLASS) { "Held by account" }
                                th scope="col" class=(TH_CLASS) { "Locked" }
                                th scope="col" class=(TH_CLASS) { "Action" }
                            }
                        }
                        tbody class="divide-y divide-neutral-200 bg-white" {
                            @for entry in usernames {
                                tr {
                                    td class=(TD_CLASS) {
                                        span class="font-medium text-neutral-900" { (entry.username) }
                                    }
                                    td class={(TD_CLASS) " whitespace-nowrap"} {
                                        a href={(base) "/users/" (entry.user_id)}
                                            class="text-blue-600 hover:underline" { (entry.user_id) }
                                    }
                                    td class={(TD_CLASS) " whitespace-nowrap"} {
                                        (format_admin_timestamp(&entry.locked_at))
                                    }
                                    td class="px-4 py-3 align-top" {
                                        form method="post" action={(base) "/locked-usernames"} {
                                            (csrf_input(csrf_token))
                                            input type="hidden" name="username" value=(entry.username);
                                            (row_button("Release", true))
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }))
    };
    admin_layout(
        config,
        auth,
        "Locked Usernames",
        "locked-usernames",
        None,
        content,
    )
}
