use std::future::Future;
use std::sync::Arc;

use tokio::task::JoinHandle;
use tokio_util::sync::CancellationToken;

use crate::config::{Config, DatabaseConfig};
use crate::db::{Database, DatabaseBackend, LibSqlBackend};
use crate::embeddings::{EmbeddingProvider, RerankerProvider};
use crate::error::{MomoError, Result};
use crate::intelligence::{InferenceEngine, MemoryExtractor};
use crate::llm::LlmProvider;
use crate::migration::{self, DimensionMismatchPolicy, MigrationDecision};
use crate::ocr::OcrProvider;
use crate::processing::ProcessingPipeline;
use crate::services::{
    EpisodeDecayManager, ForgettingManager, MemoryService, ProfileRefreshManager, SearchService,
};
use crate::transcription::TranscriptionProvider;

#[derive(Debug, Clone)]
pub struct ReadReplicaConfig {
    pub database: DatabaseConfig,
    pub sync_interval_secs: u64,
}

#[derive(Clone)]
pub struct MomoCore {
    pub config: Arc<Config>,
    pub db: Arc<dyn DatabaseBackend>,
    pub read_db: Arc<dyn DatabaseBackend>,
    pub embeddings: EmbeddingProvider,
    pub reranker: Option<RerankerProvider>,
    pub llm: LlmProvider,
    pub search: SearchService,
    pub memory: MemoryService,
    pub pipeline: ProcessingPipeline,
    pub extractor: MemoryExtractor,
}

pub struct MomoCoreBuilder {
    config: Config,
    migration_policy: DimensionMismatchPolicy,
    read_replica: Option<ReadReplicaConfig>,
}

#[derive(Debug, Clone)]
pub struct WorkerOptions {
    pub run_background_workers: bool,
    pub processing_interval_secs: u64,
    pub read_sync_interval_secs: Option<u64>,
}

pub struct MomoWorkers {
    cancel_token: CancellationToken,
    handles: Vec<JoinHandle<()>>,
}

impl MomoCoreBuilder {
    pub fn new(config: Config) -> Self {
        Self {
            config,
            migration_policy: DimensionMismatchPolicy::Reject,
            read_replica: None,
        }
    }

    pub fn migration_policy(mut self, migration_policy: DimensionMismatchPolicy) -> Self {
        self.migration_policy = migration_policy;
        self
    }

    pub fn read_replica(mut self, read_replica: Option<ReadReplicaConfig>) -> Self {
        self.read_replica = read_replica;
        self
    }

