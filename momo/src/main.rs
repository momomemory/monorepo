use clap::Parser;
use std::process::Stdio;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[derive(Parser)]
#[command(name = "momo")]
#[command(about = "Open-source, self-hostable AI memory system")]
struct Args {
    /// Force rebuild embeddings when dimension mismatch detected
    #[arg(long)]
    rebuild_embeddings: bool,

    /// Runtime mode: all, api, or worker
    #[arg(long)]
    mode: Option<String>,

    /// Run API and workers in one process when mode=all
    #[arg(long)]
    single_process: bool,
}

use momo::api::create_router;
use momo::config::Config;
use momo::core::{MomoCore, ReadReplicaConfig, WorkerOptions};
use momo::migration::DimensionMismatchPolicy;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum RuntimeMode {
    All,
    Api,
    Worker,
}

impl RuntimeMode {
    fn parse(raw: Option<&str>) -> Self {
        let value = raw
            .map(std::string::ToString::to_string)
            .or_else(|| std::env::var("MOMO_RUNTIME_MODE").ok())
            .map(|v| v.trim().to_lowercase());

        match value.as_deref() {
            Some("api") => Self::Api,
            Some("worker") => Self::Worker,
            Some("all") | None => Self::All,
            Some(other) => {
                tracing::warn!(
                    value = %other,
                    "Invalid MOMO_RUNTIME_MODE/--mode; falling back to 'all'"
                );
                Self::All
            }
        }
    }

    fn runs_api(self) -> bool {
        matches!(self, Self::All | Self::Api)
    }

    fn runs_worker(self) -> bool {
        matches!(self, Self::All | Self::Worker)
    }

    fn as_str(self) -> &'static str {
        match self {
            Self::All => "all",
            Self::Api => "api",
            Self::Worker => "worker",
        }
    }
}

#[derive(Debug, Clone)]
struct ReadReplicaSettings {
    database: momo::config::DatabaseConfig,
    sync_interval_secs: u64,
}

fn parse_env_u64(name: &str, default: u64) -> u64 {
    match std::env::var(name) {
        Ok(raw) => match raw.parse::<u64>() {
            Ok(value) => value,
            Err(error) => {
                tracing::warn!(
                    variable = name,
                    value = %raw,
                    error = %error,
                    "Invalid numeric env value; using default"
                );
                default
            }
        },
        Err(_) => default,
    }
}

fn parse_env_bool(name: &str, default: bool) -> bool {
    match std::env::var(name) {
        Ok(raw) => match raw.trim().to_lowercase().as_str() {
            "1" | "true" | "yes" | "on" => true,
            "0" | "false" | "no" | "off" => false,
            _ => {
                tracing::warn!(
                    variable = name,
                    value = %raw,
                    "Invalid boolean env value; using default"
                );
                default
            }
        },
        Err(_) => default,
    }
}

fn should_supervise_subprocesses(runtime_mode: RuntimeMode, single_process: bool) -> bool {
    matches!(runtime_mode, RuntimeMode::All) && !single_process
}

fn read_replica_settings(
    write_config: &momo::config::DatabaseConfig,
) -> Option<ReadReplicaSettings> {
    let read_url = std::env::var("DATABASE_READ_URL").ok();
    let read_auth_token = std::env::var("DATABASE_READ_AUTH_TOKEN").ok();
    let read_local_path = std::env::var("DATABASE_READ_LOCAL_PATH").ok();
    let sync_interval_secs = parse_env_u64("DATABASE_READ_SYNC_INTERVAL_SECS", 2).max(1);

    build_read_replica_settings(
        write_config,
        read_url,
        read_auth_token,
        read_local_path,
        sync_interval_secs,
    )
}

fn build_read_replica_settings(
    write_config: &momo::config::DatabaseConfig,
    read_url: Option<String>,
    read_auth_token: Option<String>,
    read_local_path: Option<String>,
    sync_interval_secs: u64,
) -> Option<ReadReplicaSettings> {
    if read_url.is_none() && read_auth_token.is_none() && read_local_path.is_none() {
        return None;
    }

    Some(ReadReplicaSettings {
        database: momo::config::DatabaseConfig {
            url: read_url.unwrap_or_else(|| write_config.url.clone()),
            auth_token: read_auth_token.or_else(|| write_config.auth_token.clone()),
            local_path: read_local_path.or_else(|| write_config.local_path.clone()),
        },
        sync_interval_secs,
    })
}

