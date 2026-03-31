use fastembed::{EmbeddingModel, InitOptions, TextEmbedding};
use std::sync::{Arc, Mutex};

use crate::config::{parse_provider_model, EmbeddingsConfig};
use crate::error::{MomoError, Result};

enum EmbeddingBackend {
    Local {
        query_model: Arc<Mutex<TextEmbedding>>,
        ingest_model: Arc<Mutex<TextEmbedding>>,
        batch_size: usize,
        ingest_batch_size: usize,
        ingest_batch_pause_ms: u64,
    },
    Http {
        client: reqwest::Client,
        base_url: String,
        model: String,
        api_key: String,
    },
}

pub struct EmbeddingProvider {
    backend: EmbeddingBackend,
    dimensions: usize,
}

impl EmbeddingProvider {
    /// Constructor — supports local fastembed and HTTP (OpenAI-compatible) backends.
    pub fn new(config: &EmbeddingsConfig) -> Result<Self> {
        let (provider, model_name) = parse_provider_model(&config.model);

        match provider {
            "local" => Self::new_local(config, model_name),
            "openai" | "lmstudio" | "ollama" | "infinity" | "http" => {
                let base_url = std::env::var("EMBEDDING_BASE_URL")
                    .unwrap_or_else(|_| "http://localhost:8080/v1".to_string());
                let api_key = std::env::var("EMBEDDING_API_KEY")
                    .unwrap_or_else(|_| "unused".to_string());
                let model = config.model.clone();
                // Strip provider/ prefix — send just the model name to the endpoint
                let model_id = if model.contains('/') {
                    model.split_once('/').map(|x| x.1).unwrap_or(&model).to_string()
                } else {
                    model.clone()
                };
                Ok(Self {
                    backend: EmbeddingBackend::Http {
                        client: reqwest::Client::new(),
                        base_url: base_url.trim_end_matches('/').to_string(),
                        model: model_id,
                        api_key,
                    },
                    dimensions: config.dimensions,
                })
            }
            _ => Err(MomoError::Embedding(format!(
                "Unsupported embedding provider: {provider}. Use local, openai, lmstudio, ollama, infinity, or http.",
            ))),
        }
    }

    fn new_local(config: &EmbeddingsConfig, model_name: &str) -> Result<Self> {
        let embedding_model = resolve_embedding_model(model_name);

        let ingest_batch_size = std::env::var("EMBEDDING_INGEST_BATCH_SIZE")
            .ok()
            .and_then(|raw| raw.parse::<usize>().ok())
            .filter(|size| *size > 0)
            .unwrap_or_else(|| config.batch_size.clamp(1, 32));
        let ingest_batch_pause_ms = std::env::var("EMBEDDING_INGEST_BATCH_PAUSE_MS")
            .ok()
            .and_then(|raw| raw.parse::<u64>().ok())
            .unwrap_or(0);

        let dual_model = std::env::var("EMBEDDING_DUAL_MODEL")
            .ok()
            .and_then(|raw| parse_bool(&raw))
            .unwrap_or(true);

        let query_model = Arc::new(Mutex::new(build_model(embedding_model.clone())?));
        let ingest_model = if dual_model {
            Arc::new(Mutex::new(build_model(embedding_model)?))
        } else {
            Arc::clone(&query_model)
        };

        Ok(Self {
            backend: EmbeddingBackend::Local {
                query_model,
                ingest_model,
                batch_size: config.batch_size,
                ingest_batch_size,
                ingest_batch_pause_ms,
            },
            dimensions: config.dimensions,
        })
    }

    pub async fn embed(&self, texts: Vec<String>) -> Result<Vec<Vec<f32>>> {
        self.embed_with_mode(texts, EmbeddingMode::Query).await
    }

