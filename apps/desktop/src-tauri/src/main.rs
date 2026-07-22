// Justice desktop shell (Phase 11). A native window over the Justice web
// app — deliberately a THIN shell: Supabase auth (SSR cookies) and every
// secret-bearing call live on the server, so nothing sensitive ships in
// this binary and web/desktop/mobile stay in lockstep.
//
// The app URL is fixed at compile time:
//   JUSTICE_APP_URL=https://app.justice.com npm run build
// Debug builds default to the local web dev server.
#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use tauri::{WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_opener::OpenerExt;

const DEV_URL: &str = "http://localhost:3000";
const PROD_URL_PLACEHOLDER: &str = "https://app.justice.example";

fn app_url() -> &'static str {
    if let Some(url) = option_env!("JUSTICE_APP_URL") {
        return url;
    }
    if cfg!(debug_assertions) {
        DEV_URL
    } else {
        PROD_URL_PLACEHOLDER
    }
}

fn main() {
    let url = tauri::Url::parse(app_url()).expect("JUSTICE_APP_URL must be a valid URL");
    let app_origin = url.origin();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(move |app| {
            let handle = app.handle().clone();
            let origin = app_origin.clone();

            WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url.clone()))
                .title("Justice")
                .inner_size(1280.0, 840.0)
                .min_inner_size(980.0, 640.0)
                .center()
                // Keep the shell on the app's origin; everything else —
                // "Verify source" citations, exports opened in tabs — goes
                // to the system browser where it belongs.
                .on_navigation(move |nav| {
                    if nav.origin() == origin || nav.scheme() == "about" {
                        return true;
                    }
                    let _ = handle.opener().open_url(nav.to_string(), None::<&str>);
                    false
                })
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Justice desktop");
}
