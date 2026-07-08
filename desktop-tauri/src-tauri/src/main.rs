use std::{
    net::{TcpListener, TcpStream},
    sync::Mutex,
    thread,
    time::{Duration, Instant},
};

use tauri::{Manager, RunEvent};
use tauri_plugin_shell::{process::CommandChild, ShellExt};

struct BackendProcess(Mutex<Option<CommandChild>>);

fn reserve_local_port() -> Result<u16, Box<dyn std::error::Error>> {
    let listener = TcpListener::bind(("127.0.0.1", 0))?;
    Ok(listener.local_addr()?.port())
}

fn copy_directory(source: &std::path::Path, destination: &std::path::Path) -> std::io::Result<()> {
    std::fs::create_dir_all(destination)?;
    for entry in std::fs::read_dir(source)? {
        let entry = entry?;
        let source_path = entry.path();
        let destination_path = destination.join(entry.file_name());
        if entry.file_type()?.is_dir() {
            copy_directory(&source_path, &destination_path)?;
        } else if !destination_path.exists() {
            std::fs::copy(source_path, destination_path)?;
        }
    }
    Ok(())
}

fn migrate_legacy_storage(
    app: &tauri::App,
    storage_root: &std::path::Path,
) -> Result<(), Box<dyn std::error::Error>> {
    if storage_root.join("facturador.sqlite").exists()
        || storage_root.join("facturador-data.json").exists()
    {
        return Ok(());
    }

    let app_data = app.path().app_data_dir()?;
    let Some(roaming_root) = app_data.parent() else {
        return Ok(());
    };
    let legacy_storage = roaming_root.join("DGII-ECF-Desktop").join("storage");
    if legacy_storage.is_dir() {
        copy_directory(&legacy_storage, storage_root)?;
    }
    Ok(())
}

fn main() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_shell::init())
        .manage(BackendProcess(Mutex::new(None)))
        .setup(|app| {
            let port = reserve_local_port()?;
            let storage_override = std::env::var_os("DGII_ECF_STORAGE_ROOT");
            let storage_root = storage_override
                .clone()
                .map(std::path::PathBuf::from)
                .unwrap_or(app.path().app_data_dir()?.join("storage"));
            std::fs::create_dir_all(&storage_root)?;
            if storage_override.is_none() {
                migrate_legacy_storage(app, &storage_root)?;
            }

            let (mut events, child) = app
                .shell()
                .sidecar("ecf-service")?
                .env("PORT", port.to_string())
                .env("HOST", "127.0.0.1")
                .env("PUBLIC_BASE_URL", format!("http://127.0.0.1:{port}"))
                .env("STORAGE_ROOT", storage_root)
                .env("GENERATE_DEMO_CERT", "true")
                .spawn()?;

            app.state::<BackendProcess>()
                .0
                .lock()
                .expect("backend process lock")
                .replace(child);

            tauri::async_runtime::spawn(async move { while events.recv().await.is_some() {} });

            let app_handle = app.handle().clone();
            thread::spawn(move || {
                let deadline = Instant::now() + Duration::from_secs(30);
                while Instant::now() < deadline {
                    if TcpStream::connect(("127.0.0.1", port)).is_ok() {
                        if let Some(window) = app_handle.get_webview_window("main") {
                            if let Ok(url) = format!("http://127.0.0.1:{port}/").parse() {
                                let _ = window.navigate(url);
                            }
                        }
                        return;
                    }
                    thread::sleep(Duration::from_millis(150));
                }
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("no se pudo construir la aplicacion Tauri");

    app.run(|app_handle, event| {
        if matches!(event, RunEvent::Exit | RunEvent::ExitRequested { .. }) {
            if let Some(child) = app_handle
                .state::<BackendProcess>()
                .0
                .lock()
                .expect("backend process lock")
                .take()
            {
                let _ = child.kill();
            }
        }
    });
}