fn build_child_command(
    executable: &std::path::Path,
    mode: RuntimeMode,
    args: &Args,
) -> tokio::process::Command {
    let mut command = tokio::process::Command::new(executable);
    command
        .arg("--mode")
        .arg(mode.as_str())
        .stdin(Stdio::null())
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .kill_on_drop(true);

    if args.rebuild_embeddings {
        command.arg("--rebuild-embeddings");
    }

    command
}

async fn terminate_child(name: &str, child: &mut tokio::process::Child) {
    match child.try_wait() {
        Ok(Some(status)) => {
            tracing::info!(process = name, %status, "Subprocess already exited");
            return;
        }
        Ok(None) => {}
        Err(error) => {
            tracing::warn!(process = name, error = %error, "Failed to inspect subprocess state");
        }
    }

    match child.kill().await {
        Ok(()) => tracing::info!(process = name, "Subprocess terminated"),
        Err(error) => {
            tracing::warn!(process = name, error = %error, "Failed to terminate subprocess")
        }
    }
}

async fn wait_for_shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to install SIGTERM handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
}

async fn run_subprocess_supervisor(args: &Args) -> anyhow::Result<()> {
    let executable = std::env::current_exe()?;
    tracing::info!(path = %executable.display(), "Starting all-mode subprocess supervisor");

    let mut api_child = build_child_command(&executable, RuntimeMode::Api, args).spawn()?;
    let mut worker_child = build_child_command(&executable, RuntimeMode::Worker, args).spawn()?;

    tracing::info!(pid = api_child.id(), "Spawned API subprocess");
    tracing::info!(pid = worker_child.id(), "Spawned worker subprocess");

    tokio::select! {
        _ = wait_for_shutdown_signal() => {
            tracing::info!("Shutdown signal received, terminating subprocesses...");
            terminate_child("api", &mut api_child).await;
            terminate_child("worker", &mut worker_child).await;
            Ok(())
        }
        status = api_child.wait() => {
            let status = status?;
            tracing::error!(%status, "API subprocess exited unexpectedly");
            terminate_child("worker", &mut worker_child).await;
            Err(anyhow::anyhow!("API subprocess exited unexpectedly: {status}"))
        }
        status = worker_child.wait() => {
            let status = status?;
            tracing::error!(%status, "Worker subprocess exited unexpectedly");
            terminate_child("api", &mut api_child).await;
            Err(anyhow::anyhow!("Worker subprocess exited unexpectedly: {status}"))
        }
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let args = Args::parse();

    dotenvy::dotenv().ok();

    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "momo=info,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let runtime_mode = RuntimeMode::parse(args.mode.as_deref());
    let single_process = args.single_process || parse_env_bool("MOMO_SINGLE_PROCESS", false);

    tracing::info!(
        mode = runtime_mode.as_str(),
        single_process,
        "Runtime mode selected"
    );

    if should_supervise_subprocesses(runtime_mode, single_process) {
        return run_subprocess_supervisor(&args).await;
    }

    if matches!(runtime_mode, RuntimeMode::All) && single_process {
        tracing::info!("Single-process all-mode enabled");
    }

    let config = Config::from_env();

    if config.server.api_keys.is_empty() {
        tracing::warn!(
            "MOMO_API_KEYS is not set — admin endpoints are locked. Set MOMO_API_KEYS to enable /admin/* routes."
        );
    }

    let read_replica = read_replica_settings(&config.database).map(|replica| ReadReplicaConfig {
        database: replica.database,
        sync_interval_secs: replica.sync_interval_secs,
    });
    let read_sync_interval_secs = read_replica
        .as_ref()
        .map(|replica| replica.sync_interval_secs);
    let migration_policy = if args.rebuild_embeddings {
        DimensionMismatchPolicy::Rebuild
    } else {
        DimensionMismatchPolicy::Reject
    };
    let state = MomoCore::builder(config.clone())
        .migration_policy(migration_policy)
        .read_replica(read_replica)
        .build()
        .await?;

    let worker_options = WorkerOptions {
        run_background_workers: runtime_mode.runs_worker(),
        processing_interval_secs: parse_env_u64("PROCESSING_POLL_INTERVAL_SECS", 10).max(1),
        read_sync_interval_secs: runtime_mode
            .runs_api()
            .then_some(read_sync_interval_secs)
            .flatten(),
    };
    let workers = state.start_workers(worker_options);

    if !runtime_mode.runs_worker() {
        tracing::info!("Worker tasks disabled in API-only mode");
    }

    if runtime_mode.runs_api() {
        let app = create_router(state);

        let addr = format!("{}:{}", config.server.host, config.server.port);
        tracing::info!("Momo starting on http://{}", addr);
        tracing::info!("  Health check: http://{}/api/v1/health", addr);
        tracing::info!("  API docs:     http://{}/api/v1/docs", addr);
        tracing::info!("  OpenAPI spec: http://{}/api/v1/openapi.json", addr);
        if config.mcp.enabled {
            tracing::info!("  MCP endpoint: http://{}{}", addr, config.mcp.path);
        }

        let listener = tokio::net::TcpListener::bind(&addr).await?;
        axum::serve(listener, app)
            .with_graceful_shutdown(shutdown_signal(workers))
            .await?;

        return Ok(());
    }

    tracing::info!("Worker mode active; HTTP server disabled");
    shutdown_signal(workers).await;
    Ok(())
}

async fn shutdown_signal(workers: momo::core::MomoWorkers) {
    wait_for_shutdown_signal().await;
    tracing::info!("Shutdown signal received, cancelling background tasks...");
    workers.shutdown().await;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn runtime_mode_parse_values() {
        assert_eq!(RuntimeMode::parse(Some("all")), RuntimeMode::All);
        assert_eq!(RuntimeMode::parse(Some("api")), RuntimeMode::Api);
        assert_eq!(RuntimeMode::parse(Some("worker")), RuntimeMode::Worker);
        assert_eq!(RuntimeMode::parse(Some("unknown")), RuntimeMode::All);
    }

    #[test]
    fn should_supervise_only_when_all_and_not_single_process() {
        assert!(should_supervise_subprocesses(RuntimeMode::All, false));
        assert!(!should_supervise_subprocesses(RuntimeMode::All, true));
        assert!(!should_supervise_subprocesses(RuntimeMode::Api, false));
        assert!(!should_supervise_subprocesses(RuntimeMode::Worker, false));
    }

    #[test]
    fn parse_env_bool_handles_supported_values() {
        assert!(parse_env_bool_from_raw("true", false));
        assert!(parse_env_bool_from_raw("1", false));
        assert!(parse_env_bool_from_raw("yes", false));
        assert!(!parse_env_bool_from_raw("false", true));
        assert!(!parse_env_bool_from_raw("0", true));
        assert!(!parse_env_bool_from_raw("no", true));
        assert!(parse_env_bool_from_raw("invalid", true));
        assert!(!parse_env_bool_from_raw("invalid", false));
    }

    #[test]
    fn build_read_replica_settings_none_when_no_overrides() {
        let write_cfg = momo::config::DatabaseConfig {
            url: "file:momo.db".to_string(),
            auth_token: None,
            local_path: None,
        };

        let settings = build_read_replica_settings(&write_cfg, None, None, None, 2);
        assert!(settings.is_none());
    }

    #[test]
    fn build_read_replica_settings_uses_write_defaults() {
        let write_cfg = momo::config::DatabaseConfig {
            url: "libsql://primary.turso.io".to_string(),
            auth_token: Some("primary-token".to_string()),
            local_path: Some("primary-local.db".to_string()),
        };

        let settings = build_read_replica_settings(
            &write_cfg,
            Some("libsql://read.turso.io".to_string()),
            None,
            None,
            5,
        )
        .expect("read replica should be configured");

        assert_eq!(settings.database.url, "libsql://read.turso.io");
        assert_eq!(
            settings.database.auth_token,
            Some("primary-token".to_string())
        );
        assert_eq!(
            settings.database.local_path,
            Some("primary-local.db".to_string())
        );
        assert_eq!(settings.sync_interval_secs, 5);
    }

    fn parse_env_bool_from_raw(raw: &str, default: bool) -> bool {
        match raw.trim().to_lowercase().as_str() {
            "1" | "true" | "yes" | "on" => true,
            "0" | "false" | "no" | "off" => false,
            _ => default,
        }
    }
}
