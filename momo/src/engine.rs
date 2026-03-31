use tokio::runtime::{Builder, Runtime};

use crate::config::Config;
use crate::core::{MomoCore, MomoCoreBuilder, MomoWorkers, WorkerOptions};
use crate::error::{MomoError, Result};
use crate::migration::DimensionMismatchPolicy;
use crate::models::{Memory, MemoryType, SearchDocumentsRequest, SearchMemoriesRequest};

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
pub struct EmbeddedCreateMemoryRequest {
    pub content: String,
    pub container_tag: String,
    pub is_static: Option<bool>,
    pub memory_type: Option<MemoryType>,
}

pub struct MomoEngine {
    runtime: Runtime,
    core: MomoCore,
    workers: Option<MomoWorkers>,
}

impl MomoEngine {
    pub fn new(builder: MomoCoreBuilder) -> Result<Self> {
        let runtime = Builder::new_multi_thread()
            .enable_all()
            .build()
            .map_err(MomoError::Io)?;
        let core = runtime.block_on(builder.build())?;

        Ok(Self {
            runtime,
            core,
            workers: None,
        })
    }

    pub fn from_config(config: Config, migration_policy: DimensionMismatchPolicy) -> Result<Self> {
        Self::new(MomoCore::builder(config).migration_policy(migration_policy))
    }

    pub fn core(&self) -> &MomoCore {
        &self.core
    }

    pub fn start_workers(&mut self, options: WorkerOptions) -> Result<()> {
        if self.workers.is_some() {
            return Err(MomoError::Validation(
                "Workers are already running for this engine".to_string(),
            ));
        }

        self.workers = Some(self.core.start_workers(options));
        Ok(())
    }

    pub fn stop_workers(&mut self) {
        if let Some(workers) = self.workers.take() {
            self.runtime.block_on(workers.shutdown());
        }
    }

    pub fn create_memory(&self, request: EmbeddedCreateMemoryRequest) -> Result<Memory> {
        self.runtime
            .block_on(self.core.memory.create_memory_with_type(
                &request.content,
                &request.container_tag,
                request.is_static.unwrap_or(false),
                request.memory_type.unwrap_or_default(),
            ))
    }

    pub fn create_memory_json(&self, request_json: &str) -> Result<String> {
        let request: EmbeddedCreateMemoryRequest = serde_json::from_str(request_json)?;
        let response = self.create_memory(request)?;
        serde_json::to_string(&response).map_err(MomoError::from)
    }

    pub fn search_memories_json(&self, request_json: &str) -> Result<String> {
        let request: SearchMemoriesRequest = serde_json::from_str(request_json)?;
        let response = self
            .runtime
            .block_on(self.core.search.search_memories(request))?;
        serde_json::to_string(&response).map_err(MomoError::from)
    }

    pub fn search_documents_json(&self, request_json: &str) -> Result<String> {
        let request: SearchDocumentsRequest = serde_json::from_str(request_json)?;
        let response = self
            .runtime
            .block_on(self.core.search.search_documents(request))?;
        serde_json::to_string(&response).map_err(MomoError::from)
    }
}

impl Drop for MomoEngine {
    fn drop(&mut self) {
        self.stop_workers();
    }
}