    async fn embed_with_mode(
        &self,
        texts: Vec<String>,
        mode: EmbeddingMode,
    ) -> Result<Vec<Vec<f32>>> {
        if texts.is_empty() {
            return Ok(Vec::new());
        }

        match &self.backend {
            EmbeddingBackend::Local {
                query_model,
                ingest_model,
                batch_size,
                ..
            } => {
                let selected = match mode {
                    EmbeddingMode::Query => query_model,
                    EmbeddingMode::Ingest => ingest_model,
                };
                let model = Arc::clone(selected);
                let batch_size = *batch_size;
                tokio::task::spawn_blocking(move || {
                    let mut model = model.lock().map_err(|e| {
                        MomoError::Embedding(format!("Embedding model lock poisoned: {e}"))
                    })?;
                    model
                        .embed(texts, Some(batch_size))
                        .map_err(|e| MomoError::Embedding(e.to_string()))
                })
                .await
                .map_err(|e| MomoError::Embedding(format!("Embedding worker failed: {e}")))?
            }
            EmbeddingBackend::Http {
                client,
                base_url,
                model,
                api_key,
            } => {
                let url = format!("{base_url}/embeddings");
                let body = serde_json::json!({
                    "input": texts,
                    "model": model,
                });
                let resp = client
                    .post(&url)
                    .header("Authorization", format!("Bearer {api_key}"))
                    .header("Content-Type", "application/json")
                    .json(&body)
                    .send()
                    .await
                    .map_err(|e| {
                        MomoError::Embedding(format!("HTTP embedding request failed: {e}"))
                    })?;

                if !resp.status().is_success() {
                    let status = resp.status();
                    let text = resp.text().await.unwrap_or_default();
                    return Err(MomoError::Embedding(format!(
                        "Embedding endpoint returned {status}: {text}"
                    )));
                }

                #[derive(serde::Deserialize)]
                struct EmbeddingData {
                    embedding: Vec<f32>,
                }
                #[derive(serde::Deserialize)]
                struct EmbeddingResponse {
                    data: Vec<EmbeddingData>,
                }

                let parsed: EmbeddingResponse = resp.json().await.map_err(|e| {
                    MomoError::Embedding(format!("Failed to parse embedding response: {e}"))
                })?;

                Ok(parsed.data.into_iter().map(|d| d.embedding).collect())
            }
        }
    }

    pub async fn embed_single(&self, text: &str) -> Result<Vec<f32>> {
        let embeddings = self.embed(vec![text.to_string()]).await?;
        embeddings
            .into_iter()
            .next()
            .ok_or_else(|| MomoError::Embedding("No embedding generated".to_string()))
    }

    pub async fn embed_query(&self, query: &str) -> Result<Vec<f32>> {
        match &self.backend {
            EmbeddingBackend::Local { .. } => {
                let prefixed = format!("query: {query}");
                self.embed_single(&prefixed).await
            }
            EmbeddingBackend::Http { .. } => {
                // HTTP endpoints don't use query:/passage: prefixes
                self.embed_single(query).await
            }
        }
    }

    pub async fn embed_passage(&self, passage: &str) -> Result<Vec<f32>> {
        match &self.backend {
            EmbeddingBackend::Local { .. } => {
                let prefixed = format!("passage: {passage}");
                self.embed_single(&prefixed).await
            }
            EmbeddingBackend::Http { .. } => self.embed_single(passage).await,
        }
    }

    pub async fn embed_passages(&self, passages: Vec<String>) -> Result<Vec<Vec<f32>>> {
        if passages.is_empty() {
            return Ok(Vec::new());
        }

        match &self.backend {
            EmbeddingBackend::Local {
                ingest_batch_size,
                ingest_batch_pause_ms,
                ..
            } => {
                let mut all_embeddings = Vec::with_capacity(passages.len());
                for batch in passages.chunks(*ingest_batch_size) {
                    let prefixed: Vec<String> =
                        batch.iter().map(|p| format!("passage: {p}")).collect();
                    let mut embedded = self
                        .embed_with_mode(prefixed, EmbeddingMode::Ingest)
                        .await?;
                    all_embeddings.append(&mut embedded);
                    tokio::task::yield_now().await;
                    if *ingest_batch_pause_ms > 0 {
                        tokio::time::sleep(std::time::Duration::from_millis(
                            *ingest_batch_pause_ms,
                        ))
                        .await;
                    }
                }
                Ok(all_embeddings)
            }
            EmbeddingBackend::Http { .. } => {
                // Send in batches of 32 to avoid overwhelming the endpoint
                let batch_size = 32;
                let mut all_embeddings = Vec::with_capacity(passages.len());
                for batch in passages.chunks(batch_size) {
                    let mut embedded = self
                        .embed_with_mode(batch.to_vec(), EmbeddingMode::Ingest)
                        .await?;
                    all_embeddings.append(&mut embedded);
                }
                Ok(all_embeddings)
            }
        }
    }

