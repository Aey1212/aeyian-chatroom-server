// SPDX-License-Identifier: AGPL-3.0-or-later

use crate::{
    api::types::CosmeticEntry,
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
use maud::{Markup, PreEscaped, html};

const TH_CLASS: &str = "px-4 py-3 text-left font-semibold text-neutral-600";
const TD_CLASS: &str = "px-4 py-3 align-middle text-neutral-700";
const INPUT_CLASS: &str = "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none";

fn kind_label(kind: &str) -> &'static str {
    match kind {
        "avatar_frame" => "Avatar frame",
        "nameplate" => "Nameplate",
        _ => "Unknown",
    }
}

fn preview(config: &AdminConfig, cosmetic: &CosmeticEntry) -> Markup {
    let animated = if cosmetic.animated {
        "&animated=true"
    } else {
        ""
    };
    let src = format!(
        "{}/cosmetics/{}.webp?size=240{}",
        config.media_endpoint, cosmetic.id, animated
    );
    let class = if cosmetic.kind == "nameplate" {
        "h-12 w-48 rounded object-cover"
    } else {
        "h-16 w-16 rounded-full bg-neutral-200 object-contain"
    };
    html! {
        img src=(src) alt=(cosmetic.name) class=(class) loading="lazy";
    }
}

fn upload_card(action: &str, csrf_token: &str) -> Markup {
    html! {
        (card(html! {
            h3 class="mb-2 text-base font-medium text-neutral-900" { "Upload a cosmetic" }
            p class="mb-4 text-sm text-neutral-500" {
                "PNG, JPEG, WebP, GIF or AVIF up to 2 MiB; animated images stay animated. "
                "An avatar frame should be square with a transparent centre (it is drawn at 1.2× the avatar). "
                "A nameplate should be at least twice as wide as it is tall."
            }
            form id="cosmetic-upload-form" method="post" action={(action) "?action=create&_csrf=" (csrf_token)} class="space-y-4" {
                (csrf_input(csrf_token))
                input type="hidden" name="image" id="cosmetic-image-data" value="";
                div class="grid gap-4 sm:grid-cols-3" {
                    label class="block text-sm" {
                        span class="mb-1 block font-medium text-neutral-700" { "Kind" }
                        select name="kind" class=(INPUT_CLASS) {
                            option value="avatar_frame" { "Avatar frame" }
                            option value="nameplate" { "Nameplate" }
                        }
                    }
                    label class="block text-sm" {
                        span class="mb-1 block font-medium text-neutral-700" { "Name" }
                        input type="text" name="name" required maxlength="32" class=(INPUT_CLASS) placeholder="Golden ring";
                    }
                    label class="block text-sm" {
                        span class="mb-1 block font-medium text-neutral-700" { "Image" }
                        input type="file" id="cosmetic-image-file" required
                            accept="image/png,image/jpeg,image/webp,image/gif,image/avif" class="block w-full text-sm";
                    }
                }
                p id="cosmetic-upload-error" class="hidden text-sm text-red-600" {}
                button type="submit"
                    class="inline-flex h-9 items-center justify-center rounded-lg bg-neutral-900 px-4 text-sm font-medium text-white hover:bg-neutral-800" {
                    "Upload"
                }
            }
            script defer {
                (PreEscaped(r#"
(function() {
	var form = document.getElementById('cosmetic-upload-form');
	var fileInput = document.getElementById('cosmetic-image-file');
	var dataInput = document.getElementById('cosmetic-image-data');
	var errorText = document.getElementById('cosmetic-upload-error');
	var maxBytes = 2 * 1024 * 1024;
	form.addEventListener('submit', function(event) {
		if (dataInput.value) return;
		event.preventDefault();
		var file = fileInput.files && fileInput.files[0];
		if (!file) return;
		if (file.size > maxBytes) {
			errorText.textContent = 'The image is larger than 2 MiB.';
			errorText.classList.remove('hidden');
			return;
		}
		var reader = new FileReader();
		reader.onload = function() {
			dataInput.value = String(reader.result);
			form.submit();
		};
		reader.readAsDataURL(file);
	});
})();
"#))
            }
        }))
    }
}

pub fn cosmetics_page(
    config: &AdminConfig,
    auth: &AuthContext,
    csrf_token: &str,
    cosmetics: &[CosmeticEntry],
    error: Option<&str>,
) -> Markup {
    let action = format!("{}/cosmetics", config.base_path);
    let content = html! {
        (page_header(
            "Cosmetics",
            Some("Avatar frames and nameplates that everyone can pick in their profile settings. The app also has its own built-in set, which is not listed here."),
        ))
        (upload_card(&action, csrf_token))
        (card(html! {
            @if let Some(error) = error {
                p class="text-sm text-red-600" { (error) }
            }
            @if cosmetics.is_empty() && error.is_none() {
                p class="text-sm text-neutral-500" { "Nothing uploaded yet." }
            } @else if !cosmetics.is_empty() {
                div class="overflow-x-auto rounded-lg border border-neutral-200" {
                    table class="min-w-[720px] divide-y divide-neutral-200 text-sm" {
                        thead class="bg-neutral-50" {
                            tr {
                                th scope="col" class=(TH_CLASS) { "Preview" }
                                th scope="col" class=(TH_CLASS) { "Name" }
                                th scope="col" class=(TH_CLASS) { "Kind" }
                                th scope="col" class=(TH_CLASS) { "Uploaded" }
                                th scope="col" class=(TH_CLASS) { "Action" }
                            }
                        }
                        tbody class="divide-y divide-neutral-200 bg-white" {
                            @for cosmetic in cosmetics {
                                tr {
                                    td class=(TD_CLASS) { (preview(config, cosmetic)) }
                                    td class=(TD_CLASS) {
                                        span class="font-medium text-neutral-900" { (cosmetic.name) }
                                        @if cosmetic.animated {
                                            span class="ml-2 rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600" { "animated" }
                                        }
                                        p class="whitespace-nowrap text-xs text-neutral-500" { "ID: " (cosmetic.id) }
                                    }
                                    td class=(TD_CLASS) { (kind_label(&cosmetic.kind)) }
                                    td class={(TD_CLASS) " whitespace-nowrap"} {
                                        (format_admin_timestamp(&cosmetic.created_at))
                                    }
                                    td class=(TD_CLASS) {
                                        form method="post" action={(action) "?action=delete"} {
                                            (csrf_input(csrf_token))
                                            input type="hidden" name="cosmetic_id" value=(cosmetic.id);
                                            button type="submit"
                                                class="inline-flex h-8 items-center justify-center rounded-lg bg-red-600 px-3 text-xs font-medium text-white hover:bg-red-700" {
                                                "Delete"
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
    admin_layout(config, auth, "Cosmetics", "cosmetics", None, content)
}