    pub async fn build(self) -> Result<MomoCore> {
        let config = Arc::new(self.config);

        tracing::info!("Initializing write database...");
        let write_raw_db = Database::new(&config.database).await?;
        let write_db: Arc<dyn DatabaseBackend> = Arc::new(LibSqlBackend::new(write_raw_db));

        let read_db: Arc<dyn DatabaseBackend> = if let Some(replica) = &self.read_replica {
            tracing::info!(
                url = %replica.database.url,
                local_path = ?replica.database.local_path,
                "Initializing dedicated read database"
            );
            let read_raw_db = Database::new(&replica.database).await?;
            Arc::new(LibSqlBackend::new(read_raw_db))
        } else {
            tracing::info!("Using primary database for reads and writes");
            write_db.clone()
        };

        tracing::info!("Loading embedding model: {}...", config.embeddings.model);
        let embeddings = EmbeddingProvider::new(&config.embeddings)?;

        match migration::check_dimension_compatibility(
            &*write_db,
            &embeddings,
            self.migration_policy,
        )
        .await?
        {
            MigrationDecision::NotNeeded => {}
            MigrationDecision::Approved => {
                migration::trigger_reembedding(&*write_db, embeddings.dimensions()).await?;
                tracing::info!("Migration started. Documents will be re-embedded in background.");
            }
            MigrationDecision::Rejected => {
                return Err(MomoError::Internal(
                    "Embedding dimension mismatch - use an explicit rebuild policy to migrate"
                        .to_string(),
                ));
            }
        }

        tracing::info!("Initializing OCR provider: {}...", config.ocr.model);
        let ocr = OcrProvider::new(&config.ocr)?;
        if !ocr.is_available() {
            tracing::warn!("OCR unavailable - image processing will be skipped");
        }

        tracing::info!(
            "Initializing transcription provider: {}...",
            config.transcription.model
        );
        let transcription = TranscriptionProvider::new(&config.transcription)?;
        if !transcription.is_available() {
            tracing::warn!("Transcription unavailable - audio processing will be skipped");
        }

        if let Some(llm_config) = &config.llm {
            tracing::info!("Initializing LLM provider: {}...", llm_config.model);
        }
        let llm = LlmProvider::new(config.llm.as_ref());
        if !llm.is_available() {
            tracing::warn!("LLM unavailable - LLM features will be disabled");
        }

        let reranker = if let Some(reranker_config) = &config.reranker {
            if reranker_config.enabled {
                tracing::info!("Initializing reranker: {}...", reranker_config.model);
                match RerankerProvider::new_async(reranker_config).await {
                    Ok(provider) => {
                        tracing::info!("Reranker initialized successfully");
                        Some(provider)
                    }
                    Err(error) => {
                        tracing::warn!(
                            "Failed to initialize reranker: {} - continuing without reranking",
                            error
                        );
                        None
                    }
                }
            } else {
                None
            }
        } else {
            None
        };

        Ok(MomoCore::new(
            config,
            write_db,
            read_db,
            embeddings,
            reranker,
            ocr,
            transcription,
            llm,
        ))
    }
}

impl MomoCore {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        config: Arc<Config>,
        db: Arc<dyn DatabaseBackend>,
        read_db: Arc<dyn DatabaseBackend>,
        embeddings: EmbeddingProvider,
        reranker: Option<RerankerProvider>,
        ocr: OcrProvider,
        transcription: TranscriptionProvider,
        llm: LlmProvider,
    ) -> Self {
        let search = SearchService::new(
            read_db.clone(),
            db.clone(),
            embeddings.clone(),
            reranker.clone(),
            llm.clone(),
            config.as_ref(),
        );
        let memory = MemoryService::new(db.clone(), embeddings.clone(), llm.clone());
        let extractor = MemoryExtractor::new(llm.clone(), embeddings.clone());
        let pipeline = ProcessingPipeline::new(
            db.clone(),
            embeddings.clone(),
            ocr,
            transcription,
            llm.clone(),
            config.as_ref(),
        );

        Self {
            config,
            db,
            read_db,
            embeddings,
            reranker,
            llm,
            search,
            memory,
            pipeline,
            extractor,
        }
    }

    pub fn builder(config: Config) -> MomoCoreBuilder {
        MomoCoreBuilder::new(config)
    }

    pub fn start_workers(&self, options: WorkerOptions) -> MomoWorkers {
        MomoWorkers::start(self.clone(), options)
    }
}

impl Default for WorkerOptions {
    fn default() -> Self {
        Self {
            run_background_workers: true,
            processing_interval_secs: 10,
            read_sync_interval_secs: None,
        }
    }
}