    pub fn dimensions(&self) -> usize {
        self.dimensions
    }
}

impl Clone for EmbeddingProvider {
    fn clone(&self) -> Self {
        match &self.backend {
            EmbeddingBackend::Local {
                query_model,
                ingest_model,
                batch_size,
                ingest_batch_size,
                ingest_batch_pause_ms,
            } => Self {
                backend: EmbeddingBackend::Local {
                    query_model: Arc::clone(query_model),
                    ingest_model: Arc::clone(ingest_model),
                    batch_size: *batch_size,
                    ingest_batch_size: *ingest_batch_size,
                    ingest_batch_pause_ms: *ingest_batch_pause_ms,
                },
                dimensions: self.dimensions,
            },
            EmbeddingBackend::Http {
                client,
                base_url,
                model,
                api_key,
            } => Self {
                backend: EmbeddingBackend::Http {
                    client: client.clone(),
                    base_url: base_url.clone(),
                    model: model.clone(),
                    api_key: api_key.clone(),
                },
                dimensions: self.dimensions,
            },
        }
    }
}

#[derive(Clone, Copy)]
enum EmbeddingMode {
    Query,
    Ingest,
}

fn resolve_embedding_model(model_name: &str) -> EmbeddingModel {
    match model_name {
        "BAAI/bge-small-en-v1.5" | "bge-small-en-v1.5" => EmbeddingModel::BGESmallENV15,
        "BAAI/bge-base-en-v1.5" | "bge-base-en-v1.5" => EmbeddingModel::BGEBaseENV15,
        "BAAI/bge-large-en-v1.5" | "bge-large-en-v1.5" => EmbeddingModel::BGELargeENV15,
        "all-MiniLM-L6-v2" | "sentence-transformers/all-MiniLM-L6-v2" => {
            EmbeddingModel::AllMiniLML6V2
        }
        "all-MiniLM-L12-v2" | "sentence-transformers/all-MiniLM-L12-v2" => {
            EmbeddingModel::AllMiniLML12V2
        }
        "nomic-embed-text-v1" | "nomic-ai/nomic-embed-text-v1" => EmbeddingModel::NomicEmbedTextV1,
        "nomic-embed-text-v1.5" | "nomic-ai/nomic-embed-text-v1.5" => {
            EmbeddingModel::NomicEmbedTextV15
        }
        _ => EmbeddingModel::BGESmallENV15,
    }
}

fn build_model(embedding_model: EmbeddingModel) -> Result<TextEmbedding> {
    let mut last_error: Option<String> = None;

    for attempt in 1..=3 {
        match TextEmbedding::try_new(
            InitOptions::new(embedding_model.clone()).with_show_download_progress(true),
        ) {
            Ok(model) => return Ok(model),
            Err(err) => {
                last_error = Some(err.to_string());
                if attempt < 3 {
                    std::thread::sleep(std::time::Duration::from_secs(2));
                }
            }
        }
    }

    Err(MomoError::Embedding(format!(
        "Failed to initialize embedding model after retries: {}",
        last_error.unwrap_or_else(|| "unknown error".to_string())
    )))
}

fn parse_bool(raw: &str) -> Option<bool> {
    match raw.trim().to_lowercase().as_str() {
        "1" | "true" | "yes" | "on" => Some(true),
        "0" | "false" | "no" | "off" => Some(false),
        _ => None,
    }
}
