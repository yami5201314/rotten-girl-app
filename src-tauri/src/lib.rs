mod api;
mod media;
mod net;

use tauri::Manager;
use url::Url;

/// 品牌即配置：站点地址由 build.rs 在构建时嵌入（见 build.rs 取值优先级）。
fn site_origin() -> Url {
    Url::parse(env!("RG_SITE_ORIGIN")).expect("siteOrigin 不是合法 URL")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let cookie_file = app.path().app_data_dir()?.join("cookies.json");
            app.manage(net::Net::new(site_origin(), cookie_file)?);
            Ok(())
        })
        .register_asynchronous_uri_scheme_protocol(media::SCHEME, media::handle)
        .invoke_handler(tauri::generate_handler![api::api_request])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