impl MomoWorkers {
    pub fn start(core: MomoCore, options: WorkerOptions) -> Self {
        let cancel_token = CancellationToken::new();
        let mut handles = Vec::new();

        if options.run_background_workers {
            tracing::info!(
                interval_secs = options.processing_interval_secs,
                "Starting background processing"
            );
            handles.push(spawn_loop(
                cancel_token.child_token(),
                options.processing_interval_secs.max(1),
                "Background processing shutting down...",
                "Background processing error",
                {
                    let pipeline = core.pipeline.clone();
                    move || {
                        let pipeline = pipeline.clone();
                        async move { pipeline.process_pending().await }
                    }
                },
            ));

            let forgetting = ForgettingManager::new(
                core.db.clone(),
                core.config.memory.forgetting_check_interval_secs,
            );
            tracing::info!("Starting forgetting manager...");
            handles.push(spawn_loop(
                cancel_token.child_token(),
                forgetting.interval_secs(),
                "Forgetting manager shutting down...",
                "Forgetting manager error",
                move || {
                    let forgetting = forgetting.clone();
                    async move { forgetting.run_once().await.map(|_| ()) }
                },
            ));

            let episode_decay = EpisodeDecayManager::new(
                core.db.clone(),
                core.config.memory.episode_decay_threshold,
                core.config.memory.episode_forget_grace_days,
                core.config.memory.episode_decay_days,
                core.config.memory.episode_decay_factor,
            );
            tracing::info!(
                "Starting episode decay manager... (threshold={}, grace_days={})",
                core.config.memory.episode_decay_threshold,
                core.config.memory.episode_forget_grace_days
            );
            handles.push(spawn_loop(
                cancel_token.child_token(),
                episode_decay.interval_secs(),
                "Episode decay manager shutting down...",
                "Episode decay manager error",
                move || {
                    let episode_decay = episode_decay.clone();
                    async move { episode_decay.run_once().await.map(|_| ()) }
                },
            ));

            if core.config.memory.inference.enabled {
                let inference = InferenceEngine::new(
                    core.db.clone(),
                    core.llm.clone(),
                    core.embeddings.clone(),
                    core.config.memory.inference.clone(),
                );
                tracing::info!(
                    "Starting inference engine... (interval={}s)",
                    core.config.memory.inference.interval_secs
                );
                handles.push(spawn_loop(
                    cancel_token.child_token(),
                    inference.interval_secs(),
                    "Inference engine shutting down...",
                    "Inference engine error",
                    move || {
                        let inference = inference.clone();
                        async move { inference.run_once().await.map(|_| ()) }
                    },
                ));
            }

            if core.llm.is_available() {
                let profile_refresh = ProfileRefreshManager::new(
                    core.db.clone(),
                    core.llm.clone(),
                    core.config.memory.profile_refresh_interval_secs,
                );
                tracing::info!(
                    "Starting profile refresh manager... (interval={}s)",
                    core.config.memory.profile_refresh_interval_secs
                );
                handles.push(spawn_loop(
                    cancel_token.child_token(),
                    profile_refresh.interval_secs(),
                    "Profile refresh manager shutting down...",
                    "Profile refresh error",
                    move || {
                        let profile_refresh = profile_refresh.clone();
                        async move { profile_refresh.run_once().await.map(|_| ()) }
                    },
                ));
            }
        }

        if let Some(interval_secs) = options.read_sync_interval_secs {
            tracing::info!(interval_secs, "Starting read-replica sync loop");
            handles.push(spawn_loop(
                cancel_token.child_token(),
                interval_secs.max(1),
                "Read-replica sync loop shutting down...",
                "Read-replica sync failed",
                {
                    let read_db = core.read_db.clone();
                    move || {
                        let read_db = read_db.clone();
                        async move { read_db.sync().await }
                    }
                },
            ));
        }

        Self {
            cancel_token,
            handles,
        }
    }

    pub fn cancel(&self) {
        self.cancel_token.cancel();
    }

    pub async fn shutdown(self) {
        self.cancel();
        for handle in self.handles {
            if let Err(error) = handle.await {
                tracing::warn!(error = %error, "Worker task join failed");
            }
        }
    }
}

fn spawn_loop<F, Fut>(
    cancel_token: CancellationToken,
    interval_secs: u64,
    shutdown_message: &'static str,
    error_message: &'static str,
    mut task: F,
) -> JoinHandle<()>
where
    F: FnMut() -> Fut + Send + 'static,
    Fut: Future<Output = Result<()>> + Send + 'static,
{
    tokio::spawn(async move {
        loop {
            tokio::select! {
                _ = cancel_token.cancelled() => {
                    tracing::info!("{shutdown_message}");
                    break;
                }
                _ = tokio::time::sleep(tokio::time::Duration::from_secs(interval_secs)) => {
                    if let Err(error) = task().await {
                        tracing::error!(error = %error, "{error_message}");
                    }
                }
            }
        }
    })
}
